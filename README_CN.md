# Remote Project License Manager

[English](./README.md) | [中文](./README_CN.md)

<p>
  <img src="https://img.shields.io/badge/TypeScript-5+-3178c6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Fastify-5-000000?logo=fastify&logoColor=white" alt="Fastify" />
  <img src="https://img.shields.io/badge/Vue-3-42b883?logo=vue.js&logoColor=white" alt="Vue 3" />
  <img src="https://img.shields.io/badge/SQLite-Drizzle-003b57?logo=sqlite&logoColor=white" alt="SQLite and Drizzle ORM" />
  <img src="https://img.shields.io/badge/i18n-ready-4b5563" alt="i18n ready" />
</p>

Remote Project License Manager 是一个面向商业前端项目的授权状态、交付状态与远程配置管理系统。它提供一个轻量管理后台，用于管理项目状态、到期时间、宽限期、服务提醒、允许访问域名、公开接入 key、远程变量和审计日志。

这个系统的边界非常明确：它只提供状态校验、弹窗配置、自定义变量、访问日志和管理员操作日志。不包含隐蔽后门、远程命令执行、破坏性操作、客户数据加密，或任何用于损害客户业务的能力。

## 功能

- 项目授权记录，支持 `active`、`grace`、`expired`、`suspended` 四种状态。
- 根据启用状态、手动状态和到期时间计算 `effectiveStatus`。
- 为商业前端项目提供公开配置接口。
- 为每个项目生成和重新生成 `publicKey`。
- 支持按项目配置允许访问的来源域名。
- 支持远程 JSON 变量；仅在 `active` 和 `grace` 状态下返回。
- 支持 `info`、`warning`、`danger` 三种弹窗提醒等级。
- 基于签名 httpOnly cookie 的管理员登录。
- 记录公开配置接口访问日志。
- 记录管理员操作日志，并保存变更前后的 JSON 快照。
- 可选 Redis 缓存公开项目记录，Redis 不可用时回退 SQLite。
- Vue 3 管理后台，包含项目管理、日志、接入代码片段和多语言界面。

## 仓库结构

```text
remote-project-license-manager/
  backend/              # Fastify API、SQLite 数据库、认证、日志、公开配置接口
  frontend/             # Vue 3 管理后台，基于 Vite、Pinia、Vue Router、Naive UI
  shared/               # 管理后台 API 与公开授权 API 说明
  README.md             # 英文主文档
  README_CN.md          # 中文主文档
```

## 架构

```text
管理员
  -> Vue 管理后台
  -> Fastify 管理 API
  -> SQLite 项目记录与日志

商业前端项目
  -> GET /api/public/projects/:slug/config?key=publicKey
  -> status、popup、variables、message
```

管理后台通过带 cookie 的 `/api/admin/*` 接口工作。商业前端项目只调用公开配置接口，并获得用于运行时接入的有限响应。

## 快速开始

### 1. 启动后端

```bash
cd backend
npm install
cp .env.example .env
npm run db:migrate
npm run dev
```

默认后端地址：

```text
http://localhost:3001
```

正式部署前，请修改 `backend/.env` 中的 `ADMIN_PASSWORD` 和 `SESSION_SECRET`。`SESSION_SECRET` 至少需要 32 个字符。

### 2. 启动前端

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

默认前端地址：

```text
http://localhost:5173
```

前端默认使用：

```text
VITE_APP_ORIGIN=http://localhost:5173
VITE_API_BASE_URL=http://localhost:3001
```

## 状态模型

| 状态 | 含义 | 公开变量 |
| --- | --- | --- |
| `active` | 项目正常运行。 | 返回 |
| `grace` | 项目处于宽限期，通常用于交付或尾款提醒。 | 返回 |
| `expired` | 项目已超过到期时间。 | 空对象 |
| `suspended` | 项目被手动或实际暂停。 | 空对象 |

`enabled=false` 时一定表现为 `suspended`。未暂停项目的 `expiresAt` 早于服务器时间时，实际状态为 `expired`。

## 公开接入

商业前端项目请求：

```text
GET /api/public/projects/:slug/config?key=publicKey
```

响应示例：

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

`publicKey` 是项目级公开访问 key，不是高安全密钥。需要限制调用来源时，请配置项目的允许域名列表。

## 文档

- [后端英文文档](./backend/README.md)
- [后端中文文档](./backend/README_CN.md)
- [前端英文文档](./frontend/README.md)
- [前端中文文档](./frontend/README_CN.md)
- [管理后台 API 说明](./shared/admin-api.md)
- [公开授权 API 说明](./shared/public-license-api.md)

## 合规使用

请只将本系统用于透明的授权状态、交付提醒、宽限期提醒、服务暂停提醒和远程配置。建议在合同、交付说明或客户沟通中明确说明接入规则。不要将它用于隐藏控制逻辑、采集无关隐私数据、破坏客户系统，或在未明确约定的情况下阻断正常使用。
