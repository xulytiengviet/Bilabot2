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
import { DurableObject } from 'cloudflare:workers'

export const PUBLIC_VISITOR_MAX_QUESTIONS = 10
const RESERVATION_TTL_MS = 120_000
const QUOTA_NAMESPACE_NAME = 'bilabot-public-visitor-quota-v1'
const INTERNAL_QUOTA_ORIGIN = 'https://bilabot-quota.internal'

type QuotaAction = 'key' | 'reserve' | 'finish'
type QuotaInput = { ip: string; token?: string; success?: boolean }
export type QuotaResult = { ok: boolean; key?: string; remaining?: number; used?: number }

export interface PublicQuotaEnv {
  PUBLIC_VISITOR_QUOTA?: DurableObjectNamespace<PublicVisitorQuota>
}

function bytesToHex(bytes: Uint8Array): string {
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

export class PublicVisitorQuota extends DurableObject {
  private readonly ready: Promise<void>
  private signer: CryptoKey | undefined

  constructor(ctx: DurableObjectState, env: object) {
    super(ctx, env)
    ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS visitor_usage (
        visitor TEXT PRIMARY KEY NOT NULL,
        used INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS visitor_pending (
        token TEXT PRIMARY KEY NOT NULL,
        visitor TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS visitor_pending_visitor
        ON visitor_pending(visitor);
    `)
    this.ready = ctx.blockConcurrencyWhile(async () => {
      let salt = await ctx.storage.get<string>('hmac-salt-v1')
      if (!salt) {
        const bytes = new Uint8Array(32)
        crypto.getRandomValues(bytes)
        salt = bytesToHex(bytes)
        await ctx.storage.put('hmac-salt-v1', salt)
      }
      this.signer = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(salt),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
      )
    })
  }

  private async visitorId(ip: string): Promise<string> {
    await this.ready
    if (!this.signer) throw new Error('Quota signer unavailable.')
    const signature = await crypto.subtle.sign(
      'HMAC', this.signer, new TextEncoder().encode(ip),
    )
    return bytesToHex(new Uint8Array(signature))
  }

  override async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname
    if (request.method !== 'POST' || !['/key', '/reserve', '/finish'].includes(path)) {
      return new Response('Not Found', { status: 404 })
    }
    let payload: QuotaInput
    try {
      payload = await request.json() as QuotaInput
      if (!payload || typeof payload.ip !== 'string' || !payload.ip || payload.ip.length > 60) {
        return Response.json({ ok: false }, { status: 400 })
      }
    } catch {
      return Response.json({ ok: false }, { status: 400 })
    }
    const visitor = await this.visitorId(payload.ip)
    if (path === '/key') {
      return Response.json({ ok: true, key: `visitor-v1:${visitor}` } satisfies QuotaResult)
    }
    const sql = this.ctx.storage.sql
    const token = payload.token
    if (typeof token !== 'string' || !/^[0-9a-f-]{36}$/u.test(token)) {
      return Response.json({ ok: false }, { status: 400 })
    }

    if (path === '/reserve') {
      const state = this.ctx.storage.transactionSync(() => {
        sql.exec('DELETE FROM visitor_pending WHERE visitor = ? AND created_at < ?',
          visitor, Date.now() - RESERVATION_TTL_MS)
        sql.exec('INSERT OR IGNORE INTO visitor_usage(visitor, used) VALUES(?, 0)', visitor)
        const rows = sql.exec<{ used: number }>(
          'SELECT used FROM visitor_usage WHERE visitor = ?', visitor).toArray()
        const used = rows[0]?.used ?? 0
        const pending = sql.exec<{ n: number }>(
          'SELECT COUNT(*) AS n FROM visitor_pending WHERE visitor = ?', visitor).one().n
        if (!quotaAvailable(used, pending)) {
          return { ok: false, remaining: Math.max(0, PUBLIC_VISITOR_MAX_QUESTIONS - used - pending), used }
        }
        sql.exec('INSERT INTO visitor_pending(token, visitor, created_at) VALUES(?, ?, ?)',
          token, visitor, Date.now())
        return { ok: true, remaining: PUBLIC_VISITOR_MAX_QUESTIONS - used - pending - 1, used }
      })
      return Response.json(state satisfies QuotaResult)
    }

    // Only a matching pending reservation can be committed or refunded.
    const state = this.ctx.storage.transactionSync(() => {
      const row = sql.exec<{ visitor: string }>(
        'SELECT visitor FROM visitor_pending WHERE token = ?', token).toArray()[0]
      if (!row || row.visitor !== visitor) return { ok: false }
      sql.exec('DELETE FROM visitor_pending WHERE token = ?', token)
      if (payload.success === true) {
        sql.exec('UPDATE visitor_usage SET used = MIN(used + 1, ?) WHERE visitor = ?',
          PUBLIC_VISITOR_MAX_QUESTIONS, visitor)
      }
      const used = sql.exec<{ used: number }>(
        'SELECT used FROM visitor_usage WHERE visitor = ?', visitor).one().used
      return { ok: true, used, remaining: Math.max(0, PUBLIC_VISITOR_MAX_QUESTIONS - used) }
    })
    return Response.json(state satisfies QuotaResult)
  }
}
