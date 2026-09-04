/* GoH Helper - service worker: agenda o reload periodico e mantem o badge. */

const ALARM_RELOAD = 'goh-reload';
const MATCH = ['https://gameofheroes.com/*', 'https://*.gameofheroes.com/*'];

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

chrome.runtime.onInstalled.addListener(async () => {
  const s = await getSettings();
  chrome.storage.local.set({ settings: s });
  syncAlarm();
});

chrome.runtime.onStartup.addListener(syncAlarm);

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_RELOAD) reloadGameTabs('a cada ' + DEFAULTS.reloadMinutes + ' min');
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
});

syncAlarm();
