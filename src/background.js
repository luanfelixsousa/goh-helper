/* GoH Helper - service worker: agenda o reload periodico, mantem o badge e
   baixa a config remota do GitHub (seletores/textos) para se adaptar a
   mudancas do jogo sem reinstalar a extensao. */

const ALARM_RELOAD = 'goh-reload';
const ALARM_CONFIG = 'goh-config';
const MATCH = ['https://gameofheroes.com/*', 'https://*.gameofheroes.com/*'];

// config remota (so DADOS: seletores, textos, plano). Nunca codigo executavel.
const CONFIG_URL = 'https://raw.githubusercontent.com/luanfelixsousa/goh-helper/main/config.json';
const CONFIG_EVERY_MIN = 180; // 3h
const RELEASES_URL = 'https://github.com/luanfelixsousa/goh-helper';

const DEFAULTS = {
  enabled: true,
  reloadMinutes: 30,
  tasks: { 'auto-login': true, 'collect-chests': true, 'reload-on-prompt': true, 'auto-attributes': true, 'close-dialogs': false },
};

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ settings: DEFAULTS }, (d) => {
      const s = Object.assign({}, DEFAULTS, d.settings || {});
      s.reloadMinutes = Number(s.reloadMinutes) > 0 ? Number(s.reloadMinutes) : 30;
      resolve(s);
    });
  });
}

async function syncAlarm() {
  const s = await getSettings();
  await chrome.alarms.clear(ALARM_RELOAD);
  if (s.enabled) {
    chrome.alarms.create(ALARM_RELOAD, {
      periodInMinutes: s.reloadMinutes,
      delayInMinutes: s.reloadMinutes,
    });
  }
  updateBadge(s.enabled);
}

function updateBadge(enabled) {
  chrome.action.setBadgeText({ text: enabled ? 'ON' : 'OFF' });
  chrome.action.setBadgeBackgroundColor({ color: enabled ? '#1f9d55' : '#8a8a8a' });
}

async function reloadGameTabs(reason) {
  const s = await getSettings();
  if (!s.enabled) return;
  const tabs = await chrome.tabs.query({ url: MATCH });
  for (const tab of tabs) {
    chrome.tabs.reload(tab.id, { bypassCache: false });
  }
  if (tabs.length) {
    chrome.storage.local.get({ log: [] }, (d) => {
      const arr = (d.log || [])
        .concat({ t: Date.now(), msg: 'Reload automatico (' + reason + ') em ' + tabs.length + ' aba(s)' })
        .slice(-40);
      chrome.storage.local.set({ log: arr });
    });
  }
}

/* Baixa a config remota (JSON de dados) e guarda no storage. So aceita JSON
   valido; qualquer erro mantem o que ja tinha (e o fallback embutido). */
async function fetchRemoteConfig() {
  try {
    // cache-buster na query: a CDN do GitHub pode servir versao velha por
    // alguns minutos; o ?t=<agora> garante sempre o config.json mais recente.
    const res = await fetch(CONFIG_URL + '?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const cfg = await res.json();
    if (!cfg || typeof cfg !== 'object') throw new Error('json invalido');

    const info = { remoteConfig: cfg, remoteConfigAt: Date.now() };
    // aviso de nova versao de CODIGO (quando o fluxo muda e precisa reinstalar)
    const instalada = chrome.runtime.getManifest().version;
    if (cfg.codeVersion && compareVersions(cfg.codeVersion, instalada) > 0) {
      info.updateAvailable = { version: cfg.codeVersion, url: cfg.downloadUrl || RELEASES_URL };
    } else {
      info.updateAvailable = null;
    }
    chrome.storage.local.set(info);
    console.log('[GoH] config remota v' + (cfg.configVersion || '?') + ' aplicada');
  } catch (err) {
    console.log('[GoH] config remota nao aplicada (' + err.message + ') - usando embutida');
  }
}

/* compara "2.0.0" vs "2.1.0" -> -1/0/1 */
function compareVersions(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

chrome.runtime.onInstalled.addListener(async () => {
  const s = await getSettings();
  chrome.storage.local.set({ settings: s });
  syncAlarm();
  fetchRemoteConfig();
  chrome.alarms.create(ALARM_CONFIG, { periodInMinutes: CONFIG_EVERY_MIN, delayInMinutes: 1 });
});

chrome.runtime.onStartup.addListener(() => {
  syncAlarm();
  fetchRemoteConfig();
  chrome.alarms.create(ALARM_CONFIG, { periodInMinutes: CONFIG_EVERY_MIN, delayInMinutes: 1 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_RELOAD) reloadGameTabs('a cada ' + DEFAULTS.reloadMinutes + ' min');
  if (alarm.name === ALARM_CONFIG) fetchRemoteConfig();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.settings) return;
  const oldS = changes.settings.oldValue || {};
  const newS = changes.settings.newValue || {};
  if (oldS.enabled !== newS.enabled || oldS.reloadMinutes !== newS.reloadMinutes) {
    syncAlarm();
  } else {
    updateBadge(newS.enabled !== false);
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'goh:reload-tabs') {
    reloadGameTabs('manual').then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg && msg.type === 'goh:check-config') {
    fetchRemoteConfig().then(() => sendResponse({ ok: true }));
    return true;
  }
});

syncAlarm();
fetchRemoteConfig();
