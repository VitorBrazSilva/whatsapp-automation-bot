# Birthday WhatsApp Bot

Bot pessoal em Node.js + TypeScript para enviar mensagens de aniversario em um grupo familiar do WhatsApp. A v1 usa SQLite local, Baileys via WhatsApp Web/Linked Devices e OpenAI com fallback local seguro.

## Comandos

- `npm run db:migrate`: aplica migracoes SQLite.
- `npm run list:groups`: conecta no WhatsApp e lista grupos para obter `WHATSAPP_GROUP_ID`.
- `npm run check:today`: executa a verificacao manual do dia.
- `npm run dev`: inicia o bot continuo em desenvolvimento.
- `npm run build && npm start`: compila e inicia o bot em producao.
- `npm run check`: executa lint, build e testes.

## Configuracao

Copie `.env.example` para `.env` e preencha:

- `WHATSAPP_GROUP_ID`: grupo alvo, obtido por `npm run list:groups`.
- `OPENAI_API_KEY`: chave OpenAI paga. Sem chave, a geracao cai no fallback local.
- `DATABASE_PATH`: caminho do SQLite.
- `WHATSAPP_AUTH_DIR`: pasta persistente da sessao Baileys.
- `METRICS_ENABLED`: `true` para expor metricas Prometheus em `/metrics`.

Nunca versione `.env`, banco SQLite, backups, logs com dados pessoais ou sessao Baileys.

## Documentacao Operacional

- [Operacao local e deploy](docs/operation.md)
- [Backup e sessao Baileys](docs/backup-and-session.md)
- [Riscos e limites da v1](docs/risks-and-limits.md)
