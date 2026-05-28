# Backup e sessao Baileys

## Backup manual do SQLite

O backup e manual e intencional. Evite sincronizacao automatica para servicos de terceiros sem avaliar privacidade dos dados familiares.

Com Docker Compose:

```bash
docker compose stop whatsapp-automation-bot
docker run --rm -v my_bot_wpp_whatsapp-automation-data:/data -v "$PWD/backups:/backup" alpine sh -c "cp /data/whatsapp-automation.sqlite /backup/whatsapp-automation-$(date +%Y%m%d-%H%M%S).sqlite"
docker compose up -d
```

Sem Docker, pare o processo e copie o arquivo configurado em `DATABASE_PATH`.

Cuidados:

- Guarde backups em local com acesso restrito.
- Nao commite backups no Git.
- Evite mandar backups por canais sem criptografia.
- Teste restauracao em ambiente separado antes de depender do backup.

## Restauracao

1. Pare o bot.
2. Substitua o arquivo SQLite atual pelo backup escolhido.
3. Confira permissoes do arquivo.
4. Suba o servico e execute `npm run birthdays:check-today` ou observe os logs de startup.

## Sessao Baileys

A pasta `WHATSAPP_AUTH_DIR` contem credenciais de dispositivo vinculado. Trate como segredo.

Cuidados:

- Nao copie a sessao para maquinas nao confiaveis.
- Nao versione `sessions/`, QR Code, tokens ou credenciais.
- Em caso de suspeita de vazamento, remova o dispositivo vinculado no WhatsApp e apague a pasta da sessao.
- Se o cliente ficar `logged_out`, apague a sessao persistida e rode `npm run whatsapp:list-groups` ou suba o servico para parear novamente.

Em Docker Compose, a sessao fica no volume `whatsapp-automation-sessions`.
