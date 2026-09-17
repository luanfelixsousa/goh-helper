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

   ATUALIZADO PARA A v2 (Game of Heroes v2, 16/09/2026):
     - o jogo agora e servido na raiz "/" (nao mais em "/game")
     - interface toda em portugues
     - tela de herois reescrita: botao "Heroi" -> painel lateral com cartoes ->
       modal por heroi com tabela de atributos
   Onde da, os seletores usam marcadores estaveis (data-attr, data-testid,
   class*="token", sprite do arquivo) em vez do texto traduzido.
*/
(() => {
  const G = window.__GOH__;
  if (!G || G.tasksLoaded) return;
  G.tasksLoaded = true;

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* Estamos na tela de login? (v2 redireciona para /login quando deslogado) */
  const naTelaLogin = () =>
    location.pathname.indexOf('/login') === 0 ||
    !!document.querySelector('input[type="password"]');

  // atalhos para a config (com fallback embutido, ver src/config.js)
  const CFG = G.cfg;
  const primeiroVisivel = (sel) => Array.from(document.querySelectorAll(sel)).find(G.isVisible);

  /* HUD do jogo carregada? (botao Coletar ou o canvas do Phaser) */
  const noJogo = () =>
    !naTelaLogin() &&
    !!(document.querySelector(CFG.sel('chestButton')) ||
       document.querySelector('.phaser-host canvas'));

  /* O servidor esta empurrando atualizacao / reconectando? Nesse estado os
     paineis nao carregam (cartoes vazios), entao a varredura nao deve rodar. */
  const jogoAtualizando = () => !!G.findByText(CFG.labels('updating'), { visible: true });

  /* Quantos baus estao prontos pra coletar? Le o contador "X / Y" da HUD.
     O botao "Coletar" NUNCA fica disabled (usa aria-pressed), entao clicar
     com 0 baus dispara o "Jogo recebendo atualizacoes..." (reload fantasma).
     Retorna o numero da esquerda, ou null se nao conseguir ler. */
  function bausProntos() {
    let el = null;
    for (const sel of CFG.selList('chestCount')) {
      el = document.querySelector(sel);
      if (el) break;
    }
    if (!el) return null;
    const m = G.norm(el.textContent).match(/(\d[\d.]*)\s*\/\s*\d/);
    if (!m) return null;
    return Number(m[1].replace(/\./g, '')) || 0;
  }

  // ---------------------------------------------------------------- COLETAR BAUS
  G.registerTask({
    id: 'collect-chests',
    name: 'Coletar Baus',
    description: 'Clica em "Coletar" so quando ha bau disponivel (evita o reload fantasma no 0).',
    everyMs: 1000,
    cooldownMs: 3000,
    defaultEnabled: true,
    run() {
      if (!noJogo()) return false;

      // so age quando o contador mostra pelo menos 1 bau (ex.: "3 / 15").
      // 0 ou desconhecido -> nao clica: clicar no 0 recarrega o jogo.
      const n = bausProntos();
      if (!n || n <= 0) return false;

      const btn = primeiroVisivel(CFG.sel('chestButton')) ||
        G.findByText(CFG.labels('collect'), { clickable: true });
      if (!btn) return false;

      G.click(btn);
      return 'Coletou baus (' + n + ' pronto' + (n > 1 ? 's' : '') + ')';
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
      const el = G.findByText(CFG.labels('updatePrompt'), { visible: true });
      if (!el) return false;
      setTimeout(() => location.reload(), 400);
      return 'Aviso de atualizacao detectado - recarregando a pagina';
    },
  });

  /* ============================================================================
     LOGIN AUTOMATICO (v2)
       tela em /login, campos sem id (input[type=email] / input[type=password])
       botao "Entrar". A extensao NAO guarda credenciais: usa o autofill do
       navegador. Backoff crescente para o caso "servidor cheio".
     ========================================================================== */
  let proximoLoginAt = 0;
  let tentativas = 0;
  let avisouCamposVazios = false;

  G.registerTask({
    id: 'auto-login',
    name: 'Login automatico',
    description: 'Na tela de login, envia "Entrar" com o email/senha salvos no navegador.',
    everyMs: 3000,
    cooldownMs: 5000,
    defaultEnabled: true,
    run() {
      if (noJogo()) { tentativas = 0; avisouCamposVazios = false; return false; }
      if (!naTelaLogin()) return false;
      if (Date.now() < proximoLoginAt) return false;

      const email = document.querySelector('input[type="email"], #login-email');
      const senha = document.querySelector('input[type="password"], #login-password');
      if (!email || !senha) return false;

      if (!email.value || !senha.value) {
        if (avisouCamposVazios) return false;
        avisouCamposVazios = true;
        return 'Login: campos vazios. Faca um login manual e mande o navegador salvar a senha.';
      }
      avisouCamposVazios = false;

      // "Entrar" exato (evita "Entrar com a Phantom/Solflare") ou "Login with email".
      // O 1o rotulo da lista e comparado por igualdade exata; os demais por trecho.
      const rotulos = CFG.labels('loginButton').map((s) => G.norm(s));
      const btn = Array.from(document.querySelectorAll('button, input[type="submit"]')).find((b) => {
        const t = G.norm(b.textContent + ' ' + (b.value || ''));
        return rotulos.some((r, i) => (i === 0 ? t === r : t.indexOf(r) !== -1));
      });
      if (!btn || btn.disabled) return false;

      btn.click();
      tentativas++;
      proximoLoginAt = Date.now() + Math.min(30000 * tentativas, 5 * 60 * 1000);
      return 'Login enviado (tentativa ' + tentativas + ')';
    },
  });

  /* ============================================================================
     DISTRIBUIR ATRIBUTOS (v2)

     Fluxo verificado em 16/09/2026:
       1. botao do HUD "Heroi" (texto comeca com "Her(o|ó)i", fora do <aside>)
       2. painel lateral <aside> com <li> de cartoes:
            button[aria-label^="Abrir "][data-hero="<id>"]
            classe (estavel) = sprite "<classe>-card.png" -> warrior|ranger|priest|mage
       3. clicar no cartao abre um modal div[role="dialog"] com:
            [data-testid="hero-points"] [class*="pointsValue"]   -> pontos disponiveis
            tr[data-attr="attr.strength|intelligence|dexterity|vitality"]
              button[class*="stepUp"]   -> "+"  (o outro stepper e o "-")
            botao "Aplicar"             -> grava (fica off ate haver mudanca)
            botao [aria-label="Voltar à batalha"] -> fecha
       "Devolver pontos" custa ouro: NUNCA e tocado.
       O Aplicar grava no servidor (testado: Forca 56 -> 57, pontos 1 -> 0).
     ========================================================================== */

  const ATTR_KEYS = ['strength', 'intelligence', 'dexterity', 'vitality'];

  let proximaChecagemAt = 0;

  const isVis = (el) => G.isVisible(el);

  const heroNavBtn = () =>
    Array.from(document.querySelectorAll('button'))
      .filter(isVis)
      .find((b) => CFG.navRegex().test(G.norm(b.textContent)) && !b.closest('aside'));

  const cartoes = () => Array.from(document.querySelectorAll(CFG.sel('heroCard'))).filter(isVis);

  /* Deriva a classe em ingles a partir do sprite "<classe>-card.png". */
  function classeDoCartao(card) {
    const li = card.closest('li');
    const img = li && li.querySelector(CFG.sel('cardSprite'));
    if (img) {
      const m = (img.getAttribute('src') || '').match(/([a-z]+)-card/i);
      if (m) return m[1].toLowerCase();
    }
    const nameEl = li && li.querySelector(CFG.sel('cardName'));
    const title = nameEl && (nameEl.getAttribute('title') || '');
    if (title) return title.split('_')[0].toLowerCase();
    return G.norm(card.getAttribute('aria-label').replace('Abrir ', ''));
  }

  const nomeDoCartao = (card) => {
    const li = card.closest('li');
    const nameEl = li && li.querySelector(CFG.sel('cardName'));
    return nameEl ? G.norm(nameEl.textContent) : card.getAttribute('aria-label').replace('Abrir ', '');
  };

  async function abrirPainelHerois() {
    if (cartoes().length) return true;
    const nav = heroNavBtn();
    if (!nav) return false;
    nav.click();
    for (let i = 0; i < 16; i++) {
      await wait(500);
      if (cartoes().length) return true;
    }
    return false;
  }

  const modalAberto = () => {
    const dlg = Array.from(document.querySelectorAll('div[role="dialog"]')).find(
      (d) => isVis(d) && d.querySelector(CFG.sel('dialogHasAttr'))
    );
    return dlg || null;
  };

  const lerPontos = (dlg) => {
    const p = dlg.querySelector(CFG.sel('heroPoints'));
    return p ? Number(G.norm(p.textContent)) || 0 : 0;
  };

  /* O modal abre antes do GET /characters/<id>/sheet responder (~1,4s) e a
     tabela so rende ~1,7s depois. Espera a tela ficar PRONTA de verdade:
     modal com atributos, sem spinner, com pontos e valor estavel entre
     duas leituras (garante que a resposta do /sheet ja re-renderizou). */
  async function esperarSheetPronto() {
    let ultimo = null;
    let estavel = 0;
    const attrForca = CFG.sel('attrRow').replace('{attr}', 'strength');
    for (let i = 0; i < 45; i++) { // ate ~9s
      const dlg = Array.from(document.querySelectorAll('div[role="dialog"]')).find(
        (d) => isVis(d) && d.querySelector(CFG.sel('dialogHasAttr'))
      );
      if (dlg) {
        const carregando = dlg.querySelector(CFG.sel('loadingInDialog'));
        const p = dlg.querySelector(CFG.sel('heroPoints'));
        const forca = dlg.querySelector(attrForca + ' [class*="attrValue"]');
        if (!carregando && p && forca) {
          const assinatura = G.norm(p.textContent) + '|' + G.norm(forca.textContent);
          if (assinatura === ultimo) {
            if (++estavel >= 2) return dlg; // estavel por ~400ms
          } else {
            ultimo = assinatura;
            estavel = 0;
          }
        }
      }
      await wait(200);
    }
    return Array.from(document.querySelectorAll('div[role="dialog"]')).find(
      (d) => isVis(d) && d.querySelector(CFG.sel('dialogHasAttr'))
    ) || null;
  }

  const btnAplicar = (dlg) => {
    const rotulos = CFG.labels('apply').map((s) => G.norm(s));
    return Array.from(dlg.querySelectorAll('button')).find((b) => rotulos.some((r) => G.norm(b.textContent).indexOf(r) === 0));
  };

  async function fecharModal() {
    const dlg = Array.from(document.querySelectorAll('div[role="dialog"]')).find(isVis);
    if (!dlg) return;
    const c = dlg.querySelector(CFG.sel('closeModal')) ||
      Array.from(dlg.querySelectorAll('button')).find((b) => G.norm(b.textContent) === '✕');
    if (c) c.click();
    else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await wait(500);
  }

  async function fecharPainelHerois() {
    const sel = 'aside ' + CFG.sel('closeModal') + ', button[aria-label^="Fechar"]';
    Array.from(document.querySelectorAll(sel)).filter(isVis).forEach((b) => b.click());
    await wait(400);
  }

  /* Abre um cartao, gasta os pontos no atributo do plano e da Aplicar.
     O modal e SEMPRE fechado no finally, mesmo se algo der errado no meio -
     e o que evita deixar o painel aberto por cima da batalha (travar). */
  async function distribuir(card, plan) {
    const classe = classeDoCartao(card);
    const nome = nomeDoCartao(card);
    card.click();
    try {
      const dlg = await esperarSheetPronto();
      if (!dlg) return { nome, erro: 'modal nao carregou (sheet demorou demais)' };

      const pts = lerPontos(dlg);
      if (pts <= 0) return { nome, pts: 0 };

      const attr = ATTR_KEYS.indexOf(plan[classe]) !== -1 ? plan[classe] : plan.default || 'strength';
      const linha = dlg.querySelector(CFG.sel('attrRow').replace('{attr}', attr));
      if (!linha) return { nome, pts, erro: 'linha attr.' + attr + ' nao encontrada' };

      let cliques = 0;
      for (let i = 0; i < pts + 5 && cliques < 500; i++) {
        const mais = linha.querySelector(CFG.sel('stepUp'));
        if (!mais || mais.disabled) break;
        mais.click();
        cliques++;
        await wait(90);
      }
      if (!cliques) return { nome, pts, erro: 'botao + nao habilitou' };

      let aplicado = false;
      const ap = btnAplicar(dlg);
      if (ap && !ap.disabled) {
        ap.click();
        aplicado = true;
        await wait(1300);
      }

      // Na v2 o Aplicar grava direto no servidor (testado). Nao recarregamos mais:
      // se por acaso os pontos nao zerarem, so registramos e a proxima varredura
      // tenta de novo - reiniciar o jogo era pior que o problema.
      const restante = lerPontos(dlg);
      return { nome, pts, attr, cliques, aplicado, restante };
    } finally {
      await fecharModal();
    }
  }

  async function checar() {
    const plan = Object.assign({}, CFG.plan(), G.getSetting('attrPlan', {}));

    if (!(await abrirPainelHerois())) {
      // painel abriu vazio (jogo atualizando/reconectando) ou nem abriu:
      // fecha o que tiver ficado aberto e sai sem mexer em nada.
      await fecharPainelHerois();
      return false;
    }

    const feitos = [];
    try {
      const cards = cartoes();
      chrome.storage.local.set({
        heroes: cards.map((c) => ({ classe: classeDoCartao(c), nome: nomeDoCartao(c) })),
      });

      for (let k = 0; k < cards.length; k++) {
        // re-seleciona a cada volta: o React troca os nos entre aberturas
        const atuais = cartoes();
        const card = atuais[k];
        if (!card) continue;
        const r = await distribuir(card, plan);
        if (r.cliques) feitos.push(r.nome + ': +' + r.cliques + ' ' + r.attr + (r.aplicado ? '' : ' (Aplicar nao habilitou)'));
        else if (r.erro) feitos.push(r.nome + ': ' + r.erro);
        await wait(400);
      }
    } finally {
      await fecharPainelHerois();
    }
    return feitos.length ? feitos.join(' | ') : false;
  }

  G.registerTask({
    id: 'auto-attributes',
    name: 'Distribuir atributos',
    description: 'Abre cada heroi, gasta os Pontos no atributo escolhido e da Aplicar.',
    everyMs: 5000,
    cooldownMs: 10000,
    defaultEnabled: true,
    run() {
      if (!noJogo()) return false;
      if (jogoAtualizando()) return false; // servidor no meio de update: nao mexe
      if (Date.now() < proximaChecagemAt) return false;
      // nao interfere se voce ja esta com um modal/painel aberto na mao
      if (modalAberto() || document.querySelector('aside')) return false;

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
