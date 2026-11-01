/**
 * Single source of truth for AI provider settings.
 *
 * Verified on 2026-11-02 against Google's official pages
 * (ai.google.dev/gemini-api/docs/models, /pricing, /deprecations, /rate-limits).
 * Re-check these before the demo: model names and free quotas change often.
 *
 * Nothing here is a secret. API keys live only in .env.local (server-side).
 */

export const AI_CONFIG = {
  /** When the page was last checked against the official docs. */
  verifiedOn: "2026-11-02",

  gemini: {
    /**
     * Preferred model for reading prescriptions and medicine boxes.
     * gemini-3.8-flash: "New Stable" Flash model, free of charge on the free tier.
     * NOTE: Google's docs do not state image input per model. Confirm with
     * `npm run check:models` (calls ListModels with your key) before relying on it.
     */
    model: "gemini-3.8-flash",
    /**
     * Tried in order if the preferred model errors (404, quota, overload).
     * - gemini-3.6-flash: previous stable Flash.
     * - gemini-3.5-flash-lite: cheaper/faster Flash-Lite; lower accuracy on handwriting.
     * (gemini-3.1-flash-lite shuts down 2027-05-07 and 2.0 models are already shut down,
     * so they are intentionally not listed.)
     */
    fallbackModels: ["gemini-3.6-flash", "gemini-3.5-flash-lite"],
    endpoint: "https://generativelanguage.googleapis.com/v1beta",
    /**
     * Google publishes NO free-tier numbers in its docs; each project's real
     * limits are shown in Google AI Studio -> Rate limits. These are Tanda's own
     * conservative guard rails, not Google's quota.
     */
    freeTierNote:
      "Free-tier limits are per Google project and visible in AI Studio. Free-tier prompts may be used by Google to improve its products.",
  },

  cloudflare: {
    /** Fallback vision model on Workers AI. */
    model: "@cf/meta/llama-3.2-11b-vision-instruct",
    /**
     * Free allocation: 10,000 neurons/day (resets 00:00 UTC), shared across models.
     * This model costs ~4,410 neurons per 1M input tokens and ~61,493 per 1M output tokens.
     * First use of this model may require accepting Meta's Llama 3.2 licence.
     */
    freeNeuronsPerDay: 10_000,
  },

  /** Hard limits protecting the free quotas. */
  limits: {
    /** Per-IP limit on the AI routes (spec: 10 requests per hour per IP). */
    requestsPerHourPerIp: 10,
    /** Give up on the AI and use demo data after this long (spec: 15 s). */
    requestTimeoutMs: 15_000,
    /** Largest image the server accepts, after client-side resize (bytes). */
    maxImageBytes: 4 * 1024 * 1024,
    /** Longest side after client-side resize (px). */
    maxImageDimension: 2000,
  },

  /** Share links expire after this many days (Data Privacy Act: keep the minimum). */
  shareLinkTtlDays: 30,
} as const;

export type AiConfig = typeof AI_CONFIG;
