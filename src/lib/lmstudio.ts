/**
 * LM Studio 共享配置
 * - 单一真源，避免 chat/summarize/build-embeddings 三处配置漂移
 * - 支持 LLM 和 embedding 独立配置（可指向远程电脑）
 * - 暴露 fetch 包装：自动注入 base URL、auth header
 */
export interface LMStudioConfig {
  baseUrl: string
  apiKey: string
  model: string
}

export const llmConfig: LMStudioConfig = {
  baseUrl: (process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234/v1').replace(/\/+$/, ''),
  apiKey: process.env.LMSTUDIO_API_KEY || 'lm-studio',
  model: process.env.LMSTUDIO_MODEL || 'local-model',
}

export const embeddingConfig: LMStudioConfig & { enabled: boolean } = {
  baseUrl: (process.env.EMBEDDING_BASE_URL || llmConfig.baseUrl).replace(/\/+$/, ''),
  apiKey: process.env.EMBEDDING_API_KEY || llmConfig.apiKey,
  model: process.env.EMBEDDING_MODEL || '',
  enabled: !!process.env.EMBEDDING_MODEL,
}

/** 统一 fetch 包装（自动注入 auth + JSON header） */
export async function lmFetch(
  cfg: LMStudioConfig,
  path: string,
  body: unknown,
  options?: { signal?: AbortSignal; stream?: boolean }
): Promise<Response> {
  return fetch(`${cfg.baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: options?.signal,
  })
}

/** GET 请求（如 /models 健康检查） */
export async function lmGet(cfg: LMStudioConfig, path: string): Promise<Response> {
  return fetch(`${cfg.baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${cfg.apiKey}` },
  })
}
