# 🚀 Deploy — Higgs Studio no Cloudflare Worker (GERAR AGORA real)

Este repositório é um **Cloudflare Worker**. O Higgs Studio adiciona um backend que
chama a **API do Higgsfield** e um dashboard servido pelo próprio Worker em
**`/studio`** — com o botão **GERAR AGORA** que gera de verdade (sem chat).

```
Dashboard (/studio)  →  Worker /api/higgs/*  →  API do Higgsfield
        (mesmo domínio, sem CORS)        (usa os SECRETS)
```

## 1) Segredos (a chave NUNCA vai para o git)

A chave tem duas partes ("ID da chave" e "Segredo da chave"). Defina como
**secrets** do Worker:

```bash
npx wrangler secret put HIGGSFIELD_API_KEY      # cole o ID da chave da API
npx wrangler secret put HIGGSFIELD_API_SECRET   # cole o Segredo da chave
```

Para rodar local, crie `.dev.vars` (já ignorado pelo git) a partir de
`.dev.vars.example`.

## 2) Deploy

```bash
npm install
npm run deploy      # wrangler deploy
```

Abra `https://SEU-WORKER.workers.dev/studio`.

## 3) Validar a API (IMPORTANTE — confirmar o schema)

O cliente (`src/higgs/higgsfield.ts`) foi escrito a partir do padrão público do
Higgsfield (auth `hf-api-key` + `hf-secret`; fluxo job-set → poll). **Confirme os
endpoints/campos exatos na doc oficial** (docs.higgsfield.ai) — o ambiente de dev
não tem acesso de rede ao Higgsfield, então isso não pôde ser testado na origem.

Teste rápido (ajuste caminho/campos conforme a doc):

```bash
curl -sS -X POST https://platform.higgsfield.ai/v1/text2image/soul \
  -H "hf-api-key: $HIGGSFIELD_API_KEY" -H "hf-secret: $HIGGSFIELD_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"params":{"prompt":"teste","aspect_ratio":"1:1","quality":"medium","resolution":"2k"}}'
```

- Se responder com um **id de job**, o fluxo está certo — só conferir os nomes de
  campo do resultado no `getJob()`.
- Se der 404/campo inválido, ajuste as env vars de caminho (`HIGGSFIELD_PATH_IMAGE`,
  `HIGGSFIELD_PATH_JOBSET`) ou os nomes em `higgsfield.ts` conforme a doc.
  **Cole o retorno real aqui no chat que eu finalizo o cliente.**

## 4) Sobre o motor

- Padrão do config: `gpt_image_2`. Se a **API REST** não expuser esse modelo (ele
  pode ser exclusivo do MCP/app), use `soul` (forte em fidelidade de rosto) — é só
  mudar `engine.model` em `higgs-studio/config.json` ou enviar `model` no request.

## 5) Fonte única de dados

`higgs-studio/config.json` alimenta **o dashboard e o backend** (experts + produtos +
motor). Mudou uma foto/paleta ali → os dois refletem. Sem duplicação.

## Rotas expostas
| Rota | Método | O que faz |
|------|--------|-----------|
| `/studio` | GET | Dashboard (servido pelo Worker) |
| `/api/higgs/config` | GET | Config pública (sem segredos) |
| `/api/higgs/generate` | POST | Cria os jobs `{expert,product,formats,copies}` |
| `/api/higgs/status?ids=` | GET | Status + URL dos jobs |

> ⚠️ Sem os secrets, `/api/higgs/generate` responde **503** com instrução — nada
> quebra, só não gera.
