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
