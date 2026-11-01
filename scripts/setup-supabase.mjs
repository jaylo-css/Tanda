/**
 * Checks (and where possible prepares) your Supabase project for Tanda share links:
 *   node scripts/setup-supabase.mjs
 *
 * - creates the private "med-photos" storage bucket if it is missing (needs only the service key)
 * - checks that the "shares" table exists. Tables cannot be created over the REST API, so if it is
 *   missing this prints what to do: paste supabase/schema.sql into the Supabase SQL editor once.
 * Keys are read from .env.local and never printed.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
try {
  process.loadEnvFile(path.join(root, ".env.local"));
} catch {
  /* use the real environment */
}
const url = (process.env.SUPABASE_URL ?? "").replace(/\/+$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
if (!url || !key) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env.local");
  process.exit(1);
}
// new-style keys (sb_secret_...) are not JWTs: send them in `apikey` only
const headers = key.startsWith("eyJ")
  ? { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" }
  : { apikey: key, "content-type": "application/json" };
const clean = (s) => String(s).split(key).join("***").slice(0, 300);

async function call(method, p, body) {
  const res = await fetch(url + p, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20_000) });
  return { status: res.status, text: await res.text() };
}

console.log("project:", new URL(url).host);

const buckets = await call("GET", "/storage/v1/bucket");
console.log("storage API:", buckets.status, buckets.status === 200 ? "reachable" : clean(buckets.text));
if (buckets.status === 200) {
  const has = JSON.parse(buckets.text).some((b) => b.id === "med-photos");
  if (has) console.log('bucket "med-photos": exists');
  else {
    const made = await call("POST", "/storage/v1/bucket", {
      id: "med-photos",
      name: "med-photos",
      public: false,
      file_size_limit: 1_048_576,
      allowed_mime_types: ["image/jpeg", "image/png", "image/webp"],
    });
    console.log('bucket "med-photos": create ->', made.status, made.status < 300 ? "created (private)" : clean(made.text));
  }
}

const table = await call("GET", "/rest/v1/shares?select=id&limit=1");
if (table.status === 200) console.log('table "shares": exists. Sharing is ready.');
else {
  console.log('table "shares": NOT READY ->', table.status, clean(table.text));
  console.log("\nOne-time step: open your Supabase project -> SQL Editor -> New query, paste the contents of");
  console.log("supabase/schema.sql and press Run. Then run this script again.");
}
