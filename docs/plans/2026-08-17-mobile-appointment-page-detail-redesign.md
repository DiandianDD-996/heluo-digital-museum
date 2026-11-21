# 移动端预约页细节重设计实施计划

## 目标

在不改变预约业务合同的前提下，将 `/appointment` 的手机端改为紧凑、清晰、可连续完成的任务界面，重点解决 `320px` 窄屏 Header 拥挤、步骤卡堆叠、未选日期时主操作误导、时段层级不足、场馆信息冗长和底部导航遮挡风险。

## 关联需求

- `F-06`：登录用户可提交预约并查看自己的预约。
- `F-12`：预约核心界面支持中英文切换。
- `F-14`：预约页浅色/深色主题一致。
- `N-03`：移动端无关键横向溢出，表单状态可理解且触控可用。
- `N-06`：类型检查、测试、构建与实施记录完整。

## 影响范围

- `frontend/src/App.vue`：移动端账户入口增加图标语义，窄屏隐藏冗余文字。
- `frontend/src/components/BottomSheet.vue`：允许业务页为 Teleport 面板传入可选样式类。
- `frontend/src/views/AppointmentView.vue`：补齐移动时段分区、禁用态主操作、场馆信息图标和人数步进器。
- `frontend/src/assets/task-pages.css`：建立预约页移动端视觉合同并覆盖旧移动规则。
- `frontend/src/test/MobileRouteRuntime.spec.ts`、`frontend/src/views/AppointmentMobilePerformance.spec.ts`：补充结构与触控合同。
- `PROJECT_STATUS.md`、`docs/01-requirements-traceability.md`：记录结果。

## 实施步骤

1. 将移动预约步骤由四张卡改为连续进度轨，压缩首屏高度并保留 `aria-current`。
2. 统一 `320px` / `390px` Header、标题、日期卡带和固定底部导航的尺寸与安全区。
3. 日期选中后显示独立的“02 / 时段”分区；未选时段时禁用“填写预约信息”。
4. 时段按钮改为轻量列表行，保持 `44px` 以上触控区、焦点环和按压反馈。
5. 场馆卡改为紧凑横向信息带；移动 BottomSheet 人数选择复用加减步进器。
6. 同步浅色、深色、减少动态、减少透明度和强制颜色降级。
7. 运行专项测试、全量测试、类型检查、生产构建、指针尺寸审计、Docker 与正式页面回归。

## 验收标准

- `320×800` 与 `390×844` 的中文浅色/深色页面无横向溢出、文字裁切或互相遮挡。
- Header 品牌、主题、语言和账户入口在 `320px` 内完整可用；可交互目标不小于 `44px`。
- 四步进度不再呈现为 2×2 卡片，当前步骤在两种主题中均清晰。
- 未选择日期/时段时，填写入口为真实禁用态；选中日期后首个可用时段同步选中并显示时段分区。
- 日期、时段、填写弹层、人数步进器和关闭/回焦流程可操作。
- 固定底部导航不遮挡填写入口、场馆信息或弹层主按钮。
- 桌面预约票券、API、路由、鉴权、预约校验、人数边界、幂等提交和状态机保持不变。

## 风险

- `main.css` 中存在多轮历史移动覆盖，需使用预约路由和任务页作用域控制优先级。
- 应用内浏览器视口覆盖与实体浏览器工具栏存在差异，实体 iOS/Android 安全区仍需现场复核。
- 本轮不提交真实预约，提交成功态继续依赖既有测试与后续人工业务验收。

## 验证结果

- 专项测试：`MobileRouteRuntime.spec.ts`、`AppointmentMobilePerformance.spec.ts`、`glassMaterials.spec.ts` 与相关 Header 测试共 `4` 文件 / `37` 项通过。
- 前端全量 Vitest：`45` 文件 / `253` 项通过；`corepack pnpm typecheck` 与 `corepack pnpm build` 通过，初始 CSS gzip `46,126 B`，低于 `80,000 B` 预算。
- `corepack pnpm qa:pointer-pages`：`32/32` 页面/视口组合通过，无横向溢出、控件裁切或门禁失败。首次执行与 Docker 重启并行，最后一个商城用例等待 `#shop-products` 超时；服务稳定后完整重跑通过。
- 正式 Docker：前端镜像 `sha256:1ef7d4d9e47bb1e4de80169367f349bd159e67f8823bc4b5d4e58600d2af48bb`，`/appointment` HTTP `200`，API health `data.status=UP`。
- 正式页面：`320×800` 中文浅色、`390×844` 中文浅色/深色和 `320×800` 英文深色均无横向溢出；Header 控件无裁切，移动英文步骤不拆字，日期选中后首个时段自动选中，填写入口由禁用转为可用。
- 预约 BottomSheet 可打开，日期/时段摘要、联系人字段和 `44×44px` 人数步进器显示正常，人数 `1 → 2 → 1`；浏览器控制台 `warning/error` 为 `0`。
- 未验证：实体 iOS/Android 浏览器工具栏与安全区、真实软键盘顶起、触控笔、Windows 强制颜色/高对比度；本轮未提交真实预约。
