import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  ADMIN_USERNAME: z.string().min(1).default("admin"),
  ADMIN_PASSWORD: z.string().min(1, "ADMIN_PASSWORD is required"),
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters"),
  DATABASE_URL: z.string().min(1).default("file:./data/app.db"),
  SERVER_PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PUBLIC_BASE_URL: z.string().url().default("http://localhost:3001"),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:5173"),
  ADMIN_SESSION_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60 * 8),
  PUBLIC_CONFIG_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  PUBLIC_CONFIG_RATE_LIMIT_WINDOW_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60),
  ACCESS_LOG_RETENTION_DAYS: z.coerce.number().int().nonnegative().default(90),
  REDIS_URL: z
    .string()
    .trim()
    .default("")
    .refine(
      (value) => value === "" || URL.canParse(value),
      "REDIS_URL must be empty or a valid URL"
    ),
  PUBLIC_CONFIG_CACHE_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(120),
  REDIS_COMMAND_TIMEOUT_MS: z.coerce.number().int().positive().default(500)
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const message = parsedEnv.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid environment variables: ${message}`);
}

export const env = parsedEnv.data;
