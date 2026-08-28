/**
 * Coletor de cupons especiais do Telegram.
 *
 * Conecta com a sua sessão de usuário, monitora os canais oficiais
 * configurados (TELEGRAM_CHANNELS), filtra mensagens que parecem cupons e as
 * envia (texto cru) para o endpoint /api/coupons/ingest do Worker, que faz o
 * parse e a deduplicação centralizados.
 *
 *   npm start
 */
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { NewMessage } from "telegram/events/index.js";
import "dotenv/config";

const {
	TELEGRAM_API_ID,
	TELEGRAM_API_HASH,
	TELEGRAM_SESSION,
	TELEGRAM_CHANNELS,
	INGEST_URL,
	INGEST_TOKEN,
} = process.env;

if (!TELEGRAM_SESSION) {
	console.error("TELEGRAM_SESSION vazio. Rode `npm run login` primeiro.");
	process.exit(1);
}
if (!INGEST_URL) {
	console.error("Defina INGEST_URL no .env (endpoint /api/coupons/ingest do Worker).");
	process.exit(1);
}

const channels = (TELEGRAM_CHANNELS || "")
	.split(",")
	.map((s) => s.trim().replace(/^@/, "").toLowerCase())
	.filter(Boolean);

/** Heurística leve: só encaminha o que parece cupom (o parse fica no Worker). */
function looksLikeCoupon(text) {
	const t = text.toLowerCase();
	return /cupom|c[oó]digo|\d+\s*%|r\$\s*\d+|\boff\b/.test(t);
}

async function postIngest(text, channel) {
	try {
		const res = await fetch(INGEST_URL, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				...(INGEST_TOKEN ? { authorization: `Bearer ${INGEST_TOKEN}` } : {}),
			},
			body: JSON.stringify({ text, channel, source: "telegram" }),
		});
		const data = await res.json().catch(() => ({}));
		const tag = data.duplicate ? "(duplicado)" : data.coupon?.code || data.coupon?.offValue || "";
		console.log(`[${new Date().toISOString()}] ${channel || "?"} -> ${res.status} ${tag}`);
	} catch (err) {
		console.error("Falha ao enviar para o Worker:", err.message);
	}
}

/** Resolve o username do chat de uma mensagem (quando disponível). */
async function chatUsername(message) {
	try {
		const chat = await message.getChat();
		return chat?.username ? String(chat.username).toLowerCase() : undefined;
	} catch {
		return undefined;
	}
}

const client = new TelegramClient(
	new StringSession(TELEGRAM_SESSION),
	Number(TELEGRAM_API_ID),
	TELEGRAM_API_HASH,
	{ connectionRetries: 5 },
);

await client.connect();
console.log("Conectado ao Telegram.");
console.log(
	channels.length
		? `Monitorando canais: ${channels.join(", ")}`
		: "Monitorando TODOS os canais/chats (defina TELEGRAM_CHANNELS para filtrar).",
);

// Backfill leve: pega mensagens recentes dos canais ao iniciar.
for (const uname of channels) {
	try {
		const messages = await client.getMessages(uname, { limit: 15 });
		for (const m of messages.reverse()) {
			if (m?.message && looksLikeCoupon(m.message)) await postIngest(m.message, uname);
		}
	} catch (err) {
		console.error(`Não consegui ler @${uname}:`, err.message);
	}
}

// Tempo real: novas mensagens.
client.addEventHandler(async (event) => {
	const msg = event.message;
	const text = msg?.message;
	if (!text) return;
	const uname = await chatUsername(msg);
	if (channels.length && (!uname || !channels.includes(uname))) return;
	if (!looksLikeCoupon(text)) return;
	await postIngest(text, uname);
}, new NewMessage({}));

console.log("Aguardando novos cupons… (Ctrl+C para sair)");
