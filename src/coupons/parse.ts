/**
 * Parser de cupons especiais vindos de texto (Telegram/Instagram/manual).
 *
 * Extrai de uma mensagem: plataforma, código digitável, valor/percentual,
 * descrição, e se é cupom relâmpago (com horário de validade). Segue a mesma
 * prioridade do agente: porcentagem tem prioridade sobre valor monetário.
 */
import type { Platform } from "../generator/types";

export interface ParsedCoupon {
	platform?: Platform;
	/** Código digitável (ex.: "CUPOM70"). */
	code?: string;
	/** Valor/percentual do desconto (ex.: "5%" ou "70"). */
	offValue?: string;
	/** Descrição (ex.: "TODAS AS LOJAS", "LOJAS OFICIAIS"). */
	description?: string;
	/** Cupom relâmpago? */
	isFlash: boolean;
	/** Horário de validade quando informado (ex.: "18h"). */
	validUntil?: string;
	/** Texto original. */
	raw: string;
}

// Palavras que NÃO são código de cupom (evita falsos positivos).
const CODE_STOPWORDS = new Set([
	"CUPOM", "CUPONS", "OFF", "TODAS", "LOJAS", "LOJA", "OFICIAIS", "OFICIAL",
	"SHOPEE", "MERCADO", "LIVRE", "MELI", "DESCONTO", "FRETE", "GRATIS", "GRÁTIS",
	"PIX", "CODIGO", "CÓDIGO", "VALIDO", "VÁLIDO", "ATE", "ATÉ", "HOJE", "RELAMPAGO",
	"RELÂMPAGO", "USE", "APLIQUE", "COPIE", "COLE", "ACIMA", "COMPRAS", "PRODUTOS",
	"NOVOS", "SELECIONADAS", "PARTICIPANTES",
]);

/** Detecta a plataforma pelo texto. */
export function detectPlatformFromText(text: string): Platform | undefined {
	const t = text.toLowerCase();
	if (t.includes("shopee")) return "shopee";
	if (t.includes("mercado livre") || t.includes("mercadolivre") || t.includes("meli") || /\bml\b/.test(t)) {
		return "meli";
	}
	return undefined;
}

/** Extrai um código digitável, priorizando padrões rotulados. */
function extractCode(text: string): string | undefined {
	// 1) Rótulos explícitos: "cupom: X", "código: X", "use o cupom X".
	const labeled = text.match(/(?:cupom|c[óo]digo|use o cupom|use)\s*[:\-]?\s*([A-Z0-9][A-Z0-9._-]{3,24})/i);
	if (labeled) {
		const cand = labeled[1].toUpperCase().replace(/[.\-_]+$/, "");
		if (!CODE_STOPWORDS.has(cand)) return cand;
	}
	// 2) Token em MAIÚSCULO logo após dois-pontos (ex.: "Livre: MELIDESC").
	const afterColon = text.match(/:\s*([A-Z][A-Z0-9._-]{3,24})\b/);
	if (afterColon) {
		const cand = afterColon[1].toUpperCase().replace(/[.\-_]+$/, "");
		if (!CODE_STOPWORDS.has(cand)) return cand;
	}
	// 3) Token em MAIÚSCULO com pelo menos um dígito (típico de cupom).
	const tokens = text.match(/\b[A-Z][A-Z0-9]{3,24}\b/g) || [];
	for (const tk of tokens) {
		const up = tk.toUpperCase();
		if (CODE_STOPWORDS.has(up)) continue;
		if (/\d/.test(up)) return up;
	}
	return undefined;
}

/** Extrai valor/percentual. Porcentagem tem prioridade sobre valor monetário. */
function extractOffValue(text: string): string | undefined {
	const pct = text.match(/(\d{1,3})\s*%/);
	if (pct) return `${pct[1]}%`;
	const money = text.match(/-?\s*R\$\s*(\d{1,4})(?:[.,]\d{2})?/i);
	if (money) return money[1];
	// Valor sem "R$" antes de "OFF" (ex.: "15 OFF TODAS AS LOJAS").
	const bare = text.match(/(\d{1,4})\s*OFF\b/i);
	if (bare) return bare[1];
	return undefined;
}

/** Extrai a descrição do cupom (após "OFF"), padrão "TODAS AS LOJAS". */
function extractDescription(text: string): string | undefined {
	const t = text.toUpperCase();
	if (t.includes("TODAS AS LOJAS")) return "TODAS AS LOJAS";
	if (t.includes("LOJAS OFICIAIS")) return "LOJAS OFICIAIS";
	// "X% OFF <DESCRIÇÃO>" — captura o que vem depois de OFF na mesma linha.
	const m = text.match(/OFF\s+([A-Za-zÀ-ÿ ]{3,40})/i);
	if (m) {
		const desc = m[1].trim().toUpperCase().replace(/\s+/g, " ");
		// Corta em quebra natural (preposições/fim de frase).
		return desc.split(/\s+(?:NO|NA|COM|PARA|ATÉ|ATE)\b/)[0].trim();
	}
	return undefined;
}

/** Detecta cupom relâmpago e horário de validade. */
function extractFlash(text: string): { isFlash: boolean; validUntil?: string } {
	const t = text.toLowerCase();
	const isFlash = /rel[âa]mpago/.test(t);
	const hour = t.match(/at[ée]\s*(?:as\s*)?(\d{1,2})\s*h(?:(\d{2}))?/);
	const validUntil = hour ? `${hour[1]}h${hour[2] ?? ""}` : undefined;
	return { isFlash: isFlash || !!validUntil, validUntil };
}

/** Faz o parse completo de uma mensagem de cupom. */
export function parseCoupon(text: string): ParsedCoupon {
	const raw = text.trim();
	const { isFlash, validUntil } = extractFlash(raw);
	return {
		platform: detectPlatformFromText(raw),
		code: extractCode(raw),
		offValue: extractOffValue(raw),
		description: extractDescription(raw),
		isFlash,
		validUntil,
		raw,
	};
}

/** Um cupom é útil se tiver ao menos código OU valor. */
export function isUsableCoupon(c: ParsedCoupon): boolean {
	return !!(c.code || c.offValue);
}
