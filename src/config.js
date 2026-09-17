/* GoH Helper - configuracao com fallback embutido + override remoto.

   As partes que mais quebram quando o jogo atualiza (seletores, textos em
   portugues, tokens de classe, plano padrao) ficam AQUI como padrao, e podem
   ser sobrescritas por um config.json no GitHub sem precisar reinstalar a
   extensao. O service worker (background.js) baixa esse JSON e guarda em
   chrome.storage.local -> "remoteConfig"; este modulo faz o merge.

   IMPORTANTE: se o remoto faltar, vier quebrado ou o GitHub estiver fora,
   tudo continua funcionando com os valores embutidos abaixo. */
(() => {
  const NS = (window.__GOH__ = window.__GOH__ || {});
  if (NS.cfgLoaded) return;
  NS.cfgLoaded = true;

  const BAKED = {
    configVersion: 0,
    selectors: {
      chestButton: 'button[class*="chestButton"]',
      chestCount: [
        '[data-testid="value-Baús"]',
        '[class*="chestCount"] [class*="valueText"]',
        'section[aria-label="Baú de recompensa"] [class*="valueText"]',
      ],
      heroCard: 'aside li button[aria-label^="Abrir "][data-hero]',
      heroPoints: '[data-testid="hero-points"] [class*="pointsValue"]',
      stepUp: 'button[class*="stepUp"]',
      attrRow: 'tr[data-attr="attr.{attr}"]',
      dialogHasAttr: 'tr[data-attr]',
      cardSprite: 'img[src*="classes"]',
      cardName: '[class*="cardName"]',
      closeModal: 'button[aria-label="Voltar à batalha"]',
      loadingInDialog: '[role="status"], [class*="spinner"], [class*="loading"]',
    },
    labels: {
      collect: ['Coletar', 'Collect Chests', 'Coletar Baus', 'Coletar Baús'],
      loginButton: ['entrar', 'login with email', 'entrar com email'],
      apply: ['aplicar'],
      updatePrompt: ['Atualizar agora', 'Update now', 'Refresh now'],
      updating: ['recebendo atualizações', 'recebendo atualizacoes', 'reconectando', 'reconnecting'],
      confirm: ['Confirm', 'Confirmar', 'Yes', 'Sim'],
    },
    heroNavRegex: '^her[oó]i',
    plan: {
      warrior: 'strength',
      priest: 'intelligence',
      ranger: 'dexterity',
      wizard: 'intelligence',
      mage: 'intelligence',
      default: 'strength',
    },
  };

  let REMOTE = {};
  const aplicarRemoto = (r) => { REMOTE = r && typeof r === 'object' ? r : {}; };

  NS.cfg = {
    baked: BAKED,
    /* seletor (string) por chave; cai no embutido se o remoto nao tiver */
    sel(key) {
      const r = REMOTE.selectors && REMOTE.selectors[key];
      return r != null ? r : BAKED.selectors[key];
    },
    /* sempre devolve array (util pra seletores com varias alternativas) */
    selList(key) {
      const v = this.sel(key);
      return Array.isArray(v) ? v : [v];
    },
    /* lista de textos por chave (labels) */
    labels(key) {
      const r = REMOTE.labels && REMOTE.labels[key];
      return r != null ? r : BAKED.labels[key];
    },
    navRegex() {
      try { return new RegExp(REMOTE.heroNavRegex || BAKED.heroNavRegex, 'i'); }
      catch (_) { return new RegExp(BAKED.heroNavRegex, 'i'); }
    },
    plan() {
      return Object.assign({}, BAKED.plan, REMOTE.plan || {});
    },
    version() { return Number(REMOTE.configVersion) || 0; },
  };

  // carrega o que ja estiver salvo e escuta atualizacoes vindas do background
  try {
    chrome.storage.local.get({ remoteConfig: null }, (d) => {
      if (d && d.remoteConfig) aplicarRemoto(d.remoteConfig);
    });
    chrome.storage.onChanged.addListener((c, area) => {
      if (area === 'local' && c.remoteConfig) aplicarRemoto(c.remoteConfig.newValue || {});
    });
  } catch (_) {}
})();
