# Explore 顶部看板与一体化搜索优化

## 增量：低饱和古铜金搜索按钮

- 最新要求：深色按钮在深色搜索框中适当提亮，采用低饱和金色/古铜色，协调分类导航；覆盖下文历史暖灰按钮方案。关联F-02/N-03/N-06。
- 范围：仅深色搜索局部颜色变量和对应浏览器检查；浅色、尺寸、字体、布局及业务保持。
- 配色：默认底色复用分类短线`--gallery-tab-indicator`；深褐#241f18文字，hover混入12%暖象牙、active混入12%深褐。搜索框focus边界和轻环同源古铜色，保留160ms过渡、无渐变/阴影装饰。
- 步骤/验收：更新令牌及旧配色断言；生产构建；复跑双主题响应式及搜索状态检查，核验按钮三态文字对比度至少4.5:1和浅色保持；桌面/手机深色截图复核；同步文档和diff。
- 风险：半透明旧变量与全局样式可能影响实色、焦点；以真实计算颜色和截图为准，不部署/提交。
- 验证结果：生产构建含类型/预算通过，Explore14项单测通过；24组响应式双语双主题和4组加载稳定/错误重试/空态恢复通过，无页面异常。深色默认/hover/active文字对比度分别5.99/6.58/4.82:1，均满足4.5:1。12组浅色计算外观、hover/focus/active与上版报告逐项相同。390及1440深色截图人工复核通过；脚本语法及diff检查通过。
- 本轮修改：`frontend/src/assets/explore-gallery.css`、`frontend/scripts/explore-discovery-header-check.mjs`、本计划、`PROJECT_STATUS.md`及`docs/01-requirements-traceability.md`（绝对根路径C:/Users/Jie/Documents/博物馆）。技能复核采用同源古铜强调，保留单层实色和克制动效。
- 新证据：`artifacts/explore-search-bronze-20260912/summary.json`及24张截图；原暖灰版本证据保留。本轮未重跑全量单测（上轮首页旧背景断言失败仍保留），未验Docker/线上/真机/系统辅助功能和完整业务E2E；本地4189可查看。

- 目标：严格落实用户附件《河洛数字博物馆_Explore顶部看板与搜索框优化方案.md》的 Museum Discovery Header 首选方案。关联 F-02、N-03、N-06。
- 范围：ExploreView.vue 顶部结构、空提交保护，explore-gallery.css 顶部与搜索局部规则；复用 MuseumSearchField，保留其清除、加载、错误和无障碍语义。分类、卡片、数据、路由定义、版心宽度及展厅入口不变。
- 视觉：透明无完整外框，仅淡底线；沿用字体，标题30px/600/1.2、副标题14px/1.6间隔8px。墨绿#173c31、正文#263d35、次文#697871、图标#6f827a、按钮#0e6248；局部变量同步深色。搜索420×46px/10px圆角、18px无分栏图标、36px/7px内嵌按钮。低于等于768px上下布局，间距18px；小于390px按钮内距13px。
- 设计复核：采用附件无卡片首选结构，移除顶部旧点阵装饰以符合低噪音目标；不新增字体、图片、动效或UI依赖。以排版及连续检索轮廓衔接已完成的Soft Tabs。
- 用户中途补充：浅色按钮保持；深色绿色过艳，需与下方导航配色一致。以此最新要求覆盖附件深色#176c52建议：直接复用当前Soft Tabs选中底色及文字变量（暖灰墨色/暖米灰），hover/active仅调整底色明度，无额外彩色强调。分类导航的同期配色改动归用户，原样保留。
- 步骤：记录计划；替换顶部历史样式及结构、空输入直接返回；最小单测后构建及全量前端检查；真实API浏览器核验双语双主题、1440/1366/1024/768/390/320宽度及搜索状态；审查差异并更新项目文档。
- 验收：桌面看板约108–124px（英文换行等内容增高除外）；一个搜索轮廓、无独立图标分栏；尺寸/hover/focus/active正确，无玻璃/渐变/强阴影；按钮/Enter搜索、空提交无URL或结果变动、显式清除恢复馆藏、结果就地反馈、分类/历史返回保持；手机无横向溢出。
- 风险：历史全局!important规则可能覆盖局部材质，必须实测computed style。空搜索与显式清除区分，避免提交空值丢失已有结果/分页。工作区已有大量用户修改，只改任务范围，不提交/部署。
- 实施细节：控制框使用border-box，总高46px含1px边框，因此内部上下padding取4px，实现36px按钮到外缘各5px。清除按钮复用既有组件；修复旧全局规则覆盖输入区背景、placeholder和手机图标高度，保持单轮廓。顶部点阵的两项既有测试契约同步调整。
- 最终验证：`npm run build`（vue-tsc、生产构建、资源预算）通过；全量60文件329单测中328通过，1项`darkThemeCohesion.spec.ts`首页旧背景路径断言失败，与本次范围无关。Explore两文件14项全部通过，空DOM读取的首轮测试错误已修正，取代分类任务同期记录的暂存失败结论。构建保留既有依赖PURE注释及大chunk提示。
- 真实页面：现有4189生产预览、18081隔离H2真实API；从首页可见导航进入，320/390/768/1024/1366/1440 × 中英 × 浅深24组全部通过。核验布局、标题30px/600、副标题14px/8px间距、420×46px（手机铺满）、36px按钮/上下5px、18px图标无分栏、透明输入背景、placeholder准确颜色、无页面横向溢出与pageerror。hover/focus/active、按钮与Enter搜索、空提交保留结果/分类、清除、URL刷新及历史返回均通过。
- 深色最新要求：24组检查中对深色按钮与分类选中态的计算底色/文字色做相等断言，浅色仍为#0e6248/白字；桌面浅色与手机深色截图人工复核通过。顶部无卡片、深色输入无独立色块，搜索按钮已与暖灰导航协调。
- 反馈专项：390/1440 × 浅深4组验证加载期间输入/搜索/清除禁用，加载前后顶部boundingBox不变；注入网络失败后错误提示/aria-invalid与真实API重试恢复，零结果返回全部均通过。分类已有16组浏览器专项也通过。
- 证据：`artifacts/explore-discovery-header-20260912/summary.json`、24张截图及`unit-results.json`；复跑`node scripts/explore-discovery-header-check.mjs`（frontend目录）。语法与任务diff检查通过，既有用户修改和同期分类配色均保留。
- 未验证：本轮未运行Docker、线上部署、实体手机、系统辅助功能、后端测试及预约/支付/后台完整E2E；未提交Git。下一步可在本地4189查看效果，生产发布需另行明确授权。

## 本任务修改文件

- C:/Users/Jie/Documents/博物馆/frontend/src/views/ExploreView.vue
- C:/Users/Jie/Documents/博物馆/frontend/src/assets/explore-gallery.css
- C:/Users/Jie/Documents/博物馆/frontend/src/views/ExploreNavigation.spec.ts
- C:/Users/Jie/Documents/博物馆/frontend/src/assets/pointerDotFieldMapping.spec.ts
- C:/Users/Jie/Documents/博物馆/frontend/src/test/MobileRouteRuntime.spec.ts
- C:/Users/Jie/Documents/博物馆/frontend/scripts/explore-discovery-header-check.mjs
- C:/Users/Jie/Documents/博物馆/docs/plans/2026-09-12-explore-discovery-header.md
- C:/Users/Jie/Documents/博物馆/PROJECT_STATUS.md
- C:/Users/Jie/Documents/博物馆/docs/01-requirements-traceability.md
