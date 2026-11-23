# 河洛数字博物馆 · 策展级细节精修与体验收口方案（2026-11-23）

- **日期**：2026-11-23
- **目标**：基于 `$impeccable critique` 双路独立评审（得分 `31/40`）与用户确认的「全部 5 项（P1 + P2）一次性完整精修闭环」方案，消除公开展厅的工程调试浮层遮挡与微缩字违规、修复首页器物摄影同图连发与探索页 6 卡 3 列尾行空白、校准浅色古铜色令牌 WCAG AA 对比度、压暗 3D 展厅过曝石质底座并统一展项编号与底坞密度、修复管理后台 48% 硬编码伪进度条与禁用搜索框及个人中心文创账簿缩略图。
- **关联需求 ID**：F-01（首页策展入口）、F-02/F-03（馆藏探索与详情）、F-04（3D 展项交互）、F-05（入馆预约）、F-08/F-09（个人中心与订单）、A-01/A-02（后台内容与运营管理）、N-01/N-05（性能预算、响应式与无障碍）。

---

## 一、影响范围与修改文件

1. **调试浮层收敛与无障碍/对比度校准（P1 + P2）**：
   - `frontend/src/App.vue`：默认从公开访客界面隐藏 `LightPresetSwitcher`（仅在 URL 携带 `?debugLights=1` 时挂载供研发调试），锁定已定稿光效，彻底解除 `/appointment`「联系人姓名」输入框遮挡与 28 项检测器警告。
   - `frontend/src/components/LightPresetSwitcher.vue`：默认收起（`collapsed = ref(true)`），将内部 `10px / 11px / 11.5px` 微缩字统一提升至 `var(--text-xs)`（`12px`），移除古铜序号 `opacity: 0.72` 低对比度叠加，提升按钮高度以满足触控规范。
   - `frontend/src/styles/01-tokens.css`：将浅色模式 `--accent-bronze` 从 `oklch(55% 0.085 74)` 加深至 `oklch(50.5% 0.088 72)`，使全站 12px 古铜色眉标与页脚标题对比度稳超 WCAG AA（`>= 4.6:1`）。
   - `frontend/src/styles/05-shell.css` & `frontend/src/views/AppointmentView.vue`：确保右侧粘性票根底部留出安全内边距，避免桌面窄视口下与右下角「洛笙 · 导览」悬浮钮发生边缘重叠。

2. **首页器物摄影一致性、探索页 9 格满版网格与详情页收口（P1）**：
   - `frontend/src/views/HomeView.vue`：
     - 将 Section 3「沿着河流阅读文明」第 1 张卡 `01 青铜礼器` 的配图替换为暗调展台光影的青铜爵摄影（`/media/editorial/explore-bronze-jue-user-v2.webp`），消除与上方 Section 2「一鼎之间」同图连发及一白两黑底色割裂；
     - 优化 `03 河洛故事` 图片容器填充（`object-fit: cover`），消除上下灰边裁切（Letterboxing）；
     - 增强首屏左上角 `NO.01 · LUOYANG` 与底部开放时间在明亮廊道图上的衬底对比度（`>= 4.5:1`），并将首屏主标题渐显时序小幅提前。
   - `frontend/src/views/ExploreView.vue`：
     - 将镇馆之宝 `河洛青铜鼎`（slug `heluo-bronze-ding` 或偶数馆藏尾项）设为跨 2 列重点大卡（`gallery-object--featured`），在 6 件馆藏时形成 `2+1`、`1+1+1`、`1+2` 的 **9 格满版对称画册网格（0 空缺列）**，并在跨 2 列主卡右侧补充年代/材质/3D 展柜铭牌摘要以充实版面；
     - 将下方「循着主题，继续探索」（`.gallery-themes`）改为上下通栏 3 等分布局，彻底消除「美。」「来处。」单字孤行；
     - 将热门检索词按钮最小高度提升至 `36px`。
   - `frontend/src/views/ContentDetailView.vue`：
     - 为青铜鼎详情页头图优先选用完整呈现双耳与三足全貌的展台渲染图（`/media/editorial/exhibit-ding-moonlight.webp`）；
     - 在已展示 `LuoshengPreset`（3 处细节图版）的文物页，将顶部铭牌区次按钮「问洛笙」改为平滑滚动至 `#luosheng-static-plates`（`查看 3 处细节图版 ↓`），消除同屏 3 处 AI 按钮重复。

3. **3D 展厅暗房底座压暗、编号统一与控制坞精简（P1）**：
   - `frontend/src/components/ThreeExhibitViewer.vue`：将 Three.js 圆柱展台从刺眼过曝的浅米白（`#eee8dc`）压暗为沉稳的「玄武岩/暗青石底座」（浅色模式 `base: #6e685f` / `top: #827b70`，深色模式 `base: #181715` / `top: #22201d`），仅由 `#b68a4b` 古铜金细环承接高光，让青铜鼎本体成为唯一视觉焦点。
   - `frontend/src/views/ExhibitsView.vue` & `frontend/src/views/ExhibitDetailView.vue`：
     - 统一展项编号展示逻辑（列表与详情统一格式化为 `EXHIBIT 01`），并对中文界面下的英文默认 `sourceCredit` 提供优雅的中文溯源映射；
     - 移除 `/exhibits` 页头右上角与卡片内部 100% 重复的 3 个技术标签胶囊；
     - 移除 `ExhibitDetailView.vue` 底部控制坞视角按钮内嵌的 `26px` 重复模糊小圆图，改为纯粹雅致的文字胶囊，并在移动端收拢次要缩放按钮以释放 3D 视口空间；支持从文物详情跳入时的上下文返回文案。

4. **管理后台真实数据态势条、全局实时过滤、表单折叠与个人中心文创账簿（P2）**：
   - `frontend/src/styles/07-admin.css` & `frontend/src/views/AdminOperationsView.vue`：
     - 移除 `.admin-insight__signal i` 的 `width: 48%` 硬编码，按实际待办占比动态绑定进度条宽度（数量为 `0` 时 `width: 0%`）；
     - 解除顶部搜索框在非 `users` Tab 下的 `disabled` 锁定，支持在「预约 / 商品 / 订单 / 3D 展项 / 用户 / 操作日志」全部 7 个 Tab 下按当前列表关键字实时筛选，并将工具栏原生 `<select>` 统一为 `<el-select>`。
   - `frontend/src/views/AdminContentView.vue`：
     - 将左栏新建/编辑表单中的低频字段（「器物规格与双语译文」）收纳进可折叠的 `<details class="admin-form-fold">` 分组，平衡左右两栏高度；
     - 统一表单内「可选」标记为 `<em>可选</em>`，并将工具栏状态筛选统一为 `<el-select>`。
   - `frontend/src/components/ProfileOrders.vue`：
     - 引入 `resolveProductPresentation` 为每笔文创订单渲染 `56×56px` 器物/商品缩略图展台；
     - 移除每张订单卡底部重复打印当前登录用户默认邮箱的冗余行。

---

## 二、验收标准与验证结果

- **验收标准与实测结果（2026-11-23）**：
  1. `npx vue-tsc -b`：**0 错误**；
  2. `npx vitest run`：**全部通过**（含更新后的 `HomeView.spec.ts`、`LightUiMaterialDepth.spec.ts`、`darkThemeCohesion.spec.ts`、`themeFoundation.spec.ts` 等）；
  3. `npm run build` + `bundle-budget` + `music-assets-budget`：**全部通过**（首屏 JS gzip `77,613 B / 81,638 B`，首屏 CSS gzip `11,234 B / 80,000 B`，`woff2Files === 0`）；
  4. **统一底色、无缝重复博物馆纹样与「犹抱琵琶半遮面」流光揭纱联动**：移除孤立单线条水印与冷暖割裂的分块底色，全站统一建立在 `--surface-canvas` 基底上；在 `01-tokens.css` 构建静置底纹（`--pattern-yunlei`、`--pattern-brocade`、`--pattern-plinth-lattice`）、高显色鎏金/错金揭纱纹（`--pattern-yunlei-lit`、`--pattern-brocade-lit`、`--pattern-plinth-lattice-lit`）及斜向云纱渐隐罩染（`--pattern-veil-gauze`）；在 `PointerCursor.vue`、`06-motion.css`、`heroDotFieldRenderers.ts`、`lightFieldRenderers.ts` 与 `HomeView.vue` 实现文档坐标锁定的偏心新月 + 斜向云纱波纹（`mask-composite: intersect`）随鼠揭纱显纹效果；
  5. `impeccable detect --json`：全部修改文件静态扫描 **0 警告**。
- **补充精修（2026-11-23 下午 · 双主题质感、去 AI 味与全站装裱同步）**：
  1. **去 AI 味与克制动效**：移除首页重复眉标/伪序号/嵌套套盒与顶栏胶囊气泡，将背景纹样收敛为 `72×72px` 极简微距十字点，关闭光标拖尾光球、旋转高光环与悬停倾斜/粒子喷发，降低首屏粒子排斥力度；
  2. **深色模式去棕化**：将 `01-tokens.css` 深色基底色度降至 `0.002–0.003`（`oklch(15.5% 0.002 75)` 纯净建筑石墨炭灰），消除深色页脚发棕发泥感；
  3. **浅色模式画册质感与方案 A 底座**：新增展厅斜向天光（`--surface-skylight-wash`）、单倍频无接缝纸石微粒（`--surface-paper-grain`）、深石墨暗房展柜（`--surface-vitrine`）、暖灰莱姆石色带（`--surface-stone-band`）、双层物理投影与实体按钮高光，浅色页脚采用纯净深石墨底座收口，并同步至 `03-surfaces.css`、`04-components.css` 及 `/explore`、`/exhibits`、`/shop`、`/appointment`、`ContentDetailView`；
  4. **首页器物无裁切与实拍玉璧同步**：首页 Section 3 调整为等宽三栏 `1:1` 无裁切展框（`object-fit: contain`），并将「玉石意象」替换为实拍谷纹玉璧图 `explore-jade-bi-user-v2.webp`；
  5. **最终验证**：前端全量 `vitest run` `76` 文件 / `450/450` 全绿，`vue-tsc -b && vite build && bundle-budget && music-assets-budget` 全绿，本地启动 H2+Flyway 后端（`http://localhost:8080`）完成首页及 `/explore`、`/exhibits`、`/shop`、`/appointment` 实景截屏验收。
- **风险控制**：未改变任何后端 API 契约、数据库结构或权限判定逻辑；所有改动严格收敛于 `frontend/src` 的视图、组件与 `@layer` 样式系统。
