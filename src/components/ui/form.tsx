import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

const controlBase = cn(
  "w-full rounded-brutal border-[3px] border-ink bg-surface px-3 text-base text-ink",
  "placeholder:text-subtle/70 shadow-brutal-sm transition-shadow duration-100",
  "focus:shadow-brutal focus:outline-none focus-visible:outline-none",
  "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70",
  "aria-invalid:border-danger aria-invalid:shadow-[3px_3px_0_0_var(--color-danger)]",
  "[color-scheme:dark]",
);

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("text-sm font-bold uppercase tracking-wide", className)} {...props} />;
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(controlBase, "h-11", className)} {...props} />;
}

export function Textarea({ className, rows = 4, ...props }: ComponentProps<"textarea">) {
  return <textarea rows={rows} className={cn(controlBase, "min-h-24 py-2 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select className={cn(controlBase, "h-11 cursor-pointer appearance-none pr-10", className)} {...props}>
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 12 8"
        className="pointer-events-none absolute right-3 top-1/2 h-2 w-3 -translate-y-1/2"
      >
        <path d="M1 1l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2.5" />
      </svg>
    </div>
  );
}

/** id of the hint or error text of a field (the error replaces the hint), for `aria-describedby`. */
export function fieldDescribedBy(id: string, { hint, error }: { hint?: ReactNode; error?: ReactNode }) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

type FieldProps = {
  /** Must match the `id` of the control inside. */
  htmlFor: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * Label + control + hint/error layout. Pair the inner control with
 * `aria-describedby={fieldDescribedBy(id, { hint, error })}` and `aria-invalid={!!error}`.
 */
export function Field({ htmlFor, label, hint, error, required, className, children }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && (
          <span aria-hidden="true" className="ml-1 text-danger">
            *
          </span>
        )}
      </Label>
      {children}
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="text-sm text-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${htmlFor}-error`} className="text-sm font-bold text-ink">
          <span aria-hidden="true" className="mr-1 inline-block border-2 border-ink bg-danger px-1 font-mono text-xs text-on-accent">
            !
          </span>
          {error}
        </p>
      )}
    </div>
  );
}
