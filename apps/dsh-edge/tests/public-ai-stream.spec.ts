import { describe, expect, it } from 'vitest'
import { aiStreamDelta, createThinkFilter, createPublicTraceSplitter, readAiStream, sseFrame } from '../src/public-ai-stream.ts'
import { handlePublicChatRoute } from '../src/public-chat.ts'
import type { PublicChatEnv } from '../src/public-chat.ts'

function sampleStream(): ReadableStream<Uint8Array> {
  const text = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      // Force awkward chunk boundaries, including a fragmented <think> block.
      for (const chunk of [
        'data: {"response":"<thi',
        'nk>nội bộ</th',
        'ink>Xin chào"}\n\n',
        'data: {"response":" bạn!"}\n\n',
        'data: [DONE]\n\n',
      ]) controller.enqueue(text.encode(chunk))
      controller.close()
    },
  })
}

describe('Cloudflare Workers AI incremental streaming', () => {
  it('parses official SSE frames without exposing provider metadata', async () => {
    expect(aiStreamDelta('data: {"response":"chào"}')).toEqual({ text: 'chào', done: false })
    expect(aiStreamDelta('data: [DONE]')).toEqual({ text: '', done: true })
    expect(aiStreamDelta('data: {"reasoning_content":"private"}').text).toBe('')
    const bits: string[] = []
    for await (const bit of readAiStream(sampleStream())) bits.push(bit)
    expect(bits).toEqual(['<think>nội bộ</think>Xin chào', ' bạn!'])
  })
  it('hides fragmented internal DeepSeek reasoning without deleting the public answer', () => {
    const filter = createThinkFilter()
    const out = filter.push('<thi') + filter.push('nk>private') +
      filter.push(' thought</think>Xin ch') + filter.push('ào bạn!') + filter.finish()
    expect(out).toBe('Xin chào bạn!')
    expect(out).not.toContain('private')
  })

  it('streams only question-specific public summaries and a separate final answer across fragmented tags', () => {
    const filter = createThinkFilter()
    const parser = createPublicTraceSplitter()
    const source = '<think>Không công khai dữ liệu riêng</think><public_steps>\n- Phân tích dữ kiện CVNSS4.0.\n- Đối chiếu ý nghĩa các thuật ngữ.\n</public_steps><final_answer>Đây là trả lời cuối.</final_answer>'
    let publicTrace = '', answer = ''
    for (let index = 0; index < source.length; index += 3) {
      const safe = filter.push(source.slice(index, index + 3))
      const part = parser.push(safe)
      publicTrace += part.trace
      answer += part.answer
    }
    const filteredEnd = parser.push(filter.finish())
    publicTrace += filteredEnd.trace
    answer += filteredEnd.answer
    const finish = parser.finish()
    publicTrace += finish.trace
    answer += finish.answer
    expect(publicTrace).toContain('Phân tích dữ kiện CVNSS4.0')
    expect(publicTrace).not.toContain('Không công khai')
    expect(answer).toContain('Đây là trả lời cuối.')
    expect(answer).not.toContain('public_steps')
  })
  it('falls back to a plain answer when the model does not follow the public-summary format', () => {
    const parser = createPublicTraceSplitter()
    const response = parser.push('**Câu trả lời bình thường**')
    const tail = parser.finish()
    expect(response.trace + tail.trace).toBe('')
    expect(response.answer + tail.answer).toBe('**Câu trả lời bình thường**')
  })
  it('formats a complete JSON SSE frame', () => {
    const str = new TextDecoder().decode(sseFrame({ type: 'delta', text: 'Xin chào' }))
    expect(str).toBe('data: {"type":"delta","text":"Xin chào"}\n\n')
  })
  it('streams answer and commits just one successful quota slot', async () => {
    let used = 0
    const pending = new Set<string>()
    const responses = {
      getByName: () => ({ fetch: async (request: Request) => {
        const input = await request.json() as { token?: string; success?: boolean }
        const op = new URL(request.url).pathname
        if (op === '/key') return Response.json({ ok: true, key: 'visitor-v1:opaque' })
        if (op === '/reserve') {
          pending.add(input.token ?? '')
          return Response.json({ ok: true })
        }
        if (op === '/finish') {
          if (!pending.delete(input.token ?? '')) return Response.json({ ok: false })
          if (input.success) used++
          return Response.json({ ok: true, used, remaining: 10 - used })
        }
        return Response.json({ ok: false }, { status: 404 })
      } }),
    }
    const env = {
      AI: { run: async () => sampleStream() },
      PUBLIC_VISITOR_QUOTA: responses,
      PUBLIC_CHAT_RATE_LIMITER: { limit: async () => ({ success: true }) },
    } as unknown as PublicChatEnv
    const base = 'https://bilabot2.example'
    const request = new Request(base + '/api/public/chat', {
      method: 'POST',
      headers: {
        origin: base, 'cf-connecting-ip': '192.0.2.43',
        'content-type': 'application/json', accept: 'text/event-stream',
      },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Xin chào' }] }),
    })
    const response = await handlePublicChatRoute(request, env)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/event-stream')
    const body = await response.text()
    const events = body.trim().split(/\r?\n\r?\n/u)
      .map(part => JSON.parse(part.slice(6)) as Record<string, unknown>)
    const answer = events.filter(e => e.type === 'delta').map(e => e.text).join('')
    expect(answer).toBe('Xin chào bạn!')
    expect(body).not.toContain('private')
    expect(events.at(-1)).toMatchObject({ type: 'done', remaining: 9 })
    expect(used).toBe(1)
    expect(pending.size).toBe(0)
  })
})
