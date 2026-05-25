import {
  and,
  count,
  desc,
  eq,
  gte,
  isNotNull,
  isNull,
  like,
  lt,
  ne,
  or,
  SQL
} from "drizzle-orm";
import { db } from "../../db";
import {
  NewProjectRecord,
  ProjectRecord,
  ProjectStatus,
  projects
} from "../../db/schema";
import {
  parseJsonObject,
  parseStringArray,
  stringifyJsonObject,
  stringifyStringArray
} from "../../utils/json";
import { generatePublicKey } from "../../utils/random";
import { HttpError, type PaginationResult } from "../../utils/response";
import { isPastIso, nowIso } from "../../utils/time";
import type {
  CreateProjectInput,
  ProjectListQuery,
  UpdateProjectInput
} from "./project.validators";

export type ProjectListItem = {
  id: number;
  name: string;
  slug: string;
  publicKey: string;
  enabled: boolean;
  status: ProjectStatus;
  effectiveStatus: ProjectStatus;
  expiresAt: string | null;
  popupEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProjectDetail = ProjectListItem & {
  popupTitle: string;
  popupContent: string;
  popupLevel: "info" | "warning" | "danger";
  variables: Record<string, unknown>;
  allowedDomains: string[];
  remarks: string;
};

function buildWhere(conditions: SQL[]): SQL | undefined {
  return conditions.length > 0 ? and(...conditions) : undefined;
}

function buildNotExpiredCondition(now: string): SQL {
  return or(isNull(projects.expiresAt), gte(projects.expiresAt, now))!;
}

function buildEffectiveStatusCondition(status: ProjectStatus, now: string): SQL {
  if (status === "suspended") {
    return or(eq(projects.enabled, false), eq(projects.status, "suspended"))!;
  }

  if (status === "expired") {
    return and(
      eq(projects.enabled, true),
      ne(projects.status, "suspended"),
      or(eq(projects.status, "expired"), lt(projects.expiresAt, now))!
    )!;
  }

  return and(
    eq(projects.enabled, true),
    eq(projects.status, status),
    buildNotExpiredCondition(now)
  )!;
}

export function computeEffectiveStatus(
  project: Pick<ProjectRecord, "enabled" | "status" | "expiresAt">,
  now: Date = new Date()
): ProjectStatus {
  if (!project.enabled || project.status === "suspended") {
    return "suspended";
  }

  if (project.status === "expired") {
    return "expired";
  }

  if (isPastIso(project.expiresAt, now)) {
    return "expired";
  }

  return project.status === "grace" ? "grace" : "active";
}

function toProjectListItem(row: ProjectRecord): ProjectListItem {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    publicKey: row.publicKey,
    enabled: row.enabled,
    status: row.status,
    effectiveStatus: computeEffectiveStatus(row),
    expiresAt: row.expiresAt,
    popupEnabled: row.popupEnabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export function toProjectDetail(row: ProjectRecord): ProjectDetail {
  return {
    ...toProjectListItem(row),
    popupTitle: row.popupTitle ?? "",
    popupContent: row.popupContent ?? "",
    popupLevel: row.popupLevel,
    variables: parseJsonObject(row.variablesJson),
    allowedDomains: parseStringArray(row.allowedDomainsJson),
    remarks: row.remarks ?? ""
  };
}

function getProjectRecordById(id: number): ProjectRecord {
  const row = db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
    .get();

  if (!row) {
    throw new HttpError(404, "项目不存在");
  }

  return row;
}

export function findProjectRecordBySlug(slug: string): ProjectRecord | null {
  return (
    db
      .select()
      .from(projects)
      .where(and(eq(projects.slug, slug), isNull(projects.deletedAt)))
      .get() ?? null
  );
}

function ensureSlugAvailable(slug: string, excludeId?: number): void {
  const conditions: SQL[] = [eq(projects.slug, slug)];

  if (excludeId !== undefined) {
    conditions.push(ne(projects.id, excludeId));
  }

  const row = db
    .select({
      id: projects.id,
      slug: projects.slug,
      publicKey: projects.publicKey,
      deletedAt: projects.deletedAt
    })
    .from(projects)
    .where(buildWhere(conditions))
    .get();

  if (row?.deletedAt) {
    releaseDeletedProjectUniqueValues(row);
    return;
  }

  if (row) {
    throw new HttpError(400, "slug 已存在");
  }
}

function buildDeletedSlug(slug: string, id: number): string {
  return `${slug}__deleted__${id}`;
}

function buildDeletedPublicKey(publicKey: string, id: number): string {
  return `${publicKey}__deleted__${id}`;
}

function releaseDeletedProjectUniqueValues(
  row: Pick<ProjectRecord, "id" | "slug" | "publicKey">
): void {
  db.update(projects)
    .set({
      slug: buildDeletedSlug(row.slug, row.id),
      publicKey: buildDeletedPublicKey(row.publicKey, row.id)
    })
    .where(and(eq(projects.id, row.id), isNotNull(projects.deletedAt)))
    .run();
}

function generateUniquePublicKey(): string {
  for (let index = 0; index < 10; index += 1) {
    const key = generatePublicKey();
    const existing = db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.publicKey, key))
      .get();

    if (!existing) {
      return key;
    }
  }

  throw new HttpError(500, "生成 publicKey 失败");
}

function buildInsertValues(input: CreateProjectInput): NewProjectRecord {
  const timestamp = nowIso();

  return {
    name: input.name,
    slug: input.slug,
    publicKey: generateUniquePublicKey(),
    enabled: input.enabled,
    status: input.status,
    expiresAt: input.expiresAt,
    popupEnabled: input.popupEnabled,
    popupTitle: input.popupTitle ?? null,
    popupContent: input.popupContent ?? null,
    popupLevel: input.popupLevel,
    variablesJson: stringifyJsonObject(input.variables),
    allowedDomainsJson: stringifyStringArray(input.allowedDomains),
    remarks: input.remarks ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null
  };
}

export function listProjects(
  query: ProjectListQuery
): PaginationResult<ProjectListItem> {
  const conditions: SQL[] = [isNull(projects.deletedAt)];

  if (query.keyword) {
    const keyword = `%${query.keyword}%`;
    conditions.push(or(like(projects.name, keyword), like(projects.slug, keyword))!);
  }

  if (query.status) {
    conditions.push(buildEffectiveStatusCondition(query.status, nowIso()));
  }

  if (query.enabled !== undefined) {
    conditions.push(eq(projects.enabled, query.enabled));
  }

  const where = buildWhere(conditions);
  const countRow = db
    .select({ total: count() })
    .from(projects)
    .where(where)
    .get();

  const rows = db
    .select()
    .from(projects)
    .where(where)
    .orderBy(desc(projects.createdAt), desc(projects.id))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize)
    .all();

  return {
    items: rows.map(toProjectListItem),
    total: countRow?.total ?? 0,
    page: query.page,
    pageSize: query.pageSize
  };
}

export function getProjectDetail(id: number): ProjectDetail {
  return toProjectDetail(getProjectRecordById(id));
}

export function createProject(input: CreateProjectInput): ProjectDetail {
  ensureSlugAvailable(input.slug);

  const [created] = db
    .insert(projects)
    .values(buildInsertValues(input))
    .returning()
    .all();

  return toProjectDetail(created);
}

export function updateProject(
  id: number,
  input: UpdateProjectInput
): { before: ProjectDetail; after: ProjectDetail } {
  const beforeRecord = getProjectRecordById(id);
  const before = toProjectDetail(beforeRecord);

  if (input.slug && input.slug !== beforeRecord.slug) {
    ensureSlugAvailable(input.slug, id);
  }

  const patch: Partial<NewProjectRecord> = {
    updatedAt: nowIso()
  };

  if (input.name !== undefined) patch.name = input.name;
  if (input.slug !== undefined) patch.slug = input.slug;
  if (input.enabled !== undefined) patch.enabled = input.enabled;
  if (input.status !== undefined) patch.status = input.status;
  if (input.expiresAt !== undefined) patch.expiresAt = input.expiresAt;
  if (input.popupEnabled !== undefined) patch.popupEnabled = input.popupEnabled;
  if (input.popupTitle !== undefined) patch.popupTitle = input.popupTitle;
  if (input.popupContent !== undefined) patch.popupContent = input.popupContent;
  if (input.popupLevel !== undefined) patch.popupLevel = input.popupLevel;
  if (input.variables !== undefined) {
    patch.variablesJson = stringifyJsonObject(input.variables);
  }
  if (input.allowedDomains !== undefined) {
    patch.allowedDomainsJson = stringifyStringArray(input.allowedDomains);
  }
  if (input.remarks !== undefined) patch.remarks = input.remarks;

  const [updated] = db
    .update(projects)
    .set(patch)
    .where(eq(projects.id, id))
    .returning()
    .all();

  return {
    before,
    after: toProjectDetail(updated)
  };
}

export function regenerateProjectKey(
  id: number
): { publicKey: string; before: ProjectDetail; after: ProjectDetail } {
  const beforeRecord = getProjectRecordById(id);
  const before = toProjectDetail(beforeRecord);
  const publicKey = generateUniquePublicKey();

  const [updated] = db
    .update(projects)
    .set({
      publicKey,
      updatedAt: nowIso()
    })
    .where(eq(projects.id, id))
    .returning()
    .all();

  return {
    publicKey,
    before,
    after: toProjectDetail(updated)
  };
}

export function softDeleteProject(id: number): { before: ProjectDetail } {
  const beforeRecord = getProjectRecordById(id);
  const before = toProjectDetail(beforeRecord);
  const timestamp = nowIso();

  db.update(projects)
    .set({
      slug: buildDeletedSlug(beforeRecord.slug, beforeRecord.id),
      publicKey: buildDeletedPublicKey(beforeRecord.publicKey, beforeRecord.id),
      deletedAt: timestamp,
      updatedAt: timestamp
    })
    .where(eq(projects.id, id))
    .run();

  return { before };
}
