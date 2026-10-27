'use strict';
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
