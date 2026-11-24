# 项目状态

> 本文件只记录**当下状态、风险与下一步**（硬上限 150 行）。完整历史记录已归档至 [docs/archive/status-2026.md](docs/archive/status-2026.md)。

## 当前总览（2026-11-24）

| 模块 | 当前状态 | 说明 |
| --- | --- | --- |
| 数字博物馆主体（前后端 + 3D + 预约 + 商城模拟支付 + 后台） | **已完成并已部署演练** | F-01～F-14、A-01～A-02、N-01～N-06 均已达成；PocketBay 演示站已跑通 |
| 前端视觉与 CSS 架构升级（Heluo Editorial 2.0） | **全站策展美学与多模态交互全面升级已完成** | 计划见 [2026-11-24-curatorial-experience-upgrade.md](docs/plans/2026-11-24-curatorial-experience-upgrade.md)、[2026-11-23-curatorial-fine-polish.md](docs/plans/2026-11-23-curatorial-fine-polish.md)，规范见 [design.md](design.md) |
| 洛笙 AI 向导 v2（可选扩展） | **v2.2 前后端全链路已在隔离环境验收；生产默认关闭** | [洛笙说明](docs/luosheng/README.md)、[v2.2 双路径评测](docs/luosheng/eval/v2.2-eval.md)、[ADR-010](docs/decisions/ADR-010-luosheng-v2-museum-agent.md) |

## 最近完成（2026-11-24）

- **前端策展美学与多模态交互全面升级 + 高标准实体画册级重构（2026-11-24）**：见计划 [2026-11-24-curatorial-experience-upgrade.md](docs/plans/2026-11-24-curatorial-experience-upgrade.md)。① 首屏包体清障：按需拆分 `soundSynthesis.ts` 并替换根壳冗余图标，首屏 JS gzip 从 `79,614 B` 降至 **`72,751 B / 81,638 B`**（`-6,863 B`）；② 打通 `V28` 双语/溯源 SSOT 与探索页四类范围切换、洛笙跨页即问胶囊与流式加粗防抖；③ `EXHIBIT 01` 青铜鼎新增 3D 空间锚点、`245 × 200 mm` 实体线框标尺与可手势接管 3 步微导览；④ `EXHIBIT 02`《河洛图纹石板》（`V30` + WebGL GLSL）落地冷灰影棚背景软剥离、降噪门控法线、DoG 乌金墨拓、ACES 电影色调映射与 1:1 零延迟黄铜游标放大镜，并同步修复 `/exhibits` 数字展厅石板封面全景无裁切、无徽标遮挡展示；⑤ 电子票根彻底去除 SaaS 卡片与内嵌按钮，重构为**「无框实体印制品式藏书票」**（左 57% 全出血暗房版画 + 竖排宋体题签 + 朱砂「河洛珍藏」篆印、中模切半圆齿孔、右 43% 活字宣纸副券 + 倾斜印章 + 9×9 核验印纹；6 款藏品版画选择器与 `1600×740` 高清 `.png` 导出、`.ics`、打印外置于暗房托盘），预约成功后自动浮现于玄墨丝绒展台弹窗；⑥ 观展手账彻底重构为**「四眼线装画册」**（左侧线装书脊、无胶囊目录索引、大画幅无裁切图版编号 `图版 壹/贰`、朱丝栏随笔批注及一键导出 `1080px` 竖卷手账长图 `.png`）。验证：前端 `79` 文件/`441/441`、`vue-tsc` 0 错、双预算门禁全绿、`business.e2e.ts` `7/7` 及全套双主题/移动实机截图复检全通过（后端 `106/106` 未改动）。

- **后端安全与平台升级（Gate 0–2）**：默认移除 Mailpit、限制可信代理和重置密码频率、隔离洛笙重放；补齐分类导航、双语工具卡、引用白名单和 SSE 句级护栏；落地 V28 双语/文创溯源、四类加权搜索、运营统计/洛笙治理、V29 预约核销和双拓扑动态 SEO。后端 `106/106`，MySQL 8.4 专项 `23/23`，前端 `77` 文件/`433/433` 及类型、生产构建通过；MySQL Compose 与 PocketBay/H2 就绪和详情页冒烟通过。Compose 原浏览器用例 `5/7`，两条旧选择器阻塞的恢复流程用临时适配副本复验 `2/2`。同一最终 PocketBay 镜像真实 DeepSeek JSON `36/36`、SSE `36/36`（红队 `12/12`、动作 `72/72`，`71/72` 真模型）。见[实施计划](docs/plans/2026-11-24-backend-security-and-platform-upgrade.md)、[ADR-012](docs/decisions/ADR-012-backend-trust-runtime-and-detail-visibility.md)。

- **洛笙 AI 向导 v2.1「更自由、更大胆、更智能」迭代（2026-11-24）**：见计划 [2026-11-24-luosheng-bold-smart-upgrade.md](docs/plans/2026-11-24-luosheng-bold-smart-upgrade.md)。① 解放策展人格与双层知识自由度：重构 `GuidePromptBuilder`（区分馆藏特定档案事实与历史/工艺/美学通识，去除未问及边界时的机械免责腔），提升 `GuideProperties` / `GuideLlmClient` 默认 `temperature` 至 `0.65`、`max_tokens` 至 `1600`、`MAX_TOOL_ROUNDS` 至 `4`，扩展多轮记忆至 `14` 轮 / `1200` 字符；② 增强只读工具：`get_museum_item_detail` 新增支持 `product`，`query_appointment_slots` 默认 7 天并在指定日期无余量时自动附带 `nextAvailableSlots`；③ 升级交互与排版：新增 `viewer_tour` 3D 三步导览动作（`ear → motif → feet`）、`navigate` 支持 `people` 与 `category` 参数（同步 `AppointmentView` 人数预填）、`LuoshengSiteGuide.vue` 零 `v-html` 安全解析 `**加粗**` 与列表并升级 `guidePresets.ts` 破冰问题；④ 回归验证：后端 `mvn test` 全绿、前端 `vue-tsc -b` 0 错、`vitest run` `77` 文件 / `433/433` 全绿、`npm run build` + 双门禁全绿（首屏 JS `79,614 / 81,638 B`、CSS `12,933 / 80,000 B`）。

- **展馆配乐 R4 生产接入、门禁升级与 ADR-011 归档（Track 3 Phase 4–5，2026-11-23）**：见 [2026-11-23-museum-music-experience-upgrade-goal.md](docs/plans/2026-11-23-museum-music-experience-upgrade-goal.md) 与 [ADR-011](docs/decisions/ADR-011-music-r4-eastern-accents-and-aac-delivery.md)。① 审计引入 `sgossner/VCSL`（CC0 1.0）31 个声学采样（`Hand Chimes`、`Dan Tranh`、`Vibraphone/Soft Mallets`、`Gong 1`、`Baroque Tenor Recorder`），262,144 点 FFT 校准基频，保持 R1–R3 `VSCO 2 CE` 样本及散列零改动；② 生成 R4 四乐章并经 `http://127.0.0.1:4197/?revision=r4` 主观试听批复采纳，选用 AAC `.m4a` 96 kbps 单格式部署至 `frontend/public/media/audio/music-r4/`（4 首共 `5,001,307 B / 6,000,000 B`）；③ 显式映射 `river-map-jade-bi`、`painted-pottery-water-jar`、`river-map-pattern-stone` → `jade`，扩展 `AudioControl` 至 4 首选曲与双 CC0 署名，同步 `mediaSession` 与 `music-assets-budget.mjs`；④ 前端 `vue-tsc -b` 0 错误、`vitest run` `77` 文件 / `432/432` 全绿、`vite build` + `bundle-budget`（首屏 JS `79,572 / 81,638 B`，CSS `12,645 / 80,000 B`）+ `music-assets-budget` 全绿，Playwright `music-r4-browser-check.mjs` `21/21` 通过。

- **全馆音乐体验升级（Track 1 + Track 2）、「十二律吕 · 青铜游标刻度（AcousticRuler）」及全站裁切遮挡与移动端适配收口（2026-11-23）**：见 [2026-11-23-museum-music-experience-upgrade-goal.md](docs/plans/2026-11-23-museum-music-experience-upgrade-goal.md) 与 [2026-11-23-acoustic-ruler-visualizer-goal.md](docs/plans/2026-11-23-acoustic-ruler-visualizer-goal.md)。① 音乐与声画联动：完成等功率交叉淡化、iOS `interrupted` 自愈、后台暂停同步、`Media Session`、`AudioControl` 展签选曲、洛笙引用计数避让、3D 暗房邀请/点云低频滤波与立体声微音效；② 十二律吕游标刻度：完成磨砂玻璃操控台（桌面 `XII · 十二律吕` + 60 针、移动 36 针 + `开启声景` 胶囊）、十二律柱、古琴丝弦包络、洛水倒影及零 `shadowBlur` / 停帧零 `rAF` 引擎；③ 全站无遮挡与移动端适配：修复 [ExploreView.vue](frontend/src/views/ExploreView.vue) `.gallery-object__media` Grid 撑高裁切（《河图玉璧》等底边完整显现）、[ExhibitsView.vue](frontend/src/views/ExhibitsView.vue) 移动展柜 `480px` 溢宽裁切、[ShopView.vue](frontend/src/views/ShopView.vue) 悬浮购物袋压卡改为吸顶工具条、`375px`/`390px` 暗房短屏间距、首页/详情页/页脚 `44px` 触控热区。最新回归：`vue-tsc -b` 0 错、`vitest run` `77` 文件 / `432/432` 全绿、`vite build` + 预算门禁（首屏 JS `79,623 / 81,638 B`、CSS `12,933 / 80,000 B`、R4 `5,001,307 / 6,000,000 B`）全绿，Playwright `acoustic-upgrade-verify.mjs`（帧耗均值 `0.085 ms` / 峰值 `0.5 ms`）、`luosheng-isolation.mjs` 与 33 视图桌面/移动（1440/390/375）无裁切/无重叠巡检全通过。

- **全站双主题材质升级、去 AI 味与画册级装裱同步（2026-11-23）**：见 [2026-11-23-curatorial-fine-polish.md](docs/plans/2026-11-23-curatorial-fine-polish.md) 补充记录。① 去除首页与顶栏模板化眉标、伪序号与嵌套卡片，收敛背景纹样为极简 `72px` 微距建筑坐标点并柔化鼠标光点与悬停动效；② 深色模式基底去棕去泥感，收敛为纯净建筑石墨炭灰（`oklch(15.5% 0.002 75)`）并统一页脚；③ 浅色模式升级「展厅天光 + 超细纸石肌理 + 青铜鼎深色暗房展柜 + 暖灰莱姆石色带 + 克制印泥朱砂点睛 + 方案 A 深石墨底座」，并将装裱阴影与暗房展窗全量同步至 `03-surfaces.css`、`04-components.css` 与 `/explore`、`/exhibits`、`/shop`、`/appointment`、`/artifacts/:slug`；④ 首页 Section 3 三栏器物卡改为 `1:1` 等宽无裁切画框并替换为实拍谷纹玉璧图（`explore-jade-bi-user-v2.webp`）。前端 `vitest run` `76` 文件 / `450/450` 全绿，`vue-tsc -b`、`vite build` 与预算门禁全绿，已在本地启动前后端实景巡检首页与 4 个核心内页。

- **审查修补**：V27 改为逐字段精确匹配旧种子；图版切换语言时隔离请求；材质阴影回归设计令牌。后端 93/93、前端 450/450、类型检查和构建通过。见[验证与发布边界](docs/plans/2026-11-23-review-repairs.md)。

- **全馆知识库文本与双语签名证据包全面优化**（见计划 [2026-11-23-knowledge-base-text-optimization.md](docs/plans/2026-11-23-knowledge-base-text-optimization.md)）：
  - **Tier-1 签名证据卡升至 v6（中英双语 9 卡）**：升级 `content/luosheng/ding.zh-CN.json` 并新增 `ding.en-US.json`（同步更新 `.sha256`、`ding-profile.json`、`minimum-release-version.txt=6`），统一 3D + 静态图版双兼容语境，新增 `LS-DING-POINTCLOUD` 点云观察卡，为 4 张核心事实卡补齐 ADR-006 `claim` 字段并扩充口语/英文 `aliases`。
  - **Tier-2 馆藏/专题/文创/展项文案升级与单一事实源收敛**：新增 Flyway 迁移 `V27__refine_museum_knowledge_copy.sql`（条件更新、严禁覆盖人工编辑）与单一文案源 `seed-editorial-copy.json` / `SeedEditorialContent.java`，修正 3D 展项标题为「河洛青铜鼎 · 3D 数字重制展项」与 `display_no = 01`，补齐青铜鼎结构化尺寸与展厅位置，重写 3 件文创策展说明并补齐中英字段，精修 5 件概念展品具象视觉锚点与跨展品串联，新增第 4 篇专题《参观与数字导览须知》（`visit-and-digital-guide`）。
  - **双语检索与降级联动**：`GuideKnowledgeService` / `GuidePromptBuilder` / `GuideDeterministicFallback` / `GuideExhibitController` / `LuoshengPreset.vue` 全链路支持英文签名卡与商品/展项英文字段，优化中文长问句分词召回，清理失效关键词 `"书签"`。后端 `mvn test` `92/92` 全绿，前端 `vue-tsc -b` 与 `vite build`（含预算门禁）全绿。
- **洛笙 AI 向导 v2 架构改造（Phase 0–5 全闭环）**：
  - **架构与安全（Phase 0–2）**：落地 [ADR-010](docs/decisions/ADR-010-luosheng-v2-museum-agent.md)（D1 中英双语自适应、D2 SSE 真流式 + JSON 兜底、D3 静态 3 看点图版卡、D4 DeepSeek `deepseek-chat` 200 次/天 × 4 并发）；构建全馆实时知识层（`GuideKnowledgeService`，MySQL 60s 短缓存 + 青铜鼎 Tier-1 SHA-256/防回滚/ADR-006 证据卡）、3 个只读工具（`get_museum_item_detail`、`search_museum_catalog`、`query_appointment_slots`）、无状态限流与幂等缓存、24 字符流式缓冲解析器、高危事实红线与白名单校验器、确定性馆藏直出真降级引擎；`SecurityConfiguration` 放行 `DispatcherType.ASYNC`，`frontend/nginx.conf` 对 `/api/v1/guide/chat/stream` 关闭代理缓冲。
  - **3D 深度联动与前端瘦身（Phase 3–4）**：`ThreeExhibitViewer` 新增 `focusPart('ear' | 'feet' | 'motif')` 平滑聚焦与 `view-change` 事件；`ExhibitDetailView` 移除旧 `guideHandoff` 3D 阻断并消费 `luoshengStore.pendingViewerAction`；重写流式多轮抽屉 `LuoshengSiteGuide.vue`（`sessionStorage` 持久历史、跨页分隔线、停止生成、诚实模式徽标、折叠「依据与边界」抽屉、移动端自动收起）与轻量只读 `LuoshengPreset.vue`；彻底删除 10 个旧后端类、22 个旧前端库/单测及 12 个冗余脚本，开关收敛为 `VITE_GUIDE_ENABLED` 与 `MUSEUM_GUIDE_ENABLED`。
  - **全量验收与真实 DeepSeek 36 题评测（Phase 5）**：
    - 后端 `mvn test`：`92 / 92` 全绿；前端 `vue-tsc -b` 0 错误、`vitest run` `74` 文件 / `444` 用例全绿、`vite build` + 包体预算门禁全绿（首屏 JS gzip `77,202 B` / 预算 `81,638 B`，CSS gzip `9,253 B` / 预算 `80,000 B`）。
    - 真实 DeepSeek 36 题单一路径评测（[v2-eval.md](docs/luosheng/eval/v2-eval.md)，直连 `/api/v1/guide/chat`）：非红队 `29/30`（**96.7%**）、红队 `6/6`（**100%**）、动作合法率 `36/36`（**100%**）、真 AI 占比 `36/36`、P50 `2,545 ms` / P95 `4,385 ms`。
    - Playwright 实测（390 深色 & 1440 浅色）：`luosheng-e2e.mjs` 与 `luosheng-isolation.mjs` 全通过，零控制台报错、零横向溢出、关闭态零 UI 且零 `/api/v1/guide/` 请求。
- **全站策展级细节精修与体验收口（2026-11-23）**：依据 `$impeccable critique` 双路独立评审与 [2026-11-23-curatorial-fine-polish.md](docs/plans/2026-11-23-curatorial-fine-polish.md) 完成 5 大模块收口：① 从公开页面收敛 `LightPresetSwitcher` 调试坞（仅 `?debugLights=1` 开启）并修复其 `>=12px` 字号与对比度，解除预约页「联系人姓名」遮挡；② 将浅色 `--accent-bronze` 加深至 `oklch(50% 0.088 72)` 稳过 WCAG AA（`>=4.6:1`）；③ 首页三脉画廊 `01 青铜礼器` 换用暗调青铜爵并统一暗调展台底衬，`/explore` 将镇馆之宝 `河洛青铜鼎` 提至首位并排布为 `2+1 / 1+2 / 2+1` 9 格满版对称画册网格（消除第 3 行 2/3 空白与主题导览孤字断行），文物详情页同步使用完整三足高清展台图并收敛重复洛笙按钮；④ 3D 展厅压暗过曝石质展台为沉稳玄武岩/暗青石底座，统一 `EXHIBIT 01` 编号与中文 CC0 溯源，移除底坞 26px 模糊重复小圆图；⑤ 后台运营台移除 `width: 48%` 伪进度条硬编码、开放全部 7 个 Tab 的实时列表筛选、将内容新建表单低频字段收进 `<details>` 折叠组，并为个人中心「文创账簿」订单卡补齐 `60×60px` 商品缩略图。
- **首页首屏「浑仪磁阵」鼠标光点场升级定稿（2026-11-23）**：新增 [heroDotFieldRenderers.ts](frontend/src/lib/heroDotFieldRenderers.ts) 与单测 [heroDotFieldRenderers.spec.ts](frontend/src/lib/heroDotFieldRenderers.spec.ts)（见计划 [2026-11-23-hero-raking-light.md](docs/plans/2026-11-23-hero-raking-light.md)），为首页 `<PointerDotField variant="image" />` 引入左文右鼎空间避让遮罩、胡克弹簧阻尼 + 速度流线彗尾 + 0.4 Hz 悬停微呼吸、预烘焙离屏光晕图章（深色纯乌金香槟渐变、浅色古铜鎏金 +「金镶玉」星枢）、星枢四芒星针与 2-最近邻渐变星轨连线；Playwright 1440×900 深/浅双主题连续扫动均值 `3.63–3.64 ms`（P95 `3.7 ms`）。
- **前端 Heluo Editorial 2.0 视觉与 CSS 架构全面升级（2026-11-22）**：`@layer` 8 层样式与 OKLCH 双色令牌及 11 路由视觉升级完整保留未受损。

## 当前风险与运维注意

1. **生产开启安全阀**：部署站开启 `VITE_GUIDE_ENABLED=true`、`MUSEUM_GUIDE_ENABLED=true` 时，密钥仅经服务端环境变量注入（`MUSEUM_GUIDE_MODEL_KEY` 或 `DEEPSEEK_API_KEY`），默认日额度 `200` 次/天、最大并发 `4`，异常时可通过 `MUSEUM_GUIDE_PAUSE_PATH` 热暂停或置 `MUSEUM_GUIDE_MODEL_ENABLED=false` 无缝切换至馆藏直出模式。
2. **Nginx 生产实机流式验证**：`frontend/nginx.conf` 与 `deploy/compose.yaml` 已完成 SSE 关缓冲配置，建议在 Docker Compose 实机部署时抽检一次逐字流式首包延迟。
3. **移动旧版 Chrome 3D 既有问题**：Android V2366HA Chrome 133 存在 WebGL `contextlost`（同机 vivo 浏览器可用），无 WebGL 时 `ExhibitDetailView` 已自动温和降级至静态 3 看点图版。
4. **旧 Mailpit 仍在运行**：本机先前已有 `deploy-mailpit-1` 绑定 `0.0.0.0:8025`；新配置不会关停旧实例，本轮未触碰该部署。正式发布前先确认归属并获准关闭暴露的测试收件箱，再复验真实 SMTP、公开 HTTPS、代理链和生产 SSE。洛笙模式、限额及缓存为进程内状态，多副本部署前需另行设计。

## 下一步

1. 等待用户审查前后端工作树变更（后端 Gate 0–2 + 前端策展体验升级），明确是否执行 `git commit` 以及宿主机旧容器 `deploy-mailpit-1` 的运维关停窗口；未经确认不提交、不推送、不发版。
2. 正式公网发布前，在目标部署环境完成外层 HTTPS/反向代理下的真实 SMTP、SSE 首包流式表现与文件热暂停最终核验。
