/** Optional Vietnamese, anonymous, stateless chat surface.
 * Deliberately does NOT call the Harness session/agent/DO APIs: they persist data
 * and expose tools intended for the single owner. No chat content is stored here.
 */
import { EdgeHttpError, readJsonObject } from './http.ts'
import { publicChatHtml, publicChatJavascript } from './public-chat-page.ts'
import { cvnssConverterSource } from './cvnss-converter-bundle.ts'
import { PUBLIC_VISITOR_MAX_QUESTIONS, quotaCall } from './visitor-quota-core.ts'
import { createThinkFilter, readAiStream, sseFrame } from './public-ai-stream.ts'
import type { PublicQuotaEnv } from './visitor-quota-core.ts'

export interface PublicChatEnv extends PublicQuotaEnv {
  DSH_EDGE_PUBLIC_CHAT?: string
  DSH_EDGE_PUBLIC_MAX_TOKENS?: string
  AI?: Ai
  PUBLIC_CHAT_RATE_LIMITER?: { limit: (input: { key: string }) => Promise<{ success: boolean }> }
}

const MAX_BODY_BYTES = 64 * 1024
const MAX_MESSAGE_COUNT = 20
const MAX_MESSAGE_CHARS = 6_000
const MAX_TOTAL_CHARS = 28_000
export const PUBLIC_AI_MODEL = '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b'
/** Only this GitHub Pages origin may access the public model proxy cross-origin. */
const GITHUB_PAGES_ORIGIN = 'https://xulytiengviet.github.io'
type ChatMessage = { role: 'user' | 'assistant'; content: string }

/** Browser Origin checks are CSRF/CORS guardrails, not authentication or bot protection. */
function allowedPublicOrigin(request: Request): string | undefined {
  const origin = request.headers.get('origin')
  if (origin === GITHUB_PAGES_ORIGIN || origin === new URL(request.url).origin) return origin
  return undefined
}

export function publicChatPreflight(request: Request): Response {
  const origin = allowedPublicOrigin(request)
  const path = new URL(request.url).pathname
  const method = request.headers.get('access-control-request-method')
  if (!origin || !(path === '/api/public/chat' && method === 'POST'
    || path === '/api/public/config' && method === 'GET')) {
    return new Response(null, { status: 403, headers: { 'cache-control': 'no-store', 'vary': 'Origin' } })
  }
  return new Response(null, { status: 204, headers: {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '600',
    'cache-control': 'no-store',
    'vary': 'Origin',
  } })
}

export function publicChatWithCors(request: Request, response: Response): Response {
  const origin = allowedPublicOrigin(request)
  if (!origin) return response
  const headers = new Headers(response.headers)
  headers.set('access-control-allow-origin', origin)
  headers.set('cross-origin-resource-policy', 'cross-origin')
  headers.append('vary', 'Origin')
  return new Response(response.body, {
    status: response.status, statusText: response.statusText, headers,
  })
}

export function isPublicChatEnabled(env: PublicChatEnv): boolean {
  return env.DSH_EDGE_PUBLIC_CHAT === 'enabled'
}

function headers(contentType = 'application/json; charset=utf-8'): Headers {
  return new Headers({
    'content-type': contentType,
    'cache-control': 'private, no-store, max-age=0',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'x-frame-options': 'DENY',
    'cross-origin-resource-policy': 'same-origin',
  })
}

function result(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: headers() })
}

function error(status: number, message: string): Response {
  return result({ ok: false, error: message }, status)
}

export function publicMaxTokens(value: string | undefined): number {
  if (value === undefined) return 1024
  if (!/^\d{1,4}$/u.test(value) || Number(value) < 128 || Number(value) > 2048) {
    throw new Error('DSH_EDGE_PUBLIC_MAX_TOKENS phải trong khoảng 128–2048.')
  }
  return Number(value)
}

export function validatePublicMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_MESSAGE_COUNT) {
    throw new EdgeHttpError(400, 'Hội thoại phải có từ 1 đến 20 tin nhắn.')
  }
  let total = 0
  const messages: ChatMessage[] = []
  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      throw new EdgeHttpError(400, 'Định dạng tin nhắn không hợp lệ.')
    }
    const msg = raw as Record<string, unknown>
    if ((msg.role !== 'user' && msg.role !== 'assistant') || typeof msg.content !== 'string'
      || msg.content.trim().length === 0 || msg.content.length > MAX_MESSAGE_CHARS) {
      throw new EdgeHttpError(400, 'Tin nhắn không hợp lệ hoặc quá dài.')
    }
    total += msg.content.length
    messages.push({ role: msg.role, content: msg.content })
  }
  if (total > MAX_TOTAL_CHARS) throw new EdgeHttpError(413, 'Hội thoại quá dài, hãy tạo cuộc trò chuyện mới.')
  if (messages.at(-1)?.role !== 'user') throw new EdgeHttpError(400, 'Tin nhắn cuối phải do người dùng gửi.')
  return messages
}

/** Public-mode routes never forward requests into persistent owner APIs. */
export async function handlePublicChatRoute(request: Request, env: PublicChatEnv): Promise<Response> {
  const url = new URL(request.url)
  if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/public')) {
    const h = headers('text/html; charset=utf-8')
    h.set('content-security-policy', "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")
    return new Response(publicChatHtml, { headers: h })
  }
  if (request.method === 'GET' && url.pathname === '/public/app.js') {
    return new Response(publicChatJavascript, { headers: headers('text/javascript; charset=utf-8') })
  }
  if (request.method === 'GET' && url.pathname === '/public/cvnss.js') {
    return new Response(cvnssConverterSource, { headers: headers('text/javascript; charset=utf-8') })
  }
  if (request.method === 'GET' && url.pathname === '/api/public/config') {
    return result({
      ok: true,
      model: PUBLIC_AI_MODEL,
      provider: 'workers-ai',
      ready: Boolean(env.AI && env.PUBLIC_VISITOR_QUOTA && env.PUBLIC_CHAT_RATE_LIMITER),
      maxQuestionsPerIp: PUBLIC_VISITOR_MAX_QUESTIONS,
    })
  }
  if (request.method !== 'POST' || url.pathname !== '/api/public/chat') {
    return error(404, 'Không tìm thấy trang hoặc API.')
  }

  // A browser page from another origin must not be allowed to spend this key.
  // This is CSRF protection, not anti-bot authentication; WAF rules still matter.
  if (!allowedPublicOrigin(request)) {
    return error(403, 'Chỉ chấp nhận yêu cầu từ website này.')
  }
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
    return error(415, 'Yêu cầu phải ở định dạng JSON.')
  }
  if (!env.AI || !env.PUBLIC_VISITOR_QUOTA || !env.PUBLIC_CHAT_RATE_LIMITER) {
    return error(503, 'Trợ lý chưa sẵn sàng. Vui lòng thử lại sau.')
  }

  try {
    const maxTokens = publicMaxTokens(env.DSH_EDGE_PUBLIC_MAX_TOKENS)
    const payload = await readJsonObject(request, MAX_BODY_BYTES)
    const messages = validatePublicMessages(payload.messages)

    // The opaque rate-limit key is created in a private Durable Object from
    // a stable random HMAC salt; no raw IP or messages are saved to storage.
    const identity = await quotaCall(env, request, 'key')
    if (!identity.key) return error(503, 'Chưa thể xác định hạn mức truy cập.')
    const limited = await env.PUBLIC_CHAT_RATE_LIMITER.limit({ key: identity.key })
    if (!limited.success) {
      return error(429, 'Bạn đã gửi 5 yêu cầu trong một phút. Vui lòng thử lại sau một phút.')
    }
    const token = crypto.randomUUID()
    const reservation = await quotaCall(env, request, 'reserve', token)
    if (!reservation.ok) {
      return result({
        ok: false,
        error: 'Địa chỉ IP này đã sử dụng đủ 10 câu hỏi miễn phí.',
        remaining: 0,
        maxQuestionsPerIp: PUBLIC_VISITOR_MAX_QUESTIONS,
      }, 429)
    }
    try {
      const prompt: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: 'Bạn là Trợ lý Bila, trả lời bằng tiếng Việt Unicode NFC, ngắn gọn, chính xác. CVNSS4.0 là hệ ký hiệu văn bản bổ trợ ở giao diện; không mô tả suy luận nội bộ của AI. Không hiển thị phần suy luận riêng tư.' },
        ...messages,
      ]
      if (request.headers.get('accept')?.includes('text/event-stream')) {
        // Streaming starts showing answer tokens without waiting for the
        // reasoning model to finish its entire output. Legacy JSON stays intact.
        const source = await env.AI.run(PUBLIC_AI_MODEL, {
          messages: prompt,
          max_tokens: maxTokens,
          stream: true,
        })
        if (!source || typeof (source as ReadableStream<Uint8Array>).getReader !== 'function') {
          throw new Error('Workers AI did not return an SSE stream.')
        }
        return streamPublicAnswer(source as ReadableStream<Uint8Array>, env, request, token)
      }
      const reply = await env.AI.run(PUBLIC_AI_MODEL, {
        messages: prompt,
        max_tokens: maxTokens,
        stream: false,
      })
      const rawAnswer = typeof reply === 'object' && reply !== null
        && 'response' in reply && typeof reply.response === 'string' ? reply.response : ''
      // The distill model may include internal <think> blocks; never display them.
      const answer = rawAnswer.replace(/<think>[\s\S]*?<\/think>/giu, '')
        .replace(/<think>[\s\S]*$/giu, '').trim()
      if (!answer) throw new Error('Empty AI response')
      const committed = await quotaCall(env, request, 'finish', token, true)
      if (!committed.ok) throw new Error('Quota confirmation failed')
      return result({
        ok: true, answer: answer.normalize('NFC'), model: PUBLIC_AI_MODEL,
        remaining: committed.remaining,
        maxQuestionsPerIp: PUBLIC_VISITOR_MAX_QUESTIONS,
      })
    } catch (cause) {
      // No question is charged for provider failure / exhausted free allocation.
      await quotaCall(env, request, 'finish', token, false).catch(() => undefined)
      if (isFreeTierAllowanceError(cause)) {
        return error(429, 'Hạn mức AI miễn phí của Cloudflare hôm nay đã hết. Hạn mức được cấp lại lúc 07:00 mỗi ngày (giờ Việt Nam). Vui lòng thử lại sau.')
      }
      return error(503, 'Dịch vụ AI đang bận hoặc tạm gián đoạn. Bạn chưa bị trừ lượt hỏi.')
    }
  } catch (cause) {
    if (cause instanceof EdgeHttpError) return error(cause.status, cause.message)
    // Never log or echo prompts, visitor IP, headers or internal provider errors.
    return error(503, 'Không thể kết nối tới dịch vụ AI hoặc bộ đếm. Vui lòng thử lại sau.')
  }
}

/** Cloudflare code 3036: daily free allowance exceeded. Never echo provider errors. */
export function isFreeTierAllowanceError(cause: unknown): boolean {
  if (!cause || typeof cause !== 'object') return false
  const obj = cause as { code?: number | string; message?: string; cause?: unknown }
  if (String(obj.code) === '3036') return true
  if (typeof obj.message === 'string' &&
      /3036|daily free allocation|free tier.*exceed|10[,]?000 neurons|account limited/iu.test(obj.message)) return true
  return Boolean(obj.cause && obj.cause !== cause && isFreeTierAllowanceError(obj.cause))
}

/**
 * Stream only the public answer to browsers; the quota is committed exactly
 * once after receiving a complete nonempty answer, then a done event is sent.
 * On an AI failure or disconnect, refund the reservation. No prompts are logged.
 */
function streamPublicAnswer(
  source: ReadableStream<Uint8Array>,
  env: PublicChatEnv,
  request: Request,
  token: string,
): Response {
  let disconnected = false
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      void (async () => {
        let answered = ''
        const filter = createThinkFilter()
        try {
          controller.enqueue(sseFrame({ type: 'status', text: 'Bila đang soạn câu trả lời…' }))
          for await (const raw of readAiStream(source)) {
            if (disconnected) throw new Error('Client disconnected')
            const safeText = filter.push(raw)
            if (safeText) {
              answered += safeText
              controller.enqueue(sseFrame({ type: 'delta', text: safeText }))
            }
          }
          const tail = filter.finish()
          if (tail) {
            answered += tail
            controller.enqueue(sseFrame({ type: 'delta', text: tail }))
          }
          if (!answered.trim()) throw new Error('Empty answer')
          const committed = await quotaCall(env, request, 'finish', token, true)
          if (!committed.ok) throw new Error('Quota commit did not succeed')
          controller.enqueue(sseFrame({
            type: 'done', remaining: committed.remaining,
            maxQuestionsPerIp: PUBLIC_VISITOR_MAX_QUESTIONS,
          }))
        } catch (cause) {
          await quotaCall(env, request, 'finish', token, false).catch(() => undefined)
          if (!disconnected) {
            controller.enqueue(sseFrame({
              type: 'error',
              message: isFreeTierAllowanceError(cause)
                ? 'Hạn mức AI miễn phí của Cloudflare hôm nay đã hết. Vui lòng thử lại sau 07:00 (giờ Việt Nam).'
                : 'Bila tạm thời chưa trả lời được. Bạn chưa bị trừ lượt hỏi.',
            }))
          }
        } finally {
          if (!disconnected) controller.close()
        }
      })().catch(() => {
        // Keep no diagnostic logs of prompt, identity, headers or provider body.
        if (!disconnected) {
          try { controller.close() } catch { /* already closed */ }
        }
      })
    },
    cancel() {
      disconnected = true
      void source.cancel().catch(() => undefined)
    },
  })
  const h = headers('text/event-stream; charset=utf-8')
  h.set('x-accel-buffering', 'no')
  return new Response(stream, { headers: h })
}
