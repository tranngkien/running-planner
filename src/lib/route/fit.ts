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

/** Số lần gọi dịch vụ tối đa cho mỗi hướng đặt điểm vòng trước khi đổi hướng. */
const CALLS_PER_DIRECTION = 4;
/** Khoảng kẹp bán kính hẹp hơn mức này mà vẫn không trúng cự ly → quãng đường nhảy vọt, đổi hướng. */
const MIN_BRACKET_KM = 0.05;

function detourBuilders(points: LatLng[]): DetourBuilder[] {
  const [start] = points;
  if (points.length === 1) {
    // Không có điểm đi qua: vòng tam giác đều quanh điểm xuất phát, xoay theo 4 hướng
    return [0, 90, 180, 270].map((bearing) => ({
      kmPerRadiusKm: 3,
      build: (r: number) => {
        const p1 = destinationPoint(start, bearing, r);
        const p2 = destinationPoint(start, bearing + 60, r);
        return { orderedPoints: [start, p1, p2], detours: [p1, p2] };
      },
    }));
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
  return ([1, -1] as const).map((side) => ({
    kmPerRadiusKm: 2,
    build: (r: number) => {
      const detour = offsetPerpendicular(a, b, r, side);
      const orderedPoints = [...points.slice(0, longest + 1), detour, ...points.slice(longest + 1)];
      return { orderedPoints, detours: [detour] };
    },
  }));
}

export async function fitDistance({
  points,
  targetKm,
  computeLoop,
  tol = 0.03,
  maxCalls = 16,
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
    // Chỉ có điểm xuất phát: vòng cơ bản S→S dài 0 km, không cần gọi dịch vụ
    base = points.length === 1 ? { distanceKm: 0, polyline: "" } : await run(points);
  } catch (e) {
    if (isRouteError(e, "NO_ROUTE")) throw new RouteError("ROUTE_IMPOSSIBLE");
    throw e;
  }

  if (withinTol(base.distanceKm)) return { ...base, orderedPoints: points, detours: [] };
  if (base.distanceKm > targetKm) {
    throw new RouteError("ROUTE_IMPOSSIBLE", { minKm: Math.round(base.distanceKm * 100) / 100 });
  }

  // Thử lần lượt từng hướng đặt điểm vòng; mỗi hướng tìm bán kính lệch r cho đúng cự ly.
  // Quãng đường thật tăng gần tuyến tính theo r nhưng có thể nhảy vọt (phải vòng qua sông, đường ray…),
  // nên dùng secant khi chưa kẹp được mục tiêu, nội suy/chia đôi khi đã kẹp; khoảng kẹp quá hẹp → đổi hướng.
  for (const { build, kmPerRadiusKm } of detourBuilders(points)) {
    let lo = { r: 0, d: base.distanceKm };
    let hi: { r: number; d: number } | null = null;
    let r = (targetKm - lo.d) / kmPerRadiusKm;
    try {
      for (let i = 0; i < CALLS_PER_DIRECTION && calls < maxCalls; i++) {
        const layout = build(r);
        const res = await run(layout.orderedPoints);
        if (withinTol(res.distanceKm)) return { ...res, ...layout };

        if (res.distanceKm < targetKm) {
          if (r > lo.r) lo = { r, d: res.distanceKm };
        } else if (!hi || r < hi.r) {
          hi = { r, d: res.distanceKm };
        }

        if (hi) {
          if (hi.r - lo.r < MIN_BRACKET_KM) break;
          const t = lo.r + ((targetKm - lo.d) * (hi.r - lo.r)) / (hi.d - lo.d);
          r = t > lo.r && t < hi.r ? t : (lo.r + hi.r) / 2;
        } else {
          const slope = lo.r > 0 ? Math.max((lo.d - base.distanceKm) / lo.r, 0.5) : kmPerRadiusKm;
          r = Math.min(lo.r + (targetKm - lo.d) / slope, targetKm);
        }
      }
    } catch (e) {
      if (!isRouteError(e, "NO_ROUTE")) throw e;
    }
    if (calls >= maxCalls) break;
  }

  throw new RouteError("ROUTE_IMPOSSIBLE");
}
