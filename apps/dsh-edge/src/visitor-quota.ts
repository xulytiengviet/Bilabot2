import { DurableObject } from 'cloudflare:workers'
import { PUBLIC_VISITOR_MAX_QUESTIONS, quotaAvailable, bytesToHex } from './visitor-quota-core.ts'
import type { QuotaResult } from './visitor-quota-core.ts'

const RESERVATION_TTL_MS = 120_000
type QuotaInput = { ip: string; token?: string | undefined; success?: boolean | undefined }

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
