# ADR-010 洛笙 AI 向导 v2：全馆知识库 × 真多轮流式对话 × 3D 展柜联动

状态：已采纳，2026-11-23。依据：[洛笙 AI 向导 v2 架构改造方案](../plans/2026-11-23-luosheng-v2-architecture.md)。

## 背景

洛笙 v1（[ADR-009](ADR-009-luosheng-v1-convergence.md)）虽具备可靠的证据校验与冲突拦截安全内核，但在实际产品体验与工程可维护性上存在明显瓶颈：

1. **知识与能力过于受限**：全馆仅覆盖青铜鼎 1 件展品，模型只能输出 ≤24 码点的无事实接话加 8 选 1–2 卡片编号；前后端堆叠了十余条硬编码正则拦截器与过严的名词黑名单，反而误伤“尺寸/重量/出土”等正常提问。
2. **对话与 3D 割裂**：后端无历史记忆、前端收起面板即清空记录、非流式等待体验差；在 3D 展项页中 `guideHandoff` 甚至反向阻断 3D 渲染器启动，导致向导与 3D 展柜完全脱节。
3. **评测两张皮与工程包袱**：离线评测脚本复写了独立 Prompt，未直连生产接口；前后端遗留大量预览、fixture 与分散开关。

因此决定实施洛笙 v2 架构重构，在不新增重型前后端依赖的前提下，将洛笙升级为全馆实时知识 Grounded 的策展级向导与 3D 展柜副驾。

## 决定

### 1. 拍板锁定的 4 项核心决策（D1–D4）

- **D1（双语支持）**：中英双语自适应，跟随前端 `locale`（`zh-CN` / `en-US`）。英文页面同样开放洛笙，后端依据 `locale` 切换系统提示词语言，并结合库内 `title_en` / `summary_en` 与已审证据生成对应语言回答。
- **D2（流式输出与兜底）**：采用 SSE 真流式接口 `POST /api/v1/guide/chat/stream`（`text/event-stream;charset=UTF-8`）作为主链路，保留非流式 JSON 接口 `POST /api/v1/guide/chat` 作为自动兜底与评测入口。`SecurityConfiguration` 放行 `DispatcherType.ASYNC`，`frontend/nginx.conf` 对 `/api/v1/guide/chat/stream` 关闭代理缓冲（`proxy_buffering off`）。
- **D3（`LuoshengPreset` 定位）**：保留并精简为轻量只读「3 看点静态图版卡」+「向洛笙追问」按钮，移除 `visit.target` 滚动劫持与整段文案堆砌，兼作无 WebGL 设备的静态看点对照。
- **D4（默认模型与运营额度）**：继续使用 DeepSeek（`deepseek-chat`），底层采用标准 OpenAI Chat Completions 兼容协议（零改代码即可切换至 Qwen / GLM / Gemini 等兼容服务）；默认日调用上限 `200` 次/天、最大并发 `4`，密钥优先读取 `MUSEUM_GUIDE_MODEL_KEY` 并回退读取 `DEEPSEEK_API_KEY`。

### 2. 全馆知识分层与混合工具编排

- **Tier-1（权威优先）**：保留青铜鼎 8 张已签核证据卡的运行时安全校验（SHA-256 指纹、最低版本防回滚、可见性过滤与 [ADR-006](ADR-006-luosheng-structured-evidence-conflict.md) 同 `claim.key` 冲突屏蔽）。
- **Tier-2（MySQL 实时公开内容）**：`GuideKnowledgeService` 统一读取已发布且未软删的藏品（`artifacts`）、专题（`articles`）、3D 展项（`exhibits_3d`）与文创商品（`products`），静态元数据使用 60s 短缓存；公开预约时段（`appointment_slots`）仅实时直查，严格沿用 14 天公开窗口与 `1..30` 人校验。
- **3 个只读工具**：`get_museum_item_detail`、`search_museum_catalog`、`query_appointment_slots`，单轮最多 2 次工具往返，绝不执行写操作（预约/下单/改状态）。

### 3. 三层护栏与真降级

- **第一层（Prompt 约束）**：严格区分数字重制展品（河洛青铜鼎）与原创概念展品，资料未载处坦诚告知，不凭常识虚构；按需输出 `<<<LUOSHENG_META>>>` 尾部结构化元数据。
- **第二层（服务端校验 `GuideResponseValidator`）**：
  - 引用白名单校验与完整来源补全；
  - 5 类结构化动作白名单校验（`viewer_focus`、`viewer_mode`、`navigate`、`open_plate`、`open_source`），剔除非法 slug/路由/外链；
  - 高危事实红线校验（放行正常提问复述词，仅拦截肯定性出土地/断代/估价/越权完成预约下单断言，并过滤正文裸链）。
- **第三层（真降级 `GuideDeterministicFallback`）**：模型关闭、超时、异常、触及并发/每日上限或命中红线时，基于同一套检索结果返回可读确定性摘要、合法引用与合法动作，并如实标注 `mode: "deterministic"`（前端显示「馆藏资料直出」）。

### 4. 3D 展柜深度联动与前端收敛

- `ThreeExhibitViewer` 新增 `focusPart('ear' | 'feet' | 'motif')` 局部平滑聚焦与 `view-change` 被动状态上报；
- `ExhibitDetailView` 彻底移除 `guideHandoff` 对 3D 自动启动的阻断，消费 `luoshengStore.pendingViewerAction` 在用户主动点击 3D 动作按钮后自动激活并平滑转至目标视角/点云模式；
- 前端多轮对话通过 `sessionStorage` 持久化（收起/跨页不丢记录），支持跨页分隔线、取消生成与一键清空；
- 开关从 7 个收敛为 2 个核心开关：`VITE_GUIDE_ENABLED`（前端）与 `MUSEUM_GUIDE_ENABLED`（后端），配 `MUSEUM_GUIDE_MODEL_ENABLED`、`MUSEUM_GUIDE_DAILY_TURN_LIMIT`、`MUSEUM_GUIDE_MAX_CONCURRENT_GENERATIONS`、`MUSEUM_GUIDE_PAUSE_PATH`。

### 5. 单一路径评测

- `scripts/luosheng-eval.mjs` 严禁在脚本内复写 Prompt，必须直连真实启动的后端 `POST /api/v1/guide/chat` 接口运行 36 题全馆评测集。

## 取代与保留

- **取代 [ADR-009](ADR-009-luosheng-v1-convergence.md)**：
  - 第 1 条（仅单件青铜鼎范围）→ 扩展至全馆公开内容（6 藏品 + 3 专题 + 3D 展项 + 文创 + 14 天预约时段）；
  - 第 3 条（≤24 码点无事实接话 + 逐字拼接 + 名词黑名单）→ 升级为自然流式策展讲解 + 3 工具 + 三层护栏与真降级；
  - 仅 `zh-CN` 语言限制 → 升级为 `zh-CN` / `en-US` 双语自适应；
  - 删除 `GuideTurnController`、硬编码 12 条正则及前端 `luoshengIntent.ts` 等历史遗留。
- **保留不变的原则**：
  - 游客控制权第一（绝不替游客自动旋转 3D、跳转、预约或下单；镜头转动不等于注视）；
  - [ADR-006](ADR-006-luosheng-structured-evidence-conflict.md) 冲突屏蔽、Tier-1 证据卡 SHA-256 指纹与最低版本防回滚；
  - 默认关闭、无状态限流、每日额度 200 次/天、最大并发 4、运维暂停文件与零重型依赖约束。

## 后果

- **正面**：全馆内容实时同步、真多轮流式讲解、3D 展柜可点即看、中英双语可用、前后端代码大幅瘦身、评测与生产零两张皮。
- **代价与防护**：放开自由生成后需依赖 Prompt + 高危红线 + 引用/动作白名单共同守门；若线上出现异常，可通过 `MUSEUM_GUIDE_PAUSE_PATH` 热暂停或将 `MUSEUM_GUIDE_MODEL_ENABLED=false` 无缝切换为确定性馆藏直出模式。
