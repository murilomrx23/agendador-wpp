/**
 * Adaptador do Mercado Livre (Afiliados / Products API).
 *
 * O Mercado Livre expõe uma API REST (https://api.mercadolibre.com) com busca
 * de itens e ofertas do dia. A geração de links de afiliado é feita pelo
 * programa "Mercado Livre Afiliados"; este adaptador busca itens com desconto
 * e monta a `Offer`, deixando o link permalink (que você pode transformar no
 * seu link de afiliado). A autenticação usa um Access Token OAuth
 * (MELI_ACCESS_TOKEN) quando disponível; buscas públicas podem funcionar sem
 * token, mas ofertas de afiliado exigem o token.
 */
import type { Env } from "../types";
import type { Offer } from "../generator/types";
import type { FetchOffersParams, OfferSourceAdapter } from "./types";

const MELI_API = "https://api.mercadolibre.com";
const SITE_ID = "MLB"; // Brasil

export class MeliAffiliateSource implements OfferSourceAdapter {
	readonly id = "meli_affiliate";
	readonly label = "Mercado Livre Afiliados";

	constructor(private env: Env) {}

	isConfigured(): boolean {
		return !!this.env.MELI_ACCESS_TOKEN;
	}

	async fetchOffers(params: FetchOffersParams): Promise<Offer[]> {
		if (!this.isConfigured()) {
			throw new Error(
				"Mercado Livre Afiliados não configurado. Defina o secret MELI_ACCESS_TOKEN.",
			);
		}
		const limit = Math.min(params.limit ?? 20, 50);
		const q = params.keyword ? encodeURIComponent(params.keyword) : "ofertas";
		const url = `${MELI_API}/sites/${SITE_ID}/search?q=${q}&limit=${limit}`;

		const res = await fetch(url, {
			headers: { Authorization: `Bearer ${this.env.MELI_ACCESS_TOKEN}` },
		});
		if (!res.ok) {
			throw new Error(`Mercado Livre respondeu ${res.status}: ${await res.text()}`);
		}
		const json = (await res.json()) as { results?: MeliItem[] };
		return (json.results ?? []).map(meliItemToOffer);
	}
}

interface MeliItem {
	title: string;
	price: number;
	original_price?: number | null;
	permalink: string;
	shipping?: { free_shipping?: boolean };
}

function meliItemToOffer(item: MeliItem): Offer {
	const hasOld = typeof item.original_price === "number" && (item.original_price as number) > item.price;
	return {
		productName: item.title,
		price: item.price,
		oldPrice: hasOld ? (item.original_price as number) : undefined,
		link: item.permalink,
		platform: "meli",
		offerType: hasOld ? "relampago" : "padrao",
		category: "generico",
		freeShipping: !!item.shipping?.free_shipping,
	};
}
