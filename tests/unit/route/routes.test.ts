import { describe, expect, it, vi } from "vitest";
import { createLoopRouter } from "@/lib/route/routes";

const A = { lat: 20.9955, lng: 105.8686 };
const B = { lat: 21.0437, lng: 105.8579 };
const C = { lat: 21.02, lng: 105.88 };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const OK_BODY = { routes: [{ summary: { distance: 21034.5, duration: 15000 }, geometry: "abc" }] };

describe("createLoopRouter (OpenRouteService directions foot-walking)", () => {
  it("gửi vòng đi bộ khép kín ([lng,lat]) và trả km + polyline", async () => {
    const fetchFn = vi.fn(async () => jsonResponse(OK_BODY));
    const computeLoop = createLoopRouter({ apiKey: "ors-key", fetchFn });
    expect(await computeLoop([A, B, C])).toEqual({ distanceKm: 21.0345, polyline: "abc" });

    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.openrouteservice.org/v2/directions/foot-walking/json");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("ors-key");
    const body = JSON.parse(init.body as string);
    const ll = (p: typeof A) => [p.lng, p.lat];
    expect(body.coordinates).toEqual([ll(A), ll(B), ll(C), ll(A)]);
    expect(body.instructions).toBe(false);
    expect(body.radiuses).toEqual([1000, 1000, 1000, 1000]);
  });

  it.each([2009, 2010])("lỗi ORS %i (không có tuyến / không có điểm đi được) → NO_ROUTE", async (code) => {
    const computeLoop = createLoopRouter({
      apiKey: "k",
      fetchFn: async () => jsonResponse({ error: { code, message: "x" } }, 404),
    });
    await expect(computeLoop([A, B])).rejects.toMatchObject({ code: "NO_ROUTE" });
  });

  it("response không có routes → NO_ROUTE", async () => {
    const computeLoop = createLoopRouter({ apiKey: "k", fetchFn: async () => jsonResponse({ routes: [] }) });
    await expect(computeLoop([A, B])).rejects.toMatchObject({ code: "NO_ROUTE" });
  });

  it("HTTP 429/503, lỗi tham số hoặc mất mạng → SERVICE_UNAVAILABLE", async () => {
    for (const [status, body] of [
      [429, { error: "Rate limit exceeded" }],
      [503, {}],
      [400, { error: { code: 2003, message: "invalid" } }],
    ] as const) {
      const r = createLoopRouter({ apiKey: "k", fetchFn: async () => jsonResponse(body, status) });
      await expect(r([A, B])).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    }
    const r2 = createLoopRouter({
      apiKey: "k",
      fetchFn: async () => {
        throw new TypeError("fetch failed");
      },
    });
    await expect(r2([A, B])).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
  });
});
