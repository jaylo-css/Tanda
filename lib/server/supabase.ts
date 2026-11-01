/**
 * Share links on the Supabase free tier (Postgres table + private Storage bucket), via REST.
 * Server-side only: uses the secret/service key, which must never reach a browser.
 *
 * If no Supabase keys are set, getSupabase() returns null and the whole app still works with
 * sharing switched off.
 */
import { randomBytes } from "node:crypto";
import { AI_CONFIG } from "../ai/config";
import { decodePhotos, sharedDataSchema, type SharedData, type SharePayload } from "../shareSchema";

export interface Supabase {
  url: string;
  headers: Record<string, string>;
  /** For scrubbing error text. */
  key: string;
}

export const BUCKET = "med-photos";
export const SHARE_ID_RE = /^[A-Za-z0-9_-]{22}$/;

export function getSupabase(env: Record<string, string | undefined> = process.env): Supabase | null {
  const url = (env.SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
  const key = (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || "").trim();
  if (!url || !key) return null;
  // new-style keys (sb_secret_...) are not JWTs and go in `apikey` only; legacy JWT keys also go in Authorization
  const headers: Record<string, string> = key.startsWith("eyJ") ? { apikey: key, authorization: `Bearer ${key}` } : { apikey: key };
  return { url, headers, key };
}

class SupabaseError extends Error {}

async function call(sb: Supabase, method: string, path: string, opts: { json?: unknown; body?: Uint8Array; type?: string; prefer?: string } = {}): Promise<Response> {
  const headers: Record<string, string> = { ...sb.headers };
  if (opts.json !== undefined) headers["content-type"] = "application/json";
  if (opts.type) headers["content-type"] = opts.type;
  if (opts.prefer) headers.prefer = opts.prefer;
  return fetch(sb.url + path, {
    method,
    headers,
    body: opts.json !== undefined ? JSON.stringify(opts.json) : opts.body ? Buffer.from(opts.body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
}

async function mustOk(sb: Supabase, res: Response, what: string): Promise<Response> {
  if (res.ok) return res;
  const text = (await res.text().catch(() => "")).split(sb.key).join("***").slice(0, 200);
  throw new SupabaseError(`${what} failed (${res.status}): ${text}`);
}

export function newShareId(): string {
  return randomBytes(16).toString("base64url"); // 22 chars, 128 bits: unguessable
}

export function expiryFor(now: Date): Date {
  return new Date(now.getTime() + AI_CONFIG.shareLinkTtlDays * 24 * 3600 * 1000);
}

/** Saves the confirmed clear version. Returns the id and the expiry (30 days). */
export async function createShare(sb: Supabase, payload: SharePayload, now: Date = new Date()): Promise<{ id: string; expiresAt: string } | { error: string }> {
  const photos = decodePhotos(payload.photos);
  if ("error" in photos) return { error: photos.error };
  // only photos for medicines that are really in the list
  const known = new Set(payload.data.medicines.map((m) => m.id));
  const usable = photos.filter((p) => known.has(p.medId));

  const id = newShareId();
  const expiresAt = expiryFor(now).toISOString();
  const paths: string[] = [];
  try {
    for (const p of usable) {
      const path = `${id}/${p.medId}.${p.ext}`;
      await mustOk(sb, await call(sb, "POST", `/storage/v1/object/${BUCKET}/${path}`, { body: p.bytes, type: p.mime }), "photo upload");
      paths.push(path);
    }
    await mustOk(
      sb,
      await call(sb, "POST", "/rest/v1/shares", {
        json: { id, data: payload.data, photo_paths: paths, expires_at: expiresAt },
        prefer: "return=minimal",
      }),
      "saving the share",
    );
  } catch (e) {
    if (paths.length) await removeObjects(sb, paths).catch(() => undefined); // do not leave orphaned photos
    return { error: e instanceof Error ? e.message : "share failed" };
  }
  void purgeExpired(sb, now).catch(() => undefined); // opportunistic tidy-up
  return { id, expiresAt };
}

async function removeObjects(sb: Supabase, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  await call(sb, "DELETE", `/storage/v1/object/${BUCKET}`, { json: { prefixes: paths } });
}

export type ReadResult =
  | { status: "ok"; data: SharedData; expiresAt: string; photoUrls: Record<string, string> }
  | { status: "missing" | "expired" };

/** Reads a share. Expired shares are never shown, and are deleted on the spot. */
export async function readShare(sb: Supabase, id: string, now: Date = new Date()): Promise<ReadResult> {
  if (!SHARE_ID_RE.test(id)) return { status: "missing" };
  const res = await call(sb, "GET", `/rest/v1/shares?id=eq.${id}&select=data,photo_paths,expires_at&limit=1`);
  if (!res.ok) throw new SupabaseError(`reading the share failed (${res.status})`);
  const rows = (await res.json()) as Array<{ data: unknown; photo_paths: string[]; expires_at: string }>;
  if (rows.length === 0) return { status: "missing" };
  const row = rows[0];
  if (new Date(row.expires_at).getTime() <= now.getTime()) {
    void deleteShares(sb, [{ id, photo_paths: row.photo_paths }]).catch(() => undefined);
    return { status: "expired" };
  }
  const parsed = sharedDataSchema.safeParse(row.data);
  if (!parsed.success) return { status: "missing" };

  const photoUrls: Record<string, string> = {};
  if (row.photo_paths.length) {
    const signed = await call(sb, "POST", `/storage/v1/object/sign/${BUCKET}`, { json: { expiresIn: 3600, paths: row.photo_paths } });
    if (signed.ok) {
      const list = (await signed.json()) as Array<{ path?: string; signedURL?: string | null }>;
      for (const s of list) {
        if (!s.path || !s.signedURL) continue;
        const medId = s.path.split("/").pop()!.replace(/\.(jpg|png|webp)$/, "");
        photoUrls[medId] = `${sb.url}/storage/v1${s.signedURL}`;
      }
    }
  }
  return { status: "ok", data: parsed.data, expiresAt: row.expires_at, photoUrls };
}

async function deleteShares(sb: Supabase, rows: Array<{ id: string; photo_paths: string[] }>): Promise<void> {
  const ids = rows.map((r) => r.id).filter((i) => SHARE_ID_RE.test(i));
  if (ids.length === 0) return;
  await removeObjects(sb, rows.flatMap((r) => r.photo_paths));
  await call(sb, "DELETE", `/rest/v1/shares?id=in.(${ids.join(",")})`);
}

/** Deletes expired shares (rows and photos). Called whenever a new link is made. */
export async function purgeExpired(sb: Supabase, now: Date = new Date(), limit = 25): Promise<number> {
  const res = await call(sb, "GET", `/rest/v1/shares?expires_at=lt.${encodeURIComponent(now.toISOString())}&select=id,photo_paths&limit=${limit}`);
  if (!res.ok) return 0;
  const rows = (await res.json()) as Array<{ id: string; photo_paths: string[] }>;
  await deleteShares(sb, rows);
  return rows.length;
}
