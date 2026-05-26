import assert from "node:assert/strict";
import test from "node:test";
import type { ProjectRecord } from "../src/db/schema";
import type { ProjectCacheStore } from "../src/modules/public/project-cache";

process.env.ADMIN_USERNAME = "admin";
process.env.ADMIN_PASSWORD = "test-password";
process.env.SESSION_SECRET = "test-session-secret-with-32-chars!!";
process.env.DATABASE_URL = ":memory:";
process.env.NODE_ENV = "test";
process.env.CORS_ORIGIN = "http://localhost:5173";
process.env.ADMIN_SESSION_TTL_SECONDS = "3600";
process.env.PUBLIC_CONFIG_RATE_LIMIT_MAX = "2";
process.env.PUBLIC_CONFIG_RATE_LIMIT_WINDOW_SECONDS = "60";
process.env.ACCESS_LOG_RETENTION_DAYS = "1";
process.env.REDIS_URL = "";
process.env.PUBLIC_CONFIG_CACHE_TTL_SECONDS = "120";
process.env.REDIS_COMMAND_TIMEOUT_MS = "500";

let sqlite: {
  exec(sql: string): unknown;
  prepare(sql: string): {
    get(...params: unknown[]): unknown;
    run(...params: unknown[]): unknown;
  };
};

type TestApp = {
  inject(options: unknown): Promise<any>;
  close(): Promise<void>;
};

type TestContext = {
  after(fn: () => void | Promise<void>): void;
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
};

type ProjectResponse = {
  id: number;
  name: string;
  slug: string;
  publicKey: string;
  enabled: boolean;
  status: string;
  effectiveStatus: string;
  expiresAt: string | null;
  popupEnabled: boolean;
  popupTitle?: string;
  popupContent?: string;
  popupLevel?: string;
  variables?: Record<string, unknown>;
  allowedDomains?: string[];
  remarks?: string;
};

class FakeProjectCacheStore implements ProjectCacheStore {
  records = new Map<string, ProjectRecord>();
  getCalls: string[] = [];
  setCalls: Array<{ slug: string; ttlSeconds: number }> = [];
  deleteCalls: string[] = [];
  failGet = false;
  failSet = false;
  failDelete = false;

  async get(slug: string): Promise<ProjectRecord | null> {
    this.getCalls.push(slug);
    if (this.failGet) {
      throw new Error("fake get failure");
    }

    const record = this.records.get(slug);
    return record ? { ...record } : null;
  }

  async set(project: ProjectRecord, ttlSeconds: number): Promise<void> {
    this.setCalls.push({ slug: project.slug, ttlSeconds });
    if (this.failSet) {
      throw new Error("fake set failure");
    }

    this.records.set(project.slug, { ...project });
  }

  async deleteBySlug(slug: string): Promise<void> {
    this.deleteCalls.push(slug);
    if (this.failDelete) {
      throw new Error("fake delete failure");
    }

    this.records.delete(slug);
  }
}

function getCookieHeader(response: { headers: Record<string, unknown> }): string {
  const rawSetCookie = response.headers["set-cookie"];
  const setCookie = Array.isArray(rawSetCookie)
    ? rawSetCookie[0]
    : rawSetCookie;

  assert.equal(typeof setCookie, "string");
  return setCookie.split(";")[0];
}

function parseBody<T>(response: { body: string }): ApiResponse<T> {
  return JSON.parse(response.body) as ApiResponse<T>;
}

function resetDatabase(): void {
  sqlite.exec(`
    DELETE FROM project_access_logs;
    DELETE FROM admin_action_logs;
    DELETE FROM admin_sessions;
    DELETE FROM projects;
  `);
}

async function createFreshApp(t: TestContext): Promise<TestApp> {
  const appModule = await import("../src/app");
  const dbModule = await import("../src/db");
  sqlite = dbModule.sqlite;
  await import("../src/db/migrate");

  const app = await appModule.createApp();
  t.after(async () => {
    await app.close();
  });

  resetDatabase();
  return app;
}

async function login(app: { inject(options: unknown): Promise<any> }): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/api/admin/auth/login",
    payload: {
      username: "admin",
      password: "test-password"
    }
  });

  assert.equal(response.statusCode, 200, response.body);
  return getCookieHeader(response);
}

async function createProject(
  app: { inject(options: unknown): Promise<any> },
  cookie: string,
  slug: string,
  overrides: Record<string, unknown> = {}
): Promise<ProjectResponse> {
  const response = await app.inject({
    method: "POST",
    url: "/api/admin/projects",
    headers: {
      cookie
    },
    payload: {
      name: `Project ${slug}`,
      slug,
      enabled: true,
      status: "active",
      expiresAt: null,
      popupEnabled: false,
      variables: {
        title: slug
      },
      allowedDomains: [],
      ...overrides
    }
  });

  assert.equal(response.statusCode, 200, response.body);
  return parseBody<ProjectResponse>(response).data;
}

function countRows(sql: string, ...params: unknown[]): number {
  const row = sqlite.prepare(sql).get(...params) as { count: number };
  return row.count;
}

type TestAccessLogInput = {
  projectId?: number | null;
  slug: string;
  publicKey?: string | null;
  requestDomain?: string | null;
  origin?: string | null;
  referer?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  effectiveStatus?: string | null;
  allowed: boolean;
  message?: string | null;
  createdAt: string;
};

function insertAccessLog(input: TestAccessLogInput): void {
  sqlite
    .prepare(
      `INSERT INTO project_access_logs
       (
         project_id,
         slug,
         public_key,
         request_domain,
         origin,
         referer,
         ip,
         user_agent,
         effective_status,
         allowed,
         message,
         created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.projectId ?? null,
      input.slug,
      input.publicKey ?? null,
      input.requestDomain ?? null,
      input.origin ?? null,
      input.referer ?? null,
      input.ip ?? null,
      input.userAgent ?? null,
      input.effectiveStatus ?? null,
      input.allowed ? 1 : 0,
      input.message ?? null,
      input.createdAt
    );
}

function getLocalDateForTimeZone(value: string, timezone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    })
      .formatToParts(new Date(value))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  ) as Record<string, string>;

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getDailyStatItem(
  items: Array<{ date: string; total: number }>,
  date: string
) {
  return items.find((item) => item.date === date);
}

test("backend security and behavior regressions stay fixed", async (t) => {
  const appModule = await import("../src/app");
  const dbModule = await import("../src/db");
  sqlite = dbModule.sqlite;
  await import("../src/db/migrate");

  const app = await appModule.createApp();
  t.after(async () => {
    await app.close();
  });

  sqlite.exec(`
    DELETE FROM project_access_logs;
    DELETE FROM admin_action_logs;
    DELETE FROM admin_sessions;
    DELETE FROM projects;
  `);

  const firstCookie = await login(app);
  const meResponse = await app.inject({
    method: "GET",
    url: "/api/admin/auth/me",
    headers: {
      cookie: firstCookie
    }
  });
  assert.equal(meResponse.statusCode, 200, meResponse.body);

  sqlite
    .prepare("UPDATE admin_sessions SET expires_at = ?")
    .run(new Date(Date.now() - 1000).toISOString());
  const expiredMeResponse = await app.inject({
    method: "GET",
    url: "/api/admin/auth/me",
    headers: {
      cookie: firstCookie
    }
  });
  assert.equal(expiredMeResponse.statusCode, 401, expiredMeResponse.body);

  const logoutCookie = await login(app);
  const logoutResponse = await app.inject({
    method: "POST",
    url: "/api/admin/auth/logout",
    headers: {
      cookie: logoutCookie
    }
  });
  assert.equal(logoutResponse.statusCode, 200, logoutResponse.body);
  const revokedMeResponse = await app.inject({
    method: "GET",
    url: "/api/admin/auth/me",
    headers: {
      cookie: logoutCookie
    }
  });
  assert.equal(revokedMeResponse.statusCode, 401, revokedMeResponse.body);

  const adminCookie = await login(app);

  sqlite.exec(`
    CREATE TRIGGER fail_create_project_log
    BEFORE INSERT ON admin_action_logs
    WHEN NEW.action = 'create_project'
    BEGIN
      SELECT RAISE(ABORT, 'forced audit failure');
    END;
  `);
  try {
    const failedCreateResponse = await app.inject({
      method: "POST",
      url: "/api/admin/projects",
      headers: {
        cookie: adminCookie
      },
      payload: {
        name: "Rollback Project",
        slug: "tx-rollback",
        expiresAt: null,
        variables: {},
        allowedDomains: []
      }
    });
    assert.equal(failedCreateResponse.statusCode, 500, failedCreateResponse.body);
    assert.equal(
      countRows("SELECT count(*) AS count FROM projects WHERE slug = ?", "tx-rollback"),
      0
    );
  } finally {
    sqlite.exec("DROP TRIGGER fail_create_project_log;");
  }

  const deletedProject = await createProject(app, adminCookie, "reuse-slug");
  const deleteResponse = await app.inject({
    method: "DELETE",
    url: `/api/admin/projects/${deletedProject.id}`,
    headers: {
      cookie: adminCookie
    }
  });
  assert.equal(deleteResponse.statusCode, 200, deleteResponse.body);
  const recreatedProject = await createProject(app, adminCookie, "reuse-slug");
  assert.notEqual(recreatedProject.id, deletedProject.id);
  const otherPublicProject = await createProject(app, adminCookie, "other-public-slug");

  await createProject(app, adminCookie, "expired-by-date", {
    status: "active",
    expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  });
  const expiredListResponse = await app.inject({
    method: "GET",
    url: "/api/admin/projects?status=expired&pageSize=100",
    headers: {
      cookie: adminCookie
    }
  });
  assert.equal(expiredListResponse.statusCode, 200, expiredListResponse.body);
  const expiredList = JSON.parse(expiredListResponse.body).data as {
    items: Array<{ slug: string; effectiveStatus: string }>;
  };
  assert.ok(
    expiredList.items.some(
      (item) => item.slug === "expired-by-date" && item.effectiveStatus === "expired"
    )
  );

  sqlite
    .prepare(
      `INSERT INTO project_access_logs
       (project_id, slug, public_key, allowed, created_at)
       VALUES (NULL, ?, NULL, 0, ?)`
    )
    .run(
      "old-log",
      new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    );

  for (let index = 0; index < 2; index += 1) {
    const publicResponse = await app.inject({
      method: "GET",
      url: `/api/public/projects/${recreatedProject.slug}/config?key=${recreatedProject.publicKey}`
    });
    assert.equal(publicResponse.statusCode, 200, publicResponse.body);
  }

  assert.equal(
    countRows("SELECT count(*) AS count FROM project_access_logs WHERE slug = ?", "old-log"),
    0
  );

  const otherSlugResponse = await app.inject({
    method: "GET",
    url: `/api/public/projects/${otherPublicProject.slug}/config?key=${otherPublicProject.publicKey}`
  });
  assert.equal(otherSlugResponse.statusCode, 200, otherSlugResponse.body);

  const limitedResponse = await app.inject({
    method: "GET",
    url: `/api/public/projects/${recreatedProject.slug}/config?key=${recreatedProject.publicKey}`
  });
  assert.equal(limitedResponse.statusCode, 429, limitedResponse.body);

  const firstInvalidSlugResponse = await app.inject({
    method: "GET",
    url: "/api/public/projects/INVALID/config?key=bad"
  });
  assert.equal(firstInvalidSlugResponse.statusCode, 400, firstInvalidSlugResponse.body);

  const secondInvalidSlugResponse = await app.inject({
    method: "GET",
    url: "/api/public/projects/INVALID-2/config?key=bad"
  });
  assert.equal(secondInvalidSlugResponse.statusCode, 400, secondInvalidSlugResponse.body);

  const limitedInvalidSlugResponse = await app.inject({
    method: "GET",
    url: "/api/public/projects/INVALID-3/config?key=bad"
  });
  assert.equal(limitedInvalidSlugResponse.statusCode, 429, limitedInvalidSlugResponse.body);
});

test("admin and public API contract gaps stay covered", async (t) => {
  const app = await createFreshApp(t);

  const healthResponse = await app.inject({
    method: "GET",
    url: "/health"
  });
  assert.equal(healthResponse.statusCode, 200, healthResponse.body);
  assert.deepEqual(parseBody<{ status: string }>(healthResponse).data, {
    status: "ok"
  });

  const notFoundResponse = await app.inject({
    method: "GET",
    url: "/does-not-exist"
  });
  assert.equal(notFoundResponse.statusCode, 404, notFoundResponse.body);

  const unauthorizedResponse = await app.inject({
    method: "GET",
    url: "/api/admin/projects"
  });
  assert.equal(unauthorizedResponse.statusCode, 401, unauthorizedResponse.body);

  const badLoginResponse = await app.inject({
    method: "POST",
    url: "/api/admin/auth/login",
    payload: {
      username: "admin",
      password: "wrong-password"
    }
  });
  assert.equal(badLoginResponse.statusCode, 401, badLoginResponse.body);

  const adminCookie = await login(app);

  const invalidDomainResponse = await app.inject({
    method: "POST",
    url: "/api/admin/projects",
    headers: {
      cookie: adminCookie
    },
    payload: {
      name: "Invalid Domain Project",
      slug: "invalid-domain-project",
      expiresAt: null,
      variables: {},
      allowedDomains: ["https://example.com"]
    }
  });
  assert.equal(invalidDomainResponse.statusCode, 400, invalidDomainResponse.body);
  assert.match(
    (JSON.parse(invalidDomainResponse.body) as { message: string }).message,
    /allowedDomains/
  );

  const domainProject = await createProject(app, adminCookie, "domain-project", {
    popupEnabled: true,
    popupTitle: "Original title",
    popupContent: "Original content",
    popupLevel: "warning",
    variables: {
      title: "Domain Project",
      nested: {
        enabled: true
      }
    },
    allowedDomains: [" Example.COM. ", "www.example.com"],
    remarks: "internal note"
  });
  assert.deepEqual(domainProject.allowedDomains, ["example.com", "www.example.com"]);

  const duplicateSlugResponse = await app.inject({
    method: "POST",
    url: "/api/admin/projects",
    headers: {
      cookie: adminCookie
    },
    payload: {
      name: "Duplicate Domain Project",
      slug: domainProject.slug,
      expiresAt: null,
      variables: {},
      allowedDomains: []
    }
  });
  assert.equal(duplicateSlugResponse.statusCode, 400, duplicateSlugResponse.body);
  assert.match(
    (JSON.parse(duplicateSlugResponse.body) as { message: string }).message,
    /slug 已存在/
  );

  const detailResponse = await app.inject({
    method: "GET",
    url: `/api/admin/projects/${domainProject.id}`,
    headers: {
      cookie: adminCookie
    }
  });
  assert.equal(detailResponse.statusCode, 200, detailResponse.body);
  const detail = parseBody<ProjectResponse>(detailResponse).data;
  assert.equal(detail.remarks, "internal note");
  assert.deepEqual(detail.variables, {
    title: "Domain Project",
    nested: {
      enabled: true
    }
  });
  assert.deepEqual(detail.allowedDomains, ["example.com", "www.example.com"]);

  const updateResponse = await app.inject({
    method: "PUT",
    url: `/api/admin/projects/${domainProject.id}`,
    headers: {
      cookie: adminCookie
    },
    payload: {
      slug: "domain-renamed",
      status: "grace",
      popupEnabled: true,
      popupTitle: "Grace title",
      popupContent: "Grace content",
      popupLevel: "info",
      variables: {
        phase: "grace"
      },
      allowedDomains: ["APP.EXAMPLE.COM"],
      remarks: null
    }
  });
  assert.equal(updateResponse.statusCode, 200, updateResponse.body);
  const updatedProject = parseBody<ProjectResponse>(updateResponse).data;
  assert.equal(updatedProject.slug, "domain-renamed");
  assert.equal(updatedProject.effectiveStatus, "grace");
  assert.equal(updatedProject.remarks, "");
  assert.deepEqual(updatedProject.allowedDomains, ["app.example.com"]);

  const listResponse = await app.inject({
    method: "GET",
    url: "/api/admin/projects?keyword=domain&enabled=true&pageSize=10",
    headers: {
      cookie: adminCookie
    }
  });
  assert.equal(listResponse.statusCode, 200, listResponse.body);
  const projectList = parseBody<{
    items: ProjectResponse[];
    total: number;
    page: number;
    pageSize: number;
  }>(listResponse).data;
  assert.ok(projectList.items.some((item) => item.slug === "domain-renamed"));

  const publicGraceResponse = await app.inject({
    method: "GET",
    url: `/api/public/projects/${updatedProject.slug}/config?key=${updatedProject.publicKey}`,
    headers: {
      origin: "https://app.example.com",
      "user-agent": "contract-test"
    }
  });
  assert.equal(publicGraceResponse.statusCode, 200, publicGraceResponse.body);
  const graceConfig = parseBody<Record<string, any>>(publicGraceResponse).data;
  assert.equal(graceConfig.status, "grace");
  assert.equal(graceConfig.enabled, true);
  assert.deepEqual(graceConfig.variables, {
    phase: "grace"
  });
  assert.deepEqual(graceConfig.popup, {
    enabled: true,
    level: "info",
    title: "Grace title",
    content: "Grace content"
  });
  assert.equal(graceConfig.message, "当前项目已进入宽限期");

  const deniedDomainResponse = await app.inject({
    method: "GET",
    url: `/api/public/projects/${updatedProject.slug}/config?key=${updatedProject.publicKey}`,
    headers: {
      origin: "https://sub.app.example.com"
    }
  });
  assert.equal(deniedDomainResponse.statusCode, 403, deniedDomainResponse.body);

  const keyProject = await createProject(app, adminCookie, "key-rotate", {
    variables: {
      generation: "old"
    }
  });
  const regenerateResponse = await app.inject({
    method: "POST",
    url: `/api/admin/projects/${keyProject.id}/regenerate-key`,
    headers: {
      cookie: adminCookie
    }
  });
  assert.equal(regenerateResponse.statusCode, 200, regenerateResponse.body);
  const regenerated = parseBody<{
    publicKey: string;
    project: ProjectResponse;
  }>(regenerateResponse).data;
  assert.notEqual(regenerated.publicKey, keyProject.publicKey);
  assert.equal(regenerated.project.publicKey, regenerated.publicKey);

  const oldKeyResponse = await app.inject({
    method: "GET",
    url: `/api/public/projects/${keyProject.slug}/config?key=${keyProject.publicKey}`
  });
  assert.equal(oldKeyResponse.statusCode, 404, oldKeyResponse.body);

  const newKeyResponse = await app.inject({
    method: "GET",
    url: `/api/public/projects/${keyProject.slug}/config?key=${regenerated.publicKey}`
  });
  assert.equal(newKeyResponse.statusCode, 200, newKeyResponse.body);

  const expiredProject = await createProject(app, adminCookie, "status-expired", {
    status: "expired",
    popupEnabled: true,
    popupTitle: "Custom expired title",
    popupContent: "Custom expired content",
    variables: {
      hidden: true
    }
  });
  const expiredPublicResponse = await app.inject({
    method: "GET",
    url: `/api/public/projects/${expiredProject.slug}/config?key=${expiredProject.publicKey}`
  });
  assert.equal(expiredPublicResponse.statusCode, 200, expiredPublicResponse.body);
  const expiredConfig = parseBody<Record<string, any>>(expiredPublicResponse).data;
  assert.equal(expiredConfig.status, "expired");
  assert.equal(expiredConfig.enabled, false);
  assert.deepEqual(expiredConfig.variables, {});
  assert.deepEqual(expiredConfig.popup, {
    enabled: true,
    level: "danger",
    title: "项目服务已到期",
    content: "当前项目服务已到期，请联系开发方处理。"
  });

  const suspendedProject = await createProject(app, adminCookie, "status-suspended", {
    enabled: false,
    status: "active",
    variables: {
      hidden: true
    }
  });
  const suspendedPublicResponse = await app.inject({
    method: "GET",
    url: `/api/public/projects/${suspendedProject.slug}/config?key=${suspendedProject.publicKey}`
  });
  assert.equal(suspendedPublicResponse.statusCode, 200, suspendedPublicResponse.body);
  const suspendedConfig = parseBody<Record<string, any>>(suspendedPublicResponse).data;
  assert.equal(suspendedConfig.status, "suspended");
  assert.equal(suspendedConfig.enabled, false);
  assert.deepEqual(suspendedConfig.variables, {});
  assert.deepEqual(suspendedConfig.popup, {
    enabled: true,
    level: "danger",
    title: "项目服务已暂停",
    content: "当前项目服务已暂停，请联系开发方恢复。"
  });

  const refererProject = await createProject(app, adminCookie, "referer-domain", {
    allowedDomains: ["referer.example.com"]
  });
  const refererResponse = await app.inject({
    method: "GET",
    url: `/api/public/projects/${refererProject.slug}/config?key=${refererProject.publicKey}`,
    headers: {
      referer: "https://referer.example.com/some/page"
    }
  });
  assert.equal(refererResponse.statusCode, 200, refererResponse.body);

  const refererLogsResponse = await app.inject({
    method: "GET",
    url:
      `/api/admin/access-logs?projectId=${refererProject.id}` +
      "&requestDomain=referer.example.com" +
      `&referer=${encodeURIComponent("/some/page")}` +
      "&allowed=true&pageSize=10",
    headers: {
      cookie: adminCookie
    }
  });
  assert.equal(refererLogsResponse.statusCode, 200, refererLogsResponse.body);
  const refererLogs = parseBody<{
    items: Array<Record<string, any>>;
    total: number;
  }>(refererLogsResponse).data;
  assert.equal(refererLogs.total, 1);
  assert.equal(refererLogs.items[0].referer, "https://referer.example.com/some/page");

  const missingKeyProject = await createProject(app, adminCookie, "missing-key");
  const missingKeyResponse = await app.inject({
    method: "GET",
    url: `/api/public/projects/${missingKeyProject.slug}/config`
  });
  assert.equal(missingKeyResponse.statusCode, 400, missingKeyResponse.body);

  const projectLogsResponse = await app.inject({
    method: "GET",
    url: `/api/admin/projects/${domainProject.id}/access-logs?pageSize=10`,
    headers: {
      cookie: adminCookie
    }
  });
  assert.equal(projectLogsResponse.statusCode, 200, projectLogsResponse.body);
  const projectLogs = parseBody<{
    items: Array<Record<string, any>>;
    total: number;
  }>(projectLogsResponse).data;
  assert.equal(projectLogs.total, 2);
  assert.deepEqual(
    projectLogs.items.map((item) => item.allowed).sort(),
    [false, true]
  );

  const deniedProjectLogsResponse = await app.inject({
    method: "GET",
    url: `/api/admin/projects/${domainProject.id}/access-logs?allowed=false&requestDomain=sub.app.example.com&pageSize=10`,
    headers: {
      cookie: adminCookie
    }
  });
  assert.equal(deniedProjectLogsResponse.statusCode, 200, deniedProjectLogsResponse.body);
  const deniedProjectLogs = parseBody<{
    items: Array<Record<string, any>>;
    total: number;
  }>(deniedProjectLogsResponse).data;
  assert.equal(deniedProjectLogs.total, 1);
  assert.equal(deniedProjectLogs.items[0].requestDomain, "sub.app.example.com");
  assert.equal(deniedProjectLogs.items[0].allowed, false);

  const domainSuccessLog = projectLogs.items.find((item) => item.allowed === true);
  assert.ok(domainSuccessLog);
  assert.equal(domainSuccessLog.ip, "127.0.0.1");

  const createdAtFrom = new Date(Date.now() - 60 * 1000).toISOString();
  const createdAtTo = new Date(Date.now() + 60 * 1000).toISOString();
  const detailedFilterUrl =
    `/api/admin/access-logs?projectId=${domainProject.id}` +
    `&publicKey=${encodeURIComponent(updatedProject.publicKey)}` +
    "&requestDomain=APP.EXAMPLE.COM." +
    `&ip=${encodeURIComponent(domainSuccessLog.ip)}` +
    `&origin=${encodeURIComponent("https://app.example.com")}` +
    `&userAgent=${encodeURIComponent("contract-test")}` +
    `&message=${encodeURIComponent("宽限期")}` +
    "&effectiveStatus=grace" +
    "&allowed=true" +
    `&createdAtFrom=${encodeURIComponent(createdAtFrom)}` +
    `&createdAtTo=${encodeURIComponent(createdAtTo)}` +
    "&pageSize=10";
  const detailedFilterResponse = await app.inject({
    method: "GET",
    url: detailedFilterUrl,
    headers: {
      cookie: adminCookie
    }
  });
  assert.equal(detailedFilterResponse.statusCode, 200, detailedFilterResponse.body);
  const detailedFilterLogs = parseBody<{
    items: Array<Record<string, any>>;
    total: number;
  }>(detailedFilterResponse).data;
  assert.equal(detailedFilterLogs.total, 1);
  assert.equal(detailedFilterLogs.items[0].slug, "domain-renamed");
  assert.equal(detailedFilterLogs.items[0].effectiveStatus, "grace");

  const invalidDateRangeResponse = await app.inject({
    method: "GET",
    url:
      "/api/admin/access-logs" +
      `?createdAtFrom=${encodeURIComponent(createdAtTo)}` +
      `&createdAtTo=${encodeURIComponent(createdAtFrom)}`,
    headers: {
      cookie: adminCookie
    }
  });
  assert.equal(invalidDateRangeResponse.statusCode, 400, invalidDateRangeResponse.body);

  const deniedLogsResponse = await app.inject({
    method: "GET",
    url: "/api/admin/access-logs?slug=domain-renamed&allowed=false&pageSize=10",
    headers: {
      cookie: adminCookie
    }
  });
  assert.equal(deniedLogsResponse.statusCode, 200, deniedLogsResponse.body);
  const deniedLogs = parseBody<{
    items: Array<Record<string, any>>;
    total: number;
  }>(deniedLogsResponse).data;
  assert.equal(deniedLogs.total, 1);
  assert.equal(deniedLogs.items[0].requestDomain, "sub.app.example.com");
  assert.equal(deniedLogs.items[0].message, "当前域名不允许访问该项目配置");

  const expiredLogsResponse = await app.inject({
    method: "GET",
    url: "/api/admin/access-logs?effectiveStatus=expired&allowed=true&pageSize=10",
    headers: {
      cookie: adminCookie
    }
  });
  assert.equal(expiredLogsResponse.statusCode, 200, expiredLogsResponse.body);
  const expiredLogs = parseBody<{
    items: Array<Record<string, any>>;
  }>(expiredLogsResponse).data;
  assert.ok(
    expiredLogs.items.some(
      (item) =>
        item.slug === expiredProject.slug && item.effectiveStatus === "expired"
    )
  );

  const loginFailedLogsResponse = await app.inject({
    method: "GET",
    url: "/api/admin/action-logs?action=login_failed&targetType=auth&pageSize=10",
    headers: {
      cookie: adminCookie
    }
  });
  assert.equal(loginFailedLogsResponse.statusCode, 200, loginFailedLogsResponse.body);
  const loginFailedLogs = parseBody<{
    items: Array<Record<string, any>>;
    total: number;
  }>(loginFailedLogsResponse).data;
  assert.equal(loginFailedLogs.total, 1);

  const regenerateLogsResponse = await app.inject({
    method: "GET",
    url: `/api/admin/action-logs?action=regenerate_project_key&targetType=project&targetId=${keyProject.id}`,
    headers: {
      cookie: adminCookie
    }
  });
  assert.equal(regenerateLogsResponse.statusCode, 200, regenerateLogsResponse.body);
  const regenerateLogs = parseBody<{
    items: Array<{
      before: ProjectResponse;
      after: ProjectResponse;
    }>;
    total: number;
  }>(regenerateLogsResponse).data;
  assert.equal(regenerateLogs.total, 1);
  assert.equal(regenerateLogs.items[0].before.publicKey, keyProject.publicKey);
  assert.equal(regenerateLogs.items[0].after.publicKey, regenerated.publicKey);
});

test("access log statistics are grouped by requested timezone and filters", async (t) => {
  const app = await createFreshApp(t);
  const adminCookie = await login(app);
  const project = await createProject(app, adminCookie, "stats-project");
  const otherProject = await createProject(app, adminCookie, "stats-other-project");
  const timezoneProject = await createProject(app, adminCookie, "stats-timezone");

  const nowIso = new Date().toISOString();
  const oldIso = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const splitBase = new Date(Date.now() - 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const splitIso = `${splitBase}T16:30:00.000Z`;
  const shanghaiSplitDate = getLocalDateForTimeZone(splitIso, "Asia/Shanghai");
  const newYorkSplitDate = getLocalDateForTimeZone(splitIso, "America/New_York");
  assert.notEqual(shanghaiSplitDate, newYorkSplitDate);

  insertAccessLog({
    projectId: project.id,
    slug: project.slug,
    publicKey: project.publicKey,
    requestDomain: "chart.example.com",
    origin: "https://chart.example.com/app",
    referer: "https://chart.example.com/app/home",
    ip: "203.0.113.10",
    userAgent: "StatsBrowser/1.0",
    effectiveStatus: "active",
    allowed: true,
    message: "stats active ok",
    createdAt: nowIso
  });
  insertAccessLog({
    projectId: project.id,
    slug: project.slug,
    publicKey: project.publicKey,
    requestDomain: "chart.example.com",
    origin: "https://chart.example.com/app",
    referer: "https://chart.example.com/app/grace",
    ip: "203.0.113.10",
    userAgent: "StatsBrowser/1.0",
    effectiveStatus: "grace",
    allowed: true,
    message: "stats grace ok",
    createdAt: nowIso
  });
  insertAccessLog({
    projectId: project.id,
    slug: project.slug,
    publicKey: "wrong-key",
    requestDomain: "denied.example.com",
    origin: "https://denied.example.com",
    referer: "https://denied.example.com/login",
    ip: "203.0.113.11",
    userAgent: "DeniedBrowser/1.0",
    effectiveStatus: null,
    allowed: false,
    message: "项目不存在或授权校验失败",
    createdAt: nowIso
  });
  insertAccessLog({
    projectId: project.id,
    slug: project.slug,
    publicKey: project.publicKey,
    requestDomain: "chart.example.com",
    ip: "203.0.113.12",
    userAgent: "StatsBrowser/2.0",
    effectiveStatus: "suspended",
    allowed: false,
    message: "old suspended",
    createdAt: oldIso
  });
  insertAccessLog({
    projectId: otherProject.id,
    slug: otherProject.slug,
    publicKey: otherProject.publicKey,
    requestDomain: "other.example.com",
    ip: "203.0.113.99",
    effectiveStatus: "expired",
    allowed: true,
    message: "other project",
    createdAt: nowIso
  });
  insertAccessLog({
    projectId: timezoneProject.id,
    slug: timezoneProject.slug,
    publicKey: timezoneProject.publicKey,
    requestDomain: "timezone.example.com",
    ip: "198.51.100.8",
    effectiveStatus: "active",
    allowed: true,
    message: "timezone split",
    createdAt: splitIso
  });

  const todayResponse = await app.inject({
    method: "GET",
    url:
      `/api/admin/access-logs/stats/today?timezone=Asia%2FShanghai` +
      `&projectId=${project.id}`,
    headers: {
      cookie: adminCookie
    }
  });
  assert.equal(todayResponse.statusCode, 200, todayResponse.body);
  const todayStats = parseBody<Record<string, any>>(todayResponse).data;
  assert.equal(todayStats.timezone, "Asia/Shanghai");
  assert.equal(todayStats.date, getLocalDateForTimeZone(nowIso, "Asia/Shanghai"));
  assert.equal(todayStats.total, 3);
  assert.equal(todayStats.allowed, 2);
  assert.equal(todayStats.denied, 1);
  assert.deepEqual(todayStats.statuses, {
    active: 1,
    grace: 1,
    expired: 0,
    suspended: 0,
    unknown: 1
  });

  const filteredStatsResponse = await app.inject({
    method: "GET",
    url:
      "/api/admin/access-logs/stats/today?timezone=Asia%2FShanghai" +
      `&projectId=${project.id}` +
      "&slug=stats-project" +
      "&publicKey=" +
      encodeURIComponent(project.publicKey) +
      "&requestDomain=chart.example.com" +
      "&ip=203.0.113.10" +
      "&origin=chart.example.com" +
      "&referer=home" +
      "&userAgent=StatsBrowser" +
      "&message=active" +
      "&effectiveStatus=active" +
      "&allowed=true",
    headers: {
      cookie: adminCookie
    }
  });
  assert.equal(filteredStatsResponse.statusCode, 200, filteredStatsResponse.body);
  const filteredStats = parseBody<Record<string, any>>(filteredStatsResponse).data;
  assert.equal(filteredStats.total, 1);
  assert.equal(filteredStats.allowed, 1);
  assert.equal(filteredStats.statuses.active, 1);

  const dailyResponse = await app.inject({
    method: "GET",
    url:
      `/api/admin/access-logs/stats/daily?timezone=Asia%2FShanghai&days=3` +
      `&projectId=${project.id}`,
    headers: {
      cookie: adminCookie
    }
  });
  assert.equal(dailyResponse.statusCode, 200, dailyResponse.body);
  const dailyStats = parseBody<{
    timezone: string;
    days: number;
    fromDate: string;
    toDate: string;
    items: Array<Record<string, any>>;
  }>(dailyResponse).data;
  assert.equal(dailyStats.timezone, "Asia/Shanghai");
  assert.equal(dailyStats.days, 3);
  assert.equal(dailyStats.items.length, 3);
  assert.equal(dailyStats.fromDate, dailyStats.items[0].date);
  assert.equal(dailyStats.toDate, dailyStats.items[2].date);
  assert.ok(dailyStats.items.some((item) => item.total === 0));
  assert.equal(
    dailyStats.items.reduce((sum, item) => sum + item.total, 0),
    4
  );
  const oldDate = getLocalDateForTimeZone(oldIso, "Asia/Shanghai");
  const oldStats = getDailyStatItem(
    dailyStats.items as Array<{ date: string; total: number }>,
    oldDate
  );
  assert.ok(oldStats);
  assert.equal(oldStats.total, 1);

  const shanghaiDailyResponse = await app.inject({
    method: "GET",
    url:
      "/api/admin/access-logs/stats/daily?timezone=Asia%2FShanghai&days=4" +
      `&slug=${timezoneProject.slug}`,
    headers: {
      cookie: adminCookie
    }
  });
  const newYorkDailyResponse = await app.inject({
    method: "GET",
    url:
      "/api/admin/access-logs/stats/daily?timezone=America%2FNew_York&days=4" +
      `&slug=${timezoneProject.slug}`,
    headers: {
      cookie: adminCookie
    }
  });
  assert.equal(shanghaiDailyResponse.statusCode, 200, shanghaiDailyResponse.body);
  assert.equal(newYorkDailyResponse.statusCode, 200, newYorkDailyResponse.body);
  const shanghaiItems = parseBody<{
    items: Array<{ date: string; total: number }>;
  }>(shanghaiDailyResponse).data.items;
  const newYorkItems = parseBody<{
    items: Array<{ date: string; total: number }>;
  }>(newYorkDailyResponse).data.items;
  assert.equal(getDailyStatItem(shanghaiItems, shanghaiSplitDate)?.total, 1);
  assert.equal(getDailyStatItem(newYorkItems, newYorkSplitDate)?.total, 1);
  assert.equal(getDailyStatItem(shanghaiItems, newYorkSplitDate)?.total ?? 0, 0);
  assert.equal(getDailyStatItem(newYorkItems, shanghaiSplitDate)?.total ?? 0, 0);

  const invalidTimezoneResponse = await app.inject({
    method: "GET",
    url: "/api/admin/access-logs/stats/today?timezone=Not/AZone",
    headers: {
      cookie: adminCookie
    }
  });
  assert.equal(invalidTimezoneResponse.statusCode, 400, invalidTimezoneResponse.body);

  const invalidDaysResponse = await app.inject({
    method: "GET",
    url: "/api/admin/access-logs/stats/daily?timezone=Asia%2FShanghai&days=0",
    headers: {
      cookie: adminCookie
    }
  });
  assert.equal(invalidDaysResponse.statusCode, 400, invalidDaysResponse.body);

  const unsupportedRangeResponse = await app.inject({
    method: "GET",
    url:
      "/api/admin/access-logs/stats/today?timezone=Asia%2FShanghai" +
      "&createdAtFrom=2026-05-25T00%3A00%3A00%2B08%3A00",
    headers: {
      cookie: adminCookie
    }
  });
  assert.equal(unsupportedRangeResponse.statusCode, 400, unsupportedRangeResponse.body);
});

test("public project config cache is optional, invalidated, and fault tolerant", async (t) => {
  const app = await createFreshApp(t);
  const cacheModule = await import("../src/modules/public/project-cache");
  cacheModule.setProjectCacheStoreForTests(undefined);
  t.after(() => {
    cacheModule.setProjectCacheStoreForTests(undefined);
  });

  const adminCookie = await login(app);
  const disabledCacheProject = await createProject(
    app,
    adminCookie,
    "cache-disabled"
  );
  const disabledCacheResponse = await app.inject({
    method: "GET",
    url: `/api/public/projects/${disabledCacheProject.slug}/config?key=${disabledCacheProject.publicKey}`
  });
  assert.equal(disabledCacheResponse.statusCode, 200, disabledCacheResponse.body);

  const cache = new FakeProjectCacheStore();
  cacheModule.setProjectCacheStoreForTests(cache);

  const cacheHitProject = await createProject(app, adminCookie, "cache-hit", {
    variables: {
      title: "cached"
    }
  });
  const firstCachedResponse = await app.inject({
    method: "GET",
    url: `/api/public/projects/${cacheHitProject.slug}/config?key=${cacheHitProject.publicKey}`
  });
  assert.equal(firstCachedResponse.statusCode, 200, firstCachedResponse.body);
  assert.equal(cache.setCalls.filter((call) => call.slug === "cache-hit").length, 1);

  const secondCachedResponse = await app.inject({
    method: "GET",
    url: `/api/public/projects/${cacheHitProject.slug}/config?key=${cacheHitProject.publicKey}`
  });
  assert.equal(secondCachedResponse.statusCode, 200, secondCachedResponse.body);
  assert.deepEqual(
    parseBody<Record<string, any>>(secondCachedResponse).data.variables,
    {
      title: "cached"
    }
  );
  assert.equal(cache.getCalls.filter((slug) => slug === "cache-hit").length, 2);
  assert.equal(cache.setCalls.filter((call) => call.slug === "cache-hit").length, 1);

  const cachedLogsResponse = await app.inject({
    method: "GET",
    url: `/api/admin/projects/${cacheHitProject.id}/access-logs?pageSize=10`,
    headers: {
      cookie: adminCookie
    }
  });
  assert.equal(cachedLogsResponse.statusCode, 200, cachedLogsResponse.body);
  assert.equal(
    parseBody<{ total: number }>(cachedLogsResponse).data.total,
    2
  );

  const updateProjectCache = await createProject(
    app,
    adminCookie,
    "cache-update",
    {
      variables: {
        phase: "old"
      }
    }
  );
  const beforeUpdateCacheResponse = await app.inject({
    method: "GET",
    url: `/api/public/projects/${updateProjectCache.slug}/config?key=${updateProjectCache.publicKey}`
  });
  assert.equal(beforeUpdateCacheResponse.statusCode, 200, beforeUpdateCacheResponse.body);

  const updateResponse = await app.inject({
    method: "PUT",
    url: `/api/admin/projects/${updateProjectCache.id}`,
    headers: {
      cookie: adminCookie
    },
    payload: {
      slug: "cache-update-renamed",
      status: "grace",
      variables: {
        phase: "new"
      }
    }
  });
  assert.equal(updateResponse.statusCode, 200, updateResponse.body);
  const updatedProject = parseBody<ProjectResponse>(updateResponse).data;
  assert.ok(cache.deleteCalls.includes("cache-update"));
  assert.ok(
    cache.setCalls.some((call) => call.slug === "cache-update-renamed")
  );

  const afterUpdateCacheResponse = await app.inject({
    method: "GET",
    url: `/api/public/projects/${updatedProject.slug}/config?key=${updatedProject.publicKey}`
  });
  assert.equal(afterUpdateCacheResponse.statusCode, 200, afterUpdateCacheResponse.body);
  const updatedConfig = parseBody<Record<string, any>>(afterUpdateCacheResponse).data;
  assert.equal(updatedConfig.status, "grace");
  assert.deepEqual(updatedConfig.variables, {
    phase: "new"
  });

  const deleteProjectCache = await createProject(
    app,
    adminCookie,
    "cache-delete"
  );
  const beforeDeleteCacheResponse = await app.inject({
    method: "GET",
    url: `/api/public/projects/${deleteProjectCache.slug}/config?key=${deleteProjectCache.publicKey}`
  });
  assert.equal(beforeDeleteCacheResponse.statusCode, 200, beforeDeleteCacheResponse.body);
  assert.ok(cache.records.has(deleteProjectCache.slug));

  const deleteResponse = await app.inject({
    method: "DELETE",
    url: `/api/admin/projects/${deleteProjectCache.id}`,
    headers: {
      cookie: adminCookie
    }
  });
  assert.equal(deleteResponse.statusCode, 200, deleteResponse.body);
  assert.ok(!cache.records.has(deleteProjectCache.slug));

  const afterDeleteCacheResponse = await app.inject({
    method: "GET",
    url: `/api/public/projects/${deleteProjectCache.slug}/config?key=${deleteProjectCache.publicKey}`
  });
  assert.equal(afterDeleteCacheResponse.statusCode, 404, afterDeleteCacheResponse.body);

  const errorCacheProject = await createProject(app, adminCookie, "cache-error", {
    allowedDomains: ["allowed.example.com"]
  });
  cache.records.delete(errorCacheProject.slug);
  const setCallCountBeforeErrors = cache.setCalls.length;
  const wrongKeyResponse = await app.inject({
    method: "GET",
    url: `/api/public/projects/${errorCacheProject.slug}/config?key=wrong-key`,
    headers: {
      origin: "https://allowed.example.com"
    }
  });
  assert.equal(wrongKeyResponse.statusCode, 404, wrongKeyResponse.body);

  const deniedDomainResponse = await app.inject({
    method: "GET",
    url: `/api/public/projects/${errorCacheProject.slug}/config?key=${errorCacheProject.publicKey}`,
    headers: {
      origin: "https://denied.example.com"
    }
  });
  assert.equal(deniedDomainResponse.statusCode, 403, deniedDomainResponse.body);
  assert.equal(cache.setCalls.length, setCallCountBeforeErrors);
  assert.ok(!cache.records.has(errorCacheProject.slug));

  const missingProjectResponse = await app.inject({
    method: "GET",
    url: "/api/public/projects/cache-missing/config?key=anything"
  });
  assert.equal(missingProjectResponse.statusCode, 404, missingProjectResponse.body);
  assert.ok(!cache.records.has("cache-missing"));

  const ttlProject = await createProject(app, adminCookie, "cache-ttl", {
    expiresAt: new Date(Date.now() + 30 * 1000).toISOString()
  });
  const ttlResponse = await app.inject({
    method: "GET",
    url: `/api/public/projects/${ttlProject.slug}/config?key=${ttlProject.publicKey}`
  });
  assert.equal(ttlResponse.statusCode, 200, ttlResponse.body);
  const ttlSetCall = cache.setCalls.find((call) => call.slug === ttlProject.slug);
  assert.ok(ttlSetCall);
  assert.ok(ttlSetCall.ttlSeconds > 0);
  assert.ok(ttlSetCall.ttlSeconds <= 30);
  assert.ok(ttlSetCall.ttlSeconds < 120);

  const fallbackProject = await createProject(
    app,
    adminCookie,
    "cache-fallback"
  );
  cache.failGet = true;
  cache.failSet = true;
  const fallbackResponse = await app.inject({
    method: "GET",
    url: `/api/public/projects/${fallbackProject.slug}/config?key=${fallbackProject.publicKey}`
  });
  assert.equal(fallbackResponse.statusCode, 200, fallbackResponse.body);
  cache.failGet = false;
  cache.failSet = false;

  const failedDeleteProject = await createProject(
    app,
    adminCookie,
    "cache-delete-failure"
  );
  const beforeFailedDeleteResponse = await app.inject({
    method: "GET",
    url: `/api/public/projects/${failedDeleteProject.slug}/config?key=${failedDeleteProject.publicKey}`
  });
  assert.equal(
    beforeFailedDeleteResponse.statusCode,
    200,
    beforeFailedDeleteResponse.body
  );
  assert.ok(cache.records.has(failedDeleteProject.slug));

  cache.failDelete = true;
  const fallbackDeleteResponse = await app.inject({
    method: "DELETE",
    url: `/api/admin/projects/${failedDeleteProject.id}`,
    headers: {
      cookie: adminCookie
    }
  });
  assert.equal(fallbackDeleteResponse.statusCode, 200, fallbackDeleteResponse.body);
  cache.failDelete = false;

  const afterFailedDeleteResponse = await app.inject({
    method: "GET",
    url: `/api/public/projects/${failedDeleteProject.slug}/config?key=${failedDeleteProject.publicKey}`
  });
  assert.equal(
    afterFailedDeleteResponse.statusCode,
    404,
    afterFailedDeleteResponse.body
  );
});
