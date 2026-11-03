"use client";

/** Horários de 15 em 15 minutos, 00:00 até 23:45, no formato 24h. */
export const TIME_OPTIONS = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4);
  const m = (i % 4) * 15;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

type Props = {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
  required?: boolean;
  optional?: boolean;
  className?: string;
  "aria-label"?: string;
};

export function TimeSelect({ name, value, defaultValue, onChange, required, optional, className = "", ...rest }: Props) {
  // mantém um valor fora da grade de 15 min (vindo de dados antigos) visível
  const extra = [value, defaultValue].filter((v): v is string => !!v && !TIME_OPTIONS.includes(v));
  return (
    <select
      name={name}
      value={value}
      defaultValue={value === undefined ? (defaultValue ?? (optional ? "" : undefined)) : undefined}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      required={required}
      className={`input tabular-nums ${className}`}
      aria-label={rest["aria-label"]}
    >
      {optional && <option value="">--:--</option>}
      {[...extra, ...TIME_OPTIONS].map((t) => (
        <option key={t} value={t}>{t}</option>
      ))}
    </select>
  );
}
