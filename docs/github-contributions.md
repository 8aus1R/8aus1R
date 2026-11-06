# GitHub 贡献卡片

主页贡献卡片沿用力扣卡片的 700px 深蓝紫配色与圆角。数据来自 GitHub 官方 GraphQL 的 `user.contributionsCollection.contributionCalendar`，展示近 365 天公开可见的贡献总数、活跃天数、最长连续贡献、最近 30 天贡献及每日热力图。

- 贡献包含 GitHub 计入日历的活动，不等同于 commit 数量，也不代表代码质量。
- 日期使用 GitHub 的 UTC 日历；范围包含当日及前 364 天，不把格子转换为北京时间。
- 活跃天是贡献数大于零的日期；最长连续按这个 365 天窗口内的相邻自然日计算；最近 30 天含当日。
- 只读取账号名与日历计数，不查询仓库内容或私有项目详情。使用本仓库 Actions 自带的 `GITHUB_TOKEN`，无需配置额外个人令牌。公开设置允许展示的匿名贡献可能计入可见日历。

与力扣共用 **Refresh profile cards** 工作流，每天北京时间 **09:17** 启动；也可在仓库 Actions 中选择 **Run workflow** 手动刷新。两个任务分别从干净的最新 `main` 检出，独立验证、生成和提交，力扣抓取失败不会阻止 GitHub 卡片刷新。工作流串行运行，推送前正常 rebase，不强制覆盖。

GitHub 任务只更新：

- `README.md` 中 `GITHUB:START` / `GITHUB:END` 注释之间的内容
- `assets/github-contributions.svg`
- `data/github-contributions.json`

取数、校验或渲染失败时不提交，保留上一次成功的卡片。每日数据须恰好覆盖 365 个唯一连续日期，每日总和须匹配 API 总数；异常或缺失不会替换为零。图片 URL 带内容哈希，减少旧图缓存。日期是最近成功同步日期，GitHub 自身的贡献统计也可能有延迟。

图形渲染位于 `scripts/github-card.mjs`，取数与统计口径位于 `scripts/github-contributions.mjs`。GitHub 公共仓库的定时任务规则与力扣相同，详见[现有自动更新说明](./leetcode-auto-update.md)。

官方依据：[贡献日期与可见性](https://docs.github.com/en/account-and-profile/concepts/contributions-on-your-profile)、[ContributionCalendar API](https://docs.github.com/en/graphql/reference/users#contributioncalendar)。
