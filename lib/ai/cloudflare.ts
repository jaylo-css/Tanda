import { AI_CONFIG } from "./config";
import { AiError, scrub, type AiProvider, type GenerateRequest } from "./provider";

/**
 * Cloudflare Workers AI fallback (@cf/meta/llama-3.2-11b-vision-instruct), via REST.
 * Server-side only. Free allocation: 10,000 neurons/day.
 *
 * LIVE-TESTED 2026-11-02 against a real account: works, but it is a LAST RESORT.
 *  - 22-41 s per prescription (vs ~4 s for Gemini), so the route gives it all remaining time
 *  - reads are less accurate (wrong year on the messy sample) and it reports 1.0 confidence on
 *    everything, so lib/ai/extract.ts caps its confidence and the review screen warns the user
 *  - cost: ~60-100 of the 10,000 free neurons per prescription
 * The first call may need the one-time Meta licence acceptance, handled below
 * (error code 5016 -> send "agree" once, then retry).
 */
export class CloudflareProvider implements AiProvider {
  readonly name = "cloudflare";

  constructor(
    private readonly accountId: string,
    private readonly apiToken: string,
    private readonly model: string = AI_CONFIG.cloudflare.model,
  ) {}

  private url(): string {
    return `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/${this.model}`;
  }

  private async post(body: unknown, timeoutMs: number): Promise<Response> {
    try {
      return await fetch(this.url(), {
        method: "POST",
        headers: { authorization: `Bearer ${this.apiToken}`, "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      const name = (e as { name?: string }).name;
      if (name === "TimeoutError" || name === "AbortError") throw new AiError("timeout", "Cloudflare timed out");
      throw new AiError("network", scrub(String((e as Error).message), this.apiToken, this.accountId));
    }
  }

  async generate(req: GenerateRequest): Promise<string> {
    const content: Array<Record<string, unknown>> = [{ type: "text", text: req.prompt }];
    if (req.image) {
      content.push({ type: "image_url", image_url: { url: `data:${req.image.mimeType};base64,${req.image.base64}` } });
    }
    const base = { messages: [{ role: "user", content }], max_tokens: 1800, temperature: 0 };
    // Measured 2026-11-02: without a schema this model answers in prose ("The image is a photo of...")
    // and takes ~40 s; with json_schema it returns a clean JSON object.
    const body = req.jsonSchema ? { ...base, response_format: { type: "json_schema", json_schema: req.jsonSchema } } : base;

    let res = await this.post(body, req.timeoutMs);
    let payload = (await res.json().catch(() => ({}))) as CfResponse;
    // if the schema itself is rejected, try once more without it (parsing/validation still protect us)
    if (res.status === 400 && req.jsonSchema) {
      res = await this.post(base, req.timeoutMs);
      payload = (await res.json().catch(() => ({}))) as CfResponse;
    }

    // first use of this model: accept Meta's licence once, then retry
    if (!res.ok && payload.errors?.some((e) => e.code === 5016)) {
      await this.post({ prompt: "agree" }, Math.min(req.timeoutMs, 8_000));
      res = await this.post(body, req.timeoutMs);
      payload = (await res.json().catch(() => ({}))) as CfResponse;
    }

    if (!res.ok || payload.success === false) {
      const msg = scrub(JSON.stringify(payload.errors ?? payload), this.apiToken, this.accountId);
      const kind = res.status === 429 ? "quota" : res.status === 401 || res.status === 403 ? "auth" : "http";
      throw new AiError(kind, `cloudflare HTTP ${res.status}: ${msg}`, res.status);
    }
    const r = payload.result?.response;
    const text = (typeof r === "string" ? r : r === undefined ? "" : JSON.stringify(r)).trim();
    if (!text) throw new AiError("empty", "cloudflare returned no text");
    return text;
  }
}

interface CfResponse {
  success?: boolean;
  errors?: Array<{ code: number; message?: string }>;
  result?: { response?: unknown };
}
