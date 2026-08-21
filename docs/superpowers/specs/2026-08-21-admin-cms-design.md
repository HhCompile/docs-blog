# docs-blog 后台 CMS + Obsidian 同步 — 设计文档

日期：2026-08-21
状态：已确认

## 背景

docs-blog（Astro SSR）已部署到云服务器（shhbase.cn，systemd + Caddy 反代）。当前后台仅有错误监控（/admin/errors）与 TOTP 登录。需要新增完整 CMS 能力：后台实时编辑文章内容与站点主题，并接入本地 Obsidian 双向同步。

## 需求

1. 全量 CMS：新建、编辑、软删除、列表管理文章
2. Markdown 源码编辑器 + 预览分屏
3. 站点主题：预设主题切换 + 自定义 CSS
4. 草稿 / 手动发布流程
5. 服务器本地维护源码（git clone），发布时服务器自构建
6. Obsidian（本地）通过 git 与后台双向同步
7. 软删除（.trash/）+ 回收站彻底删除

## 架构

```
本地 Obsidian (Mac mini) ── git push/pull ──▶ 云服务器 /opt/docs-blog
                                              (完整源码仓库 + dist 构建产物)
手机浏览器 ── HTTPS /admin ──▶ 后台 CMS 读写 src/content/posts/*.md
                              发布 → git push + pnpm build + systemctl restart
```

- 服务器 /opt/docs-blog 从"仅 dist"升级为完整源码仓库（含 src、package.json、.git）
- systemd 继续运行 dist/server/entry.mjs（构建产物）
- 后台 API 直接读写服务器上的 src/content/posts/*.md
- 每次保存/删除自动 git commit；发布 = git push + 服务器构建 + 重启服务

## 功能模块

| 模块 | 路由 | 说明 |
|---|---|---|
| 文章列表 | /admin/posts | 卡片列表：标题/日期/标签/草稿状态/操作 |
| 新建/编辑 | /admin/posts/edit?slug=xxx | Markdown 源码编辑器 + 实时预览分屏 + frontmatter 表单 |
| 软删除 | 列表页操作 | 移入 .trash/，可恢复；回收站页可彻底删除 |
| 发布 | 编辑页按钮 | git pull → pnpm build → 重启服务，失败自动回滚 |
| 主题设置 | /admin/settings | 预设主题切换 + 自定义 CSS 编辑框 |

## API 设计（全部走 TOTP 鉴权）

- GET /api/posts — 文章列表
- POST /api/posts — 新建文章（生成 slug）
- GET/PUT /api/posts/[slug] — 读取/更新 Markdown + frontmatter
- DELETE /api/posts/[slug] — 软删除（移 .trash/）
- POST /api/posts/[slug]/publish — 发布（git push + build + restart）
- GET/PUT /api/settings — 主题设置

安全：slug 白名单校验、路径防 ../ 逃逸、TOTP 鉴权、构建失败回滚。

## Obsidian 同步

- Obsidian vault 指向本机 /Users/hh/www/docs-blog（或挂 posts 目录）
- 本地写文章 → git push → 后台点发布 → 服务器 git pull 构建上线
- 后台编辑 → 自动 git push → 本地 Obsidian git pull 同步

## 构建/回滚

- 构建命令：pnpm run build:no-ai（跳过 AI embedding 依赖）
- 构建成功 → 重启 systemd → 上线
- 构建失败 → git checkout 回滚，服务不中断

## 范围边界（YAGNI）

- 不做数据库存储（保持 Markdown 原生）
- 不做富文本编辑器（纯 Markdown + 预览）
- 不做多用户权限体系（单用户）
- 不改造 notes/KnowledgeBase 发布（仍只读展示）
