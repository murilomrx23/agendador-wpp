/**
 * Ofertas Bot — Coleta, geração e agendamento de anúncios.
 *
 * Fluxo:
 *   1. Coleta a oferta (via afiliados Shopee/ML ou entrada manual)
 *   2. Gera 3 variações de anúncio seguindo o "Agente Divulgador de Produtos"
 *   3. Agenda o disparo (envio manual) para os grupos de WhatsApp
 *
 * API:
 *   GET  /api/health
 *   POST /api/generate            -> gera 3 variações (sem salvar)
 *   GET  /api/sources             -> lista fontes e se estão configuradas
 *   GET  /api/sources/:id/offers  -> coleta ofertas de uma fonte
 *   POST /api/offers              -> cria/agenda uma oferta
 *   GET  /api/offers              -> lista (filtra por ?status= ou ?due=1)
 *   GET  /api/offers/:id          -> detalhe
 *   PATCH /api/offers/:id         -> atualiza (status, agendamento, seleção, grupos)
 *   DELETE /api/offers/:id        -> remove
 *
 * @license MIT
 */
import { Env } from "./types";
import { generateAd } from "./generator/generate";
import type { Coupon, Offer, Platform } from "./generator/types";
import { OfferRepo, type CreateOfferInput, type OfferStatus } from "./data/db";
import { CouponRepo, toGeneratorCoupon, type CouponSource } from "./data/coupons";
import { parseCoupon } from "./coupons/parse";
import { detectPlatform } from "./generator/format";
import { applyAffiliate } from "./sources/affiliate";
import { getSource, getSources } from "./sources";
import { ManualDispatcher } from "./whatsapp/dispatcher";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function error(message: string, status = 400): Response {
	return json({ error: message }, status);
}

/** Garante que o binding D1 existe, com mensagem clara caso contrário. */
function requireDb(env: Env): D1Database {
	if (!env.DB) {
		throw new Error(
			"Banco D1 não configurado. Crie o banco e o binding 'DB' (veja o README).",
		);
	}
	return env.DB;
}

export default {
	async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		// Assets estáticos (frontend)
		if (!path.startsWith("/api/")) {
			return env.ASSETS.fetch(request);
		}

		try {
			return await route(request, env, url);
		} catch (err) {
			console.error("Erro na API:", err);
			return error(err instanceof Error ? err.message : "Erro interno", 500);
		}
	},

	/** Cron: promove ofertas agendadas para "ready" quando o horário chega. */
	async scheduled(_event: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
		if (!env.DB) return;
		const repo = new OfferRepo(env.DB);
		const promoted = await repo.promoteDue();
		if (promoted > 0) console.log(`${promoted} oferta(s) prontas para disparo.`);
		// No modo manual não enviamos automaticamente. Um Dispatcher automático
		// (Baileys/Cloud API) poderia ser chamado aqui no futuro.
	},
} satisfies ExportedHandler<Env>;

async function route(request: Request, env: Env, url: URL): Promise<Response> {
	const path = url.pathname;
	const method = request.method;

	if (path === "/api/health") {
		return json({ ok: true, service: "ofertas-bot" });
	}

	// POST /api/generate — gera as 3 variações sem persistir.
	if (path === "/api/generate" && method === "POST") {
		const body = (await request.json()) as GenerateBody;
		const { offer, appliedCoupon } = await withAutoCoupon(env, body);
		const ad = generateAd(offer);
		return json({ ...ad, offer, appliedCoupon });
	}

	// /api/coupons ...
	if (path === "/api/coupons/ingest" && method === "POST") {
		return ingestCoupon(request, env);
	}
	if (path === "/api/coupons/active" && method === "GET") {
		const repo = new CouponRepo(requireDb(env));
		const platform = url.searchParams.get("platform") as Platform | null;
		if (!platform) return error("Informe ?platform=shopee|meli", 400);
		return json({ coupon: await repo.latestActiveForPlatform(platform) });
	}
	if (path === "/api/coupons") {
		const repo = new CouponRepo(requireDb(env));
		if (method === "GET") {
			const platform = (url.searchParams.get("platform") as Platform | null) ?? undefined;
			const activeParam = url.searchParams.get("active");
			const active = activeParam == null ? undefined : activeParam === "1";
			return json({ coupons: await repo.list({ platform, active }) });
		}
		if (method === "POST") {
			const body = (await request.json()) as IngestBody;
			return json(await saveCoupon(repo, body, "manual"), 201);
		}
		return error("Método não permitido.", 405);
	}
	const couponIdMatch = path.match(/^\/api\/coupons\/([^/]+)$/);
	if (couponIdMatch) {
		const repo = new CouponRepo(requireDb(env));
		const id = couponIdMatch[1];
		if (method === "PATCH") {
			const { active } = (await request.json()) as { active: boolean };
			const rec = await repo.setActive(id, !!active);
			return rec ? json(rec) : error("Cupom não encontrado.", 404);
		}
		if (method === "DELETE") {
			const ok = await repo.remove(id);
			return ok ? json({ ok: true }) : error("Cupom não encontrado.", 404);
		}
		return error("Método não permitido.", 405);
	}

	// GET /api/sources — lista fontes e status de configuração.
	if (path === "/api/sources" && method === "GET") {
		const sources = getSources(env).map((s) => ({
			id: s.id,
			label: s.label,
			configured: s.isConfigured(),
		}));
		return json({ sources });
	}

	// GET /api/sources/:id/offers — coleta ofertas de uma fonte.
	const srcMatch = path.match(/^\/api\/sources\/([^/]+)\/offers$/);
	if (srcMatch && method === "GET") {
		const source = getSource(env, srcMatch[1]);
		if (!source) return error("Fonte não encontrada.", 404);
		const keyword = url.searchParams.get("keyword") || undefined;
		const limit = Number(url.searchParams.get("limit")) || undefined;
		const offers = await source.fetchOffers({ keyword, limit });
		return json({ offers });
	}

	// /api/offers ...
	if (path === "/api/offers") {
		const repo = new OfferRepo(requireDb(env));
		if (method === "GET") {
			if (url.searchParams.get("due") === "1") {
				return json({ offers: await repo.due() });
			}
			const status = url.searchParams.get("status") as OfferStatus | null;
			return json({ offers: await repo.list({ status: status ?? undefined }) });
		}
		if (method === "POST") {
			const body = (await request.json()) as CreateOfferBody;
			return json(await createOffer(repo, env, body), 201);
		}
		return error("Método não permitido.", 405);
	}

	const idMatch = path.match(/^\/api\/offers\/([^/]+)$/);
	if (idMatch) {
		const repo = new OfferRepo(requireDb(env));
		const id = idMatch[1];
		if (method === "GET") {
			const rec = await repo.get(id);
			return rec ? json(rec) : error("Oferta não encontrada.", 404);
		}
		if (method === "PATCH") {
			const patch = (await request.json()) as PatchOfferBody;
			const updated = await repo.update(id, normalizePatch(patch));
			return updated ? json(updated) : error("Oferta não encontrada.", 404);
		}
		if (method === "DELETE") {
			const ok = await repo.remove(id);
			return ok ? json({ ok: true }) : error("Oferta não encontrada.", 404);
		}
		return error("Método não permitido.", 405);
	}

	return error("Rota não encontrada.", 404);
}

interface GenerateBody extends Offer {
	/** Desliga o auto-anexar de cupom por plataforma (padrão: ligado). */
	autoCoupon?: boolean;
}

interface CreateOfferBody extends GenerateBody {
	/** Índice da variação escolhida (0..2). */
	selectedIndex?: number;
	/** Grupos de WhatsApp de destino. */
	groups?: string[];
	/** Horário do disparo (epoch ms). Ausente = rascunho. */
	scheduledAt?: number | null;
	/** Variações já geradas (se omitidas, o servidor gera). */
	variations?: string[];
	/** Origem da oferta. */
	source?: CreateOfferInput["source"];
}

/**
 * Aplica a tag de afiliado ao link e, quando `autoCoupon` estiver ligado e a
 * oferta não trouxer cupom próprio, anexa o cupom ativo mais recente da
 * plataforma (mudando o tipo para "cupom"). Retorna a oferta ajustada e o
 * cupom aplicado, se houver.
 */
async function withAutoCoupon(
	env: Env,
	body: GenerateBody,
): Promise<{ offer: Offer; appliedCoupon: Coupon | null }> {
	const platform: Platform = detectPlatform(body.link, body.platform);
	const offer: Offer = {
		...body,
		platform,
		link: applyAffiliate(body.link, platform, env),
	};

	// Já tem cupom explícito ou auto desligado ou sem DB: nada a fazer.
	if (offer.coupon || body.autoCoupon === false || !env.DB) {
		return { offer, appliedCoupon: offer.coupon ?? null };
	}

	const repo = new CouponRepo(env.DB);
	const rec = await repo.latestActiveForPlatform(platform);
	if (!rec) return { offer, appliedCoupon: null };

	const coupon = toGeneratorCoupon(rec);
	return {
		offer: { ...offer, coupon, offerType: "cupom" },
		appliedCoupon: coupon,
	};
}

/** Cria/agenda uma oferta, gerando as variações se necessário. */
async function createOffer(repo: OfferRepo, env: Env, body: CreateOfferBody) {
	const { offer } = await withAutoCoupon(env, body);
	const variations = body.variations && body.variations.length === 3
		? body.variations
		: generateAd(offer).variations;

	const input: CreateOfferInput = {
		productName: offer.productName,
		price: offer.price,
		oldPrice: offer.oldPrice ?? null,
		link: offer.link,
		platform: offer.platform as Platform,
		offerType: offer.offerType || "padrao",
		category: offer.category ?? null,
		freeShipping: !!offer.freeShipping,
		coupon: offer.coupon ?? null,
		variations,
		selectedIndex: clampIndex(body.selectedIndex),
		groups: body.groups ?? [],
		scheduledAt: body.scheduledAt ?? null,
		source: body.source ?? "manual",
	};
	const record = await repo.create(input);

	// Prepara a mensagem selecionada (disparo manual).
	const dispatch = await new ManualDispatcher().dispatch(record);
	return { offer: record, dispatch };
}

interface IngestBody {
	text?: string;
	platform?: Platform;
	code?: string;
	offValue?: string;
	description?: string;
	isFlash?: boolean;
	validUntil?: string;
	channel?: string;
	expiresAt?: number | null;
}

/** Salva um cupom, fazendo parse do texto e evitando duplicatas recentes. */
async function saveCoupon(repo: CouponRepo, body: IngestBody, source: CouponSource) {
	const parsed = body.text ? parseCoupon(body.text) : null;
	const input = {
		platform: body.platform ?? parsed?.platform ?? null,
		code: body.code ?? parsed?.code ?? null,
		offValue: body.offValue ?? parsed?.offValue ?? null,
		description: body.description ?? parsed?.description ?? null,
		isFlash: body.isFlash ?? parsed?.isFlash ?? false,
		validUntil: body.validUntil ?? parsed?.validUntil ?? null,
		channel: body.channel ?? null,
		raw: body.text ?? null,
		expiresAt: body.expiresAt ?? null,
		source,
	};
	if (!input.code && !input.offValue) {
		throw new Error("Cupom sem código nem valor: nada a salvar.");
	}
	const dup = await repo.findRecentDuplicate(input);
	if (dup) return { coupon: dup, duplicate: true };
	return { coupon: await repo.create(input), duplicate: false };
}

/** Endpoint de ingestão do coletor (Telegram/Instagram), protegido por token. */
async function ingestCoupon(request: Request, env: Env): Promise<Response> {
	if (env.INGEST_TOKEN) {
		const auth = request.headers.get("authorization") || "";
		const token = auth.replace(/^Bearer\s+/i, "");
		if (token !== env.INGEST_TOKEN) return error("Não autorizado.", 401);
	}
	const repo = new CouponRepo(requireDb(env));
	const body = (await request.json()) as IngestBody & { source?: CouponSource };
	const result = await saveCoupon(repo, body, body.source ?? "telegram");
	return json(result, result.duplicate ? 200 : 201);
}

interface PatchOfferBody {
	status?: OfferStatus;
	scheduledAt?: number | null;
	selectedIndex?: number;
	groups?: string[];
	/** Atalho para marcar como enviada agora. */
	markSent?: boolean;
}

function normalizePatch(patch: PatchOfferBody) {
	const out: Record<string, unknown> = {};
	if (patch.status) out.status = patch.status;
	if (patch.scheduledAt !== undefined) out.scheduledAt = patch.scheduledAt;
	if (patch.selectedIndex !== undefined) out.selectedIndex = clampIndex(patch.selectedIndex);
	if (patch.groups !== undefined) out.groups = patch.groups;
	if (patch.markSent) {
		out.status = "sent";
		out.sentAt = Date.now();
	}
	return out;
}

function clampIndex(i?: number): number {
	if (typeof i !== "number" || !isFinite(i)) return 0;
	return Math.max(0, Math.min(2, Math.floor(i)));
}
