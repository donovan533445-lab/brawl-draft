# 荒野 BP / Brawl Draft

中文荒野乱斗 BP 练习网站，尽量还原蓝色大厅、黄色按钮、红蓝阵容和英雄头像框等游戏原生视觉。适配电脑及 iPhone，纯静态，无需后端或游戏账号。

## 直接使用

双击 `dist/index.html` 即可离线使用。`dist` 目录必须和其中的素材一起保留。

上面的方式适用于已构建的离线下载包。从 GitHub 克隆源码后，应先执行素材下载和构建命令。在线版本由 GitHub Actions 下载素材并构建，仓库不重复保存全部游戏图片。

开发预览：安装 Node.js 22 或更高版本，在项目目录执行 `npm start`，打开终端输出的本地网址。运行无第三方依赖。

## 功能

- 英雄资料库：109 位英雄，包含职业、稀有度、介绍、随身妙具和星徽之力。未核实中文译名及技能描述保留英文。
- 地图库：1,300 张地图，包含历史地图和特殊模式，支持模式与名称搜索。默认仅展示数据源标记的启用地图；启用状态不代表当前赛季排位地图池。
- BP：6 种常规 3v3 模式、双方各 3 个禁用和 3 位选人，先手切换、排位分组记录或蛇形禁用、撤销、重置、导出 JSON、本地自动保存。
- 英雄对位与阵容评分：职业相性和少量条件性英雄机制规则；可点击对位查看说明。
- 强度榜：按模式的职业适配档位展示，S/A/B/C/D 分组。
- 个人英雄池：已拥有、1–11 战力、1–5 熟练度，本地保存，JSON 备份导入导出。
- 手机导航与固定确认按钮、键盘操作、原生模态弹窗和减少动态效果设置。

## 评分限制

目前为可解释的启发式规则，不是当前版本的实测英雄强度或胜率。没有实时对战样本，也不读取玩家战绩。

模式适配使用职业固定权重，同职业同分。选人参考结合模式适配、对敌方的职业/机制关系和职业互补。阵容总分 = 模式适配 × 50% + 职业互补 × 25% + 对位压力 × 25%。地图地形、装备、战力、熟练度、超级技能是否可用尚未纳入算法。

机制规则覆盖科莱特对高血量、格尔反突进、雪莉近身反制、莫提斯接近投掷、黑鸦治疗压制等条件；均为本站推导，不是官方克制表。

## 数据与刷新

资料来自 [BrawlAPI](https://brawlapi.com/)，素材来自 [Brawlify/CDN](https://github.com/Brawlify/CDN)。快照时间见 `dist/data/meta.json`。网站运行时不依赖第三方 API 或 CDN。

```sh
npm run refresh-data
node scripts/download-assets.mjs
npm run build
npm test
```

`build` 将数据库和应用源文件打包为普通脚本，使 `file://` 和子路径托管均可工作。刷新资料后应重新下载素材并运行构建。下载结果见 `asset-report.json`。

## 发布 GitHub Pages

在线仓库通过 `.github/workflows/pages.yml` 自动准备素材、构建和发布 GitHub Pages。使用已连接的 GitHub 服务提交工作流，不额外申请个人账户权限。工作流启用 Pages 后，后续推送 `main` 将自动更新网站。

手动发布也可将 `dist/` 的内容推送至 `gh-pages` 分支，在 Settings → Pages 选择 **Deploy from a branch**，分支选择 `gh-pages`，目录选择 `/ (root)`。

简化的 Actions 模板位于 `examples/pages-workflow.yml`。通过个人 OAuth 凭据提交工作流文件可能需要 `workflow` 权限；原生分支发布不需要这个作用域。

可运行项目自带的 `publish.ps1`，它会使用 GitHub 官方 CLI 登录、新建公开仓库、上传文件、配置 Pages 并触发部署。需要事先安装 [GitHub CLI](https://cli.github.com/)，并完成登录。脚本默认仓库名 `brawl-draft`。若同名仓库已经存在，脚本会停止，避免覆盖已有内容。

## 检查

`npm test` 覆盖数据 ID 唯一性、双方先手与禁用规则、重复/未开放英雄限制、所有英雄组合的对位反对称性、评分边界和职业互补。

浏览器检查脚本 `tests/browser-check.cjs` 需安装 Playwright 和浏览器；启动预览后运行。`PLAYWRIGHT_MODULE`、`BROWSER_EXECUTABLE`、`QA_OUTPUT_DIR` 可指定本机环境。检查完整 BP、撤销、保存、搜索、地图切换、英雄池、弹窗及 320 / 390 / 768 / 1024 / 1440 像素下的五个页面。

## 本地隐私

英雄池和 BP 使用浏览器 localStorage，仅保存在当前设备，不跨设备同步。切换浏览器或域名后需要导入英雄池备份。导入会替换当前英雄池，并要求确认。

## 素材声明

这是玩家创作内容，与 Supercell 无关，亦未获得其认可、赞助或批准。游戏素材及商标属于 Supercell。参见 [Supercell 玩家内容政策](https://supercell.com/en/fan-content-policy/)。Lilita One 字体授权见 `FONT-LICENSE.txt`；素材仓库授权见 `ASSET-LICENSE.txt`。
