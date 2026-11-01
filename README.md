# Tanda

**Para sa matanda, para matandaan** — *For our elders, so they remember.*

Tanda helps Filipino seniors and their families understand their medicines. A patient, family member or pharmacist uploads a photo of a doctor's prescription. Tanda makes a clear Tagalog version: easy-to-read text, a daily schedule with simple pictures, a photo of each medicine, read-aloud, and a shareable link and printable card.

> Hackathon prototype (demo: Nov 10, 2026). Free tiers only. No payments. No real patient data in this repo.

## Why it matters

| Figure | Source |
|---|---|
| People remember only **14%** of spoken medical instructions, versus **over 80%** when pictographs are used | Kessels 2003, *J R Soc Med* 96(5):219–222, citing Houts et al. 1998 |
| **51.5%** of Filipinos have limited health literacy | Tolabing et al. 2022, *Health Literacy Research and Practice* (national survey, n = 2,303) |
| **55.9%** of patients at Manila pharmacies misunderstood their prescription | *Acta Medica Philippina*, 2013 (47:4) |

Verification status: the 14% / over 80% wording was checked against the Kessels paper's text, and 51.5% against the Tolabing paper. **The 55.9% figure is from the project brief and has not yet been checked against the full text of the Acta Medica Philippina article — please check before presenting it.**

## Safety rules (built into the code, not just the docs)

1. **A human confirms every line.** The AI only drafts. Unclear or low-confidence (< 0.8) fields are amber and must be confirmed or edited before "Final" is enabled.
2. **Never guess.** If a word or number can't be read: *"Hindi mabasa, itanong sa pharmacist o doktor."* Tanda never fills in a dose, frequency or drug name it isn't sure of.
3. **No added medical advice.** No new doses, no "para saan" unless the doctor wrote it or the reviewer typed it, no interaction judgments.
4. **Medicine pictures are never AI-generated.** Only a real photo of the actual box, or a plain dosage-form icon labeled *"Larawan lang, hindi ang aktwal na gamot."*
5. **Every output says** *"Ito ay gabay lamang. Ang orihinal na reseta ang opisyal."* plus the reviewer's name and the date.

The shorthand → Tagalog step (`lib/sig.ts`) is **deterministic code, not AI**. Anything it doesn't recognise, or that is ambiguous (for example `OD` next to eye drops, which can mean "once daily" or "right eye"), becomes a flag for the reviewer instead of a guess.

## Privacy (Data Privacy Act)

- Prescription photos are not stored by Tanda after processing; the minimum data is kept.
- Share links expire after 30 days.
- A privacy notice and consent come before any upload.
- **Important:** on the *free* Google Gemini tier, Google may use submitted content to improve its products and its reviewers may read it ([Gemini API terms](https://ai.google.dev/gemini-api/terms)). Use the synthetic samples for demos. Do not upload real patient prescriptions through the free tier.

## Status

| Milestone | Status |
|---|---|
| 1. Scaffold, Tagalog UI shell, sig parser + tests, synthetic samples | ✅ done |
| 2. Upload + consent, AI extraction (Gemini/Cloudflare), review screen + confirm gate | ⏳ |
| 3. Medicine photos + box matching + strength warning, clear Tagalog page + schedule | ⏳ |
| 4. Read-aloud, print/PDF, Supabase share links (30-day expiry), family page | ⏳ |
| 5. Demo mode, rate limiting, accessibility pass, full README, Vercel deploy | ⏳ |

## Run it

Requires Node 20+ (developed on Node 24).

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # Vitest
npm run typecheck
npm run lint
```

Without any API keys the app runs; the sample preview at `/samples` works because it uses pre-saved results.

Copy `.env.example` to `.env.local` for keys (git-ignored). See the file for where to get each free key. Full setup, key instructions and Vercel deploy steps arrive with Milestone 5.

## Project layout

```
app/                  Next.js App Router pages (/, /about, /samples, /upload)
components/           Header, footer, language provider
lib/sig.ts            Deterministic prescription-shorthand → Tagalog parser
lib/sig.test.ts       80+ parser tests
lib/schema.ts         zod schema for the AI's JSON
lib/samples.ts        Three synthetic prescriptions (also the demo-mode data)
lib/ai/config.ts      Model names + free-tier limits (single config file)
public/samples/       SAMPLE-watermarked images
scripts/make-samples.mjs   Regenerates the sample images
```

## Known limits (so far)

- Handwriting accuracy depends on the vision model; messy handwriting will need more human edits. The synthetic "messy" sample is a stand-in, not real doctors' handwriting.
- The parser covers common Philippine shorthand, not all of it. Unknown text is flagged, never guessed.
