/**
 * Adaptador da Shopee Affiliate (Open API / GraphQL).
 *
 * A Shopee expõe uma GraphQL API para afiliados em:
 *   https://open-api.affiliate.shopee.com.br/graphql
 * A autenticação usa um header `Authorization` no formato:
 *   SHA256 Credential={appId}, Timestamp={ts}, Signature={sig}
 * onde `sig = sha256(appId + timestamp + payload + appSecret)`.
 *
 * Este adaptador implementa a assinatura e a query de ofertas. Basta
 * configurar as credenciais (SHOPEE_APP_ID / SHOPEE_APP_SECRET) como secrets
 * do Worker para ativá-lo. Enquanto não configurado, `fetchOffers` lança um
 * erro explicativo e a coleta manual segue funcionando normalmente.
 */
import type { Env } from "../types";
import type { Offer } from "../generator/types";
import type { FetchOffersParams, OfferSourceAdapter } from "./types";

const SHOPEE_GRAPHQL = "https://open-api.affiliate.shopee.com.br/graphql";

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

		// Query de ofertas de produtos (productOfferV2). Ajuste os campos
		// conforme a documentação vigente da sua conta de afiliado.
		const query = `query { productOfferV2(listType: 0, sortType: 2, limit: ${limit}${
			params.keyword ? `, keyword: ${JSON.stringify(params.keyword)}` : ""
		}) { nodes { productName priceMin priceMax price offerLink imageUrl productCatIds ratingStar } } }`;

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
		return nodes.map(shopeeNodeToOffer);
	}
}

interface ShopeeNode {
	productName: string;
	price?: string;
	priceMin?: string;
	priceMax?: string;
	offerLink: string;
}

function shopeeNodeToOffer(n: ShopeeNode): Offer {
	const price = parseFloat(n.price ?? n.priceMin ?? "0");
	return {
		productName: n.productName,
		price: isFinite(price) ? price : 0,
		link: n.offerLink,
		platform: "shopee",
		offerType: "padrao",
		category: "generico",
	};
}
