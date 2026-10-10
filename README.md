<div align="center">

<a href="https://music.apple.com/cn/album/%E5%9C%A8%E9%9B%A8%E5%90%8E%E9%86%92%E6%9D%A5/1845141403">
  <img src="https://cdn.albumoftheyear.org/album/1503111-_165946.jpg" width="430" alt="艾志恒 Asen《在雨后醒来》专辑封面" />
</a>

<h1>zbz</h1>

<p><strong>计算机专业学生 · 备考 11408</strong></p>

<p>算法与数据结构 / 数据库 / AI Agent</p>

<p>
  <a href="https://github.com/8aus1R/MewCode">MewCode</a>
  &nbsp;·&nbsp;
  <a href="https://space.bilibili.com/68534484">Bilibili</a>
  &nbsp;·&nbsp;
  <a href="https://www.douyin.com/user/MS4wLjABAAAAfMMMAMkXDWRNCu_KtJq6urPe5G3LRhyK-oEYmwGsy9Q">Douyin</a>
</p>

</div>

---

## 现在在做

备考 **11408**。在复习计算机基础的同时，我主要把时间放在算法、数据库和自己的 Agent 项目上：一边学原理，一边写代码验证理解。

### 算法与数据结构

持续刷题，也整理每道题背后的思路：为什么这样设计、复杂度是多少、有没有更清楚的写法。希望把数据结构和算法真正用起来，而不是只记住一份题解。

### 数据库

围绕 SQL、索引、事务等主题补基础，把概念、实际查询和实现原理联系起来。

算法与数据库的资料目前在本地整理，上传后会补上仓库链接。

---

## 主要项目

### 🐱 [MewCode](https://github.com/8aus1R/MewCode)

**从零构建的 Python 命令行 AI 助手 / Agent 框架。**

MewCode 不只是把问题发给模型再显示回答。我想把一个 Agent 真正运行起来需要的部分逐个做出来：多轮对话与流式输出、模型调用工具、管理上下文和记忆，以及在执行文件和命令操作前做好权限检查。

```text
用户输入 → 模型响应 → 工具调用 → 权限检查 → 执行结果 → Agent 继续思考
```

目前项目已经实现：

- **Agent Loop 与工具系统**：模型可以连续调用文件读写、编辑、搜索和命令执行等工具；工具有统一的注册与结果结构。
- **上下文与记忆**：管理多轮历史，支持上下文压缩、会话归档和持久化项目记忆。
- **权限控制**：结合工作区沙箱、命令黑名单、YAML 规则、权限模式和交互确认，限制有副作用的操作；`/plan` 可先只读规划，`/do` 再显式执行。
- **模型与扩展**：支持 OpenAI、Anthropic Claude、OpenAI-compatible API 和 Qwen / DashScope，并支持 MCP 工具发现。

这个项目还在持续迭代。我把它当作理解 Agent 工程的一次完整实践：让模型、工具、上下文和安全边界能协同工作。代码、使用方法和完整功能列表都在 **[MewCode 仓库 →](https://github.com/8aus1R/MewCode)**。

`Python` · `Agent Loop` · `Tool Calling` · `MCP` · `Context` · `Memory` · `Permissions`

---

<div align="center">

<sub>继续学，继续做。 · 封面来自艾志恒 Asen 的 <a href="https://music.apple.com/cn/album/%E5%9C%A8%E9%9B%A8%E5%90%8E%E9%86%92%E6%9D%A5/1845141403">《在雨后醒来》</a></sub>

<br /><br />

<img src="https://github-readme-stats.vercel.app/api?username=8aus1R&show_icons=true&theme=github_dark&hide_border=true&include_all_commits=true" alt="GitHub 统计数据" />

</div>

