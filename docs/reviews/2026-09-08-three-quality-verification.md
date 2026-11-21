# 3D 展项质量验证记录

## 结论

2026-09-08 在隔离本地环境完成 390px、1440px 双主题的 4 组真实浏览器验收，以及同一页面会话内连续 20 次展项进入、退出。最终脚本退出码为 0，报告 `errors=[]`；4 组页面均无 `pageerror`。

本轮实际复现并修复两项阻断：模型加载失败后的重试按钮被导览区遮挡，以及多次离开展项后 WebGL 上下文累积。最终普通点击恢复成功，20 次循环的展项画布、监听器和渲染提交均正常停止，WebGL 上下文数量超限警告由 7 条降为 0 条。

采样阶段未观察到达到 50ms 的单次长任务，首次点云反馈的下一绘制机会为 2.6–4.4ms。首次点云的实际 `render` 调用仍出现约 450ms 阻塞，需要保留为性能风险。真机、实际后台标签页与 10 分钟持续运行尚未验收，不能据此宣布全部 3D 性能目标完成。

## 版本与环境

| 项目 | 本次记录 |
| --- | --- |
| 验证开始时间 | 2026-09-08 11:26:11，上海时区 |
| 页面 | `http://127.0.0.1:4189/exhibits/heluo-bronze-ding-3d` |
| 源码基准 HEAD | `d222c2269da68bc18ca863aaaff71fbfd8cefab3`，包含本轮尚未提交的工作区修改 |
| 已验证 3D 构建文件 | `frontend/dist/assets/ThreeExhibitViewer-BUwC1qQU.js` |
| 构建文件 SHA-256 | `1CF6B4987F0C989CCABB1573F45531E99923438AD5D8624DC47C060303310B17` |
| 浏览器 | Headless Chrome 152.0.0.0，Playwright 1.63.0 |
| GPU | NVIDIA GeForce RTX 4060 Laptop GPU，经 ANGLE / Direct3D 11 |
| 浏览器能力报告 | 32 个逻辑处理器；`navigator.deviceMemory=16`；DPR=1 |
| 视口 | 390×844，启用移动视口与触控模拟；1440×900，桌面模式 |
| 主题与语言 | 浅色、深色；本脚本交互语言为中文 |
| 网络与 CPU | 本机资源，无网络或 CPU 限速 |

源码 HEAD 只表示工作区的提交基准；本轮的构建文件散列用于核对实际受测的 3D 模块。构建产物与截图位于忽略目录，不应随源码提交。

## 测量方法与结果

脚本通过组件已有的真实渲染提交计数取样：计数发生在 `renderer.render()` 或 `composer.render()` 返回之后。稳定阶段取样约 1.5 秒，记录提交数量和实际经过时间。该结果不测量 GPU 完成时间或显示器实际呈现的帧数。

首次点云反馈从用户点击事件开始，记录按钮 `aria-busy` 更新与随后一次绘制机会。采样与 `compileAsync` 分别记录起止时间，两段之间主动让出主线程。`PerformanceObserver` 记录长任务并按时间区间归类；采样总耗时包含分批之间的让出时间。

| 视口 / 主题 | busy 更新 ms | 下一绘制机会 ms | 分批采样总耗时 ms | compileAsync 阶段 ms | 点云阶段 render 调用峰值 ms | 稳定提交次数/秒 | 采样阶段长任务数 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 390 / 浅色 | 0.9 | 3.5 | 576.6 | 17.6 | 457.3 | 274.9 | 0 |
| 390 / 深色 | 0.6 | 2.6 | 556.9 | 11.0 | 25.0 | 274.8 | 0 |
| 1440 / 浅色 | 1.1 | 4.4 | 1443.3 | 17.4 | 449.6 | 275.1 | 0 |
| 1440 / 深色 | 0.9 | 4.1 | 1432.8 | 11.7 | 22.3 | 274.9 | 0 |

4 组在同一浏览器内依次执行，顺序是移动浅色、移动深色、桌面浅色、桌面深色。首次执行每种画质路径时，实际渲染调用分别对应 458ms、451ms 的长任务；后续路径没有观察到相同长任务。本轮没有执行缓存隔离的对照实验，不把这种差异归因于主题颜色，也不把 `compileAsync` 阶段耗时称作 GPU 编译耗时。

这明确缩小了后续排查范围：已观察到的长任务发生在实际 `render` 调用中，未与采样区间重叠。首次渲染阻塞仍可能影响其他同时发生的操作，关键交互延迟目标不能据此标为达标；INP 未测。

### 画面与像素

每组分别保存实体、旋转后和点云模式的画布截图与完整页面截图。画布截图经 PNG 解码后统计量化颜色和亮度跨度，同时断言实体与旋转后截图的 SHA-256 不同。

| 视口 / 主题 | 实体画布大小 | 实体量化颜色数 | 点云量化颜色数 | 实体亮度跨度，0–255 | 旋转后像素变化 |
| --- | --- | ---: | ---: | ---: | --- |
| 390 / 浅色 | 390×640 | 495 | 407 | 227.7 | 通过 |
| 390 / 深色 | 390×640 | 359 | 382 | 237.7 | 通过 |
| 1440 / 浅色 | 1067×818 | 876 | 946 | 250.0 | 通过 |
| 1440 / 深色 | 1067×818 | 490 | 711 | 228.7 | 通过 |

像素检查与实际渲染就绪、绘制调用数共同确认画布有内容。另已目检桌面、移动双主题截图，主体与器足完整呈现；此前发现的浅色导览文字、深色展项说明和点云返回按钮对比问题由共享样式修正，最终截图已更新。

## 缺陷与恢复验证

### 重试按钮遮挡

- 复现：拦截 GLB 请求并返回加载失败，随后用 Playwright 普通点击“重试加载”。修复前按钮中心被 `.exhibit-dock` 截获，30 秒后操作超时。
- 修复：在 `ThreeExhibitViewer.vue` 的错误回退区域限制封面高度、预留舞台底部空间，并让重试按钮保持独立的至少 44px 高触控区域。
- 结果：封面和说明保留，普通点击重试成功，新的真实画布通过非空像素检查。
- 修复前证据：`artifacts/sitewide-quality/three/model-failure-before.png`、`first-run-summary.json`。
- 修复后证据：同目录 `model-failure.png`、`model-retry-page.png` 与最终 `summary.json`。

### WebGL 上下文累积

- 复现：修复前即使 20 次循环均已移除画布、停止提交并还原监听器数量，浏览器仍记录 7 条 `Too many active WebGL contexts` 警告。
- 修复：资源释放范围登记 `renderer.forceContextLoss()`。反序清理时先移除事件监听器并调用 `renderer.dispose()`，随后释放上下文，最后移除画布。
- 结果：最终同一会话 20 次循环的上下文数量超限警告为 0。
- 修复前证据：`artifacts/sitewide-quality/three/context-limit-before-summary.json`。
- 修复后证据：最终 `summary.json` 的 `lifecycle` 与 `recovery.contextLimitWarnings`。

### 最终检查矩阵

| 检查 | 实际结果 |
| --- | --- |
| 390 / 1440 双主题加载、实体、旋转、放大、缩小、复位 | 4 组通过 |
| 首次点云反馈、点云完成、切回实体 | 4 组通过 |
| GLB 失败后保留封面、普通点击重试 | 通过 |
| 已就绪画布触发 `WEBGL_lose_context` 后重试 | 通过，创建新的可用画布 |
| 点云构建中返回实体，再重新构建 | 通过 |
| 加载期间离开，模型响应延迟到离开之后 | 通过，已脱离节点保持 `stopped`，没有重新附加画布 |
| 离屏暂停、回到屏幕恢复 | 通过；约 261ms 暂停窗口提交 0 次，恢复后约 266ms 提交 73 次 |
| 同一会话连续进入、退出 20 次 | 20/20 通过 |
| 每次退出的展项画布 | 0；页面总画布数与展厅初始值一致 |
| 每次退出的已脱离节点 | `renderState=stopped`；随后取样的提交计数不再增长 |
| 每次退出的 window / document / canvas 监听器 | 数量与同一会话初始展厅一致 |
| WebGL 上下文超限警告 | 0 |

监听器计数使用测试环境内的 `EventTarget` 包装记录添加与移除；它覆盖当前页面可观察的 JavaScript 监听器，不能替代浏览器内部资源或长期进程内存分析。离屏验证通过临时测试空白区把画布滚出观察范围，再移除空白区并返回页面顶部。

## 限制与下一步

1. 实际后台标签页暂停未验证。Headless Chrome 切换到另一个标签页时，原页面仍报告可见；报告明确记为 `not tested`。已验证的离屏暂停不能替代此项。
2. iPhone Safari、Android Chrome 真机键盘与触控、10 分钟持续运行和真机 30FPS 目标未验证。本机 RTX 4060 的移动视口结果只用于浏览器回归。
3. 首次点云实际渲染仍有约 450ms 长任务。下一步应在固定设备上记录 GPU 驱动、首帧缓冲上传与绘制跟踪，评估首帧预热等方案对首次加载预算的影响。
4. 本脚本的故障恢复与 20 次生命周期循环在 1440px 浅色下执行。移动故障恢复、全部视角切换、英文交互、200% 放大与强制颜色应结合全站控件矩阵继续核对。
5. Fast 4G / Slow 4G、冷暖缓存 LCP / CLS、INP 与资源预算属于独立的全站性能验证，本报告没有代测。

## 证据与复跑

| 类型 | 绝对路径 |
| --- | --- |
| 验收脚本 | `C:/Users/Jie/Documents/博物馆/frontend/scripts/three-quality-audit.mjs` |
| 组件与本轮修复 | `C:/Users/Jie/Documents/博物馆/frontend/src/components/ThreeExhibitViewer.vue` |
| 最终报告 | `C:/Users/Jie/Documents/博物馆/artifacts/sitewide-quality/three/summary.json` |
| 首次重试失败报告 | `C:/Users/Jie/Documents/博物馆/artifacts/sitewide-quality/three/first-run-summary.json` |
| 上下文修复前报告 | `C:/Users/Jie/Documents/博物馆/artifacts/sitewide-quality/three/context-limit-before-summary.json` |
| 全部截图目录 | `C:/Users/Jie/Documents/博物馆/artifacts/sitewide-quality/three/` |

先保证当前隔离环境已就绪，并保持受测构建不变。脚本默认读取忽略目录内的 `current-environment.json`；可以用 `MUSEUM_QA_URL` 指定另一个同版本入口。避免并行启动其他浏览器、构建或重测试，以减少竞争造成的测量污染。

```powershell
Set-Location 'C:/Users/Jie/Documents/博物馆/frontend'
node scripts/three-quality-audit.mjs
```

只回归故障恢复与生命周期时可运行：

```powershell
node scripts/three-quality-audit.mjs --recovery-only
```

完整运行输出 `summary.json`；仅恢复运行输出 `recovery-summary.json`，不会替换完整报告。脚本退出前关闭浏览器。源码、环境、浏览器或设备变化后，应重新记录版本和测量条件。
