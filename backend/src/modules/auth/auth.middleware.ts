import type { FastifyReply, FastifyRequest } from "fastify";
import { errorResponse } from "../../utils/response";
import { getAdminUsernameFromRequest } from "./auth.service";

declare module "fastify" {
  interface FastifyRequest {
    admin?: {
      username: string;
    };
  }
}

export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const username = getAdminUsernameFromRequest(request);

  if (!username) {
    return errorResponse(reply, 401, "请先登录");
  }

  request.admin = { username };
}
