# 公开页品牌双语间距修复

## 目标

修复公开页顶部品牌主馆名与副标间距过紧的问题，并避免切换到英文时上下两行重复显示“Heluo Digital Museum”。

## 关联需求

- F-01：公开前台品牌展示。
- F-12：中英文界面与语言切换。
- N-03、N-06：响应式与可维护性。

## 影响范围

- `frontend/src/App.vue`
- `frontend/src/assets/main.css`
- `frontend/src/test/PublicHeaderBrand.spec.ts`
- `PROJECT_STATUS.md`
- `docs/01-requirements-traceability.md`

## 实施步骤

1. 为两种语言分别定义品牌副标，保持“当前语言主馆名 + 另一语言副标”的双语层级。
2. 提升品牌文字区的垂直间距，同时保持现有导航高度和响应式隐藏规则。
3. 新增专项契约测试，防止英文主副标重复或间距回归。

## 验收标准

- 中文界面显示“河洛数字博物馆 + HELUO DIGITAL MUSEUM”。
- 英文界面显示“Heluo Digital Museum + 河洛数字博物馆”，不再重复英文。
- 桌面端两行之间有清晰留白，深浅主题均不粘连。
- 平板与手机继续遵循现有隐藏副标规则，导航不溢出。

## 风险

- 公开导航存在多层深浅主题覆盖；本次只调整共享品牌基础层，不改颜色与导航布局。

## 验证结果

- `pnpm exec vitest run src/test/PublicHeaderBrand.spec.ts`：1 个测试文件、2 项通过。
- `pnpm test`：29 个测试文件、129 项通过。
- `pnpm typecheck`、`pnpm build`、目标文件 `git diff --check`：通过；构建仅保留既有 Three.js 大分包提示。
- `pnpm qa:pointer-pages`：首页、馆藏、展厅列表、商城在 8 档视口共 32 组门禁通过，无横向溢出或控件裁切。
- Docker 前端镜像已重建并替换，镜像为 `sha256:cd8f6f3c39f83054832346bc95cefe2e83fb2757f130bbce55c320a55c875636`；首页 HTTP `200`，API health `UP`。
- 正式 `http://localhost:8088` 实页在 `1440×900` 下完成浅色/深色 × 中文/英文四组量取：主副标净间距均为 `5.44px`，文案组合正确，无横向溢出；`390×844` 副标按原规则隐藏，控制台无 `warn/error`。
- 未重复执行实体手机、触控笔和系统级强制颜色人工复验。
