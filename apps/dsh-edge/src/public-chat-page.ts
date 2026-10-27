/** Vietnamese, minimal light-theme public BilaBot.
 * No API credentials or model editing controls are delivered to the browser.
 * Static markup/scripts only; history remains in the user's browser.
 */
export const publicChatHtml = `<!doctype html>
<html lang="vi"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer"><meta name="application-version" content="20261027-public-reason-v4"><meta name="theme-color" content="#f8fafc">
<title>BilaBot</title>
<style>
:root{color-scheme:light;--page:#f6f8fc;--paper:#fff;--ink:#19243c;--muted:#66758d;--line:#e4eaf3;--accent:#245cbd;--light:#eaf2ff;--cyan:#069aab;--shadow:0 14px 50px rgba(37,65,118,.045);font:15px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}
*{box-sizing:border-box}
body{margin:0;background:var(--page);color:var(--ink)}button,textarea{font:inherit}button{cursor:pointer}
button:focus-visible,textarea:focus-visible,a:focus-visible{outline:3px solid #93b9ff;outline-offset:2px}
button:disabled{opacity:.55;cursor:not-allowed}
.app{display:grid;grid-template-columns:268px minmax(0,1fr);min-height:100dvh;max-width:1536px;margin:auto;background:#fff;box-shadow:var(--shadow)}
.sidebar{background:#f8faff;border-right:1px solid var(--line);display:flex;flex-direction:column;padding:23px 15px 17px;gap:22px;min-width:0}
.brand{display:flex;gap:11px;align-items:center;padding:0 9px}
.brandmark{height:42px;width:42px;display:grid;place-items:center;border:1px solid #cae1fb;border-radius:15px;background:linear-gradient(135deg,#e7f3ff,#eff7ff);color:var(--accent)}
.brandmark svg{width:27px;height:27px}
.brandtext{line-height:1.24}.brandtext b{font-weight:800;font-size:20px;letter-spacing:-.6px}.brandtext span{display:block;color:var(--muted);font-size:11px;margin-top:4px}
.sectionlabel{text-transform:uppercase;font-size:10px;font-weight:750;letter-spacing:.12em;color:#8493aa;padding:0 10px}
.btn{border:1px solid var(--line);background:var(--paper);color:var(--ink);border-radius:12px;padding:10px 13px;font-weight:600;transition:background .16s,border-color .16s}
.btn:hover{background:#eff5ff;border-color:#b5cdec}
.btn.primary{background:var(--accent);border-color:var(--accent);color:white}.btn.primary:hover{background:#194b9e}
.create{width:100%;text-align:left;display:flex;align-items:center;gap:9px}
.history{overflow:auto;display:grid;gap:5px;align-content:start;min-height:0;max-height:37vh}
.history button{background:transparent;border:1px solid transparent;text-align:left;color:#53647f;padding:10px 12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-radius:10px}
.history button:hover{background:#eff4fe}.history button.active{background:#e8f0fd;border-color:#d5e5fb;color:#2157b2;font-weight:650}
.sidebar-end{margin-top:auto;display:grid;gap:11px}
.meta-panel{border:1px solid #e3ebf7;background:#fff;border-radius:15px;padding:13px 14px}
.metalabel{font-weight:700;font-size:12px;margin-bottom:7px;color:#334766}
.pipeline{display:flex;align-items:center;gap:5px;flex-wrap:wrap;font-size:10.5px;font-weight:700;color:#37649d}
.pipeline span{padding:4px 7px;border-radius:7px;background:#eff5fd}
.note{font-size:11px;color:var(--muted);line-height:1.6}
.workspace{min-width:0;display:flex;flex-direction:column;height:100dvh}
.topbar{min-height:77px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:16px;padding:15px clamp(18px,3vw,40px);background:#fff}
.topinfo{min-width:0}.topinfo b{font-size:15px}.topinfo p{font-size:11.5px;margin:3px 0 0;color:var(--muted)}
.top-right{display:flex;align-items:center;gap:12px;min-width:0}
.model{font-size:11px;color:#315482;background:#f0f5fc;padding:7px 10px;border:1px solid #e0eaf8;border-radius:99px;white-space:nowrap;max-width:205px;overflow:hidden;text-overflow:ellipsis}
.status{display:flex;gap:6px;align-items:center;font-size:11.5px;color:#32705e;white-space:nowrap}
.dot{width:7px;height:7px;border-radius:50%;background:#2cb895;flex-shrink:0}
#toggle-sidebar{display:none}
#messages{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:23px;padding:26px clamp(18px,5.5vw,90px);scroll-behavior:smooth}
.hero{max-width:580px;margin:auto;text-align:center;display:grid;justify-items:center;gap:12px;padding:28px 5px}
.heroicon{width:86px;height:86px;display:grid;place-items:center;border-radius:28px;border:1px solid #d9e8ff;background:radial-gradient(circle at 20% 20%,#fff,#eaf4ff);box-shadow:0 12px 30px #dfeafa88}
.heroicon svg{width:62px;height:62px;color:#2b72c5}
.hero h1{font-size:clamp(23px,3.5vw,32px);line-height:1.25;letter-spacing:-1px;margin:5px 0 0}
.hero p{font-size:14px;color:var(--muted);margin:0;max-width:440px}
.hero .sublabel{font-size:11.5px;font-weight:700;color:#3570bd;letter-spacing:.08em}
.suggestions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;width:100%;margin-top:17px}
.suggestions button{padding:12px;text-align:left;background:#fff;border:1px solid var(--line);border-radius:13px;font-size:12px;color:#425874}
.suggestions button:hover{border-color:#91b8f5;background:#f8fbff}
.msg{max-width:860px;width:100%;display:flex;gap:12px;align-self:center;align-items:flex-start}
.avatar{width:32px;height:32px;display:grid;place-items:center;border-radius:11px;background:#eaf3ff;border:1px solid #d8e8ff;color:#2b65b4;flex:0 0 auto;margin-top:2px}
.avatar svg{width:20px;height:20px}.msg.user .avatar{color:#5d6b81;background:#eef2f8;border-color:#e7edf5}
.msg-body{min-width:0;flex:1}
.msg-meta{font-size:11px;color:#65768e;font-weight:700;margin-bottom:6px}
.msg-text{white-space:pre-wrap;word-break:break-word;color:#25334b;font-size:14px;line-height:1.75}
.msg.user .msg-text{background:#eff5ff;border:1px solid #e0ebfd;border-radius:13px;padding:12px 15px}
.msg.assistant .msg-body{border-bottom:1px solid #edf1f8;padding-bottom:17px}
.cvnss-detail{margin-top:12px;border:1px solid #e0ebf7;border-radius:11px;overflow:hidden;max-width:100%}
.cvnss-detail summary{cursor:pointer;background:#f8fbff;color:#3a6496;font-size:11.5px;font-weight:650;padding:9px 12px}
.cvnss-detail pre{background:#f7f9fd;white-space:pre-wrap;overflow-wrap:anywhere;max-height:230px;overflow:auto;margin:0;padding:13px;color:#3f5c83;font:12px/1.65 Consolas,monospace}
.cvnss-detail small{display:block;font-size:10px;color:#7a8ca4;padding:8px 12px}
.composer{background:linear-gradient(180deg,#fff 0%,#fbfcff 100%);border-top:1px solid var(--line);padding:18px clamp(18px,5.5vw,90px) 15px}
.composebox{max-width:900px;margin:auto;border:1px solid #d5e1f1;background:white;border-radius:17px;box-shadow:0 5px 24px rgba(37,66,130,.055);padding:12px}
.composebox:focus-within{border-color:#8bb5f2;box-shadow:0 0 0 3px #e8f1ff}
#prompt{border:0;outline:0;width:100%;resize:vertical;max-height:205px;min-height:58px;padding:3px 5px;background:transparent;color:var(--ink);font-size:14px;line-height:1.6}
#prompt::placeholder{color:#8c9ab1}
.compose-actions{display:flex;justify-content:space-between;align-items:center;gap:12px}
.tools{display:flex;gap:7px;flex-wrap:wrap}.tools .btn{padding:6px 9px;font-size:11.5px;color:#687b96;font-weight:550}
#send{padding:9px 19px;font-size:12px}
.disclaimer{text-align:center;margin:9px auto 0;max-width:900px;font-size:10.5px;color:#8895a9}
.notice{max-width:900px;margin:9px auto 0;padding:9px 12px;background:#fff6ec;border:1px solid #f8dec0;border-radius:9px;font-size:12px;color:#96541b;text-align:center}
.notice[hidden]{display:none}
.quota-info{margin:5px auto 0;text-align:center;font-size:11px;color:#3c689d}.quota-info[hidden]{display:none}
.credits{flex-shrink:0;text-align:center;background:#fbfcff;border-top:1px solid var(--line);padding:10px 18px;color:#687993;font-size:11px;line-height:1.6}
.credits strong{font-weight:700;color:#3d506d}
@media(max-width:830px){.credits{padding:9px 14px;font-size:10px}.credit-sep{display:none}}

@media(max-width:830px){.app{grid-template-columns:1fr}.sidebar{position:fixed;z-index:20;top:0;bottom:0;left:0;box-shadow:12px 0 40px #16284e20;width:min(300px,88vw);transform:translateX(-110%);transition:transform .2s}.sidebar.open{transform:translateX(0)}
#toggle-sidebar{display:block}.topbar{min-height:68px;padding:11px 15px}.workspace{height:100dvh}.top-right{gap:7px}.model{max-width:138px}.status{display:none}
#messages{padding:24px 17px;gap:17px}.composer{padding:12px 12px 13px}.msg{gap:8px}.suggestions{grid-template-columns:1fr}.hero{padding:15px 4px}.disclaimer{font-size:9px}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}

/* Luồng tiến trình CVNSS4.0, câu trả lời Unicode đọc được, an toàn XSS. */
.reasoning-panel{margin:6px 0 14px;border:1px solid #e2eaf5;border-radius:14px;background:#f9fbff;overflow:hidden;box-shadow:0 3px 12px #12376508}
.reasoning-panel summary{display:flex;align-items:center;gap:9px;list-style:none;cursor:pointer;padding:11px 13px;font-size:12px;font-weight:700;color:#315f94}
.reasoning-panel summary::-webkit-details-marker{display:none}
.reason-symbol{color:#159bb9;font-size:18px;line-height:1}
.reason-status{margin-left:auto;color:#188566;border:1px solid #cfe9e1;background:#eaf8f2;border-radius:99px;padding:3px 9px;font-size:10px;white-space:nowrap}
.reasoning-panel.streaming .reason-status{background:#e7f2ff;color:#286ba9;border-color:#d3e6ff;animation:bila-pulse 1.45s ease-in-out infinite}
.reason-code{margin:0;background:#f9fbff;color:#506a86;border-top:1px solid #e7eef8;border-left:2px solid #bcd8f4;padding:14px 16px;font:12.5px/1.95 Consolas,monospace;max-height:295px;overflow-y:auto;white-space:pre-wrap;overflow-wrap:anywhere}
.pending-answer{font-style:italic;color:#8a99ac!important}
.rich-answer{white-space:normal;line-height:1.8}
.rich-answer p{margin:0 0 12px}.rich-answer p:last-child{margin-bottom:0}
.rich-answer h2{font-size:17px;margin:17px 0 8px;line-height:1.45;color:#1b466e}
.rich-answer h3{font-size:15px;margin:14px 0 7px;line-height:1.45;color:#285a83}
.rich-answer ul,.rich-answer ol{padding-left:25px;margin:6px 0 14px}
.rich-answer li{margin:6px 0;padding-left:3px}
.rich-answer strong{font-weight:750;color:#163956}
.rich-answer em{font-style:italic}
.rich-answer code{font:12.5px/1.6 Consolas,monospace;background:#eaf1fb;color:#1b6790;border-radius:5px;padding:2px 5px;overflow-wrap:anywhere}
.rich-answer pre{padding:13px 15px;border-radius:12px;background:#17283e;color:#e0eeff;overflow:auto;margin:10px 0 16px;white-space:pre;font:12px/1.7 Consolas,monospace}
.rich-answer pre code{padding:0;background:transparent;color:inherit;overflow-wrap:normal}
.rich-answer blockquote{border-left:3px solid #5d99e1;background:#f4f8ff;color:#456488;padding:6px 12px;margin:10px 0}
.rich-answer a{color:#225eb9;text-decoration:underline;text-underline-offset:2px}
.answer-table{max-width:100%;overflow-x:auto;margin:10px 0}
.answer-table table{width:100%;border-collapse:collapse;font-size:12px}
.answer-table th,.answer-table td{border:1px solid #dbe6f2;padding:9px 11px;text-align:left}
.answer-table th{background:#edf4ff;color:#305781}
@keyframes bila-pulse{50%{opacity:.6}}
@media(max-width:600px){.reason-code{font-size:11px}.reasoning-panel summary{flex-wrap:wrap}}
@media(prefers-reduced-motion:reduce){.reasoning-panel.streaming .reason-status{animation:none}}
</style><meta name="description" content="BilaBot · Trợ lý AI tiếng Việt với giao diện sáng CVNSS4.0, xử lý DeepSeek qua Cloudflare."><link rel="canonical" href="https://xulytiengviet.github.io/Bilabot2/"></head>
<body><div class="app">
<aside class="sidebar" id="sidebar">
  <div class="brand"><div class="brandmark" aria-hidden="true"><svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M32 13C22 4 8 11 11 24c-8 6-7 17 1 21-1 12 14 17 20 6 6 11 21 6 20-6 8-4 9-15 1-21C56 11 42 4 32 13Z"/><path d="M32 13v38M19 23l7 6-6 8M45 23l-7 6 6 8"/><circle cx="26" cy="29" r="2" fill="currentColor" stroke="none"/><circle cx="38" cy="29" r="2" fill="currentColor" stroke="none"/></svg></div>
    <div class="brandtext"><b>BilaBot</b></div>
  </div>
  <button class="btn primary create" id="new">＋ &nbsp;Cuộc trò chuyện mới</button>
  <section><div class="sectionlabel">Lịch sử trên thiết bị</div><nav id="history" class="history" aria-label="Các cuộc trò chuyện"></nav></section>

</aside>
<main class="workspace">
<header class="topbar"><div class="topinfo"><button class="btn" id="toggle-sidebar" aria-label="Mở danh sách hội thoại">☰</button> <b>BilaBot</b></div>

</header>
<section id="messages" aria-live="polite"></section>
<div class="composer"><form id="chat-form" class="composebox"><label for="prompt" class="sectionlabel">Tin nhắn của bạn</label>
  <textarea id="prompt" maxlength="6000" required aria-label="Nhập tin nhắn" placeholder="Nhập câu hỏi bằng tiếng Việt..."></textarea>
  <div class="compose-actions"><div class="tools"><button class="btn" id="export" type="button" title="Tải lịch sử JSON">↓ Xuất lịch sử</button><button class="btn" id="clear" type="button" title="Xóa lịch sử trên trình duyệt">Xóa lịch sử</button></div><button id="send" class="btn primary" type="submit">Gửi ↗</button></div>
</form><p id="notice" class="notice" role="status" aria-live="polite" hidden></p><p class="disclaimer">Tối đa 10 câu hỏi tổng cộng cho mỗi IP · Tối đa 5 yêu cầu/phút. Đừng gửi dữ liệu nhạy cảm.</p><p class="quota-info" id="quota-info" aria-live="polite" hidden></p></div>
<footer class="credits">@2026, <strong>Trần Tư Bình</strong> và <strong>Kiều Trường Lâm</strong> phát kiến CVNSS4.0 <span class="credit-sep">·</span> Nguồn: <strong>Long Ngo</strong> phát triển · Giấy phép MIT</footer>
</main></div>
<script src="/public/cvnss.js?v=20261027-public-reason-v4" defer></script><script src="/public/app.js?v=20261027-public-reason-v4" defer></script>
</body></html>`;

export const publicChatJavascript = String.raw`'use strict';
(() => {
  const KEY = 'bilabot-public-chats-v1';
  const $ = id => document.getElementById(id);
  const brainSvg = '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M32 13C22 4 8 11 11 24c-8 6-7 17 1 21-1 12 14 17 20 6 6 11 21 6 20-6 8-4 9-15 1-21C56 11 42 4 32 13Z"/><path d="M32 13v38M19 23l7 6-6 8M45 23l-7 6 6 8"/></svg>';
  const converter = window.CVNSSConverter;
  const version = converter && converter.VERSION === '5.0.0-audit-safe';
  const validMessage = m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string';

  // Chỉ diễn giải tiến trình xử lý thực tế, không mô phỏng chain-of-thought.
  const traceStart = 'Đã tiếp nhận câu hỏi.\nĐã chuẩn bị ngữ cảnh hội thoại.\nĐang chờ Cloudflare Workers AI trả lời.';
  const traceDone = 'Đã tiếp nhận câu hỏi.\nĐã gửi yêu cầu tới Cloudflare Workers AI.\nĐã nhận câu trả lời từ mô hình.\nĐã hoàn thiện nội dung tiếng Việt Unicode.';
  const cleanAnswer = raw => String(raw || '').replace(/<think>[\s\S]*?<\/think>/giu, '')
    .replace(/<think>[\s\S]*$/giu, '').replace(/<\/final_answer>\s*$/giu, '').trim().normalize('NFC');
  function appendInline(target, raw) {
    const value = String(raw).replace(/\\([*#_])/g, '$1');
    const rx = /(\*\*[^*\n]+?\*\*|__[^_\n]+?__|\x60[^\x60\n]+\x60|\*[^*\n]+?\*|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\))/g;
    let last = 0, match;
    const plain = str => target.append(document.createTextNode(str.replace(/\*\*/g, '').replace(/__+/g, '')));
    while ((match = rx.exec(value))) {
      if (match.index > last) plain(value.slice(last, match.index));
      const token = match[0];
      let node;
      if (token.startsWith('**') || token.startsWith('__')) {
        node = document.createElement('strong'); node.textContent = token.slice(2, -2);
      } else if (token.charCodeAt(0) === 96) {
        node = document.createElement('code'); node.textContent = token.slice(1, -1);
      } else if (token.startsWith('*')) {
        node = document.createElement('em'); node.textContent = token.slice(1, -1);
      } else {
        const matchLink = /^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/.exec(token);
        if (matchLink) {
          node = document.createElement('a'); node.href = matchLink[2]; node.target = '_blank';
          node.rel = 'noopener noreferrer'; node.textContent = matchLink[1];
        } else node = document.createTextNode(token);
      }
      target.append(node); last = rx.lastIndex;
    }
    if (last < value.length) plain(value.slice(last));
  }
  function renderAnswer(target, raw) {
    target.replaceChildren();
    const lines = cleanAnswer(raw).replace(/\r\n?/g, '\n').split('\n');
    const fence = String.fromCharCode(96).repeat(3);
    let para = [], list = null, inCode = false, codeLines = [];
    const flush = () => {
      if (!para.length) return;
      const p = document.createElement('p'); appendInline(p, para.join(' '));
      target.append(p); para = [];
    };
    const flushCode = () => {
      const pre = document.createElement('pre'), code = document.createElement('code');
      code.textContent = codeLines.join('\n'); pre.append(code); target.append(pre);
      codeLines = [];
    };
    const cells = text => text.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(x => x.trim());
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i], trimmed = line.trim();
      if (trimmed.startsWith(fence)) {
        if (inCode) { flushCode(); inCode = false; }
        else { flush(); list = null; inCode = true; }
        continue;
      }
      if (inCode) { codeLines.push(line); continue; }
      if (!trimmed) { flush(); list = null; continue; }
      if (trimmed.startsWith('|') && i + 1 < lines.length &&
          /^\s*\|?\s*:?-{3,}:?[\s|:-]*$/.test(lines[i + 1])) {
        flush(); list = null;
        const table = document.createElement('table'), head = document.createElement('thead');
        const headRow = document.createElement('tr');
        for (const cell of cells(line)) {
          const th = document.createElement('th'); appendInline(th, cell); headRow.append(th);
        }
        head.append(headRow); table.append(head); i++;
        const tbody = document.createElement('tbody');
        while (i + 1 < lines.length && lines[i + 1].trim().startsWith('|')) {
          i++; const tr = document.createElement('tr');
          for (const cell of cells(lines[i])) {
            const td = document.createElement('td'); appendInline(td, cell); tr.append(td);
          }
          tbody.append(tr);
        }
        table.append(tbody);
        const wrap = document.createElement('div'); wrap.className = 'answer-table';
        wrap.append(table); target.append(wrap); continue;
      }
      const heading = /^\s{0,3}(#{1,6})\s*(.+?)\s*#*\s*$/.exec(line);
      if (heading) {
        flush(); list = null;
        const h = document.createElement(heading[1].length < 3 ? 'h2' : 'h3');
        appendInline(h, heading[2]); target.append(h); continue;
      }
      const ul = /^\s*[-*+]\s+(.+)$/.exec(line), ol = /^\s*(\d+)[.)]\s+(.+)$/.exec(line);
      if (ul || ol) {
        flush();
        const tag = ol ? 'ol' : 'ul';
        if (!list || list.tagName.toLowerCase() !== tag) {
          list = document.createElement(tag);
          if (ol && Number(ol[1]) > 1) list.start = Number(ol[1]);
          target.append(list);
        }
        const li = document.createElement('li'); appendInline(li, ul ? ul[1] : ol[2]); list.append(li);
        continue;
      }
      if (/^\s*>\s?/.test(line)) {
        flush(); list = null; const q = document.createElement('blockquote');
        appendInline(q, line.replace(/^\s*>\s?/, '')); target.append(q); continue;
      }
      list = null; para.push(trimmed);
    }
    flush();
    if (inCode) flushCode();
  }
  function updateProgress(card, message, seconds, note) {
    if (!card || !card.isConnected) return;
    if (typeof note === 'string') card.dataset.publicNotes = note.slice(0, 2400);
    const status = card.querySelector('.reason-status');
    const content = card.querySelector('.reason-code');
    if (status) status.textContent = message;
    if (content) {
      const text = (card.dataset.publicNotes || '').trim();
      content.textContent = cvssPreview(text || traceStart);
    }
  }

  let chats = [], current = '', busy = false;
  function showNotice(message) {
    const notice = $('notice');
    notice.textContent = message || '';
    notice.hidden = !message;
  }
  try {
    const old = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (Array.isArray(old)) chats = old.filter(c => c && typeof c.id === 'string' && Array.isArray(c.messages))
      .slice(-32).map(c => ({
        id: c.id,
        title: String(c.title || 'Cuộc trò chuyện').slice(0, 60),
        messages: c.messages.filter(validMessage).slice(-80)
      }));
  } catch { chats = []; }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(chats.slice(-32))); }
    catch { showNotice('Bộ nhớ trình duyệt đã đầy. Bạn có thể xuất hoặc xóa lịch sử.'); }
  }
  function active() { return chats.find(c => c.id === current); }
  function closeSidebar() { $('sidebar').classList.remove('open'); }
  function newChat() {
    const c = { id: crypto.randomUUID(), title: 'Cuộc trò chuyện mới', messages: [] };
    chats.push(c); current = c.id; save(); closeSidebar(); render();
  }
  function hero() {
    const el = document.createElement('div');
    el.className = 'hero';
    const icon = document.createElement('div');
    icon.className = 'heroicon';
    icon.innerHTML = brainSvg;
    const tag = document.createElement('div');
    tag.className = 'sublabel'; tag.textContent = 'BILA · TRỢ LÝ CỦA BẠN';
    const h = document.createElement('h1'); h.textContent = 'Xin chào, tôi là BilaBot';
    const p = document.createElement('p');
    p.textContent = 'Đặt câu hỏi và nhận câu trả lời bằng tiếng Việt tự nhiên.';
    el.append(icon, tag, h, p);
    const choices = [['Hướng dẫn học lập trình', 'Gợi ý lộ trình học lập trình'],
      ['Giải thích một khái niệm', 'Giải thích GIS và bản đồ số'],
      ['Viết một đoạn văn', 'Viết đoạn văn ngắn về khoa học']];
    const suggestions = document.createElement('div');
    suggestions.className = 'suggestions';
    for (const [label, prompt] of choices) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
      b.addEventListener('click', () => { $('prompt').value = prompt; $('prompt').focus(); });
      suggestions.append(b);
    }
    el.append(suggestions); return el;
  }
  function cvssPreview(text) {
    if (!version) return 'Không tải được bộ chuyển đổi CVNSS4.0 v5.0.0-audit-safe.';
    try { return String(converter.fromCqn(text.normalize('NFC')).cvss || ''); }
    catch { return 'Không thể mã hóa nội dung này bằng CVNSS4.0.'; }
  }
  function createMessage(msg) {
    const section = document.createElement('article');
    section.className = 'msg ' + msg.role;
    const avatar = document.createElement('div'); avatar.className = 'avatar';
    if (msg.role === 'assistant') avatar.innerHTML = brainSvg;
    else avatar.textContent = '●';
    const body = document.createElement('div'); body.className = 'msg-body';
    const meta = document.createElement('div'); meta.className = 'msg-meta';
    meta.textContent = msg.role === 'user' ? 'Bạn' : 'BilaBot';
    body.append(meta);
    if (msg.role === 'assistant' && (msg.pending || msg.trace)) {
      const details = document.createElement('details');
      details.className = 'reasoning-panel' + (msg.pending ? ' streaming' : ' complete');
      details.open = Boolean(msg.pending);
      const summary = document.createElement('summary');
      const symbol = document.createElement('span'); symbol.className = 'reason-symbol'; symbol.textContent = '◈';
      const heading = document.createElement('span'); heading.textContent = 'Tôi đang suy nghĩ...';
      const status = document.createElement('span'); status.className = 'reason-status';
      status.textContent = msg.pending ? 'Đang xử lý' : (msg.elapsed ? msg.elapsed + ' giây' : 'Hoàn tất');
      summary.append(symbol, heading, status);
      const pre = document.createElement('pre'); pre.className = 'reason-code';
      pre.textContent = cvssPreview(msg.trace || traceStart);
      details.append(summary, pre); body.append(details);
    }
    const text = document.createElement('div');
    text.className = 'msg-text' + (msg.role === 'assistant' ? ' rich-answer' : '');
    if (msg.pending) {
      text.classList.add('pending-answer'); text.textContent = 'BilaBot đang chuẩn bị câu trả lời…';
    } else if (msg.role === 'assistant') renderAnswer(text, msg.content);
    else text.textContent = msg.content.normalize('NFC');
    body.append(text);
    section.append(avatar, body); return section;
  }
  function render() {
    $('history').replaceChildren();
    for (const c of chats.slice().reverse()) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = c.id === current ? 'active' : '';
      b.title = c.title; b.textContent = c.title;
      b.addEventListener('click', () => { if (!busy) { current = c.id; closeSidebar(); render(); } });
      $('history').append(b);
    }
    $('messages').replaceChildren();
    const messages = active()?.messages || [];
    if (messages.length === 0) $('messages').append(hero());
    else for (const [i, m] of messages.entries()) {
      const item = createMessage(m);
      if (i === messages.length - 1 && m.role === 'assistant' && m.trace) {
        const details = item.querySelector('.reasoning-panel');
        if (details) details.open = true;
      }
      $('messages').append(item);
    }
    $('messages').scrollTop = $('messages').scrollHeight;
  }
  function lock(value) {
    busy = value;
    $('send').disabled = value; $('prompt').disabled = value;
    $('clear').disabled = value; $('new').disabled = value;
    $('send').textContent = value ? 'Đang trả lời…' : 'Gửi ↗';
  }
  function boundedContext(messages) {
    // Older clients could leave consecutive user-only messages after failed
    // API calls. Send only alternating roles to the AI backend.
    const a = [];
    for (const message of messages.filter(validMessage).slice(-19)) {
      if (a.length && a[a.length - 1].role === message.role) a[a.length - 1] = message;
      else a.push(message);
    }
    let total = a.reduce((n, m) => n + m.content.length, 0);
    while (total > 26000 && a.length > 1) total -= a.shift().content.length;
    return a.map(m => ({ role: m.role, content: m.content }));
  }
  async function readAnswer(response, card) {
    const kind = response.headers.get('content-type') || '';
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Không thể kết nối dịch vụ Bila.');
    }
    // Backward-compatible path for older Worker deployments.
    if (!kind.includes('text/event-stream')) {
      const data = await response.json();
      if (!data.ok || !data.answer) throw new Error(data.error || 'Dịch vụ chưa trả lời.');
      return data;
    }
    if (!response.body) throw new Error('Không nhận được luồng trả lời.');
    const label = card.querySelector('.msg-text');
    updateProgress(card, 'Đang nhận dữ liệu');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '', draft = '', publicNotes = '', complete = false, remaining;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        buffer += decoder.decode(part.value, { stream: true });
        if (buffer.length > 131072) throw new Error('Luồng trả lời không hợp lệ.');
        while (true) {
          const match = /\r?\n\r?\n/.exec(buffer);
          if (!match) break;
          const chunk = buffer.slice(0, match.index);
          buffer = buffer.slice(match.index + match[0].length);
          const source = chunk.split(/\r?\n/).filter(line => line.startsWith('data:'))
            .map(line => line.slice(5).trimStart()).join('\n');
          if (!source) continue;
          let event;
          try { event = JSON.parse(source); } catch { continue; }
          if (event.type === 'status' && !draft) updateProgress(card, 'Đang phân tích câu hỏi');
          if (event.type === 'trace_delta' && typeof event.text === 'string') {
            publicNotes = (publicNotes + event.text).slice(0, 2400);
            updateProgress(card, 'Đang giải thích · CVNSS4.0', null, publicNotes);
            $('messages').scrollTop = $('messages').scrollHeight;
          }
          if (event.type === 'delta' && typeof event.text === 'string') {
            draft += event.text;
            renderAnswer(label, draft);
            updateProgress(card, 'Đang nhận câu trả lời');
            $('messages').scrollTop = $('messages').scrollHeight;
          }
          if (event.type === 'error') throw new Error(event.message || 'Yêu cầu thất bại.');
          if (event.type === 'done') {
            complete = true;
            remaining = event.remaining;
          }
        }
      }
      if (!complete || !draft.trim()) throw new Error('Kết nối AI bị gián đoạn trước khi hoàn tất. Vui lòng thử lại.');
      return { ok: true, answer: cleanAnswer(draft), trace: publicNotes.trim(), remaining };
    } finally {
      reader.releaseLock();
    }
  }
  $('new').addEventListener('click', () => { if (!busy) newChat(); });
  $('toggle-sidebar').addEventListener('click', () => { $('sidebar').classList.toggle('open'); });
  $('clear').addEventListener('click', () => {
    if (busy || !confirm('Xóa toàn bộ lịch sử được lưu trong trình duyệt này?')) return;
    chats = []; localStorage.removeItem(KEY); newChat();
  });
  $('export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(chats, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = 'bilabot-lich-su.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  });
  $('prompt').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault(); $('chat-form').requestSubmit();
    }
  });
  $('chat-form').addEventListener('submit', async e => {
    e.preventDefault(); if (busy) return;
    const prompt = $('prompt').value.trim().normalize('NFC');
    if (!prompt) return;
    const c = active();
    const item = { role: 'user', content: prompt };
    c.messages.push(item);
    if (c.messages.length === 1) c.title = prompt.slice(0, 55);
    $('prompt').value = ''; save(); render(); lock(true);
    const live = createMessage({ role: 'assistant', content: '', pending: true, trace: traceStart });
    $('messages').append(live);
    $('messages').scrollTop = $('messages').scrollHeight;
    const started = Date.now();
    const progressTimer = setInterval(() => {
      const seconds = Math.floor((Date.now() - started) / 1000);
      updateProgress(live, 'Đang xử lý · ' + seconds + ' giây', seconds);
    }, 1000);
    const controller = new AbortController();
    // Always recover the composer, even if a network path never completes.
    const timeout = setTimeout(() => controller.abort(), 90000);
    try {
      const response = await fetch('https://bilabot2.bilabot-cvnss4-71bd4651.workers.dev/api/public/chat', {
        method: 'POST', credentials: 'omit',
        headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
        body: JSON.stringify({ messages: boundedContext(c.messages) }),
        signal: controller.signal
      });
      const data = await readAnswer(response, live);
      c.messages.push({ role: 'assistant', content: cleanAnswer(data.answer), trace: String(data.trace || live.dataset.publicNotes || '').trim().slice(0, 2400) || traceDone, elapsed: Math.max(1, Math.round((Date.now() - started) / 1000)) });
      showNotice('');
      if (typeof data.remaining === 'number') {
        $('quota-info').textContent = data.remaining > 0
          ? 'Còn ' + data.remaining + '/10 câu hỏi cho IP này'
          : 'IP này đã sử dụng đủ 10 câu hỏi miễn phí.';
        $('quota-info').hidden = false;
      }
      save(); render();
    } catch (error) {
      // Never leave a failed user prompt in the AI context as if it succeeded.
      const position = c.messages.lastIndexOf(item);
      if (position !== -1) c.messages.splice(position, 1);
      if (!$('prompt').value) $('prompt').value = prompt;
      save(); render();
      const msg = error && error.name === 'AbortError'
        ? 'Dịch vụ phản hồi quá lâu. Hãy thử lại với câu hỏi ngắn hơn.'
        : error instanceof Error ? error.message : 'Yêu cầu thất bại';
      showNotice(msg);
    } finally {
      clearInterval(progressTimer);
      clearTimeout(timeout);
      lock(false);
      $('prompt').focus();
    }
  });
  if (chats.length) { current = chats[chats.length - 1].id; render(); }
  else newChat();
  fetch('https://bilabot2.bilabot-cvnss4-71bd4651.workers.dev/api/public/config', { credentials: 'omit' }).then(r => r.json()).then(data => {
    if (!data.ready) showNotice('Trợ lý tạm thời chưa sẵn sàng. Vui lòng thử lại sau.');
  }).catch(() => { showNotice('Không thể kết nối dịch vụ. Vui lòng thử lại sau.'); });
})();
`;
