# 首页署名双主题位置修复

## 目标

修复首页主视觉右下角“洛阳 · 河洛文明主题展厅”在浅色、深色主题切换时横向跳动的问题，保持文案、背景素材、主题配色和页面交互不变。

## 关联需求

- F-01、F-12、F-14
- N-03、N-06

## 影响范围

- `frontend/src/assets/main.css`
- `frontend/src/assets/darkThemeCohesion.spec.ts`
- `PROJECT_STATUS.md`
- `docs/01-requirements-traceability.md`

## 原因

基础规则将署名定位为 `right: clamp(2.5rem, 7vw, 9rem)`，深色主题又覆盖为 `right: clamp(1.5rem, 3.4vw, 4.5rem)`。主题切换因此改变了同一元素的水平几何位置。

## 实施步骤

1. 删除深色主题对署名 `right` 的单独覆盖，让双主题共用基础定位。
2. 保留深色主题专用文字颜色，不改变背景图、遮罩、字号和移动端隐藏规则。
3. 增加 CSS 契约测试，阻止深色主题再次覆盖署名水平位置。
4. 运行专项测试、类型检查、生产构建、Docker 正式页面与双主题浏览器几何回归。

## 验收标准

- 同一桌面视口切换浅色和深色主题后，署名的 `left`、`right` 与底部位置一致。
- 首页无横向溢出，浏览器控制台无新增错误。
- 移动端继续按现有规则隐藏署名。

## 风险

- 本次只统一署名位置，不改变深浅主题背景图自身构图；两张背景素材的视觉内容仍可不同。

## 验证结果

- `corepack pnpm exec vitest run src/assets/darkThemeCohesion.spec.ts src/test/HomeView.spec.ts`：2 个测试文件、18 项测试全部通过。
- `corepack pnpm test`：28 个测试文件、127 项测试全部通过。
- `corepack pnpm typecheck`：通过。
- `corepack pnpm build`：通过；仅保留既有 Rollup PURE 注释提示和 Three.js 大分包提示。
- Docker 前端已按当前工作区重建并启动；首页返回 HTTP `200`，`/api/v1/health` 返回 `UP`。
- `1440×900` 正式首页双主题回归：署名 `left=1187.2084px`、`right=1323.8750px` 完全一致，计算值均为 `right=100.8px`、`bottom=20.8px`，页面无横向溢出。
- `390×844` 回归：署名继续为 `display: none`，页面无横向溢出。
- 本次首页浏览器会话控制台 `warn/error` 均为 0；浅色、深色截图目视确认署名处于相同水平位置。
- 实体手机、触控笔与系统级强制颜色未在本轮重复验证；本次改动仅涉及桌面主题署名横向定位。
