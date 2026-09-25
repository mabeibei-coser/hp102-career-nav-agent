# HP102 部署说明

## 前置条件

- Node.js >= 20.9.0
- PM2
- Chromium（Puppeteer 用于 PDF 渲染）

## 发布步骤

1. 拉取最新代码
2. 复制 `deploy/env.production.example` 为 `.env.local`，填写所有密钥
   - `BANANAROUTER_API_KEY`：由项目负责人按凭证中心流程提供
   - `SESSION_SECRET`：至少 32 字符的随机字符串
   - `SMSBAO_*`：短信宝凭证
   - `VOLC_*`：火山引擎语音凭证
3. `npm install --production`
4. `npm run build`
5. `pm2 start ecosystem.config.js`
6. nginx 配置参照 `deploy/nginx.conf.example`

## 端口

生产端口待部署时确认（默认 3102）。

## 发布工具

使用 `tencent-deploy` skill 执行标准发布流程。

## 注意

- PM2 必须单实例（`instances: 1`）
- `NEXT_PUBLIC_BASE_PATH` 改值后必须重新 build
- `.env.local` 和 `data/` 目录不提交
