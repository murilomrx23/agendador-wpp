import { describe, expect, it } from "vitest";
import { generateAd } from "./generate";
import {
	brl,
	discountLine,
	formatCouponValue,
	priceBlock,
	redeemLinkBlock,
	shouldShowDiscountLine,
	shouldShowOldPrice,
} from "./format";
import {
	SHOPEE_REDEEM_NON_TYPEABLE,
	SHOPEE_REDEEM_TYPEABLE,
	URGENCY_CUPOM,
	URGENCY_RELAMPAGO,
} from "./rules";
import type { Offer } from "./types";

describe("moeda BRL", () => {
	it("formata valores comuns", () => {
		expect(brl(49.9)).toBe("R$ 49,90");
		expect(brl(54.9)).toBe("R$ 54,90");
		expect(brl(1299.9)).toBe("R$ 1.299,90");
		expect(brl(5)).toBe("R$ 5,00");
	});
});

describe("regras de desconto baixo", () => {
	it("não mostra valor antigo quando diferença < R$ 10,00", () => {
		// 59,90 -> 54,90 = R$5 de diferença, 8%
		expect(shouldShowOldPrice(54.9, 59.9)).toBe(false);
		expect(shouldShowDiscountLine(54.9, 59.9)).toBe(false);
		expect(discountLine(54.9, 59.9)).toBeNull();
	});

	it("mostra valor antigo e desconto quando diferença >= R$10 e >= 10%", () => {
		expect(shouldShowOldPrice(49.9, 89.9)).toBe(true);
		expect(shouldShowDiscountLine(49.9, 89.9)).toBe(true);
		expect(discountLine(49.9, 89.9)).toBe("🔥 Desconto de: *44% OFF*");
	});

	it("promo comum com desconto baixo mostra só o preço final", () => {
		expect(priceBlock("padrao", 54.9, 59.9)).toEqual(["💰 *R$ 54,90*"]);
	});
});

describe("formatCouponValue", () => {
	it("prioriza porcentagem", () => {
		expect(formatCouponValue("5%", "TODAS AS LOJAS")).toBe("5% OFF TODAS AS LOJAS");
	});
	it("usa valor monetário sem porcentagem", () => {
		expect(formatCouponValue("-R$20,00")).toBe("20 OFF TODAS AS LOJAS");
	});
	it("respeita descrição customizada", () => {
		expect(formatCouponValue("20", "LOJAS OFICIAIS")).toBe("20 OFF LOJAS OFICIAIS");
	});
});

describe("links de resgate", () => {
	it("shopee com código digitável usa link digitável", () => {
		const block = redeemLinkBlock("cupom", "shopee", { code: "CUPOM70" });
		expect(block).toEqual(["*✨ Resgate seu cupom aqui:*", SHOPEE_REDEEM_TYPEABLE]);
	});
	it("shopee sem código usa link não digitável", () => {
		const block = redeemLinkBlock("cupom", "shopee", { offValue: "15" });
		expect(block).toEqual(["*✨ Resgate seu cupom aqui:*", SHOPEE_REDEEM_NON_TYPEABLE]);
	});
	it("meli nunca tem link de resgate", () => {
		expect(redeemLinkBlock("cupom", "meli", { code: "X" })).toBeNull();
	});
	it("oferta não-cupom não tem resgate", () => {
		expect(redeemLinkBlock("relampago", "shopee")).toBeNull();
	});
});

describe("generateAd - estrutura", () => {
	const base: Offer = {
		productName: "Organizador de Gavetas 6 Peças",
		price: 49.9,
		oldPrice: 89.9,
		link: "https://s.shopee.com.br/abc123",
		category: "organizacao",
		freeShipping: true,
	};

	it("gera exatamente 3 variações distintas", () => {
		const ad = generateAd(base);
		expect(ad.variations).toHaveLength(3);
		expect(new Set(ad.variations).size).toBe(3);
	});

	it("é determinístico para a mesma entrada", () => {
		expect(generateAd(base)).toEqual(generateAd(base));
	});

	it("toda variação tem nome, preço e link", () => {
		const ad = generateAd(base);
		for (const v of ad.variations) {
			expect(v).toContain(`*${base.productName}*`);
			expect(v).toContain("💰 *R$ 49,90*");
			expect(v).toContain("🔗 *Compre aqui:*");
			expect(v).toContain(base.link);
		}
	});

	it("promo comum mostra valor antigo e desconto", () => {
		const ad = generateAd(base);
		expect(ad.meta.discountPct).toBe(44);
		expect(ad.variations[0]).toContain("~❌De: R$ 89,90~");
		expect(ad.variations[0]).toContain("🔥 Desconto de: *44% OFF*");
	});
});

describe("generateAd - oferta relâmpago", () => {
	it("todas as headlines começam com o prefixo e trazem validade", () => {
		const ad = generateAd({
			productName: "Panela Antiaderente 24cm",
			price: 49.9,
			oldPrice: 89.9,
			link: "https://s.shopee.com.br/xyz",
			offerType: "relampago",
			category: "cozinha",
		});
		for (const v of ad.variations) {
			expect(v.startsWith("*⚡ OFERTA RELÂMPAGO:")).toBe(true);
			expect(v).toContain("⚡💰Por: *R$ 49,90*");
			expect(v).toContain(URGENCY_RELAMPAGO);
			expect(v).not.toContain(URGENCY_CUPOM);
		}
	});
});

describe("generateAd - oferta com cupom", () => {
	it("shopee: mostra cupom, link de compra antes do resgate e urgência de cupom", () => {
		const ad = generateAd({
			productName: "Kit Potes Herméticos 10 Peças",
			price: 49.9,
			oldPrice: 89.9,
			link: "https://s.shopee.com.br/pote",
			offerType: "cupom",
			coupon: { code: "CUPOM70" },
			category: "cozinha",
		});
		const v = ad.variations[0];
		expect(v).toContain("✅ Por: *R$ 49,90* 😱 no pix com CUPOM");
		expect(v).toContain("*🏷️ Use o cupom: CUPOM70*");
		expect(v).toContain(SHOPEE_REDEEM_TYPEABLE);
		expect(v).toContain(URGENCY_CUPOM);
		// Link de compra deve vir antes do link de resgate.
		expect(v.indexOf("🔗 *Compre aqui:*")).toBeLessThan(v.indexOf("Resgate seu cupom"));
	});

	it("meli: cupom sem link de resgate", () => {
		const ad = generateAd({
			productName: "Fone Bluetooth Esportivo",
			price: 99.9,
			oldPrice: 149.9,
			link: "https://www.mercadolivre.com.br/MLB-123",
			offerType: "cupom",
			coupon: { offValue: "10%" },
			category: "tecnologia",
		});
		const v = ad.variations[0];
		expect(v).toContain("*🎟️ Cupom: 10% OFF TODAS AS LOJAS*");
		expect(v).not.toContain("Resgate seu cupom");
		expect(ad.meta.platform).toBe("meli");
	});
});

describe("generateAd - espaçamento", () => {
	it("usa 1 linha em branco entre blocos e nenhuma dentro", () => {
		const ad = generateAd({
			productName: "Produto Teste",
			price: 49.9,
			link: "https://s.shopee.com.br/t",
		});
		// Oferta padrão pura: headline / nome / preço / link (com 2 linhas).
		const v = ad.variations[0];
		expect(v).not.toContain("\n\n\n");
		// Bloco do link tem label e url em linhas consecutivas, sem branco.
		expect(v).toContain("🔗 *Compre aqui:*\nhttps://s.shopee.com.br/t");
	});
});

describe("generateAd - validação", () => {
	it("rejeita preço inválido", () => {
		expect(() => generateAd({ productName: "X", price: 0, link: "https://a.b" })).toThrow();
	});
	it("rejeita link inválido", () => {
		expect(() => generateAd({ productName: "X", price: 10, link: "abc" })).toThrow();
	});
});
