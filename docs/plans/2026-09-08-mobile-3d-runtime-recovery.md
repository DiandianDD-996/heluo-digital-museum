# 移动端互动 3D 运行时加载与重试修复

## 目标与关联需求

修复手机端出现“互动 3D 运行时暂时无法加载”后点击“重试启动”无法恢复的问题。关联 `F-05/N-03/N-06`。保留移动端手动进入、轻量模型、展项说明、相机与点云交互。

## 现象与初步证据

- 用户截图的文字只由 `ExhibitDetailView.vue` 的异步组件加载错误分支产生；此时尚未进入 `ThreeExhibitViewer.vue` 内部的模型加载或 WebGL 初始化错误分支。
- 当前错误处理保留 Vue 的 `retry` 回调，再次点击时导入相同模块 URL；需通过生产构建的浏览器故障注入确认浏览器是否缓存失败结果。
- 线上入口为 `https://heluo.pocketbay.app/`。检查时公开 health 为 `200/UP`；线上和本地已有构建不同，须区分各自验证结果。
- 用户确认设备为 vivo X100 Ultra，使用 vivo 官方浏览器访问上述入口；内核版本未知。浏览器模拟视口不能代替实体设备验收。
- 已复现生产构建首次组件脚本请求返回 503 后，点击原“重试启动”仍停在错误状态，网络请求总数保持 1；浏览器缓存了本次文档的失败模块加载结果。
- 桌面回归发现导览 dock 遮挡失败海报的重试按钮，需同时为桌面失败面板预留 dock 空间。

## 影响范围

- `frontend/src/views/ExhibitDetailView.vue`：运行时加载、失败状态与重试恢复。
- `frontend/src/assets/route-exhibit-detail-legacy.css`：桌面失败面板避开底部导览控件。
- 必要的前端恢复辅助函数及对应测试；生产浏览器回归脚本。
- `PROJECT_STATUS.md`、`docs/01-requirements-traceability.md` 和本计划。
- 仅在证据确认需要时调整浏览器兼容配置。现有工作树含大量用户修改，本次基于当前内容增量修改。

## 实施步骤

1. 在当前生产构建中模拟组件脚本首次失败和重新请求，记录状态与网络请求次数。
2. 根据复现结果实现可恢复的重试；处理失败模块缓存、离线反馈、重试状态与离开展项后的恢复边界。
3. 添加覆盖真实失败与恢复路径的测试，运行前端类型检查、单测和生产构建。
4. 从首页或展厅入口进入展项，在移动与桌面视口检查故障恢复、非空画布、旋转/缩放/视角与信息入口。
5. 更新状态、需求追踪和验证证据，审查任务 diff。发布与真机结果单独记录。

## 验收标准

- 脚本请求失败后有可读状态；重试能真正重新加载资源，恢复后进入互动 3D。
- 离线或持续失败不会自动无限刷新；按钮可操作，展项信息仍可访问。
- 重试恢复保留当前展项路径，移动端恢复后能继续启动轻量模型。
- 类型检查、前端单测、生产构建通过；浏览器移动/桌面画布有内容、关键操作生效，无页面级横向溢出。
- 不将模拟设备结果记为用户手机修复验收，不将本地修复记为线上发布。

## 风险与验证结果

- 动态导入错误可能来自短时断网、部署后旧模块地址或浏览器兼容性；未取得手机控制台前不宣称唯一根因。
- PocketBay 使用 iframe 包装应用，恢复行为须以应用 frame 的实际路径为准。
- 3D 脚本加载失败时清理模型预加载提示；重试刷新当前 frame 的文档，清除浏览器失败模块缓存。仅对当前路径保存两分钟有效的一次性恢复标记，读取即清除；刷新后自动继续启动移动轻量模型。
- 离线重试保留当前页面并提示恢复连接，展项信息面板仍可访问。禁止 sessionStorage 的浏览器仍会刷新，刷新后需再点一次“进入互动 3D”。持续失败不会自行循环刷新。
- 桌面失败海报为重叠导览 dock 预留空间，真实浏览器点击无需 `force`。

### 本地验证

- 相关 Vitest 首轮 `3` 文件 / `31` 项通过，工作树类型检查通过。
- 工作树全量验证期间发现另一个任务正在重写 Explore：`ExploreView.vue` 引用了尚未创建的 `explore-gallery.css`，导致构建失败、全量测试出现 1 个导入失败和 7 个旧样式合同失败。本任务未修改或回退 Explore。
- 校验 release `4850` 已发布包全部 `375` 个源码文件散列后，在 `artifacts/mobile-3d-runtime/release-4850-patch/` 创建隔离副本，仅叠加本次两个运行时文件、CSS 与两个测试文件。测试使用现有依赖，pnpm 自动安装检查在 junction 环境下中止后，改为直接运行已安装工具，未重装或删除依赖。
- 隔离副本类型编译 `vue-tsc -b`、最终全量 Vitest `58` 文件 / `319` 项、Vite 生产构建与 gzip 预算通过。初次隔离测试因发布包未携带 `performance-audit.mjs` 失败，补齐已有测试辅助脚本后全量通过。
- 最终构建 JS gzip `509,716 B`、CSS gzip `116,145 B`，均在既有 5% 增长预算内；初始 CSS gzip `47,224 B`。保留既有第三方 pure 注释及 Three.js 大 chunk 构建警告。
- Preview `http://127.0.0.1:4193/` 使用隔离构建，代理现有本地生产验证 API。3D 深层路由 HTTP `200`，health `200/UP`；隐藏进程启动被工具策略拒绝后使用前台终端方式启动成功。
- `node scripts/three-runtime-recovery-audit.mjs` 最终 `4/4` 通过：390px 深色 iframe、1440px 浅色、390px 持续 404 + 离线、390px iframe 禁止存储。短时 503 后脚本请求数由 `1` 增至 `2`，恢复为单一 Canvas，实体/点云像素非空，旋转改变像素，缩放/重置/俯视与信息面板正常；所有场景无页面异常或横向溢出。
- 初次浏览器脚本的 iframe 就绪等待和关闭按钮严格定位已纠正；桌面真实点击发现的 dock 遮挡已修复后重跑全部场景。
- 本机没有可用的 Android CDP 连接；实体 vivo X100 Ultra / vivo 浏览器、真实蜂窝网络、长期 FPS 未验收。本轮没有后端逻辑改动，未重复后端测试、业务写流程和 Docker 构建。

### 发布与线上验收

- 候选包 `artifacts/mobile-3d-runtime/heluo-3d-runtime-recovery-20260908.zip` 包含 `377` 个条目、`19,700,210 B`，SHA-256 `a4995cd0be989b9cf260e6d6a06c8499e6969462691e01edd2bd7394603af631`；逐文件解包校验通过，只叠加本次五个源码/测试文件。
- 用户明确确认“发布到现有 heluo”后完成覆盖发布：原项目 `#329 / heluo` 的 deployment `6025` / release `4884` 替换 `4850`，平台返回 `done/running`，继续使用原 `/data` 数据卷。未发布其他任务正在修改的 Explore/预约页面。
- 首次按官方免配对接口 `POST /api/ai/deploy` 指定 `name=heluo` 上传时，平台意外新建 `heluo-ktji` 副本。随后核对已有且已批准的原项目 session，通过 `POST /api/deploy/sessions/upload` 将同一包正确发布到 `heluo`。副本删除已单独询问，尚未获得明确答复，未执行删除。
- 发布后平台多次进入 `sleeping`，公开接口返回 `204`；浏览器唤醒入口曾出现 `ERR_BLOCKED_BY_CLIENT`，一次 Node 请求连接超时。随后站点恢复，`2026-09-08 15:18` 的线上核验 `14/14` 通过：health/ready `200/UP`，展项 API 正常，首页/展厅/3D HTML 及入口、展项、Three.js 脚本和 CSS 与隔离 dist 的 SHA-256 一致，移动 GLB 返回 `206 bytes 0-1023/837720`。HTML revalidate 与哈希资源 immutable 缓存正确。
- Chrome 实际从首页进入数字展厅，再进入青铜鼎展项，实体模型正常显示，点击俯视后视角和画面改变；截图保存为 `online-solid.png`、`online-top.png`。当前线上浏览器点云按钮禁用，未将该项标为线上通过；本地恢复场景中的实体与点云验证结果仍单独保留。
- 发布后核对本任务五个源码/测试文件散列，均与已上传包一致。平台自动休眠、vivo 官方浏览器真机、真实蜂窝网络及长期 FPS 仍是验收边界；手机首次复验应关闭旧标签页，重新打开原链接进入数字展厅。
- 未执行 Git commit/push/reset；本地结果不替代用户手机复验。

### 证据与修改文件

证据目录：`C:/Users/Jie/Documents/博物馆/artifacts/mobile-3d-runtime/`。包括 `before-retry.json`、`recovery-results.json`、各场景页面/画布截图、`package-evidence.json`、`online-before.json`、`release-status.json`、`online-http.json`、`online-solid.png` 与 `online-top.png`。私有授权和上传响应仅留在被忽略的证据目录，不输出或提交。

- `C:/Users/Jie/Documents/博物馆/frontend/src/views/ExhibitDetailView.vue`
- `C:/Users/Jie/Documents/博物馆/frontend/src/lib/exhibitRuntimeRecovery.ts`
- `C:/Users/Jie/Documents/博物馆/frontend/src/assets/route-exhibit-detail-legacy.css`
- `C:/Users/Jie/Documents/博物馆/frontend/src/views/ExhibitDetailView.spec.ts`
- `C:/Users/Jie/Documents/博物馆/frontend/src/lib/exhibitRuntimeRecovery.spec.ts`
- `C:/Users/Jie/Documents/博物馆/frontend/scripts/three-runtime-recovery-audit.mjs`
- `C:/Users/Jie/Documents/博物馆/PROJECT_STATUS.md`
- `C:/Users/Jie/Documents/博物馆/docs/01-requirements-traceability.md`
- `C:/Users/Jie/Documents/博物馆/docs/plans/2026-09-08-mobile-3d-runtime-recovery.md`
