/**
 * Privacy-first honeypot for a public, single-secret BilaBot Worker.
 *
 * Inspired by common deception endpoints, but intentionally:
 * - NEVER logs, stores or exports IP, User-Agent or request body.
 * - NEVER opens a WAF Skip rule, auto-blocks via an admin token or uses D1/R2.
 * - Uses the EXISTING five-per-minute chat limiter to create a short soft
 *   penalty if a scanner deliberately probes a clearly non-app path.
 * - Does not use cookies or a persistent database.
 *
 * Rate limiting is approximate per Cloudflare location, NOT a firewall ban.
 */
export interface HoneypotEnv {
  DEEPSEEK_API_KEY?: string
  PUBLIC_CHAT_RATE_LIMITER?: { limit: (input: { key: string }) => Promise<{ success: boolean }> }
}

export const HONEYPOT_PATHS = Object.freeze([
  '/.env',
  '/.git/config',
  '/wp-admin',
  '/wp-admin/',
  '/wp-login.php',
  '/xmlrpc.php',
  '/phpmyadmin',
  '/phpmyadmin/',
  '/admin-secret-panel',
  '/api/internal/debug',
] as const)

const honeypots: ReadonlySet<string> = new Set(HONEYPOT_PATHS)

export function isHoneypotPath(pathname: string): boolean {
  return honeypots.has(pathname.toLowerCase())
}

/**
 * Derive an opaque, short-lived limiter identifier from a worker-only secret.
 * This prevents sending raw visitor IPs as custom limiter keys. Nothing is
 * written to user logs. If the secret is absent, no limit key can be issued.
 */
export async function privateRateLimitKey(request: Request, secret: string | undefined): Promise<string | undefined> {
  const ip = request.headers.get('cf-connecting-ip')?.trim()
  if (!secret?.trim() || !ip) return undefined
  const signer = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const signed = await crypto.subtle.sign('HMAC', signer, new TextEncoder().encode(ip))
  const token = Array.from(new Uint8Array(signed), byte => byte.toString(16).padStart(2, '0')).join('')
  return `public-chat:v2:${token}`
}

export async function handleHoneypotRequest(request: Request, env: HoneypotEnv): Promise<Response> {
  if (!isHoneypotPath(new URL(request.url).pathname)) {
    return new Response('Not Found', { status: 404, headers: { 'cache-control': 'no-store' } })
  }
  // Always respond with a plain 404, including while/after rate-limiting.
  // Never reveal whether a visitor has been flagged.
  const response = new Response('Not Found', {
    status: 404,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'text/plain; charset=utf-8',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
    },
  })
  if (!env.PUBLIC_CHAT_RATE_LIMITER || !env.DEEPSEEK_API_KEY?.trim()) return response
  try {
    const key = await privateRateLimitKey(request, env.DEEPSEEK_API_KEY)
    if (key !== undefined) {
      // Consume up to the shared 5/minute quota. Subsequent public chat
      // requests from this client receive the existing HTTP 429 response.
      // Use a bounded count: Cloudflare's Rate Limiting API period is 10 or 60,
      // NOT the 3600 seconds shown in the supplied reference document.
      for (let i = 0; i < 5; i += 1) {
        const decision = await env.PUBLIC_CHAT_RATE_LIMITER.limit({ key })
        if (!decision.success) break
      }
    }
  } catch {
    // Fail closed for this fake endpoint without logging IP or request details.
    // The valid public chat endpoint still has its own mandatory limiter.
  }
  return response
}
