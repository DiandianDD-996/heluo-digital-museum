# 全站优化验收与答辩演示

日期：2026-09-08。对应实施计划：`docs/plans/2026-09-08-sitewide-quality-optimization.md`。本地工作树未提交，线上版本不能视为本地版本。

## 三分钟演示路径

提前在两个浏览器上下文分别登录隔离测试用户和隔离管理员，准备可预约时段、有库存商品及草稿文章。管理员密码只从本地忽略的环境文件读取，不写入演示稿或截图。

| 时间 | 操作 | 说明与证据 |
|---|---|---|
| 0:00–0:30 | 首页进入馆藏，搜索并翻页，打开详情后返回 | URL 保留查询与页码，来源和概念展品说明可查 |
| 0:30–1:00 | 展厅进入青铜鼎，旋转、点云、返回实体 | 可展示完整主体、加载反馈和失败后的封面/重试 |
| 1:00–1:40 | 选择日期、人数与联系人，提交预约；管理员确认；用户查看 | 预约状态由服务端控制；相同提交可恢复，账号之间隔离 |
| 1:40–2:20 | 加购、改量、查看摘要、下单、模拟支付、查看历史订单 | 改量中结算禁用；模拟支付不产生真实资金交易 |
| 2:20–2:50 | 管理员发布预先准备的草稿，公开搜索后撤回 | 未保存提示、具名确认、发布状态及权限由后端校验 |
| 2:50–3:00 | 打开 ready 和验收记录 | 展示当前版本、请求编号和已验证/待验证范围 |

## 本地完整备用环境

在仓库根构建后端，再在 `frontend` 构建前端。Java 需要 17，MySQL 需要 8，Node 与 pnpm 沿用项目配置。

```powershell
mvn -B -f backend/pom.xml package
pnpm --dir frontend build
node frontend/scripts/quality-mysql-environment.mjs
```

MySQL 备用入口为 `http://127.0.0.1:4192`，数据库 13306、后端 18082；脚本使用独立数据目录、随机凭据和构建副本，保留现有 MySQL80 服务与现有数据库。环境详情保存在 `artifacts/sitewide-quality/mysql-environment.json`，禁止共享。端口占用会报错，应检查对应环境后定点处理；4190 属于浏览器保留端口，不用于 Web 入口。

```powershell
$env:HELUO_QUALITY_ENV_FILE = '../artifacts/sitewide-quality/mysql-environment.json'
pnpm --dir frontend exec playwright test --workers=1
node frontend/scripts/quality-mysql-environment.mjs --stop
```

轻量 H2 备用入口为 `http://127.0.0.1:4189`，通过 `node frontend/scripts/quality-environment.mjs` 启动；H2 用于隔离回归，MySQL 专属行为仍以 MySQL 结果为准。两个启动器均不自动删除测试数据，停机后目录保留。当前未配置真实 SMTP，不宣称邮件已可靠送达。

生产配置验证入口为 `http://127.0.0.1:4191`，运行 `node frontend/scripts/quality-production-environment.mjs` 启动；它将当前 dist 嵌入独立 JAR，使用本地 H2 并核对 gzip、缓存、ready、GLB Range 和未知地址。不是线上部署，也不代替 MySQL 业务回归。每次启动新建隔离数据，不会自动复用先前测试用户；演示前须按上表准备数据。环境 JSON 的历史 `ready` 字段不能证明进程仍在运行，应实际访问页面及 `/api/v1/ready`。

## 证据入口

- `artifacts/sitewide-quality/baseline-visual-summary.json` 与 `baseline-screenshots/`：改前 112 个页面状态。
- `artifacts/sitewide-quality/current-visual-summary.json` 与 `current-screenshots/`：改后相同页面矩阵；文件存在且结果完成后才能引用。
- `artifacts/sitewide-quality/controls/summary.json`：320/768/1920、CSS 200% 放大、强制颜色、键盘焦点与控件尺寸。CSS zoom 不等于原生浏览器缩放验收。
- `artifacts/sitewide-quality/three/summary.json`：实体/点云截图、画布像素、分段时间和资源循环；初次失败证据另保留，不能以最终文件掩盖修复原因。
- `artifacts/sitewide-quality/business-results.json`：H2 浏览器业务回归；`business-mysql-results.json` 为隔离 MySQL 最终 6/6 结果，保留测试当时的配置与时间，不以随后新建的环境替换历史结果。
- `artifacts/performance/mobile-summary.json`：早前六路由 Fast/Slow 4G 冷暖缓存原始指标，保留当时失败。`artifacts/sitewide-quality/performance-final-targeted.json` 与 `.md` 为 Explore/商城最终修复后复测，两路由冷暖 LCP/CLS 达标；无 INP 样本为 null。
- `artifacts/sitewide-quality/version-evidence.json`：当前工作树源码与构建指纹。`production-environment.json` 为受测生产配置入口的构建/HTTP 证据，但含私有凭据，不可公开。
- `frontend/scripts/resource-budget.json`：全站 JS/CSS gzip 基线与 5% 增长约束；图片磁盘体积与实际下载体积另行记录。

测试产物、日志、运行凭据不提交。最终数字与限制以实施计划的“验证结果”为准。

## 素材与说明

原图总台账为 `assets/images/README.md`；响应式派生台账为 `frontend/public/media/responsive/README.md`，保留原比例和颜色。概念展品和文创图不表示真实馆藏摄影、实物商品或销售库存。

青铜鼎模型来源与许可为 `assets/models/bronze-ding/README.md` 及其链接的 Cleveland Museum of Art `1962.281` CC0 来源记录。项目材质、纹样和展示环境属于派生制作，不称作官方扫描复原。移动 LOD 的历史精确生成参数仍是既有资产治理待办。

## 待人工验收

实体 iPhone Safari/Android Chrome 的软键盘、触控、安全区与辅助设置；原生 200% 浏览器放大；代表性手机 10 分钟实际渲染帧率；线上同版本业务流程；GitHub MySQL CI 首次运行。性能未达标项必须保留实测值，不能用编译通过、显示刷新率或模拟视口代替。
