# WhatsApp-MD

Bot de WhatsApp completo em **Node.js**, construído sobre [Baileys](https://github.com/WhiskeySockets/Baileys) (conexão multi-dispositivo, sem precisar de navegador/Puppeteer).

## Recursos

- 🧩 **Multi-sessão** — gerencia várias contas de WhatsApp ao mesmo tempo, cada uma com credenciais e estado totalmente isolados (`sessions/<id>/`), sem uma interferir na outra.
- 💬 **Respostas automáticas personalizáveis** — regras por palavra-chave configuráveis em `data/replies.json`, sem precisar mexer no código.
- 🌐 **Multilíngue** — inglês, espanhol, hindi, árabe e português prontos; idioma padrão configurável via `.env` e trocável por chat com `.lang <código>`.
- 👀 **Visualização automática de status** — marca os status de contatos como vistos automaticamente.
- ✅ **Confirmação automática de leitura** — marca mensagens recebidas como lidas (double-check azul).
- 📵 **Rejeição automática de chamadas** — recusa chamadas de voz/vídeo e pode avisar quem ligou.
- 🎨 **Criação de figurinhas e pacotes personalizados** — comando `.sticker` para uma figurinha avulsa, e `.pack <nome>` / `.pack fim` para criar um pacote inteiro a partir de várias imagens/vídeos enviados em sequência.
- ⚙️ **100% configurável via `.env`**.
- 🚀 Pronto para rodar no **Termux** (Android) ou em um **painel Pterodactyl**.

## Estrutura do projeto

```
src/
  index.js              # ponto de entrada
  core/
    SessionManager.js   # inicia e mantém todas as sessões
    Session.js          # uma conexão WhatsApp isolada
  config/env.js          # leitura e validação do .env
  i18n/                  # traduções (en, es, hi, ar, pt)
  features/              # auto-read, auto-status, auto-reject-call, stickers...
  commands/               # comandos: menu, ping, lang, sticker, pack
data/replies.json        # regras de resposta automática (edite livremente)
sessions/                # credenciais de cada sessão (gerado automaticamente)
```

## Requisitos

- Node.js 18 ou superior
- `ffmpeg` instalado no sistema (necessário para figurinhas em vídeo)

## Instalação local

```bash
git clone <url-do-repositorio>
cd WhatsApp-MD
cp .env.example .env
npm install
npm start
```

Ao rodar pela primeira vez, um **QR Code** aparecerá no terminal (ou um **código de pareamento**, se `LOGIN_METHOD=pairing`). Escaneie com o WhatsApp do celular em *Aparelhos conectados*.

## Configuração (`.env`)

| Variável | Descrição | Padrão |
|---|---|---|
| `SESSION_IDS` | IDs das sessões, separados por vírgula (ex.: `pessoal,trabalho`) | `principal` |
| `DEFAULT_LANGUAGE` | Idioma padrão (`en`, `es`, `hi`, `ar`, `pt`) | `pt` |
| `BOT_PREFIX` | Prefixo dos comandos | `.` |
| `LOGIN_METHOD` | `qr` ou `pairing` | `qr` |
| `PAIRING_NUMBER` | Número para login por código (só com `LOGIN_METHOD=pairing`) | — |
| `AUTO_READ_MESSAGES` | Confirmação automática de leitura | `true` |
| `AUTO_VIEW_STATUS` | Visualização automática de status | `true` |
| `AUTO_REACT_STATUS` | Reagir automaticamente aos status vistos | `false` |
| `AUTO_REJECT_CALLS` | Rejeitar chamadas automaticamente | `true` |
| `AUTO_REPLY_ENABLED` | Ativa as respostas automáticas por palavra-chave | `true` |
| `STICKER_PACK_NAME` / `STICKER_PACK_AUTHOR` | Metadados padrão das figurinhas | `WhatsApp-MD` / `Meu Bot` |
| `LOG_LEVEL` | Nível de log do pino (`info`, `debug`, ...) | `info` |

Cada sessão listada em `SESSION_IDS` roda de forma independente, com sua própria pasta em `sessions/<id>/` — apague essa pasta para forçar um novo login daquela sessão específica.

## Comandos disponíveis

| Comando | Descrição |
|---|---|
| `.menu` | Lista todos os comandos no idioma do chat |
| `.ping` | Testa se o bot está online |
| `.lang <código>` | Troca o idioma do chat atual |
| `.sticker` | Cria uma figurinha (envie ou responda a uma imagem/vídeo) |
| `.pack <nome>` | Inicia a coleta de um pacote de figurinhas personalizado |
| `.pack fim` | Encerra a coleta e informa quantas figurinhas foram criadas |

## Personalizando respostas automáticas

Edite `data/replies.json`. Cada regra tem uma lista de `keywords` e:

- `key`: referencia uma chave já traduzida em `src/i18n/locales/*.json`, **ou**
- `replies`: um objeto com o texto pronto em cada idioma (`pt`, `en`, `es`, `hi`, `ar`).

```json
{
  "keywords": ["preço", "price"],
  "replies": { "pt": "Consulte nossa tabela...", "en": "Check our price list..." }
}
```

As alterações são recarregadas automaticamente na próxima inicialização.

## Adicionando um novo idioma

1. Crie `src/i18n/locales/<código>.json` com as mesmas chaves de `en.json`.
2. Pronto — o idioma já aparece em `.lang` e no `DEFAULT_LANGUAGE`.

---

## Deploy no Termux (Android)

```bash
pkg update && pkg upgrade -y
pkg install -y nodejs-lts git ffmpeg python build-essential

git clone <url-do-repositorio>
cd WhatsApp-MD
cp .env.example .env
npm install
npm start
```

Dicas para manter rodando em segundo plano no Termux:

```bash
pkg install -y tmux
tmux new -s whatsapp-md
npm start
# Ctrl+B depois D para sair sem encerrar o processo
# "tmux attach -t whatsapp-md" para voltar
```

Para evitar que o Android mate o processo, ative "Manter Termux acordado" nas configurações do app e desative a otimização de bateria para o Termux.

---

## Deploy em painel Pterodactyl

1. No painel Admin, vá em **Nests → Import Egg** e importe o arquivo [`pterodactyl/egg-whatsapp-md.json`](pterodactyl/egg-whatsapp-md.json) deste repositório.
2. Crie um novo servidor usando o egg **WhatsApp-MD**, escolhendo a imagem Docker `Node.js 20`.
3. Em **Startup**, aponte o repositório Git deste projeto (ou faça upload dos arquivos pelo gerenciador de arquivos do painel).
4. Ajuste as variáveis do egg (`SESSION_IDS`, `DEFAULT_LANGUAGE`, `BOT_PREFIX`, etc.) na aba **Startup** do servidor.
5. Inicie o servidor — o script de instalação roda `npm install` automaticamente. O QR Code aparecerá no **Console** do painel.
6. Escaneie o QR Code pelo WhatsApp do celular.

> Se preferir usar uma imagem Docker própria (com `ffmpeg` já embutido), use o [`Dockerfile`](Dockerfile) incluído: publique a imagem em um registry e configure-a como `docker_images` no egg.

### Persistência das sessões

As credenciais ficam em `sessions/<id>/`. Garanta que essa pasta esteja no volume persistente do servidor (no Pterodactyl, o diretório do servidor já é persistente por padrão) para não precisar escanear o QR Code novamente a cada reinício.

---

## Licença

MIT
