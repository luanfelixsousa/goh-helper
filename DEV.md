# GoH Helper

Extensao Chrome/Edge (Manifest V3) que automatiza acoes em `https://gameofheroes.com/`.

## Instalar
1. Abra `chrome://extensions` (ou `edge://extensions`).
2. Ative **Modo do desenvolvedor**.
3. **Carregar sem compactacao** -> selecione a pasta `C:\Users\Admir\goh-helper`.
4. Abra `https://gameofheroes.com/` e clique no icone da extensao para ver o painel.

## O que ja faz
- **Login automatico**: fora do jogo clica em PLAY NOW e envia `Login with email`.
  Nao guarda credenciais: usa o autofill do navegador. Se o servidor estiver cheio e
  voltar pro /login, as tentativas usam backoff de 30s, 60s, 90s... ate 5 min.
- **Distribuir atributos**: consulta `GET /api/v1/character/me?with_inventory=1` e olha
  `stats.stat_points` do personagem e de cada `squad_members`. Se ninguem tem ponto,
  nao abre nada. Se tem, abre o status daquele heroi, clica no `+` do atributo escolhido,
  da Apply e **recarrega a pagina** (o Apply as vezes reclama na tela mas grava no servidor;
  o F5 tira a duvida). Um heroi por ciclo. Nivel nao e gatilho - so stat_points.
- **Coletar Baus**: procura a cada 1s um elemento-folha com o texto `Collect Chests` /
  `Coletar Baus` e clica. Cooldown de 3s apos cada clique para nao clicar duas vezes.
- **Recarregar no aviso (F5)**: quando o texto `Atualizar agora (F5)` (ou `Update now`)
  aparece na tela, a extensao da F5 sozinha.
- **Reload automatico**: `chrome.alarms` recarrega todas as abas do jogo no intervalo
  configurado (padrao 30 min). Ha um fallback dentro da pagina caso o alarme atrase.
- Painel com liga/desliga geral, on/off por tarefa, intervalo do reload, botao "F5 agora"
  e log das ultimas 40 acoes.

## Privacidade
A extensao **nao coleta, nao envia e nao guarda dados de ninguem**.

- Nao existe servidor, analytics, telemetria nem qualquer requisicao para fora.
  A unica chamada de rede e `GET /api/v1/character/me` no **proprio gameofheroes.com**,
  a mesma que o jogo ja faz, usando o token que ja esta no seu navegador. Serve so para
  ler `stat_points` e decidir se ha ponto para distribuir.
- **Senha e email nunca sao lidos.** O login automatico so verifica se os campos estao
  preenchidos pelo autofill do navegador e clica no botao. Nada e digitado, copiado,
  salvo ou transmitido pela extensao.
- Tudo que ela guarda fica em `chrome.storage.local` **da sua propria maquina**:
  suas configuracoes e as ultimas 40 linhas de log. Some ao desinstalar.
- So roda em `gameofheroes.com`. Nao le nem enxerga nenhuma outra aba.
- Permissoes: `storage` (salvar suas opcoes), `alarms` (agendar o F5) e `tabs` (achar a aba
  do jogo para recarregar). O `tabs` faz o navegador avisar sobre "ler seu historico", mas a
  extensao so consulta abas que casam com `gameofheroes.com` - nao le nem registra outras.

Detalhe honesto: os helpers de inspecao (`__GOH__.dumpPage()` no console) salvam o HTML
da tela em Downloads para depurar seletores. O arquivo pode conter o nome do seu
personagem e fica **so no seu disco** - nada e enviado. Se ninguem usar o console, nada
disso e gerado.

## Adicionar uma nova funcao
Edite `src/tasks.js` e copie o modelo:

```js
G.registerTask({
  id: 'minha-funcao',            // unico
  name: 'Minha funcao',
  description: 'O que ela faz.',
  everyMs: 1000,                 // frequencia da tentativa
  cooldownMs: 3000,              // pausa apos sucesso
  defaultEnabled: false,
  run() {
    const label = G.clickByText(['Texto do botao', 'Outro idioma']);
    return label ? 'Clicou: ' + label : false;   // false = nada feito
  },
});
```

Depois clique em **Atualizar** na pagina de extensoes e de F5 no jogo.

### Helpers disponiveis (`window.__GOH__`)
- `G.findByText(texto|[textos], { exact, visible, clickable, root })`
- `G.findAllByText(...)` - mesma busca, retorna array
- `G.click(el)` - `.click()` nativo (igual ao script do console)
- `G.clickHuman(el)` - sequencia pointerdown/mousedown/up/click para UIs mais exigentes
- `G.clickByText(texto|[textos], opts)` - acha + clica, retorna o texto clicado
- `G.isVisible(el)`, `G.clickableAncestor(el)`, `G.log(msg)`

## Observacao importante
O Chrome limita timers de abas em segundo plano (ate 1 execucao por minuto apos alguns
minutos ocultas). Para o loop de 1s funcionar de verdade, deixe a aba do jogo **visivel**
(janela propria, ou aba ativa). O reload de 30 min nao sofre esse limite porque roda no
service worker via `chrome.alarms`.
