/**
 * Coletor de cupons especiais dos canais oficiais do Telegram.
 *
 * Conecta com a sua sessão de usuário, resolve os canais configurados
 * (aceita username público OU link de convite privado t.me/+hash), monitora
 * suas mensagens, filtra o que parece cupom e envia (texto cru) para o
 * endpoint /api/coupons/ingest do Worker, que faz o parse e a deduplicação.
 *
 *   npm start
 */
import { TelegramClient, Api } from "telegram";
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

const channelEntries = (TELEGRAM_CHANNELS || "")
	.split(",")
	.map((s) => s.trim())
	.filter(Boolean);

/** Heurística leve: só encaminha o que parece cupom (o parse fica no Worker). */
function looksLikeCoupon(text) {
	const t = text.toLowerCase();
	return /cupom|c[oó]digo|\d+\s*%|r\$\s*\d+|\boff\b/.test(t);
}

/** Extrai o hash de um link de convite (t.me/+hash, /joinchat/hash, ou +hash). */
function inviteHash(entry) {
	const m = entry.match(/(?:t\.me\/\+|t\.me\/joinchat\/|^\+)([A-Za-z0-9_-]+)/);
	return m ? m[1] : null;
}

/** Normaliza um username público (remove @, URL). */
function publicUsername(entry) {
	const m = entry.match(/(?:t\.me\/|@)?([A-Za-z0-9_]{4,})$/);
	return m ? m[1] : null;
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

const client = new TelegramClient(
	new StringSession(TELEGRAM_SESSION),
	Number(TELEGRAM_API_ID),
	TELEGRAM_API_HASH,
	{ connectionRetries: 5 },
);

await client.connect();
console.log("Conectado ao Telegram.");

/** Resolve cada entrada em uma entidade, entrando em convites privados. */
async function resolveChannels() {
	const resolved = [];
	for (const entry of channelEntries) {
		const hash = inviteHash(entry);
		try {
			if (hash) {
				// Link de convite privado: tenta entrar (ok se já for membro).
				try {
					await client.invoke(new Api.messages.ImportChatInvite({ hash }));
				} catch (e) {
					if (!/already|USER_ALREADY_PARTICIPANT/i.test(e.message || "")) {
						// CheckChatInvite ainda resolve a entidade se já for membro.
					}
				}
				const info = await client.invoke(new Api.messages.CheckChatInvite({ hash }));
				const chat = info.chat || (info.chats && info.chats[0]);
				if (chat) {
					const entity = await client.getEntity(chat);
					resolved.push({ entity, label: entity.title || `+${hash.slice(0, 6)}` });
					continue;
				}
			}
			const uname = publicUsername(entry);
			if (uname) {
				const entity = await client.getEntity(uname);
				resolved.push({ entity, label: uname });
			}
		} catch (err) {
			console.error(`Não consegui resolver "${entry}":`, err.message);
		}
	}
	return resolved;
}

const targets = await resolveChannels();
if (!targets.length) {
	console.error("Nenhum canal resolvido. Verifique TELEGRAM_CHANNELS e se sua conta tem acesso.");
	process.exit(1);
}
console.log("Monitorando: " + targets.map((t) => t.label).join(", "));

// Backfill leve: últimas mensagens de cada canal.
for (const t of targets) {
	try {
		const messages = await client.getMessages(t.entity, { limit: 15 });
		for (const m of messages.reverse()) {
			if (m?.message && looksLikeCoupon(m.message)) await postIngest(m.message, t.label);
		}
	} catch (err) {
		console.error(`Falha no backfill de ${t.label}:`, err.message);
	}
}

// Tempo real, filtrando pelos canais resolvidos (funciona p/ públicos e privados).
client.addEventHandler(async (event) => {
	const msg = event.message;
	const text = msg?.message;
	if (!text || !looksLikeCoupon(text)) return;
	let label;
	try {
		const chat = await msg.getChat();
		label = targets.find((t) => t.entity.id?.value === chat?.id?.value)?.label;
	} catch {
		/* ignore */
	}
	await postIngest(text, label);
}, new NewMessage({ chats: targets.map((t) => t.entity) }));

console.log("Aguardando novos cupons… (Ctrl+C para sair)");
