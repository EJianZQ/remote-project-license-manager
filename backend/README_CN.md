# 后端服务

[English](./README.md) | [中文](./README_CN.md)

这是 Remote Project License Manager 的 Fastify 后端服务。它使用 SQLite 存储项目授权记录，提供带认证的管理后台 API，提供商业前端项目调用的公开配置接口，记录公开访问日志和管理员操作日志，并可选使用 Redis 缓存公开项目记录。

后端用于透明的授权状态与交付状态管理。它返回状态、弹窗配置、远程变量和提示信息；不执行远程代码，也不提供破坏性控制能力。

## 技术栈

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

## 目录结构

```text
backend/
  src/
    index.ts                       # 服务启动入口
    app.ts                         # Fastify app、插件、路由、健康检查
    env.ts                         # 环境变量读取与校验
    db/
      index.ts                     # SQLite 与 Drizzle 连接
      schema.ts                    # 数据表定义与类型
      migrate.ts                   # 初始化数据库表和索引
    modules/
      auth/                        # 管理员登录、退出、登录态校验
      projects/                    # 项目 CRUD、publicKey 重置、状态计算
      public/                      # 公开项目配置 API 与缓存集成
      logs/                        # 公开访问日志与管理员操作日志
    utils/                         # 响应、JSON、时间、域名、随机工具
  tests/
    backend.regression.test.ts     # 核心后端行为回归测试
```

## 安装依赖

```bash
npm install
```

## 环境变量

创建本地环境文件：

```bash
cp .env.example .env
```

可用配置：

| 变量 | 说明 |
| --- | --- |
| `ADMIN_USERNAME` | 管理员登录用户名，默认 `admin`。 |
| `ADMIN_PASSWORD` | 管理员登录密码，部署前必须修改。 |
| `SESSION_SECRET` | 用于签名 httpOnly cookie 的密钥，至少 32 个字符。 |
| `DATABASE_URL` | SQLite 数据库位置，例如 `file:./data/app.db`。 |
| `SERVER_PORT` | 后端端口，默认 `3001`。 |
| `NODE_ENV` | `development`、`test` 或 `production`。 |
| `PUBLIC_BASE_URL` | 后端公开地址，用于示例和后续集成。 |
| `CORS_ORIGIN` | 允许访问管理 API 的管理后台来源，多个来源用逗号分隔。 |
| `ADMIN_SESSION_TTL_SECONDS` | 管理员登录态有效期，默认 8 小时。 |
| `PUBLIC_CONFIG_RATE_LIMIT_MAX` | 公开配置接口在时间窗口内的最大请求数。 |
| `PUBLIC_CONFIG_RATE_LIMIT_WINDOW_SECONDS` | 公开配置接口限流窗口，单位秒。 |
| `ACCESS_LOG_RETENTION_DAYS` | 公开访问日志保留天数。 |
| `REDIS_URL` | 可选 Redis 地址。留空则禁用 Redis 缓存。 |
| `PUBLIC_CONFIG_CACHE_TTL_SECONDS` | 公开项目记录 Redis 缓存时间。 |
| `REDIS_COMMAND_TIMEOUT_MS` | Redis 命令超时时间，单位毫秒。 |

生产环境占位示例：

```bash
PUBLIC_BASE_URL=https://api.example.com
CORS_ORIGIN=https://admin.example.com
REDIS_URL=redis://127.0.0.1:6379
```

## 数据库

初始化 SQLite 表结构：

```bash
npm run db:migrate
```

迁移脚本会创建：

- `projects`
- `project_access_logs`
- `admin_sessions`
- `admin_action_logs`

项目表保存面向业务项目的授权配置。日志表用于审计公开访问和管理员操作。

## 开发

```bash
npm run dev
```

开发服务通过 `tsx` 监听 `src/index.ts`。

## 构建与运行

```bash
npm run build
npm run start
```

编译产物输出到 `dist/`。

## 测试

```bash
npm run test
```

回归测试覆盖认证、项目管理、公开配置响应、域名校验和日志记录等关键行为。

## API 范围

### 健康检查

```text
GET /health
```

### 管理后台 API

管理接口挂载在：

```text
/api/admin
```

主要分组：

- `/api/admin/auth/*`：登录、当前用户、退出。
- `/api/admin/projects/*`：项目 CRUD 和 `publicKey` 重新生成。
- `/api/admin/access-logs`：公开配置访问日志。
- `/api/admin/action-logs`：管理员操作日志。

详细请求和响应示例见 [../shared/admin-api.md](../shared/admin-api.md)。

### 公开 API

商业前端项目调用：

```text
GET /api/public/projects/:slug/config?key=publicKey
```

响应包含：

- `status`
- `enabled`
- `expiresAt`
- `popup`
- `variables`
- `message`
- `serverTime`

响应示例和接入建议见 [../shared/public-license-api.md](../shared/public-license-api.md)。

## 状态计算

- `enabled=false` 时一定表现为 `suspended`。
- `status=suspended` 时一定表现为 `suspended`。
- 项目的 `expiresAt` 早于服务器当前时间时，实际状态为 `expired`。
- 项目启用且未过期时，按配置返回 `active` 或 `grace`。

只有 `active` 和 `grace` 会返回配置的 `variables`。`expired` 和 `suspended` 会返回空对象。

## Redis 缓存

Redis 是可选项。设置 `REDIS_URL` 后，后端会缓存公开项目记录，以减少数据库读取。缓存失败、命令超时或缓存内容异常时，会自动回退 SQLite。

创建、修改、删除项目和重新生成 `publicKey` 时，会主动失效或刷新相关缓存。生产环境建议让 Redis 只监听本机或内网。

## 安全与运维注意事项

- 生产环境必须修改 `ADMIN_PASSWORD` 和 `SESSION_SECRET`。
- `SESSION_SECRET` 需要保密，并且至少 32 个字符。
- 生产环境请使用 HTTPS。
- `CORS_ORIGIN` 应限制为部署后的管理后台来源。
- `publicKey` 是项目级公开访问 key，不是高安全密钥。
- 需要减少非预期读取时，请配置 `allowedDomains`。
- 不要把 `backend/.env`、`backend/data/`、日志和构建产物提交到 Git。
