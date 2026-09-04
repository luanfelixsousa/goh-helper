/* GoH Helper - nucleo compartilhado do content script.
   Expoe window.__GOH__ com helpers de busca/clique e o registro de tarefas. */
(() => {
  const NS = (window.__GOH__ = window.__GOH__ || {});
  if (NS.core) return;
  NS.core = true;

  NS.tasks = [];

  /* Registra uma tarefa do loop.
     { id, name, description, everyMs, cooldownMs, defaultEnabled, run() } */
  NS.registerTask = (task) => {
    if (!task || !task.id || typeof task.run !== 'function') {
      console.warn('[GoH] tarefa invalida ignorada', task);
      return;
    }
    NS.tasks.push(
      Object.assign(
        {
          name: task.id,
          description: '',
          everyMs: 1000,
          cooldownMs: 3000,
          defaultEnabled: false,
        },
        task
      )
    );
  };

  const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase();
  NS.norm = norm;

  NS.isVisible = (el) => {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    const st = getComputedStyle(el);
    return st.visibility !== 'hidden' && st.display !== 'none' && st.opacity !== '0';
  };

  /* Sobe ate o ancestral clicavel mais proximo (botao/link), se houver. */
  NS.clickableAncestor = (el) => {
    const sel = 'button, a, [role="button"], input[type="button"], input[type="submit"]';
    let cur = el;
    for (let i = 0; i < 5 && cur; i++) {
      if (cur.matches && cur.matches(sel)) return cur;
      cur = cur.parentElement;
    }
    return el;
  };

  /* Procura o primeiro elemento-folha cujo texto bate com needles (string ou array).
     opts: { exact, visible = true, clickable, root } */
  NS.findByText = (needles, opts) => {
    opts = opts || {};
    const wanted = (Array.isArray(needles) ? needles : [needles]).map(norm).filter(Boolean);
    const root = opts.root || document.body;
    if (!wanted.length || !root) return null;

    const exact = opts.exact === true;
    const requireVisible = opts.visible !== false;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
      acceptNode(el) {
        // FILTER_SKIP ignora o no mas continua descendo -> so folhas viram candidatas.
        return el.children.length > 0 ? NodeFilter.FILTER_SKIP : NodeFilter.FILTER_ACCEPT;
      },
    });

    let node;
    while ((node = walker.nextNode())) {
      const txt = norm(node.textContent);
      if (!txt) continue;
      const hit = wanted.some((w) => (exact ? txt === w : txt.indexOf(w) !== -1));
      if (!hit) continue;
      if (requireVisible && !NS.isVisible(node)) continue;
      return opts.clickable ? NS.clickableAncestor(node) : node;
    }
    return null;
  };

  /* Igual ao findByText, mas devolve todos os resultados. */
  NS.findAllByText = (needles, opts) => {
    opts = opts || {};
    const wanted = (Array.isArray(needles) ? needles : [needles]).map(norm).filter(Boolean);
    const root = opts.root || document.body;
    const out = [];
    if (!wanted.length || !root) return out;
    const exact = opts.exact === true;
    const requireVisible = opts.visible !== false;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
      acceptNode(el) {
        return el.children.length > 0 ? NodeFilter.FILTER_SKIP : NodeFilter.FILTER_ACCEPT;
      },
    });
    let node;
    while ((node = walker.nextNode())) {
      const txt = norm(node.textContent);
      if (!txt) continue;
      if (!wanted.some((w) => (exact ? txt === w : txt.indexOf(w) !== -1))) continue;
      if (requireVisible && !NS.isVisible(node)) continue;
      out.push(opts.clickable ? NS.clickableAncestor(node) : node);
    }
    return out;
  };

  /* Clique simples (mesmo comportamento do script original do console). */
  NS.click = (el) => {
    if (!el) return false;
    if (typeof el.click === 'function') {
      el.click();
    } else {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    }
    return true;
  };

  /* Clique "humano": sequencia pointer/mouse completa, para UIs que ignoram .click(). */
  NS.clickHuman = (el) => {
    if (!el) return false;
    const o = { bubbles: true, cancelable: true, view: window };
    try { el.dispatchEvent(new PointerEvent('pointerdown', o)); } catch (_) {}
    el.dispatchEvent(new MouseEvent('mousedown', o));
    try { el.dispatchEvent(new PointerEvent('pointerup', o)); } catch (_) {}
    el.dispatchEvent(new MouseEvent('mouseup', o));
    el.dispatchEvent(new MouseEvent('click', o));
    return true;
  };

  /* Atalho: acha por texto e clica. Retorna o texto clicado ou null. */
  NS.clickByText = (needles, opts) => {
    const el = NS.findByText(needles, opts);
    if (!el) return null;
    const label = norm(el.textContent).slice(0, 60);
    (opts && opts.human ? NS.clickHuman : NS.click)(el);
    return label;
  };
})();
