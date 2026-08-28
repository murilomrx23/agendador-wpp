/**
 * Adaptador da Shopee Affiliate (Open API / GraphQL).
 *
 * Endpoint:  https://open-api.affiliate.shopee.com.br/graphql
 * Auth:      header Authorization no formato
 *            SHA256 Credential={appId}, Timestamp={ts}, Signature={sig}
 *            onde sig = sha256(appId + timestamp + payload + appSecret).
 *
 * Usa a query `productOfferV2`, que devolve ofertas de produtos com link de
 * afiliado (`offerLink`) e a taxa de desconto (`priceDiscountRate`), da qual
 * derivamos o valor antigo. Ative com os secrets SHOPEE_APP_ID /
 * SHOPEE_APP_SECRET. Sem eles, `fetchOffers` lança erro explicativo e a coleta
 * manual segue funcionando.
 */
import type { Env } from "../types";
import type { Category, Offer } from "../generator/types";
import type { FetchOffersParams, OfferSourceAdapter } from "./types";
import { applyAffiliate } from "./affiliate";
import { guessCategory } from "./category";

const SHOPEE_GRAPHQL = "https://open-api.affiliate.shopee.com.br/graphql";

/** Nó de produto retornado por productOfferV2 (campos que usamos). */
export interface ShopeeNode {
	productName: string;
	price?: string;
	priceMin?: string;
	priceMax?: string;
	/** Percentual de desconto (inteiro, ex.: 44). */
	priceDiscountRate?: number | string;
	offerLink?: string;
	productLink?: string;
	imageUrl?: string;
	ratingStar?: string;
	productCatIds?: number[];
}

/** Gera a assinatura SHA256 exigida pela Shopee Affiliate API. */
async function signPayload(
	appId: string,
	appSecret: string,
	payload: string,
	timestamp: number,
): Promise<string> {
	const base = `${appId}${timestamp}${payload}${appSecret}`;
	const data = new TextEncoder().encode(base);
	const digest = await crypto.subtle.digest("SHA-256", data);
	return [...new Uint8Array(digest)]
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

/**
 * Converte um nó da Shopee em `Offer`. Deriva o valor antigo a partir da taxa
 * de desconto (`price = old * (1 - rate/100)`), quando disponível.
 */
export function mapShopeeNode(n: ShopeeNode, tag?: string): Offer {
	const price = parseFloat(n.price ?? n.priceMin ?? "0");
	const rate = Number(n.priceDiscountRate ?? 0);
	let oldPrice: number | undefined;
	if (rate > 0 && rate < 100 && isFinite(price) && price > 0) {
		oldPrice = Math.round((price / (1 - rate / 100)) * 100) / 100;
	}
	const rawLink = n.offerLink || n.productLink || "";
	const link = tag ? applyAffiliateTag(rawLink, tag) : rawLink;
	const category: Category = guessCategory(n.productName);
	return {
		productName: n.productName,
		price: isFinite(price) ? price : 0,
		oldPrice,
		link,
		platform: "shopee",
		offerType: "padrao",
		category,
	};
}

/** Anexa sub_id sem sobrescrever, tolerante a links inválidos. */
function applyAffiliateTag(link: string, subId: string): string {
	try {
		const url = new URL(link);
		if (!url.searchParams.has("sub_id")) url.searchParams.set("sub_id", subId);
		return url.toString();
	} catch {
		return link;
	}
}

export class ShopeeAffiliateSource implements OfferSourceAdapter {
	readonly id = "shopee_affiliate";
	readonly label = "Shopee Afiliados";

	constructor(private env: Env) {}

	isConfigured(): boolean {
		return !!(this.env.SHOPEE_APP_ID && this.env.SHOPEE_APP_SECRET);
	}

	async fetchOffers(params: FetchOffersParams): Promise<Offer[]> {
		if (!this.isConfigured()) {
			throw new Error(
				"Shopee Afiliados não configurado. Defina os secrets SHOPEE_APP_ID e SHOPEE_APP_SECRET.",
			);
		}
		const appId = this.env.SHOPEE_APP_ID as string;
		const appSecret = this.env.SHOPEE_APP_SECRET as string;
		const limit = Math.min(params.limit ?? 20, 50);

		// sortType 2 = mais vendidos. Ajuste conforme sua estratégia.
		const args = [
			"sortType: 2",
			`limit: ${limit}`,
			params.keyword ? `keyword: ${JSON.stringify(params.keyword)}` : "",
		]
			.filter(Boolean)
			.join(", ");
		const query = `query { productOfferV2(${args}) { nodes { productName price priceMin priceMax priceDiscountRate offerLink productLink imageUrl ratingStar productCatIds } pageInfo { page limit hasNextPage } } }`;

		const payload = JSON.stringify({ query });
		const timestamp = Math.floor(Date.now() / 1000);
		const signature = await signPayload(appId, appSecret, payload, timestamp);

		const res = await fetch(SHOPEE_GRAPHQL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`,
			},
			body: payload,
		});
		if (!res.ok) {
			throw new Error(`Shopee Afiliados respondeu ${res.status}: ${await res.text()}`);
		}
		const json = (await res.json()) as {
			data?: { productOfferV2?: { nodes?: ShopeeNode[] } };
			errors?: unknown;
		};
		if (json.errors) {
			throw new Error(`Shopee Afiliados erro: ${JSON.stringify(json.errors)}`);
		}
		const nodes = json.data?.productOfferV2?.nodes ?? [];
		return nodes.map((n) => mapShopeeNode(n, this.env.SHOPEE_SUB_ID));
	}
}
