# Android 实体手机软键盘定向验收

## 目标与范围
关联 F-06/F-09/N-03/N-06。在已授权 V2366HA / Android Chrome 上验证登录输入及预约移动联系表单：真实软键盘开启后输入字段、主要操作可以通过正常滚动到达，不发生页面横向溢出。不提交预约、登录、注册或支付，不改产品文件。

## 影响范围与步骤
- 仅增加 `frontend/scripts/android-keyboard-check.mjs` 和本记录，截图/JSON 输出到忽略的 artifacts。
- 主协调者让出手机前台后，CDP 创建独立标签页；不复用其他诊断标签、不修改设备视口或浏览器全局设置。
- 记录实际设备、候选签名、关闭/开启键盘时 visualViewport；通过真实 touch 触发输入并保存 Android 屏幕截图与输入法窗口状态。
- 检查浅深主题下登录用户名/密码，以及选择真实可预约日期时段后的姓名/电话/邮箱/备注字段；只选择，不提交业务。
- 保持键盘开启，滚动到主要按钮并检查 visualViewport 内几何与中心命中；关闭键盘后复核按钮。

## 验收标准与风险
必须有实际输入法弹出证据，不把 focus 或模拟移动 viewport 当作键盘。字段/按钮经正常滚动后中心在可视区域、命中自身或子元素，页面无横向溢出。结果只覆盖这台手机当前输入法与所测状态，不泛化为所有设备。共享手机前台必须串行；执行完关闭独立标签并归还前台。

## 验证结果
- 证据：`artifacts/real-device/keyboard-1789221811433/summary.json` 与10张真实 Android 截图。起止候选签名均 `ffc173ee3b849fd4909e9ec4b616d9ab0b723942e4723c59c5ab638c27ae143a`；V2366HA，布局宽360px、关闭键盘高度706px；未覆盖设备 viewport。
- 已完成浅色中文的登录、预约两组。登录用户名及预约姓名/电话/邮箱/备注均获得实际输入法 `mInputShown=true` 与截图；键盘开启后 visualViewport 高376px（备注424px），输入字段中心在实际可见区域且命中自身，页面横向溢出0。
- 预约末尾按钮滚动后在键盘上方完整显示，中心命中按钮内容；关闭键盘后仍可达。`light-appointment-action-keyboard.png` 已目视复核，真实键盘和“确认预约”同时可见，未点击提交。
- 登录密码与随后的登录按钮：布局几何、焦点和命中正常，visualViewport 高352px，但系统截图主体全黑，输入法状态报告 `mInputShown=false`。可能涉及系统安全键盘/截图保护，现有证据不足以断言实际显示黑屏，也不足以宣称密码软键盘已完成目视验收；保留此限制，不把单纯焦点当作输入法成功。
- 转入深色登录前，独立标签 `page.evaluate` 报 `Target crashed`，脚本退出1并保存部分结果、关闭自己的标签。深色组未执行，不把计划矩阵标为全通过。已归还手机前台给3D诊断；没有改产品文件。
- 脚本支持 `HELUO_KEYBOARD_THEMES=dark` 和 `HELUO_KEYBOARD_ROUTES=/login,/appointment` 定向续验，避免重跑已验证范围；后续记录会区分几何通过与逐字段IME确认。
- `git diff --check` 通过。脚本与记录不影响构建，无需重复单元测试。项目状态/需求追踪由主协调者统一更新。

后续定向续验：HELUO_KEYBOARD_THEMES=dark、HELUO_KEYBOARD_ROUTES=/appointment执行退出0，报告artifacts/real-device/keyboard-1789222037246/summary.json起止签名ffc173ee一致。4字段均真实IME开启、几何/命中通过，确认按钮开关键盘后可达；dark-appointment-action-keyboard.png目视确认键盘及完整按钮同时可见。预约双主题代表范围已完成；不把登录密码截图限制或未执行的深色登录标为通过。
