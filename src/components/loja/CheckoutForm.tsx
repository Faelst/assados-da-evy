"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Bike, Store as StoreIcon, Timer } from "lucide-react";
import { formatCents, isValidName, isValidPhone, maskPhone } from "@/lib/phone";
import { holdAction, placeOrderAction } from "@/app/(loja)/checkout/actions";
import { useCart } from "./cart";

type StoreCfg = {
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  paymentMethods: ("PIX" | "CASH" | "CARD")[];
  pixKey: string | null;
  pickupAddress: string | null;
  minOrderCents: number;
  readyEtaMinutes: number;
};
type Zone = { district: string; feeCents: number };

type Address = {
  cep: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  reference: string;
  notes: string;
};

const EMPTY_ADDRESS: Address = { cep: "", street: "", number: "", complement: "", district: "", city: "", state: "", reference: "", notes: "" };
const CUSTOMER_KEY = "evy:customer";

const PAYMENT_LABEL = { PIX: "Pix", CASH: "Dinheiro", CARD: "Cartão na entrega/retirada" } as const;

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

function maskCep(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function CheckoutForm({ store, zones }: { store: StoreCfg; zones: Zone[] }) {
  const { cart, ready, sessionId, subtotalCents } = useCart();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [fulfillment, setFulfillment] = useState<"PICKUP" | "DELIVERY">(store.pickupEnabled ? "PICKUP" : "DELIVERY");
  const [address, setAddress] = useState<Address>(EMPTY_ADDRESS);
  const [payment, setPayment] = useState<"PIX" | "CASH" | "CARD">(store.paymentMethods[0] ?? "PIX");
  const [changeFor, setChangeFor] = useState("");
  const [notes, setNotes] = useState("");
  const [privacy, setPrivacy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [cepState, setCepState] = useState<"idle" | "loading" | "notfound">("idle");

  // reserva de horário (encomenda)
  const [holdUntil, setHoldUntil] = useState<number | null>(null);
  const [holdError, setHoldError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CUSTOMER_KEY) ?? "null");
      if (saved) {
        /* eslint-disable react-hooks/set-state-in-effect -- preenche com dados lembrados no navegador */
        setName(saved.name ?? "");
        setPhone(saved.phone ?? "");
        setEmail(saved.email ?? "");
        if (saved.address) setAddress({ ...EMPTY_ADDRESS, ...saved.address });
        /* eslint-enable react-hooks/set-state-in-effect */
      }
    } catch {}
  }, []);

  const scheduled = cart.type === "SCHEDULED";
  const holdKey = scheduled && cart.handoffAt ? JSON.stringify([cart.date, cart.handoffAt, cart.items.map((i) => [i.productId, i.qty])]) : "";

  useEffect(() => {
    if (!ready || !holdKey || !sessionId) return;
    let cancelled = false;
    holdAction({
      sessionId,
      date: cart.date!,
      handoffAt: cart.handoffAt!,
      items: cart.items.map((i) => ({ productId: i.productId, qty: i.qty })),
    }).then((r) => {
      if (cancelled) return;
      if ("error" in r) setHoldError(r.error);
      else {
        setHoldError(null);
        setHoldUntil(new Date(r.expiresAt).getTime());
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- holdKey resume carrinho e horário
  }, [ready, holdKey, sessionId]);

  useEffect(() => {
    if (!holdUntil) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [holdUntil]);

  const zone = useMemo(() => zones.find((z) => norm(z.district) === norm(address.district)), [zones, address.district]);
  const fee = fulfillment === "DELIVERY" ? (zone?.feeCents ?? 0) : 0;
  const total = subtotalCents + fee;
  const secondsLeft = holdUntil ? Math.max(0, Math.round((holdUntil - now) / 1000)) : null;
  const holdExpired = scheduled && secondsLeft === 0;

  async function lookupCep(cep: string) {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepState("loading");
    try {
      const r = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await r.json();
      if (data.erro) {
        setCepState("notfound");
        return;
      }
      const matched = zones.find((z) => norm(z.district) === norm(data.bairro ?? ""));
      setAddress((a) => ({
        ...a,
        street: data.logradouro || a.street,
        district: matched?.district ?? a.district,
        city: data.localidade || a.city,
        state: data.uf || a.state,
      }));
      setCepState("idle");
    } catch {
      setCepState("notfound");
    }
  }

  if (!ready) return <p className="py-20 text-center text-ink/60">Carregando…</p>;
  if (cart.items.length === 0) {
    return (
      <div className="card mx-auto max-w-lg text-center">
        <p className="font-semibold">Seu carrinho está vazio.</p>
        <Link href="/" className="btn-primary mt-4">Voltar à loja</Link>
      </div>
    );
  }
  if (scheduled && !cart.handoffAt) {
    return (
      <div className="card mx-auto max-w-lg text-center">
        <p className="font-semibold">Escolha o horário da sua encomenda.</p>
        <Link href={`/encomendar/${cart.date}`} className="btn-primary mt-4">Escolher horário</Link>
      </div>
    );
  }

  const set = (k: keyof Address) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setAddress((a) => ({ ...a, [k]: e.target.value }));

  const formOk =
    isValidName(name) &&
    isValidPhone(phone) &&
    privacy &&
    (fulfillment === "PICKUP" ||
      (address.cep.replace(/\D/g, "").length === 8 && address.street && address.number && zone && address.city && address.state)) &&
    subtotalCents >= store.minOrderCents &&
    !holdExpired &&
    !holdError;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!formOk) return;
    setError(null);
    try {
      localStorage.setItem(CUSTOMER_KEY, JSON.stringify({ name, phone, email, address }));
    } catch {}
    startTransition(async () => {
      const r = await placeOrderAction({
        type: cart.type!,
        sessionId,
        items: cart.items.map((i) => ({ productId: i.productId, variantId: i.variantId, qty: i.qty, notes: i.notes })),
        scheduledDate: scheduled ? cart.date : undefined,
        handoffAt: scheduled ? cart.handoffAt : undefined,
        customer: { name, phone, email: email || undefined },
        fulfillment,
        address:
          fulfillment === "DELIVERY"
            ? {
                ...address,
                district: zone?.district ?? address.district,
                complement: address.complement || undefined,
                reference: address.reference || undefined,
                notes: address.notes || undefined,
              }
            : undefined,
        paymentMethod: payment,
        changeForCents: payment === "CASH" && changeFor ? Math.round(Number(changeFor.replace(",", ".")) * 100) || undefined : undefined,
        notes: notes || undefined,
        privacyAccepted: true,
      });
      if (r) {
        setError(r.error);
        setErrorCode(r.code);
      }
    });
  }

  return (
    <form onSubmit={submit} className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-5">
        <h1 className="font-display text-3xl font-bold text-terracotta-dark">Finalizar pedido</h1>

        {scheduled && (
          <div className={`flex items-center gap-2 rounded-2xl p-3 text-sm font-semibold ${holdError || holdExpired ? "bg-tomato/10 text-tomato" : "bg-amber/20 text-terracotta-dark"}`}>
            <Timer className="size-4 shrink-0" />
            {holdError ? (
              <span>
                {holdError} <Link href={`/encomendar/${cart.date}`} className="underline">Escolher outro horário</Link>
              </span>
            ) : holdExpired ? (
              <span>
                Sua reserva expirou. <Link href={`/encomendar/${cart.date}`} className="underline">Escolha o horário de novo</Link>
              </span>
            ) : secondsLeft !== null ? (
              <span>
                Horário das {cart.handoffLabel} reservado para você por {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
              </span>
            ) : (
              <span>Reservando seu horário…</span>
            )}
          </div>
        )}

        <fieldset className="card space-y-3">
          <legend className="sr-only">Seus dados</legend>
          <h2 className="font-display text-xl font-bold">Seus dados</h2>
          <label className="block">
            <span className="text-sm font-semibold">Nome</span>
            <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">WhatsApp</span>
            <input className="input mt-1" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} required inputMode="tel" autoComplete="tel" placeholder="(12) 99999-9999" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">E-mail <span className="font-normal text-ink/50">(opcional)</span></span>
            <input className="input mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </label>
        </fieldset>

        <fieldset className="card space-y-3">
          <legend className="sr-only">Recebimento</legend>
          <h2 className="font-display text-xl font-bold">Como você quer receber?</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {store.pickupEnabled && (
              <label className={`flex cursor-pointer items-start gap-3 rounded-2xl p-3 ring-1 ${fulfillment === "PICKUP" ? "bg-terracotta/5 ring-terracotta" : "ring-terracotta/15"}`}>
                <input type="radio" name="fulfillment" className="mt-1 accent-terracotta" checked={fulfillment === "PICKUP"} onChange={() => setFulfillment("PICKUP")} />
                <span>
                  <span className="flex items-center gap-1.5 font-bold"><StoreIcon className="size-4" /> Retirar na loja</span>
                  {store.pickupAddress && <span className="block text-sm text-ink/60">{store.pickupAddress}</span>}
                </span>
              </label>
            )}
            {store.deliveryEnabled && (
              <label className={`flex cursor-pointer items-start gap-3 rounded-2xl p-3 ring-1 ${fulfillment === "DELIVERY" ? "bg-terracotta/5 ring-terracotta" : "ring-terracotta/15"}`}>
                <input type="radio" name="fulfillment" className="mt-1 accent-terracotta" checked={fulfillment === "DELIVERY"} onChange={() => setFulfillment("DELIVERY")} />
                <span>
                  <span className="flex items-center gap-1.5 font-bold"><Bike className="size-4" /> Entrega</span>
                  <span className="block text-sm text-ink/60">
                    {scheduled ? `Sai às ${cart.handoffLabel}` : `Em até ${store.readyEtaMinutes} min`} · taxa por bairro
                  </span>
                </span>
              </label>
            )}
          </div>

          {fulfillment === "DELIVERY" && (
            <div className="grid gap-3 sm:grid-cols-6">
              <label className="block sm:col-span-2">
                <span className="text-sm font-semibold">CEP</span>
                <input
                  className="input mt-1"
                  value={address.cep}
                  inputMode="numeric"
                  autoComplete="postal-code"
                  onChange={(e) => {
                    const v = maskCep(e.target.value);
                    setAddress((a) => ({ ...a, cep: v }));
                    if (v.length === 9) lookupCep(v);
                  }}
                  required
                />
                {cepState === "loading" && <span className="text-xs text-ink/50">Buscando…</span>}
                {cepState === "notfound" && <span className="text-xs text-tomato">CEP não encontrado, preencha manualmente.</span>}
              </label>
              <label className="block sm:col-span-4">
                <span className="text-sm font-semibold">Rua</span>
                <input className="input mt-1" value={address.street} onChange={set("street")} required autoComplete="address-line1" />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm font-semibold">Número</span>
                <input className="input mt-1" value={address.number} onChange={set("number")} required />
              </label>
              <label className="block sm:col-span-4">
                <span className="text-sm font-semibold">Complemento <span className="font-normal text-ink/50">(apto, bloco, casa)</span></span>
                <input className="input mt-1" value={address.complement} onChange={set("complement")} autoComplete="address-line2" />
              </label>
              <label className="block sm:col-span-3">
                <span className="text-sm font-semibold">Bairro</span>
                <select className="input mt-1" value={zone?.district ?? ""} onChange={set("district")} required>
                  <option value="" disabled>Selecione o bairro</option>
                  {zones.map((z) => (
                    <option key={z.district} value={z.district}>
                      {z.district} · {formatCents(z.feeCents)}
                    </option>
                  ))}
                </select>
                {address.district && !zone && (
                  <span className="text-xs text-tomato">Ainda não entregamos em “{address.district}”. Escolha um bairro da lista ou retire na loja.</span>
                )}
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm font-semibold">Cidade</span>
                <input className="input mt-1" value={address.city} onChange={set("city")} required autoComplete="address-level2" />
              </label>
              <label className="block sm:col-span-1">
                <span className="text-sm font-semibold">UF</span>
                <input className="input mt-1" value={address.state} onChange={set("state")} required maxLength={2} autoComplete="address-level1" />
              </label>
              <label className="block sm:col-span-3">
                <span className="text-sm font-semibold">Ponto de referência</span>
                <input className="input mt-1" value={address.reference} onChange={set("reference")} />
              </label>
              <label className="block sm:col-span-3">
                <span className="text-sm font-semibold">Instruções para o entregador</span>
                <input className="input mt-1" value={address.notes} onChange={set("notes")} placeholder="Portaria, interfone…" />
              </label>
            </div>
          )}
        </fieldset>

        <fieldset className="card space-y-3">
          <legend className="sr-only">Pagamento</legend>
          <h2 className="font-display text-xl font-bold">Pagamento</h2>
          <p className="text-sm text-ink/60">Você paga na entrega/retirada ou por Pix. Nada é cobrado agora.</p>
          <div className="flex flex-wrap gap-2">
            {store.paymentMethods.map((m) => (
              <label key={m} className={`cursor-pointer rounded-full px-4 py-2 text-sm font-bold ring-1 ${payment === m ? "bg-terracotta text-cream ring-terracotta" : "ring-terracotta/30"}`}>
                <input type="radio" name="payment" className="sr-only" checked={payment === m} onChange={() => setPayment(m)} />
                {PAYMENT_LABEL[m]}
              </label>
            ))}
          </div>
          {payment === "PIX" && store.pixKey && (
            <p className="rounded-2xl bg-cream p-3 text-sm">
              Chave Pix: <strong className="select-all">{store.pixKey}</strong>. Envie o comprovante pelo WhatsApp depois de pagar.
            </p>
          )}
          {payment === "CASH" && (
            <label className="block max-w-xs">
              <span className="text-sm font-semibold">Troco para quanto? <span className="font-normal text-ink/50">(opcional)</span></span>
              <input className="input mt-1" inputMode="decimal" value={changeFor} onChange={(e) => setChangeFor(e.target.value.replace(/[^\d,.]/g, ""))} placeholder="Ex.: 100" />
            </label>
          )}
        </fieldset>

        <fieldset className="card space-y-3">
          <legend className="sr-only">Observações</legend>
          <label className="block">
            <span className="font-display text-xl font-bold">Observações do pedido</span>
            <textarea className="input mt-2 min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
          </label>
        </fieldset>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="card space-y-3">
          <h2 className="font-display text-xl font-bold">Resumo</h2>
          <p className="text-sm text-ink/60">
            {scheduled ? `Encomenda · ${cart.date?.split("-").reverse().join("/")} · pronto às ${cart.handoffLabel}` : "Pronta entrega · hoje"}
          </p>
          <ul className="space-y-1 text-sm">
            {cart.items.map((i) => (
              <li key={`${i.productId}-${i.variantId ?? ""}`} className="flex justify-between gap-2">
                <span>{i.qty}× {i.name}</span>
                <span className="tabular-nums">{formatCents(i.qty * i.priceCents)}</span>
              </li>
            ))}
          </ul>
          <div className="space-y-1 border-t border-terracotta/10 pt-3 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatCents(subtotalCents)}</span></div>
            {fulfillment === "DELIVERY" && (
              <div className="flex justify-between"><span>Entrega</span><span>{zone ? formatCents(fee) : "—"}</span></div>
            )}
            <div className="flex justify-between pt-1 font-display text-xl font-bold text-terracotta"><span>Total</span><span>{formatCents(total)}</span></div>
          </div>
          {subtotalCents < store.minOrderCents && (
            <p className="text-sm font-semibold text-tomato">Pedido mínimo: {formatCents(store.minOrderCents)}.</p>
          )}
          <label className="flex items-start gap-2 text-xs text-ink/70">
            <input type="checkbox" className="mt-0.5 accent-terracotta" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} required />
            <span>
              Concordo que a Assados da Evy use meu nome, WhatsApp e endereço só para preparar e entregar este pedido. Posso pedir a exclusão dos meus dados pelo WhatsApp.
            </span>
          </label>
          {error && (
            <p className="rounded-xl bg-tomato/10 p-2 text-sm font-semibold text-tomato" role="alert">
              {error}{" "}
              {errorCode === "HOLD_EXPIRED" && <Link href={`/encomendar/${cart.date}`} className="underline">Escolher horário</Link>}
              {errorCode === "OUT_OF_STOCK" && <Link href="/carrinho" className="underline">Revisar carrinho</Link>}
            </p>
          )}
          <button type="submit" disabled={!formOk || pending} className="btn-primary w-full">
            {pending ? "Enviando…" : "Confirmar pedido"}
          </button>
        </div>
      </aside>
    </form>
  );
}
