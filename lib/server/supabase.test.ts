import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createShare, expiryFor, getSupabase, isShareReady, newShareId, purgeExpired, readShare, resetShareReadyCache, SHARE_ID_RE, type Supabase } from "./supabase";
import { buildPrescriptionData } from "../prescription";
import { confirmField, confirmLine, entryFromExtracted, pendingAmber, setPhoto } from "../review";
import { sharePayloadSchema, toSharePayload } from "../shareSchema";
import { SAMPLES } from "../samples";

// a tiny valid JPEG header is enough: the server checks the magic bytes
const JPEG = "data:image/jpeg;base64," + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]).toString("base64");

function payload(withPhoto = true) {
  const entries = SAMPLES[0].extracted.medicines.map((m, i) => {
    let e = entryFromExtracted(m, `med-${i}`);
    for (const k of pendingAmber(e)) e = confirmField(e, k);
    e = confirmLine(e);
    return withPhoto && i === 1 ? setPhoto(e, { dataUrl: JPEG }) : e;
  });
  const data = buildPrescriptionData({
    header: { doctor: { name: "Dr. Sample Reyes", clinic: "SAMPLE Clinic", license_no: "SAMPLE-0000" }, patient: { name: "Juan SAMPLE Dela Cruz", age: "68" }, date: "2026-10-15" },
    reviewer: { name: "Ana", role: "kapamilya" },
    entries,
    finalizedAt: "2026-11-02T01:00:00.000Z",
  });
  return toSharePayload(data);
}

/** A tiny in-memory Supabase: just enough REST + Storage to exercise the real code. */
function fakeSupabase() {
  const rows: Array<{ id: string; data: unknown; photo_paths: string[]; expires_at: string }> = [];
  const objects = new Map<string, number>();
  const calls: string[] = [];
  let failInsert = false;
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });

  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const p = url.pathname + url.search;
    calls.push(`${method} ${url.pathname}`);
    if (method === "POST" && url.pathname.startsWith("/storage/v1/object/sign/")) {
      const body = JSON.parse(String(init!.body)) as { paths: string[] };
      return json(body.paths.map((path) => ({ path, signedURL: `/object/sign/med-photos/${path}?token=t` })));
    }
    if (method === "POST" && url.pathname.startsWith("/storage/v1/object/med-photos/")) {
      objects.set(url.pathname.replace("/storage/v1/object/med-photos/", ""), 1);
      return json({ Key: "x" });
    }
    if (method === "DELETE" && url.pathname === "/storage/v1/object/med-photos") {
      for (const path of (JSON.parse(String(init!.body)) as { prefixes: string[] }).prefixes) objects.delete(path);
      return json([]);
    }
    if (method === "POST" && url.pathname === "/rest/v1/shares") {
      if (failInsert) return json({ message: "boom" }, 500);
      rows.push(JSON.parse(String(init!.body)));
      return new Response(null, { status: 201 });
    }
    if (method === "GET" && url.pathname === "/rest/v1/shares") {
      const id = url.searchParams.get("id");
      const lt = url.searchParams.get("expires_at");
      if (id?.startsWith("eq.")) return json(rows.filter((r) => r.id === id.slice(3)));
      if (lt?.startsWith("lt.")) return json(rows.filter((r) => new Date(r.expires_at) < new Date(lt.slice(3))).map((r) => ({ id: r.id, photo_paths: r.photo_paths })));
    }
    if (method === "DELETE" && url.pathname === "/rest/v1/shares") {
      const ids = (url.searchParams.get("id") ?? "").replace(/^in\.\(|\)$/g, "").split(",");
      for (let i = rows.length - 1; i >= 0; i--) if (ids.includes(rows[i].id)) rows.splice(i, 1);
      return new Response(null, { status: 204 });
    }
    return json({ message: `unexpected ${method} ${p}` }, 500);
  };
  return { rows, objects, calls, fetchImpl, setFailInsert: (v: boolean) => (failInsert = v) };
}

const SB: Supabase = { url: "https://x.supabase.co", headers: { apikey: "sb_secret_test" }, key: "sb_secret_test" };
const T0 = new Date("2026-11-02T00:00:00.000Z");
const settle = () => new Promise((r) => setTimeout(r, 20));

let fake: ReturnType<typeof fakeSupabase>;
beforeEach(() => {
  fake = fakeSupabase();
  vi.stubGlobal("fetch", fake.fetchImpl);
});
afterEach(() => vi.unstubAllGlobals());

describe("share links: 30-day expiry", () => {
  it("expires exactly 30 days after creation", async () => {
    const r = await createShare(SB, payload(), T0);
    if ("error" in r) throw new Error(r.error);
    expect(new Date(r.expiresAt).getTime() - T0.getTime()).toBe(30 * 24 * 3600 * 1000);
    expect(expiryFor(T0).toISOString()).toBe("2026-12-02T00:00:00.000Z");
    expect(fake.rows[0].expires_at).toBe(r.expiresAt);
  });

  it("shows the link before it expires and refuses it after 30 days", async () => {
    const r = await createShare(SB, payload(), T0);
    if ("error" in r) throw new Error(r.error);
    const day29 = new Date(T0.getTime() + 29 * 86400_000);
    expect((await readShare(SB, r.id, day29)).status).toBe("ok");
    const day31 = new Date(T0.getTime() + 31 * 86400_000);
    expect((await readShare(SB, r.id, day31)).status).toBe("expired");
  });

  it("deletes an expired share (row and photos) when it is opened", async () => {
    const r = await createShare(SB, payload(), T0);
    if ("error" in r) throw new Error(r.error);
    expect(fake.objects.size).toBe(1);
    await readShare(SB, r.id, new Date(T0.getTime() + 31 * 86400_000));
    await settle();
    expect(fake.rows).toHaveLength(0);
    expect(fake.objects.size).toBe(0);
  });

  it("purges expired shares whenever a new one is made", async () => {
    await createShare(SB, payload(), T0);
    const later = new Date(T0.getTime() + 40 * 86400_000);
    expect(await purgeExpired(SB, later)).toBe(1);
    expect(fake.rows).toHaveLength(0);
    expect(fake.objects.size).toBe(0);
  });
});

describe("share links: privacy and safety", () => {
  it("ids are long, random, url-safe and different every time", () => {
    const a = newShareId();
    const b = newShareId();
    expect(a).toMatch(SHARE_ID_RE);
    expect(a).not.toBe(b);
  });

  it("does not even query the database for a malformed id", async () => {
    expect((await readShare(SB, "../../etc/passwd")).status).toBe("missing");
    expect((await readShare(SB, "short")).status).toBe("missing");
    expect(fake.calls).toHaveLength(0);
  });

  it("stores only the confirmed clear version: no licence number, shorthand, confidence or prescription photo", async () => {
    const r = await createShare(SB, payload(), T0);
    if ("error" in r) throw new Error(r.error);
    const stored = JSON.stringify(fake.rows[0].data);
    expect(stored).not.toContain("SAMPLE-0000"); // doctor's licence number
    expect(stored).not.toContain("sigRaw");
    expect(stored).not.toContain("confidence");
    expect(stored).not.toContain("data:image"); // photos go to Storage, not into the table
    expect(stored).toContain("Juan SAMPLE Dela Cruz"); // what the family needs to see
  });

  it("photos go to the private bucket and come back as short-lived signed URLs", async () => {
    const r = await createShare(SB, payload(), T0);
    if ("error" in r) throw new Error(r.error);
    const read = await readShare(SB, r.id, T0);
    if (read.status !== "ok") throw new Error("not ok");
    expect(Object.keys(read.photoUrls)).toEqual(["med-1"]);
    expect(read.photoUrls["med-1"]).toMatch(/^https:\/\/x\.supabase\.co\/storage\/v1\/object\/sign\/med-photos\/.+\?token=/);
  });

  it("rejects a file that claims to be a JPEG but is not, and writes nothing", async () => {
    const p = payload();
    p.photos["med-1"] = "data:image/jpeg;base64," + Buffer.from("this is not an image at all").toString("base64");
    const r = await createShare(SB, p, T0);
    expect("error" in r).toBe(true);
    expect(fake.rows).toHaveLength(0);
    expect(fake.objects.size).toBe(0);
  });

  it("rejects photos that are not image data URLs", async () => {
    const p = payload();
    p.photos["med-1"] = "https://evil.example/x.jpg";
    expect("error" in (await createShare(SB, p, T0))).toBe(true);
  });

  it("cleans up uploaded photos if saving the row fails (no orphaned files)", async () => {
    fake.setFailInsert(true);
    const r = await createShare(SB, payload(), T0);
    expect("error" in r).toBe(true);
    expect(fake.objects.size).toBe(0);
    expect(fake.rows).toHaveLength(0);
  });

  it("the payload schema accepts a real confirmed prescription and rejects an empty or oversized one", () => {
    expect(sharePayloadSchema.safeParse(payload()).success).toBe(true);
    const empty = payload();
    empty.data.medicines = [];
    expect(sharePayloadSchema.safeParse(empty).success).toBe(false);
    const huge = payload();
    huge.data.medicines = Array.from({ length: 31 }, (_, i) => ({ ...payload().data.medicines[0], id: `m${i}` }));
    expect(sharePayloadSchema.safeParse(huge).success).toBe(false);
  });
});

describe("the Share button only appears when sharing really works", () => {
  it("not ready when the shares table does not exist yet (PGRST205 / 404)", async () => {
    resetShareReadyCache();
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ code: "PGRST205" }), { status: 404 }));
    expect(await isShareReady(SB)).toBe(false);
  });
  it("ready once the table exists, and the answer is cached for a minute", async () => {
    resetShareReadyCache();
    let calls = 0;
    vi.stubGlobal("fetch", async () => { calls++; return new Response("[]", { status: 200 }); });
    expect(await isShareReady(SB, 1_000)).toBe(true);
    expect(await isShareReady(SB, 30_000)).toBe(true);
    expect(calls).toBe(1);
    expect(await isShareReady(SB, 70_000)).toBe(true); // cache expired: asks again
    expect(calls).toBe(2);
  });
  it("not ready if Supabase cannot be reached", async () => {
    resetShareReadyCache();
    vi.stubGlobal("fetch", async () => { throw new Error("network down"); });
    expect(await isShareReady(SB)).toBe(false);
  });
});

describe("sharing is optional", () => {
  it("with no Supabase keys the app still works: getSupabase() is null", () => {
    expect(getSupabase({})).toBeNull();
    expect(getSupabase({ SUPABASE_URL: "https://x.supabase.co" })).toBeNull();
  });
  it("new-style secret keys are sent in `apikey` only (they are not JWTs)", () => {
    const sb = getSupabase({ SUPABASE_URL: "https://x.supabase.co/", SUPABASE_SERVICE_ROLE_KEY: "sb_secret_abc" })!;
    expect(sb.headers).toEqual({ apikey: "sb_secret_abc" });
    expect(sb.url).toBe("https://x.supabase.co");
    const legacy = getSupabase({ SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "eyJabc" })!;
    expect(legacy.headers.authorization).toBe("Bearer eyJabc");
  });
});
