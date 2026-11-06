# 力扣卡片自动更新

主页沿用原有彩色卡片样式，通过 GitHub Actions 获取力扣公开数据并更新快照，无需提供力扣密码、登录 Cookie 或个人令牌。仓库读写使用 GitHub 自动提供的 `GITHUB_TOKEN`。

工作流 **Refresh LeetCode card** 计划每天北京时间 **09:17** 运行（`17 1 * * *`，UTC 01:17）。修改 `main` 分支的工作流或 `scripts/` 文件也会触发运行。卡片上的日期是最近成功获取数据的快照日期，数据并非实时更新。

每次先运行测试，再获取并校验公开数据。只有成功后才提交以下三个文件；内容未变化时不创建提交：

- `README.md`
- `assets/leetcode-live.svg`
- `data/leetcode-latest.json`

测试、抓取或校验失败时停止更新，仓库保留最后一次成功快照。推送前会同步 `main`；如果发生合并冲突或推送被拒绝，运行失败并保留远端已有内容，不强制覆盖。运行记录可在仓库 **Actions** 中查看。

需要手动刷新时，进入 **Actions → Refresh LeetCode card → Run workflow**，选择 **main** 后运行。已有失败记录也可以通过 **Re-run jobs** 重跑；修复过脚本后，建议使用 **Run workflow** 重新运行当前版本。

任务在 GitHub 高峰期可能延迟。公开仓库连续 **60 天没有仓库活动**时，GitHub 会自动禁用定时工作流；在 Actions 中重新启用后可手动运行一次。详见 [GitHub 定时触发说明](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)和[重新启用工作流](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows#enabling-a-workflow)。

数据来自力扣公开主页使用的 GraphQL 查询。通过率以成功提交次数除以总提交次数计算；社区数据取最新日期记录，精确计数与该记录日期保存在 JSON 中。接口字段发生变化时校验会报错，保留旧快照供排查。

卡片模板为 `scripts/leetcode-card.svg`，脚本只替换数字和文字。README 仅更新 `LEETCODE:START` 与 `LEETCODE:END` 两个注释之间的内容，并随卡片内容更新图片版本参数，减少缓存造成的旧图显示。
