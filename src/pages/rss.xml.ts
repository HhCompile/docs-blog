import rss from '@astrojs/rss'
import type { APIContext } from 'astro'
import { getCollection } from 'astro:content'
import siteConfig from '../data/site.config.mjs'

export async function GET(context: APIContext) {
  const posts = (await getCollection('posts', ({ data }) => !data.draft))
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())

  return rss({
    title: siteConfig.site_title,
    description: siteConfig.site_description,
    site: context.site ?? siteConfig.site_url,
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.date,
      description: post.data.description ?? '',
      link: `/posts/${post.id}`,
      categories: post.data.tags ?? [],
    })),
    customData: `<language>zh-cn</language>`,
  })
}
