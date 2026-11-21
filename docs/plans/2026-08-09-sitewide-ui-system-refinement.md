# 全站体验系统化精修实施记录

## 目标

在不改变 API、路由、权限、预约/订单状态机、模拟支付和 Three.js 生命周期的前提下，覆盖公开前台、账户、3D 与后台，收口共享控件、状态、动效和验收体系。

## 关联需求

`F-01` 至 `F-14`、`A-01`、`A-02`、`N-03`、`N-06`。

## 已锁定约束

- 保持“河洛纸墨”、浅深双主题、三层 `data-glass` 契约和现有信息架构。
- Image 2 只用作无文字视觉探索和素材方向；生产 UI 必须由 Vue DOM、令牌和可访问语义实现。
- 每个组件族完成 Image 2 候选与真实 DOM 原型后，等待用户确认才进入生产页面迁移。
- 当前工作区已有无关改动；本任务仅新增独立文档、测试与后续确认后的窄范围实现，不重置或覆盖既有改动。

## 当前阶段：基线与 Image 2 候选

- 已从 `http://localhost:8088` 捕获 13 条路由的浅色/深色、`1440×900`/`390×844` 可视基线，共 52 张截图。
- 受保护路由当前记录未登录访问的鉴权入口状态；后续三角色基线和 E2E 将使用隔离测试环境与非提交凭据完成。
- 已在网页版 ChatGPT 的 Create image（Image 2）中生成“按钮与控件”候选 A/B，归档于忽略目录：`artifacts/sitewide-ui-refinement/image2/01-buttons-a.png` 与 `01-buttons-b.png`。提示词、会话地址、用途和 SHA-256 记录于同目录 `manifest.json`。
- 用户已确认按钮候选 A；已完成隔离真实 Vue DOM 原型：临时 Nginx 代理 `8088` 并注入独立覆盖 CSS，在商城、预约、3D 路由实际加载现有 Vue、API、路由和 Three.js。原型通过用户第二道确认前仍不修改生产 Vue、CSS、API、路由或业务逻辑。

## 下一步

请求按钮系统第二道确认；已生成搜索筛选候选 A，待补候选 B；随后继续卡片、表单、3D 控件与后台工作台的 Image 2 候选。

## 验证

- `http://localhost:8088/`：HTTP `200`。
- `http://localhost:8088/api/v1/health`：`UP`。
- 基线捕获：52/52 成功。

## 按钮系统隔离真实 Vue DOM 原型验证

- 真实预览：`http://localhost:4179/shop`、`/appointment`、`/exhibits/heluo-bronze-ding-3d`。
- 机制：临时 Nginx 反向代理运行中 `8088`，只向 HTML 注入 `real-pages-overrides.css`；不写入生产 bundle。
- 实测：三条路由均返回 HTTP `200` 并包含覆盖 CSS；商城真实 Vue DOM 识别到 `#shop-products`，`390px` 下 `scrollWidth == clientWidth == 375`。
- 截图：`artifacts/sitewide-ui-refinement/button-prototype/screenshots/real-shop-light-1440.png`、`real-shop-dark-1440.png`、`real-shop-dark-390.png`。

## 2026-08-09 浏览器标注：3D 视角工具可读性

- 用户在深色主题的 `/exhibits/heluo-bronze-ding-3d` 标注“视角控制”字体与边缘偏暗。
- 已将修复限定为深色主题下的 `.viewer-tools`：提升外框、分隔线、文字及图标环的对比度；补齐 `:hover` 与 `:focus-visible`，不触碰 Three.js、按钮事件、相机或点云逻辑。
- 已通过 `pnpm typecheck`、`pnpm build`、`pnpm test`（25 files / 90 tests）和 Docker 重建；运行中生产 CSS 已验证包含该规则。浏览器视觉复核待用户刷新真实路由确认。

## 2026-08-09 浏览器标注：商城压缩布局

- 在 `1181–1500px` 桌面断点，第二张商品卡片改为以第一张卡片宽度加响应式间距定位，避免浏览器缩放导致两卡重叠。
- 第三张围巾卡片下移 `32px`；移动端的单列记录卡布局和购物袋逻辑不变。
- 已通过 `pnpm typecheck`、`pnpm test`（25 files / 90 tests）、`pnpm build`、Docker 重建、`/shop` HTTP `200`、API health `UP` 与运行中 CSS 规则核验。用户刷新后进行视觉确认。

## 2026-08-10 卡片媒体舞台：Image 2 素材 + 真实页面实施

### 直接反馈范围

- 首页 `/` 的三张策展物件卡。
- 馆藏 `/explore` 的五张器物卡及三张延伸阅读卡。

### 已实施

- 在用户已登录的 ChatGPT Web 中调用 Image 2 生成一张无文字、无器物的 `16:9` 深墨青玉媒体舞台；生成会话、用途、提示词、原始导出路径和 WebP SHA-256 已归档到 `artifacts/sitewide-ui-refinement/image2/manifest.json`。
- 将导出 PNG 转为版本化生产素材 `frontend/public/media/editorial/heluo-card-atmosphere-image2-v1.webp`，不覆盖任何既有文物或文章封面。
- 仅在 `main.css` 增加统一媒体舞台：首页透明鼎能直接落在同一展陈底板上；馆藏与文章卡以低强度 Image 2 纹理层、共同色调和现有底部文字遮罩收口异质来源图片。
- 保留原有图片 URL、Vue DOM、卡片链接、搜索/筛选请求、动效循环与所有业务逻辑；减少透明度、高对比度和强制颜色模式会移除素材纹理叠层，回到实色高可读背景。

### 验收标准

- 生产素材存在、CSS 三个卡片族均引用该版本化素材，并有自动契约测试。
- `pnpm typecheck`、相关 Vitest、生产构建、Docker 正式 URL 与现有响应式门禁通过后，等待用户在实际页面刷新进行视觉确认。
