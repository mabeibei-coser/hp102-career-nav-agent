# HP102 职业导航智能体 — Agent 操作说明

- 开始前必读：[Coding 共用规则](../AGENTS.md)、[维护经验索引](docs/maintenance-experience.md)、[实施计划](docs/plan/README.md)。结束前按 [共用检查说明](../.gstack/maintenance/README.md) 实际执行 check / close。
- 这是 Next.js 16：写 Next 相关代码前先读 `node_modules/next/dist/docs/` 对应章节。

## 一句话
单一对话窗口完成 A300 职业导航全流程（档案 → 8 题测评 → 4 题访谈 → 5 模块报告 → 追问）。Next.js 16 + SQLite + 用原生 fetch 手写的 Gemini 函数调用循环（经 BananaRouter，不用任何模型 SDK 或智能体框架）。

## 动手红线
- A300、A500、HP101 只读，不在运行时依赖它们。
- 分层：业务规则只在 `lib/career/`；SQL 与文件只在 `lib/db/`；模型调用只在 `lib/llm/`；API 路由保持轻薄；智能体循环只依赖中立适配器接口。
- 分数、档案、报告、文件路径、userId 不接受客户端或模型传入。
- 只用 BananaRouter 中转的 Gemini 原生接口 `generateContent`，模型取自 `BANANAROUTER_MODEL`；三个 `BANANAROUTER_*` 变量缺一个就启动报错，没有默认值；禁止使用 BananaRouter 的 OpenAI 兼容端点。
- 没有兜底模型；切换服务商只能由用户决定（docs/plan/02 §18）。
- 调用工具时必须把模型返回的 content 原样（含 thoughtSignature）追加回本轮 contents，再追加一条包含全部 functionResponse 的 user 消息。
- 模型失败不得用假内容顶替；mock 只在 `E2E_MOCK_MODE=true` 的测试里。
- 回复非流式、接口返回普通 JSON，不用 SSE。
- 确认档案、生成报告、确认重新开始只能由用户点卡片按钮触发。
- 测试只用 mock；真实模型调用只在计划标注【真实模型】的任务里执行。
- `.env.local`、`data/` 不提交；不打印密钥；不搜索或读取工作区凭证保险柜。
- 日志和 `llm_calls` 不记录 Key、提示词原文、简历正文、回复正文、思考签名。
- `NEXT_PUBLIC_BASE_PATH` 改值必须重新 build；客户端 fetch 一律用 `apiUrl()`。
- pm2 必须单实例。
- 不部署、不推送远端、不改 admin-hub，除非用户明确下令。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
