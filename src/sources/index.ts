/**
 * Registro das fontes de ofertas disponíveis.
 */
import type { Env } from "../types";
import type { OfferSourceAdapter } from "./types";
import { ShopeeAffiliateSource } from "./shopee";
import { MeliAffiliateSource } from "./meli";

export function getSources(env: Env): OfferSourceAdapter[] {
	return [new ShopeeAffiliateSource(env), new MeliAffiliateSource(env)];
}

export function getSource(env: Env, id: string): OfferSourceAdapter | undefined {
	return getSources(env).find((s) => s.id === id);
}

export type { OfferSourceAdapter } from "./types";
