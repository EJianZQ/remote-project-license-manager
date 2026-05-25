import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { env } from "../../env";
import {
  errorResponse,
  formatZodError,
  handleRouteError,
  successResponse
} from "../../utils/response";
import { recordAdminAction } from "../logs/log.service";
import { requireAdmin } from "./auth.middleware";
import {
  clearAdminSession,
  revokeAdminSessionFromRequest,
  setAdminSession,
  validateAdminCredentials
} from "./auth.service";

const loginBodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

function getLogMeta(request: FastifyRequest) {
  return {
    ip: request.ip,
    userAgent: request.headers["user-agent"] ?? null
  };
}

export async function authRoutes(app: FastifyInstance) {
  app.post(
    "/login",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 minute"
        }
      }
    },
    async (request, reply) => {
      const parsed = loginBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return errorResponse(reply, 400, formatZodError(parsed.error));
      }

      try {
        const ok = await validateAdminCredentials(
          parsed.data.username,
          parsed.data.password
        );

        if (!ok) {
          recordAdminAction({
            action: "login_failed",
            targetType: "auth",
            ...getLogMeta(request)
          });
          return errorResponse(reply, 401, "用户名或密码错误");
        }

        setAdminSession(reply);
        recordAdminAction({
          action: "login_success",
          targetType: "auth",
          ...getLogMeta(request)
        });

        return successResponse(reply, {
          username: env.ADMIN_USERNAME
        });
      } catch (error) {
        return handleRouteError(reply, error);
      }
    }
  );

  app.get("/me", { preHandler: requireAdmin }, async (_request, reply) => {
    return successResponse(reply, {
      username: env.ADMIN_USERNAME
    });
  });

  app.post("/logout", { preHandler: requireAdmin }, async (request, reply) => {
    revokeAdminSessionFromRequest(request);
    clearAdminSession(reply);
    return successResponse(reply, null);
  });
}
