# 知识箱 · Knowledge Box

个人本地知识收纳与整理工具：左侧目录树，右侧编辑区；支持拖入图文 + 汇总提示词，生成可编辑思维导图与详细内容。

## 功能

- Obsidian 风格目录树；悬停可快捷打开「思维导图 / 详细内容」
- 整理条：拖入原料、填写提示词、一键整理
- 节点三视图：原料 / 导图 / 详情
- AI 先预览再写入，写入前自动快照
- 数据与 API Key 仅存本机浏览器 IndexedDB
- 一键导出 JSON 备份

## 开发

```bash
npm install
npm run dev
```

打开终端提示的本地地址即可。在右上角设置中填写兼容 OpenAI 的 `Base URL`、`API Key`、模型名。

## 技术栈

Vite · React · TypeScript · Dexie · Vditor（Markdown 即时渲染）· Mind-elixir · Tailwind CSS
