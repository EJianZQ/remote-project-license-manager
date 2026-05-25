import type { LocaleCode } from '@/i18n/messages'

export interface AccessPromptOptions {
  endpoint: string
  projectName?: string
  slug?: string
  locale?: LocaleCode
}

export function buildFetchExample(endpoint: string) {
  return `const res = await fetch("${endpoint}");
const json = await res.json();
if (json.success) {
  console.log(json.data.status);
  console.log(json.data.variables);
}`
}

export function buildAgentAccessPrompt({ endpoint, projectName, slug, locale = 'zh-CN' }: AccessPromptOptions) {
  const projectSlug = slug?.trim() || 'project-slug'
  const projectNameLine = projectName?.trim() ? `- 项目名称：${projectName.trim()}\n` : ''

  if (locale === 'zh-TW') {
    return buildTraditionalAgentPrompt({ endpoint, projectName, projectSlug })
  }

  if (locale === 'en-US') {
    return buildEnglishAgentPrompt({ endpoint, projectName, projectSlug })
  }

  return `现在你需要为当前前端项目接入项目授权管理系统。

接入项目：

${projectNameLine}- 项目 slug：${projectSlug}
- 公开配置接口：
  ${endpoint}

系统用途：

该系统用于透明地读取项目授权状态、到期提醒、宽限期提醒、暂停提醒、弹窗配置和远程变量，帮助项目交付时处理尾款结算或服务纠纷。

重要边界：

1. 该系统只用于授权状态展示、提醒和远程配置下发。
2. publicKey 是项目级公开访问 key，不是高安全密钥。

一、接入目标

请在当前前端项目中完成授权配置接入，要求：

1. 应用启动时请求一次公开配置接口。
2. 请求成功后，把授权状态、弹窗配置、远程 variables 保存到全局状态中。
3. variables 只负责保存，不要在通用接入逻辑里替换任何业务页面内容。
4. 不要自动改业务页面里的标题、电话、公告、按钮、订单、支付、登录等逻辑。
5. 如果项目后续需要使用 variables，我会单独说明具体哪个字段对应哪个页面内容。
6. 如果 LicenseStatus 明确是 suspended，则不渲染原网页任何内容，只渲染一个授权暂停页面，用接口返回的 message 或 popup 内容提示用户，并终止网页其他功能。
7. 如果请求失败、超时、JSON 解析失败、success=false、网络断开、CORS 错误等，不要给用户展示任何温和提示，不要弹窗，不要阻塞页面，只在控制台输出错误，并正常渲染原网页内容。
8. 接入代码应集中封装，不要在多个页面里重复写 fetch。
9. 不要接入 SDK，本次只在当前项目内完成一键接入逻辑。

二、接口说明

请求方式：

GET

请求地址：

${endpoint}

响应示例：

{
  "success": true,
  "data": {
    "project": "${projectSlug}",
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
      "title": "项目展示标题",
      "phone": "18666666166"
    },
    "message": ""
  },
  "message": ""
}

字段解释：

1. success=false：
   表示授权校验失败、项目不存在、publicKey 错误或当前域名不允许访问。此时只在 console 中输出 message，不要展示给普通用户，不要中断页面渲染。

2. data.status：
   有四种主要状态：
   - active：项目正常。
   - grace：宽限期。
   - expired：项目已到期。
   - suspended：项目已暂停。

3. data.popup：
   - enabled：是否启用弹窗
   - level：info / warning / danger
   - title：弹窗标题
   - content：弹窗内容

4. data.variables：
   远程变量对象。本次只保存到状态管理中，不在通用提示词中实现业务使用逻辑。

三、推荐实现结构

请先识别当前项目技术栈，然后按项目现有风格接入。

如果是 Vue 3 + Pinia 项目，建议新增（但你可以也最好根据项目具体结构来定）：

src/api/license.ts
src/stores/license.ts
src/types/license.ts
src/components/license/LicenseSuspendedPage.vue

如果不是 Vue 3 + Pinia 项目：

请使用当前项目已有状态管理方式；如果没有状态管理，请封装一个可复用的响应式模块或 singleton，不要把授权逻辑散落在页面组件里。

四、TypeScript 类型要求

请补充清晰类型，至少包含：

type LicenseStatus = 'active' | 'grace' | 'expired' | 'suspended' | 'unknown'

type PopupLevel = 'info' | 'warning' | 'danger'

type LicensePopup = {
  enabled: boolean
  level: PopupLevel
  title: string
  content: string
}

type LicenseConfig = {
  project: string
  serverTime: string
  status: LicenseStatus
  enabled: boolean
  expiresAt: string | null
  popup: LicensePopup
  variables: Record<string, string>
  message: string
}

type LicenseState = {
  loading: boolean
  loaded: boolean
  error: string | null
  status: LicenseStatus
  popup: LicensePopup | null
  variables: Record<string, string>
  serverTime: string | null
  expiresAt: string | null
  message: string
  lastFetchedAt: number | null
}

五、请求封装要求

请封装一个函数，例如：

fetchLicenseConfig()

要求：

1. 使用 fetch 或项目已有 HTTP 工具。
2. 请求超时时间建议 5000ms。
3. 使用 AbortController 实现超时取消。
4. 不要携带管理员 cookie。
5. 不要调用管理员接口。
6. 不要无限重试。
7. 请求失败时只 console.error，不要抛出导致页面崩溃的未处理异常。
8. 如果多个组件同时调用，要避免重复并发请求，可以使用 loading 状态或请求 Promise 复用。
9. success=false 时不要弹窗，不要阻断页面，只记录 error 状态并 console.error。

六、状态管理要求

请新增或复用一个授权状态 store。

至少包含：

- loading
- loaded
- error
- status
- popup
- variables
- serverTime
- expiresAt
- message
- lastFetchedAt

行为要求：

1. 默认 status = 'unknown'。
2. 默认 variables = {}。
3. active：
   - 保存 status。
   - 保存 popup。
   - 保存 variables。
   - 正常渲染原网页。
4. grace：
   - 保存 status。
   - 保存 popup。
   - 保存 variables。
   - 正常渲染原网页。
5. expired：
   - 保存 status。
   - 保存 popup。
   - 保存 variables，但不要在通用逻辑里使用 variables。
   - 正常渲染原网页。
   - 如 popup.enabled=true，按弹窗规则提醒。
6. suspended：
   - 保存 status。
   - 保存 popup。
   - 保存 message。
   - 不渲染原网页任何内容。
   - 只渲染授权暂停页面。
   - 授权暂停页面显示 popup.title / popup.content / message。
   - 终止网页其他业务功能。
7. success=false：
   - 设置 error。
   - console.error 输出错误。
   - 正常渲染原网页。
   - 不给用户显示提示。
8. 网络失败、请求超时、CORS 错误、JSON 解析失败：
   - 设置 error。
   - console.error 输出错误。
   - 正常渲染原网页。
   - 不给用户显示提示。

七、应用启动接入位置

请根据项目结构选择合适位置。

优先级：

1. main.ts / main.js
2. App.vue
3. 全局 Layout
4. 路由初始化后的全局入口
5. 现有 app 初始化模块

关键要求：

1. 需要在应用启动阶段尽早请求授权配置。
2. 如果请求失败或异常，不能阻止原应用正常渲染。
3. 如果请求成功且 status=suspended，必须阻止原应用内容渲染，只显示授权暂停页面。
4. 如果项目技术栈允许，推荐用全局 LicenseGate 包裹原应用内容：

伪代码示例：

<LicenseGate>
  <RouterView />
</LicenseGate>

LicenseGate 逻辑：

- loading 时可以显示极简加载状态，或短暂保持空白。
- status=suspended 时显示 LicenseSuspendedPage。
- status 不是 suspended 时渲染原应用内容。
- 请求失败时渲染原应用内容，并只 console.error。

八、suspended 暂停页要求

如果 LicenseStatus 明确是 suspended：

1. 不渲染原网页任何业务内容。
2. 不渲染原路由页面。
3. 不允许继续使用原网页功能。
4. 只展示一个全屏暂停页。
5. 暂停页内容来自：
   - 优先 popup.title
   - 优先 popup.content
   - 其次 data.message
   - 如果都为空，使用默认文案：

标题：
项目服务已暂停

内容：
当前项目服务已暂停，请联系服务方恢复。

6. 暂停页视觉要求：
   - 居中卡片
   - 简洁白色背景
   - 明确提示
   - 不要恐吓用户
   - 不要死循环 alert
   - 不要使用浏览器锁死逻辑
   - 不要阻止用户关闭网页或返回上一页

九、弹窗规则

只有在接口成功返回，并且 data.popup.enabled = true 时，才执行弹窗逻辑。

弹窗内容：

- title 使用 popup.title
- content 使用 popup.content
- 如果 title 或 content 为空，则使用 data.message 兜底
- level 用于选择视觉等级：
  - info：普通信息
  - warning：警告
  - danger：严重提醒

弹窗实现：

1. 优先使用当前项目已有 UI 库的 Dialog / Modal / MessageBox。
2. 如果没有 UI 库，则使用原生 alert。
3. 文案使用纯文本方式渲染。

具体分级规则：

1. info 级别：

- 一个浏览器会话中只展示一次。
- 使用 sessionStorage 记录，例如：
  license_popup_info_shown_${projectSlug}=true
- 在网页打开后的随机 3 到 10 秒内展示。
- 用户关闭后，本次浏览器会话内不再展示。
- 刷新后如果 sessionStorage 仍存在，也不再展示。

2. warning 级别：

- 每次进入页面、切换页面都要弹窗。
- 路由发生变化后，随机 3 到 10 秒内展示一次。
- 用户关闭后，本页面本次进入不再重复弹。
- 下次进入页面或切换到新页面时，再次随机 3 到 10 秒内展示。
- 如果项目没有路由，则每次页面加载展示一次。

3. danger 级别：

- 每次进入页面、切换页面都要启动 danger 弹窗循环。
- 进入页面或切换页面后，随机 3 到 10 秒内展示一次。
- 用户关闭后，下一个随机 3 到 10 秒内再次展示。
- 只要当前状态仍然是 danger 对应的弹窗配置，并且 status 不是 suspended，就持续循环提醒。
- 如果路由切换，需要清理旧 timer，再按新页面重新开始。
- 如果组件卸载，需要清理 timer。
- 如果 status 变成 suspended，则停止普通弹窗循环，改为 suspended 暂停页。

十、弹窗计时器实现要求

请封装弹窗调度逻辑，不要在多个页面散写 setTimeout。

建议新增：

src/utils/licensePopup.ts

或者在 license store 中封装：

- scheduleLicensePopup()
- clearLicensePopupTimers()
- showLicensePopup()

要求：

1. 随机时间函数：
   randomDelay(3000, 10000)
2. 所有 setTimeout 都要保存 timer id。
3. 路由切换时清理 warning / danger 旧 timer。
4. danger 弹窗关闭后再安排下一次 timer。
5. 组件卸载时清理 timer。
6. 防止重复创建多个 danger 循环。
7. info 级别用 sessionStorage 防止会话内重复展示。

十一、远程 variables 要求

本次只保存 variables，不要使用 variables 改业务页面。

具体要求：

1. 把 data.variables 保存到全局状态中。
2. 不要替换标题。
3. 不要替换电话。
4. 不要替换公告。
5. 不要替换按钮。
6. 不要替换页面文案。
7. 不要修改支付逻辑。
8. 不要修改登录逻辑。
9. 不要修改订单逻辑。
10. 不要修改任何核心业务流程。
11. 不要基于 variables 动态执行任何代码。

可以在 store 中提供：

- variables
- getVariable(key: string)
- hasVariable(key: string)

但不要在业务页面里调用，除非项目已有明确需求说明。

十二、状态衍生值要求

请在 store 中提供方便后续使用的衍生状态，例如：

isActive：
status === 'active'

isGrace：
status === 'grace'

isExpired：
status === 'expired'

isSuspended：
status === 'suspended'

canRenderApp：
status !== 'suspended'

statusText：
- active：正常
- grace：宽限期
- expired：已到期
- suspended：已暂停
- unknown：未知

displayMessage：
- 优先使用 message
- 其次使用 popup.content
- 最后使用默认提示

十三、缓存要求

做缓存必须遵守：

1. 缓存只作为短时间兜底。
2. 缓存时间建议 1 到 5 分钟。
3. 每次应用启动仍应重新请求接口。
4. 不要长时间缓存 expired 或 suspended 状态。
5. 如果网络失败，只能使用短期缓存；没有缓存就正常渲染原网页并 console.error。
6. 如果缓存中明确是 suspended，也应展示 suspended 暂停页，但缓存时间必须很短，不能长期阻断。

十四、错误处理要求

出现以下情况时：

- 后端未启动
- 网络断开
- 请求超时
- CORS 错误
- JSON 解析失败
- success=false
- HTTP 非 2xx
- 响应结构不符合预期

处理方式：

1. 只在 console.error 或 console.warn 中输出错误。
2. 不给普通用户展示提示。
3. 不弹窗。
4. 不白屏。
5. 不阻断原网页功能。
6. 保持原项目正常渲染。
7. 记录 error 状态，方便开发者调试。

十五、路由切换处理

如果项目使用前端路由，请在路由 afterEach 或全局布局中处理弹窗规则。

要求：

1. info：
   - 不随路由重复弹。
2. warning：
   - 每次路由进入后随机 3 到 10 秒展示一次。
3. danger：
   - 每次路由进入后启动循环。
   - 路由切换时清理旧循环。
   - 新页面重新启动循环。
4. suspended：
   - 直接展示 suspended 暂停页，不再执行普通路由弹窗逻辑。

如果项目没有前端路由：

1. info：会话内一次。
2. warning：页面加载后一次。
3. danger：页面加载后启动循环。

十六、自测要求

完成后请至少自测以下情况：

1. active + popup.enabled=false：
   - 正常渲染原网页。
   - 不弹窗。
   - variables 被保存到状态中。

2. active + popup.level=info：
   - 正常渲染原网页。
   - 随机 3 到 10 秒内弹一次。
   - 同一会话不重复弹。

3. grace + popup.level=warning：
   - 正常渲染原网页。
   - 每次进入页面或切换页面都会随机 3 到 10 秒内弹一次。

4. expired + popup.level=danger：
   - 正常渲染原网页。
   - 进入页面后随机 3 到 10 秒内弹窗。
   - 关闭后下一个随机 3 到 10 秒内继续弹。
   - 路由切换后清理旧 timer 并重新开始。

5. suspended：
   - 不渲染原网页内容。
   - 只显示授权暂停页面。
   - 原网页业务功能不可用。

6. success=false：
   - 控制台输出错误。
   - 不弹窗。
   - 不显示用户提示。
   - 原网页正常渲染。

7. 网络失败 / 请求超时 / CORS 错误：
   - 控制台输出错误。
   - 不弹窗。
   - 不显示用户提示。
   - 原网页正常渲染。

8. variables：
   - 被保存到状态中。
   - 没有被自动用于修改业务页面。

十七、最终输出要求

完成后请输出：

1. 新增了哪些文件。
2. 修改了哪些文件。
3. 授权配置请求入口在哪里。
4. 授权状态 store 或模块在哪里。
5. variables 保存在哪里。
6. 是否有业务页面使用 variables；本次默认不应使用。
7. suspended 暂停页在哪里。
8. 弹窗调度逻辑在哪里。
9. 如何修改请求地址和 publicKey。
10. 如何测试 active / grace / expired / suspended / success=false / 网络失败。
11. 是否清理了路由切换和组件卸载时的 timer。
12. 如果发现当前项目结构不适合接入，请说明最小改造方案。

请直接开始实现，不要再询问需求。优先保证接入稳定、透明、可维护。除了 status=suspended 这种明确暂停状态外，其他错误情况都不得影响原项目正常运行。`
}

function buildTraditionalAgentPrompt({
  endpoint,
  projectName,
  projectSlug,
}: {
  endpoint: string
  projectName?: string
  projectSlug: string
}) {
  const projectNameValue = projectName?.trim() || '目前專案'

  return `現在你需要為目前前端專案存取專案授權管理系統。

接入項目：

- 項目名稱：${projectNameValue}
- 項目 slug：${projectSlug}
- 公開設定介面：
 ${endpoint}

系統用途：

該系統用於透明地讀取專案授權狀態、到期提醒、寬限期提醒、暫停提醒、彈跳窗配置和遠端變量，幫助專案交付時處理尾款結算或服務糾紛。

重要邊界：

1. 此系統只用於授權狀態展示、提醒和遠端配置下發。
2. publicKey 是專案層級公開存取 key，不是高安全金鑰。

一、接入目標

請在目前前端專案中完成授權配置接入，需求：

1. 應用程式啟動時請求一次公開設定介面。
2. 請求成功後，把授權狀態、彈跳窗配置、遠端 variables 儲存到全域狀態。
3. variables 只負責保存，不要在通用存取邏輯中取代任何商業頁面內容。
4. 不要自動改商家頁面裡的標題、電話、公告、按鈕、訂單、付款、登入等邏輯。
5. 如果專案後續需要使用 variables，我會單獨說明哪個欄位對應哪個頁面內容。
6. 如果 LicenseStatus 明確是 suspended，則不渲染原網頁任何內容，只渲染一個授權暫停頁面，用介面返回的 message 或 popup 內容提示用戶，並終止網頁其他功能。
7. 如果請求失敗、逾時、JSON 解析失敗、success=false、網絡斷開、CORS 錯誤等，不要給用戶展示任何溫和提示，不要彈出窗口，不要阻塞頁面，只在控制台輸出錯誤，並正常渲染原始網頁內容。
8. 接入代碼應集中封裝，不要在多個頁面重複寫 fetch。
9. 不要接取 SDK，本次只在目前專案內完成一鍵接取邏輯。

二、介面說明

請求方式：

GET

請求地址：

${endpoint}

回應範例：

{
 "success": true,
 "data": {
 "project": "${projectSlug}",
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
 "title": "項目展示標題",
 "phone": "18666666166"
 },
 "message": ""
 },
 "message": ""
}

字段解釋：

1. success=false：
 表示授權校驗失敗、專案不存在、publicKey 錯誤或目前網域不允許存取。此時只在 console 中輸出 message，不要展示給普通用戶，不要中斷頁面渲染。

2. data.status：
 有四種主要狀態：
 - active：專案正常。
- grace：寬限期。
- expired：專案已到期。
- suspended：項目已暫停。

3. data.popup：
 - enabled：是否啟用彈窗
 - level：info / warning / danger
 - title：彈跳標題
 - content：彈跳窗內容

4. data.variables：
 遠端變數物件。本次只保存到狀態管理中，不在通用提示詞中實現業務使用邏輯。

三、推薦實現結構

請先識別目前專案技術棧，然後按項目現有風格接入。

如果是 Vue 3 + Pinia 項目，建議新增（但你可以也最好根據項目具體結構來定）：

src/api/license.ts
src/stores/license.ts
src/types/license.ts
src/components/license/LicenseSuspendedPage.vue

如果不是 Vue 3 + Pinia 項目：

請使用目前專案已有狀態管理方式；如果沒有狀態管理，請封裝一個可重複使用的響應式模組或 singleton，不要把授權邏輯散落在頁面元件裡。

四、TypeScript 類型要求

請補充清晰類型，至少包含：

type LicenseStatus = 'active' | 'grace' | 'expired' | 'suspended' | 'unknown'

type PopupLevel = 'info' | 'warning' | 'danger'

type LicensePopup = {
 enabled: boolean
 level: PopupLevel
 title: string
 content: string
}

type LicenseConfig = {
 project: string
 serverTime: string
 status: LicenseStatus
 enabled: boolean
 expiresAt: string | null
 popup: LicensePopup
 variables: Record<string, string>
 message: string
}

type LicenseState = {
 loading: boolean
 loaded: boolean
 error: string | null
 status: LicenseStatus
 popup: LicensePopup | null
 variables: Record<string, string>
 serverTime: string | null
 expiresAt: string | null
 message: string
 lastFetchedAt: number | null
}

五、請求封裝要求

請封裝一個函數，例如：

fetchLicenseConfig()

要求：

1. 使用 fetch 或專案已有 HTTP 工具。
2. 請求超時時間建議 5000ms。
3. 使用 AbortController 實作逾時取消。
4. 不要攜帶管理者 cookie。
5. 不要呼叫管理員介面。
6. 不要無限重試。
7. 請求失敗時只 console.error，不要拋出導致頁面崩潰的未處理異常。
8. 如果多個元件同時調用，要避免重複並發請求，可以使用 loading 狀態或請求 Promise 重複使用。
9. success=false 時不要彈窗，不要阻斷頁面，只記錄 error 狀態並 console.error。

六、狀態管理要求

請新增或重複使用一個授權狀態 store。

至少包含：

- loading
- loaded
- error
- status
- popup
- variables
- serverTime
- expiresAt
- message
- lastFetchedAt

行為要求：

1. 預設 status = 'unknown'。
2. 預設 variables = {}。
3. active：
 - 儲存 status。
- 儲存 popup。
- 儲存 variables。
- 正常渲染原網頁。
4. grace：
 - 儲存 status。
- 儲存 popup。
- 儲存 variables。
- 正常渲染原網頁。
5. expired：
 - 儲存 status。
- 儲存 popup。
- 儲存 variables，但不要在通用邏輯裡使用 variables。
- 正常渲染原網頁。
- 如 popup.enabled=true，依彈跳視窗規則提醒。
6. suspended：
 - 儲存 status。
- 儲存 popup。
- 儲存 message。
- 不渲染原網頁任何內容。
- 只渲染授權暫停頁面。
- 授權暫停頁面顯示 popup.title / popup.content / message。
- 終止網頁其他業務功能。
7. success=false：
 - 設定 error。
- console.error 輸出錯誤。
- 正常渲染原網頁。
- 不給使用者顯示提示。
8. 網路失敗、請求逾時、CORS 錯誤、JSON 解析失敗：
 - 設定 error。
- console.error 輸出錯誤。
- 正常渲染原網頁。
- 不給使用者顯示提示。

七、應用程式啟動接入位置

請根據項目結構選擇合適位置。

優先：

1. main.ts / main.js
2. App.vue
3. 全域 Layout
4. 路由初始化後的全域入口
5. 現有 app 初始化模組

關鍵要求：

1. 需要在應用程式啟動階段儘早請求授權配置。
2. 如果請求失敗或異常，無法阻止原應用正常渲染。
3. 如果請求成功且 status=suspended，必須阻止原始應用內容渲染，只顯示授權暫停頁面。
4. 如果專案技術堆疊允許，建議用全域 LicenseGate 包裹原應用內容：

偽代碼範例：

<LicenseGate>
 <RouterView />
</LicenseGate>

LicenseGate 邏輯：

- loading 時可以顯示極簡載入狀態，或短暫保持空白。
- status=suspended 時顯示 LicenseSuspendedPage。
- status 不是 suspended 時渲染原始應用內容。
- 請求失敗時渲染原始應用內容，並只 console.error。

八、suspended 暫停頁要求

如果 LicenseStatus 明確是 suspended：

1. 不渲染原網頁任何業務內容。
2. 不渲染原路由頁面。
3. 不允許繼續使用原網頁功能。
4. 只展示一個全螢幕暫停頁。
5. 暫停頁內容來自：
 - 優先 popup.title
 - 優先 popup.content
 - 其次 data.message
 - 如果都為空，請使用預設文案：

標題：
項目服務已暫停

內容：
目前專案服務已暫停，請聯絡服務方恢復。

6. 暫停頁視覺要求：
 - 居中卡片
 - 簡潔白色背景
 - 明確提示
 - 不要恐嚇用戶
 - 不要死循環 alert
 - 不要使用瀏覽器鎖死邏輯
 - 不要阻止使用者關閉網頁或返回上一頁

九、彈窗規則

只有在介面成功返回，且 data.popup.enabled = true 時，才執行彈跳窗邏輯。

彈跳窗內容：

- title 使用 popup.title
- content 使用 popup.content
- 如果 title 或 content 為空，則使用 data.message 兜底
- level 用於選擇視覺等級：
 - info：普通訊息
 - warning：警告
 - danger：嚴重提醒

彈跳窗實現：

1. 優先使用目前專案已有 UI 函式庫的 Dialog / Modal / MessageBox。
2. 如果沒有 UI 函式庫，則使用原生 alert。
3. 文案使用純文字方式渲染。

具體分級規則：

1. info 等級：

- 一個瀏覽器會話中只展示一次。
- 使用 sessionStorage 記錄，例如：
 license_popup_info_shown_${projectSlug}=true
- 在網頁開啟後的隨機 3 到 10 秒內展示。
- 使用者關閉後，本次瀏覽器會話內不再展示。
- 刷新後如果 sessionStorage 仍存在，也不再展示。

2. warning 等級：

- 每次進入頁面、切換頁面都要彈出視窗。
- 路由變更後，隨機 3 到 10 秒內展示一次。
- 使用者關閉後，本頁本次進入不再重複彈。
- 下次進入頁面或切換到新頁面時，再次隨機 3 到 10 秒內顯示。
- 如果項目沒有路由，則每次頁面載入展示一次。

3. danger 等級：

- 每次進入頁面、切換頁面都要啟動 danger 彈跳窗循環。
- 進入頁面或切換頁面後，隨機 3 到 10 秒內展示一次。
- 用戶關閉後，下一個隨機 3 到 10 秒內再次展示。
- 只要目前狀態仍然是 danger 對應的彈跳窗配置，且 status 不是 suspended，就持續循環提醒。
- 如果路由切換，需要清理舊 timer，再按新頁面重新開始。
- 如果元件卸載，需要清理 timer。
- 如果 status 變成 suspended，則停止普通彈跳窗循環，改為 suspended 暫停頁。

十、彈窗計時器實現要求

請封裝彈跳窗調度邏輯，不要在多個頁面散寫 setTimeout。

建議新增：

src/utils/licensePopup.ts

或在 license store 包裝：

- scheduleLicensePopup()
- clearLicensePopupTimers()
- showLicensePopup()

要求：

1. 隨機時間函數：
 randomDelay(3000, 10000)
2. 所有 setTimeout 都要儲存 timer id。
3. 路由切換時清理 warning / danger 舊 timer。
4. danger 彈跳窗關閉後再安排下一次 timer。
5. 組件卸載時清理 timer。
6. 防止重複建立多個 danger 循環。
7. info 等級用 sessionStorage 防止會話內重複展示。

十一、遠程 variables 要求

本次只儲存 variables，不要使用 variables 改變業務頁面。

具體要求：

1. 把 data.variables 儲存到全域狀態。
2. 不要替換標題。
3. 不要替換電話。
4. 不要替換公告。
5. 不要替換按鈕。
6. 不要替換頁面文案。
7. 不要修改支付邏輯。
8. 不要修改登入邏輯。
9. 不要修改訂單邏輯。
10. 不要修改任何核心業務流程。
11. 不要基於 variables 動態執行任何程式碼。

可以在 store 提供：

- variables
- getVariable(key: string)
- hasVariable(key: string)

但不要在業務頁面裡調用，除非項目已有明確需求說明。

十二、狀態衍生值要求

請在 store 中提供方便後續使用的衍生狀態，例如：

isActive：
status === 'active'

isGrace：
status === 'grace'

isExpired：
status === 'expired'

isSuspended：
status === 'suspended'

canRenderApp：
status !== 'suspended'

statusText：
- active：正常
- grace：寬限期
- expired：已到期
- suspended：已暫停
- unknown：未知

displayMessage：
- 優先使用 message
- 其次使用 popup.content
- 最後使用預設提示

十三、快取需求

做緩存必須遵守：

1. 緩存只作為短時間兜底。
2. 快取時間建議 1 到 5 分鐘。
3. 每次應用程式啟動仍應重新請求介面。
4. 請勿長時間快取 expired 或 suspended 狀態。
5. 如果網路失敗，只能使用短期快取；沒有快取就正常渲染原網頁並 console.error。
6. 如果快取中明確是 suspended，也應顯示 suspended 暫停頁，但快取時間必須很短，不能長期阻斷。

十四、錯誤處理要求

出現以下情況時：

- 後端未啟動
- 網路斷開
- 請求逾時
- CORS 錯誤
- JSON 解析失敗
- success=false
- HTTP 非 2xx
- 響應結構不符合預期

處理方式：

1. 只在 console.error 或 console.warn 中輸出錯誤。
2. 不給一般使用者展示提示。
3. 不彈跳窗。
4. 不白屏。
5. 不阻斷原網頁功能。
6. 保持原項目正常渲染。
7. 記錄 error 狀態，方便開發者除錯。

十五、路由切換處理

如果專案使用前端路由，請在路由 afterEach 或全域佈局中處理彈出式規則。

要求：

1. info：
 - 不隨路由重複彈。
2. warning：
 - 每次路由進入後隨機 3 到 10 秒展示一次。
3. danger：
 - 每次路由進入後啟動循環。
- 路由切換時清理舊循環。
- 新頁面重新啟動循環。
4. suspended：
 - 直接展示 suspended 暫停頁，不再執行普通路由彈跳窗邏輯。

如果專案沒有前端路由：

1. info：會話內一次。
2. warning：頁面載入後一次。
3. danger：頁面載入後啟動循環。

十六、自測要求

完成後請至少自測以下情況：

1. active + popup.enabled=false：
 - 正常渲染原網頁。
- 不彈跳窗戶。
- variables 被儲存到狀態。

2. active + popup.level=info：
 - 正常渲染原網頁。
- 隨機 3 到 10 秒內彈一次。
- 同一會話不重複彈。

3. grace + popup.level=warning：
 - 正常渲染原網頁。
- 每次進入頁面或切換頁面都會隨機 3 到 10 秒內彈一次。

4. expired + popup.level=danger：
 - 正常渲染原網頁。
- 進入頁面後隨機 3 到 10 秒內彈跳窗。
- 關閉後下一個隨機 3 到 10 秒內繼續彈。
- 路由切換後清理舊 timer 並重新開始。

5. suspended：
 - 不渲染原網頁內容。
- 只顯示授權暫停頁面。
- 原網頁業務功能無法使用。

6. success=false：
 - 控制台輸出錯誤。
- 不彈跳窗戶。
- 不顯示使用者提示。
- 原網頁正常渲染。

7. 網路失敗 / 請求逾時 / CORS 錯誤：
 - 控制台輸出錯誤。
- 不彈跳窗戶。
- 不顯示使用者提示。
- 原網頁正常渲染。

8. variables：
 - 被儲存到狀態中。
- 沒有被自動用於修改業務頁面。

十七、最終輸出要求

完成後請輸出：

1. 新增了哪些文件。
2. 修改了哪些文件。
3. 授權配置請求入口在哪裡。
4. 授權狀態 store 或模組在哪裡。
5. variables 保存在哪裡。
6. 是否有業務頁面使用 variables；本次預設不應該使用。
7. suspended 暫停頁在哪裡。
8. 彈跳窗調度邏輯在哪裡。
9. 如何修改請求位址和 publicKey。
10. 如何測試 active / grace / expired / suspended / success=false / 網路失敗。
11. 是否清理了路由切換和元件卸載時的 timer。
12. 如果發現目前專案結構不適合接入，請說明最小改造方案。

請直接開始實現，不要再問需求。優先確保接入穩定、透明、可維護。除了 status=suspended 這種明確暫停狀態外，其他錯誤情況都不得影響原項目正常運作。`
}

function buildEnglishAgentPrompt({
  endpoint,
  projectName,
  projectSlug,
}: {
  endpoint: string
  projectName?: string
  projectSlug: string
}) {
  const projectNameValue = projectName?.trim() || 'Current Project'

  return `You are now required to integrate the project licensing management system into the current frontend project.

Project Details:

- Project Name: ${projectNameValue}
- Project Slug: ${projectSlug}
- Public Configuration API Endpoint:
${endpoint}

System Purpose:

This system is designed to transparently retrieve the project's licensing status, expiration alerts, grace period notifications, suspension alerts, popup configurations, and remote variables. It assists in handling final payment settlements or service disputes during project handover.

Important Scope Boundaries:

1. This system is strictly for displaying licensing status, issuing alerts, and distributing remote configurations.
2. The publicKey is a project-level public access key; it is *not* a high-security secret key.

I. Integration Objectives

Please complete the licensing configuration integration within the current frontend project, adhering to the following requirements:

1. Make a single request to the public configuration API endpoint when the application launches.
2. Upon a successful request, save the licensing status, popup configurations, and remote variables into the global state.
3. The variables should be stored only; do *not* use the generic integration logic to replace any content within the actual business pages.
4. Do *not* automatically alter the logic for elements within the business pages--such as titles, phone numbers, announcements, buttons, orders, payments, login flows, etc.
5. If the project requires the use of these variables in the future, I will provide separate, specific instructions detailing which fields correspond to which page elements.
6. If the LicenseStatus is explicitly set to suspended, do *not* render any of the original webpage content. Instead, render a dedicated "License Suspended" page, use the message or popup content returned by the API to notify the user, and disable all other webpage functionalities.
7. In the event of a request failure, timeout, JSON parsing error, success=false response, network disconnection, CORS error, etc., do *not* display any user-facing alerts or popups, and do *not* block the page. Simply log the error to the browser console and proceed to render the original webpage content as normal.
8. The integration code should be centrally encapsulated; avoid duplicating fetch calls across multiple individual pages.
9. Do *not* integrate a dedicated SDK; for this task, simply implement the direct integration logic within the current project codebase.

II. Interface Description

Request Method:

GET

Request URL:

${endpoint}

Response Example:

{
  "success": true,
  "data": {
    "project": "${projectSlug}",
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
      "title": "Project Display Title",
      "phone": "18666666166"
    },
    "message": ""
  },
  "message": ""
}

Field Explanations:

1. success=false:
Indicates that authorization validation failed, the project does not exist, the publicKey is incorrect, or access from the current domain is not permitted. In this scenario, the message should only be output to the console; it should *not* be displayed to end-users, and page rendering should *not* be interrupted.

2. data.status:
There are four main statuses:
- active: The project is active (normal).
- grace: Grace period.
- expired: The project has expired.
- suspended: The project has been suspended.

3. data.popup:
- enabled: Whether the popup is enabled.
- level: info / warning / danger.
- title: The title of the popup.
- content: The content of the popup.

4. data.variables:
An object containing remote variables. For this implementation, these variables should merely be stored within the state management system; no specific business logic utilizing them needs to be implemented within the general prompt/messaging components.

III. Recommended Implementation Structure

Please first identify the current project's technology stack, and then integrate this feature in a manner consistent with the project's existing coding style. If this is a Vue 3 + Pinia project, it is recommended to add the following files (though you should--and ideally *must*--adjust this based on your project's specific structure):

src/api/license.ts
src/stores/license.ts
src/types/license.ts
src/components/license/LicenseSuspendedPage.vue

If this is *not* a Vue 3 + Pinia project:

Please utilize the state management approach currently established within your project; if no such system exists, please encapsulate the logic within a reusable reactive module or a singleton. Do *not* scatter the licensing logic across various page components.

IV. TypeScript Type Requirements

Please define clear types, including at least the following:

type LicenseStatus = 'active' | 'grace' | 'expired' | 'suspended' | 'unknown'

type PopupLevel = 'info' | 'warning' | 'danger'

type LicensePopup = {
  enabled: boolean
  level: PopupLevel
  title: string
  content: string
}

type LicenseConfig = {
  project: string
  serverTime: string
  status: LicenseStatus
  enabled: boolean
  expiresAt: string | null
  popup: LicensePopup
  variables: Record<string, string>
  message: string
}

type LicenseState = {
  loading: boolean
  loaded: boolean
  error: string | null
  status: LicenseStatus
  popup: LicensePopup | null
  variables: Record<string, string>
  serverTime: string | null
  expiresAt: string | null
  message: string
  lastFetchedAt: number | null
}

V. Request Encapsulation Requirements

Please encapsulate the request logic within a dedicated function--for example:

fetchLicenseConfig()

Requirements:

1. Use the native fetch API or your project's existing HTTP utility library.
2. The request timeout duration is recommended to be 5000ms.
3. Use AbortController to implement timeout cancellation.
4. Do *not* include administrator-specific cookies in the request.
5. Do *not* call administrator-specific API endpoints.
6. Do *not* implement infinite retry logic.
7. If the request fails, simply log the error using console.error; do *not* throw an unhandled exception that could cause the page to crash.
8. If multiple components attempt to call this function simultaneously, prevent duplicate concurrent requests by utilizing a loading state flag or by reusing the pending Promise object.
9. If the response indicates success=false, do *not* display a popup or block user interaction with the page; instead, simply record the error state and log it via console.error.

VI. State Management Requirements

Please create a new authorization state store or reuse an existing one.

It must include at least the following properties:

- loading
- loaded
- error
- status
- popup
- variables
- serverTime
- expiresAt
- message
- lastFetchedAt

Behavioral Requirements:

1. Default status = 'unknown'.
2. Default variables = {}.
3. active:
- Store status.
- Store popup.
- Store variables.
- Render the original webpage content normally.
4. grace:
- Store status.
- Store popup.
- Store variables.
- Render the original webpage content normally.
5. expired:
- Store status.
- Store popup.
- Store variables, but do *not* use these variables within general application logic.
- Render the original webpage content normally.
- If popup.enabled is true, display a notification according to the popup rules.
6. suspended:
- Store status.
- Store popup.
- Store message.
- Do *not* render any of the original webpage content.
- Render *only* the authorization suspension page.
- The authorization suspension page must display popup.title, popup.content, and message.
- Terminate all other business-related functionalities of the webpage.
7. success=false:
- Set the error state.
- Output the error to console.error.
- Render the original webpage content normally.
- Do *not* display any user-facing notifications.
8. Network failure, request timeout, CORS errors, or JSON parsing failure:
- Set the error state.
- Output the error to console.error.
- Render the original webpage content normally.
- Do *not* display any user-facing notifications.

VII. Application Startup Integration Point

Please select an appropriate integration point based on your project's structure.

Priority Order:

1. main.ts / main.js
2. App.vue
3. Global Layout component
4. Global entry point executed after router initialization
5. Existing application initialization module

Key Requirements:

1. The authorization configuration must be fetched as early as possible during the application startup phase.
2. If the request fails or encounters an exception, it must *not* prevent the original application from rendering normally.
3. If the request succeeds and the status is suspended, you *must* prevent the original application content from rendering and display *only* the authorization suspension page.
4. If the project's technology stack permits, it is recommended to wrap the original application content within a global LicenseGate component:

Pseudocode Example:

<LicenseGate>
  <RouterView />
</LicenseGate>

LicenseGate Logic:

- During the loading state, display a minimalist loading indicator or briefly remain blank.
- When status="suspended", display the LicenseSuspendedPage.
- When status is *not* "suspended", render the original application content.
- If the request fails, render the original application content and merely log an error to the console (console.error).

VIII. Requirements for the "Suspended" Page

If the LicenseStatus is explicitly "suspended":

1. Do not render any business-specific content from the original webpage.
2. Do not render the original routed page components.
3. Do not allow continued use of the original webpage's functionality.
4. Display only a full-screen "Suspended" page.
5. The content for the Suspended page should be sourced as follows:
- Priority 1: popup.title
- Priority 1: popup.content
- Priority 2: data.message
- If all of the above are empty, use the default text:

Title:
Project Service Suspended

Content:
The current project service has been suspended. Please contact the service provider to restore it.

6. Visual Requirements for the Suspended Page:
- Centered card layout
- Clean, white background
- Clear and informative messaging
- Do not use intimidating language or visuals
- Do not trigger infinite alert loops
- Do not employ browser-locking logic
- Do not prevent the user from closing the webpage or navigating back to the previous page

IX. Popup Rules

The popup logic is executed only when the API interface returns successfully *and* data.popup.enabled is set to true.

Popup Content:

- title: Uses popup.title.
- content: Uses popup.content.
- If title or content is empty, data.message is used as a fallback.
- level: Used to select the visual severity level:
- info: General information.
- warning: Warning.
- danger: Critical alert.

Popup Implementation:

1. Priority is given to using the existing Dialog / Modal / MessageBox components from the current project's UI library.
2. If no UI library is available, the native alert function is used.
3. The text content is rendered as plain text.

Specific Level Rules:

1. info Level:

- Displayed only once per browser session.
- Recorded using sessionStorage; for example: license_popup_info_shown_${projectSlug}=true.
- Displayed at a random interval between 3 and 10 seconds after the webpage loads.
- Once closed by the user, it will not be displayed again during the current browser session.
- If the page is refreshed and the sessionStorage entry still exists, it will not be displayed again.

2. warning Level:

- A popup is triggered every time the user enters or switches to a page.
- After a route change occurs, it is displayed once within a random interval of 3 to 10 seconds.
- Once closed by the user, it will not be triggered again for the current visit to this specific page.
- Upon entering the page again or switching to a new page, it will be displayed again within a random interval of 3 to 10 seconds.
- If the project does not utilize routing, it is displayed once per page load.

3. danger Level:

- Every time the user enters or switches to a page, the "danger" popup cycle is initiated.
- After entering or switching pages, it is displayed once within a random interval of 3 to 10 seconds.
- Once closed by the user, it is displayed again within the next random interval of 3 to 10 seconds.
- The cycle of continuous reminders persists as long as the current state corresponds to the "danger" popup configuration *and* the status is not set to suspended.
- If a route change occurs, the previous timer must be cleared, and the process restarted based on the new page.
- If the component is unmounted, the timer must be cleared.
- If the status changes to suspended, the standard popup cycle is halted and replaced by the "suspended" pause page.

X. Requirements for Implementing the Popup Timer

Please encapsulate the popup scheduling logic; avoid scattering setTimeout calls across multiple pages.

Suggested additions:

src/utils/licensePopup.ts

Alternatively, encapsulate this within the license store:

- scheduleLicensePopup()
- clearLicensePopupTimers()
- showLicensePopup()

Requirements:

1. Random time function:
randomDelay(3000, 10000)
2. All setTimeout calls must store their respective timer IDs.
3. Clear any existing "warning" or "danger" timers when routing changes occur.
4. Schedule the next timer only *after* a "danger" popup has been closed.
5. Clear timers when the component unmounts.
6. Prevent the creation of multiple concurrent "danger" timer loops.
7. For "info" level popups, use sessionStorage to prevent repeated display within the same session.

XI. Requirements for Remote Variables

For this iteration, you are only to store the variables; do *not* use these variables to modify the actual business pages.

Specific Requirements:

1. Save data.variables to the global state.
2. Do not replace page titles.
3. Do not replace phone numbers.
4. Do not replace announcements/notices.
5. Do not replace buttons.
6. Do not replace page copy/text content.
7. Do not modify payment logic.
8. Do not modify login logic.
9. Do not modify order processing logic.
10. Do not modify any core business workflows.
11. Do not dynamically execute any code based on the variables.

You may provide the following within the store:

- variables
- getVariable(key: string)
- hasVariable(key: string)

However, do not call these methods within the business pages unless there is a specific, explicitly defined requirement within the project.

XII. Requirements for Derived State Values

Please provide derived state values within the store that are convenient for subsequent use; for example:

isActive:
status === 'active'

isGrace:
status === 'grace'

isExpired:
status === 'expired'

isSuspended:
status === 'suspended'

canRenderApp:
status !== 'suspended'

statusText:
- active: Normal
- grace: Grace Period
- expired: Expired
- suspended: Suspended
- unknown: Unknown

displayMessage:
- Prioritize message
- Secondarily use popup.content
- Finally, use the default prompt

XIII. Caching Requirements

When implementing caching, the following rules must be observed:

1. Caching serves solely as a short-term fallback mechanism.
2. The recommended cache duration is 1 to 5 minutes.
3. An API request should still be initiated every time the application launches.
4. Do not cache expired or suspended states for extended periods.
5. If a network failure occurs, only short-term cache data may be used; if no cache data is available, the original webpage should be rendered normally, and an error logged via console.error.
6. If the cache explicitly indicates a suspended status, the "Suspended" page should be displayed; however, the cache duration for this specific state must be very brief to avoid indefinitely blocking access.

XIV. Error Handling Requirements

In the event of any of the following scenarios:

- Backend service is not running
- Network disconnection
- Request timeout
- CORS errors
- JSON parsing failure
- success=false
- Non-2xx HTTP status codes
- Response structure does not match expectations

Handling Procedure:

1. Log errors exclusively via console.error or console.warn.
2. Do not display error prompts to end-users.
3. Do not trigger modal windows or pop-ups.
4. Do not result in a "blank screen" (page failing to render).
5. Do not disrupt the functionality of the original webpage.
6. Ensure the original project continues to render normally.
7. Record the error status to facilitate debugging for developers.

XV. Routing Transition Handling

If the project utilizes front-end routing, please implement the pop-up display rules within the router's afterEach hook or within the global layout component.

Requirements:

1. info:
- Do not display repeatedly upon routing transitions.
2. warning:
- Display once, at a random interval between 3 and 10 seconds, after each routing transition.
3. danger:
- Initiate a recurring loop (periodic display) after each routing transition.
- Clear the old loop when the route changes.
- Restart the loop for the new page.
4. suspended:
- Directly display the "suspended" pause page; do not execute the standard route-based popup logic.

If the project does not utilize front-end routing:

1. info: Once per session.
2. warning: Once after the page loads.
3. danger: Start a loop after the page loads.

XVI. Self-Testing Requirements

Upon completion, please self-test at least the following scenarios:

1. active + popup.enabled=false:
- Render the original webpage normally.
- Do not display a popup.
- variables are saved to the state.

2. active + popup.level=info:
- Render the original webpage normally.
- Display a popup once, at a random interval between 3 and 10 seconds.
- Do not display the popup repeatedly within the same session.

3. grace + popup.level=warning:
- Render the original webpage normally.
- Display a popup once--at a random interval between 3 and 10 seconds--every time the page is entered or the route changes.

4. expired + popup.level=danger:
- Render the original webpage normally.
- Display a popup at a random interval between 3 and 10 seconds after entering the page.
- After closing the popup, display it again at the next random interval (3 to 10 seconds).
- Clear the old timer and restart the process when the route changes.

5. suspended:
- Do not render the original webpage content.
- Display only the "Authorization Suspended" page.
- The business functionalities of the original webpage are unavailable.

6. success=false:
- Output an error to the console.
- Do not display a popup.
- Do not display any user-facing notifications.
- Render the original webpage normally.

7. Network Failure / Request Timeout / CORS Error:
- Output an error to the console.
- Do not display a popup.
- Do not display any user-facing notifications.
- Render the original webpage normally.

8. variables:
- Are saved to the state.
- Are not automatically used to modify the business page content.

XVII. Final Deliverables

Upon completion, please provide the following:

1. Which files were added?
2. Which files were modified?
3. Where is the entry point for the authorization configuration request located?
4. Where is the authorization status store or module located?
5. Where are the variables stored?
6. Do any business-specific pages utilize variables? By default, their use is discouraged in this implementation.
7. Where is the "suspended" (pause) page located?
8. Where is the logic for managing and scheduling pop-up windows?
9. How does one modify the request URL and the publicKey?
10. How can one test the various status scenarios: active, grace, expired, suspended, success=false, and network failure?
11. Have all timers been properly cleared during route transitions and component unmounting?
12. If you determine that the current project structure is unsuitable for this integration, please outline the minimal set of modifications required to make it compatible.

Please proceed directly to implementation; do not request further clarifications regarding requirements. Priority must be given to ensuring that the integration is stable, transparent, and maintainable. With the sole exception of the explicit status=suspended state, no other error conditions--of any kind--are permitted to disrupt the normal operation of the original project.`
}
