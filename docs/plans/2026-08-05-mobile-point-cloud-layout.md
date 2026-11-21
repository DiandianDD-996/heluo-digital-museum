# 移动端点云与展厅 Dock 稳定性

## 目标

- 让移动端点云使用与桌面端完全相同的深墨玉与古铜金调色板。
- 修复 390px 等窄视口下导览、点云切换和视角缩略图的拥挤与潜在重叠。

## 关联需求

- F-05：数字展项支持实体/点云模式与多视角观察。
- N-03：前台页面在移动尺寸下保持可读、可操作且无横向溢出。
- N-06：交互状态和视觉材质保持统一。

## 影响范围

- `frontend/src/lib/pointCloudQuality.ts`
- `frontend/src/lib/pointCloudQuality.spec.ts`
- `frontend/src/assets/main.css`

不修改路由、API、数据库、Vue 数据结构、Three.js 模型加载和点云交互逻辑。

## 实施

1. 将点云 palette 抽为单一共享常量，设备层级仅保留点数预算和渲染性能差异。
2. 在 760px 以下将展厅 Dock 改为单列；导览区和视角区使用明确的分隔与独立滚动容器。
3. 固定移动视角按钮的宽高，点云/实体切换按钮允许窄屏换行；为 390px 以下再收紧间距。
4. 通过材质契约测试，确保新增布局规则不引入未命名颜色。

## 验收标准

- `mobile`、`medium`、`high`、`fallback` 返回同一 palette。
- 390px 视口 `scrollWidth === clientWidth`，导览区与视角区矩形不相交。
- 五个视角缩略图保持固定尺寸并可横向滚动；点云切换后状态变为“点云已开启”，Canvas 非空。
- 1433px 桌面三栏 Dock 不重叠。

## 验证结果

- `pnpm test`：20 个测试文件、72 项测试通过。
- `pnpm typecheck`：通过。
- `pnpm build`：通过；仅保留既有大 chunk 与 Rollup 注释提示。
- `git diff --check`：通过。
- Docker 前端已使用本次 `dist` 热更新并固化为 `deploy-frontend:latest`，`http://localhost:8088/` 返回 200，健康检查为 `UP`。
- 浏览器 `390×844` 与 `1433×746`：无横向溢出、Dock 内部无重叠、点云交互和 Canvas 正常。当前环境记录到一条既有 Three.js WebGL 精度 warning，无页面 error。

## 未完成项

- 当前没有可枚举的真实手机设备；实体设备触摸性能和系统级辅助功能仍需后续补验。
