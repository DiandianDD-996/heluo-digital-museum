# 月白器座：全站可触感 UI 组件系统实施计划

## 目标

解决现有页面中按钮、输入框、搜索框和信息卡「只有颜色变化、缺少材质层级与按压反馈」的问题。为河洛数字博物馆建立一套与既有“月白厅堂 / 河洛纸墨”设计系统一致的 **月白器座（Moonstone Tactile）** 共享组件层：用细边、内高光、受控阴影、实体按压和明确焦点表达材质，不改变业务流程或视觉母版。

## 关联需求

- `F-01` / `F-02` / `F-03`：首页、馆藏与内容阅读的浏览和检索可用性不变。
- `F-04` / `F-11`：后台内容与运营工作台的表单、筛选和操作仍保持原权限和数据行为。
- `F-05` / `F-06` / `F-08` / `F-09`：3D、预约、账户和商城的既有按钮/表单/卡片交互不变。
- `F-12` / `F-13`：中英文和主题状态下的控件文案、权限边界不变。
- `N-03` / `N-06`：桌面与移动端无关键遮挡或横向溢出；保留可见焦点、键盘语义、禁用/加载/错误态和减少动态/高对比度/强制颜色降级。

## 设计审查与 Galaxy 候选

本轮 Product Design 实页审查在正式 Docker `http://localhost:8088` 完成，已保存并目视检查：

- `docs/design/audit/2026-08-14-tactile-ui-system/before/01-home-desktop.png`
- `docs/design/audit/2026-08-14-tactile-ui-system/before/02-explore-desktop.png`
- `docs/design/audit/2026-08-14-tactile-ui-system/before/04-explore-mobile.png`
- `docs/design/audit/2026-08-14-tactile-ui-system/before/05-appointment-mobile.png`

主要发现：前台主按钮、移动预约操作和搜索提交区都有明确色彩，但只有单层平面；搜索框缺少输入凹槽、操作端与承载卡之间的材质差；馆藏/后台信息面大多只有一层边框，悬停和键盘焦点没有形成稳定的“展签/器座”层级。

已按 `uiverse-galaxy` 本地目录检索并打开候选：

| 类别 | Galaxy 候选 | 采用判断 |
|---|---|---|
| 按钮 | `Buttons/SujitAdroja_strong-bullfrog-56.html` | 采用其“覆盖层随 hover 进入”的交互结构作为灵感；原示例黑色、圆形扩展和无障碍态不适配，不能直接粘贴。 |
| 搜索输入 | `Inputs/TimTrayler_orange-bat-25.html` | 采用其“图标 + 输入凹槽 + 末端操作”的结构方向；原示例是 Google 式全圆角白框，不适配博物馆设计。 |
| 卡片 | `Cards/alexreyes091_hard-firefox-84.html` | 采用其“边缘方向性和抬升阴影”的层级思路；原紫色多重阴影与卡片语义不适配。 |

没有发现可在本项目中**原样替换**且同时满足品牌、响应式、键盘可达性和现有 Vue API 的成熟组件。因此将以这三个已审查候选为可追溯灵感，使用项目令牌创建产品原生组件层，不引入运行时依赖。

Galaxy 来源：`uiverse-io/galaxy`，MIT，快照提交 `adbd2adde0a299a3956ea288fb444ec01891ca41`。

## 影响范围

### 计划修改

- `frontend/src/assets/tokens.css`：补充共享触感表面、内高光和焦点令牌。
- `frontend/src/assets/tactile-ui.css`：新增组件级“月白器座”样式，统一共享按钮、搜索、卡片和任务/后台字段。
- `frontend/src/main.ts`：在现有主题层之后引入新组件层。
- `frontend/src/components/FluidButton.vue`：保留 API，补充可测试的主/次/危险按钮材质层。
- `frontend/src/components/MuseumSearchField.vue`：保留 v-model/submit/clear，补充语义搜索图标与可测试外壳。
- `frontend/src/components/EditorialCard.vue`、`frontend/src/components/AdminActionButton.vue`：将卡片与后台操作接入同一材质合同。
- 关键公开页面与后台页面的既有卡片/表单选择器：只接入新视觉合同，不修改路由、接口、鉴权或状态机。
- 相关 Vitest 契约测试、`PROJECT_STATUS.md`、`docs/01-requirements-traceability.md`。

### 不修改

- 后端接口、数据库迁移、登录/权限判定、预约状态机、购物车/模拟支付、Three.js 场景和资源生命周期。
- 当前工作区内与本任务无关的未提交改动；不提交、推送、重置或清理工作区。

## 实施步骤

1. 在语义令牌层定义“器座”表面、内高光、内描边、浮起和按压阴影，分别覆盖浅/深主题。
2. 改造共享 `FluidButton` 与 `AdminActionButton`：主操作形成细边+上沿高光+下沿承重阴影；次操作形成纸面器座；按下仅压缩 1px；保留 loading/error/success/disabled/focus 与 reduced-motion。
3. 改造 `MuseumSearchField`：在不改变表单语义的前提下加入前置检索标记、凹槽输入区和独立的提交器座；在窄屏保持至少 44px 触控高度且不造成双清除按钮。
4. 改造 `EditorialCard` 与现有高频卡片/任务字段：以双层内框、受控媒体边和焦点环强化“展签置于器座”的层级；不把全站改成圆角卡片墙。
5. 为预约、登录/账户、商城、后台创建/编辑/筛选等原生字段追加共享字段表面；不改字段 DOM 值、验证或 Element Plus 控件行为。
6. 新增/更新组件契约测试，运行类型检查、相关与全量 Vitest、生产构建、映射/性能检查和 `git diff --check`。
7. 重建前端 Docker，实际在桌面与 `390×844` 页面检查首页、Explore 搜索/卡片、预约表单/主操作、商城和后台；保存并检查 after 截图。

## 验收标准

- 主、次、危险、禁用、加载、成功、错误和键盘焦点状态具备可辨识但克制的材质层级；按钮高度不低于 44px（既有后台紧凑操作使用既有例外）。
- `/explore` 搜索仍能键盘提交、清除、展示 loading/error；桌面和 `390×844` 仍无横向溢出。
- `EditorialCard` / Explore 卡片 / 预约信息卡与后台记录卡有可复用的内框、表面和 hover/focus 层次，媒体、文字、跳转和卡片语义不变。
- 预约、登录、商城和后台输入框/下拉框/文本域保持原校验、提交、权限和业务状态机，且浅深主题可读。
- `prefers-reduced-motion`、高对比度、减少透明度和 `forced-colors` 下不依赖阴影或动画传达状态。
- Docker 实页包含最新 bundle；关键桌面/移动截图通过目视检查；未通过或未执行的验证如实记录。

## 风险

- 既有 `main.css` 含大量历史页面选择器，新的共享组件层必须后置导入并避免覆盖业务布局。
- 视觉强化必须不引入高饱和渐变、过大圆角、持续动画或新运行时依赖。
- 当前工作区已有大量未提交改动；只在目标组件和新增组件层上叠加改动，完成前按路径审查 diff。

## 验证结果

- 组件契约：`frontend/src/assets/TactileUi.spec.ts` 与既有共享组件契约覆盖通过；全量 `pnpm test` 为 `35` 个文件 / `167` 项通过。
- 工程门禁：`pnpm typecheck`、`pnpm build`、`pnpm perf:pointer-size`（JS `17,932 B` / gzip `6,621 B`，CSS `7,233 B` / gzip `1,833 B`）和 `git diff --check` 通过。构建仅保留既有 VueUse PURE 注释与 Three.js 大 chunk 警告。
- Docker/HTTP：已执行 `docker compose --env-file deploy/.env -f deploy/compose.yaml up -d --build --no-deps frontend`；`/`、`/explore`、`/appointment`、`/shop` 返回 `200`，`/api/v1/health` 返回 `data.status=UP`。
- Product Design 实页回归：应用内浏览器在正式 Docker `1440×900` / `390×844` 检查 Explore 搜索和卡片、搜索“青铜”点击提交（返回 `3` 项）、预约日期/时段/信息面板、商城商品卡、浅深主题切换；控制台 error 为 `0`。after 截图位于 `docs/design/audit/2026-08-14-tactile-ui-system/after/`。
- 未通过/未执行：`pnpm qa:pointer-pages` 和 `HELUO_PERF_DURATION_MS=10000 pnpm perf:pointer` 被既有脚本等待不存在的 `.collection-head` 就绪选择器阻断；未改动该不属于本任务的审计脚本。实体手机、触控笔、系统级强制颜色、真实慢网加载和管理员 CRUD 仍需现场补验。本轮未提交 Git commit。
