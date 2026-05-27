# Operacao local e deploy

## Operacao local

1. Instale dependencias com `npm install`.
2. Crie `.env` a partir de `.env.example`.
3. Execute `npm run db:migrate`.
4. Execute `npm run list:groups` e leia o QR Code no WhatsApp em dispositivos vinculados.
5. Copie o id do grupo familiar para `WHATSAPP_GROUP_ID`.
6. Execute `npm run check:today` para validar o fluxo sem esperar o agendamento.
7. Execute `npm run dev` para manter o bot em processo continuo.

O bot registra eventos em JSON estruturado. Logs de `info` confirmam checks, aniversariantes encontrados, envios e reconexoes. Logs de `warn` indicam duplicidades evitadas, fallback de mensagem e estados recuperaveis. Logs de `error` indicam falhas de provedor, banco ou fluxo operacional.

## Metricas

As metricas ficam desabilitadas por padrao. Para habilitar:

```env
METRICS_ENABLED=true
METRICS_HOST=127.0.0.1
METRICS_PORT=9464
```

Quando habilitado, o endpoint local e `http://127.0.0.1:9464/metrics`.

Metricas disponiveis:

- `birthday_checks_total{status}`
- `birthday_birthdays_found_total`
- `birthday_delivery_attempts_total{status}`
- `birthday_duplicate_skips_total`
- `birthday_message_generation_failures_total`
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
docker compose run --rm birthday-whatsapp-bot npm run check:today
```

Para listar grupos:

```bash
docker compose run --rm birthday-whatsapp-bot npm run list:groups
```

Se expuser metricas fora da VM, use firewall/reverse proxy restrito. O endpoint nao deve ficar publico sem controle de acesso.
