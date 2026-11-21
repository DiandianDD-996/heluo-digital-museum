# 强制颜色模式分类文字修复

关联F-02、N-06及V3.1 O3。目标是在系统配色分支保留可读的选中分类文字，不改变普通主题、路由或筛选行为。

## 证据、实施与风险

当前生产预览在Chromium forced-colors模拟中，选中按钮计算颜色为HighlightText/Highlight，但截图文字位置出现白色背板而不可读。按钮直接包含文字，没有子span。证据为artifacts/premium-visual-2026-09-12/forced-category-before.png。

临时限定选中按钮forced-color-adjust:none后文字恢复（forced-category-trial.png）。正式修改仅在forced-colors媒体查询内使用该值，同时显式保留系统HighlightText/Highlight，伪元素短线也使用HighlightText，避免继承关闭自动调整后遗留品牌色。该属性不用于整页。

影响文件：frontend/src/assets/explore-gallery.css及定向验收脚本。步骤：修改限定规则，构建，双主题/双视口检查焦点父容器、系统配色及截图。验收：标签可读、选中状态可辨、搜索焦点2px/2px保持。Chromium模拟不能替代原生Windows对比主题验证；不因此宣称全部系统辅助功能通过。

验证结果：生产构建（含类型检查、预算）通过，首屏CSS gzip 47619/80000字节，WOFF2=0；沿用既有PURE注释与大chunk警告。候选ffc173ee3b849fd4909e9ec4b616d9ab0b723942e4723c59c5ab638c27ae143a的4组双主题/390与1440宽度检查通过，报告artifacts/premium-visual-2026-09-12/forced-focus-1789221400717/summary.json首尾指纹一致。搜索真实Tab焦点父容器轮廓2px/间隔2px，分类与短线使用系统色；人工查看浅色手机、深色桌面截图，分类标签可读。全量329单测在前一候选通过，本次仅媒体查询CSS修改未重复全量单测；原生Windows对比主题未验。未提交或部署。
