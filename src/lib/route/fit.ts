import { isRouteError, RouteError } from "./errors";
import { destinationPoint, haversineKm, offsetPerpendicular, type LatLng } from "./geo";

export type LoopResult = { distanceKm: number; polyline: string };

/** Tính tuyến vòng: points[0] → points[1..] → quay về points[0]. */
export type ComputeLoop = (points: LatLng[]) => Promise<LoopResult>;

export type FitResult = LoopResult & {
  /** Thứ tự điểm của vòng (bắt đầu bằng điểm xuất phát, đã gồm điểm vòng). */
  orderedPoints: LatLng[];
  detours: LatLng[];
};

type Layout = { orderedPoints: LatLng[]; detours: LatLng[] };
type DetourBuilder = { build: (radiusKm: number) => Layout; kmPerRadiusKm: number };

function detourBuilder(points: LatLng[], side: 1 | -1): DetourBuilder {
  const [start] = points;
  if (points.length === 1) {
    // Không có điểm đi qua: vòng tam giác đều quanh điểm xuất phát
    const bearing = side === 1 ? 0 : 180;
    return {
      kmPerRadiusKm: 3,
      build: (r) => {
        const p1 = destinationPoint(start, bearing, r);
        const p2 = destinationPoint(start, bearing + 60, r);
        return { orderedPoints: [start, p1, p2], detours: [p1, p2] };
      },
    };
  }

  // Chèn điểm vòng vào chặng dài nhất của vòng
  let longest = 0;
  let longestKm = -1;
  points.forEach((p, i) => {
    const km = haversineKm(p, points[(i + 1) % points.length]);
    if (km > longestKm) {
      longestKm = km;
      longest = i;
    }
  });
  const a = points[longest];
  const b = points[(longest + 1) % points.length];
  return {
    kmPerRadiusKm: 2,
    build: (r) => {
      const detour = offsetPerpendicular(a, b, r, side);
      const orderedPoints = [...points.slice(0, longest + 1), detour, ...points.slice(longest + 1)];
      return { orderedPoints, detours: [detour] };
    },
  };
}

export async function fitDistance({
  points,
  targetKm,
  computeLoop,
  tol = 0.03,
  maxCalls = 8,
}: {
  points: LatLng[];
  targetKm: number;
  computeLoop: ComputeLoop;
  tol?: number;
  maxCalls?: number;
}): Promise<FitResult> {
  let calls = 0;
  const run = (pts: LatLng[]) => {
    calls++;
    return computeLoop(pts);
  };
  const withinTol = (km: number) => Math.abs(km - targetKm) <= targetKm * tol;

  let base: LoopResult;
  try {
    base = await run(points);
  } catch (e) {
    if (isRouteError(e, "NO_ROUTE")) throw new RouteError("ROUTE_IMPOSSIBLE");
    throw e;
  }

  if (withinTol(base.distanceKm)) return { ...base, orderedPoints: points, detours: [] };
  if (base.distanceKm > targetKm) {
    throw new RouteError("ROUTE_IMPOSSIBLE", { minKm: Math.round(base.distanceKm * 100) / 100 });
  }

  for (const side of [1, -1] as const) {
    const { build, kmPerRadiusKm } = detourBuilder(points, side);
    // Phương pháp dây cung (secant) trên bán kính lệch r: quãng đường tăng gần tuyến tính theo r
    let rPrev = 0;
    let dPrev = base.distanceKm;
    let r = (targetKm - dPrev) / kmPerRadiusKm;
    try {
      while (calls < maxCalls) {
        const layout = build(r);
        const res = await run(layout.orderedPoints);
        if (withinTol(res.distanceKm)) return { ...res, ...layout };

        let slope = (res.distanceKm - dPrev) / (r - rPrev);
        if (!Number.isFinite(slope) || slope < 0.5) slope = kmPerRadiusKm;
        let rNext = r + (targetKm - res.distanceKm) / slope;
        if (rNext <= 0) rNext = r / 2;
        rNext = Math.min(rNext, targetKm);
        [rPrev, dPrev, r] = [r, res.distanceKm, rNext];
      }
    } catch (e) {
      if (!isRouteError(e, "NO_ROUTE")) throw e;
    }
    if (calls >= maxCalls) break;
  }

  throw new RouteError("ROUTE_IMPOSSIBLE");
}
