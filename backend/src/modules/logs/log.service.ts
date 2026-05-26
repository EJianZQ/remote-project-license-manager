import {
  and,
  count,
  desc,
  eq,
  gte,
  like,
  lt,
  lte,
  SQL
} from "drizzle-orm";
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

type AccessLogFilterCriteria = {
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
};

type AccessLogFilters = AccessLogFilterCriteria & {
  page: number;
  pageSize: number;
};

type AccessLogStatsFilters = Omit<
  AccessLogFilterCriteria,
  "createdAtFrom" | "createdAtTo"
>;

type ActionLogFilters = {
  action?: string;
  targetType?: string;
  targetId?: number;
  page: number;
  pageSize: number;
};

type StatusCounts = Record<ProjectStatus | "unknown", number>;

type AccessLogStatsBucket = {
  date: string;
  total: number;
  allowed: number;
  denied: number;
  statuses: StatusCounts;
};

type AccessLogStatsRow = {
  effectiveStatus: ProjectStatus | null;
  allowed: boolean;
  total: number;
};

const timeZoneFormatters = new Map<string, Intl.DateTimeFormat>();

function buildWhere(conditions: SQL[]): SQL | undefined {
  return conditions.length > 0 ? and(...conditions) : undefined;
}

function contains(value: string): string {
  return `%${value}%`;
}

function buildAccessLogFilterConditions(
  filters: AccessLogFilterCriteria
): SQL[] {
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

  return conditions;
}

function createStatusCounts(): StatusCounts {
  return {
    active: 0,
    grace: 0,
    expired: 0,
    suspended: 0,
    unknown: 0
  };
}

function createStatsBucket(date: string): AccessLogStatsBucket {
  return {
    date,
    total: 0,
    allowed: 0,
    denied: 0,
    statuses: createStatusCounts()
  };
}

function getTimeZoneFormatter(timezone: string): Intl.DateTimeFormat {
  const cached = timeZoneFormatters.get(timezone);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });

  timeZoneFormatters.set(timezone, formatter);
  return formatter;
}

function getTimeZoneParts(date: Date, timezone: string) {
  const values = Object.fromEntries(
    getTimeZoneFormatter(timezone)
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  ) as Record<string, number>;

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second
  };
}

function formatLocalDate(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function getLocalDateString(date: Date, timezone: string): string {
  const parts = getTimeZoneParts(date, timezone);
  return formatLocalDate(parts.year, parts.month, parts.day);
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function addLocalDays(value: string, days: number): string {
  const { year, month, day } = parseLocalDate(value);
  const date = new Date(Date.UTC(year, month - 1, day + days));

  return formatLocalDate(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate()
  );
}

function getTimeZoneOffsetMs(date: Date, timezone: string): number {
  const parts = getTimeZoneParts(date, timezone);
  const localAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );

  return localAsUtc - date.getTime();
}

function localDateStartToUtc(value: string, timezone: string): Date {
  const { year, month, day } = parseLocalDate(value);
  const localAsUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
  let utc = localAsUtc;

  for (let index = 0; index < 3; index += 1) {
    const offset = getTimeZoneOffsetMs(new Date(utc), timezone);
    const nextUtc = localAsUtc - offset;

    if (Math.abs(nextUtc - utc) < 1000) {
      utc = nextUtc;
      break;
    }

    utc = nextUtc;
  }

  return new Date(utc);
}

function getLocalDayBoundsUtc(date: string, timezone: string) {
  return {
    start: localDateStartToUtc(date, timezone).toISOString(),
    end: localDateStartToUtc(addLocalDays(date, 1), timezone).toISOString()
  };
}

function getRecentLocalDates(days: number, timezone: string): string[] {
  const today = getLocalDateString(new Date(), timezone);
  const start = addLocalDays(today, -(days - 1));

  return Array.from({ length: days }, (_item, index) =>
    addLocalDays(start, index)
  );
}

function applyStatsRows(
  bucket: AccessLogStatsBucket,
  rows: AccessLogStatsRow[]
): AccessLogStatsBucket {
  for (const row of rows) {
    const total = Number(row.total);
    const status = row.effectiveStatus ?? "unknown";

    bucket.total += total;
    if (row.allowed) {
      bucket.allowed += total;
    } else {
      bucket.denied += total;
    }

    bucket.statuses[status] += total;
  }

  return bucket;
}

function summarizeAccessLogsBetween(
  filters: AccessLogStatsFilters,
  date: string,
  start: string,
  end: string
): AccessLogStatsBucket {
  const conditions = buildAccessLogFilterConditions(filters);
  conditions.push(gte(projectAccessLogs.createdAt, start));
  conditions.push(lt(projectAccessLogs.createdAt, end));

  const rows = db
    .select({
      effectiveStatus: projectAccessLogs.effectiveStatus,
      allowed: projectAccessLogs.allowed,
      total: count()
    })
    .from(projectAccessLogs)
    .where(buildWhere(conditions))
    .groupBy(projectAccessLogs.effectiveStatus, projectAccessLogs.allowed)
    .all() as AccessLogStatsRow[];

  return applyStatsRows(createStatsBucket(date), rows);
}

export function listAccessLogs(
  filters: AccessLogFilters
): PaginationResult<Record<string, unknown>> {
  const conditions = buildAccessLogFilterConditions(filters);
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

export function getTodayAccessLogStats(
  input: AccessLogStatsFilters & { timezone: string }
) {
  const date = getLocalDateString(new Date(), input.timezone);
  const bounds = getLocalDayBoundsUtc(date, input.timezone);
  const stats = summarizeAccessLogsBetween(input, date, bounds.start, bounds.end);

  return {
    date: stats.date,
    timezone: input.timezone,
    total: stats.total,
    allowed: stats.allowed,
    denied: stats.denied,
    statuses: stats.statuses
  };
}

export function listDailyAccessLogStats(
  input: AccessLogStatsFilters & { days: number; timezone: string }
) {
  const dates = getRecentLocalDates(input.days, input.timezone);
  const items = dates.map((date) => {
    const bounds = getLocalDayBoundsUtc(date, input.timezone);
    return summarizeAccessLogsBetween(input, date, bounds.start, bounds.end);
  });

  return {
    timezone: input.timezone,
    days: input.days,
    fromDate: dates[0],
    toDate: dates[dates.length - 1],
    items
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
