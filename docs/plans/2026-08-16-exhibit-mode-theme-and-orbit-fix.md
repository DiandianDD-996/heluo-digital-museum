# 3D 展项模式控件、主题同步与自由环绕修复

## 1. 目标

修复 3D 展项 Dock 中英文模式按钮的文字溢出和浅深主题几何跳变，并解除模型水平方位角的一圈限位，使实体与点云模式均可连续多圈环绕观察。

关联需求：`F-05`、`F-12`、`F-14`、`N-03`、`N-06`。

## 2. 影响范围

- `frontend/src/components/ThreeExhibitViewer.vue`
- `frontend/src/components/ThreeExhibitViewer.spec.ts`
- `frontend/src/assets/route-exhibit-detail-legacy.css`
- `frontend/src/assets/MoonhallLightTheme.spec.ts`
- `PROJECT_STATUS.md`
- `docs/01-requirements-traceability.md`

不修改 API、路由、鉴权、模型或纹理资源、点云生成参数、相机预设、缩放边界、预约/订单状态机和部署依赖。

## 3. 实施方案

- 水平环绕：将 OrbitControls 的方位角范围由 `[-Math.PI, Math.PI]` 改为 `[-Infinity, Infinity]`；保留现有 `.08–1.62` 极角范围，避免相机翻到展台下方或在极点失控。
- Dock 几何：由两个模式按钮直接占据 `.8fr/1.2fr` 两列，移除重复的可见伪元素标签；保留 `aria-label` 作为分组名称。
- 文字与主题：浅色、深色共用 `13.44px` 字号、`44px` 高度和 `8px/5px` 圆角，只允许颜色、背景和阴影随主题变化。按钮内容可在窄宽度按空格换行，且容器负责裁切兜底。
- Canvas 主题：监听现有 `heluo:theme-change` 事件，即时同步环境雾色；组件销毁或重新初始化时移除监听器。

## 4. 实施步骤

1. 增加方位角和主题雾色单元测试，锁定水平无限环绕、垂直边界与事件清理。
2. 修改 OrbitControls 配置并接入主题事件。
3. 收敛 Dock 的主题中立几何与响应式排版，覆盖用户标注的桌面英文场景及 `761–900px` 窄桌面。
4. 运行专项测试、前端全量测试、类型检查、生产构建和页面映射门禁。
5. 重建正式 Docker，在桌面/移动、中英文、浅色/深色、实体/点云路径完成真实页面回归。
6. 更新项目状态和需求追踪记录。

## 5. 验收标准

- `1433×898`、`1280×720` 英文浅色/深色下，两个模式按钮均满足 `scrollWidth <= clientWidth`，文字不互相重叠、不越出 switch。
- 浅深主题切换后，模式按钮字号、行高、高度和圆角不跳变；颜色与材质正确切换。
- Viewer 已就绪时切换主题无需重载，Canvas 雾色同步，模型、点云和相机状态保持。
- 实体与点云模式均可向同一方向连续旋转超过 `720°`，不在 `±180°` 处停止或跳回。
- 五个视角预设、重置、缩放、自动旋转和点云切换保持可用。
- `390×844` 页面无横向溢出，模式文字与操作区不重叠。
- 专项/全量测试、类型检查、生产构建、页面映射和正式 Docker 健康检查通过。

## 6. 风险

- 路由 CSS 含多层历史主题和共享材质覆盖，源码规则通过不等于正式构建后的计算样式正确，必须检查真实 DOM 矩形与计算样式。
- 无限水平旋转会让累计方位角持续增长；OrbitControls 使用双精度数值，常规交互不存在可感知精度问题，但仍需验证多圈拖拽和自动旋转。
- 本轮不解除垂直极角限制；完全上下翻转会暴露展台底面和相机极点问题，不属于当前验收范围。

## 7. 验证结果

- 专项测试通过：`ThreeExhibitViewer.spec.ts`、`ExhibitDetailView.spec.ts`、`MoonhallLightTheme.spec.ts`、`theme.spec.ts`、`exhibitInteraction.spec.ts` 共 `5` 个文件 / `35` 项；最终前端全量 Vitest 为 `44` 个文件 / `246` 项，失败 `0`。
- `corepack pnpm typecheck`、`corepack pnpm build` 和 `corepack pnpm qa:pointer-pages` 均通过；页面映射覆盖 `32` 组视口，横向溢出与控件裁切门禁通过。构建仅保留既有 VueUse PURE 注释与 Three.js 大分包提示。
- 正式 Docker 已用最新源码重建；`http://localhost:8088/exhibits/heluo-bronze-ding-3d` 返回 `200`，`/api/v1/health` 的 `data.status` 为 `UP`。
- `1433×898` 与 `1280×720` 英文浅色/深色实页中，switch 为 `267/267px`，两个按钮分别为 `103/103px`、`155/155px`；字号 `13.44px`、行高 `16.128px`、高度 `44px`、按钮圆角 `5px`、switch 圆角 `8px` 在两主题间完全一致。主题切换后 Viewer 维持 `ready`，雾色在 `light/dark` 间同步。
- 实体与点云模式各执行 `6` 次同向 `330px` 拖拽；按 `700px` Canvas 高度及 OrbitControls 映射计算，累计约 `1018°`。两种模式的六段截图像素均持续变化，未在 `±180°` 或一圈处停住。五个视角预设、重置、放大、缩小和自动旋转均通过交互回归。
- `390×844` 英文深色点云实页无页面或模式控件横向溢出；Canvas 截图抽样得到 `1698` 种颜色，桌面实体 Canvas 得到 `2050` 种颜色，均为非空画面。浏览器控制台 `warning/error` 为 `0`。
- 未验证：实体手机浏览器工具栏/安全区、触控笔、Windows 强制颜色/高对比度及中低端 GPU 长时间运行。本轮有意保留 `.08–1.62` 垂直极角边界，不允许相机翻到展台下方。
