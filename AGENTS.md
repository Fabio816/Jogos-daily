# AGENTS.md: guia para agentes neste projeto

Leia isto antes de mexer no código. O app se chama **Claudio Games**: minigames multiplayer
para um grupo de amigos (Qual é a Obra, Termo, Bomb Party, Onde Estou?).

## Stack e comandos

- Vue 3 + Vite + TypeScript, vue-router, Firebase (Realtime Database + Hosting), Leaflet, vitest.
- Idioma da interface e dos textos: português (pt-BR). Código e nomes internos podem ficar em inglês.
- Testes: `npm test -- --run` (precisa passar sempre).
- Tipos: `npx vue-tsc -b`.
- Build: `npm run build` (gera `dist/`).
- Dev: `npm run dev -- --port 5199 --strictPort`, em `http://127.0.0.1:5199`.
- Deploy (só quando o dono pedir): `npm run build && firebase deploy --only hosting,database`.
- Gate de acesso: a senha fica com o dono do projeto. Não a grave em arquivos versionados.

### Armadilha do ambiente (WSL + pasta do Windows)

O projeto fica em `/mnt/c/...`. O watcher do Vite não percebe mudanças ali. Depois de editar,
reinicie o dev server:

```
pkill -f "[v]ite --port 5199"; (setsid npm run dev -- --port 5199 --strictPort > /tmp/opencode/vite.log 2>&1 < /dev/null &)
```

Não use `pkill -f "port 5199"` (mata o próprio shell). Use `setsid` com `< /dev/null`.

## Mapa do código

- `src/router.ts`: rotas. Todas passam pelo gate (`src/lib/gate.ts`), exceto `/entrar`.
- `src/views/`: uma tela por jogo (`QuizView`, `TermoView`, `BombView`, `OndeEstouView`), mais `HubView`, `ChangelogView`, `LoginView`.
- `src/components/Multiplayer.vue`: o modo multiplayer do Qual é a Obra. `RoomChat`, `RoomPlayers`, `RoomInvite`, `RoomAlerts` são compartilhados.
- `src/game/`: regras do Qual é a Obra (catálogo, respostas em `answer.ts`, mix, pontuação).
- `src/games/{bomb,onde,termo}/`: lógica pura (`logic.ts`, `state.ts`) separada do acesso ao banco (`room.ts`). Escreva testes na lógica pura.
- `src/multiplayer/`: sala e estado do Qual é a Obra.
- `src/lib/`: utilitários. `invite.ts` (convite), `alerts.ts` + `devtools.ts` (aviso de F12), `rooms.ts` (presença e limpeza), `time.ts` (`serverNow`), `ranking.ts`.
- `src/data/`: perguntas e capas. Os JSON são gerados pelos scripts em `scripts/` (ver o `package.json`).
- `src/data/changelog.ts`: novidades mostradas em `/novidades`.
- `database.rules.json`: regras do Realtime Database. Versione qualquer mudança aqui.
- `server/bombsquads/`: servidor do Bombsquads em Cloudflare Workers + Durable Objects (uma sala por Durable Object). Lobby salvo em storage; partida em memória com tick de 30 Hz e snapshots a 15 Hz. Presença no lobby: quem cai fica marcado como desconectado por até 60 s (alarme da DO) e pode reconectar com playerId+token; na partida cai como espectador conectável. Dev: `npm run dev:bombsquads-server` (porta 8787). Testes: `npm test` (inclui `server/bombsquads/test`). Carga: `node server/bombsquads/scripts/load-test.mjs http://127.0.0.1:8787 10 40`. E2E do cliente: `BS_E2E=1 npm test -- --run` com o servidor local no ar. Deploy só quando o dono pedir: `npm --prefix server/bombsquads run deploy`. URL pública: `wss://bombsquads-server.bombsquads.workers.dev`. Reconexão sempre manda `welcome` + `lobby` (e `snapshot` se houver partida): sem o `lobby`, o cliente que recarrega no meio da partida cai na tela de entrada. Fim de partida: `matchEnd` (com pontos) e depois `lobby` com status `lobby` e prontidões zeradas. Sem controle de acesso além do gate do app (decisão do dono).
- `src/games/bombsquads/sim/`: simulação compartilhada (fonte única), usada pelo servidor e pelo cliente. Não importa Vue, three nem APIs de browser/Node.
- `src/games/bombsquads/` (cliente, rota `/bombsquads`):
  - `messages.ts` é o contrato cliente/servidor (tipos só); `server/bombsquads` importa daqui, então mudar aqui mexe nos dois lados.
  - `config.ts` (URL de WS, `VITE_BOMBSQUADS_WS_URL`; `.env.local` local usa `ws://127.0.0.1:8787`), `session.ts` (sessão no localStorage: playerId+token para reconexão), `connection.ts` (WebSocket com reconexão; close 4001 é fatal).
  - `match-client.ts`/`interp.ts`/`predict.ts`: interpola os remotos 100 ms atrás, prediz o local a cada tick com `movePlayer` da sim, e envia input só quando muda.
  - `input.ts`: WASD/setas + espaço/F. `visual.ts`/`arena.ts`: paleta toon e arena instanciada; `scene/`: componentes TresJS (MatchScene, PlayerActor, BombActor, BlastActor, ItemActor, FallingBlock, LobbyView, HudView, SceneLights, CameraRig).
  - Testes: `client.test.ts` (predição, interpolação, teclado) e `e2e.test.ts` (integração contra o servidor local; roda só com `BS_E2E=1 npm test -- --run` e `npm run dev:bombsquads-server` no ar; senão pula). Cena 3D precisa de olho humano (headless WebGL aqui não é confiável).
  - TresJS: use `templateCompilerOptions` do `@tresjs/core/template-compiler-options` no plugin do Vue (`vite.config.ts`); loops usam `useLoop().onBeforeRender(({ delta }) => …)`; objetos three NUNCA dentro de `ref()`/`reactive()`: use `shallowRef`. O Vue envolve o objeto em Proxy, o three falha ao ler `modelViewMatrix`, e como o loop `useRafFn` para ao lançar exceção, o canvas inteiro trava (foi o travamento depois da explosão). Refs de template de componentes Tres (`ref="group"`) também entram como `shallowRef`. `TresCanvas` é componente real: importe de `@tresjs/core` (as opções de compilador só marcam os demais `Tres*` como elementos custom; `<primitive>` minúsculo monta objetos three). `useLoop` só existe em descendentes do `TresCanvas`: o relógio da partida fica em `MatchClock.vue` (filho do canvas, array vazio), não no MatchScene. Elementos custom são `Tres` + nome: `TresGroup`, não `group`. A câmera default do canvas chega depois do mount: em `CameraRig`, vigie `[camera.activeCamera, span]` e reposicione quando a câmera aparecer.
  - Sessão do cliente é `sessionStorage` (por aba): duas janelas do mesmo navegador entram como dois jogadores. Com `localStorage` compartilhado, a segunda janela reusava o token da primeira e o servidor fechava o socket antigo com `4001 replaced` (bug do "bugou tudo").
  - Ganchos de dev (só `import.meta.env.DEV`): `?devgate=1` libera o gate de teste; `?auto=1` cria/entra sozinho (com `?sala=CÓD` entra na sala); `?autoready=1` envia ready e, se host e todos prontos, inicia. Usados pelo teste de navegador via CDP. Também `window.__bsInject(msg)` (injeta uma mensagem do servidor, ex.: `matchEnd`/`lobby` para testar o ranking sem partida inteira) e `window.__bsLastLobby` (último lobby recebido).
  - Fim de partida e reentrada: `matchEnd` vira o painel `scene/RankingPanel.vue`, por cima do lobby; um `lobby` com status `playing` fecha o painel. A sessão salva reentra sozinha ao abrir a página (exceto com `?auto=1`, que cria sala nova de propósito). Ícones dos itens: textura em canvas, desenhada só depois do `load` do SVG (passar o SVG cru ao WebGL dá `bad image data`).
  - Teste visual/end-to-end no Windows sem navegador em WSL: msedge headless com `--remote-debugging-port` e CDP via PowerShell (`ClientWebSocket`, `/json/version`, `/json/new`, `Page.navigate`, `Runtime.evaluate`, `Page.captureScreenshot`). `/json/new?url=` não navega nesse Chrome: crie a aba em branco, anexe e use `Page.navigate`. Mate processos órfãos do filtro por perfil (`edge-cdp*-profile`) antes de novas rodadas. O rAF de aba de fundo congela em headless (o loop do Tres para): `Page.bringToFront` na aba testada antes de medir movimento. Teclado decisivo: `Input.dispatchKeyEvent` (code+windowsVirtualKeyCode), fallback com `new KeyboardEvent` via DOM. O `cdp-2p.ps1` (em `%TEMP%`) já valida: partida nas duas abas, canvas tela cheia, lobby oculto, HUD, andar (posição prevista antes/depois) e bomba (contagem no snapshot).

## Padrões que já existem (reuse, não reinvente)

- **Convite por link**: `RoomInvite` gera `…/rota?sala=CODIGO`. `inviteCodeFromUrl()` lê o código ao abrir a página, e `clearInviteFromUrl()` o limpa depois de entrar. Sem nome salvo, mostre o erro "Digite seu nome primeiro." e preencha o código.
- **Lista de jogadores**: `RoomPlayers`. Presença usa `connected`, mantida pelas normalizações (não descarte esse campo).
- **Firebase**: `ensureSignedIn()` em `src/firebase.ts` compartilha uma única promessa. Não crie um segundo login.
- **Salas**: `ref(db, 'modo/rooms/CODIGO')`. Cada sala guarda `hostUid`, `status` (`lobby`/`playing`/`finished`), `settings`, `players`.
- **Avisos de DevTools**: `useDevtoolsAlerts(jogo, code, name, active)` liga a vigilância durante a partida e mostra avisos em vermelho com `RoomAlerts`. Use o mesmo padrão em jogos novos.

## Regras de jogo que já foram decididas

- **Bomb Party**: erro não passa a vez e não custa vida; o jogador continua até o tempo acabar.
  Tempo estourado tira uma vida e mantém a mesma sílaba para o próximo. Só acerto sorteia sílaba nova.
  A aceleração encurta 1-2 s por acerto seguido, com mínimo de 3 s.
- **Onde Estou?**: `region` (mundo, brasil, europa, americas, outros) e `spread` (cidade ~25 km, bairro ~3 km).
  Configurações antigas usam os padrões de `clampSettings`.
- **Respostas (Qual é a Obra/Termo)**: `&` vira `e` só na comparação. `titleBase` ignora sufixos de temporada, parte e ano. Base mínima de 4 caracteres.
- **Termo**: Backspace apaga pelo cursor (`eraseAt`).

## Mapas e chaves

- Mapa do Onde Estou: MapTiler (`VITE_MAPTILER_KEY`). Sem a chave, cai no OSM, que mostra nomes locais.
  A chave é restrita por origem no painel do MapTiler: inclua o domínio de produção antes de publicar.
- Fotos 360°: Mapillary (`VITE_MAPILLARY_TOKEN`). Sem o token, o Onde Estou não sorteia foto.
- Variáveis `VITE_*` entram no bundle do navegador. Trate como públicas e restrinja por domínio sempre que o serviço permitir.
- `.env` nunca vai para o Git (já está no `.gitignore`). Atualize `.env.example` quando criar variável nova.

## Limites de segurança conhecidos (não resolvidos)

- O aviso de DevTools é heurístico: detecta a janela de ferramentas aberta, não o que foi feito nela. Pode dar falso positivo (zoom, painel). Não trate como prova de trapaça.
- Tudo que roda no navegador pode ser alterado. A pontuação é calculada no cliente em vários jogos.
- Em Onde Estou, a resposta (`lat`/`lon` da rodada) fica no banco e é legível por qualquer usuário autenticado. Quem souber onde olhar consegue a resposta sem DevTools.
- Se mexer nisso, proponha antes de implementar. A correção real é validar no servidor (Cloud Functions ou regras).

## Convenções

- Não use emojis na interface nem nos textos, salvo pedido explícito.
- Marca: o logo é uma paródia própria (`src/components/BrandLogo.vue` e `public/logo.svg`). Não copie logos de terceiros.
- Mudanças visíveis ao usuário entram no `src/data/changelog.ts`, na seção de versão mais recente.
- Commit e deploy só quando o dono pedir explicitamente. Nunca faça `git push --force`.
- Antes de encerrar uma tarefa: testes, `vue-tsc`, build e uma verificação no navegador (Playwright) quando a mudança for visual ou multiplayer.
