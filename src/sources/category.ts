/**
 * Adivinha a categoria do produto pelo nome, para a headline usar o benefício
 * curto certo. Heurística simples por palavras-chave; o usuário pode ajustar
 * na interface antes de gerar.
 */
import type { Category } from "../generator/types";

const KEYWORDS: Array<[Category, string[]]> = [
	["cozinha", ["panela", "frigideira", "cozinha", "talher", "faca", "pote", "hermetic", "airfryer", "air fryer", "liquidificador", "cafeteira", "xícara", "copo", "assadeira", "forma", "utensílio"]],
	["limpeza", ["limpeza", "faxina", "vassoura", "rodo", "pano", "esfregão", "detergente", "mop", "balde", "escova de limpeza"]],
	["organizacao", ["organizador", "organização", "caixa organizadora", "cabide", "gaveta", "prateleira", "divisória", "cesto", "nicho"]],
	["beleza", ["maquiagem", "batom", "beleza", "skincare", "hidratante", "sérum", "perfume", "shampoo", "condicionador", "secador", "chapinha", "escova alisadora", "esmalte", "unha"]],
	["infantil", ["infantil", "bebê", "bebe", "criança", "brinquedo", "fralda", "mamadeira", "chupeta", "berço"]],
	["pet", ["pet", "cachorro", "gato", "cão", "ração", "coleira", "arranhador", "aquário", "petisco"]],
	["tecnologia", ["fone", "bluetooth", "carregador", "cabo", "smart", "notebook", "mouse", "teclado", "câmera", "caixa de som", "usb", "power bank", "smartwatch", "celular", "capa de celular", "led"]],
	["moda", ["camiseta", "vestido", "calça", "blusa", "tênis", "sapato", "bolsa", "óculos", "relógio", "moda", "jaqueta", "short", "bermuda", "meia", "cinto"]],
	["automotivo", ["automotivo", "carro", "veículo", "pneu", "capa de banco", "suporte veicular", "aspirador automotivo", "moto"]],
	["casa", ["casa", "cama", "toalha", "cortina", "tapete", "almofada", "edredom", "lençol", "decoração", "luminária", "quadro", "vaso"]],
];

/** Retorna a categoria mais provável (ou "generico"). */
export function guessCategory(productName: string): Category {
	const name = (productName || "").toLowerCase();
	for (const [category, words] of KEYWORDS) {
		if (words.some((w) => name.includes(w))) return category;
	}
	return "generico";
}
