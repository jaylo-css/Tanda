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
     * LIVE-TESTED 2026-11-02 with `node scripts/check-models.mjs` (sample prescription image):
     *   gemini-3.6-flash      OK, ~2.5 s, image input works  <- primary
     *   gemini-3.5-flash-lite OK, ~1.8 s, image input works  <- fallback
     *   gemini-3.8-flash      listed as "New Stable" but TIMED OUT (>40 s) three times
     *                         for this key, so it cannot meet the 15 s demo budget.
     * Re-run the script before the demo; swap the order here if 3.8 starts answering.
     */
    model: "gemini-3.6-flash",
    /**
     * Tried in order if the preferred model errors (404, quota, overload, timeout).
     * (gemini-3.1-flash-lite shuts down 2027-05-07 and 2.0 models are already shut down,
     * so they are intentionally not listed.)
     */
    fallbackModels: ["gemini-3.5-flash-lite"],
    /** Per-model cap so one slow model cannot eat the whole 15 s budget. */
    perModelTimeoutMs: 9_000,
    /**
     * Transcription needs no reasoning. Measured on 2026-11-02 (sample 2, gemini-3.6-flash):
     * default thinking = 6-10 s (600-1,400 hidden tokens), "minimal" = 3.6 s, same output.
     * `thinkingBudget: 0` is rejected by gemini-3.5-flash-lite, `thinkingLevel` works on both.
     */
    thinkingLevel: "minimal",
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
    /** Give up on the AI and use demo data after this long (spec: 15 s). Applies to SAMPLE images. */
    requestTimeoutMs: 15_000,
    /**
     * Real uploads (no demo data to fall back on) get longer: if Gemini is down, the Cloudflare
     * backup needs 22-41 s (measured). Samples keep the 15 s limit above, then use saved data.
     */
    uploadTimeoutMs: 50_000,
    /** Box-label photos are a helper; separate, looser bucket than prescriptions. */
    boxRequestsPerHourPerIp: 20,
    /** Largest image the server accepts, after client-side resize (bytes). */
    maxImageBytes: 4 * 1024 * 1024,
    /** Longest side after client-side resize (px). */
    maxImageDimension: 2000,
  },

  /** Share links expire after this many days (Data Privacy Act: keep the minimum). */
  shareLinkTtlDays: 30,
} as const;

export type AiConfig = typeof AI_CONFIG;
