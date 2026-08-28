/**
 * Camada de dados (Cloudflare D1) para as ofertas agendadas.
 *
 * O agendamento guarda a oferta, as 3 variações geradas, o grupo(s) de destino
 * e o horário do disparo. Como o disparo é manual, o ciclo de vida é:
 *   draft → scheduled → ready (chegou a hora) → sent | canceled
 */
import type { Coupon, Category, OfferType, Platform } from "../generator/types";

export type OfferStatus = "draft" | "scheduled" | "ready" | "sent" | "canceled";
export type OfferSource = "manual" | "shopee_affiliate" | "meli_affiliate";

/** Registro de oferta como persistido/retornado pela API. */
export interface OfferRecord {
	id: string;
	createdAt: number;
	updatedAt: number;
	status: OfferStatus;
	scheduledAt: number | null;
	sentAt: number | null;

	productName: string;
	price: number;
	oldPrice: number | null;
	link: string;
	platform: Platform;
	offerType: OfferType;
	category: Category | null;
	freeShipping: boolean;
	coupon: Coupon | null;

	variations: string[];
	selectedIndex: number;

	groups: string[];
	source: OfferSource;
}

/** Entrada para criar/agendar uma oferta. */
export interface CreateOfferInput {
	productName: string;
	price: number;
	oldPrice?: number | null;
	link: string;
	platform: Platform;
	offerType: OfferType;
	category?: Category | null;
	freeShipping: boolean;
	coupon?: Coupon | null;
	variations: string[];
	selectedIndex?: number;
	groups?: string[];
	scheduledAt?: number | null;
	status?: OfferStatus;
	source?: OfferSource;
}

/** Converte uma linha do D1 no OfferRecord tipado. */
function rowToRecord(row: Record<string, unknown>): OfferRecord {
	return {
		id: String(row.id),
		createdAt: Number(row.created_at),
		updatedAt: Number(row.updated_at),
		status: row.status as OfferStatus,
		scheduledAt: row.scheduled_at == null ? null : Number(row.scheduled_at),
		sentAt: row.sent_at == null ? null : Number(row.sent_at),
		productName: String(row.product_name),
		price: Number(row.price),
		oldPrice: row.old_price == null ? null : Number(row.old_price),
		link: String(row.link),
		platform: row.platform as Platform,
		offerType: row.offer_type as OfferType,
		category: (row.category as Category) ?? null,
		freeShipping: Number(row.free_shipping) === 1,
		coupon: row.coupon_json ? (JSON.parse(String(row.coupon_json)) as Coupon) : null,
		variations: JSON.parse(String(row.variations_json)) as string[],
		selectedIndex: Number(row.selected_index),
		groups: JSON.parse(String(row.groups_json || "[]")) as string[],
		source: row.source as OfferSource,
	};
}

/** Gera um id curto e único. */
function newId(): string {
	return (
		Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8)
	);
}

/** Repositório de ofertas sobre o D1. */
export class OfferRepo {
	constructor(private db: D1Database) {}

	async create(input: CreateOfferInput): Promise<OfferRecord> {
		const now = Date.now();
		const id = newId();
		const status: OfferStatus =
			input.status || (input.scheduledAt ? "scheduled" : "draft");

		await this.db
			.prepare(
				`INSERT INTO offers (
					id, created_at, updated_at, status, scheduled_at, sent_at,
					product_name, price, old_price, link, platform, offer_type,
					category, free_shipping, coupon_json, variations_json,
					selected_index, groups_json, source
				) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
			)
			.bind(
				id,
				now,
				now,
				status,
				input.scheduledAt ?? null,
				null,
				input.productName,
				input.price,
				input.oldPrice ?? null,
				input.link,
				input.platform,
				input.offerType,
				input.category ?? null,
				input.freeShipping ? 1 : 0,
				input.coupon ? JSON.stringify(input.coupon) : null,
				JSON.stringify(input.variations),
				input.selectedIndex ?? 0,
				JSON.stringify(input.groups ?? []),
				input.source ?? "manual",
			)
			.run();

		const rec = await this.get(id);
		if (!rec) throw new Error("Falha ao criar a oferta.");
		return rec;
	}

	async get(id: string): Promise<OfferRecord | null> {
		const row = await this.db
			.prepare("SELECT * FROM offers WHERE id = ?")
			.bind(id)
			.first<Record<string, unknown>>();
		return row ? rowToRecord(row) : null;
	}

	/** Lista ofertas, opcionalmente filtrando por status. */
	async list(opts: { status?: OfferStatus; limit?: number } = {}): Promise<OfferRecord[]> {
		const limit = Math.min(opts.limit ?? 100, 500);
		const stmt = opts.status
			? this.db
					.prepare(
						"SELECT * FROM offers WHERE status = ? ORDER BY COALESCE(scheduled_at, created_at) DESC LIMIT ?",
					)
					.bind(opts.status, limit)
			: this.db
					.prepare(
						"SELECT * FROM offers ORDER BY COALESCE(scheduled_at, created_at) DESC LIMIT ?",
					)
					.bind(limit);
		const { results } = await stmt.all<Record<string, unknown>>();
		return (results ?? []).map(rowToRecord);
	}

	/** Ofertas cujo horário já chegou e ainda não foram enviadas. */
	async due(now = Date.now()): Promise<OfferRecord[]> {
		const { results } = await this.db
			.prepare(
				"SELECT * FROM offers WHERE status IN ('scheduled','ready') AND scheduled_at IS NOT NULL AND scheduled_at <= ? ORDER BY scheduled_at ASC",
			)
			.bind(now)
			.all<Record<string, unknown>>();
		return (results ?? []).map(rowToRecord);
	}

	/** Atualiza campos mutáveis (status, agendamento, seleção, grupos). */
	async update(
		id: string,
		patch: Partial<
			Pick<OfferRecord, "status" | "scheduledAt" | "sentAt" | "selectedIndex" | "groups">
		>,
	): Promise<OfferRecord | null> {
		const current = await this.get(id);
		if (!current) return null;
		const next = { ...current, ...patch, updatedAt: Date.now() };
		await this.db
			.prepare(
				`UPDATE offers SET status=?, scheduled_at=?, sent_at=?, selected_index=?, groups_json=?, updated_at=? WHERE id=?`,
			)
			.bind(
				next.status,
				next.scheduledAt,
				next.sentAt,
				next.selectedIndex,
				JSON.stringify(next.groups),
				next.updatedAt,
				id,
			)
			.run();
		return this.get(id);
	}

	async remove(id: string): Promise<boolean> {
		const res = await this.db.prepare("DELETE FROM offers WHERE id = ?").bind(id).run();
		return (res.meta?.changes ?? 0) > 0;
	}

	/**
	 * Marca como "ready" as ofertas agendadas cujo horário chegou.
	 * Chamado pelo cron. Retorna quantas foram promovidas.
	 */
	async promoteDue(now = Date.now()): Promise<number> {
		const res = await this.db
			.prepare(
				"UPDATE offers SET status='ready', updated_at=? WHERE status='scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= ?",
			)
			.bind(now, now)
			.run();
		return res.meta?.changes ?? 0;
	}
}
