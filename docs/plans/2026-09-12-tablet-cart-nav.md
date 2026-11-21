# 平板窄屏商城入口避让底栏

关联F-07/N-03/N-06；V3.1 H/N/O。

- 当前实现：`interaction.css`在980px以下启用`.mobile-cart-trigger`，默认bottom为1rem；只在760px以下提升到`calc(5.35rem + env(safe-area-inset-bottom))`。但`main.css`底部导航持续显示到900px。
- 已复现：761px英文、900px中文，双主题共4组商城底栏最后一项中心被购物袋覆盖；键盘可聚焦但pointer hit命中购物袋。证据`artifacts/premium-visual-2026-09-12/responsive-focus-followup/summary.json`（9e997c构建、58组），不是根据截图猜测。
- 修改范围：只在761–900px给购物袋补齐同源安全区bottom；保留901–980px无底栏时的原位置、手机按钮尺寸、抽屉行为与API，不改变z-index掩盖覆盖。
- 验收：760/761/900/901及980/981断点，双主题，购物袋与导航矩形不相交、导航中心hit正确、购物袋可打开/关闭购物袋；类型检查、构建及预算。无业务写入。
- 风险：历史CSS加载顺序可能覆盖位置，使用生产预览computed style核验。未提交、推送或部署。

验证完成：`artifacts/premium-visual-2026-09-12/cart-nav-after/summary.json` complete=true；首尾指纹均为fdf9b3051afdc348f9aea850645ed729f934eac4a1a23983fa7a317bd56f536a。760/761/900/901/980/981双主题共12组，overlap=0、overflow=0。底栏存在的760/761/900六组navHit=true；901/980无底栏，不能把其navHit默认值当导航命中测试。浮动入口存在的10组购物袋开关passed；981两组改用桌面面板，浮动入口开关不适用。

同构建`native-zoom/summary.json`另有英文8路由双主题16组原生200%缩放、无横向溢出。该报告只程序聚焦最多前3控件，首页无focus样本；预约日期下半部被固定底栏覆盖，未证明所有焦点无遮挡或完整Tab顺序。保留后续风险验证，不扩大本购物袋修复完成范围。
