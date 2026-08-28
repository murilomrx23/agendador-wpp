/**
 * Definições de tipos da aplicação.
 */

export interface Env {
	/** Binding do Workers AI (opcional; reservado para melhorias de headline). */
	AI: Ai;

	/** Binding de assets estáticos (frontend). */
	ASSETS: { fetch: (request: Request) => Promise<Response> };

	/** Banco D1 com as ofertas agendadas. */
	DB: D1Database;

	/** Credenciais (secrets) das fontes de afiliados — opcionais. */
	SHOPEE_APP_ID?: string;
	SHOPEE_APP_SECRET?: string;
	MELI_ACCESS_TOKEN?: string;

	/** Tags de afiliado aplicadas aos links de compra — opcionais. */
	SHOPEE_SUB_ID?: string;
	MELI_AFFILIATE_TAG?: string;

	/** Token que protege o endpoint de ingestão de cupons (coletor Telegram). */
	INGEST_TOKEN?: string;
}

/**
 * Representa uma mensagem de chat (mantido para compatibilidade com o
 * endpoint de IA, caso reativado).
 */
export interface ChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
}
