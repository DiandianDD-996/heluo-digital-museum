# 锁定点云切换过程配色

## 目标

- 修复实体与点云切换中段粒子在月白背景上发灰、发白的问题。
- 保持既有深墨玉与古铜金 palette 数值、最终点云效果和空间扩散轨迹不变。
- 保留 shader 预热、深度遮挡和任意时刻反向。

## 关联需求

- F-05：数字展项的点云观察应在完整切换过程中保持一致配色。
- N-03：桌面与移动端切换无闪白、跳帧或布局回归。
- N-06：过渡材质行为具有专项自动化测试。

## 影响范围

- `frontend/src/components/ThreeExhibitViewer.vue`
- `frontend/src/components/ThreeExhibitViewer.spec.ts`
- `PROJECT_STATUS.md`
- `docs/01-requirements-traceability.md`

不修改 `selectPointCloudPalette`、点数分档、GLB、相机、扩散幅度、API 和路由。

## 根因

点云 RGB 在切换中没有改变，但旧过渡将整片点云的 alpha 从 `0` 连续提高到 `1`。深墨玉粒子以低 alpha 与月白展厅合成后，屏幕呈现色会暂时接近浅灰白；同时透明片元仍参与深度写入，进一步削弱实体与点云的层次。

## 实施步骤

1. 保持每颗已显示粒子的 alpha 为既有 `uPointOpacity`，不再使用整片低 alpha 淡入。
2. 复用稳定 seed，通过 `uTransition` 逐颗显示或隐藏粒子；未显示片元直接 `discard`，避免透明片元写深度。
3. 保留 `uProgress` 空间扩散、`smootherStep + sin²` 曲线和双向反转状态机。
4. 增加过渡中段颜色锁定、零透明预热和反向连续性测试。
5. 运行专项/全量测试、类型检查、构建、性能门禁、Docker 和桌面/移动实页验证。

## 验收标准

- 过渡中点已出现粒子与最终点云使用完全相同的 RGB 和单粒子 alpha。
- 未出现的粒子不参与颜色合成或深度写入。
- 最终点云 palette、轮廓和前后表面遮挡不变。
- `1433x746` 与 `390x844` 切换无白色粒子、横向溢出或控制台错误。

## 风险

- 逐颗显隐若阈值分布不均会形成局部空洞；使用现有均匀确定性 seed，保持高密度点云的连续覆盖。

## 验证结果

- 待执行。
