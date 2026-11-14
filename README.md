# 荒野 BP / Brawl Draft

在线网站：https://donovan533445-lab.github.io/brawl-draft/

中文荒野乱斗 BP 工具，采用接近游戏原生的蓝色大厅、黄色按钮、红蓝阵容和真实英雄头像。电脑及 iPhone 尺寸适配，纯静态，无需游戏账号。

## v2：有来源的强度榜与逐手推荐

- YouTube 作者评级替代旧版职业规则强度榜。页面显示原视频、日期、转录或核验方式；未确认英雄保持未评级。视频可能早于最新平衡维护，不能自动当作维护后的结论。
- 真实排位胜率来自 Brawl Atlas 公开 MIT 数据导出，只聚合原始出场／获胜计数，不将训练模型结果或职业分数写成实测胜率。
- 胜率覆盖全局、6 个模式和数据源提供的 32 张地图。统计窗口、样本量、生成日期和获取日期均保留。采集项目样本不代表全服总体。
- BP 每次禁用、选取、撤销或换图后自动重算候选，排除已用和未开放英雄。可指定蓝方或红方为我方；对方回合的我方候选只读。
- 推荐优先使用实际地图／模式／全局表现，并参考样本量的不确定性。有足量实测对位或协同记录时才使用；当前公开导出不提供这两类计数，因此不会伪造克制加分。
- 排序使用置信下界作为排序指标，页面百分比仍为未经改写的样本胜率。作者档位与胜率分别展示。英雄胜率均值不是三人阵容胜率预测。

## 更新频率与限制

Brawl Atlas 上游通常每周导出；原始数据项目通常每周更新两次，赛季初可能更频繁。本站 GitHub Actions 每小时检查新导出，浏览器每 5 分钟检查本站快照，并提供手动刷新。

这不是秒级全服实时数据。重复获取不会改变对局截止时间。当前初始窗口是 2026-11-11 至 13 UTC，日级数据无法区分平衡维护当天的确切小时。没有样本时明确显示缺失，不补造 50% 或作者评级。

## 原有功能

109 位英雄及技能图鉴、1,300 张地图与模式数据库、六种常规 3v3 BP、双方禁用与选人、撤销与导出、个人英雄池和 JSON 备份导入导出。英雄池及 BP 保存在当前浏览器，不跨设备自动同步。

## 本地使用

离线下载包解压后直接打开 dist/index.html。所有素材和打包脚本均已包含。

从 GitHub 克隆源码后，安装 Node.js 22 或更新版本，依次运行：

    node scripts/download-assets.mjs
    node scripts/refresh-live-stats.mjs
    npm run build
    npm start

静态服务器默认 http://127.0.0.1:4173 。运行不需要第三方 JavaScript 依赖。

## 部署

.github/workflows/pages.yml 自动获取合法公开统计、缓存游戏素材、构建、测试并发布 GitHub Pages。首次在仓库 Settings → Pages 选择 GitHub Actions，之后推送 main 或小时调度将自动更新。

## 数据与许可

- 英雄／地图资料：[BrawlAPI](https://brawlapi.com/)
- 游戏图片：[Brawlify CDN](https://github.com/Brawlify/CDN)
- 实际计数：[Brawl Atlas](https://brawlstars-atlas.pages.dev/) 及其公开 assets/data.json 导出
- 数据项目：[brawlstars-data-pipeline](https://github.com/elixf7/brawlstars-data-pipeline)
- 原始数据：[EliF77/brawlstars-ranked](https://huggingface.co/datasets/EliF77/brawlstars-ranked)
- 统计编译的完整 MIT 授权文本随 live-stats.json 保存；字体与素材仓库许可分别见 FONT-LICENSE.txt、ASSET-LICENSE.txt。
- 视频评级来源及每项核验信息见 dist/data/youtube-tiers.json 和网站来源弹窗。

## 验证

npm test 覆盖 BP 约束、数据上下文与来源验证、无样本回退、排序不确定性、逐手排除、统计索引缓存，以及原始计数聚合与日期窗口。

tests/auto-recommendations.cjs 验证完整 12 步自动推荐、回合操作、作者原始评级、实际百分比、无数据状态及手机布局。浏览器测试需要 Playwright，可用 PLAYWRIGHT_MODULE / BROWSER_EXECUTABLE 指定本机环境；测试夹具只在浏览器拦截，不写生产数据。

本内容与 Supercell 无关，亦未获其认可、赞助或批准。游戏商标与素材属于 Supercell。参见 https://supercell.com/en/fan-content-policy/ 。
