# 商业前端项目授权配置 API 接口说明

## 接口用途

商业前端项目可以通过该接口读取项目授权状态、弹窗配置和远程变量。该接口适用于普通商业前端项目、H5 项目、小程序 WebView 页面等场景。

接口只用于透明的授权状态、到期提醒、宽限期提醒、暂停提醒和远程配置下发，不用于远程执行代码、删除数据、加密数据或破坏业务。

## 接口地址

```text
GET /api/public/projects/:slug/config?key=publicKey
```

完整示例：

```text
GET http://localhost:3001/api/public/projects/jdyd/config?key=public-key
```

## 请求参数

| 参数 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| slug | path | string | 是 | 项目英文缩略名，例如 `jdyd` |
| key | query | string | 是 | 项目的 `publicKey` |

## 请求头说明

- `Origin`：浏览器跨域请求来源，后端优先从这里解析域名。
- `Referer`：页面来源地址，`Origin` 不存在时后端会尝试从这里解析域名。
- `User-Agent`：调用方客户端信息，会记录到访问日志中。

## 域名限制说明

- 项目 `allowedDomains` 为空数组时，不限制请求来源域名。
- 项目 `allowedDomains` 非空时，请求来源域名必须精确匹配其中一个值。
- `example.com` 只匹配 `example.com`。
- `www.example.com` 只匹配 `www.example.com`。
- 第一版不支持复杂通配符。
- `allowedDomains` 中的域名不要带 `http://`、`https://`、端口或路径。

## 状态说明

- `active`：项目正常，返回 `variables`，弹窗按项目配置返回。
- `grace`：项目进入宽限期，仍返回 `variables`，通常配合弹窗提醒。
- `expired`：项目已到期，不返回业务变量，返回到期提示。
- `suspended`：项目已暂停，不返回业务变量，返回暂停提示。

后端会根据项目配置计算实际状态：`enabled=false` 一定返回 `suspended`；未暂停但 `expiresAt` 已早于服务器当前时间时返回 `expired`。

## 服务端缓存说明

后端可能使用 Redis 缓存项目配置记录以提升公开接口响应速度。缓存不会改变接口响应结构、状态计算、域名校验、访问日志记录或错误语义；Redis 不可用时后端会回退数据库查询。

## 返回示例

### active

```json
{
  "success": true,
  "data": {
    "project": "jdyd",
    "serverTime": "2026-05-23T10:00:00.000Z",
    "status": "active",
    "enabled": true,
    "expiresAt": "2026-06-01T00:00:00.000Z",
    "popup": {
      "enabled": false,
      "level": "warning",
      "title": "",
      "content": ""
    },
    "variables": {
      "title": "酒店预定主页",
      "phone": "18666666166"
    },
    "message": ""
  }
}
```

### grace

```json
{
  "success": true,
  "data": {
    "project": "jdyd",
    "serverTime": "2026-05-23T10:00:00.000Z",
    "status": "grace",
    "enabled": true,
    "expiresAt": "2026-06-01T00:00:00.000Z",
    "popup": {
      "enabled": true,
      "level": "warning",
      "title": "项目服务提醒",
      "content": "当前项目已进入宽限期，请及时完成尾款结算。"
    },
    "variables": {
      "title": "酒店预定主页",
      "phone": "18666666166"
    },
    "message": "当前项目已进入宽限期"
  }
}
```

### expired

```json
{
  "success": true,
  "data": {
    "project": "jdyd",
    "serverTime": "2026-05-23T10:00:00.000Z",
    "status": "expired",
    "enabled": false,
    "expiresAt": "2026-06-01T00:00:00.000Z",
    "popup": {
      "enabled": true,
      "level": "danger",
      "title": "项目服务已到期",
      "content": "当前项目服务已到期，请联系开发方处理。"
    },
    "variables": {},
    "message": "项目服务已到期"
  }
}
```

### suspended

```json
{
  "success": true,
  "data": {
    "project": "jdyd",
    "serverTime": "2026-05-23T10:00:00.000Z",
    "status": "suspended",
    "enabled": false,
    "expiresAt": "2026-06-01T00:00:00.000Z",
    "popup": {
      "enabled": true,
      "level": "danger",
      "title": "项目服务已暂停",
      "content": "当前项目服务已暂停，请联系开发方恢复。"
    },
    "variables": {},
    "message": "项目服务已暂停"
  }
}
```

### 授权失败

```json
{
  "success": false,
  "message": "项目不存在或授权校验失败"
}
```

### 域名不允许

```json
{
  "success": false,
  "message": "当前域名不允许访问该项目配置"
}
```

## 商业前端项目接入建议

- 建议页面启动时请求一次配置。
- `active` / `grace` 时可以使用 `variables` 渲染关键展示内容。
- `expired` / `suspended` 时 `variables` 为空。
- 前端不要把接口失败直接处理成白屏，应展示本地默认提示或保底内容。
- 建议保留本地默认提示，避免网络失败时影响基础展示。
- 如果需要缓存，应设置合理过期时间，避免长时间使用过期状态。
- 不要在前端写死敏感信息。
- 不要把 `publicKey` 当作高安全密钥，它只是项目级公开访问 key。

## 合规使用说明

- 该接口用于授权状态、到期提醒、宽限期提醒和远程配置。
- 不应用于删除客户数据。
- 不应用于破坏客户服务器。
- 不应用于采集终端用户隐私。
- 建议在合同或聊天记录中明确说明授权校验、到期提醒、宽限期和服务暂停规则。
