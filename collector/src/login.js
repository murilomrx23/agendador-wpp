/**
 * Gera a TELEGRAM_SESSION (string de sessão) fazendo login com a SUA conta de
 * usuário do Telegram. Rode uma vez e cole o resultado no .env.
 *
 *   npm run login
 *
 * A sessão de usuário (MTProto) é o que permite LER canais públicos oficiais
 * de terceiros — algo que um bot comum não consegue fazer.
 */
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import input from "input";
import "dotenv/config";

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;

if (!apiId || !apiHash) {
	console.error("Defina TELEGRAM_API_ID e TELEGRAM_API_HASH no .env primeiro.");
	process.exit(1);
}

const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
	connectionRetries: 5,
});

await client.start({
	phoneNumber: async () => await input.text("Número (ex.: +5511999999999): "),
	password: async () => await input.text("Senha 2FA (se tiver, senão Enter): "),
	phoneCode: async () => await input.text("Código recebido no Telegram: "),
	onError: (err) => console.error(err),
});

console.log("\nLogin OK! Copie a linha abaixo para o seu .env:\n");
console.log("TELEGRAM_SESSION=" + client.session.save());
await client.disconnect();
process.exit(0);
