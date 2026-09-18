# Levanter-MD

Bot de WhatsApp completo em **Node.js**, construído sobre [Baileys](https://github.com/WhiskeySockets/Baileys) v7 — pacote `baileys` (conexão multi-dispositivo, sem precisar de navegador/Puppeteer) — com uma estrutura de projeto inspirada no [Levanter](https://github.com/lyfe00011/levanter): núcleo em `lib/`, comandos em `plugins/` (mais `eplugins/` para plugins instalados em runtime), banco de dados local em `lib/db/`, traduções em `lang/` e mídia em `media/`.

## Recursos já implementados

- 🧩 **Multi-sessão** — gerencia várias contas de WhatsApp ao mesmo tempo, cada uma com credenciais e estado totalmente isolados (`sessions/<id>/`), sem uma interferir na outra.
- 💬 **Respostas automáticas** em duas camadas: presets globais (`data/replies.json`) e filtros customizados por chat, persistidos em `lib/db/filter.js` (prontos para um futuro comando `.filter`).
- 🌐 **13 idiomas** prontos em `lang/`: `pt`, `en`, `es`, `hi`, `ar`, `fr`, `bn`, `id`, `ml`, `ru`, `tr`, `ur`, `zh`. Idioma padrão configurável, trocável por chat com `.lang <código>`.
- 👀 **Visualização automática de status** dos contatos.
- ✅ **Confirmação automática de leitura** das mensagens recebidas.
- 📵 **Rejeição automática de chamadas** de voz/vídeo, com aviso opcional a quem ligou.
- 🎨 **Figurinhas e pacotes personalizados** — `.sticker` para uma figurinha avulsa, `.pack <nome>` / `.pack fim` para um pacote inteiro a partir de várias imagens/vídeos.
- 👋 **Boas-vindas/despedida em grupos** (`lib/participantUpdate.js`), com imagem aleatória de `media/welFolder` ou `media/goodFolder` quando disponível — habilite por grupo escrevendo em `lib/db/greetings.js` (ainda sem um comando dedicado, ver "Próximos passos").
- 🗄️ **Banco de dados local em JSON** (`lowdb`, sem serviço externo) para sessões, filtros, avisos, mute, votos, boas-vindas e antilink — pronto para os próximos plugins consumirem.
- 🔌 **Sistema de plugins** — comandos nativos em `plugins/`, e uma pasta `eplugins/` carregada automaticamente em runtime para plugins instalados depois (ex.: via Gist).
- ⚙️ **100% configurável** via `.env` **ou** `config.json`.
- 🚀 Pronto para **Termux**, **painel Pterodactyl** e **Heroku** (`app.json` + `heroku.yml` + `Dockerfile`).

> Os plugins de conteúdo (chatgpt, gemini, downloaders de tiktok/instagram/twitter/spotify/y2mate, antilink, grupo, etc.) ainda **não** foram implementados — a estrutura já está pronta em `plugins/` para recebê-los quando você decidir adicioná-los.

## Estrutura do projeto

```
index.js                 # ponto de entrada
config.js                # lê .env / config.json e exporta as opções
config.env.example
config.json.example
package.json
Dockerfile
app.json                 # manifesto para "Deploy to Heroku"
heroku.yml

lib/                      # núcleo do bot
├── client.js             # inicia/gerencia todas as sessões
├── baileys.js             # integração de baixo nível com o Baileys
├── auth.js                # credenciais por sessão (sessions/<id>/)
├── handle.js               # processamento de cada mensagem recebida
├── events.js                # registra os listeners do socket
├── cmd.js                    # carrega plugins/ e eplugins/, roteia comandos
├── api.js                     # esqueleto de API HTTP (desativado por padrão)
├── sendMessage.js              # envio com retentativa automática
├── participantUpdate.js         # boas-vindas/despedida em grupos
├── store.js                      # cache em memória (contatos, metadados de grupo)
├── config.js                      # re-exporta o config.js da raiz
├── lang.js                         # carregador de traduções (lang/*.json)
├── media.js, ffmpeg.js, stickerMaker.js, stickerPack.js, presets.js, logger.js
│
├── class/
│   ├── Base.js, Message.js, ReplyMessage.js, Wcg.js, index.js
│
└── db/                     # lowdb — um arquivo por coleção
    ├── index.js, session.js, plugins.js, cmd.js, filter.js,
    └── greetings.js, antilink.js, warn.js, mute.js, vote.js

plugins/                 # comandos nativos (carregados automaticamente)
├── _menu.js, ping.js, lang.js, sticker.js (inclui .sticker e .pack)

eplugins/                # plugins externos instalados em runtime

lang/                    # pt, en, es, hi, ar, fr, bn, id, ml, ru, tr, ur, zh

media/
├── banFolder/, goodFolder/, welFolder/   # imagens usadas pelo bot

data/replies.json        # presets globais de resposta automática
sessions/                # credenciais de cada sessão (gerado automaticamente)
database/                # db.json do lowdb (gerado automaticamente)
```

## Requisitos

- **Node.js 22.12 ou superior.** O Baileys é distribuído como ESM, e só a partir do Node 22.12 é possível carregá-lo de um projeto CommonJS como este. Em versões anteriores a inicialização falha com `ERR_REQUIRE_ESM`. Confira com `node -v`.
- `ffmpeg` instalado no sistema (necessário para figurinhas em vídeo)

## Instalação local

```bash
git clone <url-do-repositorio>
cd WhatsApp-MD
cp config.env.example .env   # ou: cp config.json.example config.json
npm install
npm start
```

Na primeira execução aparece um **QR Code** no terminal (ou um **código de pareamento**, se `LOGIN_METHOD=pairing`). Escaneie com o WhatsApp do celular em *Aparelhos conectados*.

> **Usando `LOGIN_METHOD=pairing`**: é obrigatório definir `PAIRING_NUMBER` (só dígitos, com código do país, ex.: `5511999999999`, sem `+` nem espaços) — sem isso o bot agora avisa no console em vez de ficar em silêncio. Depois de iniciar, espere a mensagem "Conectando ao WhatsApp..." e o código aparecerá logo em seguida (pode levar alguns segundos em conexões mais lentas). No celular: *Aparelhos conectados → Conectar um aparelho → Conectar com número de telefone*.

## Configuração

Use `.env` **ou** `config.json` (o `.env` tem prioridade se os dois existirem — útil em painéis que só suportam um dos dois formatos).

| Variável | Descrição | Padrão |
|---|---|---|
| `SESSION_IDS` | IDs das sessões, separados por vírgula (ex.: `pessoal,trabalho`) | `principal` |
| `OWNER_NUMBERS` | Números com permissão de dono, separados por vírgula (só dígitos, com DDI). Comandos marcados com `owner: true` só respondem a eles. Vazio = comandos restritos ficam fechados para todos | — |
| `DEFAULT_LANGUAGE` | Idioma padrão (`pt`, `en`, `es`, `hi`, `ar`, `fr`, `bn`, `id`, `ml`, `ru`, `tr`, `ur`, `zh`) | `pt` |
| `BOT_PREFIX` | Prefixo dos comandos | `.` |
| `LOGIN_METHOD` | `qr` ou `pairing` | `qr` |
| `PAIRING_NUMBER` | Número para login por código, quando existe **uma** sessão (só com `LOGIN_METHOD=pairing`) | — |
| `PAIRING_NUMBERS` | Número por sessão, no formato `sessao:numero` separado por vírgula. Use quando houver mais de uma sessão | — |
| `AUTO_READ_MESSAGES` | Confirmação automática de leitura | `true` |
| `AUTO_VIEW_STATUS` | Visualização automática de status | `true` |
| `AUTO_REACT_STATUS` | Reagir automaticamente aos status vistos | `false` |
| `AUTO_REJECT_CALLS` | Rejeitar chamadas automaticamente | `true` |
| `AUTO_REPLY_ENABLED` | Ativa as respostas automáticas (filtros + presets) | `true` |
| `STICKER_PACK_NAME` / `STICKER_PACK_AUTHOR` | Metadados padrão das figurinhas | `Levanter-MD` / `Meu Bot` |
| `API_ENABLED` / `API_PORT` | Liga o esqueleto de API HTTP (`lib/api.js`, ainda sem rotas) | `false` / `3000` |
| `LOG_LEVEL` | Nível de log do bot (`trace`, `debug`, `info`, `warn`, `error`) | `info` |
| `LOG_PRETTY` | `true` = saída colorida e compacta; `false` = JSON cru (para painéis) | `true` |
| `BAILEYS_LOG_LEVEL` | Nível dos logs internos do Baileys — veja abaixo | `silent` |
| `LOG_TO_FILE` / `LOG_DIR` / `LOG_RETENTION_DAYS` | Salvar os logs em arquivo (um por dia, em JSON) e por quantos dias manter | `false` / `logs` / `7` |
| `LOG_MESSAGE_CONTENT` | Registrar o texto das mensagens no log (dado pessoal) | `false` |

Cada sessão listada em `SESSION_IDS` roda isolada, em `sessions/<id>/` — apague essa pasta para forçar um novo login daquela sessão.

### Conectando mais de um número

O bot mantém todas as sessões de `SESSION_IDS` conectadas ao mesmo tempo, cada uma com o seu próprio WebSocket e as suas próprias credenciais. Para somar uma conta nova, basta declará-la e vinculá-la **uma vez**:

```bash
SESSION_IDS=principal,amigo
```

Depois, escolha como vincular o número novo:

- **QR Code** (`LOGIN_METHOD=qr`): ao iniciar, aparece o QR **apenas da sessão ainda não vinculada** — as já registradas nunca mais pedem login. Serve quando a pessoa está junto de você para escanear.
- **Código de pareamento** (`LOGIN_METHOD=pairing`): informe um número por sessão, já que cada conta precisa do seu próprio código:

  ```bash
  PAIRING_NUMBERS=principal:5511999999999,amigo:5521988887777
  ```

  Ao iniciar, cada sessão gera o seu código, e cada pessoa digita o seu em *Aparelhos conectados → Conectar um aparelho → Conectar com número de telefone*.

Se uma sessão ficar sem número, o bot avisa no console em vez de gerar um código para a conta errada. O vínculo é salvo em disco, então isso é feito uma vez só: nas próximas execuções todas as sessões sobem sozinhas.

## Comandos disponíveis

| Comando | Descrição |
|---|---|
| `.menu` | Lista todos os comandos no idioma do chat |
| `.ping` | Testa se o bot está online |
| `.lang <código>` | Troca o idioma do chat atual |
| `.sticker` | Cria uma figurinha (envie ou responda a uma imagem/vídeo) |
| `.pack <nome>` | Inicia a coleta de um pacote de figurinhas personalizado |
| `.pack fim` | Encerra a coleta e informa quantas figurinhas foram criadas |
| `.circle` / `.circulo` | Figurinha circular (mesmo que `.sticker -circle`) |
| `.steal` / `.roubar` | Rouba a figurinha citada, trocando pack/autor pelos seus (`STICKER_PACK_NAME`/`STICKER_PACK_AUTHOR`) |
| `.rename Pack / Autor` | Rouba a figurinha com pack/autor customizado — salva por usuário, e nas próximas vezes `.rename` sozinho já reusa |

**Flags de estilo em `.sticker`:** `-crop` (padrão, cobre sem borda) / `-full` (mostra tudo, com borda transparente) / `-circle` / `-borda` (cantos arredondados). Ex.: `.sticker -full`.

### Administração de grupo

Exigem que **quem envia** seja admin do grupo (ou dono do bot) e que o **bot** seja admin:

| Comando | Descrição |
|---|---|
| `.kick` | Remove alguém (mencione ou responda). Nunca remove outros admins |
| `.add <número>` | Adiciona um número ao grupo |
| `.promote` / `.demote` | Concede ou retira o cargo de administrador |
| `.close` / `.open` | Fecha (só admins falam) ou abre o grupo |

## Sistema de plugins

Todo arquivo `.js` em `plugins/` (nativos) ou `eplugins/` (instalados depois) é carregado automaticamente por `lib/cmd.js`. Um plugin exporta:

```js
module.exports = {
  name: 'exemplo',
  aliases: ['ex'],     // opcional
  owner: false,        // opcional: só os números em OWNER_NUMBERS podem usar
  group: false,        // opcional: só funciona em grupos
  admin: false,        // opcional: quem envia precisa ser admin do grupo
  botAdmin: false,     // opcional: o bot precisa ser admin do grupo
  async execute({ m, reply, args, prefix, sock, allCommands }) {
    await reply.t('cmd_exemplo_resposta', { nome: m.pushName });
  },
};
```

Um arquivo também pode exportar um **array** de comandos (como `plugins/sticker.js`, que registra `.sticker` e `.pack` juntos).

### O que o plugin recebe

| Campo | O que é |
|---|---|
| `m` | A mensagem ([`lib/class/Message.js`](lib/class/Message.js)): `m.text`, `m.chatId`, `m.sender`, `m.isGroup`, `m.pushName`, `m.timestamp`, `m.hasMedia()`, `m.mediaTarget`, `m.raw` |
| `reply` | Resposta já citando a mensagem ([`lib/class/ReplyMessage.js`](lib/class/ReplyMessage.js)): `reply.t(chave, vars)`, `reply.text()`, `reply.sticker()`, `reply.image()` |
| `args` | Argumentos do comando, já separados por espaço |
| `match` | Tudo que veio depois do comando, em uma string só (equivale ao `match` do Levanter) |
| `prefix` | Prefixo em uso naquele chat |
| `sock` | A conexão do Baileys, para casos que as classes não cobrem |
| `allCommands` | Lista de todos os comandos registrados (usada pelo `.menu`) |

Todo envio passa por retentativa automática (`lib/sendMessage.js`), então plugins não precisam tratar falha de rede.

> **Por que não há `pattern` (regex) como no Levanter:** lá cada mensagem testa o regex de todos os comandos até achar um — com 80 plugins, são até 80 regex por mensagem. Aqui um `Map.get(nome)` resolve em uma busca só, independente de quantos plugins existam. O `match` cobre o que o regex do Levanter entregava na prática.

### Regras de padronização

1. **Nenhum texto visível ao usuário dentro do plugin.** Todo texto é uma chave em `lang/*.json` e vai para a tela via `reply.t(chave, vars)`. É isso que garante que o bot funcione nos 13 idiomas.
2. **A descrição do comando é a chave `cmd_<nome>_desc`.** O `.menu` lê de lá — não existe campo `description` no plugin.
3. **Ao criar um comando, adicione as chaves novas nos 13 arquivos de `lang/`.** Se faltar em algum idioma, o `lang.t` cai para o inglês e, se também faltar, mostra o nome da chave.

## Processamento de mensagens

Cada conversa tem a sua própria fila (`lib/queue.js`): **conversas diferentes são processadas em paralelo, mas a ordem é mantida dentro de cada uma**.

Isso importa porque tarefas pesadas existem — criar uma figurinha leva alguns segundos. Com processamento em série, essa figurinha segurava as mensagens de todos os outros chats; com a fila por conversa, só a própria conversa espera. A ordem dentro do chat continua garantida, o que a coleta do `.pack` exige.

A chave da fila inclui a sessão (`sessao:chat`), então duas contas que enxergam o mesmo grupo não entram na fila uma da outra.

## Logs

A saída padrão é uma linha curta por evento, pensada para caber na tela do celular:

```
19:24:57 handle   msg em grupo de=Gui tipo=texto n=12
19:24:57 handle   resposta automática origem=preset
19:24:57 cmd      executado cmd=ping de=Gui ms=266
19:24:57 cmd      WARN recusado: só o dono cmd=desligar de=João
19:24:58 sticker  figurinha criada ms=412 kb=38
```

Formato: `hora módulo [NÍVEL] mensagem campos=valor`. O nível só aparece quando **não** é `INFO` — a cor já o diferencia, e assim a linha cabe na tela de um celular.

O campo `de` mostra o nome do contato quando existe. O número completo (`num`) fica de fora da tela para encurtar a linha, mas continua no arquivo de log; para vê-lo na tela também, use `LOG_LEVEL=debug`.

**Por que o log estava poluído antes:** o Baileys registra cada nó do protocolo e recebia o mesmo nível do bot, afogando as linhas úteis. Agora ele tem o seu próprio `BAILEYS_LOG_LEVEL`, que vem `silent`. Para investigar problemas de conexão ou pareamento, suba temporariamente:

```bash
BAILEYS_LOG_LEVEL=debug npm start
```

**Arquivo.** Com `LOG_TO_FILE=true`, além da tela os logs vão para `logs/bot-AAAA-MM-DD.log`, sempre em JSON (mesmo com a tela em modo legível), para dar para filtrar depois:

```bash
grep '"cmd":"ping"' logs/bot-*.log        # todos os .ping
grep '"level":50' logs/bot-*.log          # só os erros
```

Arquivos mais antigos que `LOG_RETENTION_DAYS` são apagados quando o bot inicia.

**Privacidade.** O texto das mensagens **não** é registrado por padrão — o log guarda só remetente, tipo e tamanho. Ligue `LOG_MESSAGE_CONTENT=true` apenas se realmente precisar, lembrando que isso grava conversas de terceiros em disco.

## Banco de dados (lowdb)

`lib/db/index.js` mantém um único arquivo `database/db.json` com uma coleção por área (sessões, filtros, avisos, mute, votos, boas-vindas, antilink, pack/autor salvo pelo `.rename`). Cada `lib/db/<nome>.js` expõe funções simples de CRUD sobre a sua coleção — sem depender de nenhum serviço externo, ideal para Termux.

## Próximos passos (plugins ainda não incluídos)

A estrutura já está pronta para receber, quando você quiser:

- `chatgpt.js`, `gemini.js` — integrações com IA
- `tiktok.js`, `insta.js`, `twitter.js`, `facebook.js`, `pinterest.js`, `spotify.js`, `y2mate.js` — downloaders de mídia
- `antiLink.js`, `group.js` — moderação de grupo (já há `lib/db/antilink.js` e `lib/db/warn.js` prontos para isso)
- `alive.js`, `movie.js`, `plugins.js` (gerenciador de `eplugins/` via Gist)

## Personalizando respostas automáticas

Edite `data/replies.json` (presets globais, valem para todos os chats). Cada regra tem `keywords` e:

- `key`: referencia uma chave já traduzida em `lang/*.json`, **ou**
- `replies`: um objeto com o texto pronto em cada idioma.

```json
{
  "keywords": ["preço", "price"],
  "replies": { "pt": "Consulte nossa tabela...", "en": "Check our price list..." }
}
```

Filtros específicos por chat (mais dinâmicos, sobrepõem os presets) ficam em `lib/db/filter.js` — hoje só via código/console, até que um comando `.filter` seja adicionado.

## Adicionando um novo idioma

Crie `lang/<código>.json` com as mesmas chaves de `lang/en.json`. Ele já aparece em `.lang` e em `DEFAULT_LANGUAGE`.

---

## Deploy no Termux (Android)

```bash
pkg update && pkg upgrade -y
pkg install -y nodejs-lts git ffmpeg python build-essential

git clone <url-do-repositorio>
cd WhatsApp-MD
cp config.env.example .env
npm install
npm start
```

Para manter rodando em segundo plano:

```bash
pkg install -y tmux
tmux new -s levanter-md
npm start
# Ctrl+B depois D para sair sem encerrar o processo
# "tmux attach -t levanter-md" para voltar
```

Ative "Manter Termux acordado" nas configurações do app e desative a otimização de bateria para o Termux, para evitar que o Android mate o processo.

### Problema comum: erro ao instalar `sharp` no Termux

O Baileys lista `sharp` como dependência (usada só para gerar miniaturas de preview de imagens) e o `npm` tenta instalá-la automaticamente — mas não existe binário pré-compilado de `sharp`/`libvips` para Android/ARM, e compilar do zero falha no Termux. Este projeto já inclui um `.npmrc` com `legacy-peer-deps=true`, que evita essa instalação forçada. Se mesmo assim o erro aparecer, rode:

```bash
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

A criação de figurinhas deste bot **não depende de `sharp`** — usa apenas `ffmpeg` e `node-webpmux` (puro JavaScript/WASM, sem compilação nativa).

---

## Deploy em painel Pterodactyl

1. No painel Admin, vá em **Nests → Import Egg** e importe [`pterodactyl/egg-whatsapp-md.json`](pterodactyl/egg-whatsapp-md.json).
2. Crie um servidor usando o egg **WhatsApp-MD**, imagem Docker `Node.js 20`.
3. Aponte o repositório Git deste projeto (ou envie os arquivos pelo gerenciador de arquivos do painel).
4. Ajuste as variáveis na aba **Startup** do servidor.
5. Inicie — o script de instalação roda `npm install` automaticamente. O QR Code aparece no **Console**.

> Para usar uma imagem Docker própria (com `ffmpeg` já embutido), use o [`Dockerfile`](Dockerfile) incluído.

## Deploy no Heroku

Este projeto usa o stack `container` do Heroku (via `heroku.yml` + `Dockerfile`, já que o bot depende de `ffmpeg`, indisponível nos buildpacks padrão).

```bash
heroku create meu-bot --stack=container
heroku config:set SESSION_IDS=principal DEFAULT_LANGUAGE=pt
git push heroku HEAD:main
```

`app.json` documenta as variáveis para quem preferir usar o botão "Deploy to Heroku". Como não há dyno `web` obrigatório por padrão (a API HTTP vem desativada), o processo sobe como `worker` — em contas gratuitas/eco isso ainda consome as horas do dyno normalmente.

### Persistência das sessões e do banco

As credenciais ficam em `sessions/<id>/` e o banco local em `database/db.json`. Garanta que essas pastas estejam num volume persistente (no Pterodactyl, o diretório do servidor já é persistente; no Heroku container, o filesystem é efêmero — cada novo deploy apaga sessões e banco, então reautentique após cada deploy ou use um volume externo).

---

## Licença

MIT
