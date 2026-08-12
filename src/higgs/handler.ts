/**
 * Higgs Studio — rotas da API de geração (servidas pelo Worker).
 *   POST /api/higgs/generate  -> cria os jobs e devolve os ids (não espera)
 *   GET  /api/higgs/status?ids=a,b,c -> status + URL de cada job
 *   GET  /api/higgs/config    -> config pública (sem segredos) p/ o dashboard
 *
 * O front faz o poll do /status e vai exibindo os resultados conforme saem.
 */
import cfg from "../../higgs-studio/config.json";
import { buildImagePrompt, type ProductCfg, type ExpertCfg } from "./prompt";
import { createImageJob, getJob, type HiggsEnv } from "./higgsfield";

interface GenerateBody {
  expert?: string;
  product?: string;
  formats?: string[];
  copies?: string[];
  model?: string;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function hasKeys(env: HiggsEnv): boolean {
  return Boolean(env.HIGGSFIELD_API_KEY && env.HIGGSFIELD_API_SECRET);
}

export async function higgsGenerate(request: Request, env: HiggsEnv): Promise<Response> {
  if (!hasKeys(env)) {
    return json({ error: "Higgsfield API key não configurada. Defina os secrets HIGGSFIELD_API_KEY e HIGGSFIELD_API_SECRET (ver README)." }, 503);
  }
  let body: GenerateBody;
  try {
    body = (await request.json()) as GenerateBody;
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  const products = (cfg as any).products as Record<string, ProductCfg>;
  const experts = (cfg as any).experts as Record<string, ExpertCfg>;
  const engine = (cfg as any).engine;

  const product = products[body.product || ""];
  const expert = experts[body.expert || "LIVRE"] || experts["LIVRE"];
  if (!product) return json({ error: `Produto desconhecido: ${body.product}` }, 400);

  const copies = (body.copies || []).map((c) => c.trim()).filter(Boolean);
  if (!copies.length) return json({ error: "Nenhuma copy enviada" }, 400);

  const formats = body.formats && body.formats.length ? body.formats : ["1:1", "9:16", "4:5"];
  const model = body.model || engine.model || "soul";

  // referências: rostos do expert + logo do produto (por URL pública)
  const imageUrls = [
    ...expert.refs.map((r) => r.url).filter(Boolean),
    product.logo?.url,
  ].filter(Boolean) as string[];

  const jobs: { copy: number; format: string; id?: string; error?: string }[] = [];
  for (let i = 0; i < copies.length; i++) {
    const prompt = buildImagePrompt(product, expert, copies[i]);
    for (const format of formats) {
      try {
        const id = await createImageJob(env, {
          model,
          prompt,
          aspect_ratio: format,
          quality: engine.quality,
          resolution: engine.resolution,
          imageUrls,
        });
        jobs.push({ copy: i + 1, format, id });
      } catch (e: any) {
        jobs.push({ copy: i + 1, format, error: String(e?.message || e) });
      }
    }
  }
  return json({ ok: true, model, expert: body.expert || "LIVRE", product: body.product, jobs });
}

export async function higgsStatus(request: Request, env: HiggsEnv): Promise<Response> {
  if (!hasKeys(env)) return json({ error: "sem chave" }, 503);
  const ids = (new URL(request.url).searchParams.get("ids") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!ids.length) return json({ error: "sem ids" }, 400);
  const out: Record<string, unknown> = {};
  for (const id of ids) {
    try {
      out[id] = await getJob(env, id);
    } catch (e: any) {
      out[id] = { status: "unknown", error: String(e?.message || e) };
    }
  }
  return json({ ok: true, jobs: out });
}

/** Config pública (sem segredos) para o dashboard montar os seletores. */
export function higgsConfig(): Response {
  const c = cfg as any;
  const products = Object.fromEntries(
    Object.entries(c.products).map(([k, v]: any) => [
      k,
      { label: v.label, colors: v.colors, tone: v.tone, hasLogo: Boolean(v.logo) },
    ]),
  );
  const experts = Object.fromEntries(
    Object.entries(c.experts).map(([k, v]: any) => [k, { label: v.label, refs: v.refs.length }]),
  );
  return json({ engine: { model: c.engine.model, quality: c.engine.quality, resolution: c.engine.resolution, formats: c.engine.formats }, products, experts });
}
