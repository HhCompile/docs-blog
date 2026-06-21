# My Blog

基于 **Astro 6 + React 19 + Tailwind 4** 的个人博客。**SSR 渲染**、**零 JS 默认**、**Orama 全文搜索**、**AI 问答（本地大模型 RAG）**、**错误监控后台**、**支持自动发布到 CSDN/掘金**。

## ✨ 核心特性

- 🏆 **SEO 天花板**：sitemap、RSS、JSON-LD、canonical、OG、Twitter Card
- ⚡ **极致性能**：Astro Islands 架构，按需水合，文章页默认 0 JS
- 🔍 **全文搜索**：Orama 客户端索引，`⌘K` 唤起命令面板，中英文加权
- 🤖 **AI 问答**：基于 LM Studio + RAG（向量检索博客内容），文章页右下角浮窗
- 🧠 **多轮对话**：AI 助手按文章隔离持久化（localStorage，7 天 TTL）
- 🏷️ **全局标签管理**：`src/data/tags.json` 集中配置，zod 严格校验引用
- 📤 **一键分发**：自动发布到 CSDN / 掘金
- 🛡️ **错误监控**：客户端 4 类错误捕获 + 后台查看 + 内存索引常驻
- 🌗 **深色模式** + 📱 **完全响应式** + 🔒 **CSP / X-Frame-Options / 限流**

## 🛠️ 技术栈

| 用途 | 选型 |
| --- | --- |
| 框架 | Astro 6 (SSR + Node standalone) |
| 交互岛 | React 19 |
| 样式 | Tailwind 4 (`@tailwindcss/vite`) |
| 搜索 | Orama 3.1（客户端） |
| 内容 | MD/MDX + Zod 4 Schema（严格 tag 引用） |
| AI | LM Studio (OpenAI 兼容) + RAG（向量检索 + 关键词降级） |
| 错误监控 | 文件日志 + 内存索引 + Admin 后台 |
| 鉴权 | HMAC-SHA256 session + 内存限流 |
| 包管理 | pnpm |

## 🚀 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 启动 LM Studio（可选，AI 功能需要）

1. 下载 [LM Studio](https://lmstudio.ai/)
2. 在搜索栏下载一个模型（推荐 `Qwen2.5-7B-Instruct-GGUF`）
3. 切换到 **Developer** 标签 → 点击 **Start Server**
4. 默认服务地址：`http://localhost:1234/v1`

### 3. 配置环境变量

```bash
cp .env.example .env
# 必填：SITE_URL / SITE_TITLE / ADMIN_PASSWORD / ADMIN_SECRET
```

**生成 admin 签名密钥**（必须，否则 `/admin` 登录按钮 disabled）：

```bash
echo "ADMIN_SECRET=$(openssl rand -base64 32)" >> .env
```

### 4. 启动开发服务器

```bash
pnpm dev
# → http://localhost:4321
```

**注意**：搜索索引（`dist/client/search-index.json`）和 RAG embedding（`dist/client/blog-embeddings.json`）都需要先 `pnpm build` 才会生成。开发模式下搜索/AI 会提示"请先运行 pnpm build"。

### 5. 生产构建

```bash
pnpm build
# 完整流程：astro build → search 索引 → embedding 索引（可选）→ summaries（可选）
```

构建产物在 `dist/`，RAG 索引和搜索索引在 `dist/client/`。

### 6. 启动生产服务

```bash
pnpm start
# → http://localhost:4321 (默认)
```

## ⌨️ 键盘快捷键

| 快捷键 | 功能 |
| --- | --- |
| `⌘/Ctrl + K` | 唤起全文搜索（命令面板） |
| `↑ / ↓` | 搜索结果导航 |
| `↵` | 打开当前选中项 |
| `ESC` | 关闭浮层 |

## 📁 项目结构

```
blog/
├─ src/
│  ├─ components/
│  │  ├─ BaseHead.astro           # SEO <head> + JSON-LD + OG/Twitter Card
│  │  ├─ BaseLayout.astro         # 全局布局
│  │  ├─ Header.astro / Footer.astro
│  │  ├─ Icon.astro / Icon.tsx    # 双端统一图标组件（lucide-react）
│  │  ├─ GithubIcon.astro         # 自绘 GitHub SVG（绕过 lucide deprecated）
│  │  ├─ PostCard.astro / Tag.astro / TagFilter.tsx
│  │  ├─ PostListFilter.tsx       # 列表 + 标签筛选 + 搜索（React 岛）
│  │  ├─ PostAIAssistant.tsx      # 文章页 AI 助手（多轮 + 持久化）
│  │  ├─ AISummary.tsx            # AI 摘要（构建时优先 + 运行时兜底）
│  │  ├─ RelatedPosts.astro / PostNavigation.astro
│  │  ├─ TableOfContents.astro    # 右侧吸顶 TOC
│  │  └─ SearchProvider.astro     # Orama 命令面板
│  ├─ content/posts/              # 博客文章（MD/MDX）
│  ├─ data/
│  │  ├─ site.config.mjs          # 站点元数据（site_url / title / author）
│  │  ├─ tags.json                # 标签元数据（单一真源，zod 引用）
│  │  └─ tag-helpers.ts
│  ├─ layouts/
│  │  ├─ BaseLayout.astro
│  │  └─ SearchProvider.astro
│  ├─ lib/
│  │  ├─ admin-auth.ts            # HMAC-SHA256 session + 常数时间比较
│  │  ├─ error-store.ts           # 错误日志（文件 + 内存索引）
│  │  ├─ client-ip.ts             # 真实 IP 解析（X-Forwarded-For 等）
│  │  ├─ rate-limit.ts            # 滑动窗口限流
│  │  ├─ lmstudio.ts              # LM Studio 统一配置 + lmFetch/lmGet
│  │  ├─ chunker.ts               # 文章切片器（RAG 用）
│  │  └─ reading-time.ts          # 中英文阅读时间估算
│  ├─ pages/
│  │  ├─ index.astro / about.astro / archive.astro / 404.astro
│  │  ├─ posts/index.astro + [slug].astro
│  │  ├─ tags/index.astro + [tag].astro
│  │  ├─ admin/                   # 后台（middleware 鉴权）
│  │  │  ├─ login.astro + login.post.ts
│  │  │  ├─ logout.ts
│  │  │  └─ errors/index.astro + api/{clear,delete}.ts
│  │  ├─ api/
│  │  │  ├─ chat.ts               # AI 流式问答（SSE + 限流 + 输入校验）
│  │  │  ├─ summarize.ts          # AI 摘要（缓存 + 限流 + 输入校验）
│  │  │  └─ errors/report.ts      # 客户端错误上报
│  │  ├─ rss.xml.ts / robots.txt.ts
│  │  └─ middleware.ts            # /admin 鉴权 + CSP 安全头 + 错误捕获
│  ├─ scripts/
│  │  ├─ client-errors.ts         # 4 类客户端错误捕获
│  │  └─ code-copy.ts             # 代码块复制按钮
│  ├─ styles/global.css
│  └─ content.config.ts           # Zod 4 Schema（严格 tag 枚举）
├─ scripts/                       # 构建脚本
│  ├─ build-embeddings.mjs        # 生成 blog-embeddings.json
│  ├─ build-summaries.mjs         # 生成 .cache/summaries.json
│  ├─ build-search-index.mjs      # 生成 search-index.json（Orama）
│  └─ publish.mjs                 # CSDN / 掘金自动发布
├─ public/
├─ astro.config.mjs
├─ tsconfig.json
├─ package.json
└─ .env.example
```

## 🤖 AI 问答（本地大模型 + 向量检索 RAG）

### 工作原理

```
[构建时]
src/content/posts/*.md
  ↓ chunker (500-800 字每片)
文章切片
  ↓ LM Studio /v1/embeddings
向量索引 (dist/client/blog-embeddings.json)

[运行时]
用户提问
  ↓ POST /api/chat（限流 60s/20 次 + 输入校验）
LM Studio embedding API → 查询向量
  ↓
余弦相似度 top-K（RAG_TOP_K，默认 4）
  ↓
拼到 system prompt（带文章链接）
  ↓
SSE 流式调用 LM Studio LLM
  ↓
前端打字机渲染 + 来源参考
```

### 配置 LM Studio

1. 下载 [LM Studio](https://lmstudio.ai/)
2. **加载两个模型**（可同时挂载）：
   - 对话模型：`Qwen2.5-7B-Instruct-GGUF`（推荐中文）
   - Embedding 模型：`text-embedding-nomic-embed-text-v1.5`（推荐）
3. Developer → Start Server
4. 默认服务地址：`http://localhost:1234/v1`

### 配置 .env

```bash
# LLM（用于对话）
LMSTUDIO_BASE_URL=http://localhost:1234/v1
LMSTUDIO_API_KEY=lm-studio
LMSTUDIO_MODEL=qwen2.5-7b-instruct

# Embedding（用于 RAG 向量检索，可在远程电脑）
EMBEDDING_BASE_URL=                         # 留空 = 复用 LMSTUDIO_BASE_URL
EMBEDDING_API_KEY=                          # 留空 = 复用 LMSTUDIO_API_KEY
EMBEDDING_MODEL=text-embedding-nomic-embed-text-v1.5

# RAG 调参
RAG_TOP_K=4
RAG_MIN_SCORE=0.3                           # 余弦相似度阈值
```

> 💡 留空 `EMBEDDING_MODEL` 自动降级到关键词检索，仍可工作但召回率低。
> 💡 LLM 和 Embedding 可在不同机器上：LLM 跑本机，Embedding 跑远程。

### 生成 embedding 索引

```bash
# 手动触发
pnpm embed

# pnpm build 会自动调用（已配置）
pnpm build
```

### 推荐模型

| 用途 | 模型 | 大小 | 备注 |
| --- | --- | --- | --- |
| **LLM** | Qwen2.5-7B-Instruct-GGUF | ~5GB | 中文最佳 |
| LLM | Qwen2.5-3B-Instruct-GGUF | ~2.5GB | 速度快 |
| LLM | DeepSeek-R1-Distill-Qwen-7B | ~5GB | 推理强 |
| **Embedding** | text-embedding-nomic-embed-text-v1.5 | ~270MB | 英文最佳 |
| Embedding | text-embedding-bge-m3 | ~600MB | 中英双优 |

8GB 显存建议 7B 量化 LLM + 任意 embedding。

### 健康检查

```bash
# 启动 server 后
curl http://localhost:4321/api/chat | jq
```

返回示例：

```json
{
  "llm": { "ok": true, "models": ["qwen2.5-7b-instruct"] },
  "embedding": { "ok": true, "model": "text-embedding-nomic-embed-text-v1.5", "dimension": 768 },
  "index": { "chunks": 28, "model": "...", "dim": 768 }
}
```

### 降级策略

- ✅ Embedding 模型未加载 → 自动降级到关键词检索
- ✅ LM Studio 离线 → 前端显示横幅，不影响阅读
- ✅ 索引文件不存在 → 跳过 RAG，模型凭自身知识回答

### 自定义 prompt

编辑 `src/pages/api/chat.ts` 中的 `buildSystemPrompt()` 函数。

## 🤖 AI 文章摘要（双策略）

**工作流程**：
1. `pnpm build` 时调 LLM 为每篇文章生成 100-200 字摘要
2. 写入 `.cache/summaries.json`（已加入 .gitignore）
3. 文章页 SSG 阶段读取缓存作为 `initialSummary` 传入组件
4. 用户首次访问时直接展示（**0 延迟**）
5. 用户点击"重新生成" → POST `/api/summarize`（限流 60s/5 次）→ 实时调 LLM + 写回缓存
6. LLM 离线时组件显示降级提示，不影响阅读
7. localStorage 二级缓存（30 天 TTL），刷新页面不重发请求

**手动触发**：
```bash
# 重新生成所有摘要
SUMMARY_FORCE=true pnpm summaries

# 只生成缺失的
pnpm summaries
```

## 🔍 全文搜索（Orama）

### 工作原理

- `pnpm search:build` 时 Orama 创建索引（schema: title/description/tags/content）
- 写入 `dist/client/search-index.json`
- 前端按需懒加载 Orama + 索引（~30KB）
- 搜索在客户端执行，多字段加权（title 3 > description 2 = tags 2 > content 1）
- 命中关键字高亮、关键词摘要片段

### 自定义

- 调整 `scripts/build-search-index.mjs` 中的字段权重
- 修改 `src/layouts/SearchProvider.astro` 中的 UI 与快捷键

## 🛡️ 错误监控后台

`/admin` 提供错误查看界面（middleware 鉴权，HMAC-SHA256 session）：

- 4 类错误：`server`（中间件捕获）/ `api` / `client`（前端上报）/ `resource`（404）
- 内存索引（最近 200 条常驻）→ 列表查询不读盘
- 磁盘上限 5000 条 / 5MB（超出自动淘汰最旧 1000 条）
- 真实 IP 解析（X-Forwarded-For / X-Real-IP / CF-Connecting-IP，需 `TRUST_PROXY=true`）
- 统计卡片、按级别筛选、关键词搜索、分页

**配置**（必须）：

```bash
ADMIN_PASSWORD=至少 4 位
ADMIN_SECRET=至少 16 位
```

## 🏷️ 标签系统

### 配置

编辑 `src/data/tags.json`（单一真源）：

```json
[
  { "id": "react", "name": "React", "color": "#61DAFB", "description": "..." }
]
```

### 在文章中引用

```markdown
---
title: 我的文章
tags:
  - react
  - tutorial
---
```

`content.config.ts` 用 `z.enum(VALID_TAG_IDS)` 严格校验——引用未定义的 tag ID 会**构建失败**。

### 添加新标签

1. 追加到 `src/data/tags.json`
2. 在文章中用 `id` 引用
3. 自动出现在标签云和筛选器中 ✅

## 📤 自动发布到 CSDN/掘金

```bash
# 配置 .env
CSDN_COOKIE=...
JUEJIN_COOKIE=...
JUEJIN_CATEGORY_ID=...

# 预览
pnpm publish:dry-run

# 实际推送
pnpm publish
```

通过 `frontmatter` 中的 `publish: { csdn: true, juejin: true }` 标记要发布的文章。

## 🚢 部署

### Vercel / Railway / Render / Fly.io

```bash
# 构建命令
pnpm install && pnpm build

# 启动命令
pnpm start
```

### 自托管（Docker）

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 4321
CMD ["node", "dist/server/entry.mjs"]
```

### 反向代理后部署（推荐）

启用真实 IP 解析（在 Nginx/Caddy/Cloudflare 后必须）：

```bash
TRUST_PROXY=true
```

## 🔧 个性化清单

| 用途 | 文件 |
| --- | --- |
| 站点信息 | `src/data/site.config.mjs` |
| 标签元数据 | `src/data/tags.json` |
| 主题色 | `src/styles/global.css` |
| 导航栏 | `src/components/Header.astro` |
| AI 模型与提示词 | `src/pages/api/chat.ts` → `buildSystemPrompt` |
| 搜索字段权重 | `src/layouts/SearchProvider.astro` |

## 🔒 安全说明

本项目已实施：

- ✅ **CSP 响应头**（middleware 注入，限制 connect-src 到 LM Studio）
- ✅ **X-Frame-Options: DENY**（防点击劫持）
- ✅ **X-Content-Type-Options: nosniff**（防 MIME 嗅探）
- ✅ **Referrer-Policy**（跨域请求只带 origin）
- ✅ **输入校验**（chat ≤50 条/单条 8KB，summarize content ≤20KB）
- ✅ **API 限流**（chat 60s/20 次，summarize 60s/5 次）
- ✅ **Admin 鉴权**（HMAC-SHA256 + 常数时间比较 + fail-secure）
- ✅ **真实 IP 解析**（启用 TRUST_PROXY 后）
- ✅ **session cookie**：HttpOnly + SameSite=Strict + Secure (production)

部署前请确认：

- `.env` 已配置 `ADMIN_PASSWORD` + `ADMIN_SECRET`（至少 16 位）
- 生产环境部署在反代后时设置 `TRUST_PROXY=true`
- **不要**在生产用 LM Studio 默认 `lm-studio` 密钥（LM Studio 默认无鉴权，部署到公网必须加鉴权层）

## 📜 许可证

MIT
