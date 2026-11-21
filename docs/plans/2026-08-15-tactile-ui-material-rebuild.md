# 浅色 Tactile UI 材质组件重建计划

- 日期：2026-08-15
- 目标：依据用户确认的主材质板与四组细节参考，重建河洛数字博物馆浅色模式的卡片、搜索框、按钮、复选框、分段控件和真实表单字段的实体材质表现。
- 视觉目标：暖象牙陶瓷面 + 深玉结构侧壁 + 夹层古铜嵌线；通过真实厚度、圆润微倒角、凹槽、接缝、受控接触阴影和状态位移建立层次，不使用纸片式底条、玻璃拟态或单薄边框。

## 需求与边界

- 关联需求：F-01、F-02、F-03、F-05、F-06、F-08、F-09、F-11、F-12、F-13、N-03、N-06 的浅色表现层。
- 保持不变：API、路由、鉴权、搜索/筛选、预约/订单状态机、模拟支付、SKU 数据、Three.js 生命周期和深色主题。
- 参考素材：`docs/design/audit/2026-08-15-tactile-ui-detail-references/`。

## 影响文件

- `frontend/src/assets/light-ui-material-depth.css`：替换旧的 A-only 硬底轨层，建立新的共享材质 tokens、状态和响应式规则。
- `frontend/src/assets/LightUiMaterialDepth.spec.ts`：更新材质合同断言，禁止旧底轨/渐变回归并保留可访问降级路径。
- `docs/plans/2026-08-15-tactile-ui-material-rebuild.md`：记录实现、验收和验证结果。
- `PROJECT_STATUS.md`：任务完成后记录真实验证结果和未完成项。

## 实施步骤

1. 以浅色专用 CSS 变量建立陶瓷面、深玉基座、古铜嵌线、内凹槽、焦点环和四态阴影。
2. 将卡片、媒体内框、按钮、搜索框、原生字段、复选框、日期/时段/分段控件统一到同一材质合同。
3. 保留触控目标、键盘焦点、减少动态、减少透明度、高对比度和 forced-colors 分支。
4. 先运行专项测试，再运行类型检查、全量测试、生产构建；随后使用正式 Docker 页面和桌面/移动截图回归。

## 验收标准

- 卡片与控件不再出现单独的黑色/深玉底部条；深玉结构应以连续外圈/侧壁和夹层古铜 seam 体现。
- 搜索框、按钮、复选框、分段控件能看出实体厚度、倒角、凹槽和状态差异。
- 浅色生效，深色不被覆盖；hover/focus/pressed/disabled 与语义状态可见。
- 真实页面无横向溢出、控件裁切或核心交互回归。
- 所有执行过的验证如实记录，未做的实体设备/管理员 CRUD 等继续列为未验证项。

## 风险

- 现有历史 CSS 层较多，必须以 `main.ts` 最后导入的浅色材质层覆盖旧规则，不能改动深色合同。
- 部分商城/首页卡片由图片舞台和绝对定位组成，需用真实页面截图确认阴影和外圈不遮挡媒体。
- 生成效果图仅为材质参考，不直接作为运行时图片资产。

## 实施结果（2026-08-15）

- 已将旧 A-only 硬底轨层替换为浅色专用 `Tactile Porcelain + Jade Inlay` 材质层：暖象牙陶瓷面、连续深玉结构外圈、单条古铜嵌线、内凹搜索/表单槽和实体接触阴影。
- 已覆盖卡片、媒体内框、按钮、搜索框、原生输入/选择框、复选框、日期/时段/分段控件、认证/预约/商城/后台表面；default、hover、focus-visible、pressed、disabled 和 reduced-motion/contrast/forced-colors 分支均保留。
- 未改动 Vue 组件逻辑、API、路由、鉴权、搜索/筛选、预约/订单状态机、SKU 数据、模拟支付或 Three.js 生命周期；生成图只作为设计合同与验收参考，不作为线上运行时图片。

## 验证结果

- `corepack pnpm test`：36 个测试文件、171 项测试全部通过。
- `corepack pnpm typecheck`：通过。
- `corepack pnpm build`：通过；保留既有 `@vueuse` PURE 注释与 Three.js 大分包 warning。
- `corepack pnpm qa:pointer-pages`：32 组页面/视口通过，横向溢出与控件裁切门禁通过。
- `corepack pnpm perf:pointer-size`：通过，JS minified `17932 <= 18000`、gzip `6621 <= 7000`。
- 正式 Docker 页面：`/`、`/explore`、`/shop`、`/appointment`、`/login`、`/profile` 均 HTTP `200`；`/api/v1/health` 返回 `data.status=UP`。Docker Hub 在标准 `up --build` 阶段发生 `docker/dockerfile:1` EOF，未强行改部署配置；改用同一 `frontend/dist` 覆盖运行中的 `deploy-frontend-1` 并 reload nginx 完成实页验证。
- CDP 计算样式复核：浅色卡片/搜索框/按钮/分段/原生字段使用新的 OKLCH tokens，`background-image: none`；商城分段与预约字段 `backdrop-filter: none`，未回落为玻璃模糊。
- 设计验收：对照板与实页截图已合成并归档于 `docs/design/audit/2026-08-15-tactile-ui-material-rebuild/`，报告为仓库根目录 `design-qa.md`，最终结果 `passed`。

## 未验证与后续

- 真实手机/触控笔/高刷指针、Windows 系统级强制颜色和真实慢网仍需现场验收。
- 当前公开路由没有实际挂载 `GlassCheckbox` 的业务页面，因此复选框使用生产 CSS 与真实组件 DOM 做了隔离浏览器 specimen；后台 CRUD 仍未使用真实管理员凭据走通。
- 预约页现有日期带与右侧预约面板的页面几何不是本次材质层新增问题，后续可单独做布局审计；本次只验收其材质表现。
