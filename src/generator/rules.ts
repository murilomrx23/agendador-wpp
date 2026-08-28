/**
 * Constantes e bancos de texto do agente divulgador.
 *
 * Tudo aqui vem literalmente das regras do arquivo do agente:
 * links de resgate por plataforma, frases fixas de urgência/cupom,
 * e as bibliotecas de headline por ângulo persuasivo e categoria.
 */
import type { Category } from "./types";

/** Link de resgate — Shopee com cupom DIGITÁVEL. */
export const SHOPEE_REDEEM_TYPEABLE = "https://s.shopee.com.br/6ffB5DxyKM";

/** Link de resgate — Shopee com cupom NÃO digitável. */
export const SHOPEE_REDEEM_NON_TYPEABLE = "https://s.shopee.com.br/4VZ4QKlIen";

/** Frase de validade — apenas Oferta Relâmpago. */
export const URGENCY_RELAMPAGO = "*⏳ Oferta válida até as 23h59 de hoje!*";

/** Frase de urgência — apenas Oferta com Cupom. */
export const URGENCY_CUPOM =
	"*🔥 Aproveite antes que esgote, não deixe para depois!*";

/** Prefixo obrigatório da headline em Oferta Relâmpago. */
export const RELAMPAGO_PREFIX = "⚡ OFERTA RELÂMPAGO";

/** Descrição padrão do cupom por valor. */
export const DEFAULT_COUPON_DESCRIPTION = "TODAS AS LOJAS";

/** Emojis permitidos na headline (⚡ é reservado para relâmpago). */
export const HEADLINE_EMOJIS = ["🔥", "😍", "✨", "🚨", "💥", "😱", "🛒", "👀"];

/**
 * Benefícios curtos por categoria (MAIÚSCULO), usados na headline de benefício.
 * Derivados de "CATEGORIAS E BENEFÍCIOS CURTOS".
 */
export const CATEGORY_BENEFITS: Record<Category, string[]> = {
	casa: ["MAIS ORGANIZAÇÃO", "CASA MAIS PRÁTICA", "AMBIENTE MAIS ARRUMADO"],
	cozinha: [
		"MAIS PRATICIDADE NA COZINHA",
		"PREPARO MAIS FÁCIL",
		"MENOS TEMPO NA COZINHA",
	],
	beleza: ["MAIS CUIDADO NA ROTINA", "BELEZA COM PRATICIDADE", "CUIDADO FÁCIL"],
	infantil: [
		"MAIS DIVERSÃO",
		"PRATICIDADE PARA OS PEQUENOS",
		"CONFORTO PARA AS CRIANÇAS",
	],
	pet: ["MAIS CONFORTO PARA O PET", "CUIDADO PRÁTICO", "ROTINA PET MAIS FÁCIL"],
	limpeza: [
		"LIMPEZA MAIS PRÁTICA",
		"MENOS ESFORÇO NA FAXINA",
		"CASA LIMPA COM FACILIDADE",
	],
	organizacao: ["MENOS BAGUNÇA", "TUDO NO LUGAR", "ORGANIZAÇÃO FÁCIL"],
	tecnologia: ["MAIS FACILIDADE", "ROTINA CONECTADA", "SOLUÇÃO INTELIGENTE"],
	moda: ["ESTILO PAGANDO MENOS", "PEÇA VERSÁTIL", "MAIS CONFORTO NO DIA A DIA"],
	automotivo: [
		"MAIS PRATICIDADE NO CARRO",
		"CUIDADO COM O VEÍCULO",
		"ORGANIZAÇÃO NO CARRO",
	],
	generico: ["MAIS PRATICIDADE", "MAIS FACILIDADE", "ROTINA MAIS SIMPLES"],
};

/**
 * Dores/incômodos curtos por categoria (MAIÚSCULO), usados na headline de dor.
 */
export const CATEGORY_PAINS: Record<Category, string[]> = {
	casa: ["BAGUNÇA", "FALTA DE ESPAÇO", "DESORDEM EM CASA"],
	cozinha: ["BAGUNÇA NA COZINHA", "PERDER TEMPO NO PREPARO", "LOUÇA ACUMULADA"],
	beleza: ["ROTINA CORRIDA", "FALTA DE TEMPO", "CUIDADO DEIXADO DE LADO"],
	infantil: ["A CRIANÇADA AGITADA", "FALTA DE ORGANIZAÇÃO", "HORA DA BAGUNÇA"],
	pet: ["PELOS PELA CASA", "BAGUNÇA DO PET", "FALTA DE PRATICIDADE"],
	limpeza: ["FAXINA CANSATIVA", "SUJEIRA DIFÍCIL", "ESFORÇO NA LIMPEZA"],
	organizacao: ["BAGUNÇA", "FALTA DE ESPAÇO", "COISAS FORA DO LUGAR"],
	tecnologia: ["FIOS BAGUNÇADOS", "ROTINA COMPLICADA", "FALTA DE PRATICIDADE"],
	moda: ["FALTA DE OPÇÃO", "GASTAR DEMAIS COM LOOK", "ARMÁRIO SEM VERSATILIDADE"],
	automotivo: ["CARRO BAGUNÇADO", "FALTA DE ORGANIZAÇÃO", "DESCUIDO COM O VEÍCULO"],
	generico: ["A CORRERIA DO DIA A DIA", "FALTA DE PRATICIDADE", "A ROTINA CORRIDA"],
};

/**
 * Bibliotecas de headline por ângulo. `{B}` é substituído por um benefício
 * curto da categoria; `{P}` por uma dor curta; `{E}` por um emoji.
 * As três funções persuasivas ficam em bancos distintos, garantindo que as
 * 3 variações nunca compartilhem a mesma estrutura de headline.
 */
export const HEADLINE_BANK = {
	/** VARIAÇÃO 1 — BENEFÍCIO. */
	beneficio: [
		"PREÇO BAIXOU: {B} POR MENOS {E}",
		"ACHADINHO DO DIA PARA {B} {E}",
		"OFERTA BOA PARA QUEM QUER {B} {E}",
		"{B} GASTANDO MENOS HOJE {E}",
		"OLHA ESSE ACHADO: {B} COM PREÇO BOM {E}",
		"ECONOMIA REAL PARA TER {B} {E}",
	],
	/** VARIAÇÃO 2 — URGÊNCIA DE COMPRA. */
	urgencia: [
		"ESTOQUE REDUZIDO: {B} GASTANDO MENOS {E}",
		"ACABA RÁPIDO: {B} POR MENOS {E}",
		"PREÇO PODE MUDAR: GARANTA {B} {E}",
		"SAINDO RÁPIDO: {B} COM PREÇO BOM {E}",
		"POUCAS UNIDADES PARA TER {B} {E}",
		"OFERTA ATIVA AGORA: {B} POR MENOS {E}",
	],
	/** VARIAÇÃO 3 — DOR OU PROBLEMA ROTINEIRO. */
	dor: [
		"CHEGA DE {P}: SOLUÇÃO COM PREÇO BOM {E}",
		"ADEUS {P}: {B} DE VEZ {E}",
		"RESOLVA {P} GASTANDO MENOS {E}",
		"CANSOU DE {P}? {B} FÁCIL {E}",
		"FIM DA {P}: {B} SEM PESAR NO BOLSO {E}",
	],
	/**
	 * Caudas para Oferta Relâmpago. A headline sempre começa com o prefixo
	 * "⚡ OFERTA RELÂMPAGO:" e recebe uma destas caudas.
	 */
	relampago: [
		"PREÇO BAIXO POR POUCO TEMPO {E}",
		"MAIS PRATICIDADE GASTANDO MENOS {E}",
		"ESSA PODE SUMIR RÁPIDO {E}",
		"GARANTA {B} ANTES QUE ACABE {E}",
		"{B} COM PREÇO QUE CAI RÁPIDO {E}",
		"CORRE QUE O PREÇO SEGURA POUCO {E}",
	],
} as const;
