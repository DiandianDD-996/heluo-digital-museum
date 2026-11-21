# 当前本地项目覆盖发布到 PocketBay heluo

## 目标与授权

用户明确要求将当前本地项目覆盖到现有 `#329 / heluo`，替换正在运行的版本。关联 F-01 至 F-14、N-01/N-02/N-03/N-05/N-06。包含当前工作树的探索、预约与鼠标精修，以及已存在的其他源码；不执行 Git 提交或推送。

## 当前事实与范围

### 2026-09-08 后续覆盖部署

在同一授权会话中重新构建当前工作树并覆盖上传原 `#329 / heluo`：deployment `6259` / release `5099`，382 个条目，包 SHA-256 `e6c4b207f56b9cd4f89ab8ee31eed046101f7da29cf40a140c2ef882f873de50`。平台已切换活动版本并返回 `running/done`，未创建副本或回滚。

发布后直接 HTTP 检查返回 204，判断为 PocketBay 应用休眠/未唤醒；需使用部署页面“唤醒并继续”后再执行线上验收。本次不把平台 deployment running 等同于应用健康通过。

- 2026-09-08 已重新读取 `https://pocketbay.com/deploy` 官方协议，受信任设备凭证存在。
- 原项目授权会话仍有效，绑定 `heluo`，当前 deployment 6025 / release 4884，平台状态 sleeping。历史按名称免配对上传曾意外创建副本，本次使用已经绑定原项目的授权会话上传；不新建项目。
- 仅批准的运行配置 `pocketbay.properties` 随包迁移，不输出内容；本地开发 MySQL 数据、测试数据、数据库备份和未批准配置不上传。
- 使用现有 Dockerfile、入口脚本与 pocketbay profile；保留原项目 `/data` H2 持久库。不修改业务源码或数据库迁移。

## 步骤与验收

1. 白名单打包仓库根前后端与实际生产资源，记录逐文件和包哈希，检查禁用项并验证解包一致。
2. 复核当前前后端测试、生产构建与体积预算；尝试本机镜像构建。此前视觉精修已完成 48 页面状态、16 交互状态和手机预约完整流程，本次线上复核实际发布结果。
3. 确认原项目与配置授权，验证源码未漂移后上传一次，持续轮询到 done/running。候选构建期间不重复上传；失败按平台 error_category/repair_hint 处理，最多三次，不擅自回滚。
4. 比较线上 HTML/关键 JS/CSS 与本地构建，验证 health/ready、公开数据、身份 401、模型 Range；浏览器走首页到探索/预约的真实导航，核对图片和鼠标交互。
5. 更新项目状态、需求追踪和本计划，检查差异并交付正式地址与版本号。

## 风险和边界

工作树包含未提交修改，版本以文件散列识别。平台休眠、iframe 包装、未知路由外层 HTTP 200、商城两项既有动效合同失败，以及实体设备与长期性能仍是已知边界。发布授权包含替换原应用，不包含线上测试预约/订单等业务写入或删除数据。

## 验证结果

- [x] 仅上传一次到原 `heluo`；deployment `6103` / release `4959` 替换 `4884`。2026-09-08 17:26:41 平台首次返回 `done/running`，17:34:39 再次核对仍为同一活动版本、无 error_category。未创建同名副本、未触发回滚。
- [x] 发布包 380 个条目、19,705,895 bytes，SHA-256 `30a40be708f62482f3ad6250ea82842be624104e2c1e46f839f9fac401facdd8`。禁用项为 0，解包逐文件一致；上传前全部包内文件与工作树散列一致。只迁移之前批准的 `pocketbay.properties`，继续使用原 `/data`，没有上传本地数据库或 dump。
- [x] 重新运行前端 58 文件 / 317 项单测、包含类型编译的生产构建、资源预算与交互体积预算，全部通过。交互 JS 17,414 bytes / gzip 6,536 bytes；后端 Maven 9 类 / 42 项测试通过，无失败、错误或跳过，Flyway 23 版迁移正常。
- [ ] 本机 `docker info` 长时间无响应，已中止该探测，未执行本机镜像构建。平台镜像构建、容器启动、健康检查和版本切换成功；本轮没有修改 Dockerfile、入口或业务源码。
- [x] 发布后平台再次休眠，初次 HTTP 检查收到 204；通过官方“唤醒并继续”按钮恢复。首次浏览器点击因等待导航完成超时，平台已经恢复 running；改为独立等待应用 frame 就绪后，最终线上验证完成，未重传发布包。
- [x] 最终线上 HTTP 30/30 通过：七个主要路由、health/ready 200/UP、六类公开数据、匿名身份 401/no-store、13 个关键 JS/CSS 的 immutable 缓存和散列匹配、移动 GLB Range 206。线上 HTML、探索/预约/点阵/3D 外层模块及入口资源与本次本地 dist 一致。
- [x] 真正的线上应用 iframe 在 1440px/390px、浅/深主题下，两页共 8/8 状态通过，无页面异常或横向溢出；所有被检图片滚动加载并解码完成。桌面标题 36px、手机 28px，均为新 `heading` 点阵呈现。
- [x] 从首页通过站内导航进入探索和预约，分类得到两件青铜器物，搜索“青铜”有结果，日期/时段可选，手机联系人抽屉可填写和关闭。桌面单光标、点阵像素非空且随移动变化、输入框原生光标正确；触屏无装饰 Canvas。没有提交线上预约、订单或其他业务数据。
- [x] 已查看实际线上桌面探索与手机深色预约截图；平台顶部横条和反馈浮层仍存在，手机反馈浮层可能覆盖局部内容，不将本地无平台外壳的截图冒充线上效果。
- [ ] PocketBay 仍将未知公开路由的外层 HTTP 状态转换为 200；iframe 内路由未同步外层地址栏。实体手机、真实慢网、长期 FPS、3D 实体/点云实际操作和线上业务写流程未在本发布轮重新验收；商城两项既有动效合同问题未包含修复。
- [x] 项目状态、需求追踪与本计划已同步；未执行 Git commit/push/reset 或删除数据。

## 修改文件和证据

本发布轮不增加业务源码改动，完整当前源码已入包；仅更新以下跟踪文档：

```text
C:/Users/Jie/Documents/博物馆/docs/plans/2026-09-08-pocketbay-visual-release.md
C:/Users/Jie/Documents/博物馆/PROJECT_STATUS.md
C:/Users/Jie/Documents/博物馆/docs/01-requirements-traceability.md
```

打包、上传及验证工具与运行产物都位于忽略目录 `C:/Users/Jie/Documents/博物馆/artifacts/pocketbay-visual-release/`：

- `package-evidence.json`：白名单、逐文件及发布包散列、干净解包路径。
- `before-evidence.json`、`upload-evidence.json`、`status-evidence.json`：脱敏发布前状态、上传回执和最新版本状态。
- `http-evidence.json`：最终 30 项线上 HTTP 结果及未知路由限制。
- `browser-evidence.json`：8 组真实 iframe 尺寸、主题、点阵像素和运行结果。
- `explore-1440-light.png` 等两页八组截图，及 `appointment-sheet-light.png` / `appointment-sheet-dark.png`。

正式入口：`https://heluo.pocketbay.app/`；重点页面 `/explore`、`/appointment`。如平台再次休眠，使用页面的“唤醒并继续”按钮进入。下一步为用户实体设备上的视觉和鼠标手感复核。
