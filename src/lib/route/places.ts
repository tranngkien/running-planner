import { RouteError } from "./errors";
import type { LatLng } from "./geo";

export type GeocodedPlace = LatLng & { query: string; name: string; address: string };

type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK = "places.displayName,places.formattedAddress,places.location";
const BIAS_RADIUS_M = 30_000;

type PlacesResponse = {
  places?: {
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude: number; longitude: number };
  }[];
};

export function createGeocoder({ apiKey, fetchFn = fetch }: { apiKey: string; fetchFn?: FetchFn }) {
  return async function geocode(query: string, bias?: LatLng): Promise<GeocodedPlace> {
    const body: Record<string, unknown> = { textQuery: query, languageCode: "vi", regionCode: "VN", pageSize: 1 };
    if (bias) {
      body.locationBias = {
        circle: { center: { latitude: bias.lat, longitude: bias.lng }, radius: BIAS_RADIUS_M },
      };
    }

    let data: PlacesResponse;
    try {
      const res = await fetchFn(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": FIELD_MASK,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Places HTTP ${res.status}: ${await res.text()}`);
      data = await res.json();
    } catch (e) {
      console.error("[places] geocode lỗi:", e);
      throw new RouteError("SERVICE_UNAVAILABLE");
    }

    const place = data.places?.find((p) => p.location);
    if (!place?.location) throw new RouteError("PLACE_NOT_FOUND", { place: query });
    return {
      query,
      name: place.displayName?.text ?? query,
      address: place.formattedAddress ?? "",
      lat: place.location.latitude,
      lng: place.location.longitude,
    };
  };
}
