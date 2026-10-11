import { RouteError } from "./errors";
import type { ComputeLoop } from "./fit";
import type { LatLng } from "./geo";

type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

const ENDPOINT = "https://routes.googleapis.com/directions/v2:computeRoutes";
const FIELD_MASK = "routes.distanceMeters,routes.polyline.encodedPolyline";

type RoutesResponse = {
  routes?: { distanceMeters?: number; polyline?: { encodedPolyline?: string } }[];
};

const waypoint = (p: LatLng) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });

/** Tuyến đi bộ khép kín: points[0] → points[1..] → points[0]. */
export function createLoopRouter({ apiKey, fetchFn = fetch }: { apiKey: string; fetchFn?: FetchFn }): ComputeLoop {
  return async function computeLoop(points) {
    const [start, ...rest] = points;
    let data: RoutesResponse;
    try {
      const res = await fetchFn(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": FIELD_MASK,
        },
        body: JSON.stringify({
          origin: waypoint(start),
          destination: waypoint(start),
          intermediates: rest.map(waypoint),
          travelMode: "WALK",
          languageCode: "vi",
          units: "METRIC",
        }),
      });
      if (!res.ok) throw new Error(`Routes HTTP ${res.status}: ${await res.text()}`);
      data = await res.json();
    } catch (e) {
      console.error("[routes] computeLoop lỗi:", e);
      throw new RouteError("SERVICE_UNAVAILABLE");
    }

    const route = data.routes?.[0];
    if (!route?.distanceMeters || !route.polyline?.encodedPolyline) throw new RouteError("NO_ROUTE");
    return { distanceKm: route.distanceMeters / 1000, polyline: route.polyline.encodedPolyline };
  };
}
