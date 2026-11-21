# 全站双主题基础层与共享控件收敛计划

## 目标

按照“一套品牌、两种时段、四类页面”的改造方向，先完成第一批基础工作：收敛浅色“日间月白展厅”和深色“夜间深墨展厅”的语义令牌、三层玻璃与共享控件，阻止后续页面继续直接依赖零散颜色或新增主题补丁。

## 关联需求

- `F-14`：前后台主题切换、持久化与核心路由视觉一致性。
- `N-03`：控件可读、触控尺寸、响应式与辅助功能偏好降级。
- `N-06`：共享设计基础层可维护，前端测试、类型检查与构建通过。

## 影响范围

- `frontend/src/assets/tokens.css`：新增表面、控件、状态和焦点语义令牌。
- `frontend/src/assets/glass.css`：收敛 `light/dark/compact` 玻璃表面及透明度降级。
- `frontend/src/assets/theme-controls.css`：集中定义按钮、后台操作、状态、复选框和搜索控件视觉。
- `frontend/src/main.ts`：在现有页面和交互样式之后加载共享主题控件层。
- `frontend/src/assets/themeFoundation.spec.ts`：锁定导入顺序、令牌和降级契约。
- `PROJECT_STATUS.md`、`docs/01-requirements-traceability.md`：记录本批实施和验证结果。

## 实施步骤

1. 盘点当前主题令牌、玻璃层和共享控件中的直接颜色依赖与重复深色覆盖。
2. 建立稳定的表面、主操作、次操作、危险操作、状态和焦点语义令牌。
3. 让三层玻璃统一消费主题表面令牌，并补齐减少透明度、高对比度与强制颜色降级。
4. 新增末端共享控件主题层，保持 Vue 组件接口、DOM、事件和业务行为不变。
5. 运行主题专项、共享组件、全量前端、类型检查、构建和真实双主题页面回归。

## 验收标准

- 浅色与深色共享相同控件几何、字号、间距和状态，只由语义令牌改变材质与颜色。
- `FluidButton`、`AdminActionButton`、`MuseumSearchField`、`InlineStatus`、`StatusBadge`、`GlassCheckbox` 不再需要页面级颜色才能具备完整默认状态。
- 所有主要控件至少 `44px`，焦点可见，禁用、加载、成功、警告和错误状态清楚。
- `data-glass="light|dark|compact"` 在正常模式有可感知背景，在减少透明度、增强对比度和强制颜色模式下使用实色降级。
- 不改变 API、路由、权限、表单提交、预约/订单状态机、模拟支付或 Three.js 行为。

## 风险

- `main.css` 和 `interaction.css` 存在历史页面级高优先级覆盖；本批只建立共享默认值，不一次删除旧规则，避免扩大视觉回归范围。
- 工作区包含大量既有未提交改动；本批仅增量编辑上述基础文件和记录文件，不重置、不提交、不覆盖无关改动。

## 验证结果

- 主题与共享组件专项：`themeFoundation.spec.ts`、`glassMaterials.spec.ts`、`darkThemeCohesion.spec.ts`、`SharedUi.spec.ts`、`GalaxyUi.spec.ts` 共 5 个文件、47 项通过。
- 全量前端：Vitest 30 个文件、133 项通过；`pnpm typecheck`、`pnpm build`、本批 `git diff --check` 通过。构建仅保留既有 VueUse PURE 注释和 Three.js 大分块提示。
- 真实页面：独立生产预览核验首页浅/深主题、预约、馆藏、登录和 `390x844` 馆藏移动布局；四级表面令牌均解析，主按钮/输入/搜索高度不低于 44px，无横向溢出，控制台无警告或错误。
- Docker：执行 `docker compose --env-file deploy/.env -f deploy/compose.yaml build frontend` 与 `up -d --no-deps frontend`；运行容器与镜像均为 `sha256:c743dd645f010a82905bb6a4cc0c6aae97bceb4f83d4e252371a70d4c76668be`，首页 HTTP `200`，API health 为 `UP`。
- 响应式门禁：正式 `http://localhost:8088` 上 `pnpm qa:pointer-pages` 的首页、馆藏、展厅、商城共 32 组全部通过；无横向溢出、无控件裁切，点阵与商城交互门禁均为 `true`。
- 未验证：本批未重复执行实体手机、触控笔和系统级强制颜色人工验收；强制颜色、增强对比度和减少透明度已由 CSS 契约测试覆盖。
