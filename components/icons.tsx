/**
 * Original, hand-drawn SVG icons (no AI-generated images anywhere in Tanda).
 * Icons are decorative: every icon is shown next to a text label, so they are aria-hidden.
 * High-contrast ink outlines so they stay readable when printed in black and white.
 */
import type { ReactNode } from "react";
import type { DosageForm } from "@/lib/schema";
import type { Amount, SlotId, TimingKind } from "@/lib/sig";

const INK = "#1a1a1a";
const AMBER = "#f2b84b";
const BRAND = "#0b5d4b";
const SOFT = "#e3f2ec";
const BLUE = "#7fb7e6";
const RED = "#b42318";

function Svg({ size = 56, children }: { size?: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke={INK}
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

const rays = (cx: number, cy: number, r1: number, r2: number, angles: number[]) =>
  angles.map((a) => {
    const rad = (a * Math.PI) / 180;
    return (
      <line key={a} x1={cx + r1 * Math.cos(rad)} y1={cy + r1 * Math.sin(rad)} x2={cx + r2 * Math.cos(rad)} y2={cy + r2 * Math.sin(rad)} />
    );
  });

// ---------------------------------------------------------------------------
// Time of day
// ---------------------------------------------------------------------------

export const SunriseIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M8 46h48" />
    <path d="M20 46a12 12 0 0 1 24 0z" fill={AMBER} />
    {rays(32, 46, 18, 25, [-90, -135, -45, -165, -15])}
    <path d="M26 56l6-6 6 6" />
  </Svg>
);

export const SunIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <circle cx="32" cy="32" r="10" fill={AMBER} />
    {rays(32, 32, 16, 23, [0, 45, 90, 135, 180, 225, 270, 315])}
  </Svg>
);

export const AfternoonIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <circle cx="24" cy="24" r="9" fill={AMBER} />
    {rays(24, 24, 14, 20, [180, 225, 270, 315, 135])}
    <path d="M24 54a8 8 0 0 1 1-16 11 11 0 0 1 21 3 7 7 0 0 1-1 13z" fill="#ffffff" />
  </Svg>
);

export const MoonIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M40 10a22 22 0 1 0 14 38A17 17 0 0 1 40 10z" fill="#f4e7b0" />
    <path d="M50 12l1.6 3.4L55 17l-3.4 1.6L50 22l-1.6-3.4L45 17l3.4-1.6z" fill={AMBER} strokeWidth={2} />
  </Svg>
);

export const BedIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M7 24v30" />
    <rect x="7" y="38" width="50" height="9" rx="2" fill="#cfe0f5" />
    <path d="M57 47v7" />
    <ellipse cx="19" cy="34" rx="8" ry="4.5" fill="#ffffff" />
    <path d="M36 10h9l-9 9h9" strokeWidth={2.5} />
    <path d="M47 20h6l-6 6h6" strokeWidth={2.2} />
  </Svg>
);

// ---------------------------------------------------------------------------
// Timing relative to meals
// ---------------------------------------------------------------------------

const Plate = () => (
  <>
    <circle cx="32" cy="32" r="17" fill="#ffffff" />
    <circle cx="32" cy="32" r="10" />
    <path d="M7 14v12a3 3 0 0 0 6 0V14M10 26v24" />
    <path d="M57 14c-4 3-5 9-5 14h5M57 28v22" />
  </>
);

export const PlateIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <Plate />
  </Svg>
);

/** Plate with an X: empty stomach / before eating. */
export const PlateXIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <Plate />
    <path d="M22 22l20 20M42 22L22 42" stroke={RED} strokeWidth={5} />
  </Svg>
);

// ---------------------------------------------------------------------------
// Dosage forms (plain icons, NEVER the actual medicine)
// ---------------------------------------------------------------------------

export const TabletIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <circle cx="32" cy="32" r="18" fill="#ffffff" />
    <path d="M32 14v36" />
  </Svg>
);

export const CapsuleIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <g transform="rotate(-35 32 32)">
      <rect x="9" y="22" width="46" height="20" rx="10" fill="#ffffff" />
      <path d="M32 22H19a10 10 0 0 0 0 20h13z" fill={AMBER} />
    </g>
  </Svg>
);

export const SyrupIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <rect x="23" y="5" width="18" height="9" rx="2" fill={BRAND} />
    <path d="M26 14h12v6H26z" fill="#ffffff" />
    <rect x="16" y="20" width="32" height="38" rx="6" fill="#ffffff" />
    <path d="M17 38c5-3 9 3 15 0s10 3 15 0v17a4 4 0 0 1-4 3H21a4 4 0 0 1-4-3z" fill={AMBER} strokeWidth={2} />
    <rect x="22" y="26" width="20" height="9" rx="1.5" fill={SOFT} strokeWidth={2} />
  </Svg>
);

export const InhalerIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <rect x="22" y="6" width="16" height="28" rx="3" fill={BLUE} />
    <rect x="14" y="30" width="32" height="16" rx="4" fill="#ffffff" />
    <rect x="8" y="46" width="18" height="10" rx="3" fill={BRAND} />
    <path d="M52 22l5-4M52 30h6M52 38l5 4" strokeWidth={2.5} />
  </Svg>
);

export const DropsIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <ellipse cx="32" cy="12" rx="8" ry="9" fill={BRAND} />
    <path d="M27 20h10v16H27z" fill="#ffffff" />
    <path d="M27 36l5 8 5-8" fill="#ffffff" />
    <path d="M32 48c-4 5-6 8-6 11a6 6 0 0 0 12 0c0-3-2-6-6-11z" fill={BLUE} strokeWidth={2.5} />
  </Svg>
);

export const CreamIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <rect x="23" y="5" width="18" height="14" rx="2" fill={BRAND} />
    <path d="M15 19h34l-4 32H19z" fill="#ffffff" />
    <path d="M19 51h26v6H19z" fill="#d7d1c0" />
    <path d="M22 30c4-3 6 3 10 0s6 3 10 0" strokeWidth={2.5} />
  </Svg>
);

export const InjectionIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <g transform="rotate(-45 32 32)">
      <rect x="16" y="25" width="30" height="14" rx="2" fill="#ffffff" />
      <path d="M21 25v5M26 25v5M31 25v5M36 25v5" strokeWidth={2} />
      <path d="M46 32h8M54 24v16" />
      <path d="M16 32H4" />
    </g>
  </Svg>
);

export const OtherFormIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <rect x="17" y="6" width="30" height="11" rx="3" fill={BRAND} />
    <rect x="15" y="17" width="34" height="40" rx="5" fill="#ffffff" />
    <rect x="20" y="27" width="24" height="18" rx="2" fill={SOFT} strokeWidth={2} />
    <path d="M32 31v10M27 36h10" strokeWidth={2.5} />
  </Svg>
);

// ---------------------------------------------------------------------------
// Pickers
// ---------------------------------------------------------------------------

export function SlotIcon({ slot, size }: { slot: SlotId; size?: number }) {
  switch (slot) {
    case "umaga":
      return <SunriseIcon size={size} />;
    case "tanghali":
      return <SunIcon size={size} />;
    case "hapon":
      return <AfternoonIcon size={size} />;
    case "gabi":
      return <MoonIcon size={size} />;
    case "bago_matulog":
      return <BedIcon size={size} />;
  }
}

export function TimingIcon({ kind, size }: { kind: TimingKind; size?: number }) {
  // before meals and empty stomach both mean "no food in the stomach": plate with an X
  return kind === "AC" || kind === "EMPTY_STOMACH" ? <PlateXIcon size={size} /> : <PlateIcon size={size} />;
}

export function FormIcon({ form, size }: { form: DosageForm; size?: number }) {
  switch (form) {
    case "tablet":
      return <TabletIcon size={size} />;
    case "capsule":
      return <CapsuleIcon size={size} />;
    case "syrup":
    case "suspension":
      return <SyrupIcon size={size} />;
    case "inhaler":
      return <InhalerIcon size={size} />;
    case "drops":
      return <DropsIcon size={size} />;
    case "cream":
      return <CreamIcon size={size} />;
    case "injection":
      return <InjectionIcon size={size} />;
    default:
      return <OtherFormIcon size={size} />;
  }
}

/**
 * "How many?": tablets/capsules are drawn one by one (a half is drawn as a half). Anything else
 * (mL, spoons, drops, puffs) is shown as the dose text only, so we never draw a quantity we are unsure of.
 */
export function PillCount({ amount, size = 32 }: { amount: Amount | null; size?: number }) {
  if (!amount || amount.max !== undefined) return null;
  if (amount.unit !== "tablet" && amount.unit !== "capsule") return null;
  const n = amount.min;
  if (n <= 0 || n > 6) return null;
  const whole = Math.floor(n);
  const frac = n - whole;
  if (frac !== 0 && frac !== 0.5 && frac !== 0.25 && frac !== 0.75) return null;
  const isCap = amount.unit === "capsule";
  const items: ReactNode[] = [];
  for (let i = 0; i < whole; i++) items.push(<Single key={i} cap={isCap} size={size} />);
  if (frac > 0) items.push(<Single key="f" cap={isCap} size={size} fraction={frac} />);
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      {items}
    </span>
  );
}

function Single({ cap, size, fraction }: { cap: boolean; size: number; fraction?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={INK} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" focusable="false">
      {cap ? (
        <g transform="rotate(-35 16 16)">
          <rect x="3" y="10" width="26" height="12" rx="6" fill={fraction ? "#ffffff" : "#ffffff"} />
          <path d="M16 10H9a6 6 0 0 0 0 12h7z" fill={AMBER} />
        </g>
      ) : fraction === undefined ? (
        <>
          <circle cx="16" cy="16" r="11" fill="#ffffff" />
          <path d="M16 5v22" />
        </>
      ) : (
        <>
          <circle cx="16" cy="16" r="11" fill="#ffffff" strokeDasharray="3 3" />
          <path d={fraction === 0.5 ? "M16 5a11 11 0 0 0 0 22z" : fraction === 0.25 ? "M16 16V5a11 11 0 0 0-11 11z" : "M16 16V5a11 11 0 1 1-11 11z"} fill={AMBER} />
        </>
      )}
    </svg>
  );
}
