# PocketBay 移动端修复覆盖发布 release 634

## 1. 目标

将 release `530` 之后完成的移动端修复覆盖发布到现有 PocketBay 项目 `#329 / heluo`，重点解决实体手机截图中 `/explore` 河线主圆与罗盘中心随宽度漂移的问题，同时带上同一工作树中的预约日期/步骤、商城标题区和 3D 五视角适配。

## 2. 关联需求

- `F-01`、`F-02`、`F-05`、`F-06`、`F-09`、`F-12`、`F-14`。
- `N-03`、`N-05`、`N-06`。

## 3. 影响范围

- 部署输入：当前工作树的根级 `Dockerfile`、`.dockerignore`、`docker-entrypoint.sh`、`frontend/`、`backend/` 和经配对页批准的 `pocketbay.properties`。
- 平台目标：仅更新现有项目 `#329 / heluo`，不创建新项目，不迁移本机 MySQL，不执行数据删除或回滚。
- 代码范围、风险与组件验收分别见本任务关联的 Explore、预约、商城和 3D 计划。

## 4. 实施与验证

- 白名单包包含 `311` 个条目、`17,478,924 B`，SHA-256 为 `97b60815208741e872a42af3c507bf42251b23645cd0f226ec42ffd99a710835`；禁用项和缺失必需文件均为 `0`，保留 `23` 个运行必需的 Flyway 版本化迁移。
- 从压缩包解出的全新目录使用传统 Docker builder 构建成功，镜像 ID 为 `ac9ef45ff741`。
- 配对页明确命中现有 `heluo.pocketbay.app`，授权结果为 `project_slug=heluo`，唯一获批配置路径为 `pocketbay.properties`；配置内容未输出到日志或文档。
- PocketBay deployment `1129` / release `634` 返回 `next_action=done`、`project_status=running`，并成为活动版本，替换 release `530`。
- `/`、`/explore`、`/appointment`、`/shop`、3D 深层路由和 `/login` 均为 HTTP `200`，health 为 `UP`；HTML 为 `no-cache, must-revalidate`，哈希资源为 immutable，移动 GLB Range 为 `206 bytes 0-1023/837720`。
- 线上 `/explore` 在 320/375/390/414/430px 下，河线与罗盘视觉锚点偏差均低于 `0.02px`，标签重叠和页面横向溢出均为 `0`。罗盘素材使用既有 `translateY(-48.85%)` 视觉校准，因此 DOM 外接框几何中心固定低约 `1.32px`，不属于随视口变化的错位。
- 线上页面映射审计 `32/32` 通过。预约 320/390/430px 均完整显示前四张 `108px` 日期卡、第五张初始可见宽度为 `0`、步骤无裁切；商城四分类无裁切；3D 视角轨道在 430px 为 `363/363px` 且五项完整，390px 以下继续可横向访问。

## 5. 未验证项

- 用户提供的实体手机截图用于确认旧 release 问题；release `634` 尚未由用户在同一台实体手机上刷新复验。
- 本轮未重复真实预约提交、购物车结算、后台 CRUD、真实 SMTP、系统强制颜色、三运营商和中低端 GPU 长时间运行。
- 未执行 Git commit、push、reset 或工作树清理。
