# 恢复点云深度与原有配色层次

## 目标

- 修复点云模式中鼎的前后表面粒子同时透叠、深墨玉与古铜金被压成黑白噪点的问题。
- 恢复用户此前认可的点云颜色层次，同时保留 shader 预热、连续解构和可中断双向切换。

## 关联需求

- F-05：3D 展项支持清晰、稳定的实体与点云观察。
- N-03：桌面与移动端点云轮廓可辨，切换无闪烁、卡顿或布局溢出。
- N-06：点云材质行为具有专项测试和可追踪验证记录。

## 影响范围

- `frontend/src/components/ThreeExhibitViewer.vue`
- `frontend/src/components/ThreeExhibitViewer.spec.ts`
- `docs/plans/2026-08-06-exhibit-mode-transition-smoothness.md`
- `PROJECT_STATUS.md`
- `docs/01-requirements-traceability.md`

不修改点云 palette、fragment shader、点数分档、GLB、相机、API、路由和业务状态机。

## 根因

点云使用透明粒子，但上一轮将 `ShaderMaterial.depthWrite` 关闭后，鼎背面、内壁和正面的粒子会同时参与透明混合。高密度粒子在月白背景上叠加，原有深墨玉主体和少量古铜金高光因此失去层次，视觉上变成密集的黑白噪点。

## 实施步骤

1. 恢复点云 `ShaderMaterial` 的深度写入，让前表面粒子正确遮挡背面和内部粒子。
2. 更新预热与中途反向专项测试，锁定点云在零透明预编译阶段仍启用深度写入。
3. 修正上一轮实施计划、项目状态和需求追踪中的错误技术记录。
4. 执行专项测试、全量前端测试、类型检查、生产构建和 diff 检查。
5. 重建 Docker 前端，并在正式桌面与移动页面复核点云配色、切换连续性、Canvas 和响应式布局。

## 验收标准

- 点云恢复深墨玉主体和少量古铜金层次，不再呈现密集黑白噪点。
- 桌面与移动端共用既有 palette，未发生颜色数值漂移。
- 首次切换仍使用预编译 shader；解构中途反向不跳变。
- `1433x746` 与 `390x844` Canvas 非空且唯一，无横向溢出或控制台新增错误。

## 风险

- 透明粒子恢复深度写入后，过渡初期会写入深度缓冲；现有实体与点云透明度连续状态机仍负责控制过渡，不额外改动 shader 或混合模式。

## 验证结果

- `pnpm exec vitest run src/components/ThreeExhibitViewer.spec.ts`：4 项通过，覆盖零透明预热、`depthWrite: true` 和中途反向连续性。
- `pnpm test`：23 个测试文件、83 项全部通过。
- `pnpm typecheck`、`pnpm build`：通过；构建仅保留既有 VueUse 注释与 Three.js 大分包提示。
- `pnpm perf:pointer`：16 项性能、后台暂停、辅助功能与响应式门禁全部通过；点云实际激活，CPU `1x/4x` 均保持 `running`，4× CPU 动画帧回调最大约 `5.03ms`。
- Docker 前端重建并强制替换成功，实际运行镜像为 `sha256:1c97373e7037bd5cfd09de973d54b97fd2c43583da8c6bc2a9840199455e1549`；首页与展项均为 HTTP `200`，后端 health 为 `UP`。
- 正式桌面 `1433x746`：点云前表面重新正确遮挡背面与内壁，恢复深墨玉主体和少量古铜金层次；Canvas 唯一且为 `running`，无横向溢出或控制台 error。
- 正式移动 `390x844`：使用既有共享 palette，点云切换与中途反向成功；Canvas 唯一且为 `running`，无卡片重叠、横向溢出或控制台 error。
- 视觉证据保存在本地忽略目录 `artifacts/point-cloud-depth-color/desktop-1433x746.png` 与 `mobile-390x844.png`。
- `git diff --check`：通过。
