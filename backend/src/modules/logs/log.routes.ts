import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  errorResponse,
  formatZodError,
  handleRouteError,
  paginatedResponse,
  successResponse
} from "../../utils/response";
import { normalizeDomain } from "../../utils/domain";
import { requireAdmin } from "../auth/auth.middleware";
import {
  paginationQuerySchema,
  projectIdParamsSchema,
  projectStatusSchema
} from "../projects/project.validators";
import {
  getTodayAccessLogStats,
  listAccessLogs,
  listActionLogs,
  listDailyAccessLogStats
} from "./log.service";

const isoDateTimeQuerySchema = z
  .string()
  .datetime({ offset: true })
  .transform((value) => new Date(value).toISOString())
  .optional();

const exactQueryTextSchema = z.string().trim().min(1).max(253).optional();
const fuzzyQueryTextSchema = z.string().trim().min(1).max(500).optional();

const requestDomainQuerySchema = z
  .string()
  .trim()
  .min(1)
  .max(253)
  .transform((value) => normalizeDomain(value))
  .refine((value): value is string => value !== null, {
    message: "requestDomain 只能填写域名，不要带协议、端口或路径"
  })
  .optional();

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

const accessLogFilterFields = {
  projectId: z.coerce.number().int().positive().optional(),
  slug: z.string().trim().min(1).optional(),
  publicKey: exactQueryTextSchema,
  requestDomain: requestDomainQuerySchema,
  ip: z.string().trim().min(1).max(128).optional(),
  origin: fuzzyQueryTextSchema,
  referer: fuzzyQueryTextSchema,
  userAgent: fuzzyQueryTextSchema,
  message: fuzzyQueryTextSchema,
  effectiveStatus: projectStatusSchema.optional(),
  allowed: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional()
};

const baseAccessLogQuerySchema = paginationQuerySchema.extend({
  ...accessLogFilterFields,
  createdAtFrom: isoDateTimeQuerySchema,
  createdAtTo: isoDateTimeQuerySchema
});

const accessLogStatsBaseQuerySchema = z
  .object({
    ...accessLogFilterFields,
    timezone: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .refine(isValidTimeZone, {
        message: "timezone 必须是有效的 IANA 时区"
      })
  })
  .strict();

const todayAccessLogStatsQuerySchema = accessLogStatsBaseQuerySchema;

const dailyAccessLogStatsQuerySchema = accessLogStatsBaseQuerySchema
  .extend({
    days: z.coerce.number().int().min(1).max(90).default(7)
  })
  .strict();

function validateAccessLogDateRange(
  value: {
    createdAtFrom?: string;
    createdAtTo?: string;
  },
  context: z.RefinementCtx
) {
  if (
    value.createdAtFrom &&
    value.createdAtTo &&
    value.createdAtFrom > value.createdAtTo
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["createdAtTo"],
      message: "createdAtTo 必须晚于或等于 createdAtFrom"
    });
  }
}

const accessLogQuerySchema = baseAccessLogQuerySchema.superRefine(
  validateAccessLogDateRange
);

const projectAccessLogQuerySchema = baseAccessLogQuerySchema
  .omit({
    projectId: true
  })
  .superRefine(validateAccessLogDateRange);

const actionLogQuerySchema = paginationQuerySchema.extend({
  action: z.string().trim().min(1).optional(),
  targetType: z.string().trim().min(1).optional(),
  targetId: z.coerce.number().int().positive().optional()
});

export async function logRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAdmin);

  app.get("/access-logs/stats/today", async (request, reply) => {
    const parsedQuery = todayAccessLogStatsQuerySchema.safeParse(request.query);
    if (!parsedQuery.success) {
      return errorResponse(reply, 400, formatZodError(parsedQuery.error));
    }

    try {
      return successResponse(reply, getTodayAccessLogStats(parsedQuery.data));
    } catch (error) {
      return handleRouteError(reply, error);
    }
  });

  app.get("/access-logs/stats/daily", async (request, reply) => {
    const parsedQuery = dailyAccessLogStatsQuerySchema.safeParse(request.query);
    if (!parsedQuery.success) {
      return errorResponse(reply, 400, formatZodError(parsedQuery.error));
    }

    try {
      return successResponse(reply, listDailyAccessLogStats(parsedQuery.data));
    } catch (error) {
      return handleRouteError(reply, error);
    }
  });

  app.get("/projects/:id/access-logs", async (request, reply) => {
    const parsedParams = projectIdParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return errorResponse(reply, 400, formatZodError(parsedParams.error));
    }

    const parsedQuery = projectAccessLogQuerySchema.safeParse(request.query);
    if (!parsedQuery.success) {
      return errorResponse(reply, 400, formatZodError(parsedQuery.error));
    }

    try {
      return paginatedResponse(
        reply,
        listAccessLogs({
          projectId: parsedParams.data.id,
          ...parsedQuery.data
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
