# Backend

[English](./README.md) | [中文](./README_CN.md)

The backend is the Fastify service behind Remote Project License Manager. It stores project license records in SQLite, exposes authenticated admin APIs, serves the public project configuration endpoint, records access and admin-operation logs, and optionally caches public project records in Redis.

It is designed for transparent license status and delivery-state management. It returns status, popup settings, remote variables, and messages; it does not execute remote code or provide destructive controls.

## Tech Stack

- Node.js
- TypeScript
- Fastify
- SQLite
- Drizzle ORM
- better-sqlite3
- Zod
- @fastify/cookie
- @fastify/helmet
- @fastify/rate-limit
- @fastify/cors
- Redis
- dotenv

## Directory Structure

```text
backend/
  src/
    index.ts                       # Server bootstrap
    app.ts                         # Fastify app, plugins, routes, health check
    env.ts                         # Environment loading and validation
    db/
      index.ts                     # SQLite and Drizzle connection
      schema.ts                    # Table definitions and types
      migrate.ts                   # Database table/index initialization
    modules/
      auth/                        # Admin login, logout, session validation
      projects/                    # Project CRUD, key regeneration, status calculation
      public/                      # Public project configuration API and cache integration
      logs/                        # Public access logs and admin action logs
    utils/                         # Response, JSON, time, domain, and random helpers
  tests/
    backend.regression.test.ts     # Regression tests for core backend behavior
```

## Installation

```bash
npm install
```

## Environment Variables

Create a local environment file:

```bash
cp .env.example .env
```

Available settings:

| Variable | Description |
| --- | --- |
| `ADMIN_USERNAME` | Admin login username. Defaults to `admin`. |
| `ADMIN_PASSWORD` | Admin login password. Change this before deployment. |
| `SESSION_SECRET` | Secret used to sign httpOnly cookies. Must be at least 32 characters. |
| `DATABASE_URL` | SQLite database location, for example `file:./data/app.db`. |
| `SERVER_PORT` | Backend port. Defaults to `3001`. |
| `NODE_ENV` | `development`, `test`, or `production`. |
| `PUBLIC_BASE_URL` | Public backend base URL used in examples and future integrations. |
| `CORS_ORIGIN` | Allowed admin-console origins. Use commas for multiple origins. |
| `ADMIN_SESSION_TTL_SECONDS` | Admin session lifetime. Defaults to 8 hours. |
| `PUBLIC_CONFIG_RATE_LIMIT_MAX` | Max public-config requests per window. |
| `PUBLIC_CONFIG_RATE_LIMIT_WINDOW_SECONDS` | Public-config rate-limit window in seconds. |
| `ACCESS_LOG_RETENTION_DAYS` | Retention period for public access logs. |
| `REDIS_URL` | Optional Redis URL. Leave empty to disable Redis caching. |
| `PUBLIC_CONFIG_CACHE_TTL_SECONDS` | Redis cache TTL for public project records. |
| `REDIS_COMMAND_TIMEOUT_MS` | Redis command timeout in milliseconds. |

Production-style placeholders:

```bash
PUBLIC_BASE_URL=https://api.example.com
CORS_ORIGIN=https://admin.example.com
REDIS_URL=redis://127.0.0.1:6379
```

## Database

Initialize the SQLite schema:

```bash
npm run db:migrate
```

The migration script creates:

- `projects`
- `project_access_logs`
- `admin_sessions`
- `admin_action_logs`

The project table stores business-facing license configuration. The log tables make public access and administrative changes auditable.

## Development

```bash
npm run dev
```

The development server watches `src/index.ts` through `tsx`.

## Build and Run

```bash
npm run build
npm run start
```

The compiled output is written to `dist/`.

## Tests

```bash
npm run test
```

The regression test suite covers important backend behavior around authentication, project management, public configuration responses, domain validation, and logging.

## API Surface

### Health

```text
GET /health
```

### Admin APIs

Admin routes are mounted under:

```text
/api/admin
```

Main groups:

- `/api/admin/auth/*` for login, current user, and logout.
- `/api/admin/projects/*` for project CRUD and `publicKey` regeneration.
- `/api/admin/access-logs` for public configuration access logs.
- `/api/admin/action-logs` for administrator operation logs.

See [../shared/admin-api.md](../shared/admin-api.md) for detailed request and response examples.

### Public API

Commercial frontend projects call:

```text
GET /api/public/projects/:slug/config?key=publicKey
```

The response includes:

- `status`
- `enabled`
- `expiresAt`
- `popup`
- `variables`
- `message`
- `serverTime`

See [../shared/public-license-api.md](../shared/public-license-api.md) for response examples and integration guidance.

## Status Calculation

- `enabled=false` always produces `suspended`.
- `status=suspended` always produces `suspended`.
- A project with an `expiresAt` earlier than the current server time produces `expired`.
- `active` and `grace` are returned as configured when the project is enabled and not expired.

Only `active` and `grace` responses include configured `variables`. `expired` and `suspended` responses return an empty object for `variables`.

## Redis Cache

Redis is optional. When `REDIS_URL` is set, the backend caches public project records to reduce database reads. Cache failures, timeouts, or invalid cache content automatically fall back to SQLite.

Project creation, updates, deletion, and `publicKey` regeneration invalidate or refresh the related cache record. Redis should be bound to localhost or a private network in production.

## Security and Operational Notes

- Change `ADMIN_PASSWORD` and `SESSION_SECRET` before production use.
- Keep `SESSION_SECRET` private and at least 32 characters long.
- Use HTTPS in production.
- Restrict `CORS_ORIGIN` to the deployed admin console origin.
- Treat `publicKey` as a public project access key, not a high-security secret.
- Use `allowedDomains` to reduce accidental or unauthorized public-config reads.
- Keep `backend/.env`, `backend/data/`, logs, and build output out of Git.
