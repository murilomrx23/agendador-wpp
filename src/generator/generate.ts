/**
 * Orquestração da geração das 3 variações do anúncio.
 *
 * As três variações cumprem funções persuasivas diferentes:
 *  - Variação 1: BENEFÍCIO
 *  - Variação 2: URGÊNCIA DE COMPRA
 *  - Variação 3: DOR / PROBLEMA ROTINEIRO
 *
 * As headlines são escolhidas por um RNG determinístico (semeado), garantindo
 * variação entre produtos/dias sem repetir estrutura entre as 3 variações.
 */
import { assembleAd, detectPlatform, discountAbs, discountPct, shouldShowDiscountLine, shouldShowOldPrice } from "./format";
import {
	CATEGORY_BENEFITS,
	CATEGORY_PAINS,
	HEADLINE_BANK,
	HEADLINE_EMOJIS,
	RELAMPAGO_PREFIX,
} from "./rules";
import type { Category, GeneratedAd, Offer, OfferType, Platform } from "./types";

/** Hash simples e estável de string → uint32 (para semear o RNG). */
function hashString(input: string): number {
	let h = 2166136261 >>> 0;
	for (let i = 0; i < input.length; i++) {
		h ^= input.charCodeAt(i);
		h = Math.imul(h, 16777619) >>> 0;
	}
	return h >>> 0;
}

/** RNG determinístico (mulberry32). Retorna função que gera floats [0,1). */
function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return function () {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Escolhe um item do array com o RNG e o remove (sem reposição). */
function pick<T>(rng: () => number, pool: T[]): T {
	const idx = Math.floor(rng() * pool.length) % pool.length;
	return pool.splice(idx, 1)[0];
}

/** Preenche placeholders {B}/{P}/{E} de um template de headline. */
function fillHeadline(
	template: string,
	benefit: string,
	pain: string,
	emoji: string,
): string {
	return template
		.replace(/\{B\}/g, benefit)
		.replace(/\{P\}/g, pain)
		.replace(/\{E\}/g, emoji)
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * Gera as 3 headlines (com asteriscos), respeitando o ângulo de cada variação
 * e o prefixo obrigatório da oferta relâmpago.
 */
function buildHeadlines(
	category: Category,
	offerType: OfferType,
	seed: number,
): [string, string, string] {
	const rng = mulberry32(seed);
	const benefits = [...CATEGORY_BENEFITS[category]];
	const pains = [...CATEGORY_PAINS[category]];
	const emojis = [...HEADLINE_EMOJIS];

	const benefit1 = pick(rng, benefits);
	const benefit2 = benefits.length ? pick(rng, benefits) : benefit1;
	const benefit3 = benefits.length ? pick(rng, benefits) : benefit1;
	const pain3 = pick(rng, pains);

	if (offerType === "relampago") {
		// Todas começam com o prefixo obrigatório; caudas distintas por variação.
		const tails = [...HEADLINE_BANK.relampago];
		const t1 = fillHeadline(pick(rng, tails), benefit1, pain3, pick(rng, emojis));
		const t2 = fillHeadline(pick(rng, tails), benefit2, pain3, pick(rng, emojis));
		const t3 = fillHeadline(pick(rng, tails), benefit3, pain3, pick(rng, emojis));
		return [
			`*${RELAMPAGO_PREFIX}: ${t1}*`,
			`*${RELAMPAGO_PREFIX}: ${t2}*`,
			`*${RELAMPAGO_PREFIX}: ${t3}*`,
		];
	}

	const h1 = fillHeadline(
		pick(rng, [...HEADLINE_BANK.beneficio]),
		benefit1,
		pain3,
		pick(rng, emojis),
	);
	const h2 = fillHeadline(
		pick(rng, [...HEADLINE_BANK.urgencia]),
		benefit2,
		pain3,
		pick(rng, emojis),
	);
	const h3 = fillHeadline(
		pick(rng, [...HEADLINE_BANK.dor]),
		benefit3,
		pain3,
		pick(rng, emojis),
	);
	return [`*${h1}*`, `*${h2}*`, `*${h3}*`];
}

/** Valida a oferta e lança erro com mensagem clara em caso de problema. */
export function validateOffer(offer: Offer): void {
	if (!offer.productName || !offer.productName.trim()) {
		throw new Error("Nome do produto é obrigatório.");
	}
	if (typeof offer.price !== "number" || !isFinite(offer.price) || offer.price <= 0) {
		throw new Error("Preço final deve ser um número maior que zero.");
	}
	if (!offer.link || !/^https?:\/\//i.test(offer.link.trim())) {
		throw new Error("Link de compra inválido (precisa começar com http).");
	}
	if (offer.oldPrice !== undefined && offer.oldPrice !== null) {
		if (typeof offer.oldPrice !== "number" || !isFinite(offer.oldPrice)) {
			throw new Error("Valor antigo deve ser um número.");
		}
	}
}

/**
 * Gera o anúncio completo (3 variações) a partir de uma oferta.
 */
export function generateAd(offer: Offer): GeneratedAd {
	validateOffer(offer);

	const offerType: OfferType = offer.offerType || "padrao";
	const platform: Platform = detectPlatform(offer.link, offer.platform);
	const category: Category = offer.category || "generico";
	const seed = hashString(`${offer.productName}|${offer.price}|${offer.seed ?? 0}`);

	const [h1, h2, h3] = buildHeadlines(category, offerType, seed);

	const variations = [h1, h2, h3].map((headline) =>
		assembleAd(offer, headline, platform, offerType),
	);

	return {
		variations,
		meta: {
			platform,
			offerType,
			discountPct: discountPct(offer.price, offer.oldPrice),
			discountAbs: discountAbs(offer.price, offer.oldPrice),
			showOldPrice: shouldShowOldPrice(offer.price, offer.oldPrice),
			showDiscountLine: shouldShowDiscountLine(offer.price, offer.oldPrice),
		},
	};
}
