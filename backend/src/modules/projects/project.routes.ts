import type { FastifyInstance, FastifyRequest } from "fastify";
import { sqlite } from "../../db";
import {
  errorResponse,
  formatZodError,
  handleRouteError,
  paginatedResponse,
  successResponse
} from "../../utils/response";
import { requireAdmin } from "../auth/auth.middleware";
import { recordAdminAction } from "../logs/log.service";
import {
  cacheProjectRecord,
  invalidateProjectCacheBySlug
} from "../public/project-cache";
import {
  createProject,
  getProjectDetail,
  listProjects,
  regenerateProjectKey,
  softDeleteProject,
  updateProject
} from "./project.service";
import {
  createProjectBodySchema,
  projectIdParamsSchema,
  projectListQuerySchema,
  updateProjectBodySchema
} from "./project.validators";

function getLogMeta(request: FastifyRequest) {
  return {
    ip: request.ip,
    userAgent: request.headers["user-agent"] ?? null
  };
}

function runInTransaction<T>(work: () => T): T {
  return sqlite.transaction(work)();
}

export async function projectRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAdmin);

  app.get("/", async (request, reply) => {
    const parsed = projectListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return errorResponse(reply, 400, formatZodError(parsed.error));
    }

    try {
      return paginatedResponse(reply, listProjects(parsed.data));
    } catch (error) {
      return handleRouteError(reply, error);
    }
  });

  app.get("/:id", async (request, reply) => {
    const parsedParams = projectIdParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return errorResponse(reply, 400, formatZodError(parsedParams.error));
    }

    try {
      return successResponse(reply, getProjectDetail(parsedParams.data.id));
    } catch (error) {
      return handleRouteError(reply, error);
    }
  });

  app.post("/", async (request, reply) => {
    const parsedBody = createProjectBodySchema.safeParse(request.body);
    if (!parsedBody.success) {
      return errorResponse(reply, 400, formatZodError(parsedBody.error));
    }

    try {
      const project = runInTransaction(() => {
        const created = createProject(parsedBody.data);
        recordAdminAction({
          action: "create_project",
          targetType: "project",
          targetId: created.id,
          after: created,
          ...getLogMeta(request)
        });
        return created;
      });

      await cacheProjectRecord(project);

      return successResponse(reply, project);
    } catch (error) {
      return handleRouteError(reply, error);
    }
  });

  app.put("/:id", async (request, reply) => {
    const parsedParams = projectIdParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return errorResponse(reply, 400, formatZodError(parsedParams.error));
    }

    const parsedBody = updateProjectBodySchema.safeParse(request.body);
    if (!parsedBody.success) {
      return errorResponse(reply, 400, formatZodError(parsedBody.error));
    }

    try {
      const result = runInTransaction(() => {
        const updated = updateProject(parsedParams.data.id, parsedBody.data);
        recordAdminAction({
          action: "update_project",
          targetType: "project",
          targetId: parsedParams.data.id,
          before: updated.before,
          after: updated.after,
          ...getLogMeta(request)
        });
        return updated;
      });

      if (result.before.slug !== result.after.slug) {
        await invalidateProjectCacheBySlug(result.before.slug);
      }
      await cacheProjectRecord(result.after);

      return successResponse(reply, result.after);
    } catch (error) {
      return handleRouteError(reply, error);
    }
  });

  app.post("/:id/regenerate-key", async (request, reply) => {
    const parsedParams = projectIdParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return errorResponse(reply, 400, formatZodError(parsedParams.error));
    }

    try {
      const result = runInTransaction(() => {
        const regenerated = regenerateProjectKey(parsedParams.data.id);
        recordAdminAction({
          action: "regenerate_project_key",
          targetType: "project",
          targetId: parsedParams.data.id,
          before: regenerated.before,
          after: regenerated.after,
          ...getLogMeta(request)
        });
        return regenerated;
      });

      await cacheProjectRecord(result.after);

      return successResponse(reply, {
        publicKey: result.publicKey,
        project: result.after
      });
    } catch (error) {
      return handleRouteError(reply, error);
    }
  });

  app.delete("/:id", async (request, reply) => {
    const parsedParams = projectIdParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return errorResponse(reply, 400, formatZodError(parsedParams.error));
    }

    try {
      let deletedSlug: string | null = null;

      runInTransaction(() => {
        const result = softDeleteProject(parsedParams.data.id);
        deletedSlug = result.before.slug;
        recordAdminAction({
          action: "delete_project",
          targetType: "project",
          targetId: parsedParams.data.id,
          before: result.before,
          ...getLogMeta(request)
        });
      });

      await invalidateProjectCacheBySlug(deletedSlug);

      return successResponse(reply, null);
    } catch (error) {
      return handleRouteError(reply, error);
    }
  });
}
