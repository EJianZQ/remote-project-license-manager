import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { env } from "../../env";
import {
  errorResponse,
  formatZodError,
  handleRouteError,
  successResponse
} from "../../utils/response";
import { extractRequestDomain } from "../../utils/domain";
import { recordProjectAccessLog } from "../logs/log.service";
import { getPublicProjectConfig } from "./public.service";

const publicConfigParamsSchema = z.object({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9_-]+$/, "slug 格式不正确")
});

const RATE_LIMIT_SLUG_PATTERN = /^[a-z0-9_-]+$/;

const publicConfigQuerySchema = z.object({
  key: z.string().min(1)
});

function headerToString(value: FastifyRequest["headers"][string]): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function getRawString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function getPublicConfigRateLimitKey(request: FastifyRequest): string {
  const params = request.params as Record<string, unknown>;
  const rawSlug = getRawString(params.slug);
  const slug =
    rawSlug && RATE_LIMIT_SLUG_PATTERN.test(rawSlug) ? rawSlug : "invalid";

  return `${request.ip}:${slug}`;
}

function recordInvalidPublicRequest(
  request: FastifyRequest,
  message: string
): void {
  const params = request.params as Record<string, unknown>;
  const query = request.query as Record<string, unknown>;
  const origin = headerToString(request.headers.origin);
  const referer = headerToString(request.headers.referer);

  recordProjectAccessLog({
    projectId: null,
    slug: getRawString(params.slug) ?? "invalid",
    publicKey: getRawString(query.key),
    requestDomain: extractRequestDomain(origin ?? undefined, referer ?? undefined),
    origin,
    referer,
    ip: request.ip,
    userAgent: headerToString(request.headers["user-agent"]),
    effectiveStatus: null,
    allowed: false,
    message
  });
}

export async function publicRoutes(app: FastifyInstance) {
  app.get(
    "/projects/:slug/config",
    {
      config: {
        cors: {
          origin: true,
          credentials: false,
          methods: ["GET"]
        },
        rateLimit: {
          max: env.PUBLIC_CONFIG_RATE_LIMIT_MAX,
          timeWindow: env.PUBLIC_CONFIG_RATE_LIMIT_WINDOW_SECONDS * 1000,
          keyGenerator: getPublicConfigRateLimitKey
        }
      }
    },
    async (request, reply) => {
      const parsedParams = publicConfigParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        const message = formatZodError(parsedParams.error);
        recordInvalidPublicRequest(request, message);
        return errorResponse(reply, 400, message);
      }

      const parsedQuery = publicConfigQuerySchema.safeParse(request.query);
      if (!parsedQuery.success) {
        const message = formatZodError(parsedQuery.error);
        recordInvalidPublicRequest(request, message);
        return errorResponse(reply, 400, message);
      }

      try {
        const config = await getPublicProjectConfig({
          slug: parsedParams.data.slug,
          key: parsedQuery.data.key,
          origin: headerToString(request.headers.origin),
          referer: headerToString(request.headers.referer),
          ip: request.ip,
          userAgent: headerToString(request.headers["user-agent"])
        });

        return successResponse(reply, config);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    }
  );
}
