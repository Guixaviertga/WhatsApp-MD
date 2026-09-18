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
| `PAIRING_NUMBER` | Número para login por código (só com `LOGIN_METHOD=pairing`) | — |
| `AUTO_READ_MESSAGES` | Confirmação automática de leitura | `true` |
| `AUTO_VIEW_STATUS` | Visualização automática de status | `true` |
| `AUTO_REACT_STATUS` | Reagir automaticamente aos status vistos | `false` |
| `AUTO_REJECT_CALLS` | Rejeitar chamadas automaticamente | `true` |
| `AUTO_REPLY_ENABLED` | Ativa as respostas automáticas (filtros + presets) | `true` |
| `STICKER_PACK_NAME` / `STICKER_PACK_AUTHOR` | Metadados padrão das figurinhas | `Levanter-MD` / `Meu Bot` |
| `API_ENABLED` / `API_PORT` | Liga o esqueleto de API HTTP (`lib/api.js`, ainda sem rotas) | `false` / `3000` |
| `LOG_LEVEL` | Nível de log do pino (`info`, `debug`, ...) | `info` |

Cada sessão listada em `SESSION_IDS` roda isolada, em `sessions/<id>/` — apague essa pasta para forçar um novo login daquela sessão.

## Comandos disponíveis

| Comando | Descrição |
|---|---|
| `.menu` | Lista todos os comandos no idioma do chat |
| `.ping` | Testa se o bot está online |
| `.lang <código>` | Troca o idioma do chat atual |
| `.sticker` | Cria uma figurinha (envie ou responda a uma imagem/vídeo) |
| `.pack <nome>` | Inicia a coleta de um pacote de figurinhas personalizado |
| `.pack fim` | Encerra a coleta e informa quantas figurinhas foram criadas |

## Sistema de plugins

Todo arquivo `.js` em `plugins/` (nativos) ou `eplugins/` (instalados depois) é carregado automaticamente por `lib/cmd.js`. Um plugin exporta:

```js
module.exports = {
  name: 'exemplo',
  aliases: ['ex'],     // opcional
  owner: false,        // opcional: só os números em OWNER_NUMBERS podem usar
  group: false,        // opcional: só funciona em grupos
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
| `args` | Argumentos do comando, já separados |
| `prefix` | Prefixo em uso naquele chat |
| `sock` | A conexão do Baileys, para casos que as classes não cobrem |
| `allCommands` | Lista de todos os comandos registrados (usada pelo `.menu`) |

Todo envio passa por retentativa automática (`lib/sendMessage.js`), então plugins não precisam tratar falha de rede.

### Regras de padronização

1. **Nenhum texto visível ao usuário dentro do plugin.** Todo texto é uma chave em `lang/*.json` e vai para a tela via `reply.t(chave, vars)`. É isso que garante que o bot funcione nos 13 idiomas.
2. **A descrição do comando é a chave `cmd_<nome>_desc`.** O `.menu` lê de lá — não existe campo `description` no plugin.
3. **Ao criar um comando, adicione as chaves novas nos 13 arquivos de `lang/`.** Se faltar em algum idioma, o `lang.t` cai para o inglês e, se também faltar, mostra o nome da chave.

## Banco de dados (lowdb)

`lib/db/index.js` mantém um único arquivo `database/db.json` com uma coleção por área (sessões, filtros, avisos, mute, votos, boas-vindas, antilink). Cada `lib/db/<nome>.js` expõe funções simples de CRUD sobre a sua coleção — sem depender de nenhum serviço externo, ideal para Termux.

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
