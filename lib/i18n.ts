/**
 * All user-facing text, Tagalog first, with English alongside.
 * Plain Tagalog, no medical jargon. Later milestones add more keys here.
 */
import type { Lang } from "./sig";

export type { Lang };

/** Must appear on every output (spec). */
export const DISCLAIMER: Record<Lang, string> = {
  tl: "Ito ay gabay lamang. Ang orihinal na reseta ang opisyal.",
  en: "This is a guide only. The original prescription is the official one.",
};

export const TAGLINE: Record<Lang, string> = {
  tl: "Para sa matanda, para matandaan",
  en: "For our elders, so they remember",
};

/** Shown whenever a picture is only a generic icon for the dosage form. */
export const ICON_ONLY_LABEL: Record<Lang, string> = {
  tl: "Larawan lang, hindi ang aktwal na gamot",
  en: "Illustration only, not the actual medicine",
};

export const STRINGS = {
  tl: {
    appName: "Tanda",
    skipToContent: "Lumaktaw sa nilalaman",
    nav: { home: "Simula", about: "Tungkol sa Tanda", samples: "Mga sample" },
    lang: { label: "Wika", tl: "Tagalog", en: "English" },

    home: {
      title: "Intindihin ang gamot, sa simpleng Tagalog.",
      body:
        "I-upload ang litrato ng reseta ng doktor. Gagawa ang Tanda ng malinaw na bersyon: malalaking letra, iskedyul na may larawan, at babasahin nang malakas. Susuriin muna ito ng isang tao bago maging pinal.",
      upload: "I-upload ang reseta",
      trySample: "Subukan ang sample",
      stepsTitle: "Paano ito gumagana",
      steps: [
        { title: "Kunan ng litrato", text: "Kuhanan ng litrato ang reseta, o pumili mula sa gallery." },
        { title: "Suriin ng tao", text: "Ang pasyente, kapamilya, o pharmacist ang kukumpirma sa bawat linya." },
        { title: "Pakinggan at ibahagi", text: "Pakinggan, i-print, o ipadala sa pamilya." },
      ],
      safetyTitle: "Mag-ingat tayo",
      safety:
        "Hindi nag-iimbento ang Tanda. Kapag hindi mabasa ang isang salita o numero, sasabihin nitong itanong sa pharmacist o doktor.",
    },

    samples: {
      title: "Mga sample na reseta",
      intro:
        "Gawa-gawa lang ang mga ito (SAMPLE), para sa demo. Ipinapakita rito kung paano isinasalin ng code ang mga pinaikling tagubilin sa Tagalog. Walang AI sa bahaging ito.",
      statusNote: "Preview ng tagasalin ng tagubilin. Ang buong daloy (pagsusuri, larawan ng gamot, pakikinggan) ay nasa mga susunod na hakbang.",
      fromImage: "Mula sa larawan",
      original: "Nakasulat sa reseta",
      tagalog: "Sa Tagalog",
      needsConfirm: "Kailangang kumpirmahin",
      lowConfidence: "Hindi tiyak ang pagbasa ng larawan",
      unreadableLine: "Hindi mabasa, itanong sa pharmacist o doktor",
      ok: "Malinaw",
    },

    about: {
      title: "Tungkol sa Tanda",
      lead:
        "Ang Tanda (“Para sa matanda, para matandaan”) ay tumutulong sa mga Pilipinong nakatatanda at sa kanilang pamilya na maintindihan ang kanilang mga gamot.",
      whyTitle: "Bakit mahalaga ito",
      stats: [
        {
          figure: "14%",
          text: "lang ng sinasabing tagubilin sa gamot ang naaalala ng mga tao. Mahigit 80% ang naaalala kapag may mga larawan (pictograph).",
          source: "Kessels 2003, J R Soc Med, na bumabanggit kay Houts et al. 1998",
        },
        {
          figure: "51.5%",
          text: "ng mga Pilipino ay may limitadong health literacy (kakayahang umintindi ng impormasyong pangkalusugan).",
          source: "Tolabing et al. 2022, pambansang survey",
        },
        {
          figure: "55.9%",
          text: "ng mga pasyente sa mga botika sa Maynila ay hindi naintindihan ang kanilang reseta.",
          source: "Acta Medica Philippina, 2013",
        },
      ],
      howTitle: "Paano ito gumagana",
      how: [
        "Kinukuha ng AI ang mga salita sa litrato ng reseta, bilang draft lang.",
        "Ang pagsasalin ng “1 tab BID pc” sa Tagalog ay ginagawa ng code na may malinaw na mga patakaran, hindi ng AI.",
        "Isang tao ang kumukumpirma sa bawat linya bago maging pinal.",
        "Makukuha mo ang malinaw na bersyon: malalaking letra, iskedyul na may larawan, babasahin nang malakas, maiipi-print, at maibabahagi sa pamilya.",
      ],
      rulesTitle: "Mga patakarang pangkaligtasan",
      rules: [
        "Ang AI ay nagda-draft lang. Isang tao ang kumukumpirma sa bawat linya.",
        "Hindi manghuhula. Kapag hindi mabasa, ang sasabihin: “Hindi mabasa, itanong sa pharmacist o doktor.”",
        "Walang idinadagdag na payo-medikal: walang bagong dosis, walang “para saan” maliban kung isinulat ng doktor o tinipa ng nag-check, at walang paghusga sa interaksyon ng gamot.",
        "Hindi kailanman AI ang gumagawa ng larawan ng gamot. Tunay na litrato lang ng aktwal na kahon, o payak na icon ng uri ng gamot.",
        "Laging may paalala: “Ito ay gabay lamang. Ang orihinal na reseta ang opisyal.”",
      ],
      privacyTitle: "Privacy",
      privacy: [
        "Hindi iniimbak ng Tanda ang litrato ng reseta pagkatapos basahin.",
        "Ang link para sa pamilya ay may kasamang pinakamaliit na datos lang, at mawawala pagkalipas ng 30 araw.",
        "Mahalaga: sa libreng bersyon ng Google Gemini, maaaring gamitin ng Google ang ipinadalang litrato para pagbutihin ang mga produkto nito, at maaaring mabasa ito ng mga tao ng Google. Kaya para sa demo, mga sample lang ang gamitin.",
      ],
      notAdvice: "Hindi pamalit ang Tanda sa payo ng doktor o pharmacist.",
    },

    upload: {
      title: "I-upload ang reseta",
      comingSoon: "Ginagawa pa ang bahaging ito (susunod na hakbang). Samantala, tingnan ang mga sample.",
      seeSamples: "Tingnan ang mga sample",
    },

    footer: {
      privacy: "Hindi iniimbak ng Tanda ang litrato ng reseta.",
      demo: "Prototype para sa hackathon. Walang totoong datos ng pasyente.",
    },
  },

  en: {
    appName: "Tanda",
    skipToContent: "Skip to content",
    nav: { home: "Home", about: "About Tanda", samples: "Samples" },
    lang: { label: "Language", tl: "Tagalog", en: "English" },

    home: {
      title: "Understand your medicines, in plain Tagalog.",
      body:
        "Upload a photo of the doctor's prescription. Tanda makes a clear version: large print, a picture schedule, and read-aloud. A person checks it before it becomes final.",
      upload: "Upload the prescription",
      trySample: "Try a sample",
      stepsTitle: "How it works",
      steps: [
        { title: "Take a photo", text: "Photograph the prescription, or pick one from your gallery." },
        { title: "A person checks", text: "The patient, a family member or a pharmacist confirms every line." },
        { title: "Listen and share", text: "Listen to it, print it, or send it to the family." },
      ],
      safetyTitle: "Let's be careful",
      safety:
        "Tanda never makes things up. If a word or number can't be read, it says to ask your pharmacist or doctor.",
    },

    samples: {
      title: "Sample prescriptions",
      intro:
        "These are made up (SAMPLE) for the demo. This page shows how plain code turns prescription shorthand into Tagalog. No AI is used for this part.",
      statusNote: "Preview of the instruction translator. The full flow (review, medicine photos, read-aloud) comes in later steps.",
      fromImage: "From the image",
      original: "Written on the prescription",
      tagalog: "In Tagalog",
      needsConfirm: "Needs confirming",
      lowConfidence: "The photo reading is uncertain",
      unreadableLine: "Can't read this, ask your pharmacist or doctor",
      ok: "Clear",
    },

    about: {
      title: "About Tanda",
      lead:
        "Tanda (“For our elders, so they remember”) helps Filipino seniors and their families understand their medicines.",
      whyTitle: "Why it matters",
      stats: [
        {
          figure: "14%",
          text: "of spoken medical instructions are remembered, compared with over 80% when pictographs are used.",
          source: "Kessels 2003, J R Soc Med, citing Houts et al. 1998",
        },
        {
          figure: "51.5%",
          text: "of Filipinos have limited health literacy.",
          source: "Tolabing et al. 2022, national survey",
        },
        {
          figure: "55.9%",
          text: "of patients at Manila pharmacies misunderstood their prescription.",
          source: "Acta Medica Philippina, 2013",
        },
      ],
      howTitle: "How it works",
      how: [
        "AI reads the words from the photo of the prescription, as a draft only.",
        "Turning “1 tab BID pc” into Tagalog is done by code with clear rules, not by AI.",
        "A person confirms every line before it becomes final.",
        "You get the clear version: large print, a picture schedule, read aloud, printable, and shareable with family.",
      ],
      rulesTitle: "Safety rules",
      rules: [
        "The AI only drafts. A human confirms every line.",
        "No guessing. If it can't be read, it says: “Can't read this, ask your pharmacist or doctor.”",
        "No medical advice is added: no new doses, no “what it's for” unless the doctor wrote it or the reviewer typed it, and no interaction judgments.",
        "Medicine pictures are never AI-generated. Only a real photo of the actual box, or a plain icon of the dosage form.",
        "Every output says: “This is a guide only. The original prescription is the official one.”",
      ],
      privacyTitle: "Privacy",
      privacy: [
        "Tanda does not store the prescription photo after it is read.",
        "The family share link holds only the minimum data and disappears after 30 days.",
        "Important: on the free Google Gemini tier, Google may use submitted photos to improve its products, and Google's reviewers may read them. For the demo, use samples only.",
      ],
      notAdvice: "Tanda does not replace advice from a doctor or pharmacist.",
    },

    upload: {
      title: "Upload the prescription",
      comingSoon: "This part is still being built (next step). Meanwhile, look at the samples.",
      seeSamples: "See the samples",
    },

    footer: {
      privacy: "Tanda does not store the prescription photo.",
      demo: "Hackathon prototype. No real patient data.",
    },
  },
} as const;

type Widen<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? readonly Widen<U>[]
    : T extends object
      ? { [K in keyof T]: Widen<T[K]> }
      : T;

/** Shape shared by both languages (string literals widened to string). */
export type Strings = Widen<(typeof STRINGS)["tl"]>;

export function getStrings(lang: Lang): Strings {
  return STRINGS[lang] as Strings;
}
