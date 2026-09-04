const DEFAULTS = {
  enabled: true,
  reloadMinutes: 30,
  tasks: {
    'auto-login': true,
    'collect-chests': true,
    'reload-on-prompt': true,
    'auto-attributes': true,
    'close-dialogs': false,
  },
  attrSweepMinutes: 3,
  attrPlan: { Warrior: 'STR', Priest: 'INT', Ranger: 'DEX', Wizard: 'INT', default: 'STR' },
};

const ATTRS = ['STR', 'INT', 'DEX', 'VIT'];
const ATTR_NOMES = { STR: 'STR (forca)', INT: 'INT (inteligencia)', DEX: 'DEX (destreza)', VIT: 'VIT (vitalidade)' };

const $ = (id) => document.getElementById(id);
let settings = DEFAULTS;

function save() {
  chrome.storage.local.set({ settings });
}

function renderMaster() {
  $('master').checked = settings.enabled !== false;
  $('masterLabel').textContent = settings.enabled !== false ? 'Ligado' : 'Parado';
}

function renderTasks(catalog) {
  const box = $('tasks');
  box.textContent = '';
  if (!catalog || !catalog.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'Abra gameofheroes.com para carregar as tarefas.';
    box.appendChild(p);
    return;
  }
  catalog.forEach((t) => {
    const row = document.createElement('label');
    row.className = 'task';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = settings.tasks[t.id] !== undefined ? !!settings.tasks[t.id] : !!t.defaultEnabled;
    cb.addEventListener('change', () => {
      settings.tasks[t.id] = cb.checked;
      save();
    });

    const info = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = t.name || t.id;
    info.appendChild(name);
    if (t.description) {
      const desc = document.createElement('span');
      desc.textContent = t.description;
      info.appendChild(desc);
    }

    row.appendChild(cb);
    row.appendChild(info);
    box.appendChild(row);
  });
}

function renderLog(entries) {
  const ul = $('log');
  ul.textContent = '';
  (entries || []).slice().reverse().forEach((e) => {
    const li = document.createElement('li');
    const time = document.createElement('time');
    time.textContent = new Date(e.t).toLocaleTimeString();
    const span = document.createElement('span');
    span.textContent = e.msg;
    li.appendChild(time);
    li.appendChild(span);
    ul.appendChild(li);
  });
}

function renderHeroes(heroes) {
  const box = $('heroes');
  box.textContent = '';
  const lista = heroes && heroes.length ? heroes : Object.keys(DEFAULTS.attrPlan).filter((k) => k !== 'default');
  lista.forEach((hero) => {
    const row = document.createElement('label');
    row.className = 'attr';

    const name = document.createElement('span');
    name.textContent = hero;

    const sel = document.createElement('select');
    ATTRS.forEach((a) => {
      const op = document.createElement('option');
      op.value = a;
      op.textContent = ATTR_NOMES[a];
      sel.appendChild(op);
    });
    sel.value = settings.attrPlan[hero] || settings.attrPlan.default || 'STR';
    sel.addEventListener('change', () => {
      settings.attrPlan[hero] = sel.value;
      save();
    });

    row.appendChild(name);
    row.appendChild(sel);
    box.appendChild(row);
  });
}

function load() {
  chrome.storage.local.get({ settings: DEFAULTS, catalog: [], log: [], heroes: [] }, (d) => {
    settings = Object.assign({}, DEFAULTS, d.settings || {});
    settings.tasks = Object.assign({}, DEFAULTS.tasks, settings.tasks || {});
    settings.attrPlan = Object.assign({}, DEFAULTS.attrPlan, settings.attrPlan || {});
    renderMaster();
    $('reloadMinutes').value = settings.reloadMinutes;
    $('attrSweepMinutes').value = settings.attrSweepMinutes;
    renderTasks(d.catalog);
    renderHeroes(d.heroes);
    renderLog(d.log);
  });
}

$('attrSweepMinutes').addEventListener('change', (e) => {
  const v = Math.min(120, Math.max(1, Number(e.target.value) || 5));
  e.target.value = v;
  settings.attrSweepMinutes = v;
  save();
});

$('master').addEventListener('change', (e) => {
  settings.enabled = e.target.checked;
  renderMaster();
  save();
});

$('reloadMinutes').addEventListener('change', (e) => {
  const v = Math.min(600, Math.max(1, Number(e.target.value) || 30));
  e.target.value = v;
  settings.reloadMinutes = v;
  save();
});

$('reloadNow').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'goh:reload-tabs' });
});

$('clearLog').addEventListener('click', () => {
  chrome.storage.local.set({ log: [] }, () => renderLog([]));
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.log) renderLog(changes.log.newValue);
  if (changes.catalog) renderTasks(changes.catalog.newValue);
  if (changes.heroes) renderHeroes(changes.heroes.newValue);
});

load();
