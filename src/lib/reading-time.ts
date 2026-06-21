/**
 * 预计阅读时间计算
 * - 中文：按字符数（CJK 字符）
 * - 英文：按单词数
 * - 速度：中文 ~400 字/分钟、英文 ~200 词/分钟
 */

const CN_SPEED = 400
const EN_SPEED = 200

export interface ReadingTime {
  /** 总分钟数（至少 1） */
  minutes: number
  /** 字符总数（含中英文） */
  chars: number
  /** 词数（仅英文） */
  words: number
  /** 人类可读字符串 */
  label: string
}

export function calculateReadingTime(text: string): ReadingTime {
  if (!text) return { minutes: 1, chars: 0, words: 0, label: '1 分钟' }

  const cnChars = (text.match(/[一-龥]/g) ?? []).length
  // 剥离 CJK 字符后按空格分词
  const enText = text.replace(/[一-龥]/g, ' ')
  const enWords = (enText.match(/[a-zA-Z]+/g) ?? []).length

  const minutes = Math.max(1, Math.ceil(cnChars / CN_SPEED + enWords / EN_SPEED))

  return {
    minutes,
    chars: cnChars + enWords,
    words: enWords,
    label: `${minutes} 分钟`,
  }
}
