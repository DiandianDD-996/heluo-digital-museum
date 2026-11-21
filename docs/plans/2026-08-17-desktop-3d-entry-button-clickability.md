# PC 端 3D 入口按钮可点击性优化

## 目标

优化 `/exhibits/heluo-bronze-ding-3d` 在受限 PC 设备上显示的“进入互动 3D”按钮，使鼠标点击区域清晰、稳定且可通过键盘识别，同时保留现有按需启动策略和 Viewer 状态机。

## 关联需求

- `F-05`：3D 展项浏览与交互。
- `F-12`：响应式与跨设备可用性。
- `F-14`：前台中英文界面。
- `N-03`：可用性与无障碍。
- `N-06`：浏览器兼容性。

## 影响范围

- `frontend/src/assets/route-exhibit-detail-legacy.css`
- `frontend/src/views/ExhibitDetailView.spec.ts`
- `frontend/src/assets/ExhibitEntryAction.spec.ts`
- `PROJECT_STATUS.md`
- `docs/01-requirements-traceability.md`

## 实施步骤

1. 核对受限 PC 环境下手动启动海报的 DOM、层级与现有点击尺寸。
2. 将桌面主操作扩展为稳定的整宽命中区，补齐层级、指针行为、hover/active 与 `focus-visible` 状态。
3. 让封面图片等非交互装饰不参与命中，避免遮挡按钮。
4. 增加细指针、桌面宽度、低内存场景的启动行为测试和 CSS 合同测试。
5. 运行专项测试、前端全量测试、类型检查、生产构建、页面映射审计与正式 Docker 页面回归。

## 验收标准

- `1433px` 与 `1280px` 桌面受限环境中，主按钮至少 `52px` 高、稳定宽度不小于 `240px`，鼠标光标与命中层级明确。
- 点击按钮后状态从 `poster` 进入 Viewer 初始化，并沿用受限设备的轻量模型选择规则。
- 浅色和深色主题的按钮几何、交互状态与焦点环一致。
- 移动端既有双操作布局、模型按需加载、模式切换、相机与资源释放逻辑不回归。

## 风险

- 页面 CSS 存在多层历史覆盖，必须以正式 Docker 页面计算样式与命中测试为准。
- 普通高性能 PC 会自动进入 Viewer，桌面入口只在省流量、慢网或低内存等受限环境出现；测试需显式模拟该条件。
- 工作树包含大量既有改动，本任务只做相关文件的增量修改，不重置、不提交。

## 验证结果

- 专项 Vitest：`2` 文件 / `8` 项通过。
- 前端全量 Vitest：`45` 文件 / `250` 项通过。
- `pnpm typecheck`：通过。
- `pnpm build`：通过；仅保留既有 Rollup 注释和 Three.js 大 chunk 提示。
- `pnpm qa:pointer-pages`：`32` 组视口审计通过，全部门禁为 `true`。
- 正式 Docker 前端重建成功，镜像为 `sha256:b9f89e150b31e9af66dfd541fab6cc9b7abdc9e8d83c0c1094566695f70e04fa`；页面 HTTP `200`，health `data.status=UP`。
- 应用内浏览器高性能 PC 自动启动路径为 `ready`，Canvas 非空，页面横向溢出为 `0`。
- 未验证：该浏览器无法覆写 `navigator.deviceMemory`，未在正式页面强制重现受限 PC 海报；实体低内存 PC、真实慢网/省流量、触控笔和系统强制颜色仍待现场验收。
