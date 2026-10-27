import { describe, expect, it } from 'vitest'
import { handleHoneypotRequest, HONEYPOT_PATHS, isHoneypotPath, privateRateLimitKey } from '../src/honeypot.ts'
import { handlePublicChatRoute } from '../src/public-chat.ts'

const url = 'https://bilabot2.example'
const secret = 'test-key-not-real'

describe('anonymous privacy-preserving honeypot', () => {
  it('matches scanner decoys, not actual chat or auth', () => {
    for (const path of HONEYPOT_PATHS) expect(isHoneypotPath(path)).toBe(true)
    for (const path of ['/', '/api/public/chat', '/api/public/config', '/login', '/owner', '/admin']) {
      expect(isHoneypotPath(path)).toBe(false)
    }
  })

  it('uses a secret-keyed pseudonymous limiter key, not a raw IP', async () => {
    const headers = { 'cf-connecting-ip': '192.0.2.42' }
    const request = new Request(url + '/.env', { headers })
    const key = await privateRateLimitKey(request, secret)
    expect(key).toMatch(/^public-chat:v2:[a-f0-9]{64}$/u)
    expect(key).not.toContain('192.0.2.42')
    expect(await privateRateLimitKey(request, secret)).toBe(key)
    expect(await privateRateLimitKey(new Request(url + '/.env', {
      headers: { 'cf-connecting-ip': '192.0.2.43' },
    }), secret)).not.toBe(key)
    expect(await privateRateLimitKey(request, undefined)).toBeUndefined()
  })

  it('returns indistinguishable 404 responses without retaining a visitor log', async () => {
    const request = new Request(url + '/.git/config', {
      headers: { 'cf-connecting-ip': '192.0.2.42', 'user-agent': 'probe' },
    })
    const response = await handleHoneypotRequest(request, {})
    expect(response.status).toBe(404)
    expect(await response.text()).toBe('Not Found')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.has('set-cookie')).toBe(false)
  })

  it('applies temporary soft cooldown via the existing five-per-minute chat quota', async () => {
    const attempts = new Map<string, number>()
    const limiter = {
      limit: async ({ key }: { key: string }) => {
        const count = (attempts.get(key) ?? 0) + 1
        attempts.set(key, count)
        return { success: count <= 5 }
      },
    }
    const headers = { 'cf-connecting-ip': '192.0.2.42' }
    const decoy = await handleHoneypotRequest(new Request(url + '/wp-admin', { headers }), {
      DEEPSEEK_API_KEY: secret, PUBLIC_CHAT_RATE_LIMITER: limiter,
    })
    expect(decoy.status).toBe(404)
    expect(Array.from(attempts.values())).toEqual([5])
    const response = await handlePublicChatRoute(new Request(url + '/api/public/chat', {
      method: 'POST', headers: {
        ...headers, origin: url, 'content-type': 'application/json',
      },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Xin chào' }] }),
    }), { DEEPSEEK_API_KEY: secret, PUBLIC_CHAT_RATE_LIMITER: limiter })
    expect(response.status).toBe(429)
    expect(Array.from(attempts.values())).toEqual([6])
  })

  it('never requires a D1 database, Cloudflare API token or webhook for decoy paths', async () => {
    const seen: string[] = []
    const response = await handleHoneypotRequest(new Request(url + '/phpmyadmin', {
      headers: { 'user-agent': 'scanner' },
    }), {
      DEEPSEEK_API_KEY: secret,
      PUBLIC_CHAT_RATE_LIMITER: { limit: async ({ key }) => {
        seen.push(key); return { success: true }
      } },
    })
    expect(response.status).toBe(404)
    expect(seen).toEqual([]) // A trusted Cloudflare client-IP is needed to penalize anyone.
  })
})
