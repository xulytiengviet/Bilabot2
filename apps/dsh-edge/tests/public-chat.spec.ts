import { describe, expect, it } from 'vitest'
import { runInNewContext } from 'node:vm'
import { handlePublicChatRoute, isPublicChatEnabled, publicMaxTokens, validatePublicMessages } from '../src/public-chat.ts'
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
    expect(publicChatHtml).toContain('Bộ não CVNSS4.0')
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
  it('rejects cross-origin and does not call upstream', async () => {
    const response = await handlePublicChatRoute(new Request('https://test.example/api/public/chat', {
      method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] }),
    }), { DEEPSEEK_API_KEY: 'test-secret' })
    expect(response.status).toBe(403)
  })
  it('never reveals the API key from config', async () => {
    const response = await handlePublicChatRoute(new Request('https://test.example/api/public/config'),
      { DEEPSEEK_API_KEY: 'very-private', DEEPSEEK_MODEL: 'deepseek-flash' })
    const source = await response.text()
    expect(source).not.toContain('very-private')
    expect(JSON.parse(source)).toMatchObject({ ready: true, model: 'deepseek-flash' })
  })
  it('rejects misconfigured rate limiting instead of exposing a free public proxy', async () => {
    const response = await handlePublicChatRoute(new Request('https://test.example/api/public/chat', {
      method: 'POST', headers: { origin: 'https://test.example', 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] }),
    }), { DEEPSEEK_API_KEY: 'test-secret' })
    expect(response.status).toBe(503)
  })
})
