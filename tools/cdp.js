#!/usr/bin/env node
/* Ponte CDP: fala com um Chrome aberto em --remote-debugging-port=9222.
   Uso:
     node tools/cdp.js targets
     node tools/cdp.js eval "document.title"
     node tools/cdp.js dump [arquivo.html]
     node tools/cdp.js top [px]
*/
const fs = require('fs');
const PORT = process.env.CDP_PORT || 9222;
const HOST = '127.0.0.1:' + PORT;
const MATCH = process.env.CDP_MATCH || 'gameofheroes';

async function targets() {
  const res = await fetch('http://' + HOST + '/json');
  if (!res.ok) throw new Error('HTTP ' + res.status + ' em /json');
  return (await res.json()).filter((t) => t.type === 'page');
}

async function pickTarget() {
  const list = await targets();
  const hit = list.find((t) => (t.url || '').includes(MATCH));
  if (!hit) {
    throw new Error(
      'Nenhuma aba com "' + MATCH + '" aberta.\nAbas encontradas:\n' +
        list.map((t) => '  - ' + t.url).join('\n')
    );
  }
  return hit;
}

function evaluate(target, expression) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    const timer = setTimeout(() => { try { ws.close(); } catch (_) {} reject(new Error('timeout')); }, 20000);
    ws.onerror = (e) => { clearTimeout(timer); reject(new Error('WebSocket: ' + (e.message || 'falhou'))); };
    ws.onopen = () => {
      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: { expression, returnByValue: true, awaitPromise: true },
      }));
    };
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id !== 1) return;
      clearTimeout(timer);
      ws.close();
      if (msg.error) return reject(new Error(JSON.stringify(msg.error)));
      const r = msg.result || {};
      if (r.exceptionDetails) return reject(new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception || {}).description));
      resolve(r.result ? r.result.value : undefined);
    };
  });
}

/* Expressao que lista os elementos-folha visiveis numa faixa do topo da tela. */
const TOP_EXPR = (px) => `(() => {
  const norm = (s) => String(s || '').replace(/\\s+/g, ' ').trim();
  const out = [];
  document.querySelectorAll('body *').forEach((el) => {
    if (el.children.length) return;
    const r = el.getBoundingClientRect();
    if (r.top > ${px} || r.width === 0 || r.height === 0) return;
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden' || st.display === 'none' || st.opacity === '0') return;
    out.push('[y=' + Math.round(r.top) + ' x=' + Math.round(r.left) +
      ' w=' + Math.round(r.width) + ' h=' + Math.round(r.height) + '] ' +
      el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
      (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).join('.') : '') +
      '\\n   texto: ' + JSON.stringify(norm(el.textContent).slice(0, 80)) +
      '\\n   html:  ' + el.outerHTML.slice(0, 400).replace(/\\n/g, ' '));
  });
  return 'url: ' + location.href + '\\ntotal: ' + out.length + '\\n\\n' + out.join('\\n\\n');
})()`;

(async () => {
  const [cmd, arg] = process.argv.slice(2);
  try {
    if (!cmd || cmd === 'targets') {
      const list = await targets();
      console.log(list.map((t) => t.title + '\n  ' + t.url).join('\n') || '(nenhuma aba)');
      return;
    }
    const target = await pickTarget();
    if (cmd === 'eval') {
      // "@arquivo.js" le a expressao de um arquivo (evita brigar com aspas do shell)
      const expr = arg && arg.startsWith('@') ? fs.readFileSync(arg.slice(1), 'utf8') : arg;
      const val = await evaluate(target, expr);
      console.log(typeof val === 'string' ? val : JSON.stringify(val, null, 2));
    } else if (cmd === 'dump') {
      const html = await evaluate(target, 'document.documentElement.outerHTML');
      const file = arg || 'goh-page.html';
      fs.writeFileSync(file, html, 'utf8');
      console.log('salvo em ' + file + ' (' + Math.round(html.length / 1024) + ' KB)');
    } else if (cmd === 'top') {
      console.log(await evaluate(target, TOP_EXPR(Number(arg) || 260)));
    } else {
      console.error('comando desconhecido: ' + cmd);
      process.exit(2);
    }
  } catch (err) {
    console.error('erro: ' + err.message);
    process.exit(1);
  }
})();
