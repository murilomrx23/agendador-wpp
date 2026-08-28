/**
 * Disparo para os grupos de WhatsApp.
 *
 * O escopo atual é "gerar + agendar + envio manual": o sistema prepara a
 * mensagem e a deixa pronta no horário agendado, sem enviar sozinho (zero
 * risco de banimento do número). A interface `Dispatcher` já está pronta para,
 * no futuro, plugar um serviço de envio automático (ex.: Baileys /
 * whatsapp-web.js rodando num servidor Node, ou a WhatsApp Cloud API) sem
 * mexer no núcleo.
 */
import type { OfferRecord } from "../data/db";

export interface DispatchResult {
	/** true = enviado automaticamente; false = preparado para envio manual. */
	dispatched: boolean;
	/** Mensagem final selecionada. */
	message: string;
	/** Grupos-alvo. */
	groups: string[];
	/** Observação para a UI/logs. */
	note: string;
}

export interface Dispatcher {
	readonly id: string;
	dispatch(offer: OfferRecord): Promise<DispatchResult>;
}

/**
 * Disparo manual: não envia nada, apenas devolve a mensagem selecionada
 * pronta para copiar/colar nos grupos.
 */
export class ManualDispatcher implements Dispatcher {
	readonly id = "manual";

	async dispatch(offer: OfferRecord): Promise<DispatchResult> {
		const message = offer.variations[offer.selectedIndex] ?? offer.variations[0] ?? "";
		return {
			dispatched: false,
			message,
			groups: offer.groups,
			note: "Mensagem pronta para envio manual. Copie e cole nos grupos selecionados.",
		};
	}
}
