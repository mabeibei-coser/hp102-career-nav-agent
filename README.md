# HP102 职业导航智能体

这是一个对话式职业导航助手：在一个聊天窗口里完成就业档案、8 题职业偏好测评、4 题访谈，生成 5 模块职业导航报告，并可继续追问。
面向上海市黄浦区线上就促中心的求职者（应届毕业生、一般社会求职者），业务口径沿用 A300 职业导航。

维护入口：[维护经验与问题索引](docs/maintenance-experience.md)；实施计划：[docs/plan](docs/plan/README.md)。

## 本地运行

1. `npm install`
2. 复制 `.env.example` 为 `.env.local` 并填写（见 docs/plan/02-技术方案.md §4；`BANANAROUTER_API_KEY` 由项目负责人提供）
3. `npm run dev`，打开 http://localhost:3000

## 检查

`npm run lint`、`npm run typecheck`、`npm test`、`npm run build`、`npm run test:e2e`
