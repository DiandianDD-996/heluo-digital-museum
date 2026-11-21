# Android 今晚快速试跑

- 目标：真实 Android Chrome 运行公开页面基础检查，输出 HTML、JSON 和截图，评估成员使用成本。
- 需求：F-01/F-05、N-03/N-06，仅补基础观察，不提升业务需求状态。
- 影响：新增 frontend/scripts/android-quick-check.mjs；报告在忽略的 artifacts/real-device 下；不改业务源码。
- 步骤：确认 ADB 和 Chrome；复用 Playwright CDP 连真实手机；从实际 iframe 链接导航；检查主内容、横向溢出、坏图和页面错误；记录单次导航观察耗时与截图。
- 验收：六页均有结果或明确阻塞、HTML/JSON可读取；保留真机与业务/性能验收边界。
- 风险：平台 iframe、Chrome 版本、页面选择器变化；本次不覆盖完整表单、旋转缩放、CPU/GPU、长时性能。首屏已打开，不能当首次加载测速。
- 验证：Node语法检查通过；实机三轮，首轮隐藏导航脚本错误已修正；第二轮33秒，五个普通页面通过、3D截图连接中断（首次running误报已修正）；最后一轮五页通过，3D等待running超时并返回退出码1。最终报告 artifacts/real-device/quick-2026-09-11T11-29-46-481Z/report.html。未验证业务写入和完整模型交互，未提交部署。
