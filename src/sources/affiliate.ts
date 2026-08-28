/**
 * Aplicação da tag de afiliado nos links de compra.
 *
 * Links vindos da API de afiliados da Shopee já saem com a sua conta embutida.
 * Para links "crus" (Meli permalink, ou entrada manual), anexamos a tag/sub_id
 * configurada nos secrets, sem quebrar o link se nada estiver configurado.
 *
 * Ajuste os nomes dos parâmetros conforme o formato exato do seu programa de
 * afiliado — deixamos configurável e não-destrutivo.
 */
import type { Env } from "../types";
import type { Platform } from "../generator/types";

/** Anexa um par de query params ao link, preservando os existentes. */
function appendParams(link: string, params: Record<string, string>): string {
	try {
		const url = new URL(link);
		for (const [k, v] of Object.entries(params)) {
			if (v && !url.searchParams.has(k)) url.searchParams.set(k, v);
		}
		return url.toString();
	} catch {
		return link; // link inválido: devolve como está
	}
}

/** Aplica a tag de afiliado conforme a plataforma. */
export function applyAffiliate(link: string, platform: Platform, env: Env): string {
	if (platform === "shopee" && env.SHOPEE_SUB_ID) {
		return appendParams(link, { sub_id: env.SHOPEE_SUB_ID });
	}
	if (platform === "meli" && env.MELI_AFFILIATE_TAG) {
		// Mercado Livre Afiliados usa parâmetros de tracking (ex.: matt_tool).
		// Ajuste o nome do parâmetro conforme o seu painel de afiliado.
		return appendParams(link, { matt_tool: env.MELI_AFFILIATE_TAG });
	}
	return link;
}
