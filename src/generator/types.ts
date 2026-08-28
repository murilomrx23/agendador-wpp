/**
 * Tipos do motor gerador de anúncios.
 *
 * A entrada (`Offer`) descreve uma oferta coletada (ou digitada manualmente).
 * A saída (`GeneratedAd`) traz as 3 variações prontas para copiar, seguindo
 * fielmente o "AGENTE DIVULGADOR DE PRODUTOS".
 */

/** Plataforma de origem do link de compra. */
export type Platform = "shopee" | "meli";

/**
 * Tipo da oferta.
 * - `padrao`   → Oferta Padrão (ou Promoção Comum, quando houver valor antigo)
 * - `relampago`→ Oferta Relâmpago (validade até 23h59)
 * - `cupom`    → Oferta com Cupom
 */
export type OfferType = "padrao" | "relampago" | "cupom";

/**
 * Categoria do produto, usada para escolher o benefício/dor curta na headline.
 * Espelha as categorias do agente.
 */
export type Category =
	| "casa"
	| "cozinha"
	| "beleza"
	| "infantil"
	| "pet"
	| "limpeza"
	| "organizacao"
	| "tecnologia"
	| "moda"
	| "automotivo"
	| "generico";

/** Dados do cupom, quando aplicável. */
export interface Coupon {
	/** Código digitável do cupom (ex.: "CUPOM70"). Tem prioridade na exibição. */
	code?: string;
	/**
	 * Valor/percentual do desconto do cupom quando NÃO há código digitável.
	 * Ex.: "20" (vira "20 OFF ...") ou "5%" (vira "5% OFF ...").
	 */
	offValue?: string;
	/**
	 * Descrição que substitui "TODAS AS LOJAS".
	 * Ex.: "LOJAS OFICIAIS". Padrão: "TODAS AS LOJAS".
	 */
	description?: string;
}

/** Oferta de entrada para o gerador. */
export interface Offer {
	/** Nome completo do produto. */
	productName: string;
	/** Preço final (atual), em reais. Ex.: 49.9 */
	price: number;
	/** Valor antigo (opcional), em reais. Ex.: 89.9 */
	oldPrice?: number;
	/** Link de compra (afiliado). */
	link: string;
	/** Plataforma. Se omitida, é detectada pelo domínio do link. */
	platform?: Platform;
	/** Tipo da oferta. Padrão: "padrao". */
	offerType?: OfferType;
	/** Cupom, quando `offerType === "cupom"`. */
	coupon?: Coupon;
	/** Categoria do produto, para benefícios na headline. Padrão: "generico". */
	category?: Category;
	/** Frete grátis informado? */
	freeShipping?: boolean;
	/**
	 * Semente de variação. Muda as headlines escolhidas mantendo determinismo.
	 * Use, por exemplo, o dia do ano para variar entre dias.
	 */
	seed?: number;
}

/** Resultado da geração: 3 variações + metadados. */
export interface GeneratedAd {
	/** As 3 variações, na ordem: benefício, urgência, dor. */
	variations: string[];
	/** Metadados úteis para a UI/relatórios. */
	meta: {
		platform: Platform;
		offerType: OfferType;
		/** Percentual de desconto arredondado (0 se não houver valor antigo). */
		discountPct: number;
		/** Diferença em reais (0 se não houver valor antigo). */
		discountAbs: number;
		/** Valor antigo será exibido? (diferença >= R$ 10,00) */
		showOldPrice: boolean;
		/** Linha de desconto será exibida? (percentual >= 10) */
		showDiscountLine: boolean;
	};
}
