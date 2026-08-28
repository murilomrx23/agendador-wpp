import { describe, expect, it } from "vitest";
import { parseCoupon, isUsableCoupon, detectPlatformFromText } from "./parse";

describe("detectPlatformFromText", () => {
	it("detecta shopee e meli", () => {
		expect(detectPlatformFromText("Cupom SHOPEE hoje")).toBe("shopee");
		expect(detectPlatformFromText("Mercado Livre com desconto")).toBe("meli");
		expect(detectPlatformFromText("cupom generico")).toBeUndefined();
	});
});

describe("parseCoupon", () => {
	it("cupom digitável com valor em reais", () => {
		const c = parseCoupon("🎟️ CUPOM SHOPEE\nUse o cupom: CUPOM70 — R$70 OFF acima de R$300\nVálido até 23h59");
		expect(c.platform).toBe("shopee");
		expect(c.code).toBe("CUPOM70");
		expect(c.offValue).toBe("70");
		expect(c.isFlash).toBe(true);
		expect(c.validUntil).toBe("23h59");
		expect(isUsableCoupon(c)).toBe(true);
	});

	it("prioriza porcentagem sobre valor monetário", () => {
		const c = parseCoupon("Cupom: SHOP5 - R$25,00 OFF (5% em compras acima de R$200) TODAS AS LOJAS");
		expect(c.offValue).toBe("5%");
		expect(c.description).toBe("TODAS AS LOJAS");
	});

	it("cupom relâmpago com horário", () => {
		const c = parseCoupon("⚡ CUPOM RELÂMPAGO ATÉ 18H\nCódigo: RELAMPAGO20 - 20% OFF");
		expect(c.isFlash).toBe(true);
		expect(c.validUntil).toBe("18h");
		expect(c.code).toBe("RELAMPAGO20");
		expect(c.offValue).toBe("20%");
	});

	it("mercado livre por percentual", () => {
		const c = parseCoupon("Cupom Mercado Livre: MELIDESC 10% OFF LOJAS OFICIAIS");
		expect(c.platform).toBe("meli");
		expect(c.code).toBe("MELIDESC");
		expect(c.offValue).toBe("10%");
		expect(c.description).toBe("LOJAS OFICIAIS");
	});

	it("não confunde palavras comuns com código", () => {
		const c = parseCoupon("CUPOM DE DESCONTO TODAS AS LOJAS 5% OFF");
		expect(c.code).toBeUndefined();
		expect(c.offValue).toBe("5%");
	});

	it("cupom sem código mas com valor é utilizável", () => {
		const c = parseCoupon("15 OFF TODAS AS LOJAS na Shopee");
		expect(c.code).toBeUndefined();
		expect(c.offValue).toBe("15");
		expect(isUsableCoupon(c)).toBe(true);
	});
});
