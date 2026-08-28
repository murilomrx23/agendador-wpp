// Ofertas Bot — frontend visual
// Coleta a oferta, gera as 3 variações (prévia estilo WhatsApp) e agenda.

const $ = (id) => document.getElementById(id);
const VARIATION_TAGS = ["Benefício", "Urgência", "Dor / problema"];

let currentVariations = [];
let selectedIndex = 0;

// ---------- utilidades ----------
function toast(msg) {
	const t = $("toast");
	t.textContent = msg;
	t.classList.add("show");
	setTimeout(() => t.classList.remove("show"), 2200);
}

function parseMoney(v) {
	if (!v) return undefined;
	const n = parseFloat(String(v).replace(/\./g, "").replace(",", "."));
	return isFinite(n) ? n : undefined;
}

function escapeHtml(s) {
	return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Renderiza a marcação do WhatsApp: *negrito*, ~riscado~, _itálico_.
function waFormat(text) {
	let h = escapeHtml(text);
	h = h.replace(/\*([^*\n]+)\*/g, "<strong>$1</strong>");
	h = h.replace(/~([^~\n]+)~/g, "<del>$1</del>");
	h = h.replace(/(^|[\s(])_([^_\n]+)_/g, "$1<em>$2</em>");
	return h;
}

function nowTime() {
	return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function copyText(text) {
	navigator.clipboard.writeText(text).then(
		() => toast("Copiado! Cole no grupo do WhatsApp"),
		() => toast("Não foi possível copiar"),
	);
}

async function api(path, opts) {
	const res = await fetch(path, { headers: { "content-type": "application/json" }, ...opts });
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
	return data;
}

// ---------- navegação ----------
const SECTIONS = ["dashboard", "nova", "cupons", "agendadas"];
document.querySelectorAll(".nav button").forEach((btn) => {
	btn.addEventListener("click", () => selectTab(btn.dataset.tab));
});
function selectTab(name) {
	document.querySelectorAll(".nav button").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
	SECTIONS.forEach((s) => ($("tab-" + s).hidden = s !== name));
	if (name === "dashboard") loadDashboard();
	if (name === "agendadas") loadOffers();
	if (name === "cupons") loadCoupons();
}

// ---------- steps ----------
function setStep(active) {
	document.querySelectorAll("#steps .step").forEach((el) => {
		const n = Number(el.dataset.step);
		el.classList.toggle("done", n < active);
		el.classList.toggle("active", n === active);
	});
}

// ---------- painel ----------
async function loadDashboard() {
	try {
		const [{ offers }, { coupons }] = await Promise.all([
			api("/api/offers"),
			api("/api/coupons?active=1"),
		]);
		const now = Date.now();
		const scheduled = offers.filter((o) => o.status === "scheduled").length;
		const ready = offers.filter((o) => o.status === "ready" || (o.scheduledAt && o.scheduledAt <= now && o.status !== "sent" && o.status !== "canceled")).length;
		const sent = offers.filter((o) => o.status === "sent").length;
		$("st-scheduled").textContent = scheduled;
		$("st-ready").textContent = ready;
		$("st-coupons").textContent = coupons.length;
		$("st-sent").textContent = sent;

		const due = offers.filter((o) => o.scheduledAt && o.scheduledAt <= now && o.status !== "sent" && o.status !== "canceled");
		const box = $("due-list");
		if (!due.length) {
			box.innerHTML = '<div class="empty"><div class="big">✅</div>Nada pendente agora.</div>';
		} else {
			box.innerHTML = "";
			due.forEach((o) => box.appendChild(renderOffer(o, now)));
		}
	} catch (e) {
		$("due-list").innerHTML = `<p class="error">${escapeHtml(e.message)}</p>`;
	}
}

// ---------- fonte ----------
$("offerType").addEventListener("change", () => {
	$("cupom-fields").classList.toggle("show", $("offerType").value === "cupom");
});
$("source").addEventListener("change", updateSourceUI);

async function updateSourceUI() {
	const src = $("source").value;
	const collect = $("source-collect");
	const hint = $("source-hint");
	if (src === "manual") {
		collect.hidden = true;
		hint.textContent = "Cole os dados do produto abaixo (ou extraídos de um print).";
		return;
	}
	collect.hidden = false;
	try {
		const { sources } = await api("/api/sources");
		const s = sources.find((x) => x.id === src);
		hint.innerHTML = s && s.configured
			? '<span class="pill ok">Configurado</span> Pronto para coletar.'
			: '<span class="pill no">Sem credenciais</span> Configure os secrets no Worker (README). A coleta manual segue funcionando.';
	} catch (e) {
		hint.textContent = e.message;
	}
}

$("btn-collect").addEventListener("click", async () => {
	const src = $("source").value;
	const keyword = $("src-keyword").value.trim();
	const box = $("collect-results");
	box.innerHTML = '<p class="hint">Coletando…</p>';
	try {
		const q = keyword ? `?keyword=${encodeURIComponent(keyword)}` : "";
		const { offers } = await api(`/api/sources/${src}/offers${q}`);
		if (!offers.length) { box.innerHTML = '<p class="hint">Nenhuma oferta retornada.</p>'; return; }
		box.innerHTML = "";
		offers.forEach((o) => {
			const div = document.createElement("div");
			div.className = "item";
			div.innerHTML = `<strong>${escapeHtml(o.productName)}</strong>
				<div class="meta"><span>R$ ${o.price}</span>${o.oldPrice ? `<span>de R$ ${o.oldPrice}</span>` : ""}<span>${o.platform}</span><span>${o.category || ""}</span></div>`;
			const btn = document.createElement("button");
			btn.className = "btn secondary";
			btn.textContent = "Usar esta oferta";
			btn.onclick = () => fillFormFromOffer(o);
			div.appendChild(btn);
			box.appendChild(div);
		});
	} catch (e) {
		box.innerHTML = `<p class="error">${escapeHtml(e.message)}</p>`;
	}
});

function fillFormFromOffer(o) {
	$("productName").value = o.productName || "";
	$("price").value = o.price != null ? String(o.price).replace(".", ",") : "";
	$("oldPrice").value = o.oldPrice != null ? String(o.oldPrice).replace(".", ",") : "";
	$("link").value = o.link || "";
	$("platform").value = o.platform || "";
	$("offerType").value = o.offerType || "padrao";
	$("category").value = o.category || "generico";
	$("freeShipping").checked = !!o.freeShipping;
	$("cupom-fields").classList.toggle("show", $("offerType").value === "cupom");
	setStep(2);
	toast("Oferta carregada");
	$("productName").scrollIntoView({ behavior: "smooth", block: "center" });
}

// ---------- montar payload ----------
function buildOffer() {
	const offer = {
		productName: $("productName").value.trim(),
		price: parseMoney($("price").value),
		oldPrice: parseMoney($("oldPrice").value),
		link: $("link").value.trim(),
		platform: $("platform").value || undefined,
		offerType: $("offerType").value,
		category: $("category").value,
		freeShipping: $("freeShipping").checked,
		source: $("source").value,
	};
	if (offer.offerType === "cupom") {
		const code = $("couponCode").value.trim();
		const offValue = $("couponValue").value.trim();
		const description = $("couponDesc").value.trim();
		if (code || offValue) {
			offer.coupon = {};
			if (code) offer.coupon.code = code;
			if (offValue) offer.coupon.offValue = offValue;
			if (description) offer.coupon.description = description;
		}
	}
	return offer;
}

// ---------- gerar ----------
$("btn-generate").addEventListener("click", async () => {
	$("gen-error").textContent = "";
	try {
		const offer = buildOffer();
		const ad = await api("/api/generate", { method: "POST", body: JSON.stringify(offer) });
		currentVariations = ad.variations;
		selectedIndex = 0;
		renderVariations();
		showAppliedCoupon(ad.appliedCoupon, ad.offer);
		$("variations-card").hidden = false;
		$("schedule-card").hidden = false;
		setStep(4);
		$("variations-card").scrollIntoView({ behavior: "smooth", block: "start" });
	} catch (e) {
		$("gen-error").textContent = e.message;
	}
});

function showAppliedCoupon(coupon, offer) {
	const box = $("applied-coupon");
	if (coupon && (coupon.code || coupon.offValue)) {
		const label = coupon.code || `${coupon.offValue} OFF ${coupon.description || "TODAS AS LOJAS"}`;
		box.innerHTML = `🎟️ Cupom aplicado: <strong>${escapeHtml(label)}</strong> (${offer?.platform || ""})`;
		box.hidden = false;
	} else {
		box.hidden = true;
	}
}

function renderVariations() {
	const box = $("variations");
	box.innerHTML = "";
	currentVariations.forEach((text, i) => {
		const wa = document.createElement("div");
		wa.className = "wa" + (i === selectedIndex ? " selected" : "");
		wa.innerHTML = `
			<div class="wa-head">
				<span class="tag">Variação ${i + 1} · ${VARIATION_TAGS[i] || ""}</span>
				<span class="pick">${i === selectedIndex ? "✓ escolhida" : "escolher"}</span>
			</div>
			<div class="wa-body">
				<div class="bubble">${waFormat(text)}<span class="time">${nowTime()} ✓✓</span></div>
			</div>
			<div class="wa-foot"></div>`;
		const copy = document.createElement("button");
		copy.className = "btn ghost";
		copy.textContent = "Copiar";
		copy.style.fontSize = "0.8rem";
		copy.onclick = (ev) => { ev.stopPropagation(); copyText(text); };
		wa.querySelector(".wa-foot").appendChild(copy);
		wa.onclick = () => { selectedIndex = i; renderVariations(); };
		box.appendChild(wa);
	});
}

// ---------- agendar / salvar ----------
async function save(schedule) {
	$("save-error").textContent = "";
	try {
		if (!currentVariations.length) throw new Error("Gere as variações primeiro.");
		const offer = buildOffer();
		offer.variations = currentVariations;
		offer.selectedIndex = selectedIndex;
		offer.groups = $("groups").value.split(",").map((s) => s.trim()).filter(Boolean);
		if (schedule) {
			const dt = $("scheduledAt").value;
			if (!dt) throw new Error("Escolha a data e hora do disparo.");
			offer.scheduledAt = new Date(dt).getTime();
		} else {
			offer.scheduledAt = null;
		}
		await api("/api/offers", { method: "POST", body: JSON.stringify(offer) });
		toast(schedule ? "Oferta agendada! 📅" : "Rascunho salvo");
		if (schedule) resetForm();
	} catch (e) {
		$("save-error").textContent = e.message;
	}
}
$("btn-schedule").addEventListener("click", () => save(true));
$("btn-draft").addEventListener("click", () => save(false));

function resetForm() {
	["productName", "price", "oldPrice", "link", "groups", "couponCode", "couponValue", "couponDesc", "scheduledAt", "src-keyword"].forEach((id) => ($(id).value = ""));
	$("freeShipping").checked = false;
	currentVariations = [];
	$("variations-card").hidden = true;
	$("schedule-card").hidden = true;
	setStep(1);
}

// ---------- agenda ----------
let currentFilter = null;
$("btn-refresh").addEventListener("click", loadOffers);
$("btn-filter-due").addEventListener("click", () => { currentFilter = "due"; loadOffers(); });
$("btn-filter-all").addEventListener("click", () => { currentFilter = null; loadOffers(); });

async function loadOffers() {
	const box = $("offers-list");
	box.innerHTML = '<p class="hint">Carregando…</p>';
	try {
		const path = currentFilter === "due" ? "/api/offers?due=1" : "/api/offers";
		const { offers } = await api(path);
		if (!offers.length) { box.innerHTML = '<div class="empty"><div class="big">📭</div>Nenhuma oferta ainda.</div>'; return; }
		box.innerHTML = "";
		const now = Date.now();
		offers.forEach((o) => box.appendChild(renderOffer(o, now)));
	} catch (e) {
		box.innerHTML = `<p class="error">${escapeHtml(e.message)}</p>`;
	}
}

function renderOffer(o, now) {
	const due = o.scheduledAt && o.scheduledAt <= now && o.status !== "sent" && o.status !== "canceled";
	const div = document.createElement("div");
	div.className = "item" + (due ? " due" : "");
	const when = o.scheduledAt ? new Date(o.scheduledAt).toLocaleString("pt-BR") : "—";
	const msg = o.variations[o.selectedIndex] || o.variations[0] || "";
	div.innerHTML = `
		<div class="row" style="justify-content:space-between">
			<strong>${escapeHtml(o.productName)}</strong>
			<span class="pill ${o.status}">${statusLabel(o.status)}${due ? " · agora" : ""}</span>
		</div>
		<div class="meta"><span>🕒 ${when}</span><span>${o.platform}</span><span>${o.groups.length ? "👥 " + escapeHtml(o.groups.join(", ")) : "sem grupos"}</span></div>
		<div class="bubble" style="max-width:100%">${waFormat(msg)}</div>`;
	const actions = document.createElement("div");
	actions.className = "actions";
	actions.appendChild(mkBtn("Copiar", "secondary", () => copyText(msg)));
	if (o.status !== "sent") actions.appendChild(mkBtn("Marcar enviada", "ghost", () => markSent(o.id)));
	actions.appendChild(mkBtn("Excluir", "danger", () => removeOffer(o.id)));
	div.appendChild(actions);
	return div;
}

function mkBtn(label, cls, fn) {
	const b = document.createElement("button");
	b.className = "btn " + cls;
	b.style.fontSize = "0.82rem";
	b.textContent = label;
	b.onclick = fn;
	return b;
}
function statusLabel(s) {
	return { draft: "Rascunho", scheduled: "Agendada", ready: "Pronta", sent: "Enviada", canceled: "Cancelada" }[s] || s;
}
async function markSent(id) {
	await api(`/api/offers/${id}`, { method: "PATCH", body: JSON.stringify({ markSent: true }) });
	toast("Marcada como enviada");
	loadOffers();
}
async function removeOffer(id) {
	if (!confirm("Excluir esta oferta?")) return;
	await api(`/api/offers/${id}`, { method: "DELETE" });
	toast("Excluída");
	loadOffers();
}

// ---------- cupons ----------
$("btn-add-coupon").addEventListener("click", async () => {
	$("coupon-error").textContent = "";
	try {
		const text = $("coupon-text").value.trim();
		if (!text) throw new Error("Cole o texto do cupom.");
		const platform = $("coupon-platform").value || undefined;
		await api("/api/coupons", { method: "POST", body: JSON.stringify({ text, platform }) });
		$("coupon-text").value = "";
		toast("Cupom salvo");
		loadCoupons();
	} catch (e) {
		$("coupon-error").textContent = e.message;
	}
});
$("btn-refresh-coupons").addEventListener("click", loadCoupons);

async function loadCoupons() {
	const box = $("coupons-list");
	box.innerHTML = '<p class="hint">Carregando…</p>';
	try {
		const { coupons } = await api("/api/coupons");
		if (!coupons.length) { box.innerHTML = '<div class="empty"><div class="big">🎟️</div>Nenhum cupom. Cole um acima ou conecte o coletor do Telegram.</div>'; return; }
		box.innerHTML = "";
		coupons.forEach((c) => box.appendChild(renderCoupon(c)));
	} catch (e) {
		box.innerHTML = `<p class="error">${escapeHtml(e.message)}</p>`;
	}
}
function renderCoupon(c) {
	const div = document.createElement("div");
	div.className = "item";
	const label = c.code || (c.offValue ? `${c.offValue} OFF ${c.description || "TODAS AS LOJAS"}` : "—");
	const flags = [
		c.platform || "qualquer plataforma",
		c.isFlash ? "⚡ relâmpago" + (c.validUntil ? " até " + c.validUntil : "") : null,
		"via " + (c.source || "manual") + (c.channel ? " · " + c.channel : ""),
	].filter(Boolean);
	div.innerHTML = `
		<div class="row" style="justify-content:space-between">
			<strong>${escapeHtml(label)}</strong>
			<span class="pill ${c.active ? "ok" : "no"}">${c.active ? "ativo" : "inativo"}</span>
		</div>
		<div class="meta">${flags.map((f) => `<span>${escapeHtml(f)}</span>`).join("")}</div>`;
	const actions = document.createElement("div");
	actions.className = "actions";
	actions.appendChild(mkBtn(c.active ? "Desativar" : "Ativar", "ghost", () => toggleCoupon(c.id, !c.active)));
	actions.appendChild(mkBtn("Excluir", "danger", () => removeCoupon(c.id)));
	div.appendChild(actions);
	return div;
}
async function toggleCoupon(id, active) {
	await api(`/api/coupons/${id}`, { method: "PATCH", body: JSON.stringify({ active }) });
	loadCoupons();
}
async function removeCoupon(id) {
	if (!confirm("Excluir este cupom?")) return;
	await api(`/api/coupons/${id}`, { method: "DELETE" });
	toast("Excluído");
	loadCoupons();
}

// ---------- init ----------
["productName", "price", "link"].forEach((id) => $(id).addEventListener("input", () => { if (currentVariations.length === 0) setStep(2); }));
updateSourceUI();
loadDashboard();
