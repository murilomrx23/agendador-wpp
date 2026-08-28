/**
 * Contrato das fontes de ofertas.
 *
 * Uma fonte coleta ofertas/cupons de uma plataforma (Shopee, Mercado Livre)
 * e devolve `Offer`s prontas para o gerador. Cada fonte é um adaptador
 * independente — assim o núcleo (gerador + agendamento) não depende de nenhuma
 * API específica e novas fontes podem ser plugadas depois.
 */
import type { Offer } from "../generator/types";

export interface FetchOffersParams {
	/** Palavra-chave/categoria para filtrar (opcional). */
	keyword?: string;
	/** Quantidade máxima de ofertas. */
	limit?: number;
}

export interface OfferSourceAdapter {
	/** Identificador da fonte (ex.: "shopee_affiliate"). */
	readonly id: string;
	/** Nome amigável para a UI. */
	readonly label: string;
	/** Indica se as credenciais necessárias estão configuradas. */
	isConfigured(): boolean;
	/** Coleta ofertas da plataforma. Deve lançar erro claro se não configurada. */
	fetchOffers(params: FetchOffersParams): Promise<Offer[]>;
}
