import { fitDistance, type ComputeLoop } from "./fit";
import type { ParsedPrompt } from "./gemini";
import type { LatLng } from "./geo";
import type { GeocodedPlace } from "./places";

export type RouteServices = {
  parsePrompt: (prompt: string) => Promise<ParsedPrompt>;
  geocode: (query: string, bias?: LatLng) => Promise<GeocodedPlace>;
  computeLoop: ComputeLoop;
};

export type RoutePoint = LatLng & {
  kind: "start" | "waypoint" | "detour";
  name: string;
  address?: string;
};

export type GeneratedRoute = {
  distanceKm: number;
  targetKm: number;
  polyline: string;
  points: RoutePoint[];
};

export async function generateRoute(
  input: { prompt: string; distanceKm: number },
  services: RouteServices,
): Promise<GeneratedRoute> {
  const parsed = await services.parsePrompt(input.prompt);
  const start = await services.geocode(parsed.start);
  const bias = { lat: start.lat, lng: start.lng };
  const waypoints = await Promise.all(parsed.waypoints.map((w) => services.geocode(w, bias)));

  const named: RoutePoint[] = [
    { kind: "start", name: start.name, address: start.address, lat: start.lat, lng: start.lng },
    ...waypoints.map((w) => ({ kind: "waypoint" as const, name: w.name, address: w.address, lat: w.lat, lng: w.lng })),
  ];

  const fit = await fitDistance({
    points: named.map(({ lat, lng }) => ({ lat, lng })),
    targetKm: input.distanceKm,
    computeLoop: services.computeLoop,
  });

  // Ghép lại tên cho các điểm theo thứ tự cuối cùng của vòng
  let detourIndex = 0;
  let namedIndex = 0;
  const points: RoutePoint[] = fit.orderedPoints.map((p) => {
    if (fit.detours.includes(p)) {
      detourIndex++;
      return { kind: "detour", name: `Điểm vòng ${detourIndex}`, lat: p.lat, lng: p.lng };
    }
    return named[namedIndex++];
  });

  return {
    distanceKm: Math.round(fit.distanceKm * 100) / 100,
    targetKm: input.distanceKm,
    polyline: fit.polyline,
    points,
  };
}
