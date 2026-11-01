/**
 * Provider interface for the vision/text model. Server-side only: API keys must
 * never reach the browser. Implementations: gemini.ts (primary), cloudflare.ts (fallback).
 *
 * A provider only returns raw text. Parsing, validation and retries live in
 * extract.ts, so every provider is held to the same strict JSON contract.
 */

export interface ImageInput {
  mimeType: string;
  /** Base64 without the "data:" prefix. */
  base64: string;
}

export interface GenerateRequest {
  prompt: string;
  image?: ImageInput;
  /** Ask the model for JSON only (provider-specific where supported). */
  json?: boolean;
  /** JSON Schema of the expected answer. Used by providers that have a schema-constrained JSON mode (Cloudflare). */
  jsonSchema?: Record<string, unknown>;
  /** Hard cap for this call. */
  timeoutMs: number;
}

export type AiErrorKind = "timeout" | "quota" | "auth" | "http" | "empty" | "network" | "unavailable";

export class AiError extends Error {
  constructor(
    public readonly kind: AiErrorKind,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "AiError";
  }
}

export interface AiProvider {
  readonly name: string;
  generate(req: GenerateRequest): Promise<string>;
}

/** Removes anything that looks like a secret before it can reach a log line. */
export function scrub(text: string, ...secrets: Array<string | undefined>): string {
  let out = text;
  for (const s of secrets) if (s) out = out.split(s).join("***");
  return out.slice(0, 300);
}

/**
 * Tries providers in order until one returns text. Stops early when the deadline passes.
 * Returns which provider answered, so the UI can be honest about it.
 */
export async function generateWithFallback(
  providers: AiProvider[],
  req: Omit<GenerateRequest, "timeoutMs">,
  deadlineAt: number,
  perCallMs: number,
): Promise<{ text: string; provider: string }> {
  if (providers.length === 0) throw new AiError("unavailable", "No AI provider is configured");
  let last: unknown;
  for (let i = 0; i < providers.length; i++) {
    const p = providers[i];
    const remaining = deadlineAt - Date.now();
    if (remaining < 1_500) break;
    // The LAST provider is the final chance, so it may use all the time that is left; earlier ones
    // are capped so a slow one cannot starve the fallback.
    const isLast = i === providers.length - 1;
    try {
      const text = await p.generate({ ...req, timeoutMs: isLast ? remaining : Math.min(perCallMs, remaining) });
      return { text, provider: p.name };
    } catch (e) {
      last = e;
    }
  }
  if (last instanceof AiError) throw last;
  throw new AiError("timeout", "AI did not answer in time");
}
