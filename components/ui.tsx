import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "quiet" | "onDark";

const BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-deep active:bg-brand-deep",
  secondary: "border border-brand/45 bg-surface text-brand hover:bg-brand-soft active:bg-brand-soft",
  quiet: "px-2 text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand",
  onDark: "bg-white text-brand-deep hover:bg-coin active:bg-coin",
};

export function buttonClass(variant: Variant = "primary", extra = ""): string {
  return `${BASE} ${VARIANTS[variant]} ${extra}`.trim();
}

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type={type} className={buttonClass(variant, className)} {...props} />;
}

export const inputClass =
  "min-h-11 w-full rounded-xl border bg-surface px-3.5 text-base text-ink placeholder:text-muted/70";

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`h-5 w-5 animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <span className={`skeleton block ${className}`} aria-hidden="true" />;
}

export function CheckIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="m4.5 10.5 3.4 3.4 7.6-8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AlertIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" />
      <path d="M10 5.8v5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="10" cy="14" r="1.2" fill="currentColor" />
    </svg>
  );
}

/** A labelled input with an optional hint and an error shown next to it, with an icon and words. */
export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
  children: (props: { id: string; "aria-describedby": string | undefined; "aria-invalid": boolean }) => ReactNode;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-base font-semibold text-ink">
        {label}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": Boolean(error) })}
      {error ? (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-sm font-medium text-clay">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Colour is never the only signal: every status is also written out, with an icon. */
export function StatusBadge({ status }: { status: "unpaid" | "paid" | "underpaid" }) {
  if (status === "paid") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-palm-soft px-2.5 py-0.5 text-sm font-semibold text-palm">
        <CheckIcon /> Paid
      </span>
    );
  }
  if (status === "underpaid") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-soft px-2.5 py-0.5 text-sm font-semibold text-amber-ink">
        <AlertIcon /> Underpaid
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-0.5 text-sm font-semibold text-brand">
      <span className="h-2 w-2 rounded-full bg-brand" aria-hidden="true" /> Unpaid
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 py-2">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
        {icon}
      </span>
      <div>
        <p className="font-display text-xl font-semibold text-ink">{title}</p>
        <div className="mt-1 max-w-[42ch] text-muted">{children}</div>
      </div>
    </div>
  );
}
