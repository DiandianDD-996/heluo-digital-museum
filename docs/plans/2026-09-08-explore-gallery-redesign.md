# 探索馆藏页重设计

## 目标与需求

针对用户指出的 `/explore` 不够美观、简约、高级的问题，重构为以器物图像和展签为中心的馆藏浏览页。关联 F-01/F-02/F-03/F-12/F-14、N-03/N-06；搜索、分类、URL 状态、分页、详情导航继续使用现有接口。

## 现状与设计判断

- 线上已核实首屏标题和搜索距离过远，装饰山水占用空间，重复眉题、厚卡片边界及大块空白削弱馆藏内容。
- 当前 Explore 导入多份历次覆盖样式。新布局使用独立页面作用域和单一专用样式入口，旧文件保留为历史资料，不再由本页加载。
- 受众是先了解馆藏、再进入 3D 或预约的年轻访客。页面直接进入浏览任务；不增加营销首屏。
- 配色继承现有令牌：月白画布、墨色正文、青玉操作、少量古铜标记。参考色为 #f4f7f5、#ffffff、#243b34、#50645b、#155c49、#857450，以实际主题令牌为准。正文继续用项目无衬线，标题用正体宋体，字号按固定 rem 梯级，不随视口缩放。
- 布局比较：纯均匀目录缺少重点；旧版横向大卡片稀释图片。采用一件重点器物配四件次级器物的非对称陈列，图下放真实展签，移除外层浮卡。移动端先完整展示重点器物，其余双列，窄屏或长语言改为单列。
- 主题脉络改为真实分类入口，延伸阅读采用缩略图配标题的列表。状态、焦点、44px 点击区与浅深主题一并实现。

## 影响范围

- `frontend/src/views/ExploreView.vue`：模板、展示文案、可恢复图片状态；保留请求与 URL 导航逻辑。
- `frontend/src/assets/explore-gallery.css`：布局、控件、双主题、响应式、减少动效和强制颜色。
- Explore 测试及引用旧结构的共享静态合同：将已退役的装饰断言同步为新视觉合同，保留业务验收。
- 本计划、素材提示词、`PROJECT_STATUS.md`、需求追踪表。

## 实施步骤

1. 记录线上现状并读取已有组件和主题。
2. 重构标题、搜索、分类、馆藏陈列、主题入口和阅读区。
3. 完成搜索/空/错/加载/图片失败状态及 URL 导航回归。
4. 运行前端类型检查、单测、构建及预算、页面映射检查。
5. 使用本地真实 API 验收桌面/手机、中英文、浅深色以及浏览、筛选、搜索、详情返回。
6. 更新验证记录并审查本次差异；本轮不包含公网发布或 Git 提交。

## 风险与素材

- 历史全局 `#app` 及交互属性样式可能覆盖新布局，需以浏览器计算样式核验。
- 现有器物是概念展品，展签继续明确标注；不杜撰年代、馆藏编号或出土信息。
- 复用现有 WebP 和响应式图片，保持来源记录。新素材可选，不依赖用户生图完成代码验收。
- 页面重构不涉及后端、数据库、鉴权、真实支付或部署配置。

## 验收标准

- 1440x900 和 390x844 首屏可搜索、筛选并看见器物；320px 至宽屏无水平溢出、文字遮挡或主体裁切。
- 搜索/分类/分页的 URL 可分享、刷新、后退；馆藏和文章详情可进入并返回。
- 加载、失败重试、空结果、缺图均有可理解且可操作的状态。
- 浅深主题、中英文、键盘焦点与减少动效完整；不依靠模糊和装饰动画表达层级。
- 必要工程检查通过，未验证项目如实保留。

## 验证结果

- 类型检查通过；最终 `corepack pnpm build` 包含 Vue/TypeScript 编译、生产构建及 gzip 预算，全部通过。Explore 路由 CSS 为 22.73 kB / gzip 3.65 kB，JS 为 23.36 kB / gzip 7.82 kB。构建仍有已有的 VueUse 注释及 Three.js 大块提示，不影响构建成功。
- 最终全量 Vitest `58` 文件 / `316` 项通过。`ExploreReferenceLayout.spec.ts` 中 9 项组件测试覆盖分类、主题入口、概念展签、缺图、加载重试、搜索失败/空态恢复与语言；既有 `ExploreNavigation.spec.ts` 保留 25 条结果的搜索分页、URL 恢复和晚到响应检查。测试环境有既有的模拟路由未注册警告。
- 真实 API 浏览器流程通过：全部 5 件、青铜 2 件、玉石 1 件，搜索“青铜”3 项、空搜索恢复、主题链接、器物详情进入与后退恢复分类、文章详情进入及返回全部馆藏。英文模式的文章正文仍使用接口中文内容，是已有内容翻译边界。
- Explore 在 320/375/390/414/768/1024/1440/1672px 八档宽度、双主题、中英文共 `32` 状态中，没有页面横向溢出、控件裁字、小于 44px 的可见按钮或可见坏图。最终生产包额外完成 1440x900 / 390x844 浅深主题截图复核；键盘从搜索进入分类时焦点环可见，生产页 console warn/error 为 0。
- 首页、展厅、预约页与 Explore 实页对照：共享 Header、正文无衬线栈、宋体内容标题、青玉/月白及深墨主题令牌一致；首页英文大标题继续保留原有 Georgia。共享组件和其他业务页继续沿用原有设计。
- 从浏览器计算颜色核算：浅/深主题辅助文字对比度约 `5.92:1 / 6.01:1`，搜索按钮文字约 `7.42:1 / 9.14:1`。这是本页这两类文字的核查，不代表全站人工无障碍验收完成。
- `HELUO_BASE_URL=http://127.0.0.1:5174 corepack pnpm qa:pointer-pages` 检查四条路由、八档宽度共 `32` 状态，横向溢出与控件裁切均为 0，Explore 无装饰 Canvas 的新合同通过。命令退出码为 1：商城 `shopStudioSpotlightActivates` 和 `shopStudioHasNoSpatialMotion` 未通过，报告中商城 `motionTier=static`、桌面舞台无 inline transform；本轮未改写商城动效合同，不能称全站门禁全绿。
- 生产预览 `/explore` 返回 HTTP 200，代理 `/api/v1/ready` 返回 `data.status=UP`。开发地址为 `http://127.0.0.1:5174/explore`，生产预览为 `http://127.0.0.1:5176/explore`，均使用现有 `4192` API 环境；端口需以实际进程为准。
- 本次修改差异已审查。工作树还含其他任务的预约、3D 和既有历史改动，未回退、提交、推送或公网发布。

## 证据与未验收项

证据目录：`C:/Users/Jie/Documents/博物馆/artifacts/explore-gallery-2026-09-08/`（已忽略）。包括改前 Vue、`vitest-delivery.json`、`browser-matrix.json`、`page-mapping-summary.json`、`text-contrast.json`、双主题双尺寸 `delivery-*.png` 和阅读/搜索截图。

实体 iOS/Android、系统级高对比度/强制颜色、真实慢网、完整人工无障碍与公网效果未验收；本轮未重复后端、Docker、真实预约/下单/后台 CRUD。搜索分页和错误注入主要由组件测试覆盖。本地完成不等于线上已替换，下一步为用户目视验收后安排发布。

可选新图提示词：`C:/Users/Jie/Documents/博物馆/docs/design/2026-09-08-explore-image-prompts.md`。本次没有生成新图片，现有图片可直接交付。

## 本次修改文件

以下仅列本任务编辑的文件；部分文件在任务开始时已经处于未提交状态。

- `C:/Users/Jie/Documents/博物馆/frontend/src/views/ExploreView.vue`
- `C:/Users/Jie/Documents/博物馆/frontend/src/assets/explore-gallery.css`
- `C:/Users/Jie/Documents/博物馆/frontend/src/views/ExploreReferenceLayout.spec.ts`
- `C:/Users/Jie/Documents/博物馆/frontend/src/assets/mobilePerformance.spec.ts`
- `C:/Users/Jie/Documents/博物馆/frontend/src/assets/MoonhallLightTheme.spec.ts`
- `C:/Users/Jie/Documents/博物馆/frontend/src/assets/pointerDotFieldMapping.spec.ts`
- `C:/Users/Jie/Documents/博物馆/frontend/src/assets/PublicResponsivePolish.spec.ts`
- `C:/Users/Jie/Documents/博物馆/frontend/src/assets/glassMaterials.spec.ts`
- `C:/Users/Jie/Documents/博物馆/frontend/src/assets/darkThemeCohesion.spec.ts`
- `C:/Users/Jie/Documents/博物馆/frontend/src/assets/ControlSurfacePolish.spec.ts`
- `C:/Users/Jie/Documents/博物馆/frontend/src/assets/ExploreMobileThemePathAlignment.spec.ts`
- `C:/Users/Jie/Documents/博物馆/frontend/src/test/MobileRouteRuntime.spec.ts`
- `C:/Users/Jie/Documents/博物馆/frontend/src/views/AuditRemediationContracts.spec.ts`
- `C:/Users/Jie/Documents/博物馆/frontend/scripts/page-mapping-audit.mjs`
- `C:/Users/Jie/Documents/博物馆/docs/design/2026-09-08-explore-image-prompts.md`
- `C:/Users/Jie/Documents/博物馆/docs/plans/2026-09-08-explore-gallery-redesign.md`
- `C:/Users/Jie/Documents/博物馆/PROJECT_STATUS.md`
- `C:/Users/Jie/Documents/博物馆/docs/01-requirements-traceability.md`
