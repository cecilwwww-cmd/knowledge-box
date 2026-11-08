# 知识箱 · Knowledge Box

个人本地知识收纳与整理工具：左侧目录树，右侧编辑区；支持拖入图文 + 汇总提示词，生成可编辑思维导图与详细内容。

## 功能

- Obsidian 风格目录树；悬停可快捷打开「思维导图 / 详细内容」
- 整理条：拖入原料、填写提示词、一键整理
- 节点三视图：原料 / 导图 / 详情
- AI 先预览再写入，写入前自动快照
- 默认使用 DeepSeek `deepseek-flash` **识图模型**（原图 + 示意图理解）
- 数据存本机浏览器 IndexedDB；可导出 JSON 备份

## 开发

```bash
npm install
cp .env.example .env.local   # 填入你的 DeepSeek Key
npm run dev
```

识图模型名必须是 `deepseek-flash`（不是 `deepseek-chat`）。打开「发送原图给模型」后，整理时会把图片以 `image_url` 发给 API。

## 让所有用户共用你的 DeepSeek API

1. 在 GitHub 仓库 → Settings → Secrets and variables → Actions  
   - Secret：`VITE_API_KEY` = 你的 DeepSeek Key  
   - Variables（可选）：`VITE_MODEL_NAME=deepseek-flash`、`VITE_LOCK_API_SETTINGS=true`
2. 推送 `main` 触发 Pages 部署后，终端用户无需自填 Key，默认走识图。

说明：Key 会打进前端包，懂行的人仍可能从 JS 里挖出。正式对外建议再加一层你自己的代理服务隐藏 Key。

## 技术栈

Vite · React · TypeScript · Dexie · Vditor · Mind-elixir · Tailwind CSS
