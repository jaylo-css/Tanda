/**
 * The daily schedule table: rows Umaga / Tanghali / Hapon / Gabi / Bago matulog, each listing
 * which medicines to take and how many. Pure code, built only from what the reviewer confirmed.
 */
import type { DisplayMedicine } from "./review";
import { SLOT_IDS, type SlotId } from "./sig";

export interface ScheduleRow {
  slot: SlotId;
  items: DisplayMedicine[];
}

export interface Schedule {
  rows: ScheduleRow[];
  /** "Kung kailangan lang": as-needed medicines with no fixed time of day. */
  prn: DisplayMedicine[];
  /** Anything that does not sit in a time of day (e.g. "tuwing 4 oras", weekly, right now). */
  other: DisplayMedicine[];
}

export function buildSchedule(meds: DisplayMedicine[]): Schedule {
  const rows: ScheduleRow[] = SLOT_IDS.map((slot) => ({ slot, items: [] }));
  const prn: DisplayMedicine[] = [];
  const other: DisplayMedicine[] = [];
  for (const m of meds) {
    if (m.slots.length > 0) {
      for (const slot of m.slots) rows.find((r) => r.slot === slot)?.items.push(m);
    } else if (m.prn) {
      prn.push(m);
    } else {
      other.push(m);
    }
  }
  return { rows, prn, other };
}
