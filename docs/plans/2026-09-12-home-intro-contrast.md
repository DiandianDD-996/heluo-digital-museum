# 首页深色说明文字对比度

关联 F-01、N-03、N-06；V3.1 A/D/O。

| 实施合同 | 内容 |
|---|---|
| 当前实现 | `/` 的 `HomeView.vue` scoped `.home-cover__intro` 使用 `--theme-text`，深色实际为rgb(194,189,179)，16px正文 |
| 已复现问题与证据 | 当前010de749构建，1440中文深色的背景每3px采样最低4.09:1，低于4.5:1；`artifacts/premium-visual-2026-09-12/background-contrast/summary.json`及对应PNG |
| 保留/禁止修改 | 不修改用户背景图、图片裁切、标题、CTA位置、字号、间距、路由、动作或文案；浅色保持 |
| 具体修改 | 仅深色 `.home-cover__intro` 的前景语义改用已有 `--theme-text-strong`，不增加新Token或全局覆盖 |
| 影响文件/范围 | `frontend/src/views/HomeView.vue`；首页深色中英文、各视口 |
| 目标与验收 | 复测首页双主题/双语390/1440文本背景，目标最低4.5:1；相关单测、类型/构建预算；确认布局与背景资源引用未变 |
| 风险 | 不同背景裁切可能改变局部背景亮度；范围内实测，其他视口不由本次采样自动推断 |

验证结果：`artifacts/premium-visual-2026-09-12/home-contrast-final/summary-home.json` complete=true，构建9e997c110b58d402a58e784dba180b14ae23219c1c6e5bcee8c5ebd1789dea12。390/1440双主题双语8组中`.home-cover__intro`最低5.85:1，均达到4.5:1。首轮a7f7eb18修正未命中scoped选择器、仍4.09:1，仅保留为失败过程，不作为完成证据。

采样针对首屏实际文字背景每3px矩形，不等于整页、所有滚动位置或全部背景裁切验收。报告scope文字仍写Chinese，但results实际包含zh-CN/en-US各4组，以逐组记录为准。后续fdf9b305构建仅追加商城interaction.css避让，不冒称首页8组在该构建重跑。未提交、推送或部署。
