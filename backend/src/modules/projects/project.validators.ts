import { z } from "zod";
import {
  popupLevelValues,
  projectStatusValues
} from "../../db/schema";
import { normalizeDomain } from "../../utils/domain";
import { isPlainJsonObject, type JsonObject } from "../../utils/json";

export const projectStatusSchema = z.enum(projectStatusValues);
export const popupLevelSchema = z.enum(popupLevelValues);

export const projectIdParamsSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20)
});

const slugSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9_-]+$/, "slug 只允许小写字母、数字、短横线和下划线");

const isoDateTimeOrNullSchema = z.preprocess(
  (value) => (value === undefined || value === "" ? null : value),
  z.string().datetime({ offset: true }).nullable()
).transform((value) => (value ? new Date(value).toISOString() : null));

const jsonObjectSchema = z.custom<JsonObject>(
  (value) => isPlainJsonObject(value),
  "variables 必须是普通 JSON 对象"
);

const allowedDomainSchema = z
  .string()
  .trim()
  .min(1)
  .transform((value) => normalizeDomain(value))
  .refine((value): value is string => value !== null, {
    message: "allowedDomains 只能填写域名，不要带协议、端口或路径"
  });

export const projectListQuerySchema = paginationQuerySchema.extend({
  keyword: z.string().trim().optional(),
  status: projectStatusSchema.optional(),
  enabled: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional()
});

export const createProjectBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    slug: slugSchema,
    enabled: z.boolean().default(true),
    status: projectStatusSchema.default("active"),
    expiresAt: isoDateTimeOrNullSchema,
    popupEnabled: z.boolean().default(false),
    popupTitle: z.string().trim().max(120).nullable().optional(),
    popupContent: z.string().trim().max(2000).nullable().optional(),
    popupLevel: popupLevelSchema.default("warning"),
    variables: jsonObjectSchema.default({}),
    allowedDomains: z.array(allowedDomainSchema).default([]),
    remarks: z.string().trim().max(2000).nullable().optional()
  })
  .strict();

export const updateProjectBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    slug: slugSchema.optional(),
    enabled: z.boolean().optional(),
    status: projectStatusSchema.optional(),
    expiresAt: isoDateTimeOrNullSchema.optional(),
    popupEnabled: z.boolean().optional(),
    popupTitle: z.string().trim().max(120).nullable().optional(),
    popupContent: z.string().trim().max(2000).nullable().optional(),
    popupLevel: popupLevelSchema.optional(),
    variables: jsonObjectSchema.optional(),
    allowedDomains: z.array(allowedDomainSchema).optional(),
    remarks: z.string().trim().max(2000).nullable().optional()
  })
  .strict();

export type ProjectListQuery = z.infer<typeof projectListQuerySchema>;
export type CreateProjectInput = z.infer<typeof createProjectBodySchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectBodySchema>;
