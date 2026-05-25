import type { FastifyReply, FastifyRequest } from "fastify";
import { randomBytes } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import { db, sqlite } from "../../db";
import { adminSessions } from "../../db/schema";
import { env } from "../../env";
import { nowIso } from "../../utils/time";

export const ADMIN_SESSION_COOKIE = "admin_session";

type SessionPayload = {
  sessionId: string;
  username: string;
  issuedAt: string;
};

let sessionStorageReady = false;

export function ensureAdminSessionStorage(): void {
  if (sessionStorageReady) {
    return;
  }

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      issued_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT
    );

    CREATE INDEX IF NOT EXISTS admin_sessions_username_idx ON admin_sessions (username);
    CREATE INDEX IF NOT EXISTS admin_sessions_expires_at_idx ON admin_sessions (expires_at);
    CREATE INDEX IF NOT EXISTS admin_sessions_revoked_at_idx ON admin_sessions (revoked_at);
  `);
  sessionStorageReady = true;
}

function encodeSession(payload: SessionPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeSession(token: string): SessionPayload | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parsed: unknown = JSON.parse(decoded);

    if (typeof parsed === "object" && parsed !== null) {
      const candidate = parsed as Record<string, unknown>;

      if (
        typeof candidate.sessionId === "string" &&
        typeof candidate.username === "string" &&
        typeof candidate.issuedAt === "string"
      ) {
        return {
          sessionId: candidate.sessionId,
          username: candidate.username,
          issuedAt: candidate.issuedAt
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

export async function validateAdminCredentials(
  username: string,
  password: string
): Promise<boolean> {
  return username === env.ADMIN_USERNAME && password === env.ADMIN_PASSWORD;
}

function createSessionId(): string {
  return randomBytes(32).toString("base64url");
}

function getSessionExpiry(issuedAt: Date): string {
  return new Date(
    issuedAt.getTime() + env.ADMIN_SESSION_TTL_SECONDS * 1000
  ).toISOString();
}

function readSessionPayloadFromRequest(
  request: FastifyRequest
): SessionPayload | null {
  const cookieValue = request.cookies[ADMIN_SESSION_COOKIE];

  if (!cookieValue) {
    return null;
  }

  const unsigned = request.unsignCookie(cookieValue);
  if (!unsigned.valid || !unsigned.value) {
    return null;
  }

  return decodeSession(unsigned.value);
}

function cleanupExpiredSessions(now: string): void {
  db.delete(adminSessions).where(lt(adminSessions.expiresAt, now)).run();
}

export function setAdminSession(reply: FastifyReply): void {
  ensureAdminSessionStorage();

  const issuedAt = new Date();
  const issuedAtIso = issuedAt.toISOString();
  const expiresAt = getSessionExpiry(issuedAt);
  const sessionId = createSessionId();

  cleanupExpiredSessions(issuedAtIso);
  db.insert(adminSessions)
    .values({
      id: sessionId,
      username: env.ADMIN_USERNAME,
      issuedAt: issuedAtIso,
      expiresAt,
      revokedAt: null
    })
    .run();

  const token = encodeSession({
    sessionId,
    username: env.ADMIN_USERNAME,
    issuedAt: issuedAtIso
  });

  reply.setCookie(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: env.ADMIN_SESSION_TTL_SECONDS,
    signed: true
  });
}

export function clearAdminSession(reply: FastifyReply): void {
  reply.clearCookie(ADMIN_SESSION_COOKIE, {
    path: "/"
  });
}

export function revokeAdminSessionFromRequest(request: FastifyRequest): void {
  ensureAdminSessionStorage();

  const payload = readSessionPayloadFromRequest(request);

  if (!payload) {
    return;
  }

  db.update(adminSessions)
    .set({
      revokedAt: nowIso()
    })
    .where(eq(adminSessions.id, payload.sessionId))
    .run();
}

export function getAdminUsernameFromRequest(
  request: FastifyRequest
): string | null {
  ensureAdminSessionStorage();

  const payload = readSessionPayloadFromRequest(request);
  if (!payload || payload.username !== env.ADMIN_USERNAME) {
    return null;
  }

  const session = db
    .select()
    .from(adminSessions)
    .where(eq(adminSessions.id, payload.sessionId))
    .get();

  if (
    !session ||
    session.username !== env.ADMIN_USERNAME ||
    session.revokedAt !== null
  ) {
    return null;
  }

  const expiresAt = Date.parse(session.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return null;
  }

  return payload.username;
}
