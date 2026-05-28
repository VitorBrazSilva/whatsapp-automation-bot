# Operacao local e deploy

## Operacao local

1. Instale dependencias com `npm install`.
2. Crie `.env` a partir de `.env.example`.
3. Execute `npm run db:migrate`.
4. Execute `npm run whatsapp:list-groups` e leia o QR Code no WhatsApp em dispositivos vinculados.
5. Vincule um grupo com `npm run targets:add -- birthdays.daily <groupJid>`.
6. Execute `npm run birthdays:check-today` para validar o fluxo sem esperar o agendamento.
7. Execute `npm run dev` para manter o servico NestJS em processo continuo.

`WHATSAPP_GROUP_ID` ainda e aceito como compatibilidade: no startup e nos comandos ele popula um target para `birthdays.daily` quando existir.

O servico registra eventos em JSON estruturado. Logs de `info` confirmam runs, aniversariantes encontrados, envios e reconexoes. Logs de `warn` indicam duplicidades evitadas, fallback de mensagem e estados recuperaveis. Logs de `error` indicam falhas de provedor, banco ou fluxo operacional.

## HTTP operacional

O NestJS expoe endpoints no host e porta configurados por `HTTP_HOST` e `HTTP_PORT`.

- `GET /health/live`: processo vivo.
- `GET /health/ready`: readiness basico de banco e WhatsApp aceitavel.
- `GET /metrics`: metricas Prometheus quando `METRICS_ENABLED=true`.

## Metricas

Metricas disponiveis:

- `automation_runs_total{automation,status}`
- `message_deliveries_total{automation,status}`
- `message_delivery_duplicates_total{automation}`
- `birthday_people_matched_total`
- `message_generation_fallbacks_total{automation,reason}`
- `whatsapp_connection_state`

Valores de `whatsapp_connection_state`: `1` pronto, `0.5` conectando, `0` fechado/ocioso e `-1` deslogado.

## Deploy em Oracle Cloud Always Free

1. Crie uma VM Always Free Linux com firewall restrito a SSH.
2. Instale Docker e Docker Compose plugin.
3. Clone o repositorio na VM.
4. Crie `.env` na VM com os valores reais.
5. Execute `docker compose up -d --build`.
6. Leia o QR Code nos logs do container na primeira conexao:

```bash
docker compose logs -f whatsapp-automation-bot
```

O `docker-compose.yml` usa volumes nomeados para `/app/data` e `/app/sessions`. Esses volumes preservam o SQLite e a sessao Baileys entre recriacoes do container.

Para atualizar:

```bash
git pull
docker compose up -d --build
docker compose logs -f whatsapp-automation-bot
```

Para rodar migracoes manualmente no container:

```bash
docker compose run --rm whatsapp-automation-bot npm run db:migrate
```

Para executar uma verificacao manual:

```bash
docker compose run --rm whatsapp-automation-bot npm run birthdays:check-today
```

Para listar grupos:

```bash
docker compose run --rm whatsapp-automation-bot npm run whatsapp:list-groups
```

Se expuser HTTP fora da VM, use firewall/reverse proxy restrito. Os endpoints operacionais nao devem ficar publicos sem controle de acesso.
