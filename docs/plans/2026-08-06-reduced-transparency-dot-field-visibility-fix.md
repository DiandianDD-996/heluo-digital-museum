# 减少透明度模式下点阵动效可见性修复

## 目标

修复 Windows 关闭透明效果后，浏览器报告 `prefers-reduced-transparency: reduce`，导致首页、馆藏、数字展厅列表和商城顶部的鼠标点阵完全不可见的问题。

## 关联需求

- F-01 / F-02 / F-03 / F-05 / F-09：公开前台浏览与交互。
- N-03：响应式、输入方式与系统偏好适配。
- N-06：前端测试、构建与可维护性。

## 影响范围

- `PointerDotField` 的系统偏好策略及组件测试。
- 指针性能审计中减少透明度门禁。
- Docker 前端镜像与浏览器实页回归。

不修改后端、业务 API、路由、权限、预约、订单、支付或 Three.js 交互。

## 实施步骤

1. 保留减少透明度模式下的点阵动画，只关闭依赖透明叠加的 Surface 探照层。
2. 点阵在该模式使用不透明青玉与古铜色，避免与背景混合后不可见。
3. 更新组件测试和性能门禁，要求点阵可见、非阻塞且使用 `opaque` palette。
4. 执行类型检查、单元测试、构建、性能审计、页面映射、Docker 重建和实际浏览器复核。

## 验收标准

- Windows 减少透明度开启时，首页点阵仍可见并响应鼠标。
- `prefers-reduced-motion`、高对比度、强制颜色、触摸和受限性能档仍关闭点阵动画。
- Surface 透明探照层在减少透明度模式下保持关闭。
- 点阵不阻塞点击，不产生横向溢出或持续空转 RAF。
- 前端检查、Docker 和实页验证通过。

## 风险

- 不透明点阵可能在浅色背景上更明显；仅在系统明确要求减少透明度时使用，并继续限制在四个批准的顶部主视觉。

## 验证结果

- 根因确认：实际浏览器加载的 Docker 资源为 `index-DJ3TQ8iJ.js`，不是旧镜像；但 Windows 系统偏好使 `prefers-reduced-transparency: reduce` 为真，旧逻辑因此把点阵设为 `disabled` 且 `opacity: 0`。
- 修复完成：减少透明度模式不再关闭点阵，Canvas 使用 `data-palette="opaque"` 的不透明青玉/古铜色；Surface 探照层仍关闭。减少动态、高对比度、强制颜色、触摸和受限性能档的静态降级不变。
- 前端 23 个测试文件/78 项全部通过，`pnpm typecheck` 与 `pnpm build` 通过；仅保留既有 Three.js 大分包提示。
- `pnpm perf:pointer-size` 通过：交互 JS `14,690 B minified / 5,455 B gzip`，无布局属性 transition。
- `HELUO_PERF_DURATION_MS=2000 pnpm perf:pointer` 的 16 项门禁全部通过；新增 `reducedTransparencyKeepsOpaqueDotField` 门禁通过。
- `pnpm qa:pointer-pages` 在首页、馆藏、数字展厅列表和商城的八档尺寸共 32 组通过，无横向溢出、控件裁切或 Canvas 点击阻断。
- Docker 前端执行 `--no-cache` 完整重建并强制替换容器；运行容器和 `deploy-frontend:latest` 均为 `sha256:eb84cb46d7cec8b55cc29bd5fe0e0161e54c6748e8911cd49257911d29283527`。
- 实际浏览器重新加载后资源变为 `index-8ffjgXiW.js`；在 `reducedTransparency: true` 下点阵计算状态为 `active`、`palette: opaque`、`opacity: 1`，截图确认点阵可见。
