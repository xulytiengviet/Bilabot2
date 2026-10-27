import { describe, expect, it } from 'vitest'
import { runInNewContext } from 'node:vm'
import { handlePublicChatRoute, isPublicChatEnabled, publicChatPreflight, publicChatWithCors, publicMaxTokens, validatePublicMessages } from '../src/public-chat.ts'
import { cvnssConverterSource } from '../src/cvnss-converter-bundle.ts'
import { publicChatHtml, publicChatJavascript } from '../src/public-chat-page.ts'

describe('anonymous chat boundary', () => {
  it('is opt-in', () => {
    expect(isPublicChatEnabled({})).toBe(false)
    expect(isPublicChatEnabled({ DSH_EDGE_PUBLIC_CHAT: 'enabled' })).toBe(true)
    expect(isPublicChatEnabled({ DSH_EDGE_PUBLIC_CHAT: 'false' })).toBe(false)
  })
  it('never accepts caller-selected model or secret fields as messages', () => {
    expect(validatePublicMessages([{ role: 'user', content: 'Xin chào', model: 'evil', apiKey: 'evil' }]))
      .toEqual([{ role: 'user', content: 'Xin chào' }])
    expect(() => validatePublicMessages([{ role: 'tool', content: 'test' }])).toThrow()
    expect(() => validatePublicMessages([{ role: 'assistant', content: 'not a user turn' }])).toThrow()
    expect(() => validatePublicMessages([{ role: 'user', content: 'x'.repeat(6001) }])).toThrow()
    expect(() => validatePublicMessages([])).toThrow()
  })
  it('bounds per-turn output', () => {
    expect(publicMaxTokens(undefined)).toBe(1024)
    expect(publicMaxTokens('2048')).toBe(2048)
    expect(() => publicMaxTokens('90000')).toThrow()
  })
  it('returns public Vietnamese HTML without owner auth', async () => {
    const response = await handlePublicChatRoute(new Request('https://test.example/'), {})
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('BilaBot')
    expect(response.headers.get('content-security-policy')).toContain("default-src 'none'")
  })
  it('serves a clean light Vietnamese interface and local converter without leaking keys', async () => {
    expect(publicChatHtml).toContain('color-scheme:light')
    expect(publicChatHtml).toContain('Trợ lý Bila')
    expect(publicChatHtml).toContain('@2026, <strong>Trần Tư Bình</strong> và <strong>Kiều Trường Lâm</strong> phát kiến CVNSS4.0')
    expect(publicChatHtml).toContain('Nguồn: <strong>Long Ngo</strong> phát triển · Giấy phép MIT')
    expect(publicChatHtml).toContain('id="notice"')
    expect(publicChatHtml).not.toContain('CVNSS4.0 × DeepSeek')
    expect(publicChatHtml).not.toContain('Trò chuyện công khai · Không yêu cầu đăng nhập')
    expect(publicChatHtml).not.toContain('Mô hình cố định')
    expect(publicChatHtml).not.toContain('Quản trị</a>')
    expect(publicChatJavascript).not.toContain('Giới thiệu CVNSS4.0')
    expect(publicChatJavascript).not.toContain('Chưa có API key')
    expect(publicChatJavascript).toContain("showNotice(")
    expect(publicChatHtml).toContain('/public/cvnss.js')
    expect(publicChatJavascript).toContain('localStorage')
    expect(publicChatJavascript).toContain('cvssPreview')
    expect(publicChatJavascript).toContain("fetch('/api/public/chat'")
    expect(publicChatHtml + publicChatJavascript).not.toMatch(/sk-or-v1-|api\.openrouter\.ai/)
    const response = await handlePublicChatRoute(new Request('https://test.example/public/cvnss.js'), {})
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/javascript')
    expect(await response.text()).toBe(cvnssConverterSource)
    expect(cvnssConverterSource).toContain('5.0.0-audit-safe')
  })
  it('passes the audited CVNSS4.0 converter self-test independently', () => {
    const context: { CVNSSConverter?: {
      selfTest: () => { ok: boolean; failures: unknown[] };
      fromCqn: (input: string) => { cvss: string };
    } } = {}
    runInNewContext(cvnssConverterSource, context)
    expect(context.CVNSSConverter?.selfTest()).toMatchObject({ ok: true, failures: [] })
    expect(context.CVNSSConverter?.fromCqn('Tôi yêu tiếng Việt.').cvss).toBe('Toiy iwy tizb Vidf.')
  })

  it('accepts preflight exclusively from trusted GitHub Pages origin', () => {
    const uri = 'https://bilabot2.example/api/public/chat'
    const legit = new Request(uri, { method: 'OPTIONS', headers: {
      origin: 'https://xulytiengviet.github.io',
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type'
    } })
    const pass = publicChatPreflight(legit)
    expect(pass.status).toBe(204)
    expect(pass.headers.get('access-control-allow-origin')).toBe('https://xulytiengviet.github.io')
    const evil = publicChatPreflight(new Request(uri, { method: 'OPTIONS', headers: {
      origin: 'https://evil.example', 'access-control-request-method': 'POST'
    } }))
    expect(evil.status).toBe(403)
  })

  it('returns allowlisted CORS on public API responses only', async () => {
    const uri = 'https://bilabot2.example/api/public/config'
    const r = new Request(uri, { headers: { origin: 'https://xulytiengviet.github.io' } })
    const response = await handlePublicChatRoute(r, {})
    const cors = publicChatWithCors(r, response)
    expect(cors.headers.get('access-control-allow-origin')).toBe('https://xulytiengviet.github.io')
    expect(cors.headers.get('vary')).toContain('Origin')
    expect((await cors.text())).toContain('workers-ai')
    const untrusted = new Request(uri, { headers: { origin: 'https://attacker.invalid' } })
    const blocked = publicChatWithCors(untrusted, new Response('{}'))
    expect(blocked.headers.has('access-control-allow-origin')).toBe(false)
  })

  it('GitHub Pages origin reaches guarded chat without bypassing rate limits', async () => {
    const response = await handlePublicChatRoute(new Request('https://bilabot2.example/api/public/chat', {
      method: 'POST', headers: { origin: 'https://xulytiengviet.github.io', 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Xin chào' }] })
    }), {})
    expect(response.status).toBe(503) // Missing limiter stays fail-closed.
  })
  it('rejects cross-origin and does not call upstream', async () => {
    const response = await handlePublicChatRoute(new Request('https://test.example/api/public/chat', {
      method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] }),
    }), {})
    expect(response.status).toBe(403)
  })
  it('is keyless: config reports Workers AI and readiness only with required bindings', async () => {
    const request = new Request('https://test.example/api/public/config')
    const missing = await handlePublicChatRoute(request, {})
    expect(await missing.json()).toMatchObject({ ready: false, provider: 'workers-ai' })
    const configured = await handlePublicChatRoute(new Request('https://test.example/api/public/config'), {
      AI: { run: async () => ({ response: 'Hello' }) } as unknown as Ai,
      PUBLIC_VISITOR_QUOTA: { getByName: () => ({}) } as unknown as NonNullable<
        import('../src/public-chat.ts').PublicChatEnv['PUBLIC_VISITOR_QUOTA']
      >,
      PUBLIC_CHAT_RATE_LIMITER: { limit: async () => ({ success: true }) },
    })
    const source = await configured.text()
    expect(source).not.toContain('DEEPSEEK_API_KEY')
    expect(JSON.parse(source)).toMatchObject({
      ready: true, provider: 'workers-ai', maxQuestionsPerIp: 10,
    })
  })
  it('rejects misconfigured rate limiting instead of exposing a free public proxy', async () => {
    const response = await handlePublicChatRoute(new Request('https://test.example/api/public/chat', {
      method: 'POST', headers: { origin: 'https://test.example', 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] }),
    }), {})
    expect(response.status).toBe(503)
  })
})
