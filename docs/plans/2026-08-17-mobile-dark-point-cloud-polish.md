# 移动端深色点云视觉优化实施计划

## 目标

修复 `/exhibits/heluo-bronze-ding-3d` 在移动端深色模式下点云过暗、青玉与古铜层次难以辨认的问题，使鼎身、双耳、三足和局部铜色颗粒在深墨展厅中清晰但不过度发光。

## 关联需求

- `F-05`：3D 展项支持实体与点云模式。
- `F-12`：3D 核心界面支持中英文切换。
- `F-14`：浅色/深色主题均可读且视觉一致。
- `N-03`：移动端核心交互可用，无关键遮挡或溢出。
- `N-06`：类型检查、测试、构建与实施记录完整。

## 影响范围

- `frontend/src/lib/pointCloudQuality.ts`：增加移动深色专用青玉/古铜调色板。
- `frontend/src/components/ThreeExhibitViewer.vue`：创建点云及主题切换时同步调色 uniform，并降低移动深色展台亮度。
- `frontend/src/assets/route-exhibit-detail-legacy.css`：移除移动深色场景继承的浅色氛围层，建立墨绿暗厅背景。
- `frontend/src/lib/pointCloudQuality.spec.ts`、`frontend/src/components/ThreeExhibitViewer.spec.ts`：补充调色板与运行时主题切换测试。
- `PROJECT_STATUS.md`、`docs/01-requirements-traceability.md`：记录验证结果。

## 实施步骤

1. 保留移动浅色调色板，新增对深墨背景具有足够明度和冷暖差的移动深色调色板。
2. 创建点云时按当前主题选择调色板；收到 `heluo:theme-change` 时更新已有点云材质，不重建几何。
3. 移动深色展厅改为墨绿暗厅并移除浅色白雾层；展台改为低亮墨石与克制古铜边，避免背景和底座压过点云主体。
4. 保留 `18,000` 点和 DPR `1.25`；移动浅色点径继续为 `.92`，移动深色点径使用 `1.16`，提升暗背景上的轮廓连续性而不增加几何采样。
5. 运行专项测试、全量测试、类型检查、生产构建、Docker 与移动正式页面回归。

## 验收标准

- `390×844` 深色移动页中，点云鼎身、双耳和三足轮廓清晰，青玉主体与古铜颗粒可区分。
- 深色点云不呈现荧光绿整片发光，展台不压过主体。
- 点云开启后切换浅色/深色，材质即时更新，无重载、闪断或控制台错误。
- 移动浅色与桌面点云调色、点径保持原样；移动深色仅增加点精灵覆盖面积，不增加点数、采样或 GPU buffer。

## 风险

- WebGL 颜色经过输出色彩空间转换后，代码数值与截图观感并非线性对应，必须以正式 Canvas 截图复核。
- 当前自动化浏览器不能替代 OLED/LCD 真机亮度、系统色彩增强和中低端 GPU 长时间帧率验收。

## 验证结果

- 专项测试：`pointCloudQuality.spec.ts`、`ThreeExhibitViewer.spec.ts`、`ExhibitDetailView.spec.ts`、`darkThemeCohesion.spec.ts` 共 `4` 文件 / `35` 项通过。
- 前端全量 Vitest：`45` 文件 / `254` 项通过；`corepack pnpm typecheck` 与 `corepack pnpm build` 通过，初始 CSS gzip `46,126 B`，低于 `80,000 B` 预算。
- `corepack pnpm qa:pointer-pages`：`32/32` 页面/视口组合通过，无横向溢出、控件裁切或门禁失败。
- 正式 Docker：前端镜像 `sha256:d6f77f17b894886f5142869072142693fe99578477978c9b5529016fe656a699`，3D 展项 HTTP `200`，API health `data.status=UP`。
- 正式 `390×844` 中文深色点云：鼎身、双耳和三足轮廓清晰，青玉主体与暖铜颗粒可区分，墨石展台不再压过主体；Canvas 为运行状态，控制台 `warning/error` 为 `0`。
- 运行时切换：点云保持开启时由深色切到浅色再切回深色，场景、展台、雾色、调色与点径即时同步，无重载或闪断；浅色点云保持原有视觉。
- 未验证：OLED/LCD 实体手机亮度、系统色彩增强、触控笔、Windows 强制颜色/高对比度及中低端 GPU 长时间帧率。
