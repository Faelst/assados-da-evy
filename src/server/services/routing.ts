import "server-only";

export type LatLng = { lat: number; lng: number };
export type GeoAddress = { street: string; number: string; district: string; city: string; state: string; cep: string };

/** Serviço de mapas. Trocar por Google/Mapbox = escrever outra implementação desta interface. */
export interface RoutingProvider {
  geocode(address: GeoAddress): Promise<LatLng | null>;
  route(from: LatLng, to: LatLng): Promise<{ distanceKm: number; durationMin: number } | null>;
}

const USER_AGENT = "AssadosDaEvy/1.0 (loja online)";
const NOMINATIM = process.env.NOMINATIM_URL ?? "https://nominatim.openstreetmap.org";
const OSRM = process.env.OSRM_URL ?? "https://router.project-osrm.org";

// O Nominatim público pede no máximo 1 requisição por segundo.
let nextSlot = 0;
async function throttle() {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + 1100;
  if (wait) await new Promise((r) => setTimeout(r, wait));
}

async function getJson(url: string) {
  const r = await fetch(url, { headers: { "User-Agent": USER_AGENT, "Accept-Language": "pt-BR" }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} em ${new URL(url).host}`);
  return r.json();
}

async function nominatim(params: Record<string, string>): Promise<LatLng | null> {
  await throttle();
  const q = new URLSearchParams({ format: "jsonv2", limit: "1", countrycodes: "br", ...params });
  const rows = (await getJson(`${NOMINATIM}/search?${q}`)) as { lat: string; lon: string }[];
  return rows[0] ? { lat: Number(rows[0].lat), lng: Number(rows[0].lon) } : null;
}

export const osmProvider: RoutingProvider = {
  async geocode(a) {
    const cep = a.cep.replace(/\D/g, "");
    return (
      (await nominatim({ street: `${a.number} ${a.street}`, city: a.city, state: a.state })) ??
      (await nominatim({ street: a.street, city: a.city, state: a.state })) ??
      (cep.length === 8 ? await nominatim({ postalcode: `${cep.slice(0, 5)}-${cep.slice(5)}`, country: "Brasil" }) : null) ??
      (await nominatim({ q: `${a.district}, ${a.city}, ${a.state}` }))
    );
  },
  async route(from, to) {
    const data = (await getJson(
      `${OSRM}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`,
    )) as { code: string; routes?: { distance: number; duration: number }[] };
    const r = data.code === "Ok" ? data.routes?.[0] : undefined;
    if (!r) return null;
    return { distanceKm: Math.round(r.distance / 100) / 10, durationMin: Math.max(1, Math.ceil(r.duration / 60)) };
  },
};
