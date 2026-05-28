# WhatsApp Automation Bot

Servico pessoal em Node.js + TypeScript + NestJS para automacoes de WhatsApp. A automacao inicial envia mensagens de aniversario para um ou mais grupos, usando SQLite local, Baileys via WhatsApp Web/Linked Devices e OpenAI opcional com fallback local seguro.

## Comandos

- `npm run db:migrate`: aplica migrations TypeORM no SQLite.
- `npm run whatsapp:list-groups`: conecta no WhatsApp e lista grupos.
- `npm run targets:add -- birthdays.daily <groupJid>`: vincula um grupo a automacao de aniversarios.
- `npm run targets:list -- birthdays.daily`: lista destinos configurados.
- `npm run birthdays:check-today`: executa a automacao de aniversarios manualmente.
- `npm run dev`: inicia o servico NestJS continuo em desenvolvimento.
- `npm run build && npm start`: compila e inicia o servico em producao.
- `npm run check`: executa lint, build e testes.

Os aliases antigos `npm run list:groups` e `npm run check:today` continuam disponiveis durante a transicao.

## Configuracao

Copie `.env.example` para `.env` e preencha:

- `DATABASE_PATH`: caminho do SQLite.
- `WHATSAPP_AUTH_DIR`: pasta persistente da sessao Baileys.
- `WHATSAPP_GROUP_ID`: compatibilidade inicial para popular `birthdays.daily` com um grupo.
- `OPENAI_API_KEY`: chave OpenAI paga. Sem chave, a geracao cai no fallback local.
- `HTTP_HOST` e `HTTP_PORT`: host e porta dos endpoints NestJS.
- `METRICS_ENABLED`: `true` para expor metricas Prometheus em `/metrics`.

Nunca versione `.env`, banco SQLite, backups, logs com dados pessoais ou sessao Baileys.

## Endpoints

- `GET /health/live`
- `GET /health/ready`
- `GET /metrics`

## Documentacao Operacional

- [Operacao local e deploy](docs/operation.md)
- [Backup e sessao Baileys](docs/backup-and-session.md)
- [Riscos e limites](docs/risks-and-limits.md)
