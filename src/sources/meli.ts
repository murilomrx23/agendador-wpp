/**
 * Adaptador do Mercado Livre (Afiliados / Products API).
 *
 * Busca itens em https://api.mercadolibre.com/sites/MLB/search e monta as
 * `Offer`s. Quando `original_price > price`, deriva o valor antigo e marca a
 * oferta como relâmpago (formato "De/Por"). O link permalink recebe a tag de
 * afiliado configurada. Autenticação por Access Token (MELI_ACCESS_TOKEN).
 */
import type { Env } from "../types";
import type { Offer, OfferType } from "../generator/types";
import type { FetchOffersParams, OfferFeed, OfferSourceAdapter } from "./types";
import { guessCategory } from "./category";

const MELI_API = "https://api.mercadolibre.com";
const SITE_ID = "MLB"; // Brasil

export interface MeliItem {
	title: string;
	price: number;
	original_price?: number | null;
	permalink: string;
	shipping?: { free_shipping?: boolean };
}

/** Converte um item do Mercado Livre em `Offer`. */
export function mapMeliItem(item: MeliItem, tag?: string, forceType?: OfferType): Offer {
	const hasOld =
		typeof item.original_price === "number" && (item.original_price as number) > item.price;
	const link = tag ? applyMeliTag(item.permalink, tag) : item.permalink;
	return {
		productName: item.title,
		price: item.price,
		oldPrice: hasOld ? (item.original_price as number) : undefined,
		link,
		platform: "meli",
		offerType: forceType ?? (hasOld ? "relampago" : "padrao"),
		category: guessCategory(item.title),
		freeShipping: !!item.shipping?.free_shipping,
	};
}

/** Mapeia o feed para o parâmetro `sort` da busca do Mercado Livre. */
function feedSort(feed?: OfferFeed): string | null {
	if (feed === "mais_vendidos") return "sold_quantity_desc";
	return null; // principais/relâmpago: relevância padrão
}

/** Anexa o parâmetro de tracking do afiliado, sem sobrescrever. */
function applyMeliTag(link: string, tag: string): string {
	try {
		const url = new URL(link);
		if (!url.searchParams.has("matt_tool")) url.searchParams.set("matt_tool", tag);
		return url.toString();
	} catch {
		return link;
	}
}

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
		const feed = params.feed ?? "principais";
		const q = params.keyword ? encodeURIComponent(params.keyword) : "ofertas";
		const sort = feedSort(feed);
		const url = `${MELI_API}/sites/${SITE_ID}/search?q=${q}&limit=${limit}${sort ? `&sort=${sort}` : ""}`;

		const res = await fetch(url, {
			headers: { Authorization: `Bearer ${this.env.MELI_ACCESS_TOKEN}` },
		});
		if (!res.ok) {
			throw new Error(`Mercado Livre respondeu ${res.status}: ${await res.text()}`);
		}
		const json = (await res.json()) as { results?: MeliItem[] };
		const items = json.results ?? [];
		const withDeals = items.filter((i) => typeof i.original_price === "number" && (i.original_price as number) > i.price);
		// Relâmpago/principais priorizam itens com desconto real.
		const chosen = feed === "mais_vendidos" ? items : withDeals.length ? withDeals : items;
		const forceType: OfferType | undefined = feed === "relampago" ? "relampago" : undefined;
		return chosen.map((item) => mapMeliItem(item, this.env.MELI_AFFILIATE_TAG, forceType));
	}
}
