import { describe, expect, it } from "vitest";
import { mapShopeeNode } from "./shopee";
import { mapMeliItem } from "./meli";
import { guessCategory } from "./category";

describe("guessCategory", () => {
	it("classifica por palavra-chave", () => {
		expect(guessCategory("Kit 10 Potes Herméticos para Cozinha")).toBe("cozinha");
		expect(guessCategory("Fone de Ouvido Bluetooth")).toBe("tecnologia");
		expect(guessCategory("Organizador de Gavetas 6 Peças")).toBe("organizacao");
		expect(guessCategory("Ração para Cachorro 15kg")).toBe("pet");
		expect(guessCategory("Produto Qualquer XYZ")).toBe("generico");
	});
});

describe("mapShopeeNode", () => {
	it("deriva valor antigo a partir da taxa de desconto", () => {
		const offer = mapShopeeNode({
			productName: "Panela Antiaderente 24cm",
			price: "49.90",
			priceDiscountRate: 44,
			offerLink: "https://s.shopee.com.br/abc",
		});
		expect(offer.platform).toBe("shopee");
		expect(offer.price).toBe(49.9);
		// 49.90 / (1 - 0.44) ≈ 89.11
		expect(offer.oldPrice).toBeCloseTo(89.11, 1);
		expect(offer.category).toBe("cozinha");
	});

	it("sem desconto não define valor antigo", () => {
		const offer = mapShopeeNode({
			productName: "Item Genérico",
			price: "30.00",
			priceDiscountRate: 0,
			offerLink: "https://s.shopee.com.br/x",
		});
		expect(offer.oldPrice).toBeUndefined();
	});

	it("aplica sub_id de afiliado quando informado", () => {
		const offer = mapShopeeNode(
			{ productName: "X", price: "10.00", offerLink: "https://s.shopee.com.br/x?a=1" },
			"meuid",
		);
		expect(offer.link).toContain("sub_id=meuid");
	});

	it("respeita o offerType forçado (feed relâmpago)", () => {
		const offer = mapShopeeNode(
			{ productName: "X", price: "10.00", priceDiscountRate: 30, offerLink: "https://s.shopee.com.br/x" },
			undefined,
			"relampago",
		);
		expect(offer.offerType).toBe("relampago");
	});
});

describe("mapMeliItem", () => {
	it("marca relâmpago quando há preço original maior", () => {
		const offer = mapMeliItem({
			title: "Smartwatch Esportivo",
			price: 99.9,
			original_price: 149.9,
			permalink: "https://www.mercadolivre.com.br/MLB-1",
			shipping: { free_shipping: true },
		});
		expect(offer.offerType).toBe("relampago");
		expect(offer.oldPrice).toBe(149.9);
		expect(offer.freeShipping).toBe(true);
		expect(offer.category).toBe("tecnologia");
	});

	it("sem original_price vira oferta padrão", () => {
		const offer = mapMeliItem({
			title: "Caderno Universitário",
			price: 19.9,
			original_price: null,
			permalink: "https://www.mercadolivre.com.br/MLB-2",
		});
		expect(offer.offerType).toBe("padrao");
		expect(offer.oldPrice).toBeUndefined();
	});

	it("aplica tag de afiliado quando informada", () => {
		const offer = mapMeliItem(
			{ title: "X", price: 10, permalink: "https://www.mercadolivre.com.br/MLB-3" },
			"minhatag",
		);
		expect(offer.link).toContain("matt_tool=minhatag");
	});
});
