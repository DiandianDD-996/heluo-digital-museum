# 视听升级收口与本地 Docker 整理

## 目标与范围
- 关联 F-01、F-02、N-03、N-06：修复视听升级造成的构建/测试回归，统一音效控件，首页开场仅会话首次播放，默认静音，降低装饰动效强度。
- 影响前端音效、首页、共享控件、转场类型与类型检查脚本；不改 API、权限或业务状态机。
- 重建现有正式 Compose 项目并走真实页面；盘点后清理确定废弃的本项目候选容器、镜像及构建缓存。保留数据库、上传卷及其他项目数据，不以全盘 volume prune 清理。

## 步骤与验收
1. 修复类型冲突和非浏览器音效初始化，补充默认静音和偏好回归测试。
2. 音效按钮复用主题控件外观、44px 尺寸与主题描边；首页入口不被开场隐藏，返回不重播，取消无限循环。
3. 单进程全量单测、显式类型检查、生产构建和预算通过。
4. 检查 Docker 所有资源归属，重建目标项目；HTTP、健康接口及浏览器实际导航/主题/音效/馆藏/3D抽样验收。
5. 删除确认废弃的构建资源，复查所需服务和数据卷，记录清理对象和结果。

## 风险
- 工作区含用户未提交改动，保留现有视觉方案；不提交或推送。
- Docker 启动时引擎不可达，需要恢复后才能盘点；数据库卷必须保留。
- 浏览器自动播放、真机性能、主观听感须区分可测技术状态与人工体验。

## 验证结果

- `corepack pnpm exec vitest run --maxWorkers=1`：63 个测试文件、336 项通过；threads 单进程复跑同样通过。原路由套件回归已消除。
- `corepack pnpm typecheck`：通过，脚本现为 `vue-tsc -b`，实际覆盖应用项目；`corepack pnpm build`：类型、Vite、资源预算均通过。初始 CSS gzip 48,169 bytes（预算80,000），JS gzip 517,383 bytes。保留第三方 PURE 注释、chunk 体积及粒子静态/动态重复导入提示，不将提示描述为零警告。
- `git diff --check`：通过，仅行尾转换提示。没有提交/推送，用户原有工作区改动保留。
- Docker 根 Compose 构建及 `up -d --no-build` 成功；镜像 `heluo-museum:local` / `8d23610735081017131700d6e502f2e3eab11713346398b841b1b8c94a20e105`，容器 `heluo-museum-local` 持续运行；`http://localhost:8088/api/v1/health` 和 `/api/v1/ready` 实际返回 `data.status=UP`。
- Docker 实页1280px桌面首页双主题截图复核：音效按钮70.25×44px，flex横排，SVG fill=none；浅色描边跟随主题，深色为rgb(213,209,197)，静音叉号有描边。初始为关闭；点击开启、刷新后仍开启、再关闭成功。刷新首页标题与入口可见。实际点击馆藏导航，加载6件器物与3篇文章，未出现原先后端连接失败。
- 首页去除无限背景呼吸，首次开场约1秒完成，CTA不参与隐藏；会话限次/存储不可用降级由新增测试覆盖。遵循GSAP生命周期清理，卡片粒子full/balanced预算从11/5降到5/3，扫光/光晕降低，图片will-change仅悬停期间启用。

## Docker 恢复、清理与保留

Docker Desktop启动失败源于本机旧运行时socket目录；停止Docker进程后，将`%LOCALAPPDATA%/Docker/run`与`%LOCALAPPDATA%/docker-secrets-engine`旧目录重命名留存，再创建空运行时目录并启动，未恢复出厂设置、未删除Docker数据盘。保留的`*-stale-20260921*`目录可用于故障追溯。

确认实际当前目标为根`docker-compose.yml`的`heluo-museum`项目（H2合包演示），不是`deploy/compose.yaml`的MySQL多容器方案；保留`heluo-museum_museum-local-data`和本地配置。重建命令已同步`deploy/README.md`。

删除21个已退出旧博物馆候选/质量验证/hello-world容器（未使用`-v`）、10个旧博物馆镜像加1个hello-world镜像、2个旧质量环境网络。运行`docker builder prune -af`，实际报告释放10.84GB，构建缓存降到0。

最终4个容器：运行中的`heluo-museum-local`，以及保持原退出状态的`taskflow-api`、`taskflow-jenkins`、`qmyz-qmyz-1`。保留其他项目镜像与MySQL/Mailpit等基础镜像，共11个镜像ID、3.371GB。全部10个数据卷（749.4MB）保留，其中8个旧测试数据库卷未挂载，不能仅因Docker标为reclaimable就当作无用构建删除。删除的容器/构建缓存不能直接撤销，镜像需重新构建或拉取；数据库未删除。

## 验收边界

本轮未覆盖主观音色听感、实体手机帧率/触摸体验、全量后台CRUD/预约/订单写入、完整3D设备矩阵或公网PocketBay更新；不沿用历史通过记录代替本构建验收。构建完成不等于这些项目通过；历史Chrome133的3D兼容风险保留。
