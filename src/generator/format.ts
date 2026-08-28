/**
 * Formatação determinística dos blocos do anúncio.
 *
 * Aqui vivem as regras "duras" do agente (que precisam ser exatas):
 * moeda BRL, cálculo de desconto, regras de desconto baixo, blocos de preço,
 * cupom, links e a montagem final com o espaçamento correto.
 */
import type { Coupon, Offer, OfferType, Platform } from "./types";
import {
	DEFAULT_COUPON_DESCRIPTION,
	SHOPEE_REDEEM_NON_TYPEABLE,
	SHOPEE_REDEEM_TYPEABLE,
	URGENCY_CUPOM,
	URGENCY_RELAMPAGO,
} from "./rules";

/** Formata um número em reais: 1299.9 → "R$ 1.299,90". */
export function brl(value: number): string {
	const fixed = Math.abs(value).toFixed(2);
	const [intPart, decPart] = fixed.split(".");
	const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
	return `R$ ${withThousands},${decPart}`;
}

/** Detecta a plataforma pelo domínio do link, se não informada. */
export function detectPlatform(link: string, explicit?: Platform): Platform {
	if (explicit) return explicit;
	const l = link.toLowerCase();
	if (l.includes("mercadolivre") || l.includes("mercadolibre") || l.includes("/mlb") || l.includes("meli") || l.includes("mlb.com")) {
		return "meli";
	}
	// Shopee é o padrão quando não é claramente Meli.
	return "shopee";
}

/** Percentual de desconto arredondado. 0 quando não há valor antigo válido. */
export function discountPct(price: number, oldPrice?: number): number {
	if (!oldPrice || oldPrice <= price) return 0;
	return Math.round(((oldPrice - price) / oldPrice) * 100);
}

/** Diferença em reais. 0 quando não há valor antigo válido. */
export function discountAbs(price: number, oldPrice?: number): number {
	if (!oldPrice || oldPrice <= price) return 0;
	return oldPrice - price;
}

/** Valor antigo só aparece se a diferença for >= R$ 10,00. */
export function shouldShowOldPrice(price: number, oldPrice?: number): boolean {
	return discountAbs(price, oldPrice) >= 10;
}

/** Linha de desconto só aparece se o percentual for >= 10. */
export function shouldShowDiscountLine(price: number, oldPrice?: number): boolean {
	return discountPct(price, oldPrice) >= 10;
}

/**
 * Bloco de preço, conforme o tipo de oferta e as regras de desconto baixo.
 * Retorna as linhas do bloco (sem linha em branco interna).
 */
export function priceBlock(
	offerType: OfferType,
	price: number,
	oldPrice: number | undefined,
): string[] {
	const showOld = shouldShowOldPrice(price, oldPrice);
	const oldLine = showOld ? `~❌De: ${brl(oldPrice as number)}~` : null;
	const finalPrice = brl(price);

	switch (offerType) {
		case "relampago": {
			const por = `⚡💰Por: *${finalPrice}*`;
			return oldLine ? [oldLine, por] : [por];
		}
		case "cupom": {
			const por = `✅ Por: *${finalPrice}* 😱 no pix com CUPOM`;
			return oldLine ? [oldLine, por] : [por];
		}
		case "padrao":
		default: {
			// Promoção comum (tem valor antigo exibível) x Oferta padrão pura.
			const por = `💰 *${finalPrice}*`;
			return oldLine ? [oldLine, por] : [por];
		}
	}
}

/** Linha de desconto, quando permitida. `null` quando não deve aparecer. */
export function discountLine(price: number, oldPrice?: number): string | null {
	if (!shouldShowDiscountLine(price, oldPrice)) return null;
	return `🔥 Desconto de: *${discountPct(price, oldPrice)}% OFF*`;
}

/**
 * Normaliza o valor do cupom por porcentagem/valor em "X OFF DESCRIÇÃO".
 * - "5%"      + "TODAS AS LOJAS" → "5% OFF TODAS AS LOJAS"
 * - "-R$20,00"+ "TODAS AS LOJAS" → "20 OFF TODAS AS LOJAS"
 */
export function formatCouponValue(offValue: string, description?: string): string {
	const desc = (description || DEFAULT_COUPON_DESCRIPTION).trim();
	const raw = offValue.trim();
	if (raw.includes("%")) {
		const pct = raw.match(/(\d+)\s*%/);
		const num = pct ? pct[1] : raw.replace(/[^\d]/g, "");
		return `${num}% OFF ${desc}`;
	}
	// Valor monetário: remove sinal, "R$" e zeros decimais.
	const num = raw.replace(/r\$/i, "").replace(/[^\d.,-]/g, "");
	const intPart = num.replace(/[-]/g, "").split(/[.,]/)[0].replace(/^0+(?=\d)/, "");
	return `${intPart || num} OFF ${desc}`;
}

/**
 * Bloco de informações do cupom. Prioriza o código digitável; caso não haja,
 * usa o valor/percentual. Retorna `null` quando não há cupom exibível.
 */
export function couponBlock(coupon?: Coupon): string[] | null {
	if (!coupon) return null;
	if (coupon.code && coupon.code.trim()) {
		return [`*🏷️ Use o cupom: ${coupon.code.trim()}*`];
	}
	if (coupon.offValue && coupon.offValue.trim()) {
		return [`*🎟️ Cupom: ${formatCouponValue(coupon.offValue, coupon.description)}*`];
	}
	return null;
}

/** Bloco do link de compra. */
export function buyLinkBlock(link: string): string[] {
	return ["🔗 *Compre aqui:*", link.trim()];
}

/**
 * Bloco do link de resgate do cupom, quando aplicável.
 * - Meli: nunca.
 * - Shopee + código digitável: link digitável.
 * - Shopee + sem código: link não digitável.
 * Só é gerado para ofertas do tipo cupom.
 */
export function redeemLinkBlock(
	offerType: OfferType,
	platform: Platform,
	coupon?: Coupon,
): string[] | null {
	if (offerType !== "cupom") return null;
	if (platform === "meli") return null;
	const isTypeable = !!(coupon && coupon.code && coupon.code.trim());
	const link = isTypeable ? SHOPEE_REDEEM_TYPEABLE : SHOPEE_REDEEM_NON_TYPEABLE;
	return ["*✨ Resgate seu cupom aqui:*", link];
}

/**
 * Bloco final: urgência (por tipo) e frete grátis, unidos sem linha em branco.
 * `null` quando não há nenhuma das duas.
 */
export function finalBlock(offerType: OfferType, freeShipping?: boolean): string[] | null {
	const lines: string[] = [];
	if (offerType === "relampago") lines.push(URGENCY_RELAMPAGO);
	if (offerType === "cupom") lines.push(URGENCY_CUPOM);
	if (freeShipping) lines.push("🚚 Frete grátis");
	return lines.length ? lines : null;
}

/**
 * Monta o corpo do anúncio (do nome do produto para baixo) a partir da oferta
 * e de uma headline já pronta. A headline entra como primeiro bloco.
 */
export function assembleAd(
	offer: Offer,
	headline: string,
	platform: Platform,
	offerType: OfferType,
): string {
	const blocks: string[][] = [];

	blocks.push([headline]);
	blocks.push([`*${offer.productName.trim()}*`]);
	blocks.push(priceBlock(offerType, offer.price, offer.oldPrice));

	const disc = discountLine(offer.price, offer.oldPrice);
	if (disc) blocks.push([disc]);

	if (offerType === "cupom") {
		const cb = couponBlock(offer.coupon);
		if (cb) blocks.push(cb);
	}

	blocks.push(buyLinkBlock(offer.link));

	const redeem = redeemLinkBlock(offerType, platform, offer.coupon);
	if (redeem) blocks.push(redeem);

	const fin = finalBlock(offerType, offer.freeShipping);
	if (fin) blocks.push(fin);

	// 1 linha em branco entre blocos; nenhuma dentro do bloco.
	return blocks.map((b) => b.join("\n")).join("\n\n");
}
