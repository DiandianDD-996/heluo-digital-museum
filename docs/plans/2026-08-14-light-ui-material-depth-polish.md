# 浅色模式器座材质与控件细节精修

## 目标

修复浅色模式中卡片、搜索框、复选框、按钮、表单字段和后台记录面“像纸片、边框过薄、缺少实体层级”的问题。新方向为“展柜器座 / 磨砂釉面 / 深玉承重边”，重点通过真实的外沿、内沿、凹槽、底部承重线和受控阴影表达材质，不再沿用用户否定的浅色设计系统状态板。

## 参考与资产边界

- 用户明确否定：`C:\Users\Jie\AppData\Local\Temp\codex-clipboard-48f9956f-6d8b-4299-b80c-3af550a184b8.png`。
- 该图片不作为视觉参考，不提取其中的卡片、按钮、搜索框、输入框或状态板元素，也不进入生产资源。
- 仅复用仓库现有已登记的文物/商品 SKU 作为内容媒体；本轮不新增 UI 效果图或烘焙文字素材。

## 范围

- 浅色主题共享材质层：卡片外框、内沿高光、底部承重线、抬升/按压阴影。
- 搜索框：内凹输入槽、前置检索槽、独立实体提交器座和清除按钮小槽。
- 复选框：22px 釉面方章、明确 checked/hover/focus/disabled 状态。
- 按钮、分段控件、日期/时段、后台操作和主题工具：统一实体控件层级。
- 登录、预约、个人中心、商城、馆藏、数字展厅和后台的浅色字段/记录面。

## 不变内容

- 不修改 API、路由、鉴权、预约/订单状态机、模拟支付、Three.js 生命周期、业务文案和 SKU 数据。
- 不触碰深色主题；不重置、提交、推送或清理现有 dirty worktree。

## 验收标准

1. 浅色卡片不再依靠单条淡边界表达层级；默认态可见外框、内沿和承重阴影，hover/focus/pressed 有连续反馈。
2. 搜索、输入、选择、日期、时段和按钮默认态就能辨认“凸起/内凹”关系，主要控件高度不低于 44px。
3. 复选框在默认、checked、hover、focus、disabled 和 forced-colors 下均可辨认。
4. 公众端、预约、商城、账户和后台浅色页面不发生横向溢出；深色计算样式不被新规则覆盖。
5. 相关 Vitest、类型检查、生产构建、diff 检查以及 Docker 实页回归通过；未能验证的真实设备和系统模式如实记录。

## 计划修改文件

- `frontend/src/assets/light-ui-material-depth.css`
- `frontend/src/main.ts`
- `frontend/src/components/GlassCheckbox.vue`
- `frontend/src/assets/LightUiMaterialDepth.spec.ts`
- `PROJECT_STATUS.md`
- `docs/01-requirements-traceability.md`
