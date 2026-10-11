# Lumen Close Reading

Lumen 是一个面向英语精读的开源 Web 应用。粘贴英文文章后，可以查询单词和词组、分析长难句、收藏学习内容，并按掌握状态复习词汇。

## 功能

- 粘贴英文文章并自动生成标题、词数、预计阅读时间和主题标签
- 单词与词组的英文释义、中文释义、音标及原文例句
- 英式与美式发音（使用浏览器语音合成）
- 中文长难句分析：翻译、句子逻辑、主干、结构与解析
- 收藏单词、词组和句子，在原文中高亮显示
- 将词汇标记为“认识”“不认识”或“未复习”，并按状态筛选
- 阅读历史和跨设备收藏（部署时启用 D1 数据库）
- 响应式手机端布局；窄屏下分析结果以移动端抽屉显示

## 技术栈

- React 19 + TypeScript
- Vinext / Vite / Cloudflare Workers
- Cloudflare D1 + Drizzle ORM
- DeepSeek API（通过独立的服务端代理调用）

## 本地运行

要求 Node.js 22.13 或更高版本。

```bash
npm install
copy .env.example .env.local
npm run dev
```

打开 `http://localhost:3000`。在 macOS 或 Linux 上，将第二条命令改为 `cp .env.example .env.local`。

## 配置 AI 服务

为避免将 DeepSeek API Key 暴露给浏览器，项目使用 `vercel-proxy/` 中的服务端代理：

1. 将 `vercel-proxy/` 部署为一个 Vercel 项目。
2. 在 Vercel 中配置 `DEEPSEEK_API_KEY`、`LUMEN_PROXY_TOKEN`，可选配置 `DEEPSEEK_MODEL`。
3. 在 Lumen 的服务端环境中配置 `DEEPSEEK_PROXY_URL` 和相同的 `DEEPSEEK_PROXY_TOKEN`。

完整说明见 [`vercel-proxy/README.md`](vercel-proxy/README.md)。不要把真实密钥提交到 Git。

## 构建与测试

```bash
npm run build
npm test
```

## 部署

项目可部署到支持 Cloudflare Workers 和 D1 的平台。`.openai/hosting.json` 不包含原作者的 Site ID；使用 OpenAI Sites 部署时，平台会为你的副本写入自己的项目 ID。

如果只想本地试用，文章和学习记录会保存在浏览器本地；启用 D1 后可保存阅读历史及收藏内容。

## 手机端

界面在宽度小于 760px 时切换为单列布局：正文与分析面板上下排列、固定侧栏自动解除、收藏卡片和复习按钮适配窄屏。建议在手机浏览器中使用最新版本的 Chrome、Edge 或 Safari。

## 隐私

- API Key 和代理令牌只应存在于部署平台的服务端环境变量中。
- 浏览器本地保存的数据不会自动上传到 GitHub。
- 请勿将 `.env.local` 或任何真实密钥提交到仓库。

## License

[MIT](LICENSE)
