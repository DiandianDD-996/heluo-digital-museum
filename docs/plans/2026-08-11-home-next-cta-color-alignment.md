# 首页尾部入口配色统一

## 目标

根据首页真实浏览器标注，将“开始探索”的突兀绿色主按钮改为与右侧“进入数字展厅”一致的深色玻璃卡片，同时保持跳转、文案、图标和共享交互行为不变。

## 关联需求

- F-01 / F-05：探索馆藏与数字展厅入口保持可用。
- N-03 / N-06：深色主题视觉统一，按钮状态、键盘焦点与响应式行为保持完整。

## 影响范围

- `frontend/src/views/HomeView.vue`
- `frontend/src/test/HomeView.spec.ts`
- `PROJECT_STATUS.md`
- `docs/01-requirements-traceability.md`

## 实施与验收

1. 将首页尾部“开始探索”从 `FluidButton primary` 切换为与右侧相同的 `secondary` 变体。
2. 保留 `/explore` 与 `/exhibits` 跳转、文案、图标、按压和焦点行为。
3. 增加组件断言并运行测试、类型检查、构建、页面门禁、Docker 和真实浏览器回归。
4. 验收时确认两张入口卡使用相同材质，桌面与 `390x844` 无溢出或控制台错误。

## 风险与验证结果

- 本轮不修改共享 `FluidButton` 样式，避免影响其它主操作。
- `corepack pnpm test -- --reporter=dot`：通过，25 个测试文件 / 110 项测试全部成功。
- `corepack pnpm typecheck`、`corepack pnpm build`：通过；构建仅保留既有 `@vueuse/core` PURE 注释和 Three.js 分包体积提示。
- `corepack pnpm qa:pointer-pages`：通过，32 组页面门禁无横向溢出或控件裁切。
- Docker 前端已重建，首页 HTTP `200`、API health `UP`，镜像为 `sha256:7ae9c250f3e67f035f9f66c7c6e51f85aac77796a3123217af84fbe2854a1c5a`。
- 真实浏览器深色桌面与 `390x844` 下，两张入口均为 `fluid-button--secondary` 与 `data-glass="compact"`，背景、边框、阴影和文字色计算值一致；移动端均为 `342.67x64px`，无横向溢出或控制台错误。
- 实体手机、触控笔和系统强制颜色模式未复验。
