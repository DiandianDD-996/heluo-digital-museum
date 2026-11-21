# 开源测试工具使用说明

## 本轮工具

| 工具 | 作用 | 本项目使用方式 |
|---|---|---|
| Playwright | 浏览器业务回归 | 复用现有依赖，连接独立 MySQL 与生产构建 |
| Vitest | 前端单元测试 | `pnpm test`，与业务 E2E 分开报告 |
| Lighthouse 13.4.1 | 页面性能、无障碍、最佳实践、SEO | 本地工具目录安装，输出 HTML 和 JSON |
| k6 2.2.0 | 公开读接口负载 | 本地官方可执行文件或 PATH 上的 k6 |

Lighthouse 与 k6 不进入应用依赖或生产包；报告、工具和临时凭据均在 Git 忽略的 `artifacts/` 下。免费使用本地开源版本，无需付费云服务。

## 启动隔离环境

以下为 Windows PowerShell 命令，从仓库根执行。需 Node >= 22.19、Java 17、Maven、pnpm、Chrome；本地 MySQL 的 `mysql.exe` 和 `mysqld.exe` 必须在 PATH，JAVA_HOME 指向 Java 17。

```powershell
mvn -B -f backend/pom.xml package
corepack pnpm --dir frontend typecheck
corepack pnpm --dir frontend test
corepack pnpm --dir frontend build
corepack pnpm --dir frontend qa:mysql:start
```

每条命令检查退出状态再继续。启动脚本使用 13306/18082/4192 三个端口；占用时拒绝启动，不能任意结束已有进程。每次新建物理数据目录和随机账户，Flyway 执行当前迁移，SMTP 不配置外部服务。生成的 `artifacts/sitewide-quality/mysql-environment.json` 含临时凭据，不分享或提交该文件。

## 浏览器回归

```powershell
$env:HELUO_QUALITY_ENV_FILE = (Resolve-Path artifacts/sitewide-quality/mysql-environment.json).Path
corepack pnpm --dir frontend test:e2e:types
corepack pnpm --dir frontend test:e2e
```

覆盖预约登录续填、管理员确认、丢失响应后幂等恢复、手机抽屉及主题语言布局；正常模拟支付、重复支付库存、购物车改量竞态、个人中心刷新；后台草稿发布撤回、用户越权以及列表分页。实际使用本地浏览器和真实 API；创建临时数据只发生在隔离库，商品/文章验收后下架/撤回，不删除历史记录。

结果：`artifacts/sitewide-quality/business-mysql-results.json`；失败截图：同名目录。

## Lighthouse

首次安装工具，固定版本：

```powershell
npm install --prefix artifacts/testing-tools --no-package-lock --no-audit --no-fund lighthouse@13.4.1
corepack pnpm --dir frontend qa:lighthouse
```

顺序检测首页、探索、预约、商城各手机与桌面模式，使用新的 Chrome 上下文和官方桌面配置；保存实际屏幕与网络模拟参数。报告位于 `artifacts/open-source-testing/lighthouse-<时间戳>/`，每页 HTML/JSON 与整组 `summary.json`。命令成功表示报告生成成功，不表示所有分数满分。报告包含低分审计条目，可在 HTML 展开定位元素。为避免 Windows 临时目录 EPERM，每个页面的浏览器配置保留在该报告目录的 `profiles/`，分享报告时只选 HTML/JSON。

性能采样期间不要同时跑构建、浏览器 E2E 或压力测试。结果为本机生产构建的实验室样本，不代表公网 CDN、容器部署、真实用户 INP 或 3D 长期帧率。默认页面主题及未登录公开页面状态，不覆盖全部双主题与登录后页面。

## k6

从 [Grafana k6 官方 Release](https://github.com/grafana/k6/releases/tag/v2.2.0) 下载 Windows amd64 ZIP，对照该 Release 的 checksums 文件验证 SHA-256，再解压。当前机器已放在 `artifacts/testing-tools/k6-v2.2.0/`；其他机器也可安装官方 k6 到 PATH。

```powershell
corepack pnpm --dir frontend qa:load
# 可选：显式传入可执行文件路径
corepack pnpm --dir frontend qa:load 'C:\tools\k6.exe'
```

脚本顺序访问分类、可预约时段、商品列表和搜索，不包含登录或业务写请求。60 秒内按 1/5/10 虚拟用户逐步增加再降到零；每轮 4 次请求后等待 1 秒，不跟随重定向。仅接受本地隔离环境 URL。

阈值沿用 N-04 的延迟要求：P95 < 500ms、最大耗时 < 1500ms，错误率 < 1%、业务检查通过率 >= 99%。`summary.json` 和 `run.log` 写入 `artifacts/open-source-testing/k6-<时间戳>/`，阈值失败会返回非零退出码。当前原生 MySQL + Vite preview 的测试拓扑与 N-04 原定义的 Docker Compose 不同，因此本轮仅作为补充证据，不宣称重新完成 Docker 容量验收。

## 停止与后续

```powershell
corepack pnpm --dir frontend qa:mysql:stop
```

停止前核对进程命令行归属，只停止该隔离环境，保留数据和报告。ZAP 安全扫描、Testcontainers 容器集成、GitHub CI 和真机 3D 长期性能属于后续阶段；现有真实 MySQL E2E 不等价于这些检查。
