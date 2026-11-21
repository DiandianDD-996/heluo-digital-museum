# 首屏加高版本覆盖部署

- 用户授权：当前本地根项目覆盖PocketBay #329/heluo。
- 目标：F-01/N-03/N-06，将已验证首屏高度调整发布到原项目。
- 方案：沿用绑定会话与批准配置，排除依赖、数据库、未批准配置及项目外文件；新包哈希验证后单次上传，轮询并验证线上健康/实页。
- 部署前：release6076，deployment7350为running，项目处于sleeping。首屏6单测、构建含类型/预算、16本地页面检查已通过。
- 风险：真机/业务写入未验，不提交Git或自行回滚。
- 结果：新包SHA256 `937172f411fdac98b33fb55230728682b70e88668d5adf4356c4aafc10667c8d`，解包及上传前逐文件与当前源码校验通过；原绑定会话上传一次，deployment7422/release6143，平台running/done，活动6076→6143。
- 线上：health/ready均UP。1440×900、2050×986、1920×1200、412×915 × 双主题双语16组实际iframe检查通过。桌面首屏分别800/852.3/1040px（外层托管条占39px，90svh按内层计算）；手机208px按钮留白保留，图片decode成功，按钮位于首屏内，无溢出/pageerror。证据artifacts/home-cover-height-online-20260911/及artifacts/pocketbay-deploy-current/*cover-height*。
- 未提交；真机/线上业务写入未测，无新建项目或自行回滚。
