# 2026-08-15 浅色 Tactile UI 材质还原 Design QA

## Comparison target

- **Source visual truth**：用户确认的陶瓷/深玉/古铜方向与四组细节板：
  - `C:\Users\Jie\Documents\博物馆\docs\design\audit\2026-08-15-tactile-ui-detail-references\material-board-v1.png`
  - `C:\Users\Jie\Documents\博物馆\docs\design\audit\2026-08-15-tactile-ui-detail-references\search-field-detail-v1.png`
  - `C:\Users\Jie\Documents\博物馆\docs\design\audit\2026-08-15-tactile-ui-detail-references\button-detail-v1.png`
  - `C:\Users\Jie\Documents\博物馆\docs\design\audit\2026-08-15-tactile-ui-detail-references\selection-controls-detail-v1.png`
  - `C:\Users\Jie\Documents\博物馆\docs\design\audit\2026-08-15-tactile-ui-detail-references\edge-construction-detail-v1.png`
- **Implementation**：正式 Docker `http://localhost:8088` 的浅色页面截图和同一生产 CSS 渲染的复选框 specimen。
- **Material contract**：暖象牙陶瓷面、连续深玉结构侧壁、单条古铜嵌线、内凹槽、受控接触阴影；不是把效果图当成运行时背景图，也不是复刻纸片式底部黑条。

## Evidence and normalization

- 生成源图均为 `1536×1024` image pixels；网页截图在 Chrome CDP `deviceScaleFactor=1` 下捕获，桌面 CSS viewport 为 `1440×900`，移动 CSS viewport 为 `390×844`，复选框 specimen 为 `700×360`。
- 源图是组件材质板，不是与现有页面一一对应的整页 mockup；因此全页比较只判断材质语言、层级和响应式落地，不做不合理的像素级页面构图比较。
- 重点区域已先裁取再放入同一 comparison input，避免把分开的图片视图误当作并排证据：
  - `C:\Users\Jie\Documents\博物馆\docs\design\audit\2026-08-15-tactile-ui-material-rebuild\qa-search-card-edge-comparison.png`
  - `C:\Users\Jie\Documents\博物馆\docs\design\audit\2026-08-15-tactile-ui-material-rebuild\qa-button-segmented-comparison.png`
  - `C:\Users\Jie\Documents\博物馆\docs\design\audit\2026-08-15-tactile-ui-material-rebuild\qa-checkbox-segmented-comparison.png`
  - `C:\Users\Jie\Documents\博物馆\docs\design\audit\2026-08-15-tactile-ui-material-rebuild\qa-full-view-responsive-comparison.png`

## Rendered implementation screenshots

- `C:\Users\Jie\Documents\博物馆\docs\design\audit\2026-08-15-tactile-ui-material-rebuild\final-home-1440x900.png`
- `C:\Users\Jie\Documents\博物馆\docs\design\audit\2026-08-15-tactile-ui-material-rebuild\final-explore-1440x900.png`
- `C:\Users\Jie\Documents\博物馆\docs\design\audit\2026-08-15-tactile-ui-material-rebuild\final-explore-390x844.png`
- `C:\Users\Jie\Documents\博物馆\docs\design\audit\2026-08-15-tactile-ui-material-rebuild\final-exhibits-1440x900.png`
- `C:\Users\Jie\Documents\博物馆\docs\design\audit\2026-08-15-tactile-ui-material-rebuild\final-shop-1440x900.png`
- `C:\Users\Jie\Documents\博物馆\docs\design\audit\2026-08-15-tactile-ui-material-rebuild\final-shop-390x844.png`
- `C:\Users\Jie\Documents\博物馆\docs\design\audit\2026-08-15-tactile-ui-material-rebuild\final-appointment-1440x900.png`
- `C:\Users\Jie\Documents\博物馆\docs\design\audit\2026-08-15-tactile-ui-material-rebuild\final-login-1440x900.png`
- `C:\Users\Jie\Documents\博物馆\docs\design\audit\2026-08-15-tactile-ui-material-rebuild\final-checkbox-specimen-700x360.png`

## State coverage

- Live idle/loaded views：Home、Explore、Exhibits、Shop、Appointment、Login；桌面与 Explore/Shop 移动视口均已捕获。
- Source state board：button default/hover/focus/pressed/disabled、checkbox default/checked/indeterminate/focus/disabled、segmented selected/disabled。
- Implementation state contract：CSS 覆盖 hover、focus-visible、active/pressed、disabled、reduced-motion、reduced-transparency、contrast-more 和 forced-colors；隔离 specimen 实际渲染 default、selected、disabled checkbox。
- 通过 `getComputedStyle` 对真实 Docker 页面检查 card、search field、button、segmented control、native field；确认 `background-image: none`，并确认分段控件/表单字段没有回落到 `backdrop-filter: blur(...)`。

## Required fidelity surfaces

- **Fonts / typography**：继续使用项目已有 Noto Serif SC / Noto Sans SC 层级，没有将生成图中的文字作为图片；页面中文标题、导航、控件标签和小字在桌面/移动截图中保持真实 Vue 文本与原有层级。
- **Spacing / layout rhythm**：卡片采用连续外圈而非单独底部轨；搜索框在 `760px` 以下切为两行；按钮/字段保留可操作尺寸；`qa:pointer-pages` 的 32 组视口均无横向溢出和控件裁切。
- **Colors / visual tokens**：实页使用 `--light-ui-face`、`--light-ui-recess`、`--light-ui-jade`、`--light-ui-bronze` 等 OKLCH token；浅色为实色陶瓷/深玉/古铜结构，不使用新渐变或玻璃模糊。
- **Image quality / asset fidelity**：参考板仅用于视觉合同和 QA，不进入运行时；现有文物/商城媒体保持真实项目资源，未用 CSS 绘图、emoji、占位图或效果图文字替代真实内容。
- **Copy / content**：页面 copy、搜索提示、商城商品、预约字段和登录文案仍由真实页面渲染，未为了匹配参考板而改动业务文本。

## Findings

- 无可阻断验收的 P0/P1/P2 视觉问题。
- [P3] 生成细节板的微纹理是摄影级材质表现，线上实现使用 token、边缘高光、内凹阴影和现有媒体来保持性能与内容可读性，因此在整页缩小截图中纹理不会和源图一样强；这属于有意的运行时取舍，不阻断本轮还原。
- [P3] 当前公开路由没有实际业务位置挂载 `GlassCheckbox`，所以复选框用生产组件 DOM/CSS 做隔离 specimen；当后台或筛选流程接入它时，需再补一次真实业务态截图。
- [P3] Appointment 截图保留了原有日期带与右侧预约面板的页面几何关系；本次只改变共享材质层，没有把该独立布局问题扩大到本轮范围。

## Comparison history

1. **Material rebuild pass**：上一版 A-only 层的单薄边框/独立深色底轨与用户确认的厚陶瓷、深玉连续结构不一致；在 `frontend/src/assets/light-ui-material-depth.css` 中改为连续外圈 + 古铜嵌线 + 内凹槽，并移除新层中的渐变、独立 `inset 0 -5px` 底轨和玻璃模糊。
2. **Post-fix pass**：重新构建并覆盖运行中的前端容器，重新捕获 1440×900、390×844 和 checkbox specimen；重点 comparison input 显示搜索、卡片、按钮、分段和复选框已回到同一材质语言；计算样式确认相关控件 `background-image: none`，分段/原生字段 `backdrop-filter: none`。没有残留 P0/P1/P2。

## Implementation checklist

- [x] Shared light-only ceramic/jade/bronze tokens and state shadows.
- [x] Cards, buttons, search, native fields, checkbox and segmented controls.
- [x] Mobile search two-row treatment and accessibility degradation branches.
- [x] Typecheck, full Vitest, production build, pointer page gates and live HTTP/API checks.
- [x] Source/implementation comparison inputs and focused-region evidence archived.
- [ ] Real phone, stylus/high-refresh pointer, Windows forced colors and authenticated admin CRUD remain separate follow-up gates.

final result: passed
