import type { FastifyReply } from "fastify";
import { ZodError } from "zod";

export class HttpError extends Error {
  public readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export type PaginationResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export function successResponse<T>(reply: FastifyReply, data: T) {
  return reply.send({
    success: true,
    data
  });
}

export function paginatedResponse<T>(
  reply: FastifyReply,
  result: PaginationResult<T>
) {
  return successResponse(reply, result);
}

export function errorResponse(
  reply: FastifyReply,
  statusCode: number,
  message: string
) {
  return reply.code(statusCode).send({
    success: false,
    message
  });
}

export function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "request";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

export function handleRouteError(reply: FastifyReply, error: unknown) {
  if (error instanceof HttpError) {
    return errorResponse(reply, error.statusCode, error.message);
  }

  if (error instanceof ZodError) {
    return errorResponse(reply, 400, formatZodError(error));
  }

  console.error(error);
  return errorResponse(reply, 500, "服务器内部错误");
}
