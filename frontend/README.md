# Frontend

[English](./README.md) | [中文](./README_CN.md)

The frontend is the Vue 3 admin console for Remote Project License Manager. It gives administrators a browser-based interface for signing in, managing commercial frontend projects, editing license status and remote variables, configuring popup notices, generating integration examples, and reviewing access and action logs.

## Tech Stack

- Vue 3
- Vite
- TypeScript
- Vue Router
- Pinia
- Vue I18n
- Naive UI
- Lucide Vue icons
- Axios
- CodeMirror JSON editor
- Vitest
- ESLint and Oxlint

## Features

- Admin login flow backed by httpOnly cookie sessions.
- Dashboard with total project count and recently updated projects.
- Project list with search, status filters, enabled-state filters, pagination, and responsive table behavior.
- Project create/edit forms for status, expiration time, popup settings, variables, domain restrictions, and remarks.
- JSON editor for remote variables with validation, formatting, compacting, and examples.
- Domain editor that rejects protocols, ports, paths, and invalid characters.
- Project detail page with public API endpoint, `fetch` example, and agent integration prompt.
- `publicKey` copy and regeneration actions.
- Popup preview for `info`, `warning`, and `danger` levels.
- Access log and admin action log pages.
- Built-in Simplified Chinese, Traditional Chinese, and English UI messages.

## Directory Structure

```text
frontend/
  src/
    api/                         # Axios client and typed API wrappers
    components/
      common/                    # Shared UI components
      layout/                    # Admin shell and top bar
      project/                   # Project form, JSON editor, domain editor, popup preview
    config/                      # Runtime environment normalization
    i18n/                        # Locale messages and i18n setup
    layouts/                     # Auth and admin layouts
    pages/                       # Login, dashboard, projects, logs, not found
    router/                      # Route definitions and auth guards
    stores/                      # Pinia stores
    styles/                      # Base and theme CSS
    tests/                       # Unit tests
    utils/                       # Formatting, clipboard, domain, access prompt helpers
```

## Installation

```bash
npm install
```

## Environment Variables

Create a local override file:

```bash
cp .env.example .env.local
```

The frontend reads:

| Variable | Description |
| --- | --- |
| `VITE_APP_ORIGIN` | Admin console origin. Used when generating deployment-aware examples. |
| `VITE_API_BASE_URL` | Backend API base URL. Also used to generate public configuration URLs. |

Local defaults:

```text
VITE_APP_ORIGIN=http://localhost:5173
VITE_API_BASE_URL=http://localhost:3001
```

Production-style placeholders:

```text
VITE_APP_ORIGIN=https://admin.example.com
VITE_API_BASE_URL=https://api.example.com
```

## Development

```bash
npm run dev
```

Default Vite URL:

```text
http://localhost:5173
```

Make sure the backend is running and that `CORS_ORIGIN` includes the frontend origin.

## Build

```bash
npm run build
```

The production build runs type checking and writes static assets to `dist/`.

## Preview

```bash
npm run preview
```

## Tests

```bash
npm run test:unit
```

Coverage:

```bash
npm run test:coverage
```

## Linting

```bash
npm run lint
```

This runs both Oxlint and ESLint with auto-fix enabled.

## Routes

| Route | Purpose |
| --- | --- |
| `/login` | Admin sign-in page. |
| `/dashboard` | Project overview and quick actions. |
| `/projects` | Project list, filters, actions, and access modal. |
| `/projects/create` | Create a new project. |
| `/projects/:id` | Project details, variables, allowed domains, access examples, recent logs. |
| `/projects/:id/edit` | Edit an existing project. |
| `/access-logs` | Review public configuration access logs. |
| `/action-logs` | Review administrator operation logs. |

Route guards call the backend `/api/admin/auth/me` endpoint during initialization and redirect unauthenticated users to `/login`.

## Public Integration Tools

The project detail page generates:

- A public configuration API URL.
- A minimal `fetch` example.
- A longer agent prompt for integrating the public configuration endpoint into another frontend project.

Those helpers live in `src/utils/accessInfo.ts`. The generated guidance emphasizes safe integration: request once on startup, store status and variables centrally, do not execute code from variables, and only block rendering for an explicit `suspended` status.

## Notes

- Keep real deployment URLs in local `.env.local`, `.env.development`, or `.env.production` files; do not commit them.
- The admin API uses cookies, so requests are sent with `withCredentials: true`.
- Public project integration URLs use `VITE_API_BASE_URL`.
- `publicKey` is displayed for administrators and can be regenerated from the project list or project detail flow.
