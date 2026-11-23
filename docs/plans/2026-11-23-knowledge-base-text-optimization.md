# 河洛数字博物馆知识库文本全面优化计划（2026-11-23）

## 1. 目标与关联需求

全面优化项目两层知识库文本（Tier-1 青铜鼎签名证据卡 + Tier-2 馆藏/专题/3D 展项/文创数据库文本）及配套双语检索、降级与单一事实源治理：

- 关联模块：F-01～F-04（公开内容与 3D 展项）、F-07（文创商城）、洛笙 AI 向导 v2（[ADR-010](../decisions/ADR-010-luosheng-v2-museum-agent.md)、[ADR-006](../decisions/ADR-006-luosheng-structured-evidence-conflict.md)）。

## 2. 影响范围

### Tier-1 签名证据卡与配置
- `content/luosheng/ding.zh-CN.json`（升级至 `releaseVersion: 6`，3D + 图版双兼容语境、补齐 ADR-006 `claim`、扩充口语与英文 `aliases`、新增 `LS-DING-POINTCLOUD` 点云观察卡）
- `content/luosheng/ding.zh-CN.sha256`
- `content/luosheng/ding.en-US.json` & `content/luosheng/ding.en-US.sha256`（新增英文完整 9 卡签名包）
- `content/luosheng/ding-profile.json`（同步卡片版本号）
- `content/luosheng/minimum-release-version.txt`（防回滚版本升至 `6`）

### 数据库迁移与单一事实源（Tier-2）
- `backend/src/main/resources/db/migration/V27__refine_museum_knowledge_copy.sql`：
  - 为 `exhibits_3d` 补齐 `title_en`、`summary_en`，为 `products` 补齐 `name_en`、`summary_en`；
  - 修正 `heluo-bronze-ding-3d` 标题为 `河洛青铜鼎 · 3D 数字重制展项`、`display_no = '01'`，更新中英展项说明；
  - 补齐 `heluo-bronze-ding` 藏品结构化字段 `dimensions` 与 `collection_location`；
  - 条件式精修 5 件概念展品正文（仅更新未改动的默认文案，不覆盖管理员人工编辑内容），压缩重复方法论、补充具象视觉锚点与跨展品串联导读；
  - 重写 3 件文创商品的策展衍生说明并回填英文名称与简介；
  - 新增第 4 篇馆务导览专题 `visit-and-digital-guide`（仅在不存在时插入，含完整中英标题/摘要/正文）。
- `backend/src/main/resources/content/seed-editorial-copy.json` & `backend/src/main/java/com/heluo/museum/config/SeedEditorialContent.java`：将初始长文案收敛至单一 JSON 资源，供 `BootstrapDataInitializer.java` 与 `SeedContentEnglish.java` 读取，消除 Java 内联双份维护。

### 后端知识服务与降级联动
- `backend/src/main/java/com/heluo/museum/guide/GuideKnowledgeService.java`：支持按 `locale`（`zh-CN` / `en-US`）加载并校验对应签名证据包，读取 `exhibits_3d` 与 `products` 英文字段，改进中文词元检索匹配。
- `backend/src/main/java/com/heluo/museum/guide/GuidePromptBuilder.java` & `GuideDeterministicFallback.java` & `GuideExhibitController.java`：英文模式直出英文证据卡与商品/展项英文信息，清理失效关键词 `"书签"`。
- `frontend/src/components/LuoshengPreset.vue`：静态图版请求按当前 `locale` 透传给 `/api/v1/guide/exhibits/{slug}`，同步兼容中英签名证据卡。

## 3. 验收标准

1. `ding.zh-CN.json` 与 `ding.en-US.json` 均通过 SHA-256 与防回滚（`releaseVersion >= 6`）校验，共 9 张已发布卡片，4 张核心事实卡具备 ADR-006 `claim` 字段且无冲突。
2. 英文模式下 `GuideExhibitController`、`GuidePromptBuilder` 与 `GuideDeterministicFallback` 均输出英文证据卡、英文展项及英文商品信息，无中英混杂。
3. `V27` 迁移对已有编辑内容（如 `BilingualMigrationTests` 中的 `'保留正文'`）严格无损，对新库与旧库均幂等安全。
4. 后端 `mvn test` 全绿（含新增双语证据卡、ADR-006 生产包校验、V27 迁移与文案质量测试），前端 `vue-tsc -b`、`vitest run`、`vite build` 全绿。

## 4. 风险与回滚

- **风险**：修改 `ding.zh-CN.json` 必须同步重算 `.sha256` 并提升 `minimum-release-version.txt`，否则证据读取器会 fail-closed；`V27` 必须使用条件更新防止覆盖线上人工编辑。
- **验证策略**：先跑定向后端测试，再跑全量 `mvn test` 与前端类型检查、单测和构建。

## 5. 验证结果

- **后端全量测试（`mvn test`）**：`92 / 92` 全部通过（0 失败、0 错误），覆盖 V27 迁移对旧数据无损兼容、`ding.zh-CN.json` / `ding.en-US.json` 9 张签名卡 SHA-256 + 防回滚 + 4 张 ADR-006 `claim` 校验、英文 `/api/v1/guide/exhibits/heluo-bronze-ding-3d?locale=en-US` 接口与 4 篇专题入库校验。
- **前端类型检查与构建（`npm run typecheck && npm run build`）**：`vue-tsc -b` 0 错误、`vite build` 与包体/配乐预算门禁全绿（首屏 JS gzip `76,090 B` / 预算 `81,638 B`）。
- **前端单元测试**：初验 447/448；失败来自同一工作区的材质改动新增了硬编码颜色，并非既有失败。审查修补后 450/450 通过，详见[回归记录](2026-11-23-review-repairs.md)。

