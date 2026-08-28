/**
 * Repositório de cupons especiais (Cloudflare D1).
 *
 * Guarda os cupons coletados dos canais oficiais do Telegram (ou cadastrados
 * manualmente) e permite consultar o cupom ativo mais recente por plataforma —
 * usado para anexar automaticamente às ofertas daquela plataforma.
 */
import type { Coupon, Platform } from "../generator/types";

export type CouponSource = "telegram" | "manual";

export interface CouponRecord {
	id: string;
	createdAt: number;
	platform: Platform | null;
	code: string | null;
	offValue: string | null;
	description: string | null;
	isFlash: boolean;
	validUntil: string | null;
	source: CouponSource;
	channel: string | null;
	raw: string | null;
	expiresAt: number | null;
	active: boolean;
}

export interface CreateCouponInput {
	platform?: Platform | null;
	code?: string | null;
	offValue?: string | null;
	description?: string | null;
	isFlash?: boolean;
	validUntil?: string | null;
	source?: CouponSource;
	channel?: string | null;
	raw?: string | null;
	expiresAt?: number | null;
}

function rowToRecord(row: Record<string, unknown>): CouponRecord {
	return {
		id: String(row.id),
		createdAt: Number(row.created_at),
		platform: (row.platform as Platform) ?? null,
		code: (row.code as string) ?? null,
		offValue: (row.off_value as string) ?? null,
		description: (row.description as string) ?? null,
		isFlash: Number(row.is_flash) === 1,
		validUntil: (row.valid_until as string) ?? null,
		source: row.source as CouponSource,
		channel: (row.channel as string) ?? null,
		raw: (row.raw as string) ?? null,
		expiresAt: row.expires_at == null ? null : Number(row.expires_at),
		active: Number(row.active) === 1,
	};
}

/** Converte um CouponRecord no `Coupon` que o gerador consome. */
export function toGeneratorCoupon(rec: CouponRecord): Coupon {
	const c: Coupon = {};
	if (rec.code) c.code = rec.code;
	if (rec.offValue) c.offValue = rec.offValue;
	if (rec.description) c.description = rec.description;
	return c;
}

function newId(): string {
	return "cup-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
}

export class CouponRepo {
	constructor(private db: D1Database) {}

	async create(input: CreateCouponInput): Promise<CouponRecord> {
		const id = newId();
		const now = Date.now();
		await this.db
			.prepare(
				`INSERT INTO coupons (
					id, created_at, platform, code, off_value, description,
					is_flash, valid_until, source, channel, raw, expires_at, active
				) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)`,
			)
			.bind(
				id,
				now,
				input.platform ?? null,
				input.code ?? null,
				input.offValue ?? null,
				input.description ?? null,
				input.isFlash ? 1 : 0,
				input.validUntil ?? null,
				input.source ?? "manual",
				input.channel ?? null,
				input.raw ?? null,
				input.expiresAt ?? null,
			)
			.run();
		const rec = await this.get(id);
		if (!rec) throw new Error("Falha ao salvar o cupom.");
		return rec;
	}

	async get(id: string): Promise<CouponRecord | null> {
		const row = await this.db
			.prepare("SELECT * FROM coupons WHERE id = ?")
			.bind(id)
			.first<Record<string, unknown>>();
		return row ? rowToRecord(row) : null;
	}

	/**
	 * Evita duplicar o mesmo cupom recém-coletado (mesma plataforma + código,
	 * ou mesma plataforma + valor quando não há código) nas últimas 12h.
	 */
	async findRecentDuplicate(input: CreateCouponInput): Promise<CouponRecord | null> {
		const since = Date.now() - 12 * 60 * 60 * 1000;
		const row = await this.db
			.prepare(
				`SELECT * FROM coupons WHERE created_at >= ?
					AND (platform IS ? OR platform = ?)
					AND ((code IS NOT NULL AND code = ?) OR (code IS NULL AND ? IS NULL AND off_value = ?))
					ORDER BY created_at DESC LIMIT 1`,
			)
			.bind(
				since,
				input.platform ?? null,
				input.platform ?? null,
				input.code ?? null,
				input.code ?? null,
				input.offValue ?? null,
			)
			.first<Record<string, unknown>>();
		return row ? rowToRecord(row) : null;
	}

	async list(opts: { platform?: Platform; active?: boolean; limit?: number } = {}): Promise<CouponRecord[]> {
		const limit = Math.min(opts.limit ?? 100, 500);
		const clauses: string[] = [];
		const binds: unknown[] = [];
		if (opts.platform) {
			clauses.push("(platform = ? OR platform IS NULL)");
			binds.push(opts.platform);
		}
		if (opts.active !== undefined) {
			clauses.push("active = ?");
			binds.push(opts.active ? 1 : 0);
		}
		const where = clauses.length ? "WHERE " + clauses.join(" AND ") : "";
		binds.push(limit);
		const { results } = await this.db
			.prepare(`SELECT * FROM coupons ${where} ORDER BY created_at DESC LIMIT ?`)
			.bind(...binds)
			.all<Record<string, unknown>>();
		return (results ?? []).map(rowToRecord);
	}

	/**
	 * Cupom ativo mais recente aplicável a uma plataforma (inclui cupons sem
	 * plataforma definida, que valem para qualquer uma). Ignora expirados.
	 */
	async latestActiveForPlatform(platform: Platform): Promise<CouponRecord | null> {
		const now = Date.now();
		const row = await this.db
			.prepare(
				`SELECT * FROM coupons
					WHERE active = 1
					AND (platform = ? OR platform IS NULL)
					AND (expires_at IS NULL OR expires_at > ?)
					ORDER BY created_at DESC LIMIT 1`,
			)
			.bind(platform, now)
			.first<Record<string, unknown>>();
		return row ? rowToRecord(row) : null;
	}

	async setActive(id: string, active: boolean): Promise<CouponRecord | null> {
		await this.db.prepare("UPDATE coupons SET active = ? WHERE id = ?").bind(active ? 1 : 0, id).run();
		return this.get(id);
	}

	async remove(id: string): Promise<boolean> {
		const res = await this.db.prepare("DELETE FROM coupons WHERE id = ?").bind(id).run();
		return (res.meta?.changes ?? 0) > 0;
	}
}
