# 前端管理后台

[English](./README.md) | [中文](./README_CN.md)

这是 Remote Project License Manager 的 Vue 3 管理后台。管理员可以在浏览器中登录、管理商业前端项目、编辑授权状态和远程变量、配置弹窗提醒、生成接入示例，并查看公开访问日志和管理员操作日志。

## 技术栈

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
- ESLint 和 Oxlint

## 功能

- 基于 httpOnly cookie 登录态的管理员登录流程。
- 仪表盘展示项目总数和最近更新项目。
- 项目列表支持搜索、状态筛选、启用状态筛选、分页和响应式表格。
- 项目新建/编辑表单支持状态、到期时间、弹窗配置、变量、域名限制和备注。
- 远程变量 JSON 编辑器，支持校验、格式化、压缩和示例填充。
- 域名编辑器会拒绝协议、端口、路径和非法字符。
- 项目详情页展示公开 API 地址、`fetch` 示例和 agent 接入提示词。
- 支持复制和重新生成 `publicKey`。
- 支持 `info`、`warning`、`danger` 三种弹窗等级预览。
- 访问日志和管理员操作日志页面。
- 内置简体中文、繁体中文和英文界面文案。

## 目录结构

```text
frontend/
  src/
    api/                         # Axios 客户端和类型化 API 封装
    components/
      common/                    # 通用 UI 组件
      layout/                    # 管理后台外壳和顶部栏
      project/                   # 项目表单、JSON 编辑器、域名编辑器、弹窗预览
    config/                      # 运行时环境变量规范化
    i18n/                        # 多语言文案和 i18n 初始化
    layouts/                     # 登录布局和管理后台布局
    pages/                       # 登录、仪表盘、项目、日志、404 页面
    router/                      # 路由定义和登录守卫
    stores/                      # Pinia 状态
    styles/                      # 基础样式和主题样式
    tests/                       # 单元测试
    utils/                       # 格式化、剪贴板、域名、接入提示词工具
```

## 安装依赖

```bash
npm install
```

## 环境变量

创建本地覆盖配置：

```bash
cp .env.example .env.local
```

前端读取：

| 变量 | 说明 |
| --- | --- |
| `VITE_APP_ORIGIN` | 管理后台访问来源，用于生成与部署环境匹配的示例。 |
| `VITE_API_BASE_URL` | 后端 API 基础地址，也用于生成公开配置接口地址。 |

本地默认值：

```text
VITE_APP_ORIGIN=http://localhost:5173
VITE_API_BASE_URL=http://localhost:3001
```

生产环境占位示例：

```text
VITE_APP_ORIGIN=https://admin.example.com
VITE_API_BASE_URL=https://api.example.com
```

## 开发

```bash
npm run dev
```

默认 Vite 地址：

```text
http://localhost:5173
```

请确保后端已启动，并且后端 `CORS_ORIGIN` 包含前端来源。

## 构建

```bash
npm run build
```

生产构建会执行类型检查，并将静态资源输出到 `dist/`。

## 预览

```bash
npm run preview
```

## 测试

```bash
npm run test:unit
```

覆盖率：

```bash
npm run test:coverage
```

## 代码检查

```bash
npm run lint
```

该命令会运行 Oxlint 和 ESLint，并启用自动修复。

## 路由

| 路由 | 用途 |
| --- | --- |
| `/login` | 管理员登录页。 |
| `/dashboard` | 项目概览和快捷入口。 |
| `/projects` | 项目列表、筛选、操作和接入弹窗。 |
| `/projects/create` | 新建项目。 |
| `/projects/:id` | 项目详情、变量、允许域名、接入示例、最近日志。 |
| `/projects/:id/edit` | 编辑已有项目。 |
| `/access-logs` | 查看公开配置接口访问日志。 |
| `/action-logs` | 查看管理员操作日志。 |

路由守卫会在初始化时请求后端 `/api/admin/auth/me`，未登录用户会被重定向到 `/login`。

## 公开接入工具

项目详情页会生成：

- 公开配置 API 地址。
- 最小 `fetch` 示例。
- 用于把公开配置接口接入另一个前端项目的 agent 提示词。

这些工具位于 `src/utils/accessInfo.ts`。生成的接入说明强调安全边界：应用启动时请求一次、集中保存状态和变量、不执行变量中的代码，并且只在明确的 `suspended` 状态下阻止原页面渲染。

## 注意事项

- 真实部署 URL 请放在本地 `.env.local`、`.env.development` 或 `.env.production`，不要提交。
- 管理 API 使用 cookie，所以请求会携带 `withCredentials: true`。
- 公开项目接入地址使用 `VITE_API_BASE_URL` 生成。
- `publicKey` 只展示给管理员，可在项目列表或项目详情流程中重新生成。
