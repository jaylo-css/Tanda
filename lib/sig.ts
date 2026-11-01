/**
 * Deterministic parser for Philippine prescription shorthand ("sig").
 *
 *   "1 tab BID pc x 7 days"
 *     -> "1 tableta, 2 beses isang araw (umaga at gabi), pagkatapos kumain, sa loob ng 7 araw"
 *
 * SAFETY RULES (see README):
 *  - This is plain code, not AI. The same input always gives the same output.
 *  - Never guess. Anything not recognised, ambiguous, conflicting or assumed is
 *    returned as a flag. The review screen shows flagged fields in amber and the
 *    prescription cannot be finalised until a human confirms or edits them.
 *  - Nothing is added that the doctor did not write. In particular there is no
 *    "para saan" (what it is for) and no advice of any kind. Text after "for"
 *    is only returned verbatim as `indicationRaw` for the reviewer to use or ignore.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type Lang = "tl" | "en";

export type SlotId = "umaga" | "tanghali" | "hapon" | "gabi" | "bago_matulog";
export const SLOT_IDS: readonly SlotId[] = ["umaga", "tanghali", "hapon", "gabi", "bago_matulog"];

export const SLOT_LABEL: Record<Lang, Record<SlotId, string>> = {
  tl: { umaga: "Umaga", tanghali: "Tanghali", hapon: "Hapon", gabi: "Gabi", bago_matulog: "Bago matulog" },
  en: { umaga: "Morning", tanghali: "Noon", hapon: "Afternoon", gabi: "Evening", bago_matulog: "Bedtime" },
};

export const UNREADABLE_TL = "Hindi mabasa, itanong sa pharmacist o doktor";
export const UNREADABLE_EN = "Can't read this, ask your pharmacist or doctor";

export type AmountUnit = "tablet" | "capsule" | "tsp" | "tbsp" | "ml" | "drop" | "puff" | "unit" | "sachet" | "ampule";

export interface Amount {
  min: number;
  /** Set when the doctor wrote a range such as "1-2 tabs". */
  max?: number;
  /** null when the doctor wrote a bare number with no unit. */
  unit: AmountUnit | null;
}

export type FreqCode = "OD" | "BID" | "TID" | "QID" | "TIMES" | "Q_HOURS" | "Q_DAYS" | "QOD" | "WEEKLY" | "STAT";

export interface Frequency {
  code: FreqCode;
  /** Doses per day for OD/BID/TID/QID/TIMES. */
  perDay?: number;
  /** For Q_HOURS (hours) and Q_DAYS (days); max is set for ranges like q4-6h. */
  every?: { min: number; max?: number };
}

export type TimingKind = "AC" | "PC" | "WITH_MEALS" | "EMPTY_STOMACH";
export interface Timing {
  kind: TimingKind;
  /** For "30 min ac": minutes before the meal. */
  leadMinutes?: number;
}

export type RouteCode = "PO" | "SL" | "TOPICAL" | "INHALE" | "EYE" | "IM" | "SC" | "IV";
export interface Route {
  code: RouteCode;
  eye?: "right" | "left" | "both";
}

export type DurationKind = "days" | "weeks" | "months" | "maintenance" | "until_finished";
export interface Duration {
  kind: DurationKind;
  value?: number;
}

export type SlotsBasis =
  | "written" // the doctor wrote the time of day (HS, AM, "in the morning"...)
  | "standard" // standard reading of BID/TID/q12h, e.g. BID = morning + evening
  | "assumed" // a guess is needed (e.g. OD with no time) -> reviewer must confirm
  | "none"; // as-needed, right now, or not placeable

export type SigField = "amount" | "frequency" | "timing" | "duration" | "route" | "slots" | "text";

export type FlagCode =
  | "empty"
  | "unreadable_part"
  | "unrecognized_text"
  | "missing_amount"
  | "missing_unit"
  | "amount_range"
  | "odd_fraction"
  | "multiple_amounts"
  | "missing_frequency"
  | "frequency_conflict"
  | "od_ambiguous_eye"
  | "prn_no_interval"
  | "slots_assumed"
  | "slots_unplaceable"
  | "slots_mismatch"
  | "timing_conflict"
  | "route_conflict"
  | "duration_conflict"
  | "duration_unit_missing"
  | "unit_form_mismatch";

export interface SigFlag {
  code: FlagCode;
  field: SigField;
  tl: string;
  en: string;
  /** Extra detail, e.g. the unrecognised words. */
  detail?: string;
}

export interface ParsedSig {
  raw: string;
  amount: Amount | null;
  frequency: Frequency | null;
  timing: Timing | null;
  route: Route | null;
  duration: Duration | null;
  /** "kung kailangan" / as needed. */
  prn: boolean;
  slots: SlotId[];
  slotsBasis: SlotsBasis;
  /** Text the doctor wrote after "for ..." (verbatim, lower-case). Never auto-translated, never auto-used. */
  indicationRaw: string | null;
  /** Words the parser did not understand. */
  unrecognized: string[];
  flags: SigFlag[];
  /** True if a human must look at this line (any flag). */
  needsReview: boolean;
  tagalog: string;
  english: string;
}

export interface ParseOptions {
  /** Dosage form from the prescription line; used for sanity checks only. */
  dosageForm?: string;
  /** Words to ignore if they appear in the sig (e.g. the drug name). */
  ignoreWords?: string[];
}

// ---------------------------------------------------------------------------
// Regex building blocks
// ---------------------------------------------------------------------------

const WORD_NUM: Record<string, number> = {
  half: 0.5,
  kalahati: 0.5,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  isa: 1,
  dalawa: 2,
  tatlo: 3,
  apat: 4,
  lima: 5,
  anim: 6,
  i: 1,
  ii: 2,
  iii: 3,
};

const NUM = String.raw`(?:\d+\s+\d\/\d|\d+\/\d+|\d+(?:\.\d+)?|half|one|two|three|four|five|six|seven|eight|isa|dalawa|tatlo|apat|lima|anim|kalahati|iii|ii|i)`;
const RANGE_SEP = String.raw`(?:-|to|or|hanggang)`;
const QTY = String.raw`${NUM}(?:\s*${RANGE_SEP}\s*${NUM})?`;

const UNIT_WORDS = [
  String.raw`tsps?|teaspoon(?:ful)?s?|kutsarita`,
  String.raw`tbsps?|tablespoon(?:ful)?s?|kutsara`,
  String.raw`tablets?|tabs?|tableta`,
  String.raw`capsules?|caps?|kapsula`,
  String.raw`mls?|cc|milliliters?|millilitres?|mililitro`,
  String.raw`drops?|gtts?|patak`,
  String.raw`puffs?|buga|sprays?`,
  String.raw`units?|yunit`,
  String.raw`sachets?`,
  String.raw`amp(?:ule|oule)?s?`,
].join("|");

function classifyUnit(u: string): AmountUnit | null {
  if (/^(?:tsps?|teaspoon|kutsarita)/.test(u)) return "tsp";
  if (/^(?:tbsps?|tablespoon|kutsara)/.test(u)) return "tbsp";
  if (/^(?:tablet|tab|tableta)/.test(u)) return "tablet";
  if (/^(?:capsule|cap|kapsula)/.test(u)) return "capsule";
  if (/^(?:ml|cc|milli|mili)/.test(u)) return "ml";
  if (/^(?:drop|gtt|patak)/.test(u)) return "drop";
  if (/^(?:puff|buga|spray)/.test(u)) return "puff";
  if (/^(?:unit|yunit)/.test(u)) return "unit";
  if (/^sachet/.test(u)) return "sachet";
  if (/^amp/.test(u)) return "ampule";
  return null;
}

function parseNum(tok: string): number | null {
  const t = tok.trim();
  if (Object.hasOwn(WORD_NUM, t)) return WORD_NUM[t];
  let m = /^(\d+)\s+(\d)\/(\d)$/.exec(t);
  if (m) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  m = /^(\d+)\/(\d+)$/.exec(t);
  if (m) return Number(m[2]) === 0 ? null : Number(m[1]) / Number(m[2]);
  if (/^\d+(?:\.\d+)?$/.test(t)) return Number.parseFloat(t);
  return null;
}

function parseQty(str: string): { min: number; max?: number } | null {
  const m = new RegExp(`^(${NUM})(?:\\s*${RANGE_SEP}\\s*(${NUM}))?$`).exec(str.trim());
  if (!m) return null;
  const min = parseNum(m[1]);
  if (min === null) return null;
  if (m[2] === undefined) return { min };
  const max = parseNum(m[2]);
  if (max === null || max <= min) return { min }; // "5-1"? ignore the bad max
  return { min, max };
}

const AMOUNT_RE_SRC = String.raw`\b(${QTY})\s*(${UNIT_WORDS})\b`;

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

function normalize(raw: string): string {
  let s = raw
    // Unicode fractions first (NFKC would turn "1½" into "11/2").
    .replace(/(\d)\s*½/g, "$1 1/2")
    .replace(/(\d)\s*¼/g, "$1 1/4")
    .replace(/(\d)\s*¾/g, "$1 3/4")
    .replace(/½/g, "1/2")
    .replace(/¼/g, "1/4")
    .replace(/¾/g, "3/4")
    .normalize("NFKC")
    .replace(/[⁄∕]/g, "/")
    .replace(/[×✕✖]/g, " x ")
    .replace(/[–—]/g, "-")
    .toLowerCase();
  // "b.i.d." "p.r.n." "a.c." -> "bid" "prn" "ac"
  s = s.replace(/\b(?:[a-z]\.){2,4}/g, (m) => m.replace(/\./g, ""));
  // separate digits and letters: "500mg" -> "500 mg", "q6h" -> "q 6 h", "x7" -> "x 7"
  s = s.replace(/(\d)([a-z])/g, "$1 $2").replace(/([a-z])(\d)/g, "$1 $2");
  // punctuation that only separates words
  s = s.replace(/[,;:()[\]{}"'`]/g, " ");
  // sentence periods (keep decimals like 2.5)
  s = s.replace(/\.(?!\d)/g, " ");
  return s.replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Consumption helpers: each matcher removes what it recognised from the text,
// so whatever is left at the end is, by definition, not understood.
// ---------------------------------------------------------------------------

interface State {
  s: string;
}

function take(st: State, re: RegExp): RegExpExecArray | null {
  const m = re.exec(st.s);
  if (!m) return null;
  st.s = st.s.slice(0, m.index) + " " + st.s.slice(m.index + m[0].length);
  return m;
}

function takeAll(st: State, re: RegExp): RegExpExecArray[] {
  const out: RegExpExecArray[] = [];
  for (let i = 0; i < 20; i++) {
    const m = take(st, re);
    if (!m) break;
    out.push(m);
  }
  return out;
}

const IGNORABLE = new Set([
  "sig", "rx", "take", "po", "ng", "ang", "mo", "the", "a", "an", "of", "and", "at", "in", "on", "to", "per", "each",
  "&", "tab", "tabs", "tablet", "tablets", "cap", "caps", "capsule", "capsules", "tableta", "kapsula", "ito", "ay", "i",
  "pls", "please", "only", "lang", "meds", "x", "-", "/", "+",
]);

// ---------------------------------------------------------------------------
// The parser
// ---------------------------------------------------------------------------

interface FreqCandidate {
  key: string;
  freq: Frequency;
  /** True when it came from the abbreviation "OD" (which can also mean "right eye"). */
  fromOdAbbrev?: boolean;
}

function flag(code: FlagCode, field: SigField, tl: string, en: string, detail?: string): SigFlag {
  return { code, field, tl, en, ...(detail ? { detail } : {}) };
}

const COUNT_WORDS: Record<string, number> = {
  once: 1, twice: 2, thrice: 3, "one time": 1, "two times": 2, "three times": 3, "four times": 4, "five times": 5,
};
const TL_COUNT: Record<string, number> = { isang: 1, dalawang: 2, tatlong: 3, "apat na": 4, limang: 5 };

export function parseSig(input: string, opts: ParseOptions = {}): ParsedSig {
  const raw = (input ?? "").trim();
  const flags: SigFlag[] = [];

  const empty = (): ParsedSig => ({
    raw,
    amount: null,
    frequency: null,
    timing: null,
    route: null,
    duration: null,
    prn: false,
    slots: [],
    slotsBasis: "none",
    indicationRaw: null,
    unrecognized: [],
    flags: [
      flag("empty", "text", "Walang nabasa na tagubilin. " + UNREADABLE_TL + ".", "No instructions could be read. " + UNREADABLE_EN + "."),
    ],
    needsReview: true,
    tagalog: UNREADABLE_TL,
    english: UNREADABLE_EN,
  });

  if (!raw) return empty();

  // Uppercase "PO" (by mouth) must be read from the original: lower-case "po" is the
  // Filipino politeness particle ("inumin po") and means nothing medical.
  const hasUpperPO = /(?:^|[^A-Za-z])(?:PO|P\.O\.|p\.o\.)(?![A-Za-z])/.test(raw);

  const st: State = { s: normalize(raw) };

  // ---- 0. markers for text the reader could not read ------------------------
  if (take(st, /\?{2,}|\billegible\b|\bunreadable\b|\bhindi mabasa\b|\[\s*\]/)) {
    flags.push(
      flag("unreadable_part", "text", "May bahagi ng tagubilin na hindi mabasa. " + UNREADABLE_TL + ".", "Part of the instructions could not be read. " + UNREADABLE_EN + "."),
    );
  }

  // ---- 1. things that look like numbers but are not the dose ----------------
  // strength written inside the sig: "500 mg", "250 mg/5 ml"
  takeAll(st, /\b\d+(?:\.\d+)?\s*(?:mg|mcg|ug|µg|g|iu|meq)\b(?:\s*\/\s*\d*(?:\.\d+)?\s*(?:ml|mls|g)\b)?/);
  // quantity dispensed: "#30", "disp 30", "qty 30"
  takeAll(st, /#\s*\d+(?:\s*(?:tabs?|tablets?|caps?|capsules?|bottles?|pcs))?\b/);
  takeAll(st, /\b(?:disp(?:ense)?|qty|quantity)\.?\s*[:#]?\s*\d+(?:\s*(?:tabs?|tablets?|caps?|capsules?|bottles?|pcs))?\b/);

  // ---- 2. route -------------------------------------------------------------
  // (before frequency, so "per os" / "p.o." are not read as something else)
  const routes: Route[] = [];
  const addRoute = (r: Route) => {
    if (!routes.some((x) => x.code === r.code && x.eye === r.eye)) routes.push(r);
  };
  if (hasUpperPO) addRoute({ code: "PO" });
  // "inumin" / "uminom" = "drink": explicitly by mouth. (Plain "po" is only politeness.)
  if (takeAll(st, /\b(?:per os|by mouth|orally|oral|iinumin|inumin|uminom)\b/).length) addRoute({ code: "PO" });
  if (takeAll(st, /\b(?:sl|sublingual(?:ly)?|under the tongue|sa ilalim ng dila)\b/).length) addRoute({ code: "SL" });
  if (takeAll(st, /\b(?:topical(?:ly)?|apply|ipahid|pahid|on the skin|on skin|sa balat|affected area)\b/).length) addRoute({ code: "TOPICAL" });
  if (takeAll(st, /\b(?:inhale[ds]?|inhalation|inhaler|langhapin|via inhaler)\b/).length) addRoute({ code: "INHALE" });
  if (takeAll(st, /\b(?:im|intramuscular(?:ly)?)\b/).length) addRoute({ code: "IM" });
  if (takeAll(st, /\b(?:sc|sq|subq|subcut(?:aneous(?:ly)?)?)\b/).length) addRoute({ code: "SC" });
  if (takeAll(st, /\b(?:iv|intravenous(?:ly)?)\b/).length) addRoute({ code: "IV" });
  let eyeContext = false;
  {
    const both = take(st, /\b(?:both eyes|each eye|sa magkabilang mata|ou)\b/);
    const right = take(st, /\b(?:right eye|sa kanang mata)\b/);
    const left = take(st, /\b(?:left eye|sa kaliwang mata|os)\b/);
    const generic = take(st, /\b(?:ophthalmic|eyes?|mata)\b/);
    if (both) addRoute({ code: "EYE", eye: "both" });
    if (right) addRoute({ code: "EYE", eye: "right" });
    if (left) addRoute({ code: "EYE", eye: "left" });
    if (generic && !both && !right && !left) addRoute({ code: "EYE" });
    eyeContext = !!(both || right || left || generic);
  }

  // ---- 3. frequency ---------------------------------------------------------
  const cands: FreqCandidate[] = [];
  const addFreq = (key: string, freq: Frequency, fromOdAbbrev = false) => {
    // the same meaning written two ways (e.g. "BID" and "twice a day") is not a conflict
    if (!cands.some((c) => c.key === key)) cands.push({ key, freq, fromOdAbbrev });
  };

  // every N hours / q6h / tuwing 6 oras (+ ranges)
  for (const m of takeAll(
    st,
    /\b(?:q\s*(\d{1,2})(?:\s*-\s*(\d{1,2}))?\s*(?:h|hr|hrs|hours?)|every\s*(\d{1,2})(?:\s*(?:-|to)\s*(\d{1,2}))?\s*(?:h|hr|hrs|hours?)|tuwing\s*(\d{1,2})(?:\s*(?:-|hanggang)\s*(\d{1,2}))?\s*(?:oras|hr|hrs|h))\b/,
  )) {
    const min = Number(m[1] ?? m[3] ?? m[5]);
    const maxRaw = m[2] ?? m[4] ?? m[6];
    const max = maxRaw ? Number(maxRaw) : undefined;
    if (min > 0 && (max === undefined || max > min)) {
      addFreq(`H${min}-${max ?? ""}`, { code: "Q_HOURS", every: { min, ...(max ? { max } : {}) } });
    }
  }
  // every N days / q2d
  for (const m of takeAll(st, /\b(?:q|every|tuwing)\s*(\d{1,2})\s*(?:d|days?|araw)\b/)) {
    const n = Number(m[1]);
    if (n > 0) addFreq(`D${n}`, { code: "Q_DAYS", every: { min: n } });
  }
  if (takeAll(st, /\b(?:qod|every other day|alternate days?|tuwing ikalawang araw|every 2nd day)\b/).length) {
    addFreq("QOD", { code: "QOD" });
  }
  if (
    takeAll(st, /\b(?:once (?:a |per )?week(?:ly)?|weekly|qweek|q week|isang beses isang linggo|every week|tuwing linggo|1\s*x\s*(?:a |per )?(?:week|wk))\b/).length
  ) {
    addFreq("WEEKLY", { code: "WEEKLY" });
  }
  // "2x a day", "3 times a day", "2 beses sa isang araw"
  for (const m of takeAll(st, /\b(\d{1,2})\s*(?:x|times?|beses|ulit)\s*(?:a|per|sa|isang|each|\/)?\s*(?:day|daily|araw)\b/)) {
    addCount(Number(m[1]));
  }
  for (const m of takeAll(
    st,
    /\b(once|twice|thrice|one time|two times|three times|four times|five times)\s*(?:a|per|sa|isang|each)?\s*(?:day|daily|araw)\b/,
  )) {
    addCount(COUNT_WORDS[m[1]]);
  }
  for (const m of takeAll(st, /\b(isang|dalawang|tatlong|apat na|limang)\s*beses\s*(?:sa\s*)?(?:isang\s*)?araw\b/)) {
    addCount(TL_COUNT[m[1]]);
  }
  function addCount(n: number) {
    if (!(n >= 1 && n <= 12)) return;
    const code: FreqCode = n === 1 ? "OD" : n === 2 ? "BID" : n === 3 ? "TID" : n === 4 ? "QID" : "TIMES";
    addFreq(`N${n}`, { code, perDay: n });
  }
  // abbreviations
  if (takeAll(st, /\bqid\b/).length) addFreq("N4", { code: "QID", perDay: 4 });
  if (takeAll(st, /\btid\b/).length) addFreq("N3", { code: "TID", perDay: 3 });
  if (takeAll(st, /\bbid\b/).length) addFreq("N2", { code: "BID", perDay: 2 });
  {
    const od = takeAll(st, /\b(?:od|qd)\b/);
    if (od.length) {
      const fromOd = od.some((m) => m[0] === "od");
      if (cands.some((c) => c.key === "N1")) {
        /* already have it from words */
      } else {
        addFreq("N1", { code: "OD", perDay: 1 }, fromOd);
      }
    }
  }

  // words for times of day (these are the doctor *writing* the time -> basis "written")
  const written = new Set<SlotId>();
  let sawMealSlot = false;
  let mealTiming: Timing | null = null;
  const mealSlot: Record<string, SlotId> = { breakfast: "umaga", lunch: "tanghali", dinner: "gabi", supper: "gabi" };
  for (const m of takeAll(st, /\b(before|after|with)\s+(breakfast|lunch|dinner|supper)\b/)) {
    written.add(mealSlot[m[2]]);
    sawMealSlot = true;
    const kind: TimingKind = m[1] === "before" ? "AC" : m[1] === "after" ? "PC" : "WITH_MEALS";
    if (mealTiming && mealTiming.kind !== kind) mealTiming = { kind: "WITH_MEALS", leadMinutes: -1 }; // marks conflict below
    else mealTiming = { kind };
  }
  if (takeAll(st, /\b(?:qhs|hs|at bedtime|bedtime|before bed|bago matulog|sa pagtulog|pagtulog)\b/).length) written.add("bago_matulog");
  if (takeAll(st, /\b(?:qam|q am|every morning|in the morning|sa umaga|tuwing umaga|umaga|morning|am)\b/).length) written.add("umaga");
  if (takeAll(st, /\b(?:noon|midday|lunch ?time|sa tanghali|tuwing tanghali|tanghali)\b/).length) written.add("tanghali");
  if (takeAll(st, /\b(?:mid-?afternoon|afternoon|sa hapon|tuwing hapon|hapon)\b/).length) written.add("hapon");
  if (takeAll(st, /\b(?:qpm|q pm|every evening|every night|nightly|in the evening|at night|evening|night|sa gabi|tuwing gabi|gabi|pm)\b/).length) written.add("gabi");

  // as needed / right now
  let prn = false;
  if (takeAll(st, /\b(?:prn|as needed|if needed|when needed|as required|kung kailangan|kapag kailangan|pag kailangan)\b/).length) prn = true;
  if (takeAll(st, /\b(?:stat|now|ngayon din|immediately|agad)\b/).length) addFreq("STAT", { code: "STAT" });

  // "daily" with no count: only counts if nothing else says how often
  const weakDaily = takeAll(st, /\b(?:daily|everyday|every day|araw-araw|araw araw)\b/).length > 0;

  // ---- 4. timing relative to meals -----------------------------------------
  const timings: Timing[] = [];
  const addTiming = (t: Timing) => {
    if (!timings.some((x) => x.kind === t.kind && x.leadMinutes === t.leadMinutes)) timings.push(t);
  };
  if (mealTiming) addTiming(mealTiming);
  for (const m of takeAll(
    st,
    /\b(?:(\d{1,3})\s*(min(?:ute)?s?|hrs?|hours?|oras|minuto)\s*)?(?:ac|before (?:meals?|food|eating)|bago kumain|bago (?:ang )?pagkain|ante cibum)\b/,
  )) {
    let lead: number | undefined;
    if (m[1]) {
      const n = Number(m[1]);
      lead = /^(?:hrs?|hours?|oras)$/.test(m[2]) ? n * 60 : n;
    }
    addTiming({ kind: "AC", ...(lead ? { leadMinutes: lead } : {}) });
  }
  if (takeAll(st, /\b(?:pc|after (?:meals?|food|eating)|pagkatapos kumain|pagkatapos ng pagkain|pagkakain|post cibum)\b/).length) addTiming({ kind: "PC" });
  if (takeAll(st, /\b(?:with (?:meals?|food)|c meals|cum meals|kasabay (?:ng )?(?:pagkain|kumain)|habang kumakain|during meals)\b/).length) addTiming({ kind: "WITH_MEALS" });
  if (takeAll(st, /\b(?:empty stomach|walang laman (?:ang|na) (?:tiyan|sikmura)|sa walang laman)\b/).length) addTiming({ kind: "EMPTY_STOMACH" });

  // ---- 5. duration ----------------------------------------------------------
  const durations: Duration[] = [];
  const addDuration = (d: Duration) => {
    if (!durations.some((x) => x.kind === d.kind && x.value === d.value)) durations.push(d);
  };
  if (takeAll(st, /\b(?:until (?:finished|gone|all (?:gone|taken))|hanggang maubos|ubusin|finish (?:all|the (?:course|bottle)))\b/).length) {
    addDuration({ kind: "until_finished" });
  }
  if (takeAll(st, /\b(?:maintenance|maint|long[- ]term|lifelong|continuous(?:ly)?|ongoing|tuloy[- ]tuloy|habambuhay)\b/).length) {
    addDuration({ kind: "maintenance" });
  }
  for (const m of takeAll(
    st,
    /(?:\b(?:x|for|sa loob ng|good for|para sa|hanggang)\s+)?\b(\d{1,3})\s*(days?|d|araw|weeks?|wks?|wk|linggo|months?|mos?|mo|buwan)\b/,
  )) {
    const n = Number(m[1]);
    const u = m[2];
    const kind: DurationKind = /^(?:d|day|days|araw)$/.test(u) ? "days" : /^(?:w|wk|wks|week|weeks|linggo)$/.test(u) ? "weeks" : "months";
    if (n > 0) addDuration({ kind, value: n });
  }
  let bareX = false;
  if (take(st, /\bx\s*(\d{1,3})\b/)) bareX = true; // "x 7" - days? weeks? never guess

  // ---- 6. amount ------------------------------------------------------------
  const amounts: Amount[] = [];
  for (const m of takeAll(st, new RegExp(AMOUNT_RE_SRC))) {
    const q = parseQty(m[1]);
    const unit = classifyUnit(m[2]);
    if (q && unit) amounts.push({ ...q, unit });
  }
  let amount: Amount | null = null;
  if (amounts.length) {
    amount = amounts[0];
    for (const other of amounts.slice(1)) {
      if (!equivalentAmounts(amount, other)) {
        flags.push(
          flag("multiple_amounts", "amount", "May higit sa isang dami na nakasulat. Piliin ang tama.", "More than one amount is written. Pick the right one."),
        );
        break;
      }
    }
  } else {
    // a lone bare number, e.g. "1 BID pc": the unit was not written -> flagged
    const bare = take(st, /(?:^|\s)(\d+(?:\.\d+)?|\d+\/\d+)(?=\s|$)/);
    if (bare) {
      const q = parseQty(bare[1]);
      if (q) amount = { ...q, unit: null };
    }
  }

  // ---- 7. what is left is NOT understood -----------------------------------
  const ignore = new Set((opts.ignoreWords ?? []).flatMap((w) => normalize(w).split(" ")).filter(Boolean));
  let tokens = st.s
    .split(/[\s/,;.+&-]+/)
    .map((t) => t.trim())
    .filter((t) => t && !IGNORABLE.has(t) && !ignore.has(t) && /[a-z0-9]/.test(t));

  // "for pain" -> kept verbatim as the doctor's own words, never translated or used automatically
  let indicationRaw: string | null = null;
  const forIdx = tokens.findIndex((t) => t === "for" || t === "para");
  if (forIdx >= 0) {
    const words = tokens.slice(forIdx + 1).filter((t) => t !== "sa");
    if (words.length) indicationRaw = words.join(" ");
    tokens = tokens.slice(0, forIdx);
  }
  const unrecognized = tokens;
  if (unrecognized.length) {
    flags.push(
      flag(
        "unrecognized_text",
        "text",
        `Hindi naintindihan ang: "${unrecognized.join(" ")}". Itanong sa pharmacist o doktor.`,
        `Not understood: "${unrecognized.join(" ")}". Ask your pharmacist or doctor.`,
        unrecognized.join(" "),
      ),
    );
  }

  // ---- 8. resolve the pieces -----------------------------------------------
  // route
  let route: Route | null = null;
  if (routes.length === 1) route = routes[0];
  else if (routes.length > 1) {
    flags.push(flag("route_conflict", "route", "Magkaiba ang nakasulat na paraan ng paggamit. Piliin ang tama.", "Different ways of taking it are written. Pick the right one."));
  }

  // timing
  let timing: Timing | null = null;
  if (timings.some((t) => t.leadMinutes === -1)) {
    flags.push(flag("timing_conflict", "timing", "Magkasalungat ang oras kaugnay ng pagkain. Piliin ang tama.", "The meal timing is contradictory. Pick the right one."));
  } else if (timings.length === 1) timing = timings[0];
  else if (timings.length > 1) {
    flags.push(flag("timing_conflict", "timing", "Magkasalungat ang oras kaugnay ng pagkain. Piliin ang tama.", "The meal timing is contradictory. Pick the right one."));
  }

  // duration
  let duration: Duration | null = null;
  if (durations.length === 1) duration = durations[0];
  else if (durations.length > 1) {
    flags.push(flag("duration_conflict", "duration", "Magkasalungat ang haba ng pag-inom. Piliin ang tama.", "The length of treatment is contradictory. Pick the right one."));
  }
  if (bareX) {
    flags.push(
      flag("duration_unit_missing", "duration", 'May "x" at numero pero walang "araw/linggo/buwan". Itanong sa doktor.', 'There is an "x" and a number but no "days/weeks/months". Ask the doctor.'),
    );
  }

  // frequency
  let frequency: Frequency | null = null;
  if (cands.length > 1) {
    flags.push(flag("frequency_conflict", "frequency", "Magkasalungat ang dalas ng pag-inom. Piliin ang tama.", "How often to take it is contradictory. Pick the right one."));
  } else if (cands.length === 1) {
    frequency = cands[0].freq;
    // "OD" next to eye drops / an eye route can mean "right eye" - never pick one
    if (cands[0].fromOdAbbrev && (eyeContext || amount?.unit === "drop" || opts.dosageForm === "drops")) {
      frequency = null;
      flags.push(
        flag("od_ambiguous_eye", "frequency", "Ang \"OD\" ay maaaring \"isang beses isang araw\" o \"kanang mata\". Itanong sa doktor.", "\"OD\" can mean \"once a day\" or \"right eye\". Ask the doctor."),
      );
    }
  }
  // time of day written but no count: the count is the number of slots written
  if (!frequency && cands.length === 0 && written.size > 0) {
    const n = written.size;
    frequency = { code: n === 1 ? "OD" : n === 2 ? "BID" : n === 3 ? "TID" : n === 4 ? "QID" : "TIMES", perDay: n };
  } else if (!frequency && cands.length === 0 && weakDaily) {
    frequency = { code: "OD", perDay: 1 };
  }

  // ---- 9. schedule slots ----------------------------------------------------
  const { slots, basis } = deriveSlots(frequency, written, timing, prn, sawMealSlot, flags);

  // ---- 10. completeness checks ---------------------------------------------
  if (amount) {
    if (amount.unit === null) {
      flags.push(flag("missing_unit", "amount", "Walang nakasulat na unit (tableta, kapsula, mL...). Kumpirmahin.", "No unit is written (tablet, capsule, mL...). Please confirm."));
    }
    if (amount.max !== undefined) {
      flags.push(flag("amount_range", "amount", "May saklaw ang dami (hal. 1-2). Itanong sa doktor kung ilan.", "The amount is a range (e.g. 1-2). Ask the doctor how many."));
    }
    if (amount.unit === "tablet" || amount.unit === "capsule") {
      for (const v of [amount.min, amount.max]) {
        if (v !== undefined && !isNiceFraction(v)) {
          flags.push(flag("odd_fraction", "amount", "Hindi karaniwang hati ng tableta/kapsula. Kumpirmahin.", "Unusual fraction of a tablet/capsule. Please confirm."));
          break;
        }
      }
    }
    const expected = expectedUnits(opts.dosageForm);
    if (amount.unit && expected && !expected.includes(amount.unit)) {
      flags.push(
        flag(
          "unit_form_mismatch",
          "amount",
          `Ang unit na nakasulat (${unitName(amount.unit, "tl")}) ay hindi bagay sa uri ng gamot (${opts.dosageForm}). Kumpirmahin.`,
          `The written unit (${unitName(amount.unit, "en")}) does not fit the medicine form (${opts.dosageForm}). Please confirm.`,
        ),
      );
    }
  } else if (route?.code !== "TOPICAL" && opts.dosageForm !== "cream") {
    flags.push(flag("missing_amount", "amount", "Walang nakasulat na dami (ilang tableta/kutsarita...). Itanong sa doktor.", "No amount is written (how many tablets/teaspoons...). Ask the doctor."));
  }
  if (!frequency && !prn && cands.length === 0) {
    flags.push(flag("missing_frequency", "frequency", "Walang nakasulat na dalas (ilang beses sa isang araw). Itanong sa doktor.", "How often is not written. Ask the doctor."));
  }
  if (prn && !frequency && cands.length === 0) {
    flags.push(
      flag("prn_no_interval", "frequency", 'Nakasulat lang "kung kailangan" pero walang pagitan ng oras. Itanong sa doktor kung gaano kadalas.', 'Only "as needed" is written, with no time between doses. Ask the doctor how often.'),
    );
  }

  const result: ParsedSig = {
    raw,
    amount,
    frequency,
    timing,
    route,
    duration,
    prn,
    slots,
    slotsBasis: basis,
    indicationRaw,
    unrecognized,
    flags,
    needsReview: flags.length > 0,
    tagalog: "",
    english: "",
  };

  const nothingRecognised =
    !amount && !frequency && !timing && !route && !duration && !prn && slots.length === 0 && cands.length === 0;
  if (nothingRecognised) {
    result.tagalog = UNREADABLE_TL;
    result.english = UNREADABLE_EN;
    result.needsReview = true;
    if (!flags.length) flags.push(flag("unrecognized_text", "text", "Walang naintindihan sa tagubilin. " + UNREADABLE_TL + ".", "Nothing in the instructions was understood. " + UNREADABLE_EN + "."));
  } else {
    result.tagalog = composeSig(result, "tl");
    result.english = composeSig(result, "en");
  }
  return result;
}

// ---------------------------------------------------------------------------
// Slot logic
// ---------------------------------------------------------------------------

function deriveSlots(
  freq: Frequency | null,
  written: Set<SlotId>,
  timing: Timing | null,
  prn: boolean,
  sawMealSlot: boolean,
  flags: SigFlag[],
): { slots: SlotId[]; basis: SlotsBasis } {
  const mealLinked = timing?.kind === "AC" || timing?.kind === "PC" || timing?.kind === "WITH_MEALS";
  const writtenSlots = SLOT_IDS.filter((s) => written.has(s));

  if (freq?.code === "STAT") return { slots: [], basis: "none" };

  if (writtenSlots.length > 0) {
    const n = freq?.perDay;
    if (n !== undefined && n !== writtenSlots.length) {
      // "QID ac & hs" = three meals + bedtime is the one standard combination
      if (freq?.code === "QID" && writtenSlots.length === 1 && writtenSlots[0] === "bago_matulog" && mealLinked && !sawMealSlot) {
        return { slots: ["umaga", "tanghali", "gabi", "bago_matulog"], basis: "standard" };
      }
      flags.push(
        flag(
          "slots_mismatch",
          "slots",
          "Hindi tugma ang bilang ng beses sa mga oras na nakasulat. Piliin ang tama.",
          "The number of times does not match the times of day written. Pick the right one.",
        ),
      );
    }
    return { slots: writtenSlots, basis: "written" };
  }

  if (prn) return { slots: [], basis: "none" };
  if (!freq) return { slots: [], basis: "none" };

  const assumed = (slots: SlotId[]) => {
    flags.push(
      flag(
        "slots_assumed",
        "slots",
        "Hindi nakasulat kung anong oras. Pumili ng oras na susundin.",
        "The time of day is not written. Choose when to take it.",
      ),
    );
    return { slots, basis: "assumed" as const };
  };
  const unplaceable = () => {
    flags.push(
      flag(
        "slots_unplaceable",
        "slots",
        "Hindi maisingit sa iskedyul ng araw. Pumili ng oras o ipakita bilang nakasulat.",
        "This does not fit the daily schedule. Choose times, or show it as written.",
      ),
    );
    return { slots: [] as SlotId[], basis: "none" as const };
  };

  switch (freq.code) {
    case "OD":
      return assumed(["umaga"]);
    case "BID":
      return { slots: ["umaga", "gabi"], basis: "standard" };
    case "TID":
      return { slots: ["umaga", "tanghali", "gabi"], basis: "standard" };
    case "QID":
      return mealLinked
        ? { slots: ["umaga", "tanghali", "gabi", "bago_matulog"], basis: "standard" }
        : assumed(["umaga", "tanghali", "hapon", "gabi"]);
    case "Q_HOURS": {
      const n = freq.every?.min;
      if (freq.every?.max === undefined) {
        if (n === 12) return { slots: ["umaga", "gabi"], basis: "standard" };
        if (n === 24) return assumed(["umaga"]);
        if (n === 8) return assumed(["umaga", "hapon", "gabi"]);
        if (n === 6) return assumed(["umaga", "tanghali", "hapon", "gabi"]);
      }
      return unplaceable();
    }
    default:
      return unplaceable(); // TIMES (5+), Q_DAYS, QOD, WEEKLY
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function equivalentAmounts(a: Amount, b: Amount): boolean {
  if (a.unit === b.unit && a.min === b.min && a.max === b.max) return true;
  const toMl = (x: Amount): number | null =>
    x.max !== undefined ? null : x.unit === "ml" ? x.min : x.unit === "tsp" ? x.min * 5 : x.unit === "tbsp" ? x.min * 15 : null;
  const ma = toMl(a);
  const mb = toMl(b);
  return ma !== null && mb !== null && Math.abs(ma - mb) < 0.01;
}

function isNiceFraction(v: number): boolean {
  const frac = v - Math.floor(v);
  return frac === 0 || frac === 0.5 || frac === 0.25 || frac === 0.75;
}

function expectedUnits(form: string | undefined): AmountUnit[] | null {
  switch ((form ?? "").toLowerCase()) {
    case "tablet":
      return ["tablet"];
    case "capsule":
      return ["capsule"];
    case "syrup":
    case "suspension":
      return ["tsp", "tbsp", "ml"];
    case "drops":
      return ["drop", "ml"];
    case "inhaler":
      return ["puff"];
    case "injection":
      return ["ml", "unit", "ampule"];
    default:
      return null;
  }
}

function unitName(u: AmountUnit, lang: Lang): string {
  const tl: Record<AmountUnit, string> = {
    tablet: "tableta", capsule: "kapsula", tsp: "kutsarita", tbsp: "kutsara", ml: "mL",
    drop: "patak", puff: "buga", unit: "yunit", sachet: "sachet", ampule: "ampule",
  };
  const en: Record<AmountUnit, string> = {
    tablet: "tablet", capsule: "capsule", tsp: "teaspoon", tbsp: "tablespoon", ml: "mL",
    drop: "drop", puff: "puff", unit: "unit", sachet: "sachet", ampule: "ampule",
  };
  return (lang === "tl" ? tl : en)[u];
}

// ---------------------------------------------------------------------------
// Composing the sentence (also used after the reviewer edits the fields)
// ---------------------------------------------------------------------------

type Composable = Pick<ParsedSig, "amount" | "frequency" | "timing" | "route" | "duration" | "prn" | "slots">;

function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

/** "1 tableta", "kalahating tableta", "1 at kalahating tableta", "1 kutsarita (5 mL)". */
export function formatAmount(a: Amount, lang: Lang): string {
  const unitWord = (qty: number): string => {
    if (!a.unit) return "";
    if (lang === "tl") return unitName(a.unit, "tl");
    const base = unitName(a.unit, "en");
    return qty === 1 || a.unit === "ml" ? base : `${base}s`;
  };
  const wordy = a.unit === "tablet" || a.unit === "capsule" || a.unit === "tsp" || a.unit === "tbsp";
  const qtyText = (q: number): string => {
    if (!wordy || Number.isInteger(q)) return fmtNum(q);
    const whole = Math.floor(q);
    const frac = q - whole;
    if (lang === "tl") {
      const f = frac === 0.5 ? "kalahati" : frac === 0.25 ? "isang-kapat" : frac === 0.75 ? "tatlong-kapat" : null;
      if (!f) return fmtNum(q);
      if (whole === 0) return f === "kalahati" ? "kalahating" : f === "isang-kapat" ? "isang-kapat na" : "tatlong-kapat na";
      return `${whole} at ${f === "kalahati" ? "kalahating" : f === "isang-kapat" ? "isang-kapat na" : "tatlong-kapat na"}`;
    }
    const f = frac === 0.5 ? "½" : frac === 0.25 ? "¼" : frac === 0.75 ? "¾" : null;
    if (!f) return fmtNum(q);
    return whole === 0 ? f : `${whole}${f}`;
  };

  let text: string;
  if (a.max !== undefined) {
    const joiner = lang === "tl" ? "hanggang" : "to";
    text = `${qtyText(a.min)} ${joiner} ${qtyText(a.max)} ${unitWord(a.max)}`.trim();
  } else {
    text = `${qtyText(a.min)} ${unitWord(a.min)}`.trim();
    if (lang === "en" && wordy && a.min < 1 && !Number.isInteger(a.min)) {
      // "½ tablet" reads better as "half a tablet"
      if (a.min === 0.5) text = `half a ${unitName(a.unit as AmountUnit, "en")}`;
    }
  }
  // spoons: always show the mL so a measuring cup can be used
  if ((a.unit === "tsp" || a.unit === "tbsp") && a.max === undefined) {
    const ml = a.min * (a.unit === "tsp" ? 5 : 15);
    text += ` (${fmtNum(ml)} mL)`;
  }
  return text;
}

function slotList(slots: SlotId[], lang: Lang): string {
  const names = slots.map((s) => SLOT_LABEL[lang][s].toLowerCase());
  if (names.length <= 1) return names.join("");
  const and = lang === "tl" ? "at" : "and";
  return `${names.slice(0, -1).join(", ")} ${and} ${names[names.length - 1]}`;
}

export function formatFrequency(p: Pick<Composable, "frequency" | "prn" | "slots">, lang: Lang): string {
  const f = p.frequency;
  let out = "";
  if (f) {
    const per = f.perDay ?? 1;
    const bedtimeOnly = f.code === "OD" && p.slots.length === 1 && p.slots[0] === "bago_matulog";
    const withSlots = (base: string) => (p.slots.length ? `${base} (${slotList(p.slots, lang)})` : base);
    switch (f.code) {
      case "OD":
        out = bedtimeOnly
          ? lang === "tl" ? "bago matulog" : "at bedtime"
          : withSlots(lang === "tl" ? "isang beses isang araw" : "once a day");
        break;
      case "BID":
        out = withSlots(lang === "tl" ? "2 beses isang araw" : "twice a day");
        break;
      case "TID":
        out = withSlots(lang === "tl" ? "3 beses isang araw" : "3 times a day");
        break;
      case "QID":
        out = withSlots(lang === "tl" ? "4 beses isang araw" : "4 times a day");
        break;
      case "TIMES":
        out = withSlots(lang === "tl" ? `${per} beses isang araw` : `${per} times a day`);
        break;
      case "Q_HOURS": {
        const r = f.every ? (f.every.max ? `${f.every.min} ${lang === "tl" ? "hanggang" : "to"} ${f.every.max}` : `${f.every.min}`) : "";
        out = lang === "tl" ? `tuwing ${r} oras` : `every ${r} hours`;
        break;
      }
      case "Q_DAYS": {
        const n = f.every?.min ?? 0;
        out = lang === "tl" ? `tuwing ${n} araw` : `every ${n} days`;
        break;
      }
      case "QOD":
        out = lang === "tl" ? "tuwing ikalawang araw" : "every other day";
        break;
      case "WEEKLY":
        out = lang === "tl" ? "isang beses isang linggo" : "once a week";
        break;
      case "STAT":
        out = lang === "tl" ? "ngayon din" : "right now";
        break;
    }
  }
  if (p.prn) {
    const prn = lang === "tl" ? "kung kailangan" : "as needed";
    out = out ? `${out} ${prn}` : prn;
  }
  return out;
}

export function formatTiming(t: Timing | null, lang: Lang): string {
  if (!t) return "";
  const lead = (() => {
    if (!t.leadMinutes) return "";
    const m = t.leadMinutes;
    if (m % 60 === 0) {
      const h = m / 60;
      return lang === "tl" ? `${h} oras ` : `${h} ${h === 1 ? "hour" : "hours"} `;
    }
    return lang === "tl" ? `${m} minuto ` : `${m} minutes `;
  })();
  switch (t.kind) {
    case "AC":
      return lang === "tl" ? `${lead}bago kumain` : `${lead}before meals`;
    case "PC":
      return lang === "tl" ? "pagkatapos kumain" : "after meals";
    case "WITH_MEALS":
      return lang === "tl" ? "kasabay ng pagkain" : "with meals";
    case "EMPTY_STOMACH":
      return lang === "tl" ? "sa walang laman na tiyan" : "on an empty stomach";
  }
}

export function formatDuration(d: Duration | null, lang: Lang): string {
  if (!d) return "";
  const n = d.value ?? 0;
  switch (d.kind) {
    case "maintenance":
      return lang === "tl" ? "araw-araw, tuloy-tuloy" : "every day, ongoing";
    case "until_finished":
      return lang === "tl" ? "hanggang maubos" : "until finished";
    case "days":
      return lang === "tl" ? `sa loob ng ${n} araw` : `for ${n} ${n === 1 ? "day" : "days"}`;
    case "weeks":
      return lang === "tl" ? `sa loob ng ${n} linggo` : `for ${n} ${n === 1 ? "week" : "weeks"}`;
    case "months":
      return lang === "tl" ? `sa loob ng ${n} buwan` : `for ${n} ${n === 1 ? "month" : "months"}`;
  }
}

export function formatRoute(r: Route | null, lang: Lang): string {
  if (!r) return "";
  if (lang === "tl") {
    switch (r.code) {
      case "PO": return "Iinumin";
      case "SL": return "Ilagay sa ilalim ng dila";
      case "TOPICAL": return "Ipahid sa balat";
      case "INHALE": return "Langhapin";
      case "EYE": return r.eye === "both" ? "Ipatak sa magkabilang mata" : r.eye === "right" ? "Ipatak sa kanang mata" : r.eye === "left" ? "Ipatak sa kaliwang mata" : "Ipatak sa mata";
      case "IM": return "Iturok sa kalamnan";
      case "SC": return "Iturok sa ilalim ng balat";
      case "IV": return "Ibibigay sa ugat";
    }
  }
  switch (r.code) {
    case "PO": return "By mouth";
    case "SL": return "Under the tongue";
    case "TOPICAL": return "Apply on the skin";
    case "INHALE": return "Inhale";
    case "EYE": return r.eye === "both" ? "In both eyes" : r.eye === "right" ? "In the right eye" : r.eye === "left" ? "In the left eye" : "In the eye";
    case "IM": return "Injection into the muscle";
    case "SC": return "Injection under the skin";
    case "IV": return "Into the vein";
  }
}

/**
 * Builds the sentence from structured fields. Used by the parser and again whenever
 * the reviewer changes a field, so the text always matches the fields (no free AI text).
 */
export function composeSig(p: Composable, lang: Lang): string {
  const parts: string[] = [];
  if (p.amount) parts.push(formatAmount(p.amount, lang));
  const freq = formatFrequency(p, lang);
  if (freq) parts.push(freq);
  const timing = formatTiming(p.timing, lang);
  if (timing) parts.push(timing);
  const dur = formatDuration(p.duration, lang);
  if (dur) parts.push(dur);
  const body = parts.join(", ");
  const route = formatRoute(p.route, lang);
  if (route && body) return `${route}: ${body}`;
  return route || body;
}

/** Short dose label for schedule tables: "1 tableta", "5 mL", "2 patak". */
export function doseLabel(a: Amount | null, lang: Lang): string {
  return a ? formatAmount(a, lang) : "";
}
