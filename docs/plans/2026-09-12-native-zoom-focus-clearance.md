# 200%缩放下键盘焦点避让底栏

关联F-01/F-02/F-06、N-03/N-06，V3.1 B/N/O。保持当前导航位置、尺寸、品牌、路由和业务；只修复键盘滚动时的遮挡。

## 当前实现与证据

- `frontend/src/App.vue`真实`.mobile-tab-bar`在公众端存在，登录/重置/后台不渲染；`main.css`底栏显示到900px。
- 根滚动容器没有底栏避让的scroll-padding；既有`.booking-main`的scroll-padding不作用于文档根滚动。
- 候选3495c669，临时独立Chrome原生页面缩放200%（1440变720 CSS像素），实际连续Tab触发。`artifacts/premium-visual-2026-09-12/native-zoom-tab-1789220371372/summary.json`记录16路由主题组，预约日期和个人中心字段/保存按钮中心命中底栏，焦点仅部分露出。大型后台panel的中心在视口外不按同一种遮挡判断。
- 临时页面CSS给html设置底部`calc(6rem + env(safe-area-inset-bottom))`滚动避让后，首页/Explore/预约/个人中心双主题8组中心遮挡为0，证据`native-zoom-tab-1789220453534/summary.json`。这不是产品构建通过证据。

## 具体修改与范围

仅`frontend/src/assets/main.css`新增max-width:900px、`html:has(.mobile-tab-bar)`的`scroll-padding-bottom: calc(6rem + env(safe-area-inset-bottom))`。6rem覆盖当前底栏高度与底部间隙；没有底栏的页面不改变滚动行为。它不增加页面padding、不移动导航、不改变控件尺寸或键盘事件。

风险：原生焦点滚动与程序scrollIntoView不等价；必须用真实Tab复验。选择器支持沿用项目已使用的:has能力，不新增依赖。

## 验收

生产构建含类型/预算通过，CSS首屏47619/80000字节；全量60文件329单测通过。正式候选f28dbe00ea177ffa804a440825314f9354b05b022948abef917310b487d7a8f7、无临时CSS的16组真实Tab结果在`native-zoom-tab-1789220774377/summary.json`，首尾指纹一致。首页/Explore/预约/个人中心原底栏中心遮挡均消失；后台仍有4条命中复核（大panel超出视口和Element Plus input），不能把整份报告当全部通过。

后台4条命中补查：native-zoom-tab-1789220966071/summary.json及1789221017729同名报告中，2个大panel中心在视口外，露出部分边角命中自身；另外2个select输入中心命中同一选择器的placeholder，边角命中input，ArrowDown展开列表且有3项、有效aria-active，Escape返回焦点。由此关闭“中心命中异常等于控件被遮挡”的判断，不作后台产品修改。

截图复核发现部分原生缩放截图与记录坐标不一致、画面大片空白；CDP替代截图也未解决。DOM命中及键盘证据有效，但不以异常截图断言原生200%后台视觉/焦点外观全部正常。这是具体采集限制，不要求大panel整体进入视口。

390/900px预约html实际scroll-padding-bottom=96px，901px为auto；登录三宽均auto，证明无底栏路由不受新规则影响。真机软键盘需要重新连接设备，不由桌面缩放替代。未提交/推送/部署。
