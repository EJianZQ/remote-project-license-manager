# Remote Project License Manager

[English](./README.md) | [中文](./README_CN.md)

<p>
  <img src="https://img.shields.io/badge/TypeScript-5+-3178c6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Fastify-5-000000?logo=fastify&logoColor=white" alt="Fastify" />
  <img src="https://img.shields.io/badge/Vue-3-42b883?logo=vue.js&logoColor=white" alt="Vue 3" />
  <img src="https://img.shields.io/badge/SQLite-Drizzle-003b57?logo=sqlite&logoColor=white" alt="SQLite and Drizzle ORM" />
  <img src="https://img.shields.io/badge/i18n-ready-4b5563" alt="i18n ready" />
</p>

Remote Project License Manager is a transparent license, delivery-state, and remote-configuration system for commercial frontend projects. It gives a developer or studio a small admin console for managing project status, expiration dates, grace periods, service notices, allowed domains, public integration keys, remote variables, and audit logs.

The system is intentionally narrow in scope. It provides status checks, popup configuration, custom variables, access logs, and administrator action logs. It does not provide hidden backdoors, remote command execution, destructive actions, client-data encryption, or any mechanism designed to damage a customer's business.

## Features

- Project license records with `active`, `grace`, `expired`, and `suspended` states.
- Computed `effectiveStatus` based on enablement, manual status, and expiration time.
- Public configuration endpoint for commercial frontend projects.
- Per-project `publicKey` generation and regeneration.
- Optional domain restrictions for public configuration access.
- Remote JSON variables returned only while a project is `active` or in `grace`.
- Popup notice configuration with `info`, `warning`, and `danger` levels.
- Admin authentication with signed httpOnly cookies.
- Access logs for public configuration requests.
- Admin action logs with before/after JSON snapshots.
- Optional Redis caching for public project records, with SQLite fallback.
- Vue 3 admin console with project management, logs, access snippets, and multilingual UI.

## Repository Layout

```text
remote-project-license-manager/
  backend/              # Fastify API, SQLite database, auth, logs, public config endpoint
  frontend/             # Vue 3 admin console built with Vite, Pinia, Vue Router, Naive UI
  shared/               # API notes for admin routes and public license integration
  README.md             # Main English documentation
  README_CN.md          # Main Chinese documentation
```

## Architecture

```text
Admin user
  -> Vue admin console
  -> Fastify admin API
  -> SQLite project records and logs

Commercial frontend project
  -> GET /api/public/projects/:slug/config?key=publicKey
  -> status, popup, variables, message
```

The admin console talks to authenticated `/api/admin/*` endpoints with cookies. Commercial frontend projects only call the public configuration endpoint and receive a limited response shaped for runtime integration.

## Quick Start

### 1. Start the backend

```bash
cd backend
npm install
cp .env.example .env
npm run db:migrate
npm run dev
```

Default backend URL:

```text
http://localhost:3001
```

Before using a real deployment, change `ADMIN_PASSWORD` and `SESSION_SECRET` in `backend/.env`. `SESSION_SECRET` must be at least 32 characters.

### 2. Start the frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Default frontend URL:

```text
http://localhost:5173
```

The frontend uses:

```text
VITE_APP_ORIGIN=http://localhost:5173
VITE_API_BASE_URL=http://localhost:3001
```

## Status Model

| Status | Meaning | Public variables |
| --- | --- | --- |
| `active` | The project is operating normally. | Returned |
| `grace` | The project is in a grace period, usually for delivery or payment follow-up. | Returned |
| `expired` | The project has passed its expiration time. | Empty object |
| `suspended` | The project has been manually or effectively suspended. | Empty object |

`enabled=false` always produces `suspended`. A non-suspended project with an `expiresAt` value earlier than the server time produces `expired`.

## Public Integration

Commercial frontend projects request:

```text
GET /api/public/projects/:slug/config?key=publicKey
```

Example response:

```json
{
  "success": true,
  "data": {
    "project": "demo-project",
    "serverTime": "2026-05-23T10:00:00.000Z",
    "status": "active",
    "enabled": true,
    "expiresAt": null,
    "popup": {
      "enabled": false,
      "level": "warning",
      "title": "",
      "content": ""
    },
    "variables": {
      "title": "Demo Project"
    },
    "message": ""
  }
}
```

`publicKey` is a project-level public access key, not a high-security secret. Use domain restrictions when you want to limit which frontend origins can read a project's public configuration.

## Documentation

- [Backend documentation](./backend/README.md)
- [Backend documentation in Chinese](./backend/README_CN.md)
- [Frontend documentation](./frontend/README.md)
- [Frontend documentation in Chinese](./frontend/README_CN.md)
- [Admin API notes](./shared/admin-api.md)
- [Public license API notes](./shared/public-license-api.md)

## Responsible Use

Use this system only for transparent license status, delivery reminders, grace-period reminders, service suspension notices, and remote configuration. Make the integration clear in contracts, delivery notes, or customer communication. Do not use it to hide control logic, collect unrelated private data, damage customer systems, or block normal usage except for an explicit and disclosed `suspended` state.
