import { describe, expect, it, vi } from "vitest";
import { generateRoute, type RouteServices } from "@/lib/route/generate";
import { RouteError } from "@/lib/route/errors";
import { haversineKm, type LatLng } from "@/lib/route/geo";

const PLACES: Record<string, LatLng> = {
  "Times City": { lat: 20.9955, lng: 105.8686 },
  "Cầu Long Biên": { lat: 21.0437, lng: 105.8579 },
};

function services(overrides: Partial<RouteServices> = {}): RouteServices {
  return {
    parsePrompt: vi.fn(async () => ({ start: "Times City", waypoints: ["Cầu Long Biên"] })),
    geocode: vi.fn(async (q: string) => {
      const p = PLACES[q];
      if (!p) throw new RouteError("PLACE_NOT_FOUND", { place: q });
      return { query: q, name: q, address: `${q}, Hà Nội`, ...p };
    }),
    computeLoop: vi.fn(async (pts: LatLng[]) => {
      let km = 0;
      for (let i = 0; i < pts.length; i++) km += haversineKm(pts[i], pts[(i + 1) % pts.length]);
      return { distanceKm: km * 1.25, polyline: "poly" };
    }),
    ...overrides,
  };
}

describe("generateRoute", () => {
  it("tạo tuyến 21 km: điểm xuất phát, điểm đi qua, điểm vòng", async () => {
    const svc = services();
    const res = await generateRoute({ prompt: "Times City qua Long Biên", distanceKm: 21 }, svc);
    expect(Math.abs(res.distanceKm - 21) / 21).toBeLessThanOrEqual(0.03);
    expect(res.polyline).toBe("poly");
    expect(res.points[0]).toMatchObject({ kind: "start", name: "Times City" });
    expect(res.points.filter((p) => p.kind === "waypoint").map((p) => p.name)).toEqual(["Cầu Long Biên"]);
    expect(res.points.some((p) => p.kind === "detour")).toBe(true);
    // điểm đi qua được tìm với bias quanh điểm xuất phát
    expect(svc.geocode).toHaveBeenCalledWith("Cầu Long Biên", PLACES["Times City"]);
  });

  it("làm tròn quãng đường 2 chữ số thập phân", async () => {
    const res = await generateRoute({ prompt: "x", distanceKm: 21 }, services());
    expect(res.distanceKm).toBe(Math.round(res.distanceKm * 100) / 100);
  });

  it("lỗi NO_START từ parser được ném ra", async () => {
    const svc = services({
      parsePrompt: async () => {
        throw new RouteError("NO_START");
      },
    });
    await expect(generateRoute({ prompt: "tôi muốn chạy bộ", distanceKm: 10 }, svc)).rejects.toMatchObject({
      code: "NO_START",
    });
  });

  it("địa điểm không tồn tại → PLACE_NOT_FOUND", async () => {
    const svc = services({ parsePrompt: async () => ({ start: "Times City", waypoints: ["Chỗ Ảo"] }) });
    await expect(generateRoute({ prompt: "x", distanceKm: 10 }, svc)).rejects.toMatchObject({
      code: "PLACE_NOT_FOUND",
      details: { place: "Chỗ Ảo" },
    });
  });

  it("cự ly quá ngắn → ROUTE_IMPOSSIBLE", async () => {
    await expect(generateRoute({ prompt: "x", distanceKm: 3 }, services())).rejects.toMatchObject({
      code: "ROUTE_IMPOSSIBLE",
    });
  });
});
