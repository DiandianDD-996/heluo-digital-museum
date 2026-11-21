# 探索与预约页面视觉精修

## 目标与需求

用户认为上一版不够美观，并确认整体页面和鼠标动效一起优化。关联 F-01/F-02/F-03/F-06/F-12/F-14、N-03/N-06。保留全站身份、已有图片和刚恢复的交互，让内容、控件与动效具有一致的比例与层级。

## 设计判断

- 当前系统宋体不支持设计文档标注的可变字重；这是移动性能改造后的实际实现。保留零字体下载，页面任务标题和展签信息使用已有无衬线字库，重点器物标题保留少量衬线对比。同步记录设计文档与代码的差异。
- 继续使用现有命名令牌：月白画布、白色内容面、墨色文字、青灰辅助文字、青玉操作与少量古铜。浅色近似参考为 #F3F6F5 / #FAFCFC / #14392F / #51675E / #0E6047 / #AC884D，实际代码引用主题令牌，深色采用同一几何。
- 馆藏仍直接提供搜索、分类与真实器物入口。重点器物通过更清晰的展签、呼吸空间和稳定图片比例获得强调；减少无功能角标和重复边线，主题区加入既有馆藏图片作为内容索引。
- 预约保持日期、时段、联系人顺序。14 天网格不再让未开放日期成为最重的视觉元素，已选状态与进度更明确；侧栏以场馆图、信息、预约摘要组成连续版面。
- 动效继续使用共享运行时：更小、更干净的光环；标题点阵增加渐隐边缘，鼠标靠近才有明显响应。保留青玉/金色，不增加背景光球、拖尾或大幅视差。

```text
探索：标题与检索 -> 分类 -> 重点器物 / 四件器物 -> 主题图文索引 -> 阅读
预约：标题与账户 -> 进度 -> 日期 / 场馆 -> 时段 / 摘要 -> 联系人
```

自审：完整器物仍可辨识，图片不压暗；预约以操作效率为主，不增加封面或装饰票券。共享光标变化需回归首页和展厅，页级样式不覆盖后台、3D 与账户。

## 影响范围与步骤

1. 修改 ExploreView、AppointmentView 及各自 CSS，保留 API、URL、状态机与既有失败恢复。
2. 为共享 PointerDotField 增加标题用途的呈现参数；精修 pointer-motion.css 和光标跟随参数，保留降级与生命周期。
3. 更新被改变的视觉合同，浏览器验证双主题、中英文、手机/桌面、鼠标/键盘/辅助模式、搜索/日期与预约填表。
4. 类型检查、全量单测、生产构建/体积预算，检查本轮差异，更新状态与需求追踪。

风险：字体量度、页级高优先级 CSS、长英文和共享光标的跨页影响。使用真实截图与计算样式验收。无新依赖、外部业务服务、数据库变更、提交或发布。

## 验收与验证结果

- [x] 页面精修：两页共享版心、任务标题与间距；探索页采用主次展签、同行箭头、图文主题索引和阅读列表，预约页采用细线进度、轻量未开放日期和突出的已选摘要。沿用既有双主题、图片、共享按钮与图标。
- [x] 动效精修：标题点阵的基础/活动透明度为 .36/.8，横向渐隐、静止减弱；去掉标题对比光斑与额外金色核心绘制。共享光标为 4px 中心点、30px 细环，跟随时间常数 58ms、拉伸上限 6%，可交互控件悬停继续显示光环。
- [x] `pnpm typecheck`、最终全量 `pnpm test` 通过：58 文件 / 317 项。更新的是本轮改变的字体、布局尺寸与光标拉伸合同；生命周期、模式降级、Canvas alpha 复位与无光斑断言均通过。
- [x] `pnpm build`、生产资源预算、`pnpm perf:pointer-size` 通过。交互 JS 17,414 bytes / gzip 6,536 bytes，CSS 7,227 bytes / gzip 1,866 bytes；保留既有 VueUse PURE 注释与 Three.js 大 chunk 提示。
- [x] 最终生产预览 `5176` 的视觉回归 48/48 通过：2 路由 × 320/390/760/900/1440/1920px × 双主题 × 中英文，无横向溢出、被检文字裁切、小于 44px 的被检控件、坏图或页面异常。390px 四种主题/语言组合均完成抽屉填写与关闭。
- [x] 初次手机全页截图未捕获全部屏外图片；按真实滚动路径触发懒加载并等待解码后，最终截图完整。没有改为生产全量预加载；已查看手机英文长页、手机中文预约和两页桌面双主题截图。
- [x] 最终生产预览鼠标回归 16/16 通过：双主题 Canvas 非空且像素随移动变化，SPA、搜索/分类、日期/时段、联系人、键鼠恢复与输入框原生光标正常；触屏、减少动态、强制颜色和减少透明度降级通过。无页面异常、失败请求或溢出。
- [x] 生产预览 + 本地隔离 MySQL 的预约 E2E 2/2 通过：双主题六类文字/占位符对比度 >= 4.5:1；手机填写姓名/电话/邮箱/人数、关闭恢复焦点、登录续填、提交成功及个人中心预约记录均通过。仅创建本地测试用户和预约，未写入线上数据。
- [x] 页面映射完成 5 路由 × 8 宽度共 40 状态：无溢出/裁切，首页、探索、展厅、预约的共享点阵映射、非阻塞、有效像素及 full 档响应通过。
- [ ] 页面映射仍因商城既有 `shopStudioSpotlightActivates`、`shopStudioHasNoSpatialMotion` 两项失败而退出 1；本轮未改变商城，不将此结果称为全站门禁全绿。
- [x] `5176` 两页与 `/api/v1/ready` 实际 HTTP 可访问，ready 为 UP；更新设计文档的系统字库事实、项目状态和需求追踪。
- [x] 审查本轮页面、动效与测试差异；23 个任务文件的空白检查通过，包含 14 个未跟踪文件。关闭本轮临时开发服务 `5174`，保留最终生产预览 `5176`。

生产证据：`artifacts/visual-refinement-2026-09-08/summary.json`（48 状态）、`pointer/summary.json`（16 状态）、同目录截图与 `booking-results/.last-run.json`（2 项）；共享回归 `artifacts/page-mapping/summary.json`；交互体积 `artifacts/performance/pointer-size.json`。预约抽屉业务截图在 `artifacts/sitewide-quality/appointment-redesign/mobile-contact-sheet.png`。所有运行产物位于忽略目录。

## 修改文件

仅列本轮增量涉及的文件；工作树内更早的改版和其他任务改动保留。

```text
C:/Users/Jie/Documents/博物馆/frontend/src/views/ExploreView.vue
C:/Users/Jie/Documents/博物馆/frontend/src/views/AppointmentView.vue
C:/Users/Jie/Documents/博物馆/frontend/src/assets/explore-gallery.css
C:/Users/Jie/Documents/博物馆/frontend/src/assets/appointment-workbench.css
C:/Users/Jie/Documents/博物馆/frontend/src/assets/pointer-motion.css
C:/Users/Jie/Documents/博物馆/frontend/src/components/PointerDotField.vue
C:/Users/Jie/Documents/博物馆/frontend/src/components/PointerCursor.vue
C:/Users/Jie/Documents/博物馆/frontend/src/components/PointerDotField.spec.ts
C:/Users/Jie/Documents/博物馆/frontend/src/components/PointerCursor.spec.ts
C:/Users/Jie/Documents/博物馆/frontend/src/assets/pointerMotionVisual.spec.ts
C:/Users/Jie/Documents/博物馆/frontend/src/assets/pointerDotFieldMapping.spec.ts
C:/Users/Jie/Documents/博物馆/frontend/src/assets/ControlSurfacePolish.spec.ts
C:/Users/Jie/Documents/博物馆/frontend/src/assets/ExploreMobileThemePathAlignment.spec.ts
C:/Users/Jie/Documents/博物馆/frontend/src/test/MobileRouteRuntime.spec.ts
C:/Users/Jie/Documents/博物馆/frontend/src/views/AppointmentMobilePerformance.spec.ts
C:/Users/Jie/Documents/博物馆/frontend/scripts/visual-refinement-audit.mjs
C:/Users/Jie/Documents/博物馆/frontend/scripts/pointer-recovery-audit.mjs
C:/Users/Jie/Documents/博物馆/frontend/e2e/appointment-presentation.e2e.ts
C:/Users/Jie/Documents/博物馆/design.md
C:/Users/Jie/Documents/博物馆/docs/design/2026-09-08-explore-image-prompts.md
C:/Users/Jie/Documents/博物馆/docs/plans/2026-09-08-explore-appointment-visual-refinement.md
C:/Users/Jie/Documents/博物馆/PROJECT_STATUS.md
C:/Users/Jie/Documents/博物馆/docs/01-requirements-traceability.md
```

## 未验证与后续

实体手机、系统原生辅助设置、真实慢网与长期 FPS 尚未验收；本轮没有重跑后端测试、后台 CRUD、支付、Docker 构建或线上写流程。前端构建成功不等于公网发布。当前无新增依赖、字体或图片，未提交、推送或发布。

可直接查看 `http://127.0.0.1:5176/explore` 与 `http://127.0.0.1:5176/appointment`。用户可在本地预览确认视觉和鼠标手感；可选图片升级提示词见 `docs/design/2026-09-08-explore-image-prompts.md`，现有页面不依赖新素材。
