# 项目状态

> 本文件只记录**当下状态、风险与下一步**（硬上限 150 行）。完整历史记录已归档至 [docs/archive/status-2026.md](docs/archive/status-2026.md)。

## 当前总览（2026-11-23）

| 模块 | 当前状态 | 说明 |
| --- | --- | --- |
| 数字博物馆主体（前后端 + 3D + 预约 + 商城模拟支付 + 后台） | **已完成并已部署演练** | F-01～F-14、A-01～A-02、N-01～N-06 均已达成；PocketBay 演示站已跑通 |
| 前端视觉与 CSS 架构升级（Heluo Editorial 2.0） | **Phase 0–6、策展细节精修与双主题质感同步全部完成** | 计划见 [2026-11-22-frontend-design-overhaul.md](docs/plans/2026-11-22-frontend-design-overhaul.md) 与 [2026-11-23-curatorial-fine-polish.md](docs/plans/2026-11-23-curatorial-fine-polish.md)，系统规范见 [design.md](design.md) |
| 洛笙 AI 向导 v2（可选扩展） | **Phase 0–5 全部完成并验收全绿** | 唯一活文档见 [docs/luosheng/README.md](docs/luosheng/README.md)，决策见 [ADR-010](docs/decisions/ADR-010-luosheng-v2-museum-agent.md)，方案见 [2026-11-23-luosheng-v2-architecture.md](docs/plans/2026-11-23-luosheng-v2-architecture.md) |

## 最近完成（2026-11-23）

- **展馆配乐 R4 生产接入、门禁升级与 ADR-011 归档（Track 3 Phase 4–5，2026-11-23）**：见 [2026-11-23-museum-music-experience-upgrade-goal.md](docs/plans/2026-11-23-museum-music-experience-upgrade-goal.md) 与 [ADR-011](docs/decisions/ADR-011-music-r4-eastern-accents-and-aac-delivery.md)。① 审计引入 `sgossner/VCSL`（CC0 1.0）31 个声学采样（`Hand Chimes`、`Dan Tranh`、`Vibraphone/Soft Mallets`、`Gong 1`、`Baroque Tenor Recorder`），262,144 点 FFT 校准基频，保持 R1–R3 `VSCO 2 CE` 样本及散列零改动；② 生成 R4 四乐章并经 `http://127.0.0.1:4197/?revision=r4` 主观试听批复采纳，选用 AAC `.m4a` 96 kbps 单格式部署至 `frontend/public/media/audio/music-r4/`（4 首共 `5,001,307 B / 6,000,000 B`）；③ 显式映射 `river-map-jade-bi`、`painted-pottery-water-jar`、`river-map-pattern-stone` → `jade`，扩展 `AudioControl` 至 4 首选曲与双 CC0 署名，同步 `mediaSession` 与 `music-assets-budget.mjs`；④ 前端 `vue-tsc -b` 0 错误、`vitest run` `77` 文件 / `432/432` 全绿、`vite build` + `bundle-budget`（首屏 JS `79,572 / 81,638 B`，CSS `12,645 / 80,000 B`）+ `music-assets-budget` 全绿，Playwright `music-r4-browser-check.mjs` `21/21` 通过。

- **全馆音乐体验升级（Track 1 + Track 2）与「十二律吕 · 青铜游标刻度（AcousticRuler）」全栈交付（2026-11-23）**：见 [2026-11-23-museum-music-experience-upgrade-goal.md](docs/plans/2026-11-23-museum-music-experience-upgrade-goal.md) 与 [2026-11-23-acoustic-ruler-visualizer-goal.md](docs/plans/2026-11-23-acoustic-ruler-visualizer-goal.md)。① Track 1：实现等功率正/余弦交叉淡化、iOS `interrupted` 上下文自愈、后台暂停显式状态广播与 `Media Session` 媒体控制、登录/重置页静音与预约页轻柔降幅、`musicCatalog` 与 `AudioControl` 曲目展签/手动锁定选曲/CC0 声音手记折叠、洛笙 AI 抽屉展开（`0.72`）/流式（`0.62`）引用计数避让，并清理退役 `musicGenerator` 死代码；② Track 2：新增 3D 暗房首访声景轻邀请、深色曜石/点云模式双级 `BiquadFilter` 声学滤波与离页复位、以及 3D 部位聚焦（双耳/纹饰/三足）立体声像微音效（同步修复 390px 移动端 3D 顶栏按钮竖排折行）；③ AcousticRuler：新增对数分频与快起慢落弹簧绘制引擎 [acousticRulerEngine.ts](frontend/src/lib/acousticRulerEngine.ts) 及三重门控（视口/可见性/静音停帧）组件 [AcousticRuler.vue](frontend/src/components/AcousticRuler.vue)，接入首页首屏底边与 3D 展厅底边（含实体/点云调色与聚焦涟漪）。前端 `vue-tsc -b` 0 错误、`vitest run` `77` 文件 / `432/432` 全绿、预算门禁（首屏 JS `79,392 / 81,638 B`、CSS `12,624 / 80,000 B`、R3 `4,933,850 / 6,000,000 B`）全绿，Playwright `acoustic-upgrade-verify.mjs`（1440/390 双主题、帧耗均值 `0.0442 ms`、静音与离屏 `0` rAF）、`music-r3-browser-check.mjs`（29/29）与 `luosheng-isolation.mjs` 全绿。

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

## 下一步

1. 审查工作树 `git status` 与 `git diff`，确认 Heluo Editorial 2.0 与洛笙 v2 改动后由用户决定分批或合并提交。
2. 按需在演示环境配置 `VITE_GUIDE_ENABLED=true`、`MUSEUM_GUIDE_ENABLED=true` 并完成一次 Docker Compose 生产环境 SSE 冒烟与热暂停演练。
