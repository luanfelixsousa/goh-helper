# GoH Helper

Extensao para Chrome/Edge e Edge que cuida das tarefas repetitivas do
**GameOfHeroes**, para o jogo continuar rendendo enquanto voce faz outra coisa.

## O que ela faz

| Funcao | O que acontece |
|---|---|
| **Coletar Baus** | Clica em "Collect Chests" assim que o botao aparece (mesmo sem passe, sabemos que o jogo está desmarcando coletar báu toda hora) . |
| **Distribuir atributos** | Quando um heroi ganha ponto, ela abre o status dele, gasta o ponto no atributo que **voce** escolheu, da Apply e recarrega para confirmar. |
| **Login automatico** | Se o jogo cair para a tela de login, ela clica em PLAY NOW e entra de novo. |
| **Recarregar no aviso** | Quando aparece "Atualizar agora (F5)", ela da o F5 sozinha. |
| **Reload periodico** | Recarrega a aba do jogo a cada 30 minutos (ajustavel). |

Tudo pode ser ligado e desligado uma a uma no painel, e existe um interruptor geral.

## Privacidade

- **Nao envia nada para lugar nenhum.** Nao existe servidor, analytics ou telemetria.
  A unica chamada de rede e para o proprio `gameofheroes.com`, a mesma que o jogo ja faz.
- **Nunca le sua senha nem seu email.** O login automatico so confere se os campos ja
  estao preenchidos pelo navegador e clica no botao.
- Suas configuracoes e o log ficam **so na sua maquina** e somem se voce desinstalar.
- So funciona em `gameofheroes.com`. Nenhuma outra aba e acessada.
- O codigo esta todo ai na pasta, em texto puro. Pode ler tudo antes de instalar.
- Como você pode validar tudo acima? A pasta já é o código descompactado, valide manualmente ou com IA. (Se mesmo assim duvidar, não baixe e me pertube)

## Passo a passo da instalacao

1. **Descompacte o zip** numa pasta definitiva - por exemplo `Documentos\goh-helper`.
   A extensao roda a partir dessa pasta: se voce apagar ou mover, ela para de funcionar.
2. Abra o gerenciador de extensoes:
   - Chrome: digite `Chrome/Edge://extensions` na barra de endereco
   - Edge: digite `edge://extensions`
3. Ligue o **Modo do desenvolvedor** (no Chrome/Edge fica no canto superior direito,
   no Edge na barra lateral esquerda).
4. Clique em **Carregar sem compactacao** ("Load unpacked") e selecione a pasta que
   voce descompactou - a pasta que tem o arquivo `manifest.json` dentro.
5. O navegador vai listar as permissoes: acesso a `gameofheroes.com` e as abas
   (necessario para achar a aba do jogo e recarregar). Aceite.
6. Opcional: clique no icone de quebra-cabeca na barra do navegador e **fixe** o
   GoH Helper, para ter o painel sempre a mao.

## Antes do primeiro uso

Abra `https://gameofheroes.com/`, faca **um login manual** e deixe o navegador
salvar o email e a senha. E isso que permite o login automatico depois: a extensao
nao guarda credenciais, ela so aproveita o preenchimento automatico do navegador.
O jogo precisa estar em Pt-br (se pedirem eu incluo em inglés)

## Usando o painel

Clique no icone da extensao com o jogo aberto:

- **Ligado / Parado** - interruptor geral. O icone mostra `ON` ou `OFF`.
- **Tarefas** - liga e desliga cada funcao separadamente.
- **Recarregar pagina** - de quantos em quantos minutos dar F5, e um botao "F5 agora".
- **Atributos por heroi** - escolha `STR`, `INT`, `DEX` ou `VIT` para cada heroi e de
  quanto em quanto tempo ela verifica se ha ponto disponivel. Enquanto ninguem tiver
  ponto, ela nao abre janela nenhuma no jogo.
- **Log** - as ultimas 40 acoes, com horario. Bom para conferir se esta trabalhando.

## Detalhe importante

Deixe a **aba do jogo visivel** - de preferencia numa janela separada. O Chrome/Edge e o
Edge desaceleram os temporizadores de abas em segundo plano, e o loop que clica nos
baus fica lento se a aba ficar escondida por muito tempo. O reload de 30 minutos nao
sofre com isso, porque roda fora da pagina.

## Se alguma coisa parar de funcionar

O jogo recebe atualizacoes e os botoes podem mudar de nome ou de lugar. Quando isso
acontecer, o log para de registrar aquela acao. Avise quem te passou a extensao para
ajustar - a correcao costuma ser de uma linha em `src/tasks.js`.

---

Feito por luan.felix
