# Explore搜索占位文字对比度增量

- 目标与需求：F-02检索、N-03/N-06视觉可用性；仅修复14px占位文字与实际背景不足4.5:1的问题。
- 前置证据：4189生产预览指纹`fdf9b3051afdc348f9aea850645ed729f934eac4a1a23983fa7a317bd56f536a`；390/1440、双语双主题、默认/hover/键盘焦点24状态。浅色12状态失败，最低3.0469:1，深色通过。证据`artifacts/premium-visual-2026-09-12/explore-placeholder/before/summary.json`及实页截图。
- 当前与目标：浅色placeholder `#89958f`改为已有次文语义`--discovery-secondary`（#53645c）；深色仍用原值#899990。普通文字至少4.5:1。只改浅色占位颜色，不改变淡边框、布局、图标、按钮或业务。
- 文件范围：`frontend/src/assets/explore-gallery.css`；原专项`frontend/scripts/explore-discovery-header-check.mjs`更新旧颜色断言；新增`frontend/scripts/explore-placeholder-contrast-check.mjs`记录实际截图背景像素和computed文字颜色。
- 步骤：先量测；局部覆盖浅色占位规则；同步专项断言；生产构建含类型与预算；重跑24状态，对比前后边框/尺寸/按钮值完全一致。
- 风险：半透明背景不能当纯白算，需采样截图输入框上方无文字位置；父级或旧!important规则可能覆盖，使用实际computed确认。保持用户dirty worktree，无提交推送部署。
- 未覆盖：真机、系统强制颜色、线上版本、屏幕显示器差异和业务写入。
- 验证结果：`pnpm run build`含类型检查、Vite生产构建、预算通过；Explore两文件14项单测通过。24状态修后全部达到4.5:1，浅色最低6.1565:1，深色最低6.0312:1。逐项对比前后control背景、边框、宽高、outline与offset、按钮背景/文字/宽高全部一致；深色占位色一致。新增与原专项脚本语法检查通过，修后390px浅色中文截图人工复核。未重复原48组完整检索行为脚本，此次修改仅placeholder颜色；用新增专项和独立读取报告断言核实24项对比度。
- 新候选指纹：`3495c669d2105dfd50f905d00f57f850beffea0a0b3cb89b138dba3bbf7d7fc8`，4189首尾一致；修后证据`artifacts/premium-visual-2026-09-12/explore-placeholder/after/summary.json`及24张截图。构建有既有PURE注释、500kB chunk提示但预算通过。
