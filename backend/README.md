# 前端项目授权与交付状态管理系统后端

这是“前端项目授权与交付状态管理系统”的第一阶段后端服务。它用于合法、透明、可审计地管理商业前端项目的授权状态、演示期、宽限期、到期提醒、远程变量和访问日志。

本系统只提供远程配置、授权状态、弹窗提醒、自定义变量下发、访问日志记录和管理员操作日志，不包含隐蔽后门、远程命令执行、删库、加密客户数据或破坏客户业务的能力。

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
    app.ts                         # 创建 Fastify app、注册插件和路由
    env.ts                         # 环境变量读取与校验
    db/
      index.ts                     # SQLite / Drizzle 连接
      schema.ts                    # Drizzle 数据库表定义
      migrate.ts                   # 初始化数据库表和索引
    modules/
      auth/                        # 管理员登录、退出、登录态校验
      projects/                    # 项目 CRUD、publicKey 重置、状态计算
      public/                      # 商业前端项目公开配置接口
      logs/                        # 访问日志和管理员操作日志
    utils/                         # 响应、JSON、时间、域名、随机 key 等工具
```

## 安装依赖

```bash
npm install
```

## 配置环境变量

```bash
cp .env.example .env
```

环境变量说明：

- `ADMIN_USERNAME`：管理员登录用户名，默认 `admin`
- `ADMIN_PASSWORD`：管理员登录密码，使用环境变量明文保存
- `SESSION_SECRET`：用于签名 httpOnly cookie 的长随机字符串，生产环境必须修改
- `DATABASE_URL`：SQLite 数据库位置，例如 `file:./data/app.db`
- `SERVER_PORT`：后端监听端口，默认 `3001`
- `NODE_ENV`：运行环境，支持 `development`、`test`、`production`
- `PUBLIC_BASE_URL`：后端公开访问地址，用于文档和后续扩展
- `CORS_ORIGIN`：允许管理后台跨域访问的来源，多个来源可用逗号分隔
- `ADMIN_SESSION_TTL_SECONDS`：管理员登录态有效期，默认 `28800` 秒
- `PUBLIC_CONFIG_RATE_LIMIT_MAX`：公开配置接口在时间窗口内允许的最大请求数，默认 `120`
- `PUBLIC_CONFIG_RATE_LIMIT_WINDOW_SECONDS`：公开配置接口限流时间窗口，默认 `60` 秒
- `ACCESS_LOG_RETENTION_DAYS`：公开配置访问日志保留天数，默认 `90` 天
- `REDIS_URL`：Redis 连接地址，留空则禁用公开配置缓存，例如 `redis://127.0.0.1:6379`
- `PUBLIC_CONFIG_CACHE_TTL_SECONDS`：公开配置项目记录缓存时间，默认 `120` 秒
- `REDIS_COMMAND_TIMEOUT_MS`：Redis 命令超时时间，默认 `500` 毫秒

生产环境域名示例：

```bash
PUBLIC_BASE_URL=https://api.example.com
CORS_ORIGIN=https://admin.example.com
REDIS_URL=redis://127.0.0.1:6379
```

## 初始化数据库

```bash
npm run db:migrate
```

该命令会创建 `projects`、`project_access_logs`、`admin_sessions`、`admin_action_logs` 四张表和必要索引。

## 开发环境启动

```bash
npm run dev
```

## 生产构建

```bash
npm run build
```

## 生产启动

```bash
npm run start
```

## Redis 缓存

后端可以使用 Redis 缓存公开配置接口读取的项目记录。缓存只作为性能优化，不改变接口响应结构、状态计算、域名校验或访问日志记录。Redis 不可用、命令超时或缓存内容异常时，后端会自动回退 SQLite。

管理后台创建、修改、删除项目或重新生成 `publicKey` 后，会主动失效对应项目缓存。建议生产环境 Redis 仅监听本机或内网，不要直接开放公网 `6379` 端口。

## 接口文档位置

- 管理后台接口文档：`../shared/admin-api.md`
- 商业前端项目公开授权接口文档：`../shared/public-license-api.md`

## 状态说明

- `active`：项目正常，公开接口返回 `variables`，弹窗按项目配置返回。
- `grace`：项目处于宽限期，公开接口仍返回 `variables`，通常用于提醒尾款或交付事项。
- `expired`：项目已到期，公开接口不返回业务变量，返回到期提示。
- `suspended`：项目已暂停，公开接口不返回业务变量，返回暂停提示。

接口返回时会额外计算 `effectiveStatus`：

- `enabled=false` 时一定表现为 `suspended`
- `status=suspended` 时一定表现为 `suspended`
- 未暂停但 `expiresAt` 早于服务器当前时间时表现为 `expired`
- 未到期时，`active` 和 `grace` 按数据库状态返回

## 合规使用建议

请在合同、聊天记录或交付说明中明确告知客户：项目会请求授权配置接口，用于授权状态、到期提醒、宽限期提醒和服务暂停提醒。不要将本系统用于破坏客户数据、破坏客户服务器、采集终端用户隐私或任何隐蔽控制行为。
