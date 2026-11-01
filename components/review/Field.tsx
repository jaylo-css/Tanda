"use client";

import type { ReactNode } from "react";
import { useLang } from "../LangProvider";

export const inputClass =
  "w-full min-h-12 rounded-lg border-2 border-line bg-white px-3 py-2 text-lg text-ink placeholder:text-muted";

interface FieldProps {
  /** Unique id; the <label> is tied to the control with it. */
  id: string;
  label: string;
  hint?: string;
  /** True when this field is amber (low confidence / unrecognised / empty). */
  amber?: boolean;
  /** True when the human has already confirmed or edited it. */
  confirmed?: boolean;
  onConfirm?: () => void;
  /** Extra explanation shown inside the box (e.g. parser flags). */
  notes?: ReactNode;
  /** True when the content is not a single input (text, checkboxes): the label is then a group heading, not a <label>. */
  group?: boolean;
  /** The control. For inputs, give it id={id}; for groups, it is labelled by aria-labelledby={`${id}-label`}. */
  children: ReactNode;
}

/**
 * A field that turns amber when a human must confirm it. Amber is never colour-only:
 * it also has a heading text and an explicit ✓ button, so it works for colour-blind users.
 */
export function Field({ id, label, hint, amber, confirmed, onConfirm, notes, group, children }: FieldProps) {
  const { t } = useLang();
  const pending = amber && !confirmed;
  return (
    <div
      className={`rounded-xl border-2 p-3 ${
        pending ? "border-amber-line bg-amber-soft text-amber-ink" : "border-line bg-card"
      }`}
    >
      {group ? (
        <div id={`${id}-label`} className="mb-1 text-base font-bold">
          {label}
        </div>
      ) : (
        <label id={`${id}-label`} htmlFor={id} className="mb-1 block text-base font-bold">
          {label}
        </label>
      )}
      {hint && <p className="mb-2 text-base opacity-90">{hint}</p>}
      {children}
      {notes}
      {amber && (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {pending ? (
            <>
              <span className="text-base font-bold">⚠ {t.review.needsConfirm}</span>
              {onConfirm && (
                <button type="button" onClick={onConfirm} className="btn btn-primary" aria-label={`${t.review.confirm}: ${label}`}>
                  {t.review.confirm}
                </button>
              )}
            </>
          ) : (
            <span className="text-base font-bold text-brand">✓ {t.review.confirmed}</span>
          )}
        </div>
      )}
    </div>
  );
}
