# 开源测试工具落地

## 目标与范围

按用户确认的建议，优先完成 Playwright 真实业务回归与 Lighthouse 页面报告，并补充 k6 公开接口轻量负载测试。关联 F-01/F-04/F-06/F-07/F-08/F-09/F-10/F-11 与 N-04/N-05。ZAP、Testcontainers 为后续增强，不以本轮结果替代安全审计和容器集成验收。

## 实施步骤

1. 核对现有业务用例、构建当前源码，启动全新本地 MySQL 隔离环境。
2. 补充正常购物车结算、模拟支付、个人中心订单和库存一致性断言；运行全部业务及预约展示测试。
3. 增加可复用的 Lighthouse 报告脚本，检查首页、探索、商城和预约页面。
4. 增加 k6 公开读接口脚本，在隔离环境渐增小规模负载，记录延迟、错误率与范围。
5. 更新测试说明、项目状态及需求追踪；检查任务差异，不提交或推送。

## 影响文件与风险

影响 frontend/e2e/business.e2e.ts、frontend/package.json、新增测试脚本及测试文档。保留已有未提交更改。报告与工具缓存写入忽略目录 artifacts；不写入公网业务数据。测试工具不进入生产依赖。Lighthouse 为本机实验室数据，k6 小负载不能推断生产最大容量。

## 验收标准

- 当前前端类型检查、单测、生产构建以及后端测试/打包通过。
- 隔离 MySQL 的真实浏览器业务回归通过，失败必须记录并定位。
- Lighthouse HTML/JSON 报告真实生成，记录分数及未达标问题。
- k6 结果包含请求量、错误率和延迟；不降低阈值掩盖失败。

## 验证结果

- 后端 Maven 测试/打包：42/42，BUILD SUCCESS；前端类型检查、生产构建和资源预算通过。
- 前端 Vitest：316/317，通过 58 个文件中的 57 个；`darkThemeCohesion.spec.ts:78` 仍期待 `--dark-reference-canvas: oklch(8% .005 78)`，当前样式最终定义为 `oklch(11% .008 78)`。保留现有主题改动及失败断言，本轮不决定视觉方案。JSON：`artifacts/sitewide-quality/unit-open-source-testing.json`。
- Playwright E2E 类型检查通过；隔离原生 MySQL 8.0 的完整浏览器回归最终 10/10 通过，耗时 25.2 秒。新增正常支付用例验证金额 19.50、单件库存减少一次、锁定库存恢复、重复支付不重复扣减、购物车清空、唯一订单及刷新后个人中心记录。原有预约、后台发布撤回、越权、分页与响应丢失恢复全部通过。
- 新用例初次使用了不存在的 `/admin/products/{id}` 和 `GET /cart/items`，改用已有后台商品列表和 `GET /cart`，未增加生产 API。
- Lighthouse 首轮桌面标记实际仍为手机配置，已改为官方 `desktop-config.js` 并增加实际 `formFactor` 断言；首轮 `lighthouse-1788878454975` 不作为最终结果。最终轮与 E2E、k6 顺序运行。
- k6 首轮搜索误用 `q` 导致 400，已按后端合同修正为 `keyword`；增加所有路径的预检。原失败证据保留在 `artifacts/open-source-testing/k6-1788878638105`，不作为最终承载结果。
- k6 最终通过：60 秒渐增至 10 VU，308 轮、1,237 请求（含 5 次预检），错误率 0%，2,464/2,464 业务检查通过，P95 2.507ms、最大 7.042ms。结果：`artifacts/open-source-testing/k6-1788878755637/summary.json` 与 `run.log`。这是本机原生 MySQL、小数据、公开读接口结果，不是公网容量或写入并发结论。
- Lighthouse 最终 8/8 HTML/JSON 报告完成，实际设备参数校验手机 4/桌面 4。结果：`artifacts/open-source-testing/lighthouse-1788878889856/summary.json`。中途 Windows 临时配置目录清理 EPERM，已改为保留每页独立配置目录，最终采样无运行错误。

| 页面 | 手机性能 | 桌面性能 | 手机 LCP | 手机无障碍 |
|---|---:|---:|---:|---:|
| 首页 | 97 | 100 | 2334ms | 95 |
| 探索 | 97 | 100 | 2496ms | 100 |
| 预约 | 97 | 100 | 2452ms | 100 |
| 商城 | 92 | 100 | 3123ms | 96 |

全部最佳实践 100，SEO 92；最终 CLS 均 < 0.006。桌面无障碍：首页 95，其余 100。仅检测默认主题、未登录公开页面，单轮实验室数据，不代表双主题/公网/真机全部通过。

## 发现与下一步

1. 前端主题合同 1 项失败：需结合正在进行的深色主题工作确认最终令牌后同步测试，不能靠改色或删除断言掩盖结果。
2. 首页 `.corridor-home__next p` 对比度约 3.63:1；手机商城 `.product-meta small` 对比度约 3.74:1，低于小字 4.5:1 要求。应定向调整文字色并在双主题复验。
3. 手机商城 LCP 约 3.12 秒，需优化商品图传输和阻塞样式。该数字低于历史 4 秒目标，但仍高于 2.5 秒的良好体验参考线。
4. 本地 preview `/robots.txt` 返回 SPA HTML，Lighthouse 判为无效 robots；需要补充静态 robots 并单独核验正式部署响应，不能据此断言线上同样有问题。
5. ZAP、Testcontainers、Docker Compose 拓扑压测、GitHub CI、真机 3D 长期性能与真实用户 INP 均未执行，作为后续阶段。无线上写入、部署、Git commit/push。

## 收尾

脚本语法、E2E TypeScript 和本轮文件空白检查通过。测试结束停止本轮独立 MySQL/API/preview，保留数据和全部报告；原有开发服务不属于本轮停止范围。

## 2026-09-08 修复结果

针对 Lighthouse 发现完成了小字对比度、商城首屏图片优先级和 robots 路由修复。首页/商城浅色文字改为满足小字对比度的深色青铜色；首件商品图使用 `loading="eager"` 与 `fetchpriority="high"`；新增静态 robots/sitemap 与 Nginx 精确路由。Vitest 现为 317/317，类型检查和生产构建通过。待重新启动隔离预览后复跑 Lighthouse，确认指标改善。

## 修改文件

- `C:/Users/Jie/Documents/博物馆/frontend/e2e/business.e2e.ts`
- `C:/Users/Jie/Documents/博物馆/frontend/package.json`
- `C:/Users/Jie/Documents/博物馆/frontend/scripts/lighthouse-audit.mjs`
- `C:/Users/Jie/Documents/博物馆/frontend/scripts/public-load.k6.js`
- `C:/Users/Jie/Documents/博物馆/frontend/scripts/load-audit.mjs`
- `C:/Users/Jie/Documents/博物馆/docs/testing-open-source.md`
- `C:/Users/Jie/Documents/博物馆/docs/06-test-plan.md`
- `C:/Users/Jie/Documents/博物馆/docs/plans/2026-09-08-open-source-testing.md`
- `C:/Users/Jie/Documents/博物馆/PROJECT_STATUS.md`
- `C:/Users/Jie/Documents/博物馆/docs/01-requirements-traceability.md`

所有文件均只追加或修改本轮内容，工作树已有其他任务改动保留。
