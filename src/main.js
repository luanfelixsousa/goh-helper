/* GoH Helper - loop principal, configuracao e comunicacao com o popup. */
(() => {
  const G = window.__GOH__;
  if (!G || G.mainLoaded) return;
  G.mainLoaded = true;

  const TICK_MS = 250;
  const MAX_LOG = 40;

  const defaultSettings = () => {
    const tasks = {};
    G.tasks.forEach((t) => { tasks[t.id] = !!t.defaultEnabled; });
    return { enabled: true, reloadMinutes: 30, tasks };
  };

  let settings = defaultSettings();
  const lastRunAt = {};
  const nextAllowedAt = {};

  function log(msg) {
    const line = { t: Date.now(), msg: String(msg) };
    console.log('[GoH]', new Date(line.t).toLocaleTimeString(), line.msg);
    chrome.storage.local.get({ log: [] }, (d) => {
      const arr = (d.log || []).concat(line).slice(-MAX_LOG);
      chrome.storage.local.set({ log: arr });
    });
  }
  G.log = log;

  /* Publica o catalogo de tarefas para o popup montar a lista. */
  function publishCatalog() {
    const catalog = G.tasks.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      defaultEnabled: !!t.defaultEnabled,
    }));
    chrome.storage.local.set({ catalog });
  }

  function loadSettings(cb) {
    const defaults = defaultSettings();
    chrome.storage.local.get({ settings: defaults }, (d) => {
      const s = d.settings || defaults;
      settings = {
        enabled: s.enabled !== false,
        reloadMinutes: Number(s.reloadMinutes) > 0 ? Number(s.reloadMinutes) : 30,
        tasks: Object.assign({}, defaults.tasks, s.tasks || {}),
      };
      // Garante que tarefas novas apareçam salvas com o valor padrao.
      chrome.storage.local.set({ settings });
      if (cb) cb();
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.settings) return;
    const s = changes.settings.newValue || {};
    settings = {
      enabled: s.enabled !== false,
      reloadMinutes: Number(s.reloadMinutes) > 0 ? Number(s.reloadMinutes) : 30,
      tasks: Object.assign({}, defaultSettings().tasks, s.tasks || {}),
    };
  });

  function tick() {
    if (!settings.enabled) return;
    if (G.pickerActive) return; // inspetor ativo: nao clicar em nada
    if (G.busy) return; // uma tarefa async esta no meio de um fluxo (modal aberto)
    if (document.hidden && document.visibilityState === 'prerender') return;
    const now = Date.now();

    for (const task of G.tasks) {
      if (!settings.tasks[task.id]) continue;
      if (now < (nextAllowedAt[task.id] || 0)) continue;
      if (now - (lastRunAt[task.id] || 0) < task.everyMs) continue;
      lastRunAt[task.id] = now;

      let result;
      try {
        result = task.run();
      } catch (err) {
        console.warn('[GoH] erro na tarefa ' + task.id, err);
        nextAllowedAt[task.id] = now + 5000;
        continue;
      }

      // Tarefa assincrona (abre modal, clica, fecha): trava o loop ate terminar.
      if (result && typeof result.then === 'function') {
        G.busy = true;
        nextAllowedAt[task.id] = now + 5 * 60 * 1000; // guarda-chuva se travar
        result
          .then((r) => {
            if (r) log('[' + task.name + '] ' + (typeof r === 'string' ? r : 'acao executada'));
          })
          .catch((err) => {
            console.warn('[GoH] erro async na tarefa ' + task.id, err);
            log('[' + task.name + '] erro: ' + (err && err.message ? err.message : err));
          })
          .then(() => {
            G.busy = false;
            nextAllowedAt[task.id] = Date.now() + task.cooldownMs;
          });
        continue;
      }

      if (result) {
        nextAllowedAt[task.id] = now + task.cooldownMs;
        log('[' + task.name + '] ' + (typeof result === 'string' ? result : 'acao executada'));
      }
    }
  }

  /* Fallback de reload: o agendamento oficial vive no service worker
     (chrome.alarms), mas se ele nao disparar este timer garante o F5. */
  function scheduleReloadFallback() {
    const pageOpenedAt = Date.now();
    setInterval(() => {
      if (!settings.enabled) return;
      const limitMs = settings.reloadMinutes * 60 * 1000;
      if (Date.now() - pageOpenedAt >= limitMs + 15000) {
        console.log('[GoH] reload (fallback do content script)');
        location.reload();
      }
    }, 10000);
  }

  /* Acesso as configuracoes a partir das tarefas (src/tasks.js). */
  G.getSetting = (key, fallback) =>
    settings && settings[key] !== undefined && settings[key] !== null ? settings[key] : fallback;

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || !msg.type) return;
    if (msg.type === 'goh:ping') {
      sendResponse({ ok: true, url: location.href, tasks: G.tasks.length });
      return true;
    }
    if (msg.type === 'goh:reload-now') {
      location.reload();
      return;
    }
  });

  publishCatalog();
  loadSettings(() => {
    log('GoH Helper ativo (' + G.tasks.length + ' tarefas carregadas)');
    setInterval(tick, TICK_MS);
    scheduleReloadFallback();
  });
})();
