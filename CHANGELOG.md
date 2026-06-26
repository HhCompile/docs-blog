# Changelog

本项目的所有重要变更都会记录在此文件。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [1.3.0](https://github.com/HhCompile/docs-blog/compare/docs-blog-v1.2.0...docs-blog-v1.3.0) (2026-06-26)


### Features

* 重写 about 页面为技术站定位 ([41131ff](https://github.com/HhCompile/docs-blog/commit/41131ffb3e92e9380abaf9b03dd6d41572106b9e))
* 首页升级为左 sidebar + masonry 卡片墙（借鉴 moewah） ([fd04232](https://github.com/HhCompile/docs-blog/commit/fd04232e7d411c91174ab9206a658f44b5939268))

## [1.2.0](https://github.com/HhCompile/docs-blog/compare/docs-blog-v1.1.0...docs-blog-v1.2.0) (2026-06-25)


### Features

* 优化页面布局解决左右空旷 ([e1d28ad](https://github.com/HhCompile/docs-blog/commit/e1d28ad5e68cfcd87f728983755fe957a6f2a201))
* 充实 PostSidebar 解决左侧下半空旷 ([a7ffc3b](https://github.com/HhCompile/docs-blog/commit/a7ffc3b7aa4a1639c3b83cf527b127761a23cb65))

## [1.1.0](https://github.com/HhCompile/docs-blog/compare/docs-blog-v1.0.0...docs-blog-v1.1.0) (2026-06-21)


### Features

* 发布 my-blog 1.0.0 稳定版本 ([baafc67](https://github.com/HhCompile/docs-blog/commit/baafc676aecab200e75dc2969b9be339f292bf73))
* 增加 docs/examples 目录到 .gitignore ([1ea7984](https://github.com/HhCompile/docs-blog/commit/1ea7984c1d1ed3f653770dfeae77945d30fdcdc1))
* 添加示例 feat commit 验证 release-please PR 生成 ([5e6b2f1](https://github.com/HhCompile/docs-blog/commit/5e6b2f125cc3e10e1cf2a433283fc21f854c8e09))
* 验证 release-please 权限修复后能开 PR ([9fb5ba5](https://github.com/HhCompile/docs-blog/commit/9fb5ba565b0ec8fbe0ce650ecd1dd7acc6473ea1))


### Bug Fixes

* **release-please:** 用 packages 包裹单包配置修复 path-split 0 问题 ([218d2f5](https://github.com/HhCompile/docs-blog/commit/218d2f5d04a358dda2e89ce29ef5de31f97990f3))

## [Unreleased]

### Planned
- PostCard 卡片 width/height 锁定（防 CLS 已加 min-height，需进一步加 `<img>` size hint）
- 错误日志按日期分桶（`errors-2026-06-21.jsonl`）
- `posts/index.astro` 阈值分页（>50 篇时改 `/posts/[page].astro`）

---

## [1.0.0] - 2026-06-21

首个稳定版本。从 0.x 系列的预发布状态毕业，全面重构到生产可用。

### ✨ Features

#### AI 能力
- **AI 助手多轮对话**：文章页 AI 浮窗支持多轮对话（`PostAIAssistant.tsx`）
  - 按文章 slug 隔离的 `localStorage` 持久化（7 天 TTL，每线程最多 30 条）
  - 流式回答 + 来源参考实时显示
  - 用户主动停止 / 错误时清理空 assistant 占位
  - 关闭再开历史仍在
- **AI 摘要双策略**：`AISummary.tsx` 构建时缓存优先 + 运行时 LLM 兜底
  - `localStorage` 二级缓存（30 天 TTL），刷新不重发
  - 写入失败时丢弃最旧 1/3，保留当前条目
- **RAG 向量检索**：`/api/chat` 流式 SSE + 向量检索 top-K
  - 余弦相似度阈值可配（`RAG_MIN_SCORE`）
  - 关键词降级（embedding 不可用时）
- **健康检查**：`/api/chat` GET 全量检查（LLM + embedding + 索引）
  - `HEAD /api/chat` 轻量存活检查（仅查索引存在性，不再触发 embedding）

#### 错误监控
- **Admin 后台**：`/admin` 错误日志查看界面
  - 4 类错误：`server` / `api` / `client` / `resource`（404）
  - 内存索引（最近 200 条常驻）→ 列表查询不读盘
  - 磁盘上限 5000 条 / 5MB（超出自动淘汰最旧 1000 条）
  - 统计卡片、按级别筛选、关键词搜索、分页
  - 客户端 4 类错误捕获（`window.onerror` / unhandledrejection / 资源加载失败）

#### 安全
- **API 限流**（`rate-limit.ts` 通用滑动窗口）
  - `/api/chat` POST：60s/20 次每 IP
  - `/api/summarize` POST：60s/5 次每 IP（摘要更重）
  - 内存实现，多实例部署需替换为 Redis
- **输入大小限制**（防 DoS）
  - `/api/chat`：≤50 条消息、单条 ≤8KB、总长 ≤32KB
  - `/api/summarize`：content ≤20KB、slug/title ≤200
- **Admin 鉴权升级**
  - `simpleHash` → `crypto.createHmac('sha256', ADMIN_SECRET)`
  - `timingSafeEqual` 替换循环比较
  - fail-secure：未配置 `ADMIN_SECRET` 时登录按钮 disabled
  - session cookie：`HttpOnly` + `SameSite=Strict` + `Secure` (production)
- **安全响应头**（middleware 注入）
  - `Content-Security-Policy`：限制 `connect-src` 到 LM Studio
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy`：禁用 camera/microphone/geolocation
- **真实 IP 解析**（`client-ip.ts`）
  - 支持 `X-Forwarded-For` / `X-Real-IP` / `CF-Connecting-IP`
  - 通过 `TRUST_PROXY=true` 启用，避免任意请求伪造 IP

#### 架构
- **LM Studio 统一配置**（`lib/lmstudio.ts`）
  - LLM 和 Embedding 独立配置（可指向远程电脑）
  - 暴露 `lmFetch` / `lmGet` 工具（自动注入 auth + JSON header）
  - 消除 chat/summarize 重复配置块
- **/admin 鉴权集中**
  - 页面/路由级守卫全部移除，改为 `middleware.ts` 路径前缀统一处理
  - API/资源请求 → 401；页面 → 重定向到登录

### 🐛 Bug Fixes

#### 构建错误（12 项）
- `lucide-react` 1.21.0 → 0.460.0：v1.x 缺失 `Github`/`Sitemap`/`Moon` 图标
  - `Sitemap` alias `Map`、`Moon` alias `Sun`、`text-search` 映射 `FileSearch`
- `rss.xml.ts`：补 `APIContext` 类型 + `context.site ?? siteConfig.site_url` 兜底
- `404.astro`：补 `import Icon`
- `countPostsByTag`：类型签名从 `{ tags?: string[] }[]` 改为 getter 形式，兼容 `CollectionEntry`
- `Icon.tsx` / `Icon.astro`：`Sun` import 重复 + `icon` 映射 `Sun` 重复
- `Orama 3.x` API：`persist`/`restore` → `save`/`load(orama, raw)`
- `Orama 3.x`：`create` / `save` 均为同步，去掉无用的 `await`
- `zod 4` deprecated：`z` 命名空间导入 → 具名导入 `import { z } from 'zod'`
- `zod 4` 配套：`package.json` 显式声明 `zod@^4.3.6`（脱 astro 间接依赖）
- `BaseHead.astro` JSON-LD script：加 `is:inline` 显式声明
- `build-search-index.mjs`：`save(db)` 真正用上（之前误删）
- `scripts/publish.mjs`：`tags` → `tags: _tags`（标记未用）
- `scripts/build-embeddings.mjs`：删未用 `TARGET` 常量

#### 内容/数据
- `PostCard.astro` 字数 bug：`post.body?.split(/\s+/).length` 对中文永远是 1
  - 改用 `calculateReadingTime`（中英分别按字符/单词数）
- `chunker.ts` 最后一片 offset 错误：cursor 未更新导致锚点指错位置
  - 改用 `cursor` 准确跟踪
- `tag` 引用静默丢失：未定义 tag ID 不报错
  - `content.config.ts` 加 `z.enum(VALID_TAG_IDS)` 严格校验
- `content/posts/*.md` 草稿泄漏风险已通过 `({ data }) => !data.draft` 过滤

#### 路由
- `/admin/login` 双重定义警告：`login.ts` → `login.post.ts`（用 Astro method 命名约定）

#### 代码质量
- 清理 6 处 `console.log` / `console.warn`（生产代码）
- 清理死代码：`chunker.TARGET_CHUNK_SIZE` / `login.ts.url` / `[slug].astro.Props` / `[tag].astro.getTag`
- 清理死 alias：`Sun as Moon` ×2
- 自绘 `GithubIcon.astro` 替换 lucide deprecated 图标

### ⚡ Performance

- **PostCard 防 CLS**：加 `min-height` 锁住卡片高度（140px），title/desc/tags 各段都有 fallback
- **健康检查优化**：组件级 ref 缓存避免重复请求
- **错误日志优化**：
  - 内存索引（最近 200 条）→ 列表查询不读盘
  - 写入批处理 + 定期 GC 防止内存泄漏

### ♻️ Refactor

- **`lib/lmstudio.ts` 抽取**：单一配置源
- **`middleware.ts` 集中**：admin 鉴权 + 安全头 + 错误捕获
- **`lib/rate-limit.ts` 抽取**：通用滑动窗口
- **`lib/client-ip.ts` 抽取**：真实 IP 解析
- **`error-store.ts` 重写**：内存索引 + 磁盘上限
- **`PostAIAssistant.tsx` 重写**：单条 answer → 消息列表模式

### 📝 Documentation

- **README.md 全量重写**：从 Astro 5 / UnoCSS / Pagefind 时代更新到 Astro 6 / Tailwind 4 / Orama / Zod 4
  - 真实反映新增的 5 个 lib
  - 新增安全说明章节（CSP / 限流 / 输入校验 / 真实 IP）
  - 新增错误监控后台文档
  - 修复项目结构树
  - 新增 commit 日志风格
- **CHANGELOG.md**：本文件，按 Keep a Changelog 1.1.0 规范

### 🔧 Chore

- **`package.json`**：显式加 `zod@^4.3.6`（替代 astro 间接依赖）
- **`.env.example`**：加 `ADMIN_SECRET` 字段说明
- **`.gitignore`**：保持现状（`.env` / `.cache/` / `.logs/` 已排除）

### ⚠️ Breaking Changes

无。1.0.0 是首个稳定版本。

### 📦 Dependencies

新增：
- `zod@^4.3.6`（显式声明，替代 astro 间接依赖）

变更：
- `lucide-react` 1.21.0 → 0.460.0（v1.x 缺图标）

### 🔒 Security Notes

部署前请确认：
- `.env` 已配置 `ADMIN_PASSWORD` + `ADMIN_SECRET`（≥16 位）
- 生产环境部署在反代后时设置 `TRUST_PROXY=true`
- **不要**在生产用 LM Studio 默认 `lm-studio` 密钥（LM Studio 默认无鉴权，公网部署必须加鉴权层）

---

## [0.x] - Pre-release

预发布版本。功能可用但未经过完整审计。

主要功能（0.x → 1.0.0 已重构）：
- Astro 5/6 SSR + Node standalone 适配器
- MD/MDX 内容 + Zod schema
- LM Studio RAG（向量检索 + 关键词降级）
- LM Studio AI 摘要（构建时 + 运行时）
- 错误日志（文件 JSONL 存储）
- Admin 鉴权（simpleHash-based session，**1.0.0 已升级为 HMAC-SHA256**）
- 全局搜索（Pagefind → 1.0.0 迁移到 Orama）
- 自动发布到 CSDN / 掘金
- 静态代码块复制按钮
- 客户端错误监控

[Unreleased]: https://github.com/yourname/blog/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/yourname/blog/releases/tag/v1.0.0
