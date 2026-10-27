'use strict';
(() => {
  const KEY = 'bilabot-public-chats-v1';
  const $ = id => document.getElementById(id);
  const brainSvg = '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M32 13C22 4 8 11 11 24c-8 6-7 17 1 21-1 12 14 17 20 6 6 11 21 6 20-6 8-4 9-15 1-21C56 11 42 4 32 13Z"/><path d="M32 13v38M19 23l7 6-6 8M45 23l-7 6 6 8"/></svg>';
  const converter = window.CVNSSConverter;
  const version = converter && converter.VERSION === '5.0.0-audit-safe';
  const validMessage = m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string';
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
    meta.textContent = msg.role === 'user' ? 'Bạn' : 'BilaBot · Unicode tiếng Việt';
    const text = document.createElement('div'); text.className = 'msg-text';
    text.textContent = msg.content.normalize('NFC');
    body.append(meta, text);
    if (msg.role === 'assistant') {
      const details = document.createElement('details'); details.className = 'cvnss-detail';
      const summary = document.createElement('summary');
      summary.textContent = '◈ Xem cách mã hóa câu trả lời bằng CVNSS4.0';
      const pre = document.createElement('pre');
      const hint = document.createElement('small');
      hint.textContent = 'Bản mã văn bản từ CVNSS4.0 Converter v5.0.0-audit-safe; không phải suy luận nội bộ của DeepSeek.';
      details.append(summary, pre, hint);
      details.addEventListener('toggle', () => {
        if (details.open && !pre.dataset.ready) {
          pre.textContent = cvssPreview(msg.content);
          pre.dataset.ready = '1';
        }
      });
      body.append(details);
    }
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
    else for (const m of messages) $('messages').append(createMessage(m));
    $('messages').scrollTop = $('messages').scrollHeight;
  }
  function lock(value) {
    busy = value;
    $('send').disabled = value; $('prompt').disabled = value;
    $('clear').disabled = value; $('new').disabled = value;
    $('send').textContent = value ? 'Đang trả lời…' : 'Gửi ↗';
  }
  function boundedContext(messages) {
    const a = messages.filter(validMessage).slice(-19);
    let total = a.reduce((n, m) => n + m.content.length, 0);
    while (total > 26000 && a.length > 1) total -= a.shift().content.length;
    return a;
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
    c.messages.push({ role: 'user', content: prompt });
    if (c.messages.length === 1) c.title = prompt.slice(0, 55);
    $('prompt').value = ''; save(); render(); lock(true);
    try {
      const response = await fetch('https://bilabot2.bilabot-cvnss4-71bd4651.workers.dev/api/public/chat', {
        method: 'POST', credentials: 'omit',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: boundedContext(c.messages) })
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Không thể kết nối API.');
      c.messages.push({ role: 'assistant', content: String(data.answer).normalize('NFC') });
      showNotice('');
      if (typeof data.remaining === 'number') {
        $('quota-info').textContent = data.remaining > 0
          ? 'Còn ' + data.remaining + '/10 câu hỏi cho IP này'
          : 'IP này đã sử dụng đủ 10 câu hỏi miễn phí.';
        $('quota-info').hidden = false;
      }
      save(); render();
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'Yêu cầu thất bại');
    } finally { lock(false); $('prompt').focus(); }
  });
  if (chats.length) { current = chats[chats.length - 1].id; render(); }
  else newChat();
  fetch('https://bilabot2.bilabot-cvnss4-71bd4651.workers.dev/api/public/config', { credentials: 'omit' }).then(r => r.json()).then(data => {
    if (!data.ready) showNotice('Trợ lý tạm thời chưa sẵn sàng. Vui lòng thử lại sau.');
  }).catch(() => { showNotice('Không thể kết nối dịch vụ. Vui lòng thử lại sau.'); });
})();
