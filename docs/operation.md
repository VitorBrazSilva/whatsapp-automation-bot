# Operacao local e deploy

## Operacao local

1. Instale dependencias com `npm install`.
2. Crie `.env` a partir de `.env.example`.
3. Execute `npm run db:migrate`.
4. Execute `npm run whatsapp:list-groups`, leia o QR Code e copie o JID do grupo desejado.
5. Configure `WHATSAPP_GROUP_ID` com esse JID.
6. Execute `npm run birthdays:check-today` para validar o fluxo sem esperar o agendamento.
7. Execute `npm run dev` para manter o processo continuo com scheduler.

O processo registra eventos JSON no console:

- `info`: inicio/fim do check, quantidade encontrada e envios concluidos.
- `warn`: duplicidade ignorada ou fallback recuperavel.
- `error`: erro fatal de inicializacao, banco, conexao WhatsApp ou envio.

## Arquitetura operacional

Nao existe servidor HTTP operacional. NestJS e usado como application context para DI, lifecycle, scheduler e CLIs. O scheduler e as CLIs chamam `RunBirthdayReminderUseCase`; TypeORM, Baileys e OpenAI ficam em `infrastructure`.

## Deploy em Oracle Cloud Always Free

1. Crie uma VM Always Free Linux com firewall restrito a SSH.
2. Instale Docker e Docker Compose plugin.
3. Clone o repositorio na VM.
4. Crie `.env` na VM com os valores reais.
5. Execute `docker compose up -d --build`.
6. Leia o QR Code nos logs do container na primeira conexao:

```bash
docker compose logs -f birthday-whatsapp-bot
```

O `docker-compose.yml` usa volumes nomeados para `/app/data` e `/app/sessions`. Esses volumes preservam o SQLite e a sessao Baileys entre recriacoes do container.

Para atualizar:

```bash
git pull
docker compose up -d --build
docker compose logs -f birthday-whatsapp-bot
```

Para rodar migracoes manualmente no container:

```bash
docker compose run --rm birthday-whatsapp-bot npm run db:migrate
```

Para executar uma verificacao manual:

```bash
docker compose run --rm birthday-whatsapp-bot npm run birthdays:check-today
```

Para listar grupos:

```bash
docker compose run --rm birthday-whatsapp-bot npm run whatsapp:list-groups
```
