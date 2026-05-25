import { and, count, desc, eq, gte, like, lt, lte, SQL } from "drizzle-orm";
import { db } from "../../db";
import {
  adminActionLogs,
  projectAccessLogs,
  ProjectStatus
} from "../../db/schema";
import { env } from "../../env";
import { parseNullableJson } from "../../utils/json";
import { nowIso } from "../../utils/time";
import type { PaginationResult } from "../../utils/response";

export type RequestLogMeta = {
  ip?: string | null;
  userAgent?: string | null;
  origin?: string | null;
  referer?: string | null;
};

export type AdminActionInput = RequestLogMeta & {
  action: string;
  targetType: string;
  targetId?: number | null;
  before?: unknown;
  after?: unknown;
};

export type ProjectAccessLogInput = RequestLogMeta & {
  projectId?: number | null;
  slug: string;
  publicKey?: string | null;
  requestDomain?: string | null;
  effectiveStatus?: ProjectStatus | null;
  allowed: boolean;
  message?: string | null;
};

const ACCESS_LOG_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
let lastAccessLogCleanupAt = 0;

function cleanupOldAccessLogs(): void {
  const now = Date.now();
  if (now - lastAccessLogCleanupAt < ACCESS_LOG_CLEANUP_INTERVAL_MS) {
    return;
  }

  lastAccessLogCleanupAt = now;
  const cutoff = new Date(
    now - env.ACCESS_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  db.delete(projectAccessLogs)
    .where(lt(projectAccessLogs.createdAt, cutoff))
    .run();
}

export function recordAdminAction(input: AdminActionInput): void {
  db.insert(adminActionLogs)
    .values({
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      beforeJson:
        input.before === undefined ? null : JSON.stringify(input.before),
      afterJson: input.after === undefined ? null : JSON.stringify(input.after),
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      createdAt: nowIso()
    })
    .run();
}

export function recordProjectAccessLog(input: ProjectAccessLogInput): void {
  cleanupOldAccessLogs();

  db.insert(projectAccessLogs)
    .values({
      projectId: input.projectId ?? null,
      slug: input.slug,
      publicKey: input.publicKey ?? null,
      requestDomain: input.requestDomain ?? null,
      origin: input.origin ?? null,
      referer: input.referer ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      effectiveStatus: input.effectiveStatus ?? null,
      allowed: input.allowed,
      message: input.message ?? null,
      createdAt: nowIso()
    })
    .run();
}

type AccessLogFilters = {
  projectId?: number;
  slug?: string;
  publicKey?: string;
  requestDomain?: string;
  ip?: string;
  origin?: string;
  referer?: string;
  userAgent?: string;
  message?: string;
  effectiveStatus?: ProjectStatus;
  allowed?: boolean;
  createdAtFrom?: string;
  createdAtTo?: string;
  page: number;
  pageSize: number;
};

type ActionLogFilters = {
  action?: string;
  targetType?: string;
  targetId?: number;
  page: number;
  pageSize: number;
};

function buildWhere(conditions: SQL[]): SQL | undefined {
  return conditions.length > 0 ? and(...conditions) : undefined;
}

function contains(value: string): string {
  return `%${value}%`;
}

export function listAccessLogs(
  filters: AccessLogFilters
): PaginationResult<Record<string, unknown>> {
  const conditions: SQL[] = [];

  if (filters.projectId !== undefined) {
    conditions.push(eq(projectAccessLogs.projectId, filters.projectId));
  }
  if (filters.slug) {
    conditions.push(eq(projectAccessLogs.slug, filters.slug));
  }
  if (filters.publicKey) {
    conditions.push(eq(projectAccessLogs.publicKey, filters.publicKey));
  }
  if (filters.requestDomain) {
    conditions.push(eq(projectAccessLogs.requestDomain, filters.requestDomain));
  }
  if (filters.ip) {
    conditions.push(eq(projectAccessLogs.ip, filters.ip));
  }
  if (filters.origin) {
    conditions.push(like(projectAccessLogs.origin, contains(filters.origin)));
  }
  if (filters.referer) {
    conditions.push(like(projectAccessLogs.referer, contains(filters.referer)));
  }
  if (filters.userAgent) {
    conditions.push(like(projectAccessLogs.userAgent, contains(filters.userAgent)));
  }
  if (filters.message) {
    conditions.push(like(projectAccessLogs.message, contains(filters.message)));
  }
  if (filters.effectiveStatus) {
    conditions.push(eq(projectAccessLogs.effectiveStatus, filters.effectiveStatus));
  }
  if (filters.allowed !== undefined) {
    conditions.push(eq(projectAccessLogs.allowed, filters.allowed));
  }
  if (filters.createdAtFrom) {
    conditions.push(gte(projectAccessLogs.createdAt, filters.createdAtFrom));
  }
  if (filters.createdAtTo) {
    conditions.push(lte(projectAccessLogs.createdAt, filters.createdAtTo));
  }

  const where = buildWhere(conditions);
  const countRow = db
    .select({ total: count() })
    .from(projectAccessLogs)
    .where(where)
    .get();

  const items = db
    .select()
    .from(projectAccessLogs)
    .where(where)
    .orderBy(desc(projectAccessLogs.createdAt), desc(projectAccessLogs.id))
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize)
    .all();

  return {
    items,
    total: countRow?.total ?? 0,
    page: filters.page,
    pageSize: filters.pageSize
  };
}

export function listActionLogs(
  filters: ActionLogFilters
): PaginationResult<Record<string, unknown>> {
  const conditions: SQL[] = [];

  if (filters.action) {
    conditions.push(eq(adminActionLogs.action, filters.action));
  }
  if (filters.targetType) {
    conditions.push(eq(adminActionLogs.targetType, filters.targetType));
  }
  if (filters.targetId !== undefined) {
    conditions.push(eq(adminActionLogs.targetId, filters.targetId));
  }

  const where = buildWhere(conditions);
  const countRow = db
    .select({ total: count() })
    .from(adminActionLogs)
    .where(where)
    .get();

  const rows = db
    .select()
    .from(adminActionLogs)
    .where(where)
    .orderBy(desc(adminActionLogs.createdAt), desc(adminActionLogs.id))
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize)
    .all();

  const items = rows.map((row) => ({
    id: row.id,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    before: parseNullableJson(row.beforeJson),
    after: parseNullableJson(row.afterJson),
    ip: row.ip,
    userAgent: row.userAgent,
    createdAt: row.createdAt
  }));

  return {
    items,
    total: countRow?.total ?? 0,
    page: filters.page,
    pageSize: filters.pageSize
  };
}
