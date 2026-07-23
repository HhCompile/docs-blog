---
# 博客首页改版调研与方案

> 调研日期: 2026-07-23

## 一、行业主流做法

开发者个人站的核心公式：**博客 + 项目展示 + 个人品牌**

| 层级 | 内容 | 典型实现 |
|------|------|---------|
| 首页 Hero | 一句话定位 + 简介 + CTA | 大标题、副标题、GitHub/社交链接 |
| 精选项目 | 2-3 个核心作品卡片 | Content Collections + 卡片网格 |
| 最新文章 | 3-6 篇最新博客 | 按日期排序的摘要列表 |
| 技能/技术栈 | 图标网格或标签云 | 静态展示或动态 GitHub 统计 |
| 关于页 | 详细自我介绍 + 经历 | 时间线、经历卡片 |

## 二、2025 设计趋势

| 趋势 | 说明 | 本项目匹配度 |
|------|------|:--:|
| Bento Grid | 大小不一的卡片拼贴布局，类似 Apple 官网 | 待新增 |
| Glassmorphism | 毛玻璃半透明卡片，层次感强 | 部分已有 |
| 暗色/亮色切换 | 主题切换已成标配 | 缺失 |
| 滚动动画 | 内容随滚动渐入，提升浏览体验 | 缺失 |
| GitHub 实时数据 | GitHub API 拉取仓库、贡献热力图、Star 数 | 缺失 |
| 微交互 | 鼠标悬停效果、卡片翻转 | 部分已有 |

## 三、典型案例

1. **Brittany Chiang** (brittanychiang.com) — 开发者作品集经典模板
   - 鼠标光晕跟随效果，滚动时导航高亮当前区块
   - Hero → About → Experience → Projects 单页结构

2. **Lee Robinson** (leerob.io) — Vercel VP，博客+作品集标杆
   - 极简首页：头像 + 一句话简介 + 文章列表
   - 文章卡片带阅读量和日期，暗色模式

3. **标准 Astro 作品集模式**
   - Content Collections 管理项目和文章
   - Hero Section → Featured Projects Grid → Call to Action
   - Tailwind CSS + View Transitions

4. **个人博客+项目站** (gfish.online / Eric-Terminal)
   - Astro + 项目卡片 + 博客列表
   - 技术栈标签、RSS、搜索

## 四、本项目现状 vs 目标

| 模块 | 现状 | 建议 |
|------|------|------|
| 首页 Hero | 无明确个人介绍 | 新增：名字 + 一句话定位 + GitHub 链接 |
| 项目展示 | 3 个服务卡片（静态硬编码） | 改为 Content Collections 驱动 |
| 文章列表 | 已有 | 保留，增加标签和封面图 |
| GitHub 联动 | 无 | 新增：GitHub 仓库卡片、贡献统计 |
| 暗色模式 | 无 | 新增 toggle |
| 滚动动画 | 无 | 增加渐入效果 |
| Bento Grid | 无 | 首页改用 Bento 布局展示项目+文章 |

## 五、实施计划

1. 首页改为 Bento Grid 布局（Hero + 精选项目 + 最新文章）
2. 项目数据改为 Content Collections 管理
3. 接入 GitHub API 展示 HhCompile 仓库
4. 增加暗色/亮色切换
5. 滚动渐入动画

---
