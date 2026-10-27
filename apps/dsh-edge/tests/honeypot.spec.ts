import { describe, expect, it } from 'vitest'
import { handleHoneypotRequest, HONEYPOT_PATHS, isHoneypotPath } from '../src/honeypot.ts'
import { quotaAvailable, quotaCall, PUBLIC_VISITOR_MAX_QUESTIONS } from '../src/visitor-quota.ts'
import { handlePublicChatRoute } from '../src/public-chat.ts'
import type { PublicChatEnv } from '../src/public-chat.ts'

const base = 'https://bilabot2.example'
const clientIp = '192.0.2.42'

function envWithFakeQuota(): {
  env: PublicChatEnv
  getRemaining: () => number
  setModelError: (error: Error | undefined) => void
} {
  let used = 0
  let modelError: Error | undefined
  const pending = new Set<string>()
  const quota = {
    getByName: (_name: string) => ({ fetch: async (request: Request) => {
      const body = await request.json() as { ip: string; token: string; success: boolean }
      if (body.ip !== clientIp) return Response.json({ ok: false }, { status: 400 })
      const action = new URL(request.url).pathname
      if (action === '/key') return Response.json({ ok: true, key: 'visitor-v1:opaque-test-key' })
      if (action === '/reserve') {
        if (!quotaAvailable(used, pending.size)) return Response.json({ ok: false, remaining: 0 })
        pending.add(body.token)
        return Response.json({ ok: true, remaining: PUBLIC_VISITOR_MAX_QUESTIONS - used - pending.size })
      }
      if (action === '/finish') {
        if (!pending.delete(body.token)) return Response.json({ ok: false })
        if (body.success) used++
        return Response.json({ ok: true, used, remaining: PUBLIC_VISITOR_MAX_QUESTIONS - used })
      }
      return Response.json({ ok: false }, { status: 404 })
    } }),
  }
  const env = {
    AI: { run: async () => {
      if (modelError) throw modelError
      return { response: 'Xin chào từ Workers AI.' }
    } },
    PUBLIC_VISITOR_QUOTA: quota,
    PUBLIC_CHAT_RATE_LIMITER: { limit: async () => ({ success: true }) },
  } as unknown as PublicChatEnv
  return { env, getRemaining: () => PUBLIC_VISITOR_MAX_QUESTIONS - used, setModelError: e => { modelError = e } }
}

function askRequest(): Request {
  return new Request(base + '/api/public/chat', {
    method: 'POST',
    headers: { origin: base, 'cf-connecting-ip': clientIp, 'content-type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'Xin chào!' }] }),
  })
}

describe('BilaBot Workers AI Free and lifetime visitor quota', () => {
  it('identifies scanners without intercepting legitimate routes', () => {
    for (const path of HONEYPOT_PATHS) expect(isHoneypotPath(path)).toBe(true)
    for (const path of ['/', '/api/public/chat', '/api/public/config', '/login', '/owner']) {
      expect(isHoneypotPath(path)).toBe(false)
    }
  })
  it('enforces precisely ten successful questions per IP, across requests', async () => {
    const { env, getRemaining } = envWithFakeQuota()
    for (let i = 1; i <= 10; i++) {
      const response = await handlePublicChatRoute(askRequest(), env)
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        ok: true, remaining: 10 - i, maxQuestionsPerIp: 10,
      })
    }
    expect(getRemaining()).toBe(0)
    const last = await handlePublicChatRoute(askRequest(), env)
    expect(last.status).toBe(429)
    expect(await last.json()).toMatchObject({ ok: false, remaining: 0 })
  })
  it('does not charge a question after daily free tier exhaustion', async () => {
    const { env, getRemaining, setModelError } = envWithFakeQuota()
    setModelError(Object.assign(new Error('3036: Account limited'), { code: 3036 }))
    const response = await handlePublicChatRoute(askRequest(), env)
    expect(response.status).toBe(429)
    expect((await response.json() as { error: string }).error).toContain('Hạn mức AI miễn phí')
    expect(getRemaining()).toBe(10)
  })
  it('applies decoy cooldown through the existing five-per-minute limiter', async () => {
    const { env } = envWithFakeQuota()
    const visits = new Map<string, number>()
    env.PUBLIC_CHAT_RATE_LIMITER = { limit: async ({ key }) => {
      visits.set(key, (visits.get(key) ?? 0) + 1)
      return { success: (visits.get(key) ?? 0) <= 5 }
    } }
    const probe = await handleHoneypotRequest(new Request(base + '/.env', {
      headers: { 'cf-connecting-ip': clientIp },
    }), env)
    expect(probe.status).toBe(404)
    expect(await probe.text()).toBe('Not Found')
    expect(Array.from(visits.values())).toEqual([5])
    const response = await handlePublicChatRoute(askRequest(), env)
    expect(response.status).toBe(429)
  })
  it('ignores cross-site image probes when calculating cooldown', async () => {
    const { env } = envWithFakeQuota()
    let calls = 0
    env.PUBLIC_CHAT_RATE_LIMITER = { limit: async () => { calls++; return { success: true } } }
    const response = await handleHoneypotRequest(new Request(base + '/.git/config', {
      headers: { 'cf-connecting-ip': clientIp, 'sec-fetch-site': 'cross-site', 'sec-fetch-dest': 'image' },
    }), env)
    expect(response.status).toBe(404)
    expect(calls).toBe(0)
  })
  it('never persists or returns raw IP / user messages from quota service', async () => {
    const { env } = envWithFakeQuota()
    const request = new Request(base + '/.env', {
      headers: { 'cf-connecting-ip': clientIp },
    })
    const identity = await quotaCall(env, request, 'key')
    expect(identity).toMatchObject({ ok: true, key: 'visitor-v1:opaque-test-key' })
    expect(JSON.stringify(identity)).not.toContain(clientIp)
    const response = await handleHoneypotRequest(request, env)
    expect(response.headers.has('set-cookie')).toBe(false)
  })
})
