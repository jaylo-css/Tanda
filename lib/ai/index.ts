import { CloudflareProvider } from "./cloudflare";
import { GeminiProvider } from "./gemini";
import type { AiProvider } from "./provider";

/** Builds the provider chain from environment variables. Server-side only. Gemini first, Cloudflare fallback. */
export function getProviders(env: Record<string, string | undefined> = process.env): AiProvider[] {
  const providers: AiProvider[] = [];
  if (env.GEMINI_API_KEY) providers.push(new GeminiProvider(env.GEMINI_API_KEY));
  if (env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN) {
    providers.push(new CloudflareProvider(env.CLOUDFLARE_ACCOUNT_ID, env.CLOUDFLARE_API_TOKEN));
  }
  return providers;
}

export { AiError, generateWithFallback } from "./provider";
export type { AiProvider, ImageInput } from "./provider";
