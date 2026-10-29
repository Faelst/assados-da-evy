import { useSyncExternalStore } from "react";

export type Lead = { name: string; phone: string };

export type LeadPayload = Lead & {
  type: "contato" | "orcamento" | "evento";
  [key: string]: unknown;
};

const STORAGE_KEY = "evy:lead";
const CHANGE_EVENT = "evy:lead-change";

export function maskPhone(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export const isValidPhone = (phone: string) => /^\d{10,11}$/.test(phone.replace(/\D/g, ""));
export const isValidName = (name: string) => name.trim().length >= 2;

export function storeLead(lead: Lead) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lead));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // armazenamento indisponível (aba anônima etc.) — segue sem lembrar
  }
}

export function clearLead() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // idem
  }
}

let cachedRaw: string | null = null;
let cachedLead: Lead | null = null;

function snapshot(): Lead | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // sem acesso ao storage
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cachedLead = raw ? (JSON.parse(raw) as Lead) : null;
    } catch {
      cachedLead = null;
    }
  }
  return cachedLead;
}

function subscribe(cb: () => void) {
  window.addEventListener(CHANGE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CHANGE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Contato já informado neste navegador (null no servidor e para novos visitantes). */
export function useStoredLead() {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}

/** Envia o lead para a API. Nunca bloqueia o fluxo do cliente em caso de falha. */
export async function sendLead(payload: LeadPayload) {
  try {
    await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // o WhatsApp continua sendo o canal principal
  }
}
