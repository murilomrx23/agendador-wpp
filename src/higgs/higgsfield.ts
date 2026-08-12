/**
 * Higgs Studio — cliente da API REST do Higgsfield.
 *
 * ⚠️ CONFIRMAR CONTRA A DOC OFICIAL (docs.higgsfield.ai) NO PRIMEIRO DEPLOY.
 * O ambiente de desenvolvimento não tem acesso de rede ao Higgsfield, então o
 * mapeamento exato de endpoints/campos foi escrito a partir do padrão público
 * documentado (auth por headers hf-api-key + hf-secret; fluxo assíncrono
 * job-set -> poll -> URL do resultado). Tudo que pode variar está isolado aqui
 * e é sobreponível por variáveis de ambiente:
 *   HIGGSFIELD_API_BASE   (default https://platform.higgsfield.ai)
 *   HIGGSFIELD_API_KEY    (o "ID da chave da API")   -> header hf-api-key
 *   HIGGSFIELD_API_SECRET (o "Segredo da chave")     -> header hf-secret
 *   HIGGSFIELD_PATH_IMAGE (default /v1/text2image/{model})
 *   HIGGSFIELD_PATH_JOBSET(default /v1/job-sets/{id})
 */

export interface HiggsEnv {
  HIGGSFIELD_API_KEY?: string;
  HIGGSFIELD_API_SECRET?: string;
  HIGGSFIELD_API_BASE?: string;
  HIGGSFIELD_PATH_IMAGE?: string;
  HIGGSFIELD_PATH_JOBSET?: string;
}

export interface ImageJobParams {
  model: string; // ex.: "soul" ou "gpt_image_2" (se exposto na API)
  prompt: string;
  aspect_ratio: string; // "1:1" | "9:16" | "4:5" ...
  quality?: string; // "low" | "medium" | "high"
  resolution?: string; // "1k" | "2k" | "4k"
  imageUrls?: string[]; // referências (rostos/logo) por URL pública
}

function base(env: HiggsEnv): string {
  return (env.HIGGSFIELD_API_BASE || "https://platform.higgsfield.ai").replace(/\/$/, "");
}

function authHeaders(env: HiggsEnv): Record<string, string> {
  // Higgsfield usa dois headers: id + segredo. Mantido explícito p/ facilitar ajuste.
  return {
    "hf-api-key": env.HIGGSFIELD_API_KEY || "",
    "hf-secret": env.HIGGSFIELD_API_SECRET || "",
    "Content-Type": "application/json",
  };
}

/** Submete um job de imagem e retorna o id do job-set. */
export async function createImageJob(env: HiggsEnv, p: ImageJobParams): Promise<string> {
  const path = (env.HIGGSFIELD_PATH_IMAGE || "/v1/text2image/{model}").replace("{model}", p.model);
  // Corpo no formato "params" (padrão Higgsfield). CONFIRMAR nomes exatos.
  const body = {
    params: {
      prompt: p.prompt,
      aspect_ratio: p.aspect_ratio,
      quality: p.quality ?? "medium",
      resolution: p.resolution ?? "2k",
      ...(p.imageUrls && p.imageUrls.length
        ? { image_urls: p.imageUrls, input_images: p.imageUrls }
        : {}),
    },
  };
  const res = await fetch(base(env) + path, {
    method: "POST",
    headers: authHeaders(env),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Higgsfield create ${res.status}: ${await safeText(res)}`);
  }
  const data: any = await res.json();
  const id = data?.id || data?.job_set_id || data?.jobSetId || data?.job_id;
  if (!id) throw new Error(`Higgsfield create: sem id no retorno: ${JSON.stringify(data).slice(0, 400)}`);
  return String(id);
}

export interface JobResult {
  status: "queued" | "in_progress" | "completed" | "failed" | "nsfw" | "unknown";
  url?: string;
}

/** Consulta o status de um job-set e extrai a URL do resultado quando pronto. */
export async function getJob(env: HiggsEnv, id: string): Promise<JobResult> {
  const path = (env.HIGGSFIELD_PATH_JOBSET || "/v1/job-sets/{id}").replace("{id}", id);
  const res = await fetch(base(env) + path, { headers: authHeaders(env) });
  if (!res.ok) throw new Error(`Higgsfield status ${res.status}: ${await safeText(res)}`);
  const data: any = await res.json();
  const job = data?.jobs?.[0] ?? data;
  const status = String(job?.status || data?.status || "unknown").toLowerCase();
  const url =
    job?.results?.raw?.url ||
    job?.results?.rawUrl ||
    job?.result_url ||
    job?.results?.[0]?.url ||
    data?.result_url;
  const norm: JobResult["status"] =
    status === "completed" || status === "success" || status === "done"
      ? "completed"
      : status === "failed" || status === "error"
        ? "failed"
        : status === "nsfw"
          ? "nsfw"
          : status === "in_progress" || status === "processing" || status === "running"
            ? "in_progress"
            : status === "queued" || status === "pending"
              ? "queued"
              : "unknown";
  return { status: norm, url };
}

/** Faz poll até terminar (ou timeout). Intervalo em ms. */
export async function waitJob(
  env: HiggsEnv,
  id: string,
  { timeoutMs = 120000, intervalMs = 3000 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<JobResult> {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const r = await getJob(env, id);
    if (r.status === "completed" || r.status === "failed" || r.status === "nsfw") return r;
    if (Date.now() - start > timeoutMs) return { status: "unknown" };
    await new Promise((res) => setTimeout(res, intervalMs));
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 400);
  } catch {
    return "<sem corpo>";
  }
}
