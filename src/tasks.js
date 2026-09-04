/* GoH Helper - AQUI voce adiciona novas funcoes do bot.
   Cada tarefa roda dentro do loop principal (src/main.js).

   Campos:
     id             identificador unico (usado para salvar o on/off)
     name           nome exibido no popup
     description    texto de ajuda no popup
     everyMs        de quanto em quanto tempo tentar rodar
     cooldownMs     pausa apos uma acao bem sucedida (evita clique duplo)
     defaultEnabled ligada por padrao na primeira instalacao
     run()          retorna: falsy = nada feito | string = mensagem do log | true = feito
                    pode ser async: o loop pausa as outras tarefas ate terminar
*/
(() => {
  const G = window.__GOH__;
  if (!G || G.tasksLoaded) return;
  G.tasksLoaded = true;

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const noJogo = () => location.pathname.indexOf('/game') === 0;

  // ---------------------------------------------------------------- COLETAR BAUS
  G.registerTask({
    id: 'collect-chests',
    name: 'Coletar Baus',
    description: 'Clica em "Collect Chests" / "Coletar Baus" assim que o botao aparece.',
    everyMs: 1000,
    cooldownMs: 3000,
    defaultEnabled: true,
    run() {
      const label = G.clickByText(['Collect Chests', 'Coletar Baus', 'Coletar Baús']);
      return label ? 'Clicou: ' + label : false;
    },
  });

  // ------------------------------------------------- RELOAD AO VER AVISO DE UPDATE
  G.registerTask({
    id: 'reload-on-prompt',
    name: 'Recarregar no aviso (F5)',
    description: 'Da F5 quando aparece "Atualizar agora (F5)" / "Update now".',
    everyMs: 1000,
    cooldownMs: 20000,
    defaultEnabled: true,
    run() {
      const el = G.findByText(['Atualizar agora', 'Update now', 'Refresh now']);
      if (!el) return false;
      setTimeout(() => location.reload(), 400);
      return 'Aviso de atualizacao detectado - recarregando a pagina';
    },
  });

  /* ============================================================================
     LOGIN AUTOMATICO

     Fluxo mapeado em 04/09/2026:
       /        -> <a> "PLAY NOW" (href=/login); tambem existe "PLAY"
       /login   -> input#login-email + input#login-password (preenchidos pelo
                   autofill do navegador) e <button> "Login with email"
       /game    -> ja logado, nada a fazer
     A extensao NAO guarda usuario nem senha: depende do autofill do navegador.
     Se o servidor estiver cheio a tela volta pro /login, entao as tentativas
     usam backoff crescente (30s, 60s, 90s... ate 5 min) para nao martelar.
     ========================================================================== */

  let proximoLoginAt = 0;
  let tentativas = 0;
  let avisouCamposVazios = false;

  const acharPorTexto = (textos, sel) =>
    Array.from(document.querySelectorAll(sel || 'a, button')).find((el) => {
      if (!G.isVisible(el)) return false;
      const t = G.norm(el.textContent);
      return textos.indexOf(t) !== -1;
    });

  G.registerTask({
    id: 'auto-login',
    name: 'Login automatico',
    description: 'Fora do jogo, clica em PLAY NOW e envia o login com os dados salvos no navegador.',
    everyMs: 3000,
    cooldownMs: 5000,
    defaultEnabled: true,
    run() {
      if (noJogo()) { tentativas = 0; avisouCamposVazios = false; return false; }
      if (Date.now() < proximoLoginAt) return false;

      const path = location.pathname;

      // tela inicial: entra na tela de login
      if (path === '/' || path === '' || path === '/home') {
        const play = acharPorTexto(['play now', 'jogar agora']) || acharPorTexto(['play', 'jogar']);
        if (!play) return false;
        play.click();
        proximoLoginAt = Date.now() + 4000;
        return 'Clicou em PLAY NOW';
      }

      if (path.indexOf('/login') !== 0) return false;

      const email = document.querySelector('#login-email, input[type="email"]');
      const senha = document.querySelector('#login-password, input[type="password"]');
      if (!email || !senha) return false;

      // sem autofill nao ha o que fazer - a extensao nao guarda credenciais
      if (!email.value || !senha.value) {
        if (avisouCamposVazios) return false;
        avisouCamposVazios = true;
        return 'Login: campos vazios. Faca um login manual e mande o navegador salvar a senha.';
      }
      avisouCamposVazios = false;

      const btn = Array.from(document.querySelectorAll('button, input[type="submit"]')).find(
        (b) => /login with email|entrar com email/i.test(G.norm(b.textContent) + ' ' + (b.value || ''))
      );
      if (!btn || btn.disabled) return false;

      btn.click();
      tentativas++;
      proximoLoginAt = Date.now() + Math.min(30000 * tentativas, 5 * 60 * 1000);
      return 'Login enviado (tentativa ' + tentativas + ')';
    },
  });

  /* ============================================================================
     DISTRIBUIR ATRIBUTOS

     O gatilho e o stat_points da API, nunca o nivel: subir de nivel nao
     significa ponto disponivel, e ponto disponivel e a unica coisa que importa.
       GET /api/v1/character/me   (Bearer localStorage.auth_token)
         data.stats.stat_points               -> personagem principal
         data.squad_members[].stats.stat_points -> demais herois
     Interface (mapeada em 04/09/2026):
       button[aria-label="Status for <Classe>"]         abre o modal
       section[role="dialog"][aria-label^="Status for "]
         "Available PTS: N"
         button[aria-label="Add STR|INT|DEX|VIT"]  (disabled sem pontos)
         button[class*="_applyBtn"] "Apply"        (disabled sem alteracao)
         button[aria-label="Close"]
     Depois de aplicar a pagina e recarregada: o Apply as vezes reclama na tela
     mas a distribuicao vai pro servidor do mesmo jeito, e o F5 resolve a
     divergencia entre o que a tela mostra e o que ja foi gravado.
     ========================================================================== */

  const ATTRS = ['STR', 'INT', 'DEX', 'VIT'];
  const DEFAULT_PLAN = { Warrior: 'STR', Priest: 'INT', Ranger: 'DEX', Wizard: 'INT', default: 'STR' };

  let proximaChecagemAt = 0;
  const semBotaoAvisado = {};

  const heroButtons = () =>
    Array.from(document.querySelectorAll('button[aria-label^="Status for "]')).filter(G.isVisible);

  const heroName = (btn) => btn.getAttribute('aria-label').replace('Status for ', '').trim();

  const openDialog = () => document.querySelector('section[role="dialog"][aria-label^="Status for "]');

  /* Le os pontos disponiveis de todos os herois direto da API. */
  async function pontosPelaApi() {
    const tk = localStorage.getItem('auth_token') || localStorage.getItem('token');
    if (!tk) throw new Error('sem token no localStorage');
    // o ?with_inventory=1 e o que faz a API devolver squad_members (sem ele vem
    // so o personagem principal e os outros herois ficariam invisiveis)
    const res = await fetch('/api/v1/character/me?with_inventory=1', {
      headers: { Authorization: 'Bearer ' + tk, Accept: 'application/json' },
    });
    if (!res.ok) throw new Error('API HTTP ' + res.status);
    const j = await res.json();
    const d = j.data || j;
    const lista = [];
    const add = (h) => {
      if (!h || !h.stats) return;
      lista.push({
        nome: h.class_name || h.name || h.class || '?',
        pts: Number(h.stats.stat_points) || 0,
        level: h.level,
      });
    };
    add(d);
    (d.squad_members || []).forEach(add);
    return lista;
  }

  /* Le "Available PTS: N" do modal (usado como plano B se a API falhar). */
  function readPts(dlg) {
    for (const n of dlg.querySelectorAll('p, div, span, strong')) {
      const t = G.norm(n.textContent);
      if (t.indexOf('available pts') === 0 || t.indexOf('pts disponiveis') === 0) {
        const m = t.match(/(\d+)/);
        if (m) return Number(m[1]);
      }
    }
    const row = dlg.querySelector('[title="Stat Points"]');
    if (row) {
      const m = G.norm(row.textContent).match(/(\d+)/);
      if (m) return Number(m[1]);
    }
    return 0;
  }

  function applyButton(dlg) {
    return Array.from(dlg.querySelectorAll('button')).find(
      (b) => G.norm(b.textContent) === 'apply' || (b.className || '').indexOf('_applyBtn') !== -1
    );
  }

  async function closeDialog() {
    const dlg = document.querySelector('section[role="dialog"]');
    if (!dlg) return;
    const btn = dlg.querySelector('button[aria-label="Close"]') ||
      Array.from(dlg.querySelectorAll('button')).find((b) => G.norm(b.textContent) === '✕');
    if (btn) btn.click();
    else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await wait(500);
  }

  /* Abre o heroi, gasta os pontos no atributo escolhido e da Apply. */
  async function distribuir(btn, plan, ptsEsperados) {
    const hero = heroName(btn);
    btn.click();
    await wait(900);

    const dlg = openDialog();
    if (!dlg) return { hero, erro: 'modal nao abriu' };

    const pts = ptsEsperados || readPts(dlg);
    if (pts <= 0) { await closeDialog(); return { hero, pts: 0 }; }

    const attr = ATTRS.indexOf(plan[hero]) !== -1 ? plan[hero] : plan.default || 'STR';
    let cliques = 0;
    for (let i = 0; i < pts + 5 && cliques < 500; i++) {
      const add = dlg.querySelector('button[aria-label="Add ' + attr + '"]');
      if (!add || add.disabled) break;
      add.click();
      cliques++;
      await wait(70);
    }
    if (!cliques) { await closeDialog(); return { hero, pts, erro: 'botao "Add ' + attr + '" nao habilitou' }; }

    let aplicado = false;
    const apply = applyButton(dlg);
    if (apply && !apply.disabled) {
      apply.click();
      aplicado = true;
      await wait(1200);
      const ok = G.findByText(['Confirm', 'Confirmar', 'Yes', 'Sim'], { exact: true, clickable: true });
      if (ok) { ok.click(); await wait(700); }
    }
    return { hero, pts, attr, cliques, aplicado };
  }

  async function checar() {
    const plan = Object.assign({}, DEFAULT_PLAN, G.getSetting('attrPlan', {}));

    let herois;
    try {
      herois = await pontosPelaApi();
      chrome.storage.local.set({ heroes: herois.map((h) => h.nome) });
    } catch (err) {
      // plano B: le pelo modal do primeiro heroi que tiver pontos
      const btns = heroButtons();
      if (!btns.length) return false;
      for (const btn of btns) {
        const r = await distribuir(btn, plan, 0);
        if (r.cliques) {
          setTimeout(() => location.reload(), 1000);
          return r.hero + ': +' + r.cliques + ' ' + r.attr + ' (API off: ' + err.message + ') - recarregando';
        }
      }
      await closeDialog();
      return false;
    }

    const comPontos = herois.filter((h) => h.pts > 0);
    if (!comPontos.length) return false; // nada a fazer, nem abre modal

    const botoes = heroButtons();
    for (const h of comPontos) {
      const btn = botoes.find((b) => heroName(b) === h.nome);
      if (!btn) {
        if (!semBotaoAvisado[h.nome]) {
          semBotaoAvisado[h.nome] = true;
          G.log('[Distribuir atributos] ' + h.nome + ' tem ' + h.pts + ' PTS mas nao esta nos slots visiveis da party');
        }
        continue;
      }
      const r = await distribuir(btn, plan, h.pts);
      if (r.erro) { await closeDialog(); return r.hero + ': ' + r.erro; }
      if (!r.cliques) { await closeDialog(); continue; }

      // Um heroi por vez: aplica, recarrega e o proximo ciclo pega o resto.
      setTimeout(() => location.reload(), 1000);
      return r.hero + ': +' + r.cliques + ' ' + r.attr +
        (r.aplicado ? '' : ' (Apply nao habilitou)') + ' - recarregando para confirmar';
    }

    await closeDialog();
    return false;
  }

  G.registerTask({
    id: 'auto-attributes',
    name: 'Distribuir atributos',
    description: 'Consulta stat_points na API; se houver ponto, gasta no atributo escolhido, aplica e recarrega.',
    everyMs: 5000,
    cooldownMs: 10000,
    defaultEnabled: true,
    run() {
      if (!noJogo()) return false;
      if (!heroButtons().length) return false;
      if (document.querySelector('section[role="dialog"]')) return false; // voce esta com algo aberto
      if (Date.now() < proximaChecagemAt) return false;

      const minutos = Number(G.getSetting('attrSweepMinutes', 3)) || 3;
      proximaChecagemAt = Date.now() + minutos * 60 * 1000;
      return checar();
    },
  });

  // ------------------------------------------------- MODELO (desligada por padrao)
  // Copie este bloco para criar novas funcoes.
  G.registerTask({
    id: 'close-dialogs',
    name: 'Fechar janelas (exemplo)',
    description: 'Modelo de tarefa: fecha popups clicando em OK / Close / Fechar.',
    everyMs: 1500,
    cooldownMs: 1500,
    defaultEnabled: false,
    run() {
      const label = G.clickByText(['OK', 'Close', 'Fechar'], { exact: true, clickable: true });
      return label ? 'Fechou: ' + label : false;
    },
  });
})();
