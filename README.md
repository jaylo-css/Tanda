# Tanda

**Para sa matanda, para matandaan** — *For our elders, so they remember.*

Tanda helps Filipino seniors and their families understand their medicines. A patient, family member or pharmacist uploads a photo of a doctor's prescription. Tanda makes a clear Tagalog version: large-print text, a daily schedule with simple pictures, a photo (or plain icon) for each medicine, read-aloud, a printable card, and a shareable family link.

> Hackathon prototype for **Nov 10, 2026**. Free tiers only, no payments, no accounts. **No real prescriptions or patient data are in this repo** — every sample is synthetic and watermarked SAMPLE.

Live demo: https://tanda-tan.vercel.app/

## Why it matters

| Figure | Source | Verified? |
|---|---|---|
| People remember only **14%** of spoken medical instructions, versus **over 80%** when pictographs are used | Kessels 2003, *J R Soc Med* 96(5):219–222, citing Houts et al. 1998 | ✅ wording checked against the paper's text |
| **51.5%** of Filipinos have limited health literacy | Tolabing et al. 2022, *Health Literacy Research and Practice* (national survey, n = 2,303) | ✅ |
| **55.9%** of patients at Manila pharmacies misunderstood their prescription | *Acta Medica Philippina*, 2013 (47:4) | ⚠️ **not yet verified** — the paper ("Factors associated with Patients' Incomplete Understanding of Prescriptions") exists, but I could not read its full text to confirm this number or whether it measures "misunderstood" vs "incompletely understood". Check the PDF before presenting it. |

## Safety rules (built into the code, and tested)

| Rule | Where it is enforced |
|---|---|
| **A human confirms every line.** The AI only drafts. Fields with confidence < 0.8, empty fields, and anything the parser flagged are amber and must be confirmed (✓ Tama) or edited. "Final" stays disabled until every amber field **and** every line is confirmed. Any edit un-confirms the line. | `lib/review.ts` (`canFinalize`, enforced again in the session reducer, not just the disabled button) · `lib/review.test.ts` |
| **Never guess.** Unreadable → *"Hindi mabasa, itanong sa pharmacist o doktor."* The prompt forbids inventing; the parser returns a flag instead of a guess (missing dose is never defaulted to 1; `OD` next to eye drops is flagged because it can mean "right eye"). | `lib/ai/extract.ts` prompt · `lib/sig.ts` · `lib/sig.test.ts` |
| **No added medical advice.** No new doses, no "para saan" unless the doctor wrote it **and the reviewer chooses to use it**, no interaction judgments. | `lib/review.ts` (`paraSaan` is only ever reviewer-typed) |
| **Medicine pictures are never AI-generated.** Only the user's real photo of the box, or a plain icon labelled *"Larawan lang, hindi ang aktwal na gamot."* | `components/icons.tsx`, `components/review/BoxPhoto.tsx` |
| **Every output shows** *"Ito ay gabay lamang. Ang orihinal na reseta ang opisyal."* plus the reviewer's name and the date. | `components/PrescriptionView.tsx`, also read aloud |
| **Box strength mismatch → red warning**: *"Magkaiba ang lakas (5 mg vs 10 mg). Itanong sa pharmacist."* (also red if the drug name differs) | `lib/boxmatch.ts` · `lib/boxmatch.test.ts` |

The shorthand → Tagalog step (`lib/sig.ts`) is **deterministic code, not AI**: `1 tab BID pc x 7 days` → *"1 tableta, 2 beses isang araw (umaga at gabi), pagkatapos kumain, sa loob ng 7 araw"*. The model is never used to write medical instructions.

## How it works

```
photo ──resize in browser (≤2000 px, JPG/PNG/HEIC)──► POST /api/extract (server only; image never stored)
        Gemini reads it ──► zod validation (1 retry) ──► draft JSON
                                                          │
 lib/sig.ts (code) turns each "sig" into Tagalog ◄────────┘
        │
        ▼
 Review screen: photo beside editable cards · amber = must confirm · Final is gated
        │
        ▼
 "Ang Iyong Gamot": large print, icons, daily schedule table ─► Listen · Print/PDF · Share (QR)
                                                                      │
                                                  /s/[id]  read-only family page, expires in 30 days
```

## Run it locally

Requires Node 20+ (developed on Node 24).

```bash
npm install
cp .env.example .env.local      # Windows: copy .env.example .env.local — then fill in your keys
npm run dev                     # http://localhost:3000
npm test                        # Vitest (200+ tests)
npm run typecheck && npm run lint
```

With **no keys at all** the app still runs: "Try a sample" works through Demo mode and sharing is simply hidden.

### Environment variables (`.env.local`, git-ignored — never commit secrets)

| Variable | Needed for | Notes |
|---|---|---|
| `GEMINI_API_KEY` | Reading prescriptions & boxes | Primary AI |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | Backup AI (optional) | Both required together |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Share links (optional) | The new `sb_secret_…` key works. **Server-side only.** |
| `DEMO_MODE` | Stage-demo safety net | `true` recommended for the demo |

All AI and database calls happen on the server. No key is ever sent to the browser.

### Getting the free keys

1. **Gemini** — go to <https://aistudio.google.com/apikey>, sign in with a Google account, *Create API key*. Put it in `GEMINI_API_KEY`. Check the model works for your key with `npm run check:models` (it sends a sample image to each candidate model and prints the timing; it never prints your key). Your real per-model limits are shown in AI Studio → *Rate limits* (Google's docs don't publish free-tier numbers).
2. **Cloudflare Workers AI** (optional backup) — create a free account at cloudflare.com. *Account ID*: dashboard → Workers & Pages (right sidebar). *API token*: <https://dash.cloudflare.com/profile/api-tokens> → *Create Token* → the **Workers AI** template. Free allocation: 10,000 neurons/day (≈ 100 prescriptions). The first call may require accepting Meta's Llama 3.2 licence; the app does this automatically.
3. **Supabase** (optional, for share links) — create a free project at supabase.com. *Settings → API Keys*: copy the project URL and the **secret key** (`sb_secret_…`, the replacement for `service_role`). Then, **once**:
   - open *SQL Editor → New query*, paste the contents of [`supabase/schema.sql`](supabase/schema.sql), press **Run** (creates the `shares` table with Row Level Security on and no public policies, and the private `med-photos` bucket);
   - run `npm run setup:supabase` to confirm everything is ready.
   Free Supabase projects pause after a week of inactivity — open the dashboard once before the demo.

## Deploy to Vercel (free Hobby plan)

1. Push this repo to GitHub (done: `jaylo-css/Tanda`).
2. <https://vercel.com/new> → import the repo. Framework preset: **Next.js** (auto-detected). Set the *Production Branch* to the branch you deploy from (`tanda-mvp`, or `main` after you merge).
3. Under **Environment Variables** add the same values as `.env.local` (Vercel never sees that file): `GEMINI_API_KEY`, `DEMO_MODE=true`, and optionally the Cloudflare and Supabase ones.
4. Deploy. Every push to the branch redeploys automatically.
5. Smoke test the live site: open it, press **Subukan ang sample**, finish the review, press **Ibahagi sa pamilya** (if Supabase is set), open the link in a private window.

## Demo mode and a safe stage demo

`DEMO_MODE=true`: if the AI **fails, is rate-limited, or takes longer than 15 seconds**, a **sample** prescription gets its pre-saved result, so the demo never breaks. Guard rails (all tested in `app/api/extract/route.test.ts`):

- Only an image that is **byte-for-byte one of the three synthetic samples** can ever receive saved data. A real upload never does — it gets a friendly error offering "type the medicines by hand". The review screen labels a saved result "DEMO".
- Rate limit: 10 prescription reads per hour per IP (box photos 20, share links 20). A rate-limited sample still works, so shared venue Wi-Fi cannot lock the demo out.

Suggested 3-minute demo: Home → **Subukan ang sample** (messy handwriting) → show the amber fields and the unreadable line → try pressing *Gawin ang malinaw na bersyon* while it's disabled → confirm lines → add the sample box photo (`/samples`) to the Amlodipine line → show the **red strength warning** → *Pakinggan* → *Ibahagi sa pamilya* → scan the QR code.

## Privacy (Data Privacy Act)

- A privacy notice and an explicit consent checkbox come **before** any upload.
- Prescription photos are processed in memory and **never stored**. Patient details live only in the browser tab until the user shares.
- A share link stores only the confirmed clear version and the user's own medicine photos (not the prescription photo, doctor's licence number, raw AI reading or confidence scores), under an unguessable 128-bit id, and **expires after 30 days** (checked on every visit; expired links are refused and deleted; photos are served by 1-hour signed URLs from a private bucket).
- ⚠️ **On Google's free Gemini tier, Google may use submitted content to improve its products and its reviewers may read it** ([Gemini API terms](https://ai.google.dev/gemini-api/terms): *"Do not submit sensitive, confidential, or personal information to the Unpaid Services"*). The consent screen says so. **Use the synthetic samples for demos; do not upload real patients' prescriptions through the free tier.** The paid tier excludes this, but this project is deliberately free-only.

## Known limits (measured, not hoped)

- **Handwriting accuracy.** Tested only on three *synthetic* samples (handwriting-style fonts), not real doctors' handwriting. On the messy sample Gemini read every line correctly, but it rated messy handwriting 0.9 confidence — model confidence is not well calibrated, which is exactly why every line needs a human confirmation. It also silently skipped a scribbled line until the prompt was changed to require an entry for every line.
- **Model speed.** `gemini-3.8-flash` (listed as "New Stable") **timed out (>40 s) three times** for the project key, so the primary is `gemini-3.6-flash` (~4 s with thinking set to "minimal"). Re-run `npm run check:models` before the demo; the order is one line in `lib/ai/config.ts`. Google publishes no free-tier request limits — check AI Studio.
- **The Cloudflare backup is a last resort, not a peer.** Measured: 22–48 s per prescription, it sometimes ignores JSON mode and returns prose (rejected by the validator → manual entry is offered), and it rated a wrong year 1.0. Its confidence is capped at 0.7 so everything it reads is amber, and the review screen says it was read by the backup AI.
- **Filipino voice availability depends on the device.** Read-aloud uses the browser's built-in speech (no paid TTS). If the device has no Filipino (fil-PH) voice, Tanda says so and reads the English version instead (the user can opt to read the Tagalog with an English voice). Real audio was not testable in the automated tests; the speaking queue was tested with a fake speech engine.
- **Not yet tested on real phones.** Layout was verified in Edge at a true 375 px viewport and with an automated accessibility scan (axe-core, WCAG 2.1 AA: 0 violations on every screen, both languages), but camera capture and HEIC conversion were not tried with a real phone / iPhone photo, and printing was checked with emulated print media, not a physical printer. "Save as PDF" uses the browser's print dialog.
- **The shorthand parser covers common Philippine shorthand, not all of it.** Unknown text is flagged, never guessed. Tapering schedules ("then 1 tab OD") are flagged for the reviewer rather than interpreted.
- **Rate limiting is in-memory.** On Vercel each warm server instance counts separately, so under heavy traffic the real limit can be looser than 10/hour. It protects the free quota from a single noisy client, not from a distributed attack.
- **Review state lives only in the browser tab.** Refreshing the review page loses it (deliberate: nothing about the patient is stored on the device).

## Project layout

```
app/                      Pages: / · /upload · /review · /result · /samples · /about · /s/[id]
app/api/                  extract · box · share · config  (server-only routes)
components/               UI: review cards, prescription view, icons, share box, speech controls
lib/sig.ts                Deterministic shorthand → Tagalog parser (+ 80 tests)
lib/review.ts             Review model and the "Final" gate
lib/boxmatch.ts           Box-label matching and the strength-mismatch warning
lib/schedule.ts           Daily schedule table
lib/speech.ts, useSpeech  Read-aloud (Web Speech API)
lib/ai/                   Provider interface, Gemini, Cloudflare, prompts, zod-validated parsing, config
lib/server/               Upload validation, Supabase share links (REST, no SDK)
lib/samples.ts            3 synthetic prescriptions (also the Demo-mode data)
supabase/schema.sql       One-time database setup
scripts/                  make-samples · hash-samples · check-models · setup-supabase
public/samples/           SAMPLE-watermarked images (3 prescriptions + 1 medicine box)
```

## Out of scope

Payments, user accounts, drug-interaction checking, SMS reminders, and any AI-generated images of medicines.
