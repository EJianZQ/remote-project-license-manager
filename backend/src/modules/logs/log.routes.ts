import type { FastifyInstance } from "fastify";
import {
  errorResponse,
  formatZodError,
  handleRouteError,
  paginatedResponse
} from "../../utils/response";
import { requireAdmin } from "../auth/auth.middleware";
import {
  paginationQuerySchema,
  projectIdParamsSchema,
  projectStatusSchema
} from "../projects/project.validators";
import { listAccessLogs, listActionLogs } from "./log.service";
import { z } from "zod";

const accessLogQuerySchema = paginationQuerySchema.extend({
  slug: z.string().trim().min(1).optional(),
  effectiveStatus: projectStatusSchema.optional(),
  allowed: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional()
});

const actionLogQuerySchema = paginationQuerySchema.extend({
  action: z.string().trim().min(1).optional(),
  targetType: z.string().trim().min(1).optional(),
  targetId: z.coerce.number().int().positive().optional()
});

export async function logRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAdmin);

  app.get("/projects/:id/access-logs", async (request, reply) => {
    const parsedParams = projectIdParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return errorResponse(reply, 400, formatZodError(parsedParams.error));
    }

    const parsedQuery = paginationQuerySchema.safeParse(request.query);
    if (!parsedQuery.success) {
      return errorResponse(reply, 400, formatZodError(parsedQuery.error));
    }

    try {
      return paginatedResponse(
        reply,
        listAccessLogs({
          projectId: parsedParams.data.id,
          page: parsedQuery.data.page,
          pageSize: parsedQuery.data.pageSize
        })
      );
    } catch (error) {
      return handleRouteError(reply, error);
    }
  });

  app.get("/access-logs", async (request, reply) => {
    const parsedQuery = accessLogQuerySchema.safeParse(request.query);
    if (!parsedQuery.success) {
      return errorResponse(reply, 400, formatZodError(parsedQuery.error));
    }

    try {
      return paginatedResponse(reply, listAccessLogs(parsedQuery.data));
    } catch (error) {
      return handleRouteError(reply, error);
    }
  });

  app.get("/action-logs", async (request, reply) => {
    const parsedQuery = actionLogQuerySchema.safeParse(request.query);
    if (!parsedQuery.success) {
      return errorResponse(reply, 400, formatZodError(parsedQuery.error));
    }

    try {
      return paginatedResponse(reply, listActionLogs(parsedQuery.data));
    } catch (error) {
      return handleRouteError(reply, error);
    }
  });
}
