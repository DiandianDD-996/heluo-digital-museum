# 内容关联、来源与业务验收记录

关联主计划 `2026-09-10-holistic-optimization-plan.md` 阶段 B/D；需求 F-01/F-03/F-04/F-05、N-02/N-06。状态：本地内容修正已实施，整体优化与生产验收未完成。

## 本批目标和边界

把青铜鼎模型关联到独立的鼎记录，保留原有爵记录及管理员内容；让公开列表、详情和索引遵守相同的发布规则。来源核对区分实物资料、数字重制和项目概念创作，不补写未经验证的年代、出土地点或真实场馆信息。

独立前端任务正在修改视图与共享样式，本批不编辑这些模块。首页/任务页截图来自实施中的前端快照，不能作为原版截图或最终视觉通过证据。

## 实施与数据保护

- 新初始化数据创建 `heluo-bronze-ding`，3D 展项关联该记录；原 `heluo-bronze-jue` 的标题、正文和身份不变。
- 新增 Java Flyway V24，旧 V1–V23 不改动。只处理标题、slug、CC0 模型引用及官方来源 URL 都匹配的已发布旧展项与爵。
- 若目标鼎 slug 已存在（包括草稿、撤回或软删除），或旧数据已被改成其他内容，迁移跳过，留给编辑核对，不覆盖或擅自重新发布。
- 插入与关联更新在同一事务中进行；连接已有事务时交给 Flyway 管理，自动提交连接则自行提交/回滚。关联更新异常不得留下孤立的新鼎记录。
- 展项公开列表/详情与 sitemap 都要求展项、关联文物已发布且未删除，分类处于启用状态。

恢复原则：保留旧爵和原关联信息。生产发布前记录目标展项 ID、旧 artifact_id、标题/来源、状态与内容摘要；若需恢复，用审核过的补偿迁移只调整符合预期的关联，不删除新内容，不改历史迁移。若已有人编辑或产生新关联，先人工核对，不自动覆盖。当前未执行生产迁移或恢复。

## 本地公开内容清单

2026-09-11 对隔离 MySQL API 实际读取全部分页和详情：6 件文物记录、3 篇文章、1 个 3D 展项、3 件商品。检查时间不是内容发布日期；公开 API 未提供的发布日期不能猜测。初始化时间也不等同原创时间。

证据：`artifacts/holistic/content-1789057433948/inventory.json`，含详情和 SHA-256；不含凭据。通过独立脚本可重新采集：在 frontend 运行 `node scripts/holistic-content-audit.mjs`。

| 内容 | 性质与来源 | 许可/确认边界 | 本地公开情况 |
|---|---|---|---|
| 河洛青铜鼎（数字重制） | CMA 1962.281 Tripod (Ding) 基础模型；项目材质、法线、灯光及局部浮雕校正；封面为项目渲染 | 原基础模型 CC0；本版本不是官方复原，也不代表河洛出土或项目实物收藏 | 已发布；详情→3D→文物返回身份一致 |
| 河洛纹青铜爵（概念展品） | 项目概念图与观察性展签；IMG-EXHIBIT-BRONZE-JUE | 图片台账记载项目组确认第一版展示使用；不能延伸为真实文物档案或所有素材均 CC0 | 已发布；保留原记录，不再关联鼎模型 |
| 河图玉璧（概念展品） | 项目概念图；IMG-EXHIBIT-JADE-BI | 同上；象征性阅读不作为特定出土器物结论 | 已发布，无对应 3D |
| 彩陶水纹罐（概念展品） | 项目概念图；IMG-EXHIBIT-POTTERY-JAR | 同上；生活场景为阅读引导 | 已发布，无对应 3D |
| 河洛图纹石板（概念展品） | 项目概念图；IMG-EXHIBIT-RIVER-STONE | 同上；图纹相似不构成考古证据 | 已发布，无对应 3D |
| 水鸟青铜雕塑（概念展品） | 项目概念图；IMG-EXHIBIT-WATER-BIRD | 同上；不宣称真实馆藏 | 已发布，无对应 3D |
| 河洛青铜鼎 · 互动概念展项 | CMA 官方原件页与其 Sketchfab 模型；桌面 5,213,372 B、移动 837,720 B | CC0 基础网格与项目重制分开说明；v5.4 封面不冒充 v5.5 原始扫描照片 | 已发布，关联独立鼎 |
| 笔记本、丝巾、茶杯套装 | 项目概念文创与自制展示图，图片台账已有对应资源 | 仅模拟交易，不据图片和价格承诺真实供货 | 3 件已上架；库存为隔离演示数据 |

原件资料：[Cleveland Museum of Art 1962.281](https://www.clevelandart.org/art/1962.281)；模型发布：[Cleveland Museum of Art / Sketchfab](https://sketchfab.com/3d-models/1962281-tripod-ding-af15e7980f9b4f718094fc2e16205d89)。基础模型下载与散列证据见 `assets/models/bronze-ding/source/third-party/cleveland-1962.281/SOURCE.md`。

素材依据还包括 `assets/images/README.md`、`frontend/public/media/editorial/README.md` 与 `frontend/public/media/exhibits/README.md`。这些台账包含图像生成、用户供图和项目渲染等不同来源；“自主创作”不能替代逐文件生成记录、授权条件与商业使用审核。未对新增图片作法律许可背书。

## 首页重点故事接入文案（待页面接入）

2026-09-11 02:20 更新：下述文案已由前端接入 `HomeView.vue`，详情通过 `PlainTextLinks` 呈现来源网址。`holistic-content-browser-audit.mjs` 在最新前端 preview4199→隔离 Compose4196 通过首页→鼎详情→3D→返回/刷新、来源安全属性、390px换行；报告 `artifacts/holistic/content-browser-1789063817240/summary.json`。最终双主题双语双宽度八组/52检查包含手机实际启动3D与信息面板返回，详见 `premium-visual-2026-09-10/selection-states/summary.json`。以下“待接入”文字为准备阶段历史，本轮不再等待页面编辑；线上与真机未验收。

首页近观区保留青铜鼎意象配图及其“数字策展配图”标识，不将意象图称为原件照片。唯一故事入口指向 `/artifacts/heluo-bronze-ding`，详情再进入关联的 3D 展项。中文正文为以下 106 字（含标点、不计空白），符合主方案 80–140 字摘要约定：

鼎的双耳、器腹与三足，怎样组成一件器物的轮廓？先从正面观察，再换个角度看看支撑与纹样的变化。这件数字重制作品以克利夫兰艺术博物馆公开模型为基础。读完三个观察提示，再进入互动展项，分辨原件资料与数字呈现之间的边界。

中文入口：`阅读青铜鼎故事`。英文摘要：`How do the handles, body and three legs shape a ding? Start from the front, then change your viewpoint to examine its supports and patterns. This digital reworking uses an open model from the Cleveland Museum of Art. Read three observation prompts before entering the interactive exhibit, with the original object and this digital presentation clearly distinguished.` 英文入口：`Read the ding story`。

验收需由首页实际点击进入鼎详情，核对标题、三个观察点及可点击来源，再进入3D并返回。本文案准备不代表页面已经接入或浏览器已通过。

## 三篇文章的编辑审核结果

| 文章 | 已核对内容 | 可保留的表述 | 补充资料前的限制 |
|---|---|---|---|
| 第一次看青铜器，可以从哪三个问题开始？ | 以器形、纹样、场景组织观察；正文明确区分事实、假设与联想 | 项目编写的观察练习 | 不把器形推断当作某件原物的确定用途；若新增年代或礼制结论，逐条链接研究资料 |
| 把河流看成一条时间线：河洛文化的年轻化阅读 | 水系、聚落、交换与图纹的策展视角；没有具体考古文献引用 | 提问式文化阅读与比较线索 | 泛化的河运/迁徙叙事未经针对河洛具体时期的考证，不标“研究成果”；不得生成虚假引文 |
| 为什么“留白”让一件展品更容易被看见？ | 页面层级、阅读节奏与无障碍的设计观点 | 项目策展/界面设计随笔 | 不宣称有未经提供的用户研究支持；W3C 可支持具体可读性要求，不能替整篇美学观点背书 |

三篇当前署名均为“河洛数字博物馆”，不代表实物保管机构的学术审定。此次未覆盖管理员文章正文；来源不足项保留编辑说明。馆舍性质、准确机构名称、地址、开放时间与到访承诺仍需项目方事实确认。

## 验证与未完成项

发布日期补验：公开 API 不暴露该字段，本轮通过隔离 Compose MySQL 的只读查询取得 13 条公开记录的 `publishedAt/status/deletedAt/coverAssetRef`，均有发布日期且未删除。`artifacts/holistic/publication-1789059985413/inventory.json`。这些时间为本地初始化/发布数据库值，保留原样，不作为线上日期、考古年代或推测性页面文案。

2026-09-11 最新增量（下列旧记录保留为历史）：Docker 已恢复，真实 Compose 浏览器 12/12、HTTP 13 项、内容 API 清单通过；已用真实页面点击完成鼎详情→3D→返回鼎详情并刷新。证据 `artifacts/holistic/content-browser-1789059318803/summary.json`。最新 H2 全后端 11 类/66 项及打包通过，隔离 MySQL 质量专项 6/6。来源 URL 的可点击组件已有独立测试但尚未接入页面；真实机构资料与最终移动视觉仍未验收。

- 后端完整 `mvn -q test package`：11 类/64 项通过，含分类停用、撤回、软删除的 API/索引反例。此次数量不包含随后新增的迁移失败回滚测试。
- V24 专项隔离 MySQL：14 项通过，覆盖常规升级、幂等、管理员自定义/撤回/删除跳过，以及插入后关联失败的事务回滚；H2 全量重验另记最新结果。
- 真实隔离 MySQL 浏览器：10/10 通过，覆盖预约续填/管理员确认、模拟支付、响应丢失恢复、后台发布撤回、越权及分页。环境 4192/18082，证据 `artifacts/sitewide-quality/business-mysql-results.json`；该次 JAR 尚未包含最后新增的事务防护，不能说其覆盖该补丁。
- 内容公开 API 和索引关联脚本通过；不等同浏览器来源链接已完成可点击改造。
- Docker Engine 当前缺少 `dockerDesktopLinuxEngine` 管道，真实 Compose 拓扑没有通过；不拿原生 MySQL 验收替代。
- 线上 204 根因、正式版本一致性、平台 iframe 分享、来源入口的最终视觉、真实手机、长期 3D 性能仍待验收。全方案未完成，未提交、推送或上线。
