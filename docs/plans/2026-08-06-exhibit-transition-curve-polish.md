# 数字展项实体与点云切换曲线精修

## 目标

- 消除旧四段式解构在阶段交界处的速度变化和短暂轮廓失焦。
- 让实体进入点云、点云返回实体以及动画中途反向都从当前帧连续过渡。
- 保留已经恢复的深度关系和既有深墨玉/古铜金 palette。

## 关联需求

- F-05：3D 展项支持稳定、可重复的实体与点云观察。
- N-03：桌面与移动端切换连续，无闪烁、卡死或布局溢出。
- N-06：切换状态机具有专项测试和可追踪验证记录。

## 影响范围

- `frontend/src/components/ThreeExhibitViewer.vue`
- `frontend/src/components/ThreeExhibitViewer.spec.ts`
- `PROJECT_STATUS.md`
- `docs/01-requirements-traceability.md`

不修改点云颜色、fragment shader、深度写入、GLB、点数分档、相机、API、路由和业务数据。

## 实施步骤

1. 删除首次切换专用的四段时间轴，统一使用可中断 `PointCloudTransition`。
2. 透明度继续使用端点速度为零的 `smootherStep`；粒子聚合进度叠加一条同样零速度起止的浅弧线。
3. 首次进入点云使用约 `1.25s` 的完整轮廓解构，返回与中途反向按剩余距离缩短，避免等待和拖沓。
4. 减少动态模式禁用空间弧线，仅保留短时连续淡变。
5. 增加首切中点轮廓、中途返回、返回中途再次进入点云的专项测试。

## 验收标准

- 首次进入点云只有一条连续速度曲线，不出现分段停顿或轮廓完全散失。
- 任意方向中途反向后，下一帧透明度与粒子位置不跳变。
- 完成态仍为实体 `mix=0/gather=1` 或点云 `mix=1/gather=1`。
- `1433x746` 与 `390x844` Canvas 唯一且为 `running`，无横向溢出或控制台新增错误。

## 风险

- 粒子散开幅度降低后，解构更克制；通过保留中段浅弧线维持数字展项的空间感。

## 验证结果

- `pnpm exec vitest run src/components/ThreeExhibitViewer.spec.ts`：4 项通过；覆盖首切中点轮廓、返回实体连续性和返回途中再次进入点云。
- `pnpm test`：23 个测试文件、84 项全部通过。
- `pnpm typecheck`、`pnpm build`、`git diff --check`：通过；构建仅保留既有 VueUse 注释与 Three.js 大分包提示。
- `pnpm perf:pointer`：16 项性能、后台暂停、辅助功能和响应式门禁全部通过；CPU `1x/4x` 点云均实际激活并保持 `running`，4× CPU 动画帧回调最大约 `2.85ms`。
- Docker 前端重建并强制替换成功，实际运行镜像为 `sha256:d38e15ca3e977173bea47b3c5c02f86fdcfc7ddefc1e476b1b1fd3984f2bb569`；首页与展项均为 HTTP `200`，后端 health 为 `UP`。
- 正式桌面 `1433x746`：首切中点仍能辨认鼎耳、器腹和三足；连续“返回实体 -> 进入点云 -> 再返回实体”最终状态正确，Canvas 唯一且为 `running`，无横向溢出或控制台 error。
- 正式移动 `390x844`：中点轮廓、最终点云、Dock 和视角区正常，无卡片重叠、横向溢出或控制台 error。
- 动画中点和完成态证据保存在本地忽略目录 `artifacts/exhibit-transition-polish/`。
- 2026-08-07 用户复核确认上一轮将空间弧线收至 `28%` 后扩散存在感不足；已由 `2026-08-07-restore-point-cloud-diffusion.md` 恢复 `78%` 扩散幅度与 `1.8s` 节奏，同时保留本计划的连续曲线和反向状态机。
