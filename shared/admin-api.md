# 管理后台 API 接口说明

## 基础信息

- API Base URL：`http://localhost:3001`
- 请求格式：`application/json`
- 响应格式：`application/json`
- 登录机制：httpOnly cookie，cookie 名称为 `admin_session`
- 管理后台跨域请求需要携带 cookie，例如 `fetch` 设置 `credentials: "include"`

成功响应：

```json
{
  "success": true,
  "data": {}
}
```

失败响应：

```json
{
  "success": false,
  "message": "错误信息"
}
```

分页响应：

```json
{
  "success": true,
  "data": {
    "items": [],
    "total": 0,
    "page": 1,
    "pageSize": 20
  }
}
```

## 认证接口

### POST /api/admin/auth/login

- 用途：管理员登录
- 是否需要登录：否
- 请求方法：`POST`
- 请求路径：`/api/admin/auth/login`

请求参数：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| username | string | 是 | 管理员用户名 |
| password | string | 是 | 管理员密码明文，只用于本次登录校验 |

请求示例：

```json
{
  "username": "admin",
  "password": "123456"
}
```

响应示例：

```json
{
  "success": true,
  "data": {
    "username": "admin"
  }
}
```

可能错误：

- `400`：请求参数错误
- `401`：用户名或密码错误
- `429`：请求过于频繁

### GET /api/admin/auth/me

- 用途：获取当前登录管理员
- 是否需要登录：是
- 请求方法：`GET`
- 请求路径：`/api/admin/auth/me`

响应示例：

```json
{
  "success": true,
  "data": {
    "username": "admin"
  }
}
```

可能错误：

- `401`：未登录或登录态无效

### POST /api/admin/auth/logout

- 用途：退出登录并清除 cookie
- 是否需要登录：是
- 请求方法：`POST`
- 请求路径：`/api/admin/auth/logout`

响应示例：

```json
{
  "success": true,
  "data": null
}
```

可能错误：

- `401`：未登录或登录态无效

## 项目管理接口

### GET /api/admin/projects

- 用途：分页查询项目列表
- 是否需要登录：是
- 请求方法：`GET`
- 请求路径：`/api/admin/projects`

Query 参数：

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| keyword | string | 否 | 无 | 按 `name` 或 `slug` 模糊搜索 |
| status | string | 否 | 无 | `active`、`grace`、`expired`、`suspended` |
| enabled | boolean string | 否 | 无 | `true` 或 `false` |
| page | number | 否 | 1 | 页码 |
| pageSize | number | 否 | 20 | 每页数量，最大 100 |

响应示例：

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "name": "酒店预定",
        "slug": "jdyd",
        "publicKey": "public-key",
        "enabled": true,
        "status": "active",
        "effectiveStatus": "active",
        "expiresAt": "2026-06-01T00:00:00.000Z",
        "popupEnabled": false,
        "createdAt": "2026-05-23T10:00:00.000Z",
        "updatedAt": "2026-05-23T10:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20
  }
}
```

### GET /api/admin/projects/:id

- 用途：查询项目详情
- 是否需要登录：是
- 请求方法：`GET`
- 请求路径：`/api/admin/projects/:id`

响应示例：

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "酒店预定",
    "slug": "jdyd",
    "publicKey": "public-key",
    "enabled": true,
    "status": "active",
    "effectiveStatus": "active",
    "expiresAt": "2026-06-01T00:00:00.000Z",
    "popupEnabled": false,
    "popupTitle": "项目服务提醒",
    "popupContent": "请及时完成尾款结算",
    "popupLevel": "warning",
    "variables": {
      "title": "酒店预定主页",
      "phone": "18666666166"
    },
    "allowedDomains": ["example.com", "www.example.com"],
    "remarks": "",
    "createdAt": "2026-05-23T10:00:00.000Z",
    "updatedAt": "2026-05-23T10:00:00.000Z"
  }
}
```

可能错误：

- `400`：项目 ID 格式错误
- `404`：项目不存在

### POST /api/admin/projects

- 用途：创建项目
- 是否需要登录：是
- 请求方法：`POST`
- 请求路径：`/api/admin/projects`

请求示例：

```json
{
  "name": "酒店预定",
  "slug": "jdyd",
  "enabled": true,
  "status": "active",
  "expiresAt": "2026-06-01T00:00:00.000Z",
  "popupEnabled": false,
  "popupTitle": "项目服务提醒",
  "popupContent": "请及时完成尾款结算",
  "popupLevel": "warning",
  "variables": {
    "title": "酒店预定主页",
    "phone": "18666666166"
  },
  "allowedDomains": ["example.com", "www.example.com"],
  "remarks": ""
}
```

响应示例：

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "酒店预定",
    "slug": "jdyd",
    "publicKey": "generated-public-key",
    "enabled": true,
    "status": "active",
    "effectiveStatus": "active",
    "expiresAt": "2026-06-01T00:00:00.000Z",
    "popupEnabled": false,
    "popupTitle": "项目服务提醒",
    "popupContent": "请及时完成尾款结算",
    "popupLevel": "warning",
    "variables": {
      "title": "酒店预定主页",
      "phone": "18666666166"
    },
    "allowedDomains": ["example.com", "www.example.com"],
    "remarks": "",
    "createdAt": "2026-05-23T10:00:00.000Z",
    "updatedAt": "2026-05-23T10:00:00.000Z"
  }
}
```

可能错误：

- `400`：参数错误、slug 格式错误、slug 已存在、域名格式错误

### PUT /api/admin/projects/:id

- 用途：修改项目
- 是否需要登录：是
- 请求方法：`PUT`
- 请求路径：`/api/admin/projects/:id`

请求示例：

```json
{
  "status": "grace",
  "popupEnabled": true,
  "popupTitle": "项目服务提醒",
  "popupContent": "当前项目已进入宽限期，请及时完成尾款结算。",
  "variables": {
    "title": "酒店预定主页",
    "phone": "18666666166"
  }
}
```

响应示例：

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "酒店预定",
    "slug": "jdyd",
    "publicKey": "generated-public-key",
    "enabled": true,
    "status": "grace",
    "effectiveStatus": "grace",
    "expiresAt": "2026-06-01T00:00:00.000Z",
    "popupEnabled": true,
    "popupTitle": "项目服务提醒",
    "popupContent": "当前项目已进入宽限期，请及时完成尾款结算。",
    "popupLevel": "warning",
    "variables": {
      "title": "酒店预定主页",
      "phone": "18666666166"
    },
    "allowedDomains": ["example.com", "www.example.com"],
    "remarks": "",
    "createdAt": "2026-05-23T10:00:00.000Z",
    "updatedAt": "2026-05-23T11:00:00.000Z"
  }
}
```

可能错误：

- `400`：参数错误或 slug 已存在
- `404`：项目不存在

### POST /api/admin/projects/:id/regenerate-key

- 用途：重新生成项目 `publicKey`
- 是否需要登录：是
- 请求方法：`POST`
- 请求路径：`/api/admin/projects/:id/regenerate-key`

响应示例：

```json
{
  "success": true,
  "data": {
    "publicKey": "new-public-key",
    "project": {
      "id": 1,
      "name": "酒店预定",
      "slug": "jdyd",
      "publicKey": "new-public-key",
      "enabled": true,
      "status": "active",
      "effectiveStatus": "active",
      "expiresAt": "2026-06-01T00:00:00.000Z",
      "popupEnabled": false,
      "popupTitle": "项目服务提醒",
      "popupContent": "请及时完成尾款结算",
      "popupLevel": "warning",
      "variables": {
        "title": "酒店预定主页"
      },
      "allowedDomains": ["example.com"],
      "remarks": "",
      "createdAt": "2026-05-23T10:00:00.000Z",
      "updatedAt": "2026-05-23T11:00:00.000Z"
    }
  }
}
```

可能错误：

- `404`：项目不存在

### DELETE /api/admin/projects/:id

- 用途：软删除项目
- 是否需要登录：是
- 请求方法：`DELETE`
- 请求路径：`/api/admin/projects/:id`

响应示例：

```json
{
  "success": true,
  "data": null
}
```

可能错误：

- `404`：项目不存在

## 日志接口

### GET /api/admin/projects/:id/access-logs

- 用途：查看某个项目的公开配置访问日志
- 是否需要登录：是
- Query 参数：`page`、`pageSize`

响应示例：

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "projectId": 1,
        "slug": "jdyd",
        "publicKey": "public-key",
        "requestDomain": "example.com",
        "origin": "https://example.com",
        "referer": "https://example.com/index.html",
        "ip": "127.0.0.1",
        "userAgent": "Mozilla/5.0",
        "effectiveStatus": "active",
        "allowed": true,
        "message": "",
        "createdAt": "2026-05-23T10:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20
  }
}
```

### GET /api/admin/access-logs

- 用途：查看全部公开配置访问日志
- 是否需要登录：是
- Query 参数：`slug`、`effectiveStatus`、`allowed`、`page`、`pageSize`

### GET /api/admin/action-logs

- 用途：查看管理员操作日志
- 是否需要登录：是
- Query 参数：`action`、`targetType`、`targetId`、`page`、`pageSize`

响应示例：

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "action": "create_project",
        "targetType": "project",
        "targetId": 1,
        "before": null,
        "after": {
          "id": 1,
          "slug": "jdyd"
        },
        "ip": "127.0.0.1",
        "userAgent": "Mozilla/5.0",
        "createdAt": "2026-05-23T10:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20
  }
}
```

## 字段说明

### Project

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | number | 数据库内部 ID，仅管理后台使用 |
| name | string | 项目中文名 |
| slug | string | 项目英文缩略名，只允许小写字母、数字、短横线、下划线 |
| publicKey | string | 商业前端项目请求公开接口时使用的项目级公开访问 key |
| enabled | boolean | 是否启用项目 |
| status | string | 管理员设置的状态 |
| effectiveStatus | string | 后端根据 `enabled`、`status`、`expiresAt` 计算后的实际状态 |
| expiresAt | string/null | ISO 8601 到期时间 |
| popupEnabled | boolean | 是否按项目配置展示弹窗 |
| popupTitle | string | 弹窗标题 |
| popupContent | string | 弹窗内容 |
| popupLevel | string | `info`、`warning`、`danger` |
| variables | object | 下发给商业前端项目的自定义变量 |
| allowedDomains | string[] | 允许访问公开配置接口的域名列表 |
| remarks | string | 管理员内部备注 |

### status 和 effectiveStatus

- `active`：正常状态，公开接口返回 `variables`
- `grace`：宽限期，公开接口返回 `variables`
- `expired`：已到期，公开接口不返回 `variables`
- `suspended`：已暂停，公开接口不返回 `variables`
- `enabled=false` 时 `effectiveStatus` 一定为 `suspended`
- `expiresAt` 早于服务器当前时间时，未暂停项目的 `effectiveStatus` 为 `expired`

### popup

`popupEnabled`、`popupTitle`、`popupContent`、`popupLevel` 控制公开接口返回的弹窗配置。到期和暂停状态会返回系统默认的强提醒弹窗。

### variables

`variables` 必须是合法 JSON 对象。`active` 和 `grace` 状态会返回该对象，`expired` 和 `suspended` 状态会返回空对象。

### allowedDomains

`allowedDomains` 是字符串数组，只存域名，不要带 `http://`、`https://`、端口或路径。为空数组时不限制请求来源域名。

## 前端开发注意事项

- 登录态由 httpOnly cookie 维护，管理后台请求需要携带 cookie。
- 前端不要保存管理员密码。
- 创建和修改项目时 `variables` 必须是合法 JSON 对象。
- `allowedDomains` 不要带协议、端口或路径。
- `publicKey` 只在管理后台展示给管理员，并由接入的商业前端项目调用公开接口时使用。
