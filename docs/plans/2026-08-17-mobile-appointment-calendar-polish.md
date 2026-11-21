# 移动端预约日历优化

## 目标

将移动端预约日期选择从信息隐藏在系统下拉菜单中的原生选择器，优化为直接可浏览、可横向滑动的未来 14 天日期卡带；同时修正中文标题使用旧宋体回退造成的过细、字面不均问题，提升触控效率、状态辨识、中文排版和浅深主题一致性。

## 关联需求

- `F-06/F-12/F-14`
- `N-03/N-06`

## 影响范围

- `frontend/src/views/AppointmentView.vue`
- `frontend/src/assets/task-pages.css`
- `frontend/src/test/MobileRouteRuntime.spec.ts`
- `PROJECT_STATUS.md`
- `docs/01-requirements-traceability.md`

## 实施步骤

1. 保留未来 14 天与后端可预约时段的既有数据合同，将移动端原生下拉框替换为日期卡带。
2. 每个日期直接呈现星期、日期、可预约/无时段状态；不可预约日期保持原有禁用逻辑，选择日期继续自动选中首个可用时段。
3. 日期卡保持稳定尺寸、横向滚动吸附、触控滚动、焦点环、按压反馈以及浅深主题令牌。
4. 移动端中文标题、正文、步骤和状态文字使用现代 CJK 无衬线字体栈，统一字重、行高与零字距；日期数字保留展示字体和等宽数字特性。
5. 保留桌面日期条、预约提交、登录跳转、人数边界、幂等键和 BottomSheet 流程。
6. 运行专项测试、全量测试、类型检查、生产构建、页面映射和正式 Docker 移动实页回归。

## 验收标准

- `390×844` 移动端无需打开系统下拉菜单即可浏览未来 14 天日期。
- 日期卡触控高度不低于 `108px`，可预约、不可预约和当前选择状态清晰。
- 日期卡横向滚动不造成页面级横向溢出，浅色与深色主题均可读。
- 中文移动端不再使用 `STSong/SimSun` 作为预约标题主字体；标题、步骤和日历状态具有清晰字重层级，英文排版保持不变。
- 桌面日期条、时段选择、预约业务状态和接口合同不变。

## 风险

- 移动日期卡会增加首屏纵向高度，因此使用单行横向卡带，不展开完整月历。
- 真实 iOS/Android 浏览器工具栏、触控惯性和系统强制颜色仍需实体设备验收。

## 验证结果

- 专项 `MobileRouteRuntime.spec.ts`、`taskPagesTheme.spec.ts`、`AppointmentMobilePerformance.spec.ts`：`3` 文件 / `19` 项通过。
- 全量前端 Vitest：`45` 文件 / `251` 项通过；`corepack pnpm typecheck`、`corepack pnpm build`、`corepack pnpm qa:pointer-pages` 和任务文件 `git diff --check` 通过。构建仅有既有 Rollup 注释和大 chunk 提示。
- 正式 Docker 前端镜像 `sha256:aeee030873e1a63a3c54a690e9e05f4cfd760ac6d766d26ffb72049877bcc17c` 已运行；`/appointment` 返回 HTTP `200`，`/api/v1/health` 返回 `data.status=UP`。
- `390×844` 浅色/深色实页均渲染 14 个日期卡，其中当前数据有 6 个可预约日期；点击首个可预约日期后 `aria-pressed=true`、选中卡高度 `108px`，同步显示 3 个时段，页面横向溢出为 `0`。
- `320×800` 深色实页中日历宽 `276.125px`、日期卡 `82×108px`、标题横向溢出 `0`、页面横向溢出 `0`。中文浅色实页中标题、正文、步骤与日历标题计算字体均切换到 `PingFang SC / Microsoft YaHei UI / Noto Sans CJK SC` 栈，主标题为 `34.4px / 42.656px / 580`、稳定两行且页面横向溢出为 `0`。
- 实体 iOS/Android 浏览器工具栏、触控惯性、触控笔、Windows 强制颜色/高对比度和真实慢网未在本轮验收；未提交真实预约，未执行 Git commit。
