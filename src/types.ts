/**
 * Type definitions for the LLM chat application.
 */

export interface Env {
	/**
	 * Binding for the Workers AI API.
	 */
	AI: Ai;

	/**
	 * Binding for static assets.
	 */
	ASSETS: { fetch: (request: Request) => Promise<Response> };

	/**
	 * Higgs Studio — credenciais da API do Higgsfield (definidas como SECRETS,
	 * nunca versionadas). Ver higgs-studio/DEPLOY.md.
	 */
	HIGGSFIELD_API_KEY?: string;
	HIGGSFIELD_API_SECRET?: string;
	HIGGSFIELD_API_BASE?: string;
	HIGGSFIELD_PATH_IMAGE?: string;
	HIGGSFIELD_PATH_JOBSET?: string;
}

/**
 * Represents a chat message.
 */
export interface ChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
}
