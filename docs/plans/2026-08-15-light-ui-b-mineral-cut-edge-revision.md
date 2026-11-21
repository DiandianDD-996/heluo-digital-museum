# 浅色 B 方案「青灰石刻」材质修订计划

- 日期：2026-08-15
- 目标：将用户在真实 `/explore` 页面效果图中选定的 B 方案「青灰石刻 / Mineral Cut Edge」正式落地到浅色共享 UI 材质层，替换上一轮存在感过强的深色粗边框。
- 视觉目标：暖灰米白矿物面、轻薄石刻切边、低面积古铜细线和中等灰青操作面；通过细内沿、高光、接触阴影和状态层次呈现立体感，不使用厚重深玉外圈或纸片式底条。
- 用户决策：用户回复 `B`，确认采用 `artifacts/explore-variant-previews-v2/explore-B-mineral-cut-edge-top.png` 与 `artifacts/explore-variant-previews-v2/explore-B-mineral-cut-edge-cards.png` 所示方向。

## 需求与边界

- 关联需求：F-01、F-02、F-03、F-05、F-06、F-08、F-09、F-11、F-12、F-13、N-03、N-06 的浅色共享控件表现层。
- 覆盖对象：卡片/面板、Explore 搜索框、主次按钮、清除按钮、复选框、原生字段、分段/日期/时段控件、状态徽章和后台工作区表面。
- 保持不变：API、路由、鉴权、搜索/筛选、预约/订单状态机、模拟支付、SKU 数据、Three.js 生命周期和深色主题。
- 参考方式：效果图只作为材质比例与细节参考，不作为运行时图片资源；生产页面继续使用现有真实馆藏与商城媒体。

## 影响文件

- `frontend/src/assets/light-ui-material-depth.css`：把浅色 token、阴影、边线和状态层改为 B 方案，去除深色多重外圈。
- `frontend/src/assets/LightUiMaterialDepth.spec.ts`：将材质合同更新为 B 方案，并增加禁止深色粗环的回归断言。
- `docs/plans/2026-08-15-light-ui-b-mineral-cut-edge-revision.md`：记录本次决策、实施、验收和验证结果。
- `PROJECT_STATUS.md`：记录 B 方案成为当前浅色材质方向及真实回归证据。
- `docs/01-requirements-traceability.md`：在需求追踪历史中记录本次浅色共享材质修订。

## 实施步骤

1. 读取当前浅色材质层、Explore 页面样式和既有组件测试，确认不修改业务组件契约。
2. 将颜色 token 改为 B 方案的暖矿物面、灰青操作面、石材边缘与低面积古铜细节。
3. 用单层细边线、内沿高光和克制接触阴影替换 `3px/4px` 深色多重外圈；保留键盘焦点环作为可访问性状态。
4. 让搜索框/原生字段使用独立凹槽材质，复选框/按钮/分段控件使用明确的 default、hover、focus、pressed、disabled 状态。
5. 运行专项测试、全量测试、类型检查和生产构建，再在正式 Docker `/explore` 页面复核 computed styles、桌面/移动截图和深色隔离。

## 验收标准

- 浅色卡片没有深色粗外圈；边缘由浅石材线、内沿细线和低强度阴影构成，视觉上能看出材质厚度。
- 按钮主操作为中等灰青色实体面，古铜只作为细边/高光/焦点细节；次按钮、搜索框和复选框不会变成深色纸片。
- Explore 首屏搜索卡、搜索框、筛选分段、重点馆藏、目录卡和延伸阅读卡统一采用 B 材质，媒体仍完整可见。
- 深色主题不被浅色变量覆盖；hover/focus-visible/pressed/disabled 与 reduced-motion、contrast、forced-colors 分支保留。
- 真实页面无横向溢出、按钮裁切、搜索输入不可读或核心交互回归。

## 风险

- 历史 Explore 页面样式仍存在多层渐变和伪元素；必须以 `main.ts` 最后导入的浅色材质层为最终覆盖层，并用真实页面 computed styles 验收。
- 增加浅色渐变可能在高对比度或系统强制颜色下失去材质细节，因此降级分支必须取消渐变并保留实色边界。
- 复选框在公开业务页的真实挂载点有限，需要保留现有 specimen/组件契约测试作为结构证据。

## 实施结果

- 已将 `light-ui-material-depth.css` 的浅色 tokens、渐变面、石材边缘、古铜细线和状态阴影改为 B 方案；卡片不再使用 `3px/4px` 深玉多重外圈。
- 已统一卡片/面板、Explore 搜索框、主次按钮、搜索提交/清除、复选框、原生字段、筛选/日期/时段/后台分段和状态徽章；保留原有 Vue 组件标记、事件、表单和业务逻辑。
- 已保留 `prefers-reduced-motion`、`prefers-reduced-transparency`、`prefers-contrast`、`forced-colors` 和深色主题隔离；B 方案效果图没有进入生产静态资源。

## 验证结果

- `corepack pnpm exec vitest run src/assets/LightUiMaterialDepth.spec.ts`：专项 `1` 个文件 / `4` 项通过。
- `corepack pnpm test`：全量 `36` 个文件 / `171` 项通过。
- `corepack pnpm typecheck`：通过。
- `corepack pnpm build`：通过；保留既有 `@vueuse` PURE 注释和 Three.js 大分包 warning。
- `git diff --check`：通过（工作区已有多处历史 dirty 文件，仅当前 B 方案文件作为本轮新增/修改目标）。
- Docker：将本地生产 `frontend/dist` 覆盖到现有 `deploy-frontend-1` 并 reload nginx；`/explore`、`/shop`、`/appointment`、`/login` 为 HTTP `200`，`/api/v1/health` 返回 `data.status=UP`。
- CDP 实页：Explore `1440×900`、`390×844` 无横向溢出，`scrollWidth` 分别为 `1440`、`390`；8 个 Explore 图片均 `complete=true` 且 `naturalWidth=1254`，控制台 error 为 `0`。卡片 computed style 为单层细边 + 内沿细线 + `8px 24px` 接触阴影，搜索框为独立凹槽，主按钮为灰青面 + 细古铜边；手动切换 `data-theme=dark` 后浅色 token 未覆盖深色卡片/搜索框。
- 截图证据：`docs/design/audit/2026-08-15-light-ui-b-mineral-cut-edge-revision/`。

## 未验证与后续

沿用项目发布前需现场补验的真实手机、触控笔、Windows 系统级强制颜色、真实慢网和后台管理员 CRUD 项目；本次不提交 Git commit。
