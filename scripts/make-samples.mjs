/**
 * Draws the three SYNTHETIC sample prescriptions in /public/samples from the data
 * in lib/samples.ts, using a headless Chromium browser (Edge or Chrome).
 *
 *   node scripts/make-samples.mjs
 *
 * The PNGs are committed, so you only need this if you change lib/samples.ts.
 * Needs internet once (Google Fonts for the handwriting styles).
 * Every image carries a big "SAMPLE" watermark: these are NOT real prescriptions.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { SAMPLES } = await import(pathToFileURL(path.join(root, "lib", "samples.ts")).href);

const browser = [
  process.env.BROWSER_PATH,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].find((p) => p && existsSync(p));
if (!browser) {
  console.error("No Chromium-based browser found. Set BROWSER_PATH to msedge/chrome.");
  process.exit(1);
}

const outDir = path.join(root, "public", "samples");
mkdirSync(outDir, { recursive: true });
const tmp = mkdtempSync(path.join(tmpdir(), "tanda-samples-"));

function rng(seed) {
  let a = [...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const STYLE = {
  typed: {
    font: "'Courier Prime', 'Courier New', monospace",
    link: "Courier+Prime:wght@400;700",
    size: 27,
    ink: "#1d1d1d",
    jitter: 0,
    filter: "none",
  },
  neat: {
    font: "'Caveat', 'Segoe Script', cursive",
    link: "Caveat:wght@500;700",
    size: 40,
    ink: "#1b2f7a",
    jitter: 0.5,
    filter: "url(#wobble-light)",
  },
  messy: {
    font: "'Reenie Beanie', 'Segoe Script', cursive",
    link: "Reenie+Beanie",
    size: 42,
    ink: "#22305c",
    jitter: 2.6,
    filter: "url(#wobble-heavy)",
  },
};

function buildHtml(sample) {
  const st = STYLE[sample.style];
  const rand = rng(sample.id);
  const j = (amp) => ((rand() - 0.5) * 2 * amp).toFixed(2);
  const e = sample.extracted;

  const header =
    sample.style === "typed"
      ? `<div class="letterhead"><div class="clinic">${esc(e.doctor.clinic)}</div>
         <div class="doc">${esc(e.doctor.name)} &middot; Lic. No. ${esc(e.doctor.license_no)}</div></div>`
      : `<div class="letterhead hand"><div class="clinic" style="transform:rotate(${j(st.jitter)}deg)">${esc(e.doctor.clinic)}</div>
         <div class="doc" style="transform:rotate(${j(st.jitter)}deg)">${esc(e.doctor.name)}${e.doctor.license_no ? " &middot; Lic. " + esc(e.doctor.license_no) : ""}</div></div>`;

  const rows = e.medicines
    .map((m, i) => {
      const unreadable = !m.generic_name && !m.sig_raw;
      if (unreadable) {
        // a scribble nobody could read
        return `<div class="med" style="display:flex;align-items:center"><span class="n" style="font-size:${st.size}px;font-weight:700">${i + 1}.</span>
          <svg width="520" height="56" viewBox="0 0 520 64" style="transform:rotate(${j(1.5)}deg)">
            <path d="M5 40 C30 5, 45 60, 70 30 S110 8, 130 42 S170 58, 190 24 S235 6, 255 40 S300 62, 325 28 S370 10, 390 44 S440 58, 470 22 S500 18, 515 36"
              fill="none" stroke="${st.ink}" stroke-width="3.2" stroke-linecap="round" opacity="0.8"/>
            <path d="M20 52 C120 44, 260 60, 500 48" fill="none" stroke="${st.ink}" stroke-width="2" opacity="0.5"/>
          </svg></div>`;
      }
      const t = (amp) => `transform:translateY(${j(amp)}px) rotate(${j(st.jitter)}deg) skewX(${j(st.jitter * 2)}deg)`;
      return `<div class="med">
        <div class="drug" style="${t(st.jitter * 2)}"><span class="n">${i + 1}.</span> ${esc(m.raw_text)}</div>
        <div class="sig" style="${t(st.jitter * 2)}">Sig: ${esc(m.sig_raw)}</div>
      </div>`;
    })
    .join("\n");

  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=${st.link}&display=block" rel="stylesheet">
<style>
  html,body{margin:0;padding:0}
  body{width:900px;height:1200px;position:relative;overflow:hidden;
    background:linear-gradient(180deg,#fffef9 0%,#fbf8ee 100%);
    font-family:${st.font};color:${st.ink}}
  .page{position:absolute;inset:0;padding:56px 70px}
  .banner{position:absolute;top:0;left:0;right:0;background:#b3261e;color:#fff;
    font:700 20px/36px Arial,Helvetica,sans-serif;text-align:center;letter-spacing:.06em}
  .letterhead{margin-top:34px;border-bottom:3px double ${st.ink};padding-bottom:14px}
  .clinic{font-size:${Math.round(st.size * 1.15)}px;font-weight:700}
  .doc{font-size:${Math.round(st.size * 0.78)}px;margin-top:4px}
  .meta{display:flex;justify-content:space-between;margin:26px 0 8px;font-size:${Math.round(st.size * 0.82)}px}
  .rx{font-size:${st.size * 2}px;font-weight:700;margin:6px 0 10px;line-height:1}
  .med{margin:0 0 ${Math.round(st.size * 0.55)}px 6px}
  .drug{font-size:${st.size}px;font-weight:700;line-height:1.15}
  .sig{font-size:${Math.round(st.size * 0.9)}px;margin-left:46px;line-height:1.15}
  .n{display:inline-block;width:42px}
  .sign{position:absolute;right:80px;bottom:110px;text-align:center;font-size:${Math.round(st.size * 0.8)}px}
  .sign .line{border-top:2px solid ${st.ink};padding-top:6px;min-width:300px}
  .wm{position:absolute;left:50%;top:52%;transform:translate(-50%,-50%) rotate(-28deg);
    font:900 230px/1 Arial,Helvetica,sans-serif;color:rgba(179,38,30,.16);letter-spacing:.04em;pointer-events:none}
  .foot{position:absolute;left:0;right:0;bottom:22px;text-align:center;
    font:700 17px Arial,Helvetica,sans-serif;color:#b3261e}
  .ink{filter:${st.filter}}
</style></head><body>
<svg width="0" height="0" style="position:absolute">
  <filter id="wobble-light"><feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="3"/></filter>
  <filter id="wobble-heavy"><feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed="8"/><feDisplacementMap in="SourceGraphic" scale="7"/><feGaussianBlur stdDeviation="0.5"/></filter>
</svg>
<div class="banner">SAMPLE &mdash; HINDI TOTOONG RESETA &middot; NOT A REAL PRESCRIPTION</div>
<div class="page ink">
  ${header}
  <div class="meta"><div>Pangalan: ${esc(e.patient.name)}</div><div>Edad: ${esc(e.patient.age)}</div></div>
  <div class="meta" style="margin-top:0"><div>Petsa: ${esc(e.date)}</div></div>
  <div class="rx">Rx</div>
  ${rows}
  <div class="sign"><div class="line">${esc(e.doctor.name)}</div></div>
</div>
<div class="wm">SAMPLE</div>
<div class="foot">SAMPLE &middot; gawa-gawa lamang para sa demo &middot; synthetic demo data</div>
</body></html>`;
}

for (const sample of SAMPLES) {
  const htmlPath = path.join(tmp, `${sample.id}.html`);
  const pngPath = path.join(root, "public", sample.image.replace(/^\//, ""));
  writeFileSync(htmlPath, buildHtml(sample), "utf8");
  mkdirSync(path.dirname(pngPath), { recursive: true });
  execFileSync(
    browser,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "--window-size=900,1200",
      "--virtual-time-budget=10000",
      `--screenshot=${pngPath}`,
      pathToFileURL(htmlPath).href,
    ],
    { stdio: "ignore", timeout: 60_000 },
  );
  console.log(`${sample.id}: ${(statSync(pngPath).size / 1024).toFixed(0)} KB -> ${path.relative(root, pngPath)}`);
}
