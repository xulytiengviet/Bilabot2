/**
 * Portable SSE helpers for the Cloudflare Workers AI text-generation stream.
 * The DeepSeek reasoning model can emit <think> tokens in partial chunks.
 * Suppress those before any user-visible data is sent to the browser.
 */
export function createThinkFilter() {
  let pending = ''
  let thinking = false
  function ingest(value: string, final = false): string {
    pending += value
    let output = ''
    for (;;) {
      if (thinking) {
        const i = pending.toLowerCase().indexOf('</think>')
        if (i === -1) {
          pending = final ? '' : pending.slice(-7)
          return output
        }
        pending = pending.slice(i + 8)
        thinking = false
      } else {
        const i = pending.toLowerCase().indexOf('<think>')
        if (i !== -1) {
          output += pending.slice(0, i)
          pending = pending.slice(i + 7)
          thinking = true
          continue
        }
        const safe = final ? pending.length : Math.max(0, pending.length - 6)
        output += pending.slice(0, safe)
        pending = pending.slice(safe)
        return output
      }
    }
  }
  return { push: (value: string) => ingest(value), finish: () => ingest('', true) }
}

export function sseFrame(frame: Record<string, unknown>): Uint8Array {
  const encoder = new TextEncoder()
  return encoder.encode(`data: ${JSON.stringify(frame)}\n\n`)
}

/** Cloudflare Workers AI SSE uses data: {"response":"..."} and data: [DONE]. */
export function aiStreamDelta(eventText: string): { text: string; done: boolean } {
  const data = eventText.split(/\r?\n/u)
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice(5).trimStart()).join('\n').trim()
  if (data === '[DONE]') return { text: '', done: true }
  if (!data) return { text: '', done: false }
  try {
    const value = JSON.parse(data) as Record<string, unknown>
    const delta = typeof value.response === 'string' ? value.response : ''
    return { text: delta, done: value.done === true }
  } catch {
    return { text: '', done: false }
  }
}

export async function* readAiStream(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      if (buffer.length > 131_072) throw new Error('AI stream event too large.')
      for (;;) {
        const match = /\r?\n\r?\n/u.exec(buffer)
        if (!match || match.index === undefined) break
        const entry = buffer.slice(0, match.index)
        buffer = buffer.slice(match.index + match[0].length)
        const parsed = aiStreamDelta(entry)
        if (parsed.text) yield parsed.text
        if (parsed.done) return
      }
    }
    buffer += decoder.decode()
    if (buffer) {
      const parsed = aiStreamDelta(buffer)
      if (parsed.text) yield parsed.text
    }
  } finally {
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}


/**
 * Tách các bước tóm tắt công khai do model chủ động tạo khỏi câu trả lời.
 * Luồng này chỉ nhận văn bản đã qua bộ lọc <think>.
 * Nếu model không sinh nhãn, vẫn phát câu trả lời bình thường.
 */
export function createPublicTraceSplitter() {
  const OPEN = '<public_steps>'
  const CLOSE = '</public_steps>'
  const ANSWER = '<final_answer>'
  let phase = 'start'
  let pending = ''
  function ingest(chunk, final = false) {
    pending += chunk
    let trace = '', answer = ''
    for (let count = 0; count < 8; count++) {
      if (phase === 'start') {
        const text = pending.trimStart()
        if (!text) { if (final) pending = ''; break }
        if (text.startsWith(OPEN)) {
          pending = text.slice(OPEN.length)
          phase = 'steps'
          continue
        }
        if (!final && OPEN.startsWith(text)) break
        phase = 'answer'
        continue
      }
      if (phase === 'steps') {
        const end = pending.indexOf(CLOSE)
        if (end >= 0) {
          trace += pending.slice(0, end)
          pending = pending.slice(end + CLOSE.length)
          phase = 'before-answer'
          continue
        }
        if (final) { answer += pending; pending = ''; phase = 'answer'; break }
        const safe = Math.max(0, pending.length - CLOSE.length + 1)
        trace += pending.slice(0, safe)
        pending = pending.slice(safe)
        break
      }
      if (phase === 'before-answer') {
        const text = pending.trimStart()
        if (!text) { if (final) pending = ''; break }
        if (text.startsWith(ANSWER)) {
          pending = text.slice(ANSWER.length)
          phase = 'answer'
          continue
        }
        if (!final && ANSWER.startsWith(text)) break
        phase = 'answer'
        continue
      }
      if (phase === 'answer') {
        answer += pending
        pending = ''
        break
      }
    }
    return { trace, answer }
  }
  return { push: value => ingest(value), finish: () => ingest('', true) }
}
