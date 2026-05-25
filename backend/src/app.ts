import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { env } from "./env";
import { authRoutes } from "./modules/auth/auth.routes";
import { logRoutes } from "./modules/logs/log.routes";
import { projectRoutes } from "./modules/projects/project.routes";
import { closeProjectCache } from "./modules/public/project-cache";
import { publicRoutes } from "./modules/public/public.routes";
import { errorResponse, formatZodError } from "./utils/response";
import { ZodError } from "zod";

function parseCorsOrigin() {
  if (env.CORS_ORIGIN === "*") {
    return true;
  }

  return env.CORS_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export async function createApp() {
  const app = Fastify({
    logger: true,
    trustProxy: true
  });

  app.removeContentTypeParser("application/json");
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_request, body, done) => {
      const text = (typeof body === "string" ? body : body.toString("utf8")).trim();

      if (!text) {
        done(null, {});
        return;
      }

      try {
        done(null, JSON.parse(text) as unknown);
      } catch (error) {
        done(error as Error, undefined);
      }
    }
  );

  app.setErrorHandler((error: unknown, _request, reply) => {
    const statusCode =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : undefined;

    if (statusCode === 429) {
      return errorResponse(reply, 429, "请求过于频繁，请稍后再试");
    }

    if (statusCode && statusCode >= 400 && statusCode < 500) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof error.message === "string"
          ? error.message
          : "请求参数错误";

      return errorResponse(reply, statusCode, message);
    }

    if (error instanceof ZodError) {
      return errorResponse(reply, 400, formatZodError(error));
    }

    app.log.error(error);
    return errorResponse(reply, 500, "服务器内部错误");
  });

  app.setNotFoundHandler((_request, reply) => {
    return errorResponse(reply, 404, "接口不存在");
  });

  await app.register(helmet);
  await app.register(cors, {
    origin: parseCorsOrigin(),
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  });
  await app.register(cookie, {
    secret: env.SESSION_SECRET
  });
  await app.register(rateLimit, {
    global: false
  });

  app.addHook("onClose", async () => {
    await closeProjectCache();
  });

  app.get("/health", async (_request, reply) => {
    return reply.send({
      success: true,
      data: {
        status: "ok"
      }
    });
  });

  await app.register(authRoutes, { prefix: "/api/admin/auth" });
  await app.register(projectRoutes, { prefix: "/api/admin/projects" });
  await app.register(logRoutes, { prefix: "/api/admin" });
  await app.register(publicRoutes, { prefix: "/api/public" });

  return app;
}
