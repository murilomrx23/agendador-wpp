/**
 * Armazenamento simples em arquivo JSON das mensagens agendadas.
 *
 * Sem banco de dados nem dependência nativa — robusto e portátil para rodar
 * em qualquer host. Escrita atômica (grava em .tmp e renomeia).
 */
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const FILE = new URL("../data/messages.json", import.meta.url).pathname;

function ensureDir() {
	const dir = dirname(FILE);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function readAll() {
	try {
		return JSON.parse(readFileSync(FILE, "utf8"));
	} catch {
		return [];
	}
}

function writeAll(list) {
	ensureDir();
	const tmp = FILE + ".tmp";
	writeFileSync(tmp, JSON.stringify(list, null, 2));
	renameSync(tmp, FILE);
}

function uid() {
	return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
}

export const store = {
	list() {
		return readAll().sort((a, b) => a.scheduledAt - b.scheduledAt);
	},

	/** Cria uma mensagem agendada. */
	add({ text, imageUrl, groupJid, groupName, scheduledAt }) {
		const all = readAll();
		const rec = {
			id: uid(),
			text: text || "",
			imageUrl: imageUrl || null,
			groupJid,
			groupName: groupName || groupJid,
			scheduledAt,
			status: "pending", // pending | sent | failed | canceled
			createdAt: Date.now(),
			sentAt: null,
			error: null,
		};
		all.push(rec);
		writeAll(all);
		return rec;
	},

	/** Mensagens vencidas e ainda pendentes. */
	due(now = Date.now()) {
		return readAll()
			.filter((m) => m.status === "pending" && m.scheduledAt <= now)
			.sort((a, b) => a.scheduledAt - b.scheduledAt);
	},

	update(id, patch) {
		const all = readAll();
		const i = all.findIndex((m) => m.id === id);
		if (i === -1) return null;
		all[i] = { ...all[i], ...patch };
		writeAll(all);
		return all[i];
	},

	remove(id) {
		const all = readAll();
		const next = all.filter((m) => m.id !== id);
		writeAll(next);
		return next.length !== all.length;
	},
};
