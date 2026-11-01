/**
 * Sliding-window rate limiter (spec: 10 AI requests per hour per IP).
 *
 * In-memory on purpose (free tier, no extra service). On Vercel each warm server
 * instance keeps its own counter, so the real limit can be looser than the setting
 * under heavy traffic. That is fine for a prototype: it still protects the free AI
 * quota from a single noisy client. Documented in the README.
 */

export interface LimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the oldest request leaves the window (only meaningful when blocked). */
  retryAfterSec: number;
}

const buckets = new Map<string, number[]>();
const MAX_KEYS = 5_000;

export function checkRateLimit(key: string, limit: number, windowMs: number, now: number = Date.now()): LimitResult {
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return { allowed: false, remaining: 0, retryAfterSec: Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1000)) };
  }
  hits.push(now);
  buckets.set(key, hits);
  // keep memory bounded
  if (buckets.size > MAX_KEYS) {
    for (const [k, v] of buckets) {
      if (v.every((t) => now - t >= windowMs)) buckets.delete(k);
      if (buckets.size <= MAX_KEYS * 0.8) break;
    }
  }
  return { allowed: true, remaining: limit - hits.length, retryAfterSec: 0 };
}

export function resetRateLimits(): void {
  buckets.clear();
}

/** Best-effort client IP behind Vercel/Cloudflare proxies. */
export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return headers.get("x-real-ip") ?? headers.get("cf-connecting-ip") ?? "unknown";
}
