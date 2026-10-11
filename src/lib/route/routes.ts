import { RouteError } from "./errors";
import type { ComputeLoop } from "./fit";
import type { LatLng } from "./geo";

type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

const ENDPOINT = "https://api.openrouteservice.org/v2/directions/foot-walking/json";
/** Bán kính (m) để bắt điểm vào đường đi bộ gần nhất — điểm vòng có thể rơi vào sông/hồ. */
const SNAP_RADIUS_M = 1000;
/** Mã lỗi ORS: 2009 = không tìm được tuyến, 2010 = không có điểm đi được gần toạ độ. */
const NO_ROUTE_CODES = new Set([2009, 2010]);

type DirectionsResponse = {
  routes?: { summary?: { distance?: number }; geometry?: string }[];
  error?: { code?: number; message?: string } | string;
};

/** Tuyến đi bộ khép kín: points[0] → points[1..] → points[0] (OpenRouteService). */
export function createLoopRouter({ apiKey, fetchFn = fetch }: { apiKey: string; fetchFn?: FetchFn }): ComputeLoop {
  return async function computeLoop(points) {
    const loop: LatLng[] = [...points, points[0]];
    let res: Response;
    let data: DirectionsResponse;
    try {
      res = await fetchFn(ENDPOINT, {
        method: "POST",
        headers: { Authorization: apiKey, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          coordinates: loop.map((p) => [p.lng, p.lat]),
          instructions: false,
          radiuses: loop.map(() => SNAP_RADIUS_M),
        }),
      });
      data = await res.json().catch(() => ({}));
    } catch (e) {
      console.error("[routes] computeLoop lỗi mạng:", e);
      throw new RouteError("SERVICE_UNAVAILABLE");
    }

    if (!res.ok) {
      const code = typeof data.error === "object" ? data.error?.code : undefined;
      if (code !== undefined && NO_ROUTE_CODES.has(code)) throw new RouteError("NO_ROUTE");
      console.error(`[routes] ORS HTTP ${res.status}:`, JSON.stringify(data.error ?? data));
      throw new RouteError("SERVICE_UNAVAILABLE");
    }

    const route = data.routes?.[0];
    const meters = route?.summary?.distance;
    if (!meters || !route?.geometry) throw new RouteError("NO_ROUTE");
    return { distanceKm: meters / 1000, polyline: route.geometry };
  };
}
