# Explore 馆藏卡片色调统一

## 目标

修复 `/explore` 五张主馆藏卡片的信息区偏青绿色、与下方三张“延伸阅读”卡片的暖棕墨色不协调的问题。主馆藏卡片继续保留现有器物媒体、非对称布局、文字内容、主题切换和详情入口。

## 关联需求

- `F-01/F-03`：公开馆藏卡片与详情入口应保持清晰、可辨识的展示层级。
- `N-03/N-06`：桌面与移动端主题样式应一致、无横向溢出，并有可回归的 CSS 契约。

## 影响范围

- `frontend/src/assets/explore-reference.css`：仅在深色主题覆盖五张 `.artifact-tile-copy` 的信息面板材质，使其复用延伸阅读卡片的暖墨棕表面、边框和阴影；不再显示偏青绿的 `explore-info-panel-user-v2.webp` 纹理。
- `frontend/src/views/ExploreReferenceLayout.spec.ts`：增加深色主馆藏信息区与延伸阅读卡片共享暖墨表面的 CSS 契约。
- `PROJECT_STATUS.md`、`docs/01-requirements-traceability.md`：记录实施和验收结果。
- 不改变 API、路由、鉴权、搜索、分类、分页、订单/预约状态机或 Three.js 生命周期；不新增依赖、不修改媒体资源。

## 实施步骤

1. 复核浏览器标注、`ExploreView.vue` 的五件展品顺序和 `explore-reference.css` 的最终级联。
2. 将深色主题五张主馆藏卡的信息区改为与阅读卡片相同的 `--dark-reference-surface-strong` → `--dark-reference-surface` 暖墨棕渐变。
3. 增加 CSS 契约，覆盖统一表面、背景色和设计意图。
4. 运行专项测试、前端全量测试、类型检查、生产构建、Docker 实页和桌面/移动主题回归。

## 验收标准

1. 深色主题五张主馆藏卡的信息区不再呈现明显青绿色，且五张卡片使用同一套暖墨棕表面。
2. 主馆藏信息区与下方三张延伸阅读卡片的计算背景、边框和阴影一致，文字仍保持象牙白/古铜金可读层级。
3. 浅色主题继续使用月白纸面，不受深色覆盖影响。
4. `390×844` 移动端无横向溢出；卡片图片、文字和详情入口不改变位置与行为。

## 验证结果

- Explore 专项测试：`pnpm vitest run src/views/ExploreReferenceLayout.spec.ts`，1 个文件 / 5 项通过。
- 前端全量测试：`pnpm test`，33 个文件 / 155 项通过。
- `pnpm typecheck` 通过；`pnpm build` 通过。构建保留既有 VueUse PURE 注释和大 chunk warning，未由本次 CSS 改动引入。
- Docker 前端重建完成，`deploy-frontend-1` 与依赖服务运行中；`http://localhost:8088/explore` 返回 HTTP `200`。
- 应用内浏览器深色实页复核：五张主馆藏信息区与三张延伸阅读信息区的计算背景均为同一暖墨棕渐变，浏览器控制台 error/warn 为 `0`；浅色主题切换后信息区为月白纸面。
- `390×844` 复核：页面与 `artifact-board` 无横向溢出，五张信息区均保持暖墨棕表面；默认浏览器尺寸已恢复。
- `git diff --check` 通过；未提交 Git。

## 风险与待补验

- 真实手机、触控笔和 Windows 系统级强制颜色仍沿用项目既有补验项；本次未改变交互、媒体资源或业务逻辑。
- 无认证直接请求后端候选 health/API 路径返回既有 `401`，后端容器本身处于运行状态；本次页面浏览器流程已正常加载馆藏数据。
