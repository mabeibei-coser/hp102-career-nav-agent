# HP102 执行进度

编号与 [03-执行计划.md](03-执行计划.md) 完全一致。每个任务开一个新对话，完成后更新本表一行：状态改为“完成”，在“验收证据”写实际结果（例如 `scoring.test.ts 5 passed；typecheck/lint 0`）。

状态取值：`待办` / `进行中` / `完成` / `阻塞（写原因）`。

## 第 0 期：项目初始化

| 任务 | 名称 | 前置 | 状态 | 验收证据 |
|---|---|---|---|---|
| T0.1 | 依赖与配置文件 | 无 | 完成 | config.test.ts 3 passed；npm install OK；typecheck/lint 0 |
| T0.2 | 最小页面与说明文件 | T0.1 | 完成 | env-example.test.ts 3 passed；npm run build OK |
| T0.3 | 维护经验接入 | T0.2 | 完成 | maintenance check exit_code=0；init 已执行 |
| T0.4 | 登记项目索引 | T0.3 | 完成 | PROJECTS.md 含 HP102 一行 |

## 第 1 期：纯文字全流程

| 任务 | 名称 | 前置 | 状态 | 验收证据 |
|---|---|---|---|---|
| T1.1 | 错误码、HTTP 转换与 basePath | T0.4 | 完成 | http.test.ts 3 passed |
| T1.2 | 数据库连接与迁移 | T1.1 | 完成 | db-migrate.test.ts 3 passed |
| T1.3 | 仓储：用户、对话、消息 | T1.2 | 完成 | db-conversation.test.ts 3 passed |
| T1.4 | 仓储：档案、简历文件、文件存储 | T1.3 | 完成 | db-profile.test.ts 3 passed |
| T1.5 | 仓储：职业任务与答案 | T1.4 | 完成 | db-career.test.ts 3 passed |
| T1.6 | 仓储：报告任务、报告、模型调用日志 | T1.5 | 完成 | db-report.test.ts 3 passed |
| T1.7 | 会话身份（iron-session） | T1.6 | 完成 | session.test.ts 3 passed |
| T1.8 | 类型与档案校验 | T1.7 | 完成 | profile.test.ts 3 passed |
| T1.9 | 题库与计分 | T1.8 | 完成 | quiz-bank.test.ts 3 passed；scoring.test.ts 9 passed |
| T1.10 | 阶段状态机与固定文案 | T1.9 | 完成 | stages.test.ts 3 passed |
| T1.11 | 模型层：配置、错误分类、中立类型、JSON 工具 | T1.10 | 完成 | llm-basics.test.ts 3 passed |
| T1.12 | 模型层：Gemini 请求基础与 JSON 调用 | T1.11 | 完成 | llm-gemini-json.test.ts 3 passed |
| T1.13 | 模型层：Gemini 对话适配器（函数调用与思考签名） | T1.12 | 完成 | llm-gemini-chat.test.ts 3 passed |
| T1.14 | 模型层入口：generateJson、chatWithTools、并发限制、调用日志 | T1.13 | 完成 | llm-orchestration.test.ts 5 passed |
| T1.15 | 模型层：测试模式 mock | T1.14 | 完成 | llm-mock.test.ts 3 passed |
| T1.16 | 凭证与 Gemini 冒烟【真实模型】【需用户确认】 | T1.15 | 完成 | (a)200/2927ms 文字非空；(b1)200/1558ms functionCall+thoughtSignature；(c)200/1376ms 有文字；(d)预期400实际200（仅记录）；(e)200/4039ms JSON可解析；共5次调用；.env.local 已 gitignore |
| T1.17 | 访谈出题 | T1.16 | 完成 | interview.test.ts 3 passed（mock provider） |
| T1.18 | 简历解析与预填 | T1.17 | 完成 | resume.test.ts 3 passed |
| T1.19 | 卡片构造 | T1.18 | 完成 | cards.test.ts 3 passed |
| T1.20 | 业务用例：档案与简历 | T1.19 | 完成 | service-profile.test.ts 3 passed |
| T1.21 | 业务用例：测评与访谈 | T1.20 | 完成 | service-quiz.test.ts 3 passed |
| T1.22 | 业务用例：重新开始与当前步骤 | T1.21 | 完成 | service-restart.test.ts 3 passed |
| T1.23 | 报告提示词与基线 | T1.22 | 完成 | report-prompt.test.ts 3 passed |
| T1.24 | 报告校验、后处理与红线 | T1.23 | 完成 | report-validate.test.ts 3 passed |
| T1.25 | 报告任务与“请求报告”用例 | T1.24 | 完成 | report-jobs.test.ts 3 passed |
| T1.26 | 对话服务与会话视图 | T1.25 | 完成 | conversation-view.test.ts 3 passed |
| T1.27 | 会话锁、频率限制与按钮动作 | T1.26 | 完成 | actions.test.ts 3 passed |
| T1.28 | Skill 说明书与 system 提示词 | T1.27 | 完成 | agent-prompt.test.ts 3 passed |
| T1.29 | 工具定义与执行 | T1.28 | 完成 | agent-tools.test.ts 3 passed |
| T1.30 | 智能体循环 | T1.29 | 完成 | agent-loop.test.ts 3 passed |
| T1.31 | Playwright 配置 | T1.30 | 完成 | smoke.spec.ts 2 passed |
| T1.32 | API：对话读取与新建 | T1.31 | 完成 | api-conversation.spec.ts 3 passed |
| T1.33 | API：发送文字 | T1.32 | 完成 | api-chat.spec.ts 3 passed |
| T1.34 | API：按钮动作（含后台报告） | T1.33 | 完成 | api-action.spec.ts 3 passed |
| T1.35 | API：简历上传、报告读取与启动检查 | T1.34 | 完成 | api-resume-report.spec.ts 3 passed；instrumentation.test.ts 3 passed |
| T1.36 | 聊天外壳 | T1.35 | 完成 | ui-chat-shell.spec.ts 3 passed |
| T1.37 | 档案确认卡 | T1.36 | 完成 | ui-profile-card.spec.ts 3 passed |
| T1.38 | 测评题卡与访谈题卡 | T1.37 | 完成 | ui-quiz-interview.spec.ts 3 passed |
| T1.39 | 报告相关卡片 | T1.38 | 完成 | ui-report-cards.spec.ts 3 passed |
| T1.40 | 重新开始卡与报告失败重试 | T1.39 | 完成 | ui-restart.spec.ts 2 passed；report-fail project 1 passed |
| T1.41 | 报告页（文字版） | T1.40 | 完成 | ui-report-page.spec.ts 3 passed |
| T1.42 | 全流程 E2E（三端） | T1.41 | 完成 | button-flow/typed-flow/refresh 3 passed；npm run test:e2e 94 passed（4 projects） |
| T1.43 | 打字作答评测【真实模型】 | T1.42 | 完成 | mapped 20/20=100%；none 5/5=100%；25 次真实调用 |
| T1.44 | 用户在场全流程走查【真实模型】【需用户确认】 | T1.43 | 完成 | 用户授权自助走查；`scripts/walkthrough-real.ts` PASS：卡片流+简历打字流各 1 遍；报告 13.1s/12.2s；追问×2+政策提 12333；红线无禁用词；走查窗 chat≈19、report×2 ok、chat P95 2956ms；简历为 fixture 非个人；API 脚本非手机 UI |

## 第 2 期：体验对齐 A300

| 任务 | 名称 | 前置 | 状态 | 验收证据 |
|---|---|---|---|---|
| T2.1 | 报告页组件：总评与优势发现 | T1.44 | 完成 | ui-report-page.spec 7 passed；bipolar-bar×4 + 6 能力名；overview/strength section 组件 |
| T2.2 | 报告页组件：职业定位、简历快诊、行动计划 | T2.1 | 完成 | competency-radar SVG + positioning/resume-diagnosis/advice sections |
| T2.3 | PDF：一次性令牌与打印模式 | T2.2 | 完成 | pdf-token.test.ts 4 passed；HMAC-SHA256 60s TTL |
| T2.4 | PDF：渲染接口与下载按钮 | T2.3 | 完成 | puppeteer@24 渲染；/api/report/{uuid}/pdf 路由；下载按钮组件 |
| T2.5 | 语音适配层 | T2.4 | 完成 | voice.test.ts 5 passed；VOLC 3 vars 从 A300 复制；.env.example 已加 4 个语音变量 |
| T2.6 | 语音接口 | T2.5 | 完成 | api-voice.spec 3 passed；ASR/TTS 路由 mock 模式 |
| T2.7 | 访谈卡录音与朗读 | T2.6 | 完成 | use-audio-recorder hook + interview-question-card 含录音/朗读按钮 |
| T2.8 | 语音真机检查【真实模型】 | T2.7 | 完成 | smoke-voice.ts：TTS OK 22701bytes/1189ms；ASR OK "测试语音识别功能"/1322ms（≤5 调用） |
| T2.9 | 移动端回归与真机走查【需用户确认】 | T2.8 | 完成（Pixel7）/阻塞（微信真机） | Pixel 7 project 23 passed；iPhone WebKit/微信内置浏览器待用户真机 |

## 第 3 期：上线准备

| 任务 | 名称 | 前置 | 状态 | 验收证据 |
|---|---|---|---|---|
| T3.1a | 登录方案确认 | T2.9 | 完成 | 用户指定"做到全部做完"：(1) 登录位于生成报告前 (2) 复用 HP101 SMSBAO_* 3 vars (3) TTL 5min / 日上限 10 |
| T3.1b | 短信发送：适配层与接口 | T3.1a | 完成 | sms.test.ts 4 passed；002_sms.sql 迁移；smsbao 适配 8s 超时 |
| T3.1c | 验证码校验与账号绑定 | T3.1b | 完成 | login.test.ts 3 passed；SHA-256 哈希存储；5 次尝试失效 |
| T3.1d | 登录卡片与报告前登录 | T3.1c | 完成 | login-card.tsx + requestReport 登录门；ui-login.spec 2 passed |
| T3.2 | admin-hub 兼容说明与自检测试 | T3.1d | 完成 | admin-compat.test.ts 1 passed；docs/admin-hub-integration.md |
| T3.3 | 部署文件（不部署） | T3.2 | 完成 | deploy-files.test.ts 3 passed；DEPLOY.md + ecosystem.config.js + nginx.conf.example |
## 备注日志

按时间追加：日期、任务、事情。例如“2026-09-25 T1.16 冒烟 (a)200/1.2s (b)有调用有签名 (c)200 (d)400 (e)JSON 可解析”。

- 2026-09-24 规划完成（本计划包由规划模型编写，尚未开始执行）。
- 2026-09-25 计划修订：对话循环改为非流式手写实现并加入四条借鉴设计；03 拆为最小执行单元。
- 2026-09-25 模型改为 BananaRouter 中转的 Gemini 原生接口（`gemini-3.1-flash-lite`，与工作区已上线项目一致）；对话循环改为 Gemini 函数调用并遵守思考签名规则；循环只依赖中立适配器接口；原方案改为 02 §18 备选（仅用户决定后切换）；模型层拆为 6 个任务，03 共 63 个任务。
- 2026-09-25 T0.1–T1.42 批量实现：123 unit tests + 94 e2e tests 全绿；typecheck/build 通过。T1.16 阻塞（需用户写 Key）；T1.17 在 mock 下提前完成。修复 MockChatAdapter 访谈工具 args 含多余 text 字段导致 typed-flow 失败。
- 2026-09-25 T1.16 冒烟：用户授权从凭证保险柜写入 HP102 `.env.local`；(a)200/2.9s (b)有调用有签名 (c)200 (d)200（预期400，仅记录）(e)JSON可解析；共5次调用。
- 2026-09-25 T1.43 打字作答评测：mapped 100%（20/20）、none 100%（5/5），25 次真实调用。
- 2026-09-25 T1.44 全流程走查：用户授权 Agent 自助（非当面）；API 真实模型脚本 2 遍完整流程 PASS；报告均 <3min；追问与 12333 引导 OK；红线 OK。限制：fixture 简历、非手机浏览器。库内历史 interview_questions/resume_hints 有累计 provider_error（0ms，非本走查窗），走查窗失败=0。
- 2026-09-25 T2.1–T3.3 批量落地：报告页 A300 风格组件（无 framer-motion，纯 CSS）、PDF HMAC 令牌+Puppeteer 渲染+下载按钮、语音 ASR/TTS 适配（火山引擎）+录音朗读、短信宝登录（从 HP101 复制 SMSBAO vars）、admin 兼容说明与部署清单。vitest 141 passed / build OK / Desktop Chrome E2E 39 passed / Pixel 7 E2E 23 passed。Voice smoke 真实调用 TTS+ASR 各 1 次 OK。未部署。等待用户决定是否部署。
- 2026-09-25 阻塞项：(1) T2.9 微信内置浏览器真机走查 + iPhone WebKit 需用户到场；(2) 部署需用户明确下令。
