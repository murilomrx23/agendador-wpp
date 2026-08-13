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
   **Antes de escrever o prompt, sorteie uma combinação distinta de POSE +
   ENQUADRAMENTO + ROUPA + LADO do banco de variação abaixo** — cada lâmina da
   mesma campanha usa uma combinação diferente das anteriores (ver "Variação").
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
- **Hierarquia tipográfica (caixa alta só na headline):** SOMENTE a **headline
  principal** vai em CAIXA ALTA (e grande/pesada). Todos os demais textos — apoio,
  subtítulo, descrição, rodapé/CTA, selos — vão em **caixa baixa** (sentence case:
  só a 1ª letra e nomes próprios maiúsculos). Nada de arte "gritando" com tudo em
  maiúsculas. Exceção: siglas/valores mantêm sua forma (ISD, R$ 100 mil, 50% OFF).
  As palavras-chave em destaque (laranja) seguem a caixa do texto onde estão.

## Variação de pose, enquadramento e roupa (OBRIGATÓRIA)
Numa mesma campanha, o expert **não pode aparecer igual em duas lâminas**. Se todas
ficam com a mesma pose/roupa/lado, a série fica monótona. Para **cada** lâmina,
componha uma combinação **inédita** (que ainda não saiu nesta campanha) sorteando
1 item de cada banco abaixo e descrevendo-a explicitamente no prompt:

- **POSE / linguagem corporal:** braços cruzados confiante · uma mão no queixo
  (pensativo) · apontando para o texto/CTA · palma aberta apresentando o produto ·
  mãos no bolso do blazer · ajustando o punho da camisa · gesticulando no meio de
  uma fala · segurando o celular mostrando notificação de venda · rindo natural ·
  olhar sério direto na câmera · caminhando em direção à câmera · sentado em
  banqueta alta, inclinado à frente.
- **ENQUADRAMENTO / ângulo:** close-up de rosto · busto (peito p/ cima) · meio-corpo
  (cintura) · corpo inteiro · 3/4 de perfil · leve contra-plongée (câmera baixa,
  imponente) · perfil lateral olhando para o texto.
- **ROUPA (mantendo contraste e elegância):** varie **peça, cor clara e textura**
  a cada lâmina — blazer bege + camisa branca · blazer off-white + gola alta clara ·
  camisa social branca sem blazer, mangas dobradas · blazer cinza-claro + camiseta
  branca premium · terno claro completo + sem gravata · colete de alfaiataria claro
  sobre camisa · blazer creme estruturado. (Fundo escuro ⇒ sempre tons claros; nunca
  repita o mesmo conjunto na campanha.)
- **LADO / posição na arte:** à esquerda · à direita · centralizado ao fundo ·
  recortado saindo da borda inferior · em plano detalhe no canto.

Regras do sorteio: (a) **nunca** repita a mesma POSE nem a mesma ROUPA de uma lâmina
já feita na campanha; (b) alterne o LADO para não deixar a composição sempre igual;
(c) tudo isso **sem quebrar** contraste, elegância (camisas/blazers) e fidelidade de
rosto. Ao montar um lote, distribua as combinações para que fiquem visivelmente
diferentes entre si. Registre em `saidas/` qual combinação foi usada em cada lâmina.

## Regras por produto
> **Dossiês de estilo (LEIA antes de gerar):** `referencias/estilo-isd.md` e
> `referencias/estilo-protagon.md` — guias completos de identidade (essência,
> paleta, fotografia, iluminação, tipografia, hierarquia, elementos, variantes
> DARK/LIGHT, o que evitar). Os pontos abaixo são o resumo operacional; em caso de
> dúvida, o dossiê do produto manda.

**Comuns aos dois produtos (dos dossiês):**
- **Personagem grande e dominante** (~40–60% da peça), saindo parcialmente das
  bordas, gestos amplos, clima de "especialista em ação no palco" — não foto
  corporativa genérica. Estrutura: personagem de um lado, zona de texto do outro
  (ZONA HUMANA + ZONA INFORMATIVA).
- **Iluminação cinematográfica de evento**: alto contraste, rim light, fundo
  escuro, separação clara personagem×fundo.
- **Hierarquia de conversão**: gancho → promessa/dor → prova/benefício →
  evento/data/local → CTA. A identidade deve ser reconhecida antes da leitura.
- **Destaque de cor = SIGNIFICADO, não decoração** (dourado no PROTAGON, laranja no
  ISD): marca só as palavras de maior valor (dinheiro, resultado, condição, 100K…).
- **CTA em verde é funcional** e permitido nos dois: verde = SOMENTE ação (botão do
  CTA), nunca cor estrutural/decorativa/fundo. (Compatível com a faixa laranja de
  CTA do ISD — o verde é opção de botão de ação de alto contraste.)
- Cada produto tem variante **DARK** (principal, conversão/oferta/urgência) e
  **LIGHT** (público frio/lifestyle/transformação) — escolha pela intenção da copy.

- **ISD (Imersão Sprint Digital):**
  - O **efeito 3D escovado (brushed metal)** pertence **somente ao LOGO** — nunca
    às copies.
  - **Copies sempre BRANCAS**; palavras/frases-chave em **LARANJA `#FD7400`** para
    destaque em fundos **escuros/preto**. Em fundos **claros**, texto **PRETO** com
    destaque **laranja**.
  - Paleta: preto, laranja `#FD7400`, prata, branco. Nunca azul/dourado.
  - **Dispositivos visuais da marca (das refs oficiais):** use quando fizer sentido
    para a copy —
    - **Cards flutuantes de notificação de venda** ao redor do expert: pequenos
      balões escuros com "Venda realizada · Sua comissão R$ 497,00" + "Agora / há 7
      min" (dão prova social e energia);
    - **Faixa de data e local** do evento em destaque (ex.: "02 e 03 de outubro em
      Recife-PE") — sempre confira data/cidade da copy vigente;
    - **Linha de condição especial** ("condição especial exclusiva para quem já
      visitou a página da ISD") e CTA no padrão "Toque em SAIBA MAIS…";
    - Clima de **evento/palco, energia e velocidade** (traços de pista laranja).
  - **Refs visuais oficiais** ficam no Drive (pasta "2 - ISD":
    `18c1SJqYpbuGd3NMkhlO4TVbfRpjgYzPP`) — `REF 1..7.png`, `ISD PALETA DE CORES.png`,
    `LOGO ISD 1.png`. Quando possível, **anexe as refs como imagens de estilo** em
    `medias` (role `image`) na geração, para herdar layout/clima — não só descrever.
- **ISD — variantes:** **DARK** (preto 50–80% da peça, laranja intenso, glow quente,
  fotografia cinematográfica) é a principal; **LIGHT** (fundo branco, headline preta,
  laranja em grandes destaques, lifestyle) para público frio/expansão. Movimento =
  velocidade de EXECUÇÃO (linhas de velocidade, diagonais, arcos) — sem virar
  comunicação automobilística. Boxes/faixas laranja, notificações de venda,
  smartphones/interfaces e objetos 3D com significado (escudo+check = garantia).
- **PROTAGON:**
  - Publicidade premium de evento presencial de prosperidade/transformação
    financeira. **AUTORIDADE + PROSPERIDADE + CLAREZA + IMPACTO + CONVERSÃO.**
  - Paleta: azuis `#050B2E` `#00063D` `#031749` (fundos) + `#002A90` (energia/rim
    light); dourado `#EBC042`→`#FFE28E` (prosperidade/valor); branco `#FFFFFF`;
    preto `#000000`. Gradiente azul `#050B2E`→`#031749`. **Dourado = marca-texto
    semântico**, nunca colorir todo o texto; nunca dourado genérico/amarelo.
  - Cenários: palco/evento (luzes azuis, bokeh, telões) · ambiente profissional ·
    lifestyle aspiracional. Iluminação de palco, rim light azul, alto contraste.
  - Variantes **DARK** (azul-marinho/preto, dramático, oferta/urgência) e **LIGHT**
    (branco predominante + azul + dourado, família/futuro) — sempre tipografia
    pesada, personagem grande, contraste azul/dourado, branding forte, CTA claro.
  - Bloco de branding + `CIDADE - UF`; data com ícone de calendário dourado/box.
  - **Nunca** transformar ISD em "Protagon laranja" nem PROTAGON em algo pastel/
    minimalista: são DNAs de comunicação diferentes (ver dossiês).

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
