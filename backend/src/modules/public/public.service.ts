import { ProjectRecord, ProjectStatus } from "../../db/schema";
import { extractRequestDomain, isDomainAllowed } from "../../utils/domain";
import { parseJsonObject, parseStringArray } from "../../utils/json";
import { HttpError } from "../../utils/response";
import { nowIso } from "../../utils/time";
import { recordProjectAccessLog, type RequestLogMeta } from "../logs/log.service";
import {
  computeEffectiveStatus,
  findProjectRecordBySlug
} from "../projects/project.service";
import {
  cacheProjectRecord,
  getCachedProjectRecord
} from "./project-cache";

type PublicConfig = {
  project: string;
  serverTime: string;
  status: ProjectStatus;
  enabled: boolean;
  expiresAt: string | null;
  popup: {
    enabled: boolean;
    level: "info" | "warning" | "danger";
    title: string;
    content: string;
  };
  variables: Record<string, unknown>;
  message: string;
};

type GetPublicConfigInput = RequestLogMeta & {
  slug: string;
  key: string;
};

function createStatusMessage(status: ProjectStatus): string {
  if (status === "grace") {
    return "当前项目已进入宽限期";
  }
  if (status === "expired") {
    return "项目服务已到期";
  }
  if (status === "suspended") {
    return "项目服务已暂停";
  }
  return "";
}

function createPopup(project: ProjectRecord, status: ProjectStatus) {
  if (status === "expired") {
    return {
      enabled: true,
      level: "danger" as const,
      title: "项目服务已到期",
      content: "当前项目服务已到期，请联系开发方处理。"
    };
  }

  if (status === "suspended") {
    return {
      enabled: true,
      level: "danger" as const,
      title: "项目服务已暂停",
      content: "当前项目服务已暂停，请联系开发方恢复。"
    };
  }

  return {
    enabled: project.popupEnabled,
    level: project.popupLevel,
    title: project.popupTitle ?? "",
    content: project.popupContent ?? ""
  };
}

function logAccess(
  input: GetPublicConfigInput,
  project: ProjectRecord | null,
  requestDomain: string | null,
  allowed: boolean,
  message: string,
  effectiveStatus?: ProjectStatus | null
) {
  recordProjectAccessLog({
    projectId: project?.id ?? null,
    slug: input.slug,
    publicKey: input.key || null,
    requestDomain,
    origin: input.origin ?? null,
    referer: input.referer ?? null,
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
    effectiveStatus: effectiveStatus ?? null,
    allowed,
    message
  });
}

export async function getPublicProjectConfig(
  input: GetPublicConfigInput
): Promise<PublicConfig> {
  const cachedProject = await getCachedProjectRecord(input.slug);
  const project = cachedProject ?? findProjectRecordBySlug(input.slug);
  const requestDomain = extractRequestDomain(
    input.origin ?? undefined,
    input.referer ?? undefined
  );

  if (!project || project.publicKey !== input.key) {
    logAccess(input, project, requestDomain, false, "项目不存在或授权校验失败");
    throw new HttpError(404, "项目不存在或授权校验失败");
  }

  const allowedDomains = parseStringArray(project.allowedDomainsJson);
  if (!isDomainAllowed(requestDomain, allowedDomains)) {
    logAccess(input, project, requestDomain, false, "当前域名不允许访问该项目配置");
    throw new HttpError(403, "当前域名不允许访问该项目配置");
  }

  const effectiveStatus = computeEffectiveStatus(project);
  const variables =
    effectiveStatus === "active" || effectiveStatus === "grace"
      ? parseJsonObject(project.variablesJson)
      : {};
  const message = createStatusMessage(effectiveStatus);

  if (!cachedProject) {
    await cacheProjectRecord(project);
  }

  logAccess(input, project, requestDomain, true, message, effectiveStatus);

  return {
    project: project.slug,
    serverTime: nowIso(),
    status: effectiveStatus,
    enabled: effectiveStatus === "active" || effectiveStatus === "grace",
    expiresAt: project.expiresAt,
    popup: createPopup(project, effectiveStatus),
    variables,
    message
  };
}
