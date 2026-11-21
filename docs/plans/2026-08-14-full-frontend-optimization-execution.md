# 河洛数字博物馆全站前端细节优化执行方案

- 日期：2026-08-14
- 状态：待执行，当前仅完成方案整理
- 主流程：`reference-led-frontend-polish` → `impeccable` → `hallmark` → 模块专项回归
- 设计事实来源：`design.md`、`PROJECT_STATUS.md`、`docs/01-requirements-traceability.md` 和当前可复现代码

## 1. 执行目标

在不推翻现有“河洛纸墨 / 东方编辑策展”系统的前提下，完成全站前端视觉与交互细节收口：

1. 统一浅色“日间月白展厅”和深色“夜间深墨展厅”的表面层级、文字层级、控件状态和媒体舞台。
2. 统一共享 Header、主题切换、按钮、搜索、筛选、卡片、状态、表单和移动端导航。
3. 保留各页面已经确认的构图与叙事差异，不把所有页面压成同一种卡片墙。
4. 让公众端偏策展与阅读，预约/商城/账户偏任务效率，后台偏信息密度和操作效率。
5. 通过真实路由、真实主题、真实视口和真实业务路径验证，而不是只看静态 CSS 或单元测试。

## 2. 当前基线与硬边界

### 2.1 当前基线

- Hallmark 全站视觉系统已经建立，`design.md` 是新增页面和样式的设计源文件。
- 当前路由事实为 13 个真实入口：首页、探索、文物详情、文章详情、展厅列表、3D 展项、预约、商城、登录、重置密码、个人中心、内容后台、运营后台。
- 浅色主题、Explore、3D、预约、个人中心、后台和 Product Design 审查整改已有多轮实施；后续以“查漏补缺、统一和回归”为主，不重新做一轮无差别重构。
- 当前工作区存在大量用户已有未提交修改、素材、测试和计划文件。本方案不得重置、删除、覆盖、提交或推送无关改动。
- 当前已知未闭环项包括：真实手机、触控笔、Windows 强制颜色，以及管理员真实 CRUD 闭环的现场复验。

### 2.2 不允许改变

- 不改后端 API、数据库迁移、权限边界、鉴权、角色判定和用户数据隔离。
- 不改核心路由、搜索/筛选/分页、预约锁序、名额、订单/模拟支付、幂等和状态机。
- 不改 Three.js 模型、实体/点云模式、相机交互、失败降级和资源释放生命周期。
- 不把 Image 2 效果图直接当生产页面，不把图片中的文字、按钮或 Logo 烘焙进页面。
- 不新增大型依赖；动画优先复用现有实现。

## 3. Skill 分工

| Skill | 用法 | 不负责什么 |
|---|---|---|
| `reference-led-frontend-polish` | 全站基线、截图差异矩阵、素材审查、真实路由回归和响应式验收；作为总流程 | 不替代业务测试，不把效果图当生产页面 |
| `frontend-design` | 只有当审计证明现有视觉方向不足时，重新确认字体、色板、版式和记忆点 | 不在已有 `design.md` 锁定后随意另起一套主题 |
| `impeccable` | 对单页执行 `critique`、`audit`、`polish`、`layout`、`typeset`、`colorize`、`adapt`、`harden` | 不一次性对全站追加无边界 CSS |
| `hallmark` | 检查文化辨识度、反模板化、反过度玻璃和反 AI Landing Page | 不替代可访问性、性能和业务回归 |
| `frontend-product-designer` | 内容后台、运营后台、表格、筛选、统计、记录和重复操作流程 | 不把后台做成前台的艺术化展示页 |
| `artifact-template-heluo` | 需要视觉方向时生成参考图或无文字素材，并保存输入/输出映射 | 不直接修改 Vue、CSS 或业务代码 |
| `apple-design` / `gsap-*` | 仅在确有手势、滚动、可中断面板或编排动画需求时介入 | 不为装饰效果增加动效复杂度 |

## 4. 分阶段执行

### Phase 0：安全基线与范围冻结

**目标**：先确认哪些已经完成，哪些仍有真实问题，避免重复改动或覆盖已有工作。

**步骤**：

1. 读取 `AGENTS.md`、`PROJECT_STATUS.md`、`design.md`、需求追踪和最近相关计划。
2. 记录当前分支、`git status`、前端启动方式、Docker 状态和实际前端端口。
3. 运行当前基线的类型检查、测试、构建、页面映射和体积门禁。
4. 以正式本地入口为准确认首页、API health 和前端静态资源能返回成功状态。
5. 将当前工作区视为冻结基线：只允许修改本轮明确列出的文件。

**输出**：

- 基线报告：已完成项、待修项、已知 warning、未验证项。
- 13 路由清单和页面分组。
- 当前浅色/深色、桌面/移动截图索引。

### Phase 1：全站审计与问题矩阵

使用 `reference-led-frontend-polish` 做结构审计，再使用 `impeccable critique/audit` 做细节审计。

每个页面记录以下维度：

| 维度 | 检查内容 |
|---|---|
| 结构 | Header、内容最大宽度、区块起止位置、网格、底栏和固定层 |
| 比例 | 卡片宽高、间距、媒体裁切、标题换行、按钮和输入高度 |
| 材质 | L0/L1/L2/L3 表面、边框、阴影、透明度、媒体舞台 |
| 文字 | 标题/正文/辅助/状态层级、中英文长度和对比度 |
| 交互 | hover、pressed、focus-visible、loading、disabled、error、success |
| 响应式 | 320、375、414、768、1440px；无横向溢出和固定层遮挡 |
| 业务 | 搜索、筛选、分页、详情、登录回跳、预约、购物袋、3D 模式和后台操作 |

问题分级：

- **P0**：遮挡、不可读、无法操作、业务入口断裂、主题串色、横向溢出。
- **P1**：结构比例、层级、密度、表面材质或中英文布局明显不一致。
- **P2**：hover、焦点、空态、加载、微动效和边界细节。
- **P3**：只影响审美的可选增强，不阻塞主流程。

每个问题必须带：路由、主题、视口、截图/DOM 证据、影响、建议修改文件、验收方法和是否涉及业务风险。

### Phase 2：设计系统所有权收口

不重新发明主题，优先让已有令牌成为最终所有者：

- `frontend/src/assets/tokens.css`：颜色、间距、字体、焦点和语义状态。
- `frontend/src/assets/glass.css`：`data-glass="light|dark|compact"` 材质合同。
- `frontend/src/assets/theme-controls.css`：共享按钮、输入、筛选和主题控制。
- `frontend/src/assets/task-pages.css`：预约、登录、个人中心、商城和后台任务页面末端覆盖。
- `frontend/src/assets/moonhall-light.css`：月白厅堂浅色层，避免覆盖深色规则。
- `frontend/src/assets/main.css` / `base.css`：仅保留基础布局和兼容规则，逐步减少历史局部颜色所有权。

锁定规则：

1. 颜色和字体引用命名令牌，页面局部不新增散落的 hex/rgb/独立字体。
2. 浅色保持 L0 冷月白画布、L1 玉灰分区、L2 暖月白内容面、L3 石材控件面。
3. 深色保留深墨媒体舞台和 3D 信息层，但不把首页电影感复制到预约、商城、账户和后台。
4. 普通卡片、记录、表单和统计区优先用边界、分组线和密度区分，不用无意义玻璃堆叠。
5. 控件高度至少 44px；焦点环、错误、禁用、加载和成功状态必须可见且不只依赖颜色。
6. 动效即时、克制、可中断；`prefers-reduced-motion`、`prefers-reduced-transparency`、高对比度和 `forced-colors` 都有实色降级。

### Phase 3：共享壳层和基础控件

先处理全站收益最大的共享层，再处理单页细节。

**优先文件**：

- `frontend/src/App.vue`
- `frontend/src/stores/theme.ts`
- `frontend/src/assets/tokens.css`
- `frontend/src/assets/glass.css`
- `frontend/src/assets/theme-controls.css`
- `frontend/src/components/FluidButton.vue`
- `frontend/src/components/MuseumSearchField.vue`
- `frontend/src/components/EditorialCard.vue`
- `frontend/src/components/StatusBadge.vue`
- `frontend/src/components/AdminShell.vue`
- `frontend/src/components/AdminTabs.vue`
- `frontend/src/components/AdminActionButton.vue`

**验收重点**：

- Header 高度、品牌中英文间距、主题按钮、登录/个人中心入口在所有路由一致。
- `data-theme`、`color-scheme` 和 `data-glass` 切换后没有局部遗留浅色/深色规则。
- 搜索、按钮、卡片、状态徽标的状态矩阵一致。
- 旧 `#app`、`data-glass` 高特异性规则不会覆盖新的主题契约；以正式页面 computed styles 为准。

### Phase 4：按页面波次实施

每一页都执行同一闭环：**审计问题 → 确定最小修改 → 实施 → 专项测试 → 双主题双视口真实回归 → 更新矩阵**。每波只解决当前优先级最高的 3–5 个问题。

#### Wave A：公众内容和策展体验

页面：`/`、`/explore`、`/exhibits`、文物详情、文章详情。

- 首页：保留青铜鼎唯一主视觉、路线板和策展入口；收口媒体卡、CTA、署名、页脚和浅深主题背景关系。
- Explore：保持搜索、文化地图、不对称馆藏板和延伸阅读；重点检查地图文字、媒体裁切、深色文字卡、筛选条和移动滚动。
- 展厅/详情：保留编辑索引和长文阅读，不把长文强行拆成卡片墙；统一事实条、阅读进度、媒体舞台和返回入口。
- 中英文：检查长标题、辅助文案、标签和 Header 换行，不只通过增加 CSS 间距解决问题。

#### Wave B：任务型前台

页面：`/appointment`、`/shop`、`/login`、`/reset-password`、`/profile`。

- 预约：步骤、日期、时段、人数、票券摘要和错误/满额状态形成清晰任务层级。
- 商城：商品媒体、信息面、购物袋和空态分层；未登录加购继续保留安全 `returnTo`、商品意图和一次性恢复行为。
- 登录/重置：表单面和输入面分层；自动填充、错误、loading、成功和密码可见性状态完整。
- 个人中心：资料、预约记录、订单记录和操作按任务扫描顺序排列；移动端不被底部导航和记录卡遮挡。

#### Wave C：3D 数字展厅

页面：`/exhibits/:slug`。

- 只优化 DOM 外层、Dock、信息板、工具栏、模式标签和移动 Bottom Sheet。
- 不修改 Canvas、模型、相机、实体/点云算法和生命周期。
- 验收实体/点云切换、视角切换、加载首帧、失败降级、固定底栏避让、键盘焦点和 `X4122` 既有 warning 的边界。

#### Wave D：后台工作台

页面：`/admin`、`/admin/operations`。

- 使用 `frontend-product-designer` 规则：优先信息扫描、表格/记录、筛选、批量操作、表单和状态语义。
- 统一侧栏、工具栏、摘要、编辑区、记录区四层结构。
- 浅色模式使用清晰的 L0–L3 和深墨正文；深色模式保持紧凑任务工作台，不复制首页氛围。
- 真实管理员 CRUD 必须单独补一次闭环；当前凭据不匹配时只能记录为未验证，不能标记完成。

### Phase 5：状态、响应式和可访问性专项

逐组件确认 8 个状态：`default`、`hover`、`:focus-visible`、`:active`、`disabled`、`loading`、`error`、`success`。

逐页面确认：

- 320/375/414px：标题、按钮、日期、筛选、Bottom Sheet、底部导航不遮挡。
- 768px：网格、侧栏、表单和媒体不会处于尴尬的半桌面状态。
- 1440px 及以上：内容最大宽度、单结果搜索、空白比例和首屏构图受控。
- 长中文、英文、数字、金额、状态和超长标题不会溢出或造成布局跳动。
- 键盘顺序、焦点可见、表单 label、图片 alt、按钮 aria 状态和错误说明完整。
- `document.documentElement.scrollWidth === document.documentElement.clientWidth` 或等效证据成立。

### Phase 6：工程与真实页面验收

在 `frontend` 目录运行最小相关检查，再运行完整检查：

```powershell
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm qa:pointer-pages
corepack pnpm perf:pointer-size
git diff --check
```

Docker 验收按项目约定执行：

```powershell
docker compose --env-file deploy/.env -f deploy/compose.yaml up -d --build frontend
```

随后检查：

1. `http://localhost:8088/` 返回 HTTP 200。
2. `http://localhost:8088/api/v1/health` 的响应数据 `status` 为 `UP`。
3. 13 个真实入口的页面资源、图片和模型关键资源返回成功状态。
4. 真实浏览器复核 `1440×900`、`390×844`，必要时补 `1672×941`、`1920×1080`、`414×896`。
5. 浅色/深色切换、搜索、筛选、分页、详情、预约日期/时段、购物袋、登录回跳、3D 模式和后台关键操作均走真实路径。
6. 应用级 console error 为 0；既有 Three.js warning 单独记录，不与应用 error 混淆。

### Phase 7：文档收口与交付

每一波完成后更新：

- 本计划的实施步骤、修改文件、验证结果和未验证项。
- `PROJECT_STATUS.md`：只记录实际完成、实际验证和真实遗留风险。
- `docs/01-requirements-traceability.md`：只有达到验收标准的需求才标记完成。
- `docs/design/audit/<date>/`：保存目标视口截图、DOM/计算样式证据和问题矩阵。
- 如修改共享设计系统或长期架构，再新增 ADR；单页局部调整不扩张文档范围。

不执行 `git commit`、`git push`、强制重置或清理，等待用户明确确认后再进行 Git 操作。

## 5. 页面优先级与停止门

### 优先级

1. **P0**：不可读、不可操作、遮挡、横向溢出、主题串色、登录/预约/购物车/3D 入口断裂。
2. **P1**：全站层级、间距、材质、字体、媒体裁切和后台扫描效率。
3. **P2**：完整状态、焦点、空态、错误、加载和微交互。
4. **P3**：可选的高级动效、额外素材和装饰增强。

### 每波停止门

- 发现 API、权限、状态机或 Three.js 生命周期需要改动：停止并重新确认范围。
- 发现旧规则覆盖新主题：先整理 CSS 所有权和作用域，不继续叠加补丁。
- 发现参考图与真实内容/功能冲突：真实页面和需求优先，效果图退回为参考。
- 发现工作区已有改动与本波文件重叠：先记录 diff 边界，不覆盖用户改动。
- 任何验证未执行或失败：最终报告如实保留，不得标记为完成。

## 6. Definition of Done

只有同时满足以下条件，才可以报告本轮“完成”：

- 13 个真实入口均完成目标范围的浅色/深色、桌面/移动审计。
- P0 问题为 0，P1 问题有明确处理结果或用户确认的遗留记录。
- 共享 Header、主题、卡片、搜索、按钮、表单、状态和导航符合统一令牌与状态合同。
- 公众端、任务型前台、3D 外层和后台分别保持各自的工作目标，没有被强行做成同一种页面。
- 搜索、筛选、分页、详情、登录回跳、预约、购物袋、3D 模式和管理员关键路径真实可用。
- 类型检查、测试、构建、页面映射、体积门禁、Docker HTTP/API 和目标视口浏览器回归均有结果记录。
- 未验证的真实设备、触控笔、系统强制颜色、真实管理员 CRUD 或外部生图能力明确列出。
- 只修改本轮相关文件；Git 状态保持未提交，直到用户明确确认。

## 7. 2026-08-14 实际执行结果

### 已完成

- 已读取并按职责使用 `reference-led-frontend-polish`、`frontend-design`、`impeccable`、`hallmark`、`frontend-product-designer`、`artifact-template-heluo` 和 `apple-design`。
- 已完成 13 个真实路由 × 2 主题 × 2 视口的 52 组 Docker 实页审计；主题属性、主内容节点、图片解码、显式错误态和横向溢出均通过。
- 已处理 2 个 P1：浅色个人中心账户面串入暗色 auth glass；深色 3D 场景标签被浅色回退规则染成低对比度墨绿。
- 已处理 1 个 P2：阅读进度条从 layout `width` 过渡改为 compositor `transform: scaleX()`，补充组件合同测试。
- 未修改 API、路由、鉴权、搜索/筛选/分页、预约/订单/购物车状态机、模拟支付、Three.js Canvas/模型/相机/点云和资源生命周期。
- 已归档截图、路由明细和问题记录到 `docs/design/audit/2026-08-14-full-frontend-optimization/`。

### 本轮实际修改/新增文件

- `frontend/src/assets/moonhall-light.css`
- `frontend/src/assets/main.css`
- `frontend/src/assets/MoonhallLightTheme.spec.ts`
- `frontend/src/assets/darkThemeCohesion.spec.ts`
- `frontend/src/views/ContentDetailView.vue`
- `frontend/src/views/ContentDetailView.spec.ts`
- `docs/design/audit/2026-08-14-full-frontend-optimization/`
- 本计划、`PROJECT_STATUS.md`、`docs/01-requirements-traceability.md` 的本轮执行记录

### 工程与 Docker 验证

| 检查 | 结果 |
|---|---|
| `corepack pnpm typecheck` | 通过 |
| `corepack pnpm test` | 33 个测试文件、157 项通过 |
| `corepack pnpm build` | 通过；保留字体/Three.js 大分包及 `@vueuse` PURE 注释 warning |
| `corepack pnpm qa:pointer-pages` | 通过 |
| `corepack pnpm perf:pointer-size` | 通过；JS 17,932B / gzip 6,621B，布局属性动效门禁通过 |
| `git diff --check` | 通过；仅有既有 LF/CRLF 提示 |
| `impeccable detect.mjs` | 组件与目标 CSS 均返回 `[]` |
| Docker `/` | HTTP 200 |
| Docker `/api/v1/health` | HTTP 200，`data.status=UP` |

### 未验证与停止点

- 真实手机、触控笔、高刷指针、Windows 强制颜色和完整系统级辅助功能仍需现场验收。
- 真实管理员 CRUD 因当前数据库管理员凭据不匹配未标记完成。
- Three.js 已知 `WebGLProgram X4122` warning 单独保留；本轮未发现应用级 console error。
- `artifact-template-heluo` 本轮只复用现有参考资产，没有重新调用网页版 ChatGPT 生图；参考图不作为生产页面资源。
- 当前工作区保留用户已有未提交修改；本轮未执行 commit、push、reset、清理或删除。
