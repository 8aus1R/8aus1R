# GitHub 贡献卡片

主页贡献卡片的数据来自 GitHub 原生贡献日历的公开 HTML，以未登录访客能看到的日历为准。展示贡献总数、活跃天数、最长连续贡献、最近 30 天贡献及每日热力图。

- 贡献包含 GitHub 计入日历的活动，不等同于 commit 数量，也不代表代码质量。
- 账号开启私有贡献的匿名展示后，公开日历会包含公开贡献与匿名私有贡献的每日计数，不会公开私有仓库名称或活动详情；卡片沿用这一可见范围。
- 日期与窗口遵循抓取到的 GitHub 原生日历，保留页面提供的日期，不强行截取为固定 365 天，也不把每日格子转换为北京时间。
- 活跃天是贡献数大于零的日期；最长连续在该日历窗口内按相邻自然日计算；最近 30 天以该窗口的截止日期为基准。
- 抓取日历不使用登录 Cookie、`GITHUB_TOKEN` 或个人访问令牌（PAT），也不读取仓库内容。Actions 自动提供的仓库令牌仅用于检出与提交更新，无需配置额外的广泛权限 PAT。

与力扣共用 **Refresh profile cards** 工作流，每天北京时间 **09:17** 启动；也可在仓库 Actions 中选择 **Run workflow** 手动刷新。两个任务分别从干净的最新 `main` 检出，独立验证、生成和提交，力扣抓取失败不会阻止 GitHub 卡片刷新。工作流串行运行，推送前正常 rebase，不强制覆盖。

GitHub 任务只更新：

- `README.md` 中 `GITHUB:START` / `GITHUB:END` 注释之间的内容
- `assets/github-contributions.svg`
- `data/github-contributions.json`

取数、HTML 解析、校验或渲染失败时不提交，保留上一次成功的卡片。日期范围与每日计数须通过完整性校验，每日总和须匹配原生日历显示的总数；异常或缺失不会替换为零。GitHub 页面结构变化导致无法解析时，也会保留旧快照。

周日切换周次时，GitHub 的 `data-from` 有时仍保留前一周起点，而实际格子已滚动为截至当天的完整 365 天。仅在属性范围恰为 372 天、实际格子为 365 天、起点恰好晚一周且终点为当天周日时，采用实际格子的起点。仍须逐日连续、无重复、提示日期及贡献总数一致；不会补零或忽略缺失日期。

公开日历返回 5xx 服务端错误时，后续重试使用同一账号的小写等价地址，仍不携带凭据、不跟随重定向，并执行相同的账号与数据完整性校验。

卡片每天生成快照，采用与抓取时原生日历一致的数据口径，不承诺与随后打开的 GitHub 页面实时一致。同步后产生的新贡献、GitHub 自身的统计延迟和页面缓存都可能带来暂时差异；图片 URL 带内容哈希以减少旧图缓存。日期表示最近一次成功同步时间。

工作流先运行 `github.test.mjs`、`github-native.test.mjs` 与 `github-renderer.test.mjs`，再运行 `scripts/update-github.mjs`。GitHub 公共仓库的定时任务规则与力扣相同，详见[现有自动更新说明](./leetcode-auto-update.md)。

官方依据：[贡献日期与可见性](https://docs.github.com/en/account-and-profile/concepts/contributions-on-your-profile)、[匿名私有贡献的展示范围](https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference#who-can-see-your-contributions-and-achievements)。
