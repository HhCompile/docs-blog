// 站点基础信息（构建时使用）
const SITE_URL = process.env.SITE_URL || 'https://yourblog.com'
const SITE_TITLE = process.env.SITE_TITLE || 'My Blog'
const SITE_DESCRIPTION = process.env.SITE_DESCRIPTION || '记录 · 分享 · 思考'
const SITE_AUTHOR = process.env.SITE_AUTHOR || 'yourname'

export default {
  site_url: SITE_URL,
  site_title: SITE_TITLE,
  site_description: SITE_DESCRIPTION,
  site_author: SITE_AUTHOR,
  github_url: process.env.GITHUB_URL || 'https://github.com/yourname',
  twitter_url: process.env.TWITTER_URL || '',
  // 默认社交分享图（1200x630）
  default_og_image: '/og-default.png',
  // 语言
  locale: 'zh_CN',
}
