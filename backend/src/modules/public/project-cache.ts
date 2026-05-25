import { createClient } from "redis";
import {
  popupLevelValues,
  ProjectRecord,
  projectStatusValues
} from "../../db/schema";
import { env } from "../../env";

type RedisClient = ReturnType<typeof createClient>;

export type ProjectCacheStore = {
  get(slug: string): Promise<ProjectRecord | null>;
  set(project: ProjectRecord, ttlSeconds: number): Promise<void>;
  deleteBySlug(slug: string): Promise<void>;
};

type ProjectDetailCacheInput = {
  id: number;
  name: string;
  slug: string;
  publicKey: string;
  enabled: boolean;
  status: ProjectRecord["status"];
  expiresAt: string | null;
  popupEnabled: boolean;
  popupTitle: string;
  popupContent: string;
  popupLevel: ProjectRecord["popupLevel"];
  variables: Record<string, unknown>;
  allowedDomains: string[];
  remarks: string;
  createdAt: string;
  updatedAt: string;
};

type ProjectCacheInput = ProjectRecord | ProjectDetailCacheInput;

const PROJECT_CACHE_KEY_PREFIX = "license:project:v1:slug:";
const REDIS_RETRY_BACKOFF_MS = 30 * 1000;

let redisClient: RedisClient | null = null;
let redisConnectPromise: Promise<RedisClient | null> | null = null;
let redisUnavailableUntil = 0;
const cacheBypassUntilBySlug = new Map<string, number>();
let testStore: ProjectCacheStore | null | undefined;

function warnCacheError(operation: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`Project Redis cache ${operation} failed: ${message}`);
}

function buildProjectCacheKey(slug: string): string {
  return `${PROJECT_CACHE_KEY_PREFIX}${slug}`;
}

function markRedisUnavailable(): void {
  redisUnavailableUntil = Date.now() + REDIS_RETRY_BACKOFF_MS;
}

function isRedisInBackoff(): boolean {
  return Date.now() < redisUnavailableUntil;
}

function markProjectCacheBypass(slug: string): void {
  cacheBypassUntilBySlug.set(
    slug,
    Date.now() + env.PUBLIC_CONFIG_CACHE_TTL_SECONDS * 1000
  );
}

function clearProjectCacheBypass(slug: string): void {
  cacheBypassUntilBySlug.delete(slug);
}

function shouldBypassProjectCache(slug: string): boolean {
  const bypassUntil = cacheBypassUntilBySlug.get(slug);

  if (bypassUntil === undefined) {
    return false;
  }

  if (bypassUntil <= Date.now()) {
    cacheBypassUntilBySlug.delete(slug);
    return false;
  }

  return true;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isProjectStatus(value: unknown): value is ProjectRecord["status"] {
  return (
    typeof value === "string" &&
    (projectStatusValues as readonly string[]).includes(value)
  );
}

function isPopupLevel(value: unknown): value is ProjectRecord["popupLevel"] {
  return (
    typeof value === "string" &&
    (popupLevelValues as readonly string[]).includes(value)
  );
}

function isProjectRecord(value: unknown): value is ProjectRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === "number" &&
    typeof candidate.name === "string" &&
    typeof candidate.slug === "string" &&
    typeof candidate.publicKey === "string" &&
    typeof candidate.enabled === "boolean" &&
    isProjectStatus(candidate.status) &&
    isNullableString(candidate.expiresAt) &&
    typeof candidate.popupEnabled === "boolean" &&
    isNullableString(candidate.popupTitle) &&
    isNullableString(candidate.popupContent) &&
    isPopupLevel(candidate.popupLevel) &&
    typeof candidate.variablesJson === "string" &&
    typeof candidate.allowedDomainsJson === "string" &&
    isNullableString(candidate.remarks) &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.updatedAt === "string" &&
    candidate.deletedAt === null
  );
}

function parseProjectRecord(value: string): ProjectRecord | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return isProjectRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function toProjectRecord(input: ProjectCacheInput): ProjectRecord {
  if ("variablesJson" in input) {
    return input;
  }

  return {
    id: input.id,
    name: input.name,
    slug: input.slug,
    publicKey: input.publicKey,
    enabled: input.enabled,
    status: input.status,
    expiresAt: input.expiresAt,
    popupEnabled: input.popupEnabled,
    popupTitle: input.popupTitle,
    popupContent: input.popupContent,
    popupLevel: input.popupLevel,
    variablesJson: JSON.stringify(input.variables),
    allowedDomainsJson: JSON.stringify(input.allowedDomains),
    remarks: input.remarks,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    deletedAt: null
  };
}

function withRedisTimeout<T>(promise: Promise<T>, operation: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`${operation} timed out after ${env.REDIS_COMMAND_TIMEOUT_MS}ms`));
    }, env.REDIS_COMMAND_TIMEOUT_MS);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeout);
  });
}

function createRedisClient(): RedisClient {
  const client = createClient({
    url: env.REDIS_URL,
    socket: {
      connectTimeout: env.REDIS_COMMAND_TIMEOUT_MS,
      reconnectStrategy: false
    }
  });

  client.on("error", (error) => {
    warnCacheError("client", error);
  });

  return client;
}

async function getRedisClient(): Promise<RedisClient | null> {
  if (!env.REDIS_URL || isRedisInBackoff()) {
    return null;
  }

  if (redisClient?.isReady) {
    return redisClient;
  }

  if (!redisClient) {
    redisClient = createRedisClient();
  }

  if (!redisConnectPromise) {
    redisConnectPromise = withRedisTimeout(redisClient.connect(), "connect")
      .then(() => redisClient)
      .catch((error) => {
        warnCacheError("connect", error);
        markRedisUnavailable();
        redisClient?.destroy();
        redisClient = null;
        return null;
      })
      .finally(() => {
        redisConnectPromise = null;
      });
  }

  return redisConnectPromise;
}

const redisProjectCacheStore: ProjectCacheStore = {
  async get(slug: string): Promise<ProjectRecord | null> {
    const client = await getRedisClient();
    if (!client) {
      return null;
    }

    const value = await withRedisTimeout(
      client.get(buildProjectCacheKey(slug)),
      "get"
    );

    return value ? parseProjectRecord(value) : null;
  },

  async set(project: ProjectRecord, ttlSeconds: number): Promise<void> {
    if (project.deletedAt !== null) {
      return;
    }

    const client = await getRedisClient();
    if (!client) {
      throw new Error("Redis client unavailable");
    }

    await withRedisTimeout(
      client.set(buildProjectCacheKey(project.slug), JSON.stringify(project), {
        EX: ttlSeconds
      }),
      "set"
    );
  },

  async deleteBySlug(slug: string): Promise<void> {
    const client = await getRedisClient();
    if (!client) {
      throw new Error("Redis client unavailable");
    }

    await withRedisTimeout(client.del(buildProjectCacheKey(slug)), "del");
  }
};

function getActiveStore(): ProjectCacheStore | null {
  if (testStore !== undefined) {
    return testStore;
  }

  return env.REDIS_URL ? redisProjectCacheStore : null;
}

export function setProjectCacheStoreForTests(
  store: ProjectCacheStore | null | undefined
): void {
  testStore = store;
}

export async function closeProjectCache(): Promise<void> {
  const client = redisClient;
  const connectPromise = redisConnectPromise;

  redisClient = null;
  redisConnectPromise = null;
  redisUnavailableUntil = 0;
  cacheBypassUntilBySlug.clear();

  if (connectPromise) {
    await connectPromise.catch(() => null);
  }

  if (!client) {
    return;
  }

  try {
    if (client.isOpen) {
      await withRedisTimeout(client.quit(), "quit");
    }
  } catch (error) {
    warnCacheError("quit", error);
    client.destroy();
  }
}

export function getProjectCacheTtlSeconds(
  project: Pick<ProjectRecord, "expiresAt">,
  now: Date = new Date()
): number {
  const defaultTtl = env.PUBLIC_CONFIG_CACHE_TTL_SECONDS;

  if (!project.expiresAt) {
    return defaultTtl;
  }

  const expiresAt = Date.parse(project.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) {
    return defaultTtl;
  }

  const secondsUntilExpiry = Math.max(
    1,
    Math.floor((expiresAt - now.getTime()) / 1000)
  );

  return Math.min(defaultTtl, secondsUntilExpiry);
}

export async function getCachedProjectRecord(
  slug: string
): Promise<ProjectRecord | null> {
  if (shouldBypassProjectCache(slug)) {
    return null;
  }

  const store = getActiveStore();
  if (!store) {
    return null;
  }

  try {
    return await store.get(slug);
  } catch (error) {
    warnCacheError("get", error);
    markRedisUnavailable();
    return null;
  }
}

export async function cacheProjectRecord(input: ProjectCacheInput): Promise<void> {
  const project = toProjectRecord(input);
  const store = getActiveStore();
  if (!store || project.deletedAt !== null) {
    return;
  }

  try {
    await store.set(project, getProjectCacheTtlSeconds(project));
    clearProjectCacheBypass(project.slug);
  } catch (error) {
    warnCacheError("set", error);
    markRedisUnavailable();
    markProjectCacheBypass(project.slug);
  }
}

export async function invalidateProjectCacheBySlug(
  slug: string | null | undefined
): Promise<void> {
  if (!slug) {
    return;
  }

  markProjectCacheBypass(slug);

  const store = getActiveStore();
  if (!store) {
    return;
  }

  try {
    await store.deleteBySlug(slug);
  } catch (error) {
    warnCacheError("del", error);
    markRedisUnavailable();
  }
}

export async function invalidateProjectCacheBySlugs(
  slugs: Array<string | null | undefined>
): Promise<void> {
  const uniqueSlugs = Array.from(
    new Set(slugs.filter((slug): slug is string => Boolean(slug)))
  );

  await Promise.all(uniqueSlugs.map((slug) => invalidateProjectCacheBySlug(slug)));
}
