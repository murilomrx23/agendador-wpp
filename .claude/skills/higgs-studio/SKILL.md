---
name: higgs-studio
description: >-
  Gera artes de marca em massa no Higgsfield (motor GPT Image 2) seguindo os
  padrões do Higgs Studio deste repositório: seleciona um EXPERT (Wendell /
  Karina / Ambos / Livre) + um PRODUTO (PROTAGON / ISD) + uma lista de COPIES, e
  produz cada arte em 1:1 e depois reframe para 9:16 (Stories) e 4:5 (Feed), com
  fidelidade de rosto dos experts e identidade visual do produto. Use sempre que
  o usuário pedir para gerar arte / criativo / post / campanha (ex.: Dia dos
  Pais) para PROTAGON ou ISD, disser "Higgs Studio", "gerar artes", "gera no
  Higgs", colar um comando "HIGGS STUDIO — GERAR ARTES", ou preencher uma ficha
  de briefing em higgs-studio/briefings/.
---

# Higgs Studio — geração de artes no Higgsfield (via MCP)

Executa geração em massa de artes de marca usando as ferramentas MCP do
Higgsfield já conectadas nesta sessão. **Não** precisa de deploy, API key ou
Worker — roda direto pelo assistente.

## Fonte única de dados
Antes de gerar, **leia `higgs-studio/config.json`** (na raiz do repo). Ele contém:
- `engine` — motor padrão: `gpt_image_2`, `quality: medium`, `resolution: 2k`,
  formatos `1:1` (base) → `9:16`, `4:5` (derivados).
- `experts[EXPERT].refs[]` — cada um com `media_id` (Higgsfield) e `url` (pública
  lh3 do Drive) + `desc` (descrição de fidelidade).
- `products[PRODUTO]` — `logo.media_id/url`, `colors[]`, `tone`, `style`, `avoid`.

Perfis e identidades detalhados também em `higgs-studio/experts/*/perfil.md` e
`higgs-studio/produtos/*/identidade.md`. Se algo divergir, o `config.json` manda.

## Entrada (briefing)
Aceite o briefing em qualquer forma (texto do dashboard, ficha em
`higgs-studio/briefings/`, ou pedido direto). Extraia:
- **Expert**: `WENDELL` | `KARINA` | `WENDELL E KARINA` | `LIVRE` (default `LIVRE`).
- **Produto**: `PROTAGON` | `ISD` (obrigatório).
- **Copies**: uma por bloco (linha em branco separa). Cada copy = uma arte.
- **Formatos** (default `1:1`, `9:16`, `4:5`).
Se faltar produto ou copies, pergunte antes de gerar. Nunca gere sem o usuário
ter fornecido as copies.

## Procedimento (por copy)
Carregue as ferramentas via ToolSearch: `mcp__Higgsfield__generate_image`,
`generate_image_batch`, `jobs_wait`, `outpaint_image`, `show_generation_by_ids`.

1. **Prompt 1:1** — monte um prompt de art-direction rico, em inglês, mas com o
   TEXTO da copy em **português do Brasil com TODOS os acentos corretos**.
   Inclua: `product.style` + paleta (`product.colors`) + `tone`; se o expert tiver
   `refs`, descreva a pessoa (`expert.desc`) e peça preservar traços/rosto; a
   tipografia com o texto EXATO (título / corpo / assinatura) em caixa alta
   geométrica; aplicar o logo pequeno no rodapé; "sem texto extra, sem marca
   d'água, ortografia perfeita". Respeite `product.avoid`.
2. **Referências** — em `medias`, anexe (role `image`):
   - as `media_id` das fotos do expert (se não for LIVRE),
   - a `media_id` do logo do produto.
   Se um `media_id` falhar/expirar, re-importe com
   `mcp__Higgsfield__media_import_url` usando a `url` do config e use o novo id.
3. **Gerar 1:1** — `generate_image` com `model: gpt_image_2`, `aspect_ratio: 1:1`,
   `quality: medium`, `resolution: 2k`. Para várias copies, use
   `generate_image_batch` + `jobs_wait`.
4. **Reframe** — `outpaint_image` do job 1:1 para `9:16` e `4:5`. Silhuetas às
   vezes disparam falso-positivo `nsfw`: se acontecer, **refaça o outpaint** (1 a
   2 tentativas) — costuma passar.
5. **Mostrar & registrar** — `show_generation_by_ids` com todos os jobs. Registre
   os links e job ids em `higgs-studio/saidas/AAAA-MM-campanha.md` (crie/atualize).

## Regras de composição (OBRIGATÓRIAS)
- **Contraste roupa × fundo (sempre):** a roupa do expert deve CONTRASTAR com o
  fundo. Fundo escuro/preto → roupas **claras** (branco, bege, cinza claro). Fundo
  claro → roupas **escuras**. O expert nunca "some" no fundo.
- **Traje:** sempre elegante e sofisticado — **camisas e blazers** (nada casual).
- **Texto das copies ≠ material:** NUNCA aplique efeito metálico/cromado/3D/escovado
  no texto das copies. Esses efeitos são de logo, não de texto corrido.

## Regras por produto
- **ISD (Imersão Sprint Digital):**
  - O **efeito 3D escovado (brushed metal)** pertence **somente ao LOGO** — nunca
    às copies.
  - **Copies sempre BRANCAS**; palavras/frases-chave em **LARANJA `#FD7400`** para
    destaque em fundos **escuros/preto**. Em fundos **claros**, texto **PRETO** com
    destaque **laranja**.
  - Paleta: preto, laranja `#FD7400`, prata, branco. Nunca azul/dourado.
- **PROTAGON:** azul-marinho + dourado; leão oficial; tipografia forte em caixa alta.

## Regras de qualidade
- **Ortografia perfeita em PT-BR** (VOCÊ, HERÓI, memórias, Presença, É). Confira o
  texto exato de cada copy antes de gerar.
- **Paleta estrita** do produto; nunca misture identidades (azul/dourado = PROTAGON;
  preto/laranja/prata = ISD).
- **Fidelidade de rosto**: não altere traços, idade, cabelo/barba ou tom de pele.
- **Motor padrão**: `gpt_image_2` · `medium` · `2K` (~3 créditos/img). Só mude se o
  usuário pedir.
- O host de saída do Higgsfield costuma ser bloqueado para download aqui — **não**
  tente baixar os pixels; exiba via `show_generation_by_ids` para o usuário validar.

## Custos & confirmação
Antes de uma rodada grande, informe a estimativa (nº de copies × formatos × ~3
créditos) e confirme o saldo com `mcp__Higgsfield__balance` se necessário. Para a
1ª arte de um estilo novo, gere só a 1:1 e peça validação antes de escalar.

## Exemplos de gatilho
- "Higgs Studio: expert Karina, produto PROTAGON, gera essas 3 copies…"
- Colar o bloco "🎨 HIGGS STUDIO — GERAR ARTES …" do dashboard.
- "Gera os posts de Dia dos Pais do PROTAGON com o Wendell."
