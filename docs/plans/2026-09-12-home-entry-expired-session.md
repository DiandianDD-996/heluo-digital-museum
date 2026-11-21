# 根地址默认首页修复

## 目标与需求
用户要求点击https://heluo.pocketbay.app/进入首页。关联F-01公开首页、身份认证需求；保留个人中心/后台鉴权和显式登录入口。

## 已复现问题
线上release6443：无凭证打开/正常；localStorage存在过期token时，/auth/me返回401，App全局unauthorized处理器清除token并无条件导航/login?returnTo=/&reason=expired。根路由本身已是HomeView，没有错误的默认路由配置。证据artifacts/home-entry-1789225632347/summary.json。

## 实施与影响
仅在frontend/src/App.vue的失效会话导航条件中排除根路径/，保留清除token、草稿保护及其他路径失效处理。不修改后端权限/API、登录跳转目标或路由表。补充frontend/scripts/check-home-entry.mjs真实浏览器验证。

## 验收
1. 空凭证打开根地址显示首页。
2. 过期凭证打开根地址，实际/auth/me=401，凭证清除后仍在首页。
3. 过期凭证打开/profile仍跳登录；显式/login仍可进入。
4. 类型、相关认证测试、生产构建通过；覆盖更新原#329并在线复验4场景。

## 风险与发布
只豁免根首页的自动重定向，其他操作不变。使用原绑定heluo会话上传，禁止再次使用会创建副本的name免配对接口。保留已有脏工作区，不提交、推送、回滚或删除副本。

## 结果
- 修前线上4场景：artifacts/home-entry-1789225632347/summary.json，过期凭证根入口确实跳登录。
- 修后本地4场景均符合预期：artifacts/home-entry-1789225764890/summary.json，真实401后根路径保持/且token清除。
- api/auth相关2文件4单测通过；生产构建含vue-tsc及资源预算通过。保留既有PURE注释和大chunk警告，不改预算。
- 发布包415文件，哈希01ab7e663689e6ce088aa8318139e2f8856cf5d7a8399eeec2929dd19b872c0e，逐项解压校验通过，无禁止条目。比较基线是package-evidence-visual-final.json（release6443），仅App.vue不同；打包工具报告中changedSince6143是旧字段名，应按实际Baseline理解。
- 原绑定会话上传成功，deployment7759、slug=heluo，待平台完成后复验；未使用会产生副本的免配对接口。
- 最终：deployment7759 / release6447已在原#329运行，active6443→6447，running/done，无平台错误。本轮仅一次上传。
- 线上4场景全部通过：artifacts/home-entry-1789225914008/summary.json。旧凭证/auth/me=401后仍显示首页、token已清除；个人中心仍跳登录，显式登录正常。health/ready均UP，线上入口资源index-CRsUH_LY.js与本地一致。
- 仅本目标定向回归；未重跑全站业务E2E/手机实机，不影响此前限定证据。未提交、推送或删除。修改文件：App.vue、check-home-entry.mjs、本计划、PROJECT_STATUS.md、docs/01-requirements-traceability.md；打包工具变化仅在忽略的artifacts目录。
