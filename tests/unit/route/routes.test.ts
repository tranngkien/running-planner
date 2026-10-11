import { describe, expect, it, vi } from "vitest";
import { createLoopRouter } from "@/lib/route/routes";

const A = { lat: 20.9955, lng: 105.8686 };
const B = { lat: 21.0437, lng: 105.8579 };
const C = { lat: 21.02, lng: 105.88 };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const ll = (p: typeof A) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });

describe("createLoopRouter (Routes API computeRoutes)", () => {
  it("gửi vòng đi bộ khép kín và trả km + polyline", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ routes: [{ distanceMeters: 21034, polyline: { encodedPolyline: "abc" } }] }),
    );
    const computeLoop = createLoopRouter({ apiKey: "server-key", fetchFn });
    expect(await computeLoop([A, B, C])).toEqual({ distanceKm: 21.034, polyline: "abc" });

    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://routes.googleapis.com/directions/v2:computeRoutes");
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Goog-Api-Key"]).toBe("server-key");
    expect(headers["X-Goog-FieldMask"]).toBe("routes.distanceMeters,routes.polyline.encodedPolyline");
    const body = JSON.parse(init.body as string);
    expect(body.travelMode).toBe("WALK");
    expect(body.origin).toEqual(ll(A));
    expect(body.destination).toEqual(ll(A));
    expect(body.intermediates).toEqual([ll(B), ll(C)]);
  });

  it("không có tuyến → NO_ROUTE", async () => {
    const computeLoop = createLoopRouter({ apiKey: "k", fetchFn: async () => jsonResponse({}) });
    await expect(computeLoop([A, B])).rejects.toMatchObject({ code: "NO_ROUTE" });
  });

  it("HTTP lỗi hoặc mất mạng → SERVICE_UNAVAILABLE", async () => {
    const r1 = createLoopRouter({ apiKey: "k", fetchFn: async () => jsonResponse({}, 503) });
    await expect(r1([A, B])).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    const r2 = createLoopRouter({
      apiKey: "k",
      fetchFn: async () => {
        throw new TypeError("fetch failed");
      },
    });
    await expect(r2([A, B])).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
  });
});
