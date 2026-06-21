/**
 * 解析真实客户端 IP
 * - 直接暴露：返回 clientAddress（Astro socket 远端）
 * - 反向代理后：从 X-Forwarded-For / X-Real-IP 取真实 IP
 * - 通过 TRUST_PROXY 环境变量启用（避免任意请求伪造 IP）
 */
export function getClientIp(
  request: Request,
  socketAddress: string | undefined
): string | undefined {
  // 优先用 socket 地址（反代未启用时也安全）
  const trustProxy = process.env.TRUST_PROXY === 'true'
  if (!trustProxy) return socketAddress

  // X-Forwarded-For: "client, proxy1, proxy2" —— 取最左（真实客户端）
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }

  // X-Real-IP: 单值（Nginx 默认）
  const xri = request.headers.get('x-real-ip')
  if (xri) return xri.trim()

  // CF-Connecting-IP: Cloudflare
  const cf = request.headers.get('cf-connecting-ip')
  if (cf) return cf.trim()

  return socketAddress
}
