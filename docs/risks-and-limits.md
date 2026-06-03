# Riscos e limites

## WhatsApp pessoal

O servico usa Baileys via WhatsApp Web/Linked Devices. Essa integracao nao e uma API oficial de grupos do WhatsApp. O WhatsApp pode desconectar, alterar o comportamento do cliente web ou restringir automacoes em contas pessoais.

Mitigacoes:

- Uso pessoal e baixo volume.
- Um unico grupo configurado por `WHATSAPP_GROUP_ID`, sem envio em massa.
- Recuperacao no startup e na reconexao.
- Idempotencia por pessoa/grupo/ano para evitar duplicidades.
- Logs JSON simples para diagnostico.

## OpenAI paga

A geracao por IA depende de `OPENAI_API_KEY` e pode gerar custo. A chave nao deve ser tratada como gratuita nem versionada.

Mitigacoes:

- Timeout configuravel.
- Fallback local quando a API falha ou nao esta configurada.
- Prompt com minimizacao de dados e proibicao de inventar fatos.
- Logs sem payload bruto da requisicao e sem mensagem completa.

## Dados pessoais familiares

Nomes, datas de nascimento, relacoes, hobbies, observacoes, historico de mensagens e ids de grupo sao dados pessoais no contexto do projeto.

Mitigacoes:

- SQLite local.
- `.env`, banco, backups e sessao fora do Git.
- Logs com `subjectRef` e ids operacionais em vez de perfil completo.
- Backups manuais e controlados.

## Infraestrutura

Oracle Cloud Always Free e adequada para processo continuo, mas pode ter indisponibilidade de capacidade, manutencao manual e risco de erro operacional.

Mitigacoes:

- Docker Compose com volumes persistentes.
- Processo seguro para restart.
- Migracoes versionadas.
- Documentacao de backup e restauracao.

## Fora do escopo

- Painel web.
- API REST publica.
- Mensagens privadas.
- Campanhas ou envio em massa.
- Backup automatico.
- Dashboard Grafana.
- Aprovacao manual de mensagens antes do envio.
