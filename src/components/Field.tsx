import type { InputHTMLAttributes, ReactNode } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: ReactNode; dark?: boolean };

export function Field({ label, error, hint, dark, className = "", ...rest }: Props) {
  return (
    <label className={`block ${className}`}>
      <span className={`mb-1.5 block text-sm font-bold ${dark ? "text-cream/90" : "text-ink/80"}`}>{label}</span>
      <input
        {...rest}
        aria-invalid={!!error}
        className={`w-full rounded-2xl border px-4 py-3 text-base font-medium outline-none transition focus:ring-4 ${
          dark
            ? "border-cream/20 bg-cream/10 text-cream placeholder:text-cream/45 focus:border-amber focus:ring-amber/25"
            : "border-terracotta/15 bg-white text-ink placeholder:text-ink/35 focus:border-terracotta focus:ring-terracotta/15"
        } ${error ? "border-tomato!" : ""}`}
      />
      {error ? (
        <span className="mt-1 block text-sm font-semibold text-tomato">{error}</span>
      ) : hint ? (
        <span className={`mt-1 block text-xs ${dark ? "text-cream/60" : "text-ink/50"}`}>{hint}</span>
      ) : null}
    </label>
  );
}
