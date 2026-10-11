import { RouteError } from "./errors";
import type { LatLng } from "./geo";

export type GeocodedPlace = LatLng & { query: string; name: string; address: string };

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

const ENDPOINT = "https://api.openrouteservice.org/geocode/search";

type GeocodeResponse = {
  features?: {
    geometry?: { coordinates?: [number, number] };
    properties?: { name?: string; label?: string };
  }[];
};

/** Tìm toạ độ địa danh bằng OpenRouteService geocode (Pelias, dữ liệu OpenStreetMap). */
export function createGeocoder({ apiKey, fetchFn = fetch }: { apiKey: string; fetchFn?: FetchFn }) {
  return async function geocode(query: string, bias?: LatLng): Promise<GeocodedPlace> {
    const params = new URLSearchParams({ api_key: apiKey, text: query, "boundary.country": "VN", size: "1" });
    if (bias) {
      params.set("focus.point.lat", String(bias.lat));
      params.set("focus.point.lon", String(bias.lng));
    }

    let data: GeocodeResponse;
    try {
      const res = await fetchFn(`${ENDPOINT}?${params}`, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`ORS geocode HTTP ${res.status}: ${await res.text()}`);
      data = await res.json();
    } catch (e) {
      console.error("[places] geocode lỗi:", e);
      throw new RouteError("SERVICE_UNAVAILABLE");
    }

    const feature = data.features?.find((f) => f.geometry?.coordinates?.length === 2);
    const coords = feature?.geometry?.coordinates;
    if (!coords) throw new RouteError("PLACE_NOT_FOUND", { place: query });
    const [lng, lat] = coords;
    return {
      query,
      name: feature.properties?.name || query,
      address: feature.properties?.label ?? "",
      lat,
      lng,
    };
  };
}
