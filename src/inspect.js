/* GoH Helper - ferramentas de inspecao (picker de elemento + dump do HTML).
   Usadas para descobrir os seletores de novas funcoes. */
(() => {
  const G = window.__GOH__;
  if (!G || G.inspectLoaded) return;
  G.inspectLoaded = true;

  const MAX_EL = 6000;
  const MAX_PARENT = 12000;

  const cut = (s, n) => (s.length > n ? s.slice(0, n) + '\n... [cortado, ' + s.length + ' chars no total]' : s);

  /* Seletor CSS curto e legivel para um elemento. */
  function selectorFor(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id) return '#' + CSS.escape(el.id);
    let sel = el.tagName.toLowerCase();
    const cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 3);
    if (cls.length) sel += '.' + cls.map((c) => CSS.escape(c)).join('.');
    const parent = el.parentElement;
    if (parent) {
      const same = Array.from(parent.children).filter((c) => c.tagName === el.tagName);
      if (same.length > 1) sel += ':nth-of-type(' + (same.indexOf(el) + 1) + ')';
    }
    return sel;
  }

  function pathFor(el) {
    const parts = [];
    let cur = el;
    for (let i = 0; i < 8 && cur && cur.nodeType === 1 && cur !== document.documentElement; i++) {
      parts.unshift(selectorFor(cur));
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  }

  function attrsOf(el) {
    return Array.from(el.attributes || [])
      .map((a) => a.name + '="' + a.value + '"')
      .join(' ');
  }

  function report(el) {
    const r = el.getBoundingClientRect();
    const parent = el.parentElement;
    const lines = [
      '=== GoH inspect ===',
      'url:      ' + location.href,
      'quando:   ' + new Date().toLocaleString(),
      'path:     ' + pathFor(el),
      'seletor:  ' + selectorFor(el),
      'tag:      <' + el.tagName.toLowerCase() + ' ' + attrsOf(el) + '>',
      'texto:    ' + JSON.stringify(G.norm(el.textContent).slice(0, 200)),
      'posicao:  x=' + Math.round(r.left) + ' y=' + Math.round(r.top) +
        ' w=' + Math.round(r.width) + ' h=' + Math.round(r.height),
      '',
      '--- outerHTML do elemento ---',
      cut(el.outerHTML, MAX_EL),
    ];
    if (parent) {
      lines.push(
        '',
        '--- outerHTML do PAI (' + selectorFor(parent) + ') ---',
        cut(parent.outerHTML, MAX_PARENT)
      );
    }
    return lines.join('\n');
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;top:-9999px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (_) {}
      ta.remove();
      return ok;
    }
  }

  function download(name, text, type) {
    const blob = new Blob([text], { type: type || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function stamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' +
      p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }

  /* ------------------------------------------------------------------ picker */
  let box = null;
  let toast = null;
  let toastTimer = null;

  function ensureUi() {
    if (!box) {
      box = document.createElement('div');
      box.style.cssText =
        'position:fixed;z-index:2147483647;pointer-events:none;border:2px solid #2f66d6;' +
        'background:rgba(47,102,214,.18);border-radius:3px;display:none';
      document.documentElement.appendChild(box);
    }
    if (!toast) {
      toast = document.createElement('div');
      toast.style.cssText =
        'position:fixed;z-index:2147483647;left:50%;top:12px;transform:translateX(-50%);' +
        'background:#16181d;color:#e7e9ee;font:13px/1.4 system-ui,sans-serif;padding:8px 14px;' +
        'border:1px solid #2f66d6;border-radius:6px;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,.5)';
      document.documentElement.appendChild(toast);
    }
  }

  function say(msg, ms) {
    ensureUi();
    toast.textContent = msg;
    toast.style.display = 'block';
    clearTimeout(toastTimer);
    if (ms) toastTimer = setTimeout(() => { toast.style.display = 'none'; }, ms);
  }

  function onMove(e) {
    const el = e.target;
    if (!el || el === box || el === toast) return;
    const r = el.getBoundingClientRect();
    box.style.display = 'block';
    box.style.left = r.left + 'px';
    box.style.top = r.top + 'px';
    box.style.width = r.width + 'px';
    box.style.height = r.height + 'px';
  }

  async function onClick(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    const el = e.target;
    stopPicker();
    const text = report(el);
    console.log('[GoH inspect]\n' + text);
    const ok = await copy(text);
    download('goh-inspect-' + stamp() + '.txt', text);
    say(ok ? 'HTML copiado + salvo em Downloads' : 'Salvo em Downloads (veja tambem o console)', 4000);
    if (G.log) G.log('Inspecionado: ' + selectorFor(el));
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      stopPicker();
      say('Inspetor cancelado', 1500);
    }
  }

  function startPicker() {
    if (G.pickerActive) return;
    ensureUi();
    G.pickerActive = true; // main.js pausa as tarefas enquanto isso
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey, true);
    say('Clique no elemento que voce quer inspecionar (ESC cancela)');
  }

  function stopPicker() {
    G.pickerActive = false;
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKey, true);
    if (box) box.style.display = 'none';
  }

  /* ------------------------------------------------------------- dump da pagina */
  function dumpPage() {
    const html = document.documentElement.outerHTML;
    download('goh-page-' + stamp() + '.html', html, 'text/html;charset=utf-8');
    say('HTML da pagina salvo em Downloads (' + Math.round(html.length / 1024) + ' KB)', 4000);
    if (G.log) G.log('Dump do HTML salvo (' + Math.round(html.length / 1024) + ' KB)');
  }

  /* Dump so da faixa superior da tela (onde ficam os icones dos personagens). */
  function dumpTop(px) {
    const limit = px || 220;
    const seen = [];
    document.querySelectorAll('body *').forEach((el) => {
      if (el.children.length) return;
      const r = el.getBoundingClientRect();
      if (r.top > limit || r.width === 0 || r.height === 0) return;
      if (!G.isVisible(el)) return;
      seen.push(
        '[y=' + Math.round(r.top) + ' x=' + Math.round(r.left) + '] ' + pathFor(el) +
        '\n   texto: ' + JSON.stringify(G.norm(el.textContent).slice(0, 80)) +
        '\n   html:  ' + cut(el.outerHTML, 400).replace(/\n/g, ' ')
      );
    });
    const text =
      '=== GoH: elementos nos ' + limit + 'px do topo ===\nurl: ' + location.href +
      '\ntotal: ' + seen.length + '\n\n' + seen.join('\n\n');
    download('goh-topo-' + stamp() + '.txt', text);
    copy(text);
    console.log('[GoH topo]\n' + text);
    say(seen.length + ' elementos do topo copiados + salvos em Downloads', 4000);
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || !msg.type) return;
    if (msg.type === 'goh:pick') startPicker();
    if (msg.type === 'goh:dump-page') dumpPage();
    if (msg.type === 'goh:dump-top') dumpTop(msg.px);
  });

  G.startPicker = startPicker;
  G.dumpPage = dumpPage;
  G.dumpTop = dumpTop;
})();
