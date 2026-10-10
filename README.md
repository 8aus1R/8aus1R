<div align="center">

<a href="https://music.apple.com/cn/album/%E5%9C%A8%E9%9B%A8%E5%90%8E%E9%86%92%E6%9D%A5/1845141403">
  <img src="./assets/after-rain-wide.png" width="100%" alt="以艾志恒 Asen《在雨后醒来》封面为基础扩展的宽幅画面" />
</a>

<h1>zbz</h1>

<p><strong>计算机科学与技术专业 · 备考 11408</strong></p>

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

我是计算机科学与技术专业的学生，现在准备 11408。平时主要刷算法题、复习数据库，也在继续做 MewCode。

### 算法与数据结构

最近在刷题，也会回头补一补不熟的数据结构。做题时遇到的问题，我会记在本地的笔记里。

### 数据库

目前在复习 SQL、索引和事务，边看边做笔记。

算法和数据库的笔记还放在电脑上，之后会传到 GitHub。

---

## 主要项目

### 🐱 [MewCode](https://github.com/8aus1R/MewCode) — 命令行 AI 助手

**技术栈：** Python、MCP、OpenAI / Anthropic API、YAML

**项目介绍：** 从零构建的 Python 命令行 Agent。它支持多轮对话和流式输出，让模型在 Agent Loop 中调用工具、读取执行结果并继续处理任务；项目同时关注上下文管理、持久化记忆和工具执行的权限边界。

**个人职责：**

- 搭建模型接入、Agent 调度、工具注册、上下文管理和权限控制等模块，让对话、工具调用与结果回传形成完整流程。
- 实现文件读取、写入、编辑、搜索和命令执行工具，并加入 `/plan` 只读规划与 `/do` 显式执行流程。
- 支持 OpenAI、Anthropic Claude、OpenAI-compatible API 和 Qwen / DashScope，并接入 MCP 工具发现。

**技术亮点：**

- **Agent Loop 与工具调用**：支持模型连续调用工具，使用统一的工具注册机制和结构化结果；相邻只读工具调用可并发执行，同时保持结果顺序。
- **上下文与记忆**：支持上下文压缩、会话归档和持久化项目记忆，让长对话与项目资料可以持续使用。
- **五层权限控制**：通过命令黑名单、工作区沙箱、YAML 规则、权限模式和交互确认限制高风险操作，并设置工具超时与 Agent 迭代上限。
- **模型与 MCP 扩展**：将模型服务与 Agent 核心分开，并通过 MCP 发现外部工具，方便按需要扩展能力。

项目仍在持续迭代。代码、使用方法和完整功能列表见 **[MewCode 仓库 →](https://github.com/8aus1R/MewCode)**。

---

<div align="center">

<img src="https://github-readme-stats.vercel.app/api?username=8aus1R&show_icons=true&theme=github_dark&hide_border=true&include_all_commits=true" alt="GitHub 统计数据" />

</div>

