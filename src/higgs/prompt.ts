/**
 * Higgs Studio — construtor de prompt de arte (rota "gabarito da marca").
 *
 * Transforma (produto + expert + copy) em um prompt de art-direction rico,
 * seguindo as regras de identidade do config.json. É a versão determinística
 * (sem chamar um LLM). Para prompts sob medida por copy, ligar a rota via
 * API do Claude (ver README) — este módulo continua sendo o fallback.
 */

export interface ProductCfg {
  label: string;
  colors: string[];
  tone: string;
  style: string;
  avoid: string;
  logo?: { url?: string; media_id?: string };
}

export interface ExpertCfg {
  label: string;
  desc?: string;
  refs: { url?: string; media_id?: string }[];
}

/** Divide uma copy (texto colado) em título / corpo / assinatura. */
export function splitCopy(copy: string): { headline: string; body: string; signoff: string } {
  const lines = copy
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const headline = lines[0] || "";
  const last = lines.length > 1 ? lines[lines.length - 1] : "";
  const body = lines.slice(1, lines.length > 1 ? -1 : undefined).join(" ");
  return { headline, body, signoff: last };
}

/** Monta o prompt de imagem 1:1 para uma copy. */
export function buildImagePrompt(product: ProductCfg, expert: ExpertCfg, copy: string): string {
  const { headline, body, signoff } = splitCopy(copy);
  const palette = product.colors.join(", ");

  const person =
    expert.refs.length > 0 && expert.desc
      ? `Inclua a(s) pessoa(s) de referência (${expert.label}: ${expert.desc}), preservando fielmente traços faciais, cabelo, barba e tom de pele das imagens de referência. Iluminação cinematográfica e integração natural na composição.`
      : `Sem rosto fixo: composição livre (silhuetas retroiluminadas, elementos gráficos ou objetos), coerente com a copy e a identidade da marca.`;

  return [
    `Peça de social media premium e sofisticada para a marca "${product.label}". Formato quadrado 1:1, alto contraste, muito espaço negativo, acabamento profissional.`,
    ``,
    `IDENTIDADE VISUAL (obrigatória): ${product.style}. Paleta estrita: ${palette}. Tom: ${product.tone}. Evitar: ${product.avoid}.`,
    ``,
    person,
    ``,
    `TIPOGRAFIA — renderize EXATAMENTE este texto em português do Brasil, com TODOS os acentos corretos, em sans-serif geométrica pesada em caixa alta:`,
    `- Título (destaque): "${headline}"`,
    body ? `- Corpo (menor, peso regular): "${body}"` : ``,
    signoff ? `- Assinatura (destaque, cor de realce da marca): "${signoff}"` : ``,
    ``,
    product.logo ? `Aplique o logotipo oficial da marca de forma limpa e pequena (rodapé).` : ``,
    `Sem texto extra, sem marca d'água, sem letras distorcidas, ortografia perfeita.`,
  ]
    .filter((l) => l !== ``)
    .join("\n");
}
