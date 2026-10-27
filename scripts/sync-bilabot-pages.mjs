/** Keep GitHub Pages static UI in sync with the Cloudflare-served public UI.
 * Usage: node scripts/sync-bilabot-pages.mjs [--check]
 * No DeepSeek key is read or serialized.
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'

const root = fileURLToPath(new URL('..', import.meta.url))
const workerUrl = 'https://bilabot2.bilabot-cvnss4-71bd4651.workers.dev'
const read = path => readFile(join(root, path), 'utf8')
const template = await read('apps/dsh-edge/src/public-chat-page.ts')

// UI source is a pair of constant string expressions (not a third-party template).
const { publicChatHtml, publicChatJavascript } = runInNewContext(
  template.replace(/^export const /gmu, 'const ')
    + '\n({publicChatHtml,publicChatJavascript})',
  Object.create(null),
  { timeout: 5000 },
)
if (typeof publicChatHtml !== 'string' || typeof publicChatJavascript !== 'string') {
  throw new Error('Public UI constants must be strings.')
}

const codec = await read('apps/dsh-edge/src/cvnss-converter-bundle.ts')
const prefix = 'export const cvnssConverterSource: string = '
const location = codec.indexOf(prefix)
if (location < 0) throw new Error('Missing audited CVNSS converter source.')
const converter = JSON.parse(codec.slice(location + prefix.length).trim().replace(/;$/u, ''))
if (!converter.includes('5.0.0-audit-safe')) throw new Error('Wrong converter version.')

const html = publicChatHtml
  .replace('src="/public/cvnss.js"', 'src="./public/cvnss.js"')
  .replace('src="/public/app.js"', 'src="./public/app.js"')
  .replace('href="/login"', `href="${workerUrl}/login"`)
  .replace('</head>', '<meta name="description" content="BilaBot · Trợ lý AI tiếng Việt với giao diện sáng CVNSS4.0, xử lý DeepSeek qua Cloudflare."><link rel="canonical" href="https://xulytiengviet.github.io/Bilabot2/"></head>')
const js = publicChatJavascript
  .replaceAll("fetch('/api/public/chat'", `fetch('${workerUrl}/api/public/chat'`)
  .replaceAll("fetch('/api/public/config'", `fetch('${workerUrl}/api/public/config'`)
const files = {
  'docs/index.html': html,
  'docs/public/app.js': js,
  'docs/public/cvnss.js': converter,
  'index.html': html
    .replace('src="./public/cvnss.js"', 'src="./docs/public/cvnss.js"')
    .replace('src="./public/app.js"', 'src="./docs/public/app.js"'),
}
let different = false
for (const [name, value] of Object.entries(files)) {
  if (process.argv.includes('--check')) {
    const existing = await read(name).catch(() => undefined)
    if (existing !== value) {
      process.stderr.write(`GitHub Pages out of sync: ${name}\n`)
      different = true
    }
  } else {
    await mkdir(dirname(join(root, name)), { recursive: true })
    await writeFile(join(root, name), value)
    process.stdout.write(`Updated ${name} (${value.length} chars)\n`)
  }
}
if (different) process.exitCode = 1
