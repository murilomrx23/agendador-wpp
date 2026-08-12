# 🎨 Higgs Studio — Sistema de Geração de Artes em Massa

Sistema operado via **Higgsfield (motor ChatGPT / GPT Image 2)** para gerar artes
em série, com **fidelidade de rosto dos experts** e **identidade visual por produto**.

> **Como funciona na prática:** o acesso ao Higgsfield roda através do assistente
> (Claude, via MCP). Este repositório é o **arquivo permanente** (a "base de dados")
> do sistema: fotos dos experts, identidade dos produtos e as fichas de briefing.
> Você seleciona a aba + produto + copies numa ficha de briefing, e o assistente
> executa a geração em massa 1‑por‑1.

---

## 🗂️ Estrutura do sistema

```
higgs-studio/
├── experts/            → ABAS DE EXPERT (fotos de referência arquivadas)
│   ├── wendell/
│   ├── karina/
│   ├── wendell-karina/
│   └── livre/
├── produtos/           → ABA PRODUTO (identidade visual: paleta, fonte, refs, logo)
│   └── _MODELO-PRODUTO/
├── briefings/          → FICHAS DE BRIEFING (seleção + copies para gerar em massa)
│   └── _MODELO-BRIEFING.md
└── saidas/             → Links/registro das artes geradas
```

---

## 🧑‍🎤 ABAS DE EXPERT

Ao selecionar uma aba, o assistente anexa **automaticamente** as fotos arquivadas
daquele expert como **imagem de referência** na geração do Higgsfield, preservando
ao máximo a aparência e a fidelidade da pessoa.

| # | Aba | Fotos de referência |
|---|-----|---------------------|
| 1 | **WENDELL** | `experts/wendell/fotos/` (3 a 5 fotos) |
| 2 | **KARINA** | `experts/karina/fotos/` (3 a 5 fotos) |
| 3 | **WENDELL E KARINA** | usa as fotos de ambos |
| 4 | **LIVRE** | sem pessoa fixa — geração livre / genérica |

---

## 🎯 ABA PRODUTO (Identidade Visual)

Cada produto define a **ID visual** que a arte deve seguir. Assets por produto:

| Asset | Pasta | Obrigatório? |
|-------|-------|--------------|
| 🎨 Paleta de cores | `paleta/` | ✅ (1 imagem) |
| 🔤 Fonte / família tipográfica | `tipografia/` | ✅ (1 imagem) |
| 🖼️ Referências de diagramação/composição | `referencias/` | ✅ (2 a 5 imagens) |
| 🏷️ Logo do produto | `logo/` | ⬜ Opcional |

Cada produto tem um `identidade.md` descrevendo tom, estilo e regras da marca.

---

## ✍️ FICHA DE BRIEFING (Geração em Massa)

Copie `briefings/_MODELO-BRIEFING.md`, preencha e envie ao assistente. Nela você:

1. Escolhe a **aba de expert** (Wendell / Karina / Ambos / Livre)
2. Escolhe o **produto** (identidade visual)
3. Cola a **lista de copies** (uma por arte)

### 🔁 Fluxo de geração por copy (automático)

Para **cada copy** da lista, o sistema executa:

1. **Gera a versão 1:1** (Feed) no motor ChatGPT (GPT Image 2), anexando:
   - fotos do expert selecionado (referência de rosto)
   - assets de identidade do produto (paleta, fonte, referências, logo)
   - a copy correspondente
2. **Reframe/outpaint** dessa mesma arte para **9:16 (Stories)**
3. Registra os links em `saidas/`

> ⚠️ A **primeira versão gerada é sempre 1:1**; os demais formatos derivam dela
> por reframe, preservando a mesma composição.

---

## ✅ Status de setup

- [ ] Fotos do **Wendell** arquivadas
- [ ] Fotos da **Karina** arquivadas
- [ ] Produto(s) cadastrado(s) com identidade visual
- [ ] Primeira ficha de briefing preenchida

_Envie os assets ao assistente e ele salva/organiza aqui automaticamente._
