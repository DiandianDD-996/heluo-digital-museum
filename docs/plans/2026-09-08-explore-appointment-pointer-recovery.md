# 探索与预约页鼠标交互恢复

## 目标与需求

按用户反馈恢复 `/explore` 与 `/appointment` 改版后缺失的鼠标交互，保持现有简约布局和全站风格。关联 F-01/F-02/F-06/F-12/F-14、N-03/N-06。

## 原因与影响范围

- Explore 和 Appointment 的标题区域不再挂载 `PointerDotField`；`App.vue` 还将预约路由列入 `PointerCursor` 禁用名单，导致该页全局动效档位为 static。
- 在两页现有标题区复用一次点阵组件，并从光标禁用名单移除预约路由；点阵颜色、双环跟随、共享帧循环和性能降级继续使用现有实现。
- 页级 CSS 明确点阵与标题/搜索的层级，并修复新版按钮样式覆盖共享 `cursor: none` 导致的双光标。输入框保留原生文本光标，点阵不参与指针命中；页面几何和业务逻辑保持。
- 更新受影响的页面映射与移动性能合同；新增实际浏览器回归，防止再次把用户需要的交互当作可删除装饰。
- 不新增依赖、素材、后端改动或发布；保留工作树中其他任务改动。

## 步骤与验收

1. 记录缺失原因，接回共享点阵与预约光标。
2. 检查浅深主题中的 Canvas 非空、鼠标移动后的像素变化，以及路由切换后的恢复。
3. 真实浏览器操作搜索、分类、日期/时段及联系人；点阵不能拦截点击，输入区继续使用原生文本光标。
4. 触屏、减少动态和强制颜色模式不绘制点阵、不隐藏系统光标；手机布局保持可用。
5. 运行专项/全量单测、类型检查、生产构建和交互体积预算，记录浏览器截图与页面映射结果。
6. 更新状态与需求追踪，审查本任务差异，不提交、推送或部署。

## 风险

- 历史高优先级 CSS 可能覆盖点阵层级或导致系统鼠标与自定义光标重叠，需检查实际计算样式。
- 页面切换、键盘切回鼠标和低帧率可能使动效降档，验证必须包含真实 SPA 导航。
- 现有点阵已经在粗指针/辅助模式停止 Canvas 分配和位置订阅；恢复挂载不能绕开这些限制。

## 验证结果

- 专项 Vitest：8 文件 / 49 项通过；最终全量 `pnpm test`：58 文件 / 316 项通过。
- `pnpm typecheck`、`pnpm build` 和资源增长预算通过。构建保留既有 VueUse PURE 注释和 Three.js 大 chunk 提示。
- `pnpm perf:pointer-size` 通过：交互 JavaScript 为 17,983 bytes，gzip 6,716 bytes，低于 18,000 / 7,000 bytes 预算。
- 开发服务 `5174` 与生产预览 `5176` 的专项浏览器回归均为 16/16：桌面浅/深主题真实 Canvas 非空且随移动改变、单实例、点击穿透、搜索/分类、SPA 切换、日期/时段选择、联系人输入、键盘切回鼠标、从禁用光标页面返回恢复均通过。触屏、减少动态、强制颜色不分配 Canvas；减少透明度使用静态 CSS 点阵。无横向溢出、页面异常或失败请求。
- 初次开发回归曾在深色分类处失败；后续检查发现开发服务退出，后端分类接口为 200 且返回两件器物。恢复服务并补充失败页面/请求诊断后，开发与生产回归均通过，未修改分类业务或放宽断言。
- 实际计算样式确认新版分类/日期按钮曾显示系统手型；局部修正后，两页所有可见链接/按钮均为 `cursor: none`，联系人输入为 `cursor: text` 且自定义光标隐藏。辅助模式的正常按钮恢复系统光标。
- `pnpm qa:pointer-pages` 完成 5 路由 × 8 宽度共 40 状态：无溢出、无裁切、四个允许场景各一个非阻塞点阵、Canvas 尺寸与 full 档响应均通过。商城既有 `shopStudioSpotlightActivates`、`shopStudioHasNoSpatialMotion` 两项失败，脚本整体退出 1；未扩大到商城修复，也不标记全站门禁全绿。
- 已查看两页桌面浅深主题和 390×844 手机截图；生产预览 `/api/v1/ready` 为 HTTP 200 / UP。任务文件 `git diff --check` 通过。

证据：`artifacts/pointer-recovery-2026-09-08/summary.json`（最终生产预览、`passed: true`）、同目录截图；`artifacts/page-mapping/summary.json`；`artifacts/performance/pointer-size.json`。

## 修改文件

以下文件只列本次增量；其中已有其他任务的改版保留，不以相对 HEAD 的全部差异作为本轮改动。

```text
C:/Users/Jie/Documents/博物馆/frontend/src/App.vue
C:/Users/Jie/Documents/博物馆/frontend/src/views/ExploreView.vue
C:/Users/Jie/Documents/博物馆/frontend/src/views/AppointmentView.vue
C:/Users/Jie/Documents/博物馆/frontend/src/assets/explore-gallery.css
C:/Users/Jie/Documents/博物馆/frontend/src/assets/appointment-workbench.css
C:/Users/Jie/Documents/博物馆/frontend/src/assets/pointerDotFieldMapping.spec.ts
C:/Users/Jie/Documents/博物馆/frontend/src/test/MobileRouteRuntime.spec.ts
C:/Users/Jie/Documents/博物馆/frontend/src/views/AppointmentMobilePerformance.spec.ts
C:/Users/Jie/Documents/博物馆/frontend/src/views/ExploreReferenceLayout.spec.ts
C:/Users/Jie/Documents/博物馆/frontend/scripts/page-mapping-audit.mjs
C:/Users/Jie/Documents/博物馆/frontend/scripts/pointer-recovery-audit.mjs
C:/Users/Jie/Documents/博物馆/docs/plans/2026-09-08-explore-appointment-pointer-recovery.md
C:/Users/Jie/Documents/博物馆/PROJECT_STATUS.md
C:/Users/Jie/Documents/博物馆/docs/01-requirements-traceability.md
```

## 未验证与后续

本次未提交真实预约、未重复后端/后台 CRUD/支付测试、未构建 Docker 或发布 PocketBay。实体手机、触控笔、操作系统原生辅助设置和长期 FPS 待验收；浏览器媒体模拟不代替这些项目。无需新素材。可先在 `http://127.0.0.1:5176/explore` 和 `/appointment` 查看，确认后另行安排发布。
