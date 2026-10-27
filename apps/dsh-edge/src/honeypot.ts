/**
 * Privacy-first honeypot for a keyless Cloudflare Workers AI BilaBot.
 *
 * Inspired by common deception endpoints, but intentionally:
 * - NEVER logs, stores or exports IP, User-Agent or request body.
 * - NEVER opens a WAF Skip rule, auto-blocks via an admin token or uses D1/R2.
 * - Uses the EXISTING five-per-minute chat limiter to create a short soft
 *   penalty if a scanner deliberately probes a clearly non-app path.
 * - Only salted, pseudonymous lifetime question counters use SQLite.
 *
 * Rate limiting is approximate per Cloudflare location, NOT a firewall ban.
 */
import { quotaCall } from './visitor-quota.ts'
import type { PublicQuotaEnv } from './visitor-quota.ts'

export interface HoneypotEnv extends PublicQuotaEnv {
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
  // Prevent an unrelated website from forcing an innocent visitor's IP into
  // cooldown by embedding a hidden image or cross-site fetch to a bait URL.
  if (request.headers.get('sec-fetch-site') === 'cross-site') return response
  const destination = request.headers.get('sec-fetch-dest')
  if (destination && !['document', 'empty'].includes(destination)) return response
  if (!env.PUBLIC_CHAT_RATE_LIMITER || !env.PUBLIC_VISITOR_QUOTA) return response
  try {
    const { key } = await quotaCall(env, request, 'key')
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
