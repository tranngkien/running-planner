import { describe, expect, it, vi } from "vitest";
import { fitDistance } from "@/lib/route/fit";
import { RouteError } from "@/lib/route/errors";
import { haversineKm, type LatLng } from "@/lib/route/geo";

const START = { lat: 20.9955, lng: 105.8686 }; // gần Times City
const FAR = { lat: 21.0437, lng: 105.8579 }; // gần cầu Long Biên (~5.5 km)

// Giả lập Routes API: vòng khép kín, đường đi bộ dài hơn đường chim bay 25%
function fakeLoop(points: LatLng[]) {
  let km = 0;
  for (let i = 0; i < points.length; i++) {
    km += haversineKm(points[i], points[(i + 1) % points.length]);
  }
  return { distanceKm: km * 1.25, polyline: `poly-${points.length}` };
}

describe("fitDistance", () => {
  it("cự ly cơ bản đã khớp ±3% → trả ngay, không thêm điểm vòng", async () => {
    const base = fakeLoop([START, FAR]).distanceKm;
    const computeLoop = vi.fn(async (p: LatLng[]) => fakeLoop(p));
    const res = await fitDistance({ points: [START, FAR], targetKm: base, computeLoop });
    expect(computeLoop).toHaveBeenCalledTimes(1);
    expect(res.detours).toEqual([]);
    expect(res.distanceKm).toBeCloseTo(base, 5);
  });

  it("tuyến tối thiểu dài hơn cự ly → ROUTE_IMPOSSIBLE kèm minKm", async () => {
    const base = fakeLoop([START, FAR]).distanceKm;
    const err = await fitDistance({
      points: [START, FAR],
      targetKm: 5,
      computeLoop: async (p) => fakeLoop(p),
    }).catch((e) => e);
    expect(err).toBeInstanceOf(RouteError);
    expect(err.code).toBe("ROUTE_IMPOSSIBLE");
    expect(err.details.minKm).toBeCloseTo(base, 1);
  });

  it("tuyến ngắn hơn → thêm điểm vòng, kết quả trong ±3%, tối đa 8 lần gọi", async () => {
    const computeLoop = vi.fn(async (p: LatLng[]) => fakeLoop(p));
    const res = await fitDistance({ points: [START, FAR], targetKm: 21, computeLoop });
    expect(Math.abs(res.distanceKm - 21) / 21).toBeLessThanOrEqual(0.03);
    expect(res.detours.length).toBeGreaterThan(0);
    expect(computeLoop.mock.calls.length).toBeLessThanOrEqual(8);
    // điểm đầu của vòng luôn là điểm xuất phát
    expect(res.orderedPoints[0]).toEqual(START);
  });

  it("chỉ có điểm xuất phát → tạo vòng quanh điểm đó đúng cự ly", async () => {
    const res = await fitDistance({
      points: [START],
      targetKm: 10,
      computeLoop: async (p) => fakeLoop(p),
    });
    expect(Math.abs(res.distanceKm - 10) / 10).toBeLessThanOrEqual(0.03);
    expect(res.orderedPoints[0]).toEqual(START);
  });

  it("chỉ có điểm xuất phát → không gọi vòng cơ bản S→S (dịch vụ thật trả 0 km / lỗi)", async () => {
    const computeLoop = vi.fn(async (p: LatLng[]) => {
      if (p.length === 1) throw new RouteError("NO_ROUTE");
      return fakeLoop(p);
    });
    const res = await fitDistance({ points: [START], targetKm: 10, computeLoop });
    expect(Math.abs(res.distanceKm - 10) / 10).toBeLessThanOrEqual(0.03);
    expect(computeLoop.mock.calls.every(([p]) => p.length > 1)).toBe(true);
  });

  it("quãng đường nhảy vọt ở một hướng (sông/đường ray) → thử hướng khác và đạt cự ly", async () => {
    // Điểm vòng nằm phía bắc điểm xuất phát → phải vòng qua sông, quãng đường cộng thêm 8 km khi bán kính ≥ 2.4 km
    const computeLoop = vi.fn(async (p: LatLng[]) => {
      const base = fakeLoop(p);
      const north = p.slice(1).some((q) => q.lat > START.lat + 0.005);
      const far = p.slice(1).some((q) => haversineKm(START, q) >= 2.4);
      return north && far ? { ...base, distanceKm: base.distanceKm + 8 } : base;
    });
    const res = await fitDistance({ points: [START], targetKm: 10, computeLoop });
    expect(Math.abs(res.distanceKm - 10) / 10).toBeLessThanOrEqual(0.03);
  });

  it("không bao giờ đạt cự ly → ROUTE_IMPOSSIBLE", async () => {
    const err = await fitDistance({
      points: [START, FAR],
      targetKm: 30,
      computeLoop: async () => ({ distanceKm: 1, polyline: "x" }),
    }).catch((e) => e);
    expect(err).toBeInstanceOf(RouteError);
    expect(err.code).toBe("ROUTE_IMPOSSIBLE");
  });

  it("điểm vòng một phía không có đường → thử phía còn lại", async () => {
    let firstDetourSide: number | undefined;
    const computeLoop = vi.fn(async (p: LatLng[]) => {
      if (p.length > 2) {
        const detour = p[1] === FAR ? p[2] : p[1];
        const side = Math.sign(detour.lng - START.lng);
        firstDetourSide ??= side;
        if (side === firstDetourSide) throw new RouteError("NO_ROUTE");
      }
      return fakeLoop(p);
    });
    const res = await fitDistance({ points: [START, FAR], targetKm: 18, computeLoop, maxCalls: 12 });
    expect(Math.abs(res.distanceKm - 18) / 18).toBeLessThanOrEqual(0.03);
  });

  it("vòng cơ bản không có đường → ROUTE_IMPOSSIBLE", async () => {
    const err = await fitDistance({
      points: [START, FAR],
      targetKm: 21,
      computeLoop: async () => {
        throw new RouteError("NO_ROUTE");
      },
    }).catch((e) => e);
    expect(err.code).toBe("ROUTE_IMPOSSIBLE");
  });

  it("lỗi dịch vụ được ném ra nguyên vẹn", async () => {
    const err = await fitDistance({
      points: [START, FAR],
      targetKm: 21,
      computeLoop: async () => {
        throw new RouteError("SERVICE_UNAVAILABLE");
      },
    }).catch((e) => e);
    expect(err.code).toBe("SERVICE_UNAVAILABLE");
  });
});
