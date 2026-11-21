# Image 2 全站低青绿高级调色纠偏

## 目标

在不改变 API、路由、权限、业务状态机、模拟支付契约或 Three.js 核心逻辑的前提下，让 13 条路由的 Image 2 效果图回到深色首页母版的高级夜场：近黑深墨、石墨灰、暖象牙与真实材质为主，青玉仅作低面积交互提示。

## 关联需求

- 视觉统一：深色首页作为唯一母版，桌面 `1440x900`、移动 `390x844`。
- 共享状态：导航、EditorialCard、搜索框、表单、Bottom Sheet、3D 实体/点云、后台标签状态。
- 工程边界：不改变后端 REST、数据库、鉴权、预约/订单/模拟支付状态机和 Three.js 核心逻辑。

## 影响范围

- `docs/prompts/2026-08-10-home-style-sitewide-image2-prompt-suite.md`
- `docs/design/image2/2026-08-10/inputs/`、`outputs/`、`state-boards/`
- `docs/design/image2/2026-08-10/manifest.generated.json`
- `frontend/src/components/MuseumSearchField.vue`、`frontend/src/components/EditorialCard.vue`
- `frontend/src/views/ExploreView.vue` 与 `frontend/src/assets/main.css`

## 步骤

1. 在同一 ChatGPT Image 2 对话保留首页基准，逐页重新上传首页基准与当前实页截图。
2. 对首稿偏绿、低层次或出现浏览器壳的页面追加低青绿纠偏词，一次只生成一张。
3. 保存原始 PNG 与严格目标视口预览，记录提示词、输入、尺寸、时间、会话和审查结论。
4. 统一审查通过后再落地共享组件和页面 CSS，保持真实 Vue DOM 和 API 数据。

## 验收标准

- 近黑/石墨/烟灰占主画布，青玉绿不形成大面积卡片或后台平面。
- 暖象牙标题、古铜金当前态和媒体边缘层级稳定；卡片与背景融合且不纯黑无层次。
- 每张效果图无浏览器外壳、滚动条、灰色边缘、营销页结构或范围外功能。
- manifest 可追溯每个接受稿与纠偏稿；未通过首稿保留但不作为实现依据。

## 风险与验证

- Image 2 输出尺寸可能不是精确视口，保留原始 PNG 并生成目标尺寸预览，manifest 记录两者。
- 中文文字仅验证层级和布局，真实文案仍由 Vue DOM 渲染。
- 最终实现必须运行前端/后端测试、构建、页面门禁、Docker health 和 Chrome 双视口回归；本轮执行结果见下节。

## 验证结果（2026-08-11）

- 已在同一专用 ChatGPT 对话完成 13 条真实路由的桌面/移动效果图及共享 UI、动效与跨页面状态板；接受稿、拒绝稿、原始 PNG、目标视口预览、输入图、生成时间和页面映射均登记在 `docs/design/image2/2026-08-10/manifest.generated.json`。
- 已将 Image 2 调色锁收口为中性近黑、石墨、烟灰、深木和暖象牙，青玉仅作低面积状态，古铜仅作编号、细线、焦点和主操作；拒绝稿保留但不作为实现依据。
- 已新增共享 `MuseumSearchField` 与 `EditorialCard`，探索页搜索结果接入共享组件；深色令牌和全站组件表面改为中性石墨/暖木色系，未改变 API、路由、权限、业务状态机、模拟支付或 Three.js 核心逻辑。
- 前端全量 Vitest 25 个文件 / 108 项、类型检查、生产构建、`qa:pointer-pages` 32 组页面映射、`perf:pointer-size` 与 `perf:pointer` 均通过；交互代码为 `17,991 B / 6,636 B gzip`，10 秒性能审计 4 组结果的 gate 均为 `true`。生产构建仅保留既有 Rollup 注释和 Three.js 大分包提示。
- 后端 `mvn test` 12 项通过。Docker 前后端已重建；最终前端镜像为 `sha256:ad9e1140abead58568113bf975acebc8652d95901682f1f24de3116bf31512f6`，首页 HTTP `200`，`/api/v1/health` 返回 `UP`。
- Chrome 已逐条导航 13 条路由并检查桌面/移动布局；管理员登录后另行复核 `/profile`、`/admin`、`/admin/operations` 的真实权限路径。所有检查页面均为深色、无横向溢出或控制台错误；共享搜索提交/清除、预约与购物袋 Bottom Sheet、主题持久化、后台标签和 3D 实体/点云往返均通过，3D Canvas 保持 `running`。
- 浏览器窗口受 Windows 显示缩放影响，视口能力设为 `1440x900` / `390x844` 时页面实际报告 `1600x1000` / `433x938`；精确目标尺寸由 `qa:pointer-pages` 覆盖。实体手机、触控笔和系统强制颜色本轮未重复人工复验。
