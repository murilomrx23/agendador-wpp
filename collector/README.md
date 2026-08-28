# Ofertas Collector (Telegram)

Serviço Node separado que **lê os canais oficiais da Shopee/Mercado Livre no
Telegram** e envia os **cupons especiais** para a API do Ofertas Bot.

Por que separado do Worker? Ler canais públicos de terceiros exige uma **sessão
de usuário do Telegram (MTProto)** — um bot comum não consegue. Isso não roda
dentro de um Cloudflare Worker, então fica aqui, num processo Node que você
sobe onde quiser (uma VM, um container, sua máquina, Railway/Render/Fly, etc.).

```
Telegram (canais oficiais)  ──►  collector (GramJS)  ──►  POST /api/coupons/ingest  ──►  Worker + D1
```

## Setup

```bash
cd collector
npm install
cp .env.example .env
# Preencha TELEGRAM_API_ID / TELEGRAM_API_HASH (https://my.telegram.org)

# 1. Gere a sessão (login com o SEU número)
npm run login
# copie o TELEGRAM_SESSION=... para o .env

# 2. Configure os canais e o endpoint do Worker no .env
#    TELEGRAM_CHANNELS=shopee_brasil, ofertasmercadolivre
#    INGEST_URL=https://ofertas-bot.SEU.workers.dev/api/coupons/ingest
#    INGEST_TOKEN=...  (o mesmo secret configurado no Worker)

# 3. Rode
npm start
```

O coletor faz um *backfill* leve (últimas mensagens) ao iniciar e depois
escuta em tempo real. Só encaminha mensagens que **parecem cupom**; o parse e a
deduplicação ficam centralizados no Worker (`/api/coupons/ingest`).

## Segurança

- Nunca versione o `.env` nem a `TELEGRAM_SESSION` (equivale à sua conta).
- Defina `INGEST_TOKEN` no Worker (`wrangler secret put INGEST_TOKEN`) e o mesmo
  valor aqui, para que só o coletor consiga inserir cupons.
