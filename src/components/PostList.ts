/** 文章列表项（序列化后传给 React 岛） */
export interface PostSummary {
  slug: string
  title: string
  description: string
  date: string
  tags: string[]
}
