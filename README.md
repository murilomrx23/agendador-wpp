# 🛍️ Ofertas Bot

Sistema para **coletar ofertas e cupons** (Shopee e Mercado Livre), **gerar
automaticamente o anúncio** no padrão do seu *Agente Divulgador de Produtos* e
**agendar o disparo** para os seus grupos de WhatsApp (envio manual).

Roda em **Cloudflare Workers** + **D1**.

## O que já está pronto (núcleo)

| Etapa | Status | Onde |
| --- | --- | --- |
| **Gerador de anúncios** — 3 variações fiéis ao agente (cálculo de desconto, regras de desconto baixo, cupom, links de resgate por plataforma, relâmpago, espaçamento) | ✅ | `src/generator/` |
| **Agendamento** — cria/agenda ofertas, lista, marca como enviada, cron de "prontas para disparo" | ✅ | `src/data/db.ts`, `src/index.ts` |
| **Interface web** — coletar → gerar → escolher variação → agendar + aba de cupons | ✅ | `public/` |
| **Fontes de afiliados** (Shopee/ML) — com tag de afiliado no link | 🔌 adaptadores prontos, precisam de credenciais | `src/sources/` |
| **Cupons especiais** — parser, armazenamento e auto-anexar por plataforma | ✅ | `src/coupons/`, `src/data/coupons.ts` |
| **Coletor do Telegram** — lê canais oficiais (MTProto) e envia cupons | ✅ serviço Node separado | `collector/` |
| **Disparo no WhatsApp** | ✋ manual (copiar/colar); interface `Dispatcher` pronta para automação futura | `src/whatsapp/` |

## Arquitetura

```
Afiliados Shopee/ML ─┐
                     ├─► Worker (Cloudflare) ──► gera 3 variações ──► agenda ──► você copia p/ WhatsApp
Canais Telegram  ────┘         │  D1: ofertas + cupons
 (coletor Node/MTProto) ──POST /api/coupons/ingest──►┘
```

O **coletor do Telegram** roda separado (pasta `collector/`, veja o README de
lá) porque ler canais oficiais de terceiros exige sessão de usuário (MTProto),
que não roda no Worker. Ele envia os cupons para `/api/coupons/ingest`, e o
cupom ativo mais recente de cada plataforma é **anexado automaticamente** às
ofertas daquela plataforma.

## Fluxo

1. **Coletar** a oferta — pela API de afiliados (quando configurada) ou digitando/colando os dados manualmente (inclusive de um print).
2. **Gerar** as 3 variações (Benefício / Urgência / Dor), seguindo todas as regras do agente.
3. **Escolher** a variação e os **grupos** de destino.
4. **Agendar** o horário. No horário, a oferta aparece como *pronta para disparo* — você copia e cola nos grupos (zero risco de banimento do número).

## Setup

```bash
npm install

# 1. Crie o banco D1 e copie o database_id para o wrangler.jsonc
npx wrangler d1 create ofertas-db

# 2. Aplique a migração (local e/ou remoto)
npx wrangler d1 migrations apply ofertas-db --local
npx wrangler d1 migrations apply ofertas-db --remote

# 3. Rode localmente
npm run dev
```

### Credenciais das fontes (opcional)

As fontes de afiliados só ficam ativas com os secrets configurados. Sem eles, a
coleta manual funciona normalmente.

```bash
npx wrangler secret put SHOPEE_APP_ID
npx wrangler secret put SHOPEE_APP_SECRET
npx wrangler secret put MELI_ACCESS_TOKEN

# Tag de afiliado aplicada aos links (opcional)
npx wrangler secret put SHOPEE_SUB_ID
npx wrangler secret put MELI_AFFILIATE_TAG

# Token que protege a ingestão de cupons do coletor do Telegram
npx wrangler secret put INGEST_TOKEN
```

### Coletor do Telegram (cupons especiais)

Os cupons vêm dos canais oficiais no Telegram, coletados por um serviço Node
separado. Veja **`collector/README.md`** para configurar (login MTProto,
canais e endpoint). Ele envia os cupons para `/api/coupons/ingest`.

## API

| Método | Rota | Descrição |
| --- | --- | --- |
| `POST` | `/api/generate` | Gera as 3 variações (sem salvar). Corpo: `Offer`. |
| `GET` | `/api/sources` | Lista as fontes e se estão configuradas. |
| `GET` | `/api/sources/:id/offers` | Coleta ofertas de uma fonte (`?keyword=&limit=`). |
| `POST` | `/api/offers` | Cria/agenda uma oferta. |
| `GET` | `/api/offers` | Lista (`?status=` ou `?due=1`). |
| `GET` | `/api/offers/:id` | Detalhe. |
| `PATCH` | `/api/offers/:id` | Atualiza status/agendamento/seleção/grupos (`markSent:true`). |
| `DELETE` | `/api/offers/:id` | Remove. |
| `POST` | `/api/coupons/ingest` | Ingestão de cupom (coletor). Protegido por `INGEST_TOKEN`. Corpo: `{ text, platform?, channel?, source? }`. |
| `GET` | `/api/coupons` | Lista cupons (`?platform=&active=1`). |
| `POST` | `/api/coupons` | Cadastra cupom manualmente (aceita `text` para parse). |
| `GET` | `/api/coupons/active?platform=` | Cupom ativo mais recente da plataforma. |
| `PATCH` | `/api/coupons/:id` | Ativa/desativa (`{ active }`). |
| `DELETE` | `/api/coupons/:id` | Remove. |

### Exemplo — gerar um anúncio

```bash
curl -X POST http://localhost:8787/api/generate -H 'content-type: application/json' -d '{
  "productName": "Organizador de Gavetas 6 Peças",
  "price": 49.90, "oldPrice": 89.90,
  "link": "https://s.shopee.com.br/abc",
  "offerType": "cupom", "category": "organizacao",
  "coupon": { "code": "CUPOM70" }, "freeShipping": true
}'
```

## Regras do agente implementadas

O gerador (`src/generator/`) codifica **deterministicamente** as regras do
arquivo do agente, então a formatação sai sempre exata:

- Cálculo de desconto (% e R$) e **regras de desconto baixo** (esconde valor
  antigo se a diferença for `< R$ 10,00`; esconde a linha de % se for `< 10%`).
- Blocos de preço por tipo: **Padrão / Promoção comum / Relâmpago / Cupom**.
- **Cupom**: prioriza código digitável; senão usa valor/%, convertido para
  `"X OFF DESCRIÇÃO"` (porcentagem tem prioridade sobre valor).
- **Links de resgate**: Shopee digitável → `s.shopee.com.br/6ffB5DxyKM`; Shopee
  não digitável → `s.shopee.com.br/4VZ4QKlIen`; **Meli nunca** tem resgate.
- Relâmpago com prefixo obrigatório e validade `até as 23h59`; cupom com a
  frase de urgência correta.
- Espaçamento: 1 linha em branco entre blocos, nenhuma dentro do bloco.
- Link de compra sempre antes do link de resgate.
- 3 variações com ângulos persuasivos distintos e headlines que não se repetem.

Cobertura testada em `src/generator/generate.test.ts` (`npm test`).

## Próximos passos (adaptadores)

- **Fontes**: preencher as queries de afiliado conforme sua conta (`src/sources/shopee.ts`, `meli.ts`).
- **Telegram / Instagram** como fontes adicionais: implementar a interface `OfferSourceAdapter`.
- **Disparo automático no WhatsApp**: implementar `Dispatcher` (ex.: Baileys/whatsapp-web.js num servidor Node, ou WhatsApp Cloud API) e chamá-lo no handler `scheduled`.

## Licença

MIT
