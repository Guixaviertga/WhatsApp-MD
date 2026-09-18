# eplugins/

Pasta criada em runtime para plugins externos instalados dinamicamente
(por exemplo, via um Gist), sem precisar editar o código-fonte do bot.

`lib/cmd.js` carrega automaticamente qualquer `.js` colocado aqui, com o
mesmo formato de plugin usado em `plugins/` (exporte um objeto de comando,
ou um array de objetos).

Arquivos `.js` desta pasta são ignorados pelo git (ver `.gitignore`) — só
o `.gitkeep`/este README ficam versionados.
