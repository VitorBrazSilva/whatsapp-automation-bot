# Birthday WhatsApp Bot

Servico pessoal em Node.js + TypeScript + NestJS para enviar lembretes de aniversario a um grupo de WhatsApp configurado. O bot le aniversariantes no SQLite, gera uma mensagem pela OpenAI quando possivel e usa fallback local quando a API falha ou nao esta configurada.

## Arquitetura

O codigo segue Clean Architecture/Hexagonal em escala pequena:

- `src/domain/birthday`: regras puras de data, deduplicacao e mensagem.
- `src/application/run-birthday-reminder`: caso de uso unico do lembrete diario.
- `src/application/ports`: contratos para pessoas, entregas, mensagem, WhatsApp e migrations.
- `src/infrastructure`: TypeORM/SQLite, Baileys, OpenAI, configuracao e composition root NestJS.
- `src/presentation`: CLI e scheduler.

Nao ha API HTTP, health endpoint, metricas Prometheus, targets por automacao ou plataforma generica de automacoes.

## Comandos

- `npm run dev`: inicia o processo continuo com scheduler.
- `npm run build`: compila TypeScript em `dist/`.
- `npm start`: executa `dist/main.js`.
- `npm run db:migrate`: aplica migrations TypeORM no SQLite.
- `npm run whatsapp:list-groups`: conecta no WhatsApp e lista grupos.
- `npm run birthdays:check-today`: executa manualmente o envio do dia.
- `npm run check`: executa lint, build e testes.

## Configuracao

Copie `.env.example` para `.env` e preencha:

- `DATABASE_PATH`: caminho do SQLite.
- `WHATSAPP_AUTH_DIR`: pasta persistente da sessao Baileys.
- `WHATSAPP_GROUP_ID`: JID do grupo de WhatsApp que recebera as mensagens.
- `OPENAI_API_KEY`: chave OpenAI. Sem chave, a geracao usa fallback local.
- `OPENAI_MODEL`: modelo usado na Responses API.
- `APP_TIMEZONE` e `DAILY_CHECK_TIME`: fuso e horario do agendamento diario.

Nunca versione `.env`, banco SQLite, backups, logs com dados pessoais ou sessao Baileys.

## Documentacao Operacional

- [Operacao local e deploy](docs/operation.md)
- [Backup e sessao Baileys](docs/backup-and-session.md)
- [Riscos e limites](docs/risks-and-limits.md)
