# 全站审计整改、双主题统一与网页版 GPT / Image 2 自动视觉工作流实施方案

- 日期：2026-08-11
- 状态：已实施并通过自动验收；外部设备与新一轮 Image 2 生成补验项已记录
- 基线：2026-08-11 阶段一全站审计
- 实施原则：业务安全优先、视觉参考先行、真实 DOM 落地、逐批验收、可回滚

## 1. 目标

在不扩大 v0.1 产品范围、不接入真实支付或未经批准的外部业务服务的前提下，完成以下目标：

1. 修复审计发现的 P0 数据完整性和业务闭环问题。
2. 统一公众前台、账户、3D 展项、内容后台和运营后台的浅色/深色视觉语言。
3. 收敛颜色、字体、玻璃、间距、圆角、阴影、控件状态和动效，停止继续堆叠页面级 CSS 补丁。
4. 以网页版 GPT / Image 2 自动生成的高质量效果图、组件状态板和环境素材作为每批视觉改造的前置输入。
5. 图片只负责视觉参考或无文字环境素材；按钮、卡片、表单、导航、状态和业务文字仍由 Vue DOM、CSS Token 与可访问语义实现。
6. 建立可重复的调试、自动生成、素材筛选、实现、测试、浏览器回归和文档闭环。

## 2. 关联需求与需要重新打开的状态

关联 `F-01` 至 `F-14`、`A-01`、`A-02`、`N-01` 至 `N-06`。

实施开始时，不继续沿用“全站已完成”的笼统结论。下列需求必须暂时调整为“开发中”或“待验收”，直至新验收证据通过：

- `F-01`：探索页真实分页。
- `F-04`：后台内容编辑不得破坏档案字段。
- `F-06`：我的预约、取消预约、同一用户同一场次唯一性。
- `F-09` / `F-10`：购物车竞态、我的订单和支付恢复。
- `F-12`：核心页面和共享控件完整中英文。
- `F-13`：后台统计必须使用真实数据，不显示伪趋势。
- `F-14`：双主题 Token、玻璃和 3D 运行时主题响应。
- `N-01` / `N-02`：后台路由体验、数据隔离和重复提交防护。
- `N-03`：语义、44px 触控、焦点、状态和全断点回归。
- `N-06`：补齐预约、账户、商城和后台视图测试。

## 3. 范围边界

### 3.1 本轮包含

- 13 条现有路由及共享导航、底部导航、弹层、卡片、按钮、搜索、表单和状态组件。
- 预约、订单、模拟支付、后台内容和商品管理的真实业务闭环。
- 浅色“日间月白展厅”和深色“夜间深墨展厅”的同构设计系统。
- Three.js 外层 UI、运行时主题/设备/减少动态响应、资源清理和性能门禁。
- 网页版 GPT / Image 2 的自动视觉参考与素材生成流程。

### 3.2 本轮不包含

- 真实支付、短信、第三方登录、云 CMS 或新增大型前端框架。
- 把生成的效果图直接铺成页面，或把按钮、输入框、文字做成位图。
- 为追求视觉效果改变 API、权限边界、订单金额、库存、预约名额或 3D 状态机语义。
- 无关依赖升级、全仓库格式化、历史重写或处理既有脏工作区。

## 4. 完成定义

只有同时满足以下条件，才可宣告本轮完成：

1. 5 个 P0 全部有回归测试，浏览器真实流程通过。
2. 用户可以查看/取消自己的预约，并查看/恢复自己的订单支付。
3. 同一用户无法创建两个相同场次的有效预约，并发请求也不能突破。
4. 后台修改标题等字段不会清空未编辑元数据，跨内容类型不会误更新实体。
5. 13 条路由在浅色和深色下属于同一设计系统，不再依赖大量末端覆盖修补。
6. `320 / 375 / 414 / 768 / 1440px` 无关键横向溢出、文字遮挡或不可达操作。
7. 键盘、减少动态、减少透明度、高对比度和强制颜色模式均有可用降级。
8. 前端测试、类型检查、生产构建、后端测试、Docker health 和核心浏览器 UAT 全部通过。
9. 所有采用的 Image 2 素材均可追溯、已压缩、无文字、无 UI、无水印，且不覆盖旧资产。

## 5. 总体实施路线

```text
W0 冻结基线与建立失败测试
  -> W1 P0 数据安全与业务闭环
  -> W2 双主题设计系统地基
  -> W3 公众内容与 3D
  -> W4 预约、商城与账户
  -> W5 内容/运营后台
  -> W6 Image 2 驱动的页面级视觉精修
  -> W7 全链路验收、文档与发布准备
```

每一波都执行同一闭环：

```text
复现问题 -> 写失败测试 -> 生成视觉参考 -> 评审参考 -> 小范围实现
-> 自动检查 -> 真实浏览器回归 -> 更新文档 -> 审查 diff -> 等待确认
```

业务 P0 不等待视觉图；先用测试锁住安全修复。涉及页面呈现的部分，再进入 Image 2 参考与视觉实现。

## 6. 网页版 GPT / Image 2 自动视觉工作流

### 6.1 运行方式

实施时由 Codex 连接可用浏览器中的网页版 ChatGPT，优先复用用户已登录的会话：

1. 打开 `https://chatgpt.com/` 的专用河洛视觉会话。
2. 上传当前真实页面截图、全局风格母版和本批次约束图。
3. 自动输入结构化提示词并触发生成。
4. 等待图片完成，下载原始图片。
5. 校验文件存在、尺寸、格式和 SHA-256。
6. 使用视觉审查量表自动筛选；不合格则根据具体问题追加纠偏提示词。
7. 将接受稿登记到 manifest，再进入真实 DOM 原型和生产实现。

如果登录失效、出现验证码或浏览器连接不可用，则保留已经生成的提示词和输入包，只请求用户完成一次登录/连接，不改用未知第三方服务，不声称已经生成。

### 6.2 三类图片，使用边界不同

| 类型 | 用途 | 是否进入生产包 |
|---|---|---|
| 页面效果图 | 页面结构、层级、光影、密度与双主题参考 | 否 |
| 组件状态板 | 按钮、卡片、表单、Bottom Sheet、后台记录、3D 工具状态参考 | 否 |
| 环境/纹理素材 | 无文字展厅背景、卡片媒体舞台、低对比纹理 | 通过门禁后可进入 |

禁止把效果图中的按钮、表格、中文文字或状态标签切图后用于生产。

### 6.3 批次与生成数量

不盲目重生成已有 40 条 Image 2 记录。先复核
`docs/design/image2/2026-08-10/manifest.generated.json` 中的接受稿，只重做已过时、被审计否决或缺少状态的部分。

建议新增批次：

1. **全局双主题校准板**：日间/月白、夜间/深墨，各含桌面与移动，共 4 组。
2. **共享组件状态板**：按钮、卡片、搜索/筛选、表单、Bottom Sheet、状态反馈、后台记录、3D 工具，共 8 组。
3. **页面族参考**：公众内容、详情阅读、3D、预约、商城、账户、后台，共 7 组；每组至少覆盖浅/深和桌面/移动。
4. **生产环境素材**：只在真实素材存在缺口时生成，每个目标 2 个候选，不为已有合格素材重复生成。

每个关键目标默认生成 A/B 两稿；全局母版、主卡片系统和生产环境素材属于用户确认门。其余局部参考可按量表自动择优。

### 6.4 输入包

每次生成必须包含：

- 当前生产实页截图，不使用脱离真实 DOM 的空白线框。
- 已锁定的首页浅色/深色母版。
- `design.md` 的颜色、玻璃、字体、间距、动效和响应式摘要。
- 本页面真实字段、按钮数量、错误/空/加载/成功状态清单。
- 明确的禁止项：浏览器外壳、水印、位图文字、紫蓝渐变、宫廷红金、超大圆角、等宽卡片墙、大面积青绿、虚构功能。

### 6.5 提示词骨架

```text
角色：高级数字博物馆产品设计总监。
任务：基于上传的真实页面截图和河洛母版，生成 [页面/组件] 的 [浅色/深色] 高保真参考。
必须保留：真实信息架构、字段、动作、路由和状态。
视觉：日间月白 / 夜间深墨、暖象牙正文、低面积古铜重点、低彩度青玉语义状态。
组件：44px 控件、6-8px 圆角、细边框、四层深度、单层玻璃边界。
状态：default / hover / focus / active / disabled / loading / error / success。
响应式：目标视口 [宽 x 高]，无横向溢出，移动操作在拇指可达区。
禁止：新增业务、位图文字、浏览器外壳、水印、营销落地页、大面积绿色、纯黑平面、胶囊泛滥。
输出：只生成一张高保真图片，不输出解释。
```

### 6.6 自动审查量表

每张图按 6 项各 0-5 分评分：

1. 河洛品牌一致性。
2. 浅深主题层级与色彩克制。
3. 真实业务结构忠实度。
4. 文字/控件可读性和状态完整度。
5. 桌面/移动响应式合理性。
6. 工程可实现性。

接受门槛：总分不低于 `26/30`，且不存在硬否决项。

硬否决项包括：

- 改变真实业务结构或虚构功能。
- 大面积青绿、紫蓝渐变、宫廷红金或纯黑无层次。
- 把正文、按钮文字或统计数据做进生产素材。
- 控件不可识别、焦点不可见、文字与背景明显低对比。
- 生成浏览器边框、滚动条、水印、错乱中文或不可能实现的空间结构。

### 6.7 归档与生产素材规则

```text
artifacts/sitewide-remediation/image2/
  inputs/
  raw/
  rejected/
  accepted/
  screenshots/

docs/design/image2/2026-08-11/
  RUNBOOK.md
  prompts.md
  manifest.json

frontend/public/media/editorial/
  heluo-<surface>-<theme>-image2-v<version>.webp
```

- `artifacts/` 保存原始生成图和浏览器下载文件，不提交 Git。
- `docs/design/...` 只保存提示词、尺寸、哈希、输入映射、会话地址、审查结果和用途。
- 生产目录只保存最终采用并压缩后的 WebP，不覆盖已有资产。
- 推荐目标：页面环境图不超过 250KB，卡片舞台不超过 160KB；实际门槛以视觉质量和性能测试共同决定。
- manifest 至少记录：`id`、`kind`、`status`、`route/component`、`theme`、`viewport`、`prompt`、`inputs`、`generatedAt`、`conversationUrl`、`sourceDimensions`、`sha256`、`review`、`productionFile`。

## 7. W0：基线、问题复现和测试护栏

### 7.1 工作项

1. 记录当前 Git 状态，不覆盖现有 39 个修改文件和 53 个未跟踪项。
2. 保存 13 路由、双主题和核心断点截图基线。
3. 为 5 个 P0 分别建立可失败的测试或接口复现脚本。
4. 把受影响需求从“已完成”调整为“开发中/待验收”。
5. 建立 `docs/design/image2/2026-08-11/` 运行手册与 manifest。
6. 将本轮工作拆成独立分支或经用户确认后的窄批次，不夹带既有无关改动。

### 7.2 验收

- 每个 P0 都能在修复前稳定复现。
- 基线截图、API 响应、浏览器控制台和测试结果可追溯。
- 尚未修复的问题不得再显示为“已完成”。

## 8. W1：P0 数据安全与业务闭环

### 8.1 防止重复有效预约

影响：

- `backend/src/main/java/com/heluo/museum/appointment/AppointmentController.java`
- `backend/src/main/resources/db/migration/V21__guard_and_idempotent_appointments.sql`（建议名称，实施前核对下一个迁移号）
- `backend/src/test/java/com/heluo/museum/appointment/...`
- `frontend/src/views/AppointmentView.vue`

实施细节：

1. 创建预约事务先锁定目标 `appointment_slots` 行。
2. 客户端为一次预约意图生成 `Idempotency-Key`；网络失败重试复用原 key，用户明确开始新预约时才生成新 key。
3. 后端按 `(user_id, creation_idempotency_key)` 查询；同 key 已成功时返回原预约，不重复占名额。
4. 在增加 `reserved_people` 前检查同一 `user_id + slot_id` 是否已有 `PENDING/CONFIRMED`。
5. 数据库同时增加两层保护：`creation_idempotency_key` 唯一索引，以及只在有效状态返回 `user_id` 的 generated column，再对 `(slot_id, active_user_id)` 建唯一索引。
6. 迁移前先扫描历史重复数据；发现重复时阻止自动删除并输出待处理清单。
7. 幂等命中返回原资源；不同 key 的有效预约冲突返回稳定业务码 `DUPLICATE_ACTIVE_APPOINTMENT` 和 HTTP `409`，不能泄露 SQL 细节。
8. 前端成功后锁定已预约场次，并提供“查看我的预约”，而不是立即允许重复提交。

测试：同 key 并发、不同 key 同用户同场次并发、顺序双击、取消后重新预约、容量不足、不同用户同一场次、同一用户不同场次；所有用例都核对 `reserved_people` 只增加正确次数。

### 8.2 后台内容更新不得清空元数据

影响：

- `frontend/src/views/AdminContentView.vue`
- `backend/src/main/java/com/heluo/museum/content/AdminContentController.java`
- 对应前后端测试

实施细节：

1. 文物表单和文章表单使用不同类型、不同默认值、不同 `editingId`。
2. 进入编辑时完整回填服务器字段；切换 tab、取消、保存成功后统一重置。
3. PATCH 明确区分“未提供字段”和“用户主动清空字段”，禁止把隐藏字段固定提交为空字符串。
4. 后端仅更新请求明确携带的字段；对不允许清空的档案字段执行校验。
5. 测试“只改标题”后年代、材质、尺寸、典藏地、登记号和封面哈希保持不变。
6. 测试文物 ID 与文章 ID 相同时切换 tab，不会调用错误端点。

### 8.3 隔离商品创建与编辑状态

影响：`frontend/src/views/AdminOperationsView.vue` 及对应测试。

实施细节：

- 使用 `createProductForm` 与 `editProductForm` 两套状态。
- 编辑弹层只绑定编辑副本；取消直接丢弃副本。
- 创建成功才重置创建表单；请求失败保留用户输入。
- 保存期间禁用提交、取消和重复操作；同一记录只允许一个在途请求。

### 8.4 我的预约与我的订单

影响：

- `frontend/src/views/ProfileView.vue`
- 建议新增 `frontend/src/components/ProfileAppointments.vue`
- 建议新增 `frontend/src/components/ProfileOrders.vue`
- 现有 `/api/v1/appointments/me`、`/api/v1/orders` 与模拟支付接口

实施细节：

- 个人中心增加“预约记录 / 订单记录 / 个人资料”任务分区。
- 支持分页、状态筛选、加载、空、错误、重试和详情。
- 预约只在服务端允许的时间和状态显示取消入口，取消前确认，成功后刷新名额和列表。
- 待支付订单提供继续支付；支付成功、已取消、已过期显示下一步。
- 不把 token、用户 ID 或越权资源暴露到 URL/错误信息。

## 9. W2：双主题设计系统地基

### 9.1 CSS 和 Token 收敛

建议渐进新增：

- `frontend/src/assets/tokens.css`
- `frontend/src/assets/base.css`
- `frontend/src/assets/glass.css`
- `frontend/src/assets/main.css` 保留页面布局，但逐批迁移被触达规则

实施细节：

1. 把颜色、字体、间距、圆角、阴影、模糊和动效全部转为命名 Token。
2. 四套分散的 `html[data-theme="dark"]` 逐批收敛为一套主题入口。
3. 所有玻璃只通过 `data-glass="light|dark|compact"`；页面不得自行声明新的模糊、边框和阴影组合。
4. 删除被新 Token 完全替代的 `!important` 和重复选择器，禁止继续在文件末尾堆叠覆盖。
5. 增加 `Noto Sans SC Variable` 本地依赖并在 `main.ts` 明确导入，Display/Body/Data 字体与 `design.md` 一致。
6. 保证深色四层：全局画布、次级画布、内容表面、浮起控件；浅色保持相同结构而非简单反相。

### 9.2 共享组件合同

覆盖：

- `FluidButton.vue`
- `AdminActionButton.vue`
- `BottomSheet.vue`
- `EditorialCard.vue`
- `MuseumSearchField.vue`
- 主题切换、语言切换、导航和状态组件

每个组件必须具备：default、hover、focus-visible、active、disabled、loading、error/success（适用时）；最小触控区域 44px；边框状态切换不引发布局跳动。

### 9.3 语义和动效

- `App.vue` 保留全站唯一 `<main>`；页面视图改用 `section/article/div` 和正确标题层级。
- Bottom Sheet 使用完整焦点循环、Escape、焦点恢复、背景不可交互和本地化 aria-label。
- Motion-V、GSAP 和 CSS 动画统一接入减少动态门禁；reduce 模式取消位移和连续动画，最长 150ms。
- 阅读进度使用 transform 或 CSS 自定义属性，避免频繁触发布局。

## 10. W3：公众内容与 3D

### 10.1 探索与详情

- `/explore` 接入真实页码、总数、上一页/下一页和筛选后回到第一页。
- 文物/文章详情为每次请求增加 request id 或 AbortController，旧响应不得覆盖新路由。
- 核心共享控件、详情字段和错误状态补齐中英文。
- 动态编号、来源馆藏、时期和展项事实全部来自 API，不再硬编码 `EXHIBIT 06`、固定 Cleveland 等文本。
- 第一张首屏关键图片根据真实 LCP 策略选择 eager/fetchpriority，其余继续 lazy。

动态展项元数据不能继续使用 slug 特例。若当前 API 缺少字段，则新增下一版 Flyway 迁移和结构化 DTO，建议字段包括：`displayNo`、`sourceCredit`、`sourceUrl`、`licenseLabel`、`collectionLocation`。后台展项表单同步维护；公共 API 不返回本地源文件路径。字段缺失时隐藏整行，不显示虚假馆名或伪造编号。

### 10.2 Three.js

影响：`frontend/src/components/ThreeExhibitViewer.vue`、`frontend/src/views/ExhibitDetailView.vue`。

- 监听主题、减少动态和设备能力变化；只更新必要的雾色、材质和质量配置，不重建整个场景。
- 初始化任一步失败都进入同一清理路径；释放 renderer、geometry、material、texture、observer、RAF 和事件监听。
- 视角控制增加 `aria-pressed` 或明确状态，移动端提供可见 H1。
- 保持相机过渡可中断、点云/实体往返和低帧率降级。
- 继续保持 Three.js 动态分包；不把 Three 主包并入首屏入口。

## 11. W4：预约、商城与账户细节

### 11.1 预约

- 按接口返回的真实 14 天日期渲染，不从首个时段推导固定 7 天。
- 加载失败与“暂无场次”互斥，错误态提供重试。
- 初始未选择场次时进度保持第一步，不因自动选中首项提前进入第二步。
- 提交按钮防重复、显示 pending；成功页提供预约编号和记录入口。

### 11.2 商城与支付

- 加购、增减数量、删除按购物车项建立 pending 锁，旧响应不得覆盖新状态。
- 创建订单后先持久化订单恢复信息，再清理购物车视觉状态。
- 4xx/网络错误按可恢复性分类；不得无条件清除 pending key。
- 商品文化描述在卡片或详情中可发现，不能长期通过 CSS 隐藏。
- 桌面与移动两个购物车实例使用唯一 input id。
- 将 `GET /orders` 与文档对齐为 `ContentPage`，支持 `page/size/status`、稳定倒序和状态白名单；前端订单台账不能依赖 localStorage 才能发现订单。
- 抽取共享 checkout recovery 状态机供商城和个人中心复用：`creating-order -> order-created -> paying -> reconciling -> paid/pending/cancelled/error`。支付异常后先查询服务端订单状态，再决定是否清除恢复 key。

### 11.3 登录、重置密码和个人资料

- 登录使用经过校验的内部 `returnTo`；拒绝绝对 URL，避免开放重定向。
- 重置页无 token 时显示明确无效状态，不伪装成登录页；成功后 `router.replace` 清除 URL token。
- token 不作为可编辑普通文本展示。
- 个人资料保存增加 loading、disabled、防重复提交；新请求开始时清除旧 success。
- 忘记密码生产文案不暴露 Mailpit 等开发工具。

## 12. W5：内容后台与运营后台

### 12.1 操作状态模型

- 将通用 `action()` 改为返回明确的成功/失败结果；只有成功才关表单、清输入、刷新列表。
- 高风险操作增加共享确认弹层、记录级 pending 和防重复提交。
- 操作日志显示人类可读动作、目标、操作者和时间，原始 code 只作为次级信息。
- 建议新增 `frontend/src/composables/useAdminMutation.ts`，以 `模块:实体:ID:动作` 为 key 管理 pending、成功和错误，阻止同一动作重复提交但不锁死无关记录。
- 建议新增共享 `AdminConfirmDialog.vue`；删除、撤回、禁用用户、取消预约、完成订单和丢弃未保存编辑必须明确说明对象、后果和是否可恢复，并满足焦点陷阱、Escape、关闭回焦和 pending 不可重复确认。

### 12.2 列表与统计

- 所有后台列表改为服务端分页，默认每页 20；支持搜索、状态筛选、清除筛选和真实总数。
- 错误、加载、空、正常四态互斥；错误态必须有重试。
- 移除前端伪更新时间、伪趋势和不可点击的“查看详情”；趋势无后端数据时显示真实数值和“暂无趋势数据”。
- 若现有统计 API 缺字段，先设计接口和测试，再扩展后端，不在前端编造。

### 12.3 权限与工作区

- 路由 meta 标记 `requiresAuth/role`，统一守卫；普通用户进入后台得到明确无权限页或返回前台，不循环跳登录。
- 后台侧栏展示当前管理员身份、退出和返回前台入口；移动端不隐藏关键出口。
- 后端 `/admin/**` 的 `ADMIN` 校验继续作为唯一可信边界。

## 13. W6：Image 2 驱动的页面级精修

按页面族逐批执行“参考图 -> 真实 DOM 原型 -> 双主题实现”：

| 页面族 | 深色重点 | 浅色重点 |
|---|---|---|
| 首页/探索 | 夜间馆廊、媒体边缘融合、低面积古铜 | 月白纸面、墨色层级、克制青玉 |
| 详情阅读 | 长文舒适度、事实条和媒体舞台 | 纸张层级、行长、章节节奏 |
| 3D | Canvas 与 HUD 融合、工具可读性 | 不刺眼的展厅雾色与高对比控制 |
| 预约 | 深墨任务台、步骤和摘要 | 表单清晰、日期/场次可扫描 |
| 商城 | 商品真实材质、购物袋层级 | 非电商模板化的策展陈列 |
| 账户 | 安静可信、错误恢复突出 | 输入和帮助文字清楚 |
| 后台 | 石墨紧凑工作台、状态语义 | 月白表面、密度和扫描效率 |

每一族先完成共享组件，再迁移页面；禁止每页发明独立按钮、卡片或玻璃。

## 14. 测试与验收矩阵

### 14.1 自动检查

前端：

```powershell
cd C:\Users\Jie\Documents\博物馆\frontend
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm qa:pointer-pages
corepack pnpm perf:pointer-size
corepack pnpm perf:pointer
```

后端：

```powershell
cd C:\Users\Jie\Documents\博物馆\backend
mvn test
```

仓库：

```powershell
cd C:\Users\Jie\Documents\博物馆
git diff --check
```

### 14.2 必须新增的测试

- 后端：重复预约并发、取消后重新预约、名额一致性、后台 PATCH 字段保留、订单权限与模拟支付幂等。
- 前端：Appointment、Login、Profile、AdminContent、AdminOperations 视图级测试。
- 共享：BottomSheet 焦点循环和本地化、按钮 loading/disabled、主题 Token、44px 控件、单一 main landmark。
- 竞态：快速切换详情路由、购物车连续增减、快速切换后台 tab。
- 状态：加载、空、错误、重试、成功、权限不足和过期支付。

### 14.3 浏览器 UAT

角色：游客、普通用户、管理员。

主题：浅色、深色、主题刷新持久化。

视口：`320x568`、`375x812`、`414x896`、`768x1024`、`1440x900`。

辅助模式：键盘、200% 缩放、减少动态、减少透明度、高对比度、强制颜色。

核心流程：

1. 搜索 -> 筛选 -> 分页 -> 详情 -> 返回。
2. 进入 3D -> 实体/点云 -> 切视角 -> 打开移动信息 -> 离开并确认资源停止。
3. 登录前发起预约 -> 登录回原任务 -> 创建 -> 查看记录 -> 取消。
4. 加购 -> 连续修改数量 -> 下单 -> 支付失败恢复 -> 支付成功 -> 查看订单。
5. 后台编辑文物标题且档案不丢失 -> 切换文章 -> 新建/编辑商品 -> 失败后保留输入。
6. 后台搜索、分页、状态变更、确认危险操作和退出。

## 15. 调试规范

所有 Bug 使用同一模板：

```text
现象 -> 最小复现 -> 预期/实际 -> 根因 -> 失败测试
-> 最小修复 -> 相关回归 -> 跨模块回归 -> 剩余风险
```

- 不用“在 main.css 末尾再补一个更高优先级”作为默认方案。
- 不把 API 错误表现成空状态。
- 不通过禁用按钮掩盖后端幂等和并发问题。
- 不只验证直接 URL；必须沿真实用户路径走通。
- 线上表现与文档冲突时，以当前代码和可复现测试为准，并同步修正文档。

### 15.1 视觉与性能硬门禁

- 新增或修改的组件颜色必须来自命名 Token；页面局部不得新增裸 `hex/rgb/oklch`。
- `!important` 总量不得增加；被触达组件的历史重复覆盖必须同步删除。
- 玻璃表面必须能追溯到 `data-glass`，不允许新的页面私有玻璃配方。
- 正文和关键控件在不透明基底上满足 WCAG AA；图片/玻璃上的文字必须在真实截图中复测。
- 所有可见主要操作计算尺寸不低于 `44x44px`，焦点环不得被 `overflow` 裁切。
- 单批首屏 JS gzip 无说明时不得增长超过 10KB；全局 CSS gzip 无说明时不得增长超过 5KB。
- Three.js 继续保持懒加载；其分包增长超过 5% 时必须说明原因并补性能数据。
- 生产环境图和纹理使用明确宽高，非首屏素材 lazy load；不能因高质量图片牺牲 LCP。

## 16. Multi-Agent 执行编排与文件所有权

复杂批次允许并行，但只并行边界清晰、文件互不重叠的工作。推荐安排：

| Wave | Agent A | Agent B | Agent C | 主 Agent |
|---|---|---|---|---|
| 1 | 预约后端、Flyway、并发测试 | 后台内容完整性与测试 | 商品表单隔离与测试 | 需求状态、接口合同、集成回归 |
| 2 | 我的预约/订单组件 | 登录、重置和 returnTo | 管理后台 mutation/确认组件 | 共享类型、路由与真实流程 |
| 3 | Explore 分页与详情竞态 | 展项 metadata 后端/API | 3D 测试和性能基线 | 统一集成与文档 |
| 4 | 公众页面迁移 | 账户/商城页面迁移 | 后台页面迁移 | 唯一编辑主题 Token/玻璃入口 |
| 5 | 自动化测试补齐 | 浏览器 UAT 数据准备 | Image 2 素材归档审查 | 全量门禁、diff 和最终报告 |

文件所有权硬规则：

- `frontend/src/assets/main.css`、主题 Token 入口：同一时刻只由主 Agent 编辑。
- `ThreeExhibitViewer.vue`：同一时刻只允许一个 3D Agent 编辑。
- `AdminOperationsView.vue`：展项 metadata 与运营后台整改不能并行改同一文件，必须串行合并。
- `router/index.ts`、`PROJECT_STATUS.md`、需求追踪表：由主 Agent统一集成。
- Agent 不得重置或回退其他 Agent 的改动；发现冲突先上报，再调整实现。

每个 Agent 的独立验收输出必须包含：修改文件、失败测试到通过的证据、未验证项和风险。主 Agent 不以“Agent 已完成”代替全量集成验证。

## 17. Git、提交与回滚

建议按以下原子批次提交，均需用户确认后执行：

1. `fix(appointment): prevent duplicate active reservations`
2. `fix(admin): preserve content metadata and isolate forms`
3. `feat(profile): add appointment and order history`
4. `refactor(ui): consolidate theme and glass tokens`
5. `fix(a11y): restore landmarks focus and motion preferences`
6. `fix(content): add pagination and route request guards`
7. `fix(store): stabilize cart and payment recovery`
8. `feat(admin): add real pagination filters and action states`
9. `feat(ui): apply approved image2 visual references`
10. `test(uat): add full-site regression gates`

每批只包含本批相关文件；生产素材使用版本化名称，回滚代码时旧素材仍可恢复，不覆盖源文件。

## 18. 主要风险与控制

| 风险 | 控制措施 |
|---|---|
| 网页版 ChatGPT 会话过期或 UI 改版 | 保存提示词与输入包；失败后只要求重新登录，不跳过追溯 |
| Image 2 产生漂亮但不可实现的图 | 工程可实现性评分；真实 DOM 原型通过后才落地 |
| 生成图中文错误 | 图片不承载生产文字，真实文案由 Vue 渲染 |
| CSS 收敛造成全站回归 | 按组件族迁移，保留前后截图和主题契约测试 |
| 数据库迁移遇到历史重复预约 | 先审计数据并阻断，不自动删除真实记录 |
| 并发问题只靠前端按钮规避 | 后端事务和数据库约束作为最终边界 |
| 后台视觉美化降低效率 | 后台坚持紧凑、任务优先，不套用首页海报结构 |
| 当前工作区存在大量既有改动 | 每批先核对 status/diff，不重置、不覆盖、不夹带 |

## 19. 推荐执行批次与确认点

1. **批次 A：P0 安全修复计划确认**——不等图片，先建立失败测试与数据保护。
2. **批次 B：全局双主题与组件 Image 2 校准**——确认一套母版和共享组件状态板。
3. **批次 C：用户业务闭环**——预约/订单/支付恢复及对应视觉。
4. **批次 D：公众内容与 3D**——分页、竞态、动态数据、主题与性能。
5. **批次 E：后台产品化**——安全表单、分页筛选、真实指标与紧凑视觉。
6. **批次 F：全站验收**——三角色、双主题、五断点、辅助模式与 Docker。

建议只设置两个全局视觉确认门：

- 确认门 1：浅色/深色母版和共享组件状态板。
- 确认门 2：所有准备进入生产的环境素材。

其余同体系的局部页面由自动量表筛选并实施，减少频繁打断。

### 19.1 相对工作量

| 批次 | 工作量 | 说明 |
|---|---|---|
| A P0 安全 | L | 涉及事务、迁移、接口与前后端回归，不能压缩 |
| B 主题地基 | L | CSS 级联风险最高，必须逐组件迁移 |
| C 用户闭环 | L | 我的预约/订单、支付恢复和状态设计 |
| D 公众/3D | L | 分页、竞态、metadata、GPU 生命周期 |
| E 后台 | L | 表单状态、分页筛选、真实指标与权限 |
| F 总验收 | M | 三角色、双主题、五断点和辅助模式 |

单人串行可按约 12-18 个有效开发日规划；Multi-Agent 只能缩短互不重叠的实现时间，不能省略数据库迁移、CSS 集成和真实业务 UAT 的串行门禁。

## 20. 本方案验收标准

- 覆盖审计中的 P0、主要 P1/P2、设计系统、业务闭环、3D、后台、测试和发布。
- 网页版 GPT / Image 2 自动调用有明确输入、步骤、失败处理、评分、归档和生产边界。
- 每一波都有具体文件、实现细节、测试和可观察验收标准。
- 方案确认前不修改业务代码；实施时每批完成后等待用户确认再提交 Git。

## 21. 2026-08-11 实施与验收记录

### 21.1 实施结果

- [x] **W0/W1 P0 数据完整性**：新增 `V21__guard_and_idempotent_appointments.sql` 与 `V22__add_structured_exhibit_metadata.sql`；预约使用幂等键、数据库唯一约束、并发名额原子更新和取消释放；后台内容 PATCH 只处理已提交字段；管理员与普通用户数据范围保持后端校验。
- [x] **W2/W3 双主题、公众内容与 3D**：新增共享 Token、基础样式、玻璃材质、Noto Sans SC 与主题契约；探索页、详情页、展项元数据、3D 运行时主题/设备/减少动态策略和实际分页接口完成收口。
- [x] **W4 用户闭环**：增加个人预约/订单记录；预约取消、订单查询、购物车竞态、下单幂等和模拟支付恢复入口均已接入真实页面与接口。
- [x] **W5 后台**：内容、用户、预约、商品、订单、展项和操作日志使用服务器分页/筛选；创建与编辑表单隔离；失败时保留输入；危险操作有确认层并锁定重复提交。
- [x] **W6 Image 2 工程边界**：完成 `docs/design/image2/2026-08-11/` 的提示词、运行手册和 manifest；本批未伪称已连接外部 Image 2，新生成批次保持 `prompt-ready`，仅复用可追溯的既有接受稿，不覆盖旧资产。
- [x] **W7 文档与回归**：本节、`PROJECT_STATUS.md` 和需求追踪表已同步本次实施证据；未执行 Git 提交、推送或历史改写。

### 21.2 自动检查结果

| 检查 | 结果 |
|---|---|
| `corepack pnpm typecheck` | 通过 |
| `corepack pnpm test` | 通过，28 个测试文件 / 122 项 |
| `corepack pnpm build` | 通过，Vite 生产构建完成；仅有大 chunk 提示 |
| `corepack pnpm perf:pointer-size` | 通过，JS `17,991 B`、gzip `6,636 B` 均在预算内 |
| `corepack pnpm qa:pointer-pages` | 通过，32 组路由/视口组合；无横向溢出、裁切或阻塞点阵 |
| `corepack pnpm perf:pointer` | 通过，探索页/3D 页 CPU 1x、4x、偏好降级、200% 等效视口和后台暂停门禁通过 |
| `backend\mvn test -q` | 通过，16 项；失败、错误、跳过均为 0 |
| Docker Compose | 通过，frontend/backend/mailpit/mysql 均运行；mysql/mailpit health 为 healthy，backend 以 API health 验证 |
| HTTP 健康检查 | 通过，`http://127.0.0.1:8088/api/v1/health` 返回 200 / `UP` |
| `git diff --check` | 通过；仅有工作区 LF/CRLF 提示 |

### 21.3 真实浏览器 UAT

使用独立 Chrome CDP 会话访问 `http://127.0.0.1:8088`，最终回归通过：

1. 游客：探索馆藏搜索、分类筛选、详情进入、返回路径；分页接口返回稳定 `page=1`/`totalPages`。
2. 普通用户：注册、外部 `returnTo` 收敛到站内个人中心、提交预约、个人中心查看并二次确认取消、商城加购、模拟支付、订单记录。
3. 管理员：登录后台、编辑内容、主题深浅切换、创建普通用户、创建商品草稿、上架商品、打开危险操作确认层并取消。

### 21.4 保留的补验项

- 本机 CDP 已覆盖 320/375/414/768/1440 等效视口及减少动态、减少透明度、高对比度、强制颜色策略；真实实体手机、触控笔和系统级强制颜色仍需设备现场复验。
- 当前 Docker 测试数据的公众内容不足以显示第二页，因此浏览器实页的“下一页”按钮未被点击；分页服务、前端分页状态和后端页码测试已通过。
- 未在生产容器中人为注入一次支付网络失败；支付幂等、订单查询恢复和前端失败恢复由后端集成测试、视图测试及真实成功路径覆盖。
- 2026-08-11 新一轮网页版 GPT / Image 2 生成需要可用的外部登录会话；当前只保存可复制提示词和输入约束，manifest 不声明本批新生成图片。

### 21.5 复核后重新打开的 P0 收口（进行中）

本节优先级高于 21.1 中“完成”的表述。2026-08-11 的只读并发复核发现，以下事项尚不能以自动检查通过替代真实状态机与操作锁验证：

1. 管理员确认、取消、完成预约没有统一按“时段 → 预约”顺序加锁，可能与用户取消或并发管理操作交错，造成状态复活、名额重复释放或有效预约键被提前删除。
2. 面向公众的预约接口与创建入口没有共同强制“从今天起 14 天”的开放窗口，直接请求可绕过前台日期条。
3. 后台内容操作使用单一 pending 字符串，多条操作并发时会让较早按钮重新可点；运营后台“禁用用户”没有进入危险操作确认层。

本轮后续实现必须：为三类预约状态迁移补齐一致锁序与并发测试；在读取与创建两端统一开放窗口；把后台动作改为每个资源独立的 pending 集合并接通确认层。完成后重新运行后端并发集成测试、前端交互测试、类型检查和生产构建，再更新 `PROJECT_STATUS.md` 与需求追踪表。此前 21.1 的“P0 数据完整性/后台确认层完成”不应视为最终验收结论。

## 22. 2026-08-12 全站视觉优化最终收口

### 22.1 本轮边界与实现

本轮按已确认的全站视觉优化合同完成工程收口，覆盖实际路由 `/`、`/explore`、`/artifacts/:slug`、`/articles/:slug`、`/exhibits`、`/exhibits/:slug`、`/appointment`、`/shop`、`/login`、`/reset-password`、`/profile`、`/admin` 和 `/admin/operations`。没有因为清单要求而创建项目中不存在的页面；后台实际存在的用户、预约时段、预约、商品、订单、3D 展项和操作日志标签均按真实路由复核。

- 全局基线继续复用 OKLCH 语义令牌、`data-theme`、`data-glass`、共享 Header/Footer、按钮、搜索、卡片、表单、状态和移动底部导航；正文默认字体栈对齐已加载的 Noto Sans SC，避免中英文混排时回退不一致。
- 商城验证数据可能没有媒体字段，本轮在 `productPresentation` 增加通用的真实媒体降级；`ShopView` 对异常图片增加回退，不改变产品 API、分类、购物车或模拟支付状态。既有 `shop-object-studio.webp` 已在媒体 README 登记，本轮没有新增或伪称生成 Image 2 资产。
- 后台运营概览不再绘制与当前数据无关的硬编码迷你趋势条，改为待处理预约、库存预警和待处理订单的语义说明与状态圆点，保留原计数和业务列表。
- 公开 Explore 默认保持安静的河流/目录构图；在 `prefers-reduced-transparency: reduce` 下恢复不透明点阵显示，满足辅助模式下“保留可见的实色交互提示”契约。展厅装饰径向层使用 `overflow-x: clip` 限制在视口内；移动主题按钮隐藏视觉文字但保留按钮 `aria-label`。
- 页面映射审计仅调整了“Explore 的点阵 Canvas 虽被默认构图隐藏但仍需验证运行状态”的测试目标守卫，不放宽运行时业务门禁；所有页面文字、按钮、导航、表单和状态仍由真实 Vue/HTML/CSS/SVG 渲染。

### 22.2 参考图、素材与版本记录

- 本轮不调用网页版 GPT/Image 2，不新增效果图或生产素材；继续使用已归档的首页、Explore、3D、商城和后台参考图及既有版本化 WebP。`shop-object-studio.webp` 作为商城环境图/缺失商品媒体降级，来源、用途与“无文字、无 Logo、无 UI”边界记录在 `frontend/public/media/editorial/README.md`。
- 最终代表性真实页面截图保存在工作区外：
  - `C:\Users\Jie\.codex\visualizations\2026\08\12\heluo-sitewide-baseline\home-light-1440x900-clean.jpg`
  - `C:\Users\Jie\.codex\visualizations\2026\08\12\heluo-sitewide-baseline\home-dark-1440x900-clean.jpg`
  - 同目录中的 `explore-dark-1440x900-final.jpg`、`exhibits-dark-390x844-final.jpg`、`shop-light-390x844-final.jpg`、`admin-light-1440x900-final.jpg`、`admin-operations-dark-1440x900-final.jpg` 为代表性页面证据。

### 22.3 验证结果

| 检查 | 结果 |
|---|---|
| `corepack pnpm typecheck` | 通过 |
| `corepack pnpm test -- --reporter=dot` | 通过，28 个测试文件 / 125 项 |
| `corepack pnpm build` | 通过；Vite 生产构建完成，仅有依赖注释与 Three.js/CSS 大 chunk 警告 |
| `corepack pnpm qa:pointer-pages` | 通过，32 组路由/视口；无横向溢出、裁切控件或点阵阻塞 |
| `corepack pnpm perf:pointer-size` | 通过，JS `17,991 B`、gzip `6,636 B`；无布局属性过渡 |
| `corepack pnpm perf:pointer` | 通过，CPU 1x/4x、Three.js 点云、后台暂停、减少动态、减少透明度、高对比度、强制颜色、200% 等效视口、混合输入与触摸门禁全部通过 |
| `mvn -q test`（`backend`） | 通过；测试进程退出码 0，日志仅有 SMTP/Mockito/JDK 运行时提示 |
| Docker Compose | 通过；按 `deploy/compose.yaml` 重建并重启 frontend，backend、mysql、mailpit 保持运行，mysql/mailpit healthy |
| HTTP/API/媒体 | 通过；13 条目标路由、`/api/v1/health`、`/api/v1/products`、两张代表性 WebP、3 个 GLB 均返回 200 |
| 浏览器 DOM/视口审计 | 通过；`1440×900`/`390×844` 双主题 52 组，`1672×941`/`1920×1080`/`414×896` 39 组；`scrollWidth === clientWidth`，坏图、重定向、控制台日志均为 0 |
| 真实交互抽查 | 通过；Explore 搜索/分类、展品详情进入、3D 实体/点云切换与 Reset、预约日期/时段、商城分类、后台 7 个运营标签均沿真实页面完成，无破坏业务路由 |
| `git diff --check` | 通过；仅有既有工作区的 LF/CRLF 提示 |
| lint | 未执行；`frontend/package.json` 当前没有 `lint` script，未假造通过结果 |

### 22.4 交付边界与未验证项

- 本轮视觉优化已完成代码、共享系统、真实路由、主题、响应式、状态、资源回退与浏览器回归；Git 当前仍未提交，且保留用户工作区其他未提交改动。
- 21.5 节的预约锁序/14 天窗口/后台资源级危险操作确认仍未解决，不能在本轮视觉报告中标为完成。
- 当前证据来自 Docker 生产容器和 Chrome/CDP 等效视口；实体手机、触控笔和系统级强制颜色现场复验仍待下一次设备窗口。外部网页 Image 2 本轮没有新增调用。

## 23. 2026-08-12 Explore 双主题素材 parity 与登录反馈修复

### 23.1 需求收口与页面范围

本次增量来自真实浏览器反馈：`/explore` 在浅色/深色切换时因主题条件媒体和不同尺寸舞台发生重排，右侧玉璧卡使用了浅色背景；登录页浅色模式的输入内容对比度不足，提交按钮的按压/填充动效有突兀的跳变。实际路由审计没有发现第二个 Vue 页面在主题之间切换器物媒体源；首页的明暗环境图和文字层级是同一结构上的意图性构图差异，保留原设计，不伪造新的页面。

复核视口为桌面 `1440×900`，补充 `1672×941`、`1920×1080`；移动为 `390×844`、`414×896`。验收重点是主题切换前后 DOM 几何、图片自然尺寸、`object-fit`、主体安全边距、滚动宽度、输入可读性和按钮交互状态，而不是只比较颜色。

### 23.2 根因与实现

- `ExploreView.vue` 原先按主题选择媒体集合，深色玉璧卡引用了浅色石灰岩舞台；移动浅色地图还曾被隐藏，馆藏行高、搜索区和阅读栏也分别由浅/深主题规则决定，导致切换后页面纵向节奏变化。
- 现在以 `editorialArtifactMedia` 作为双主题唯一器物媒体映射，搜索结果也经过 `searchVisual()` 进入同一套稳定的媒体解析；五张卡均使用版本化 `1254×1254` WebP，器物图统一以 `contain` 进入暗色媒体舞台，主体不被无限 `cover` 裁切。
- `main.css` 在桌面和移动端为浅/深主题成对收敛 Explore 的标题/搜索栈、地图、筛选条、馆藏板和阅读栏：桌面地图 `290px`、筛选条 `48px`、馆藏板行 `250px + 210px`，移动地图 `224px`、馆藏卡 `340px/290px`、阅读卡 `190px`；主题只改变颜色和材质，不替换几何。
- 登录浅色控件显式设置不透明浅色表面、墨绿输入文字、插入符、自动填充文字和古铜焦点环；`FluidButton` 去掉按压时的纵向 `y` 位移，改为原位压缩，并把登录主按钮改为古铜渐变加单次斜向 sheen，减少突兀的整块填充跳变。

### 23.3 素材审查与来源台账

| 记录 | 输入/输出 | 来源与 prompt | 结果/用途 |
|---|---|---|---|
| 用户最终输入 | `C:\Users\Jie\AppData\Local\Temp\codex-clipboard-01cbebdb-abeb-43fc-92ef-f447996d000e.png`，`1254×1254` | 用户在本轮提供；不是网页 Image 2 输出，prompt 不适用 | `PASS`：玉璧、暗墨纸面、古铜环和黑石底座主体完整，无可读文字、Logo、假 UI 或水印；适合 `contain` 和 1:1 卡片舞台 |
| 生产输出 | `frontend/public/media/editorial/explore-jade-bi-dark-user-v1.webp`，`1254×1254`，约 `144,644 B` | 由用户输入转换为同尺寸 WebP；网页版 GPT/Image 2 本轮未调用，未将不可验证的网页生成写成事实 | `PASS`：Explore 玉璧高卡浅/深主题共用；不覆盖输入源 |
| 旧候选 | `explore-jade-bi-light-imagegen-v1.webp` | 2026-08-11 内置 imagegen 候选 | `REVISE/legacy`：保留历史回滚，不再接入双主题 Explore 卡，避免浅色舞台再次破坏暗色融合 |

用户后来明确要求“换成这张”，因此生产版本以用户提供的图片为准；本轮没有声称已经调用网页版 GPT/Image 2，也没有把内置候选继续留在生产引用中。素材目录说明已同步到 `frontend/public/media/editorial/README.md`。

### 23.4 浏览器证据

| 页面/视口 | 浅色 | 深色 | 结论 |
|---|---:|---:|---|
| Explore `1440×900` | head/map/filter/board = `290/290/48/474px` | `290/290/48/474px` | 通过；`scrollWidth === clientWidth === 1425`，五张器物卡源一致，图片自然尺寸均为 `1254×1254` |
| Explore `390×844` | head/map/filter/board = `568.1/224/48/1556px` | `568.1/224/48/1556px` | 通过；馆藏行 `340px + 290px×4`，阅读卡 `190px`，`scrollWidth === clientWidth === 375` |
| 登录 `1440×900` | 填写后输入文字为 `rgb(23,53,47)`，输入高 `42px`，主按钮高 `50px` | 既有深色控制面对比度保持 | 通过；按钮点击后主体 `transform: none`，只有共享原位压缩和斜向 sheen |
| 其他实际公开/受保护入口 | `/`、`/exhibits`、详情、文章、预约、商城、登录/重置密码、受保护入口均检查图片解码与宽度 | 主题切换后的媒体源未出现第二套尺寸映射 | 通过同类媒体审计；`/profile`、`/admin`、`/admin/operations` 未登录时按真实鉴权重定向登录，未伪造管理员状态 |

截图证据保存在工作区外：

- `C:\Users\Jie\.codex\visualizations\2026\08\12\heluo-explore-theme-fix\explore-light-final-1440x900.png`
- `C:\Users\Jie\.codex\visualizations\2026\08\12\heluo-explore-theme-fix\explore-dark-final-1440x900.png`
- `C:\Users\Jie\.codex\visualizations\2026\08\12\heluo-explore-theme-fix\explore-light-final-390x844.png`
- `C:\Users\Jie\.codex\visualizations\2026\08\12\heluo-explore-theme-fix\explore-dark-final-390x844.png`
- `C:\Users\Jie\.codex\visualizations\2026\08\12\heluo-explore-theme-fix\login-light-final-1440x900.png`

### 23.5 交付与风险

- 本节只修改 Explore 媒体映射/布局、共享按钮按压参数、认证字段可读性与主题契约测试；不改 API、路由、鉴权、搜索、筛选、分页、订单/预约状态或 Three.js 生命周期。
- 需继续保留 21.5 的预约锁序、14 天开放窗口和后台资源级危险操作 P0 事项为未完成；它们不属于本次视觉修复，不能因视觉回归通过而标记完成。
- 等效视口已覆盖，实体手机、触控笔和系统级强制颜色仍需设备现场复验；网页 Image 2 的外部登录会话仍不可验证，最终素材是用户提供并本地转换的版本。

### 23.6 最终复核增量（2026-08-12）

- 在最新 Docker 前端镜像中重新复核 Explore 双主题：桌面 `1440×900`、`1672×941`、`1920×1080`，移动 `390×844`、`414×896` 均保持相同的 head/map/filter/board 与阅读栏几何、图片源、`1254×1254` 自然尺寸和 `contain`；五档视口均 `scrollWidth === clientWidth`，无坏图。
- 重新覆盖实际路由 `/`、`/explore`、`/exhibits`、展品详情、3D 展项、文章详情、预约、商城、登录、重置密码及受保护的个人中心/后台入口。13 个请求入口在浅/深主题下均无横向溢出、坏图或主题条件媒体源差异；受保护入口按真实鉴权重定向到对应登录地址，未伪造管理员态。
- 登录页浅色真实填写探针：输入文字为墨绿 `rgb(23, 53, 47)`，输入高 `42px`，主按钮高 `50px`；按压时按钮主体 `transform: none`，只保留原位缩放与斜向 sheen，控制台 error/warning 为空。Explore 与登录的最终控制台 error/warning 同样为空。
- 工程与部署检查：`corepack pnpm typecheck` 通过；`corepack pnpm test -- --reporter=dot` 通过（28 个测试文件 / 126 项）；`corepack pnpm build` 通过；`corepack pnpm qa:pointer-pages`、`corepack pnpm perf:pointer-size`、`corepack pnpm perf:pointer` 全部通过；Docker 前端重建并重启成功；目标路由、API、最终玉璧 WebP 与代表性媒体 HTTP `200`；`git diff --check` 通过。
- `frontend/package.json` 没有 `lint` script，因此未执行 lint，也没有将其假报为通过；浏览器等效视口已完成，实体手机、触控笔和系统级强制颜色仍是未验证项。网页版 GPT/Image 2 本轮未调用，最终素材仍以用户提供并本地转换的版本为准。

### 23.7 控制台结果更正（2026-08-12）

- 新建浏览器会话重新打开 Explore 并切换主题后，应用级 `error` 为 `[]`；登录页 `error` 也为 `[]`。
- 浏览器额外暴露 1 条既有 WebGL 兼容性 `warning`：Three.js `WebGLProgram` 的 `X4122` 浮点精度提示，来源为构建后的 `three.module`，未伴随页面错误、坏图、布局异常或业务失败。此前会话查询为零是因为该会话没有保留这条启动期提示；以后报告按“应用 error 为 0，存在已知 Three.js warning”记录，不再写成 warning 为 0。
