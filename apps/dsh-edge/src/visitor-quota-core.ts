/** BilaBot public quota: 10 successfully answered questions, lifetime, per public IP.
 *
 * Uses a single SQLite-backed Durable Object as the consistency boundary.
 * A random HMAC salt is generated once inside DO storage and never exposed.
 * Only HMAC visitor IDs, counts and ephemeral reservations are persisted.
 * No raw IP, messages, User-Agent or API keys are stored.
 *
 * IMPORTANT: one shared/NAT IP also shares ten lifetime answers; an IP can
 * change or be rotated, so this is not a guaranteed human-identity limit.
 */

export const PUBLIC_VISITOR_MAX_QUESTIONS = 10
const QUOTA_NAMESPACE_NAME = 'bilabot-public-visitor-quota-v1'
const INTERNAL_QUOTA_ORIGIN = 'https://bilabot-quota.internal'

type QuotaAction = 'key' | 'reserve' | 'finish'
type QuotaInput = { ip: string; token?: string; success?: boolean }
export type QuotaResult = { ok: boolean; key?: string; remaining?: number; used?: number }

export interface PublicQuotaEnv {
  PUBLIC_VISITOR_QUOTA?: DurableObjectNamespace<import('./visitor-quota.ts').PublicVisitorQuota>
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

export function quotaAvailable(used: number, pending: number): boolean {
  return used + pending < PUBLIC_VISITOR_MAX_QUESTIONS
}

/**
 * All quota RPC calls stay inside Cloudflare. The external HTTP Router does
 * not route any /quota endpoint; direct visitor access is impossible.
 */
export async function quotaCall(env: PublicQuotaEnv, request: Request, action: QuotaAction,
  token?: string, success?: boolean): Promise<QuotaResult> {
  const ip = request.headers.get('cf-connecting-ip')?.trim()
  if (!ip || ip.length > 60 || !env.PUBLIC_VISITOR_QUOTA) {
    throw new Error('Public quota binding or trusted client address unavailable.')
  }
  const stub = env.PUBLIC_VISITOR_QUOTA.getByName(QUOTA_NAMESPACE_NAME)
  const response = await stub.fetch(new Request(`${INTERNAL_QUOTA_ORIGIN}/${action}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ip, token, success } satisfies QuotaInput),
  }))
  if (!response.ok) throw new Error('Public quota service temporarily unavailable.')
  return await response.json() as QuotaResult
}

