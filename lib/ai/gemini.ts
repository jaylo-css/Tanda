import { AI_CONFIG } from "./config";
import { AiError, scrub, type AiProvider, type GenerateRequest } from "./provider";

/** Google Gemini via the REST API (no SDK, so nothing to break when SDKs change). Server-side only. */
export class GeminiProvider implements AiProvider {
  readonly name = "gemini";
  private readonly models: string[];

  constructor(
    private readonly apiKey: string,
    models: readonly string[] = [AI_CONFIG.gemini.model, ...AI_CONFIG.gemini.fallbackModels],
  ) {
    this.models = [...models];
  }

  async generate(req: GenerateRequest): Promise<string> {
    const started = Date.now();
    let last: unknown;
    for (const model of this.models) {
      const left = req.timeoutMs - (Date.now() - started);
      if (left < 1_200) break;
      try {
        return await this.callModel(model, req, Math.min(left, AI_CONFIG.gemini.perModelTimeoutMs));
      } catch (e) {
        last = e;
        // a bad key will not get better on another model
        if (e instanceof AiError && e.kind === "auth") break;
      }
    }
    throw last instanceof AiError ? last : new AiError("network", "Gemini call failed");
  }

  private async callModel(model: string, req: GenerateRequest, timeoutMs: number): Promise<string> {
    const parts: Array<Record<string, unknown>> = [{ text: req.prompt }];
    if (req.image) parts.push({ inline_data: { mime_type: req.image.mimeType, data: req.image.base64 } });

    const post = async (withThinking: boolean): Promise<Response> => {
      try {
        return await fetch(`${AI_CONFIG.gemini.endpoint}/models/${model}:generateContent`, {
          method: "POST",
          // key in a header (not the URL) so it never lands in logs
          headers: { "x-goog-api-key": this.apiKey, "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts }],
            generationConfig: {
              temperature: 0,
              ...(req.json ? { responseMimeType: "application/json" } : {}),
              ...(withThinking ? { thinkingConfig: { thinkingLevel: AI_CONFIG.gemini.thinkingLevel } } : {}),
            },
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (e) {
        const name = (e as { name?: string }).name;
        if (name === "TimeoutError" || name === "AbortError") throw new AiError("timeout", `${model} timed out`);
        throw new AiError("network", scrub(String((e as Error).message), this.apiKey));
      }
    };

    let res = await post(true);
    // a model that does not know thinkingLevel answers 400: try once more without it
    if (res.status === 400) res = await post(false);

    if (!res.ok) {
      const body = scrub(await res.text().catch(() => ""), this.apiKey);
      const kind = res.status === 429 ? "quota" : res.status === 401 || res.status === 403 ? "auth" : "http";
      throw new AiError(kind, `${model} HTTP ${res.status}: ${body}`, res.status);
    }

    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
    if (!text) throw new AiError("empty", `${model} returned no text`);
    return text;
  }
}
