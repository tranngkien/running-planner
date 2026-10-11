import { RouteError } from "./errors";
import type { LatLng } from "./geo";

export type GeocodedPlace = LatLng & { query: string; name: string; address: string };

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;
type Lookup = (query: string, bias?: LatLng) => Promise<GeocodedPlace | null>;

const ORS_ENDPOINT = "https://api.openrouteservice.org/geocode/search";
const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "running-planner/1.0 (https://github.com/tranngkien/running-planner)";
/** Kết quả ORS ở các layer này chỉ là cấp hành chính (ví dụ "Hồ Gươm" → "Hanoi") — không đủ chính xác. */
const COARSE_LAYERS = new Set(["locality", "localadmin", "county", "region", "macroregion", "macrocounty", "country", "dependency"]);
/** Nửa cạnh hộp ưu tiên quanh điểm bias cho Nominatim (độ, ~30 km). */
const VIEWBOX_DEG = 0.3;

type OrsResponse = {
  features?: {
    geometry?: { coordinates?: [number, number] };
    properties?: { name?: string; label?: string; layer?: string };
  }[];
};

type NominatimResult = { lat: string; lon: string; name?: string; display_name?: string };

function orsLookup(apiKey: string, fetchFn: FetchFn): Lookup {
  return async (query, bias) => {
    const params = new URLSearchParams({ api_key: apiKey, text: query, "boundary.country": "VN", size: "1" });
    if (bias) {
      params.set("focus.point.lat", String(bias.lat));
      params.set("focus.point.lon", String(bias.lng));
    }
    const res = await fetchFn(`${ORS_ENDPOINT}?${params}`, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`ORS geocode HTTP ${res.status}: ${await res.text()}`);
    const data: OrsResponse = await res.json();
    const feature = data.features?.find((f) => f.geometry?.coordinates?.length === 2);
    const coords = feature?.geometry?.coordinates;
    if (!coords || COARSE_LAYERS.has(feature.properties?.layer ?? "")) return null;
    const [lng, lat] = coords;
    return { query, name: feature.properties?.name || query, address: feature.properties?.label ?? "", lat, lng };
  };
}

function nominatimLookup(fetchFn: FetchFn): Lookup {
  return async (query, bias) => {
    const params = new URLSearchParams({ q: query, format: "jsonv2", limit: "1", countrycodes: "vn", "accept-language": "vi" });
    if (bias) {
      const box = [bias.lng - VIEWBOX_DEG, bias.lat + VIEWBOX_DEG, bias.lng + VIEWBOX_DEG, bias.lat - VIEWBOX_DEG];
      params.set("viewbox", box.join(","));
    }
    const res = await fetchFn(`${NOMINATIM_ENDPOINT}?${params}`, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    });
    if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}: ${await res.text()}`);
    const data: unknown = await res.json();
    const first = Array.isArray(data) ? (data[0] as NominatimResult | undefined) : undefined;
    if (!first) return null;
    return {
      query,
      name: first.name || query,
      address: first.display_name ?? "",
      lat: Number(first.lat),
      lng: Number(first.lon),
    };
  };
}

/**
 * Tìm toạ độ địa danh (dữ liệu OpenStreetMap): OpenRouteService trước,
 * dự phòng Nominatim khi ORS lỗi hoặc chỉ trả kết quả cấp hành chính.
 */
export function createGeocoder({ apiKey, fetchFn = fetch }: { apiKey: string; fetchFn?: FetchFn }) {
  const providers: [string, Lookup][] = [
    ["ors", orsLookup(apiKey, fetchFn)],
    ["nominatim", nominatimLookup(fetchFn)],
  ];

  return async function geocode(query: string, bias?: LatLng): Promise<GeocodedPlace> {
    let failures = 0;
    for (const [name, lookup] of providers) {
      try {
        const place = await lookup(query, bias);
        if (place) return place;
      } catch (e) {
        failures++;
        console.error(`[places] geocode ${name} lỗi:`, e);
      }
    }
    if (failures === providers.length) throw new RouteError("SERVICE_UNAVAILABLE");
    throw new RouteError("PLACE_NOT_FOUND", { place: query });
  };
}
