import { describe, expect, it, vi } from "vitest";
import { createGeocoder } from "@/lib/route/places";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const TIMES_CITY = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [105.8686, 20.9955] },
      properties: { name: "Times City", label: "Times City, Hai Bà Trưng, Hà Nội, Việt Nam" },
    },
  ],
};

function calledUrl(fetchFn: ReturnType<typeof vi.fn>) {
  return new URL((fetchFn.mock.calls[0] as unknown as [string])[0]);
}

describe("createGeocoder (OpenRouteService geocode search)", () => {
  it("trả toạ độ địa điểm đầu tiên ([lng,lat] → {lat,lng}) và gửi đúng request", async () => {
    const fetchFn = vi.fn(async () => jsonResponse(TIMES_CITY));
    const geocode = createGeocoder({ apiKey: "ors-key", fetchFn });
    expect(await geocode("Cổng Times City, Hà Nội")).toEqual({
      query: "Cổng Times City, Hà Nội",
      name: "Times City",
      address: "Times City, Hai Bà Trưng, Hà Nội, Việt Nam",
      lat: 20.9955,
      lng: 105.8686,
    });

    const url = calledUrl(fetchFn);
    expect(url.origin + url.pathname).toBe("https://api.openrouteservice.org/geocode/search");
    expect(url.searchParams.get("api_key")).toBe("ors-key");
    expect(url.searchParams.get("text")).toBe("Cổng Times City, Hà Nội");
    expect(url.searchParams.get("boundary.country")).toBe("VN");
    expect(url.searchParams.get("size")).toBe("1");
    expect(url.searchParams.has("focus.point.lat")).toBe(false);
  });

  it("có bias → gửi focus.point quanh điểm đó", async () => {
    const fetchFn = vi.fn(async () => jsonResponse(TIMES_CITY));
    await createGeocoder({ apiKey: "k", fetchFn })("Cầu Long Biên", { lat: 21, lng: 105.8 });
    const url = calledUrl(fetchFn);
    expect(url.searchParams.get("focus.point.lat")).toBe("21");
    expect(url.searchParams.get("focus.point.lon")).toBe("105.8");
  });

  it("thiếu name → dùng chính chuỗi tìm kiếm làm tên", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ features: [{ geometry: { coordinates: [105.85, 21.03] }, properties: {} }] }),
    );
    const res = await createGeocoder({ apiKey: "k", fetchFn })("Hồ Gươm");
    expect(res).toMatchObject({ name: "Hồ Gươm", address: "", lat: 21.03, lng: 105.85 });
  });

  it("không có kết quả → PLACE_NOT_FOUND kèm tên địa điểm", async () => {
    const geocode = createGeocoder({ apiKey: "k", fetchFn: async () => jsonResponse({ features: [] }) });
    await expect(geocode("Chỗ Không Có Thật")).rejects.toMatchObject({
      code: "PLACE_NOT_FOUND",
      message: "Không tìm thấy địa điểm: Chỗ Không Có Thật",
    });
  });

  describe("dự phòng Nominatim", () => {
    const HOAN_KIEM = [{ lat: "21.0288", lon: "105.8525", name: "Hồ Hoàn Kiếm", display_name: "Hồ Hoàn Kiếm, Hà Nội, Việt Nam" }];
    const COARSE = {
      features: [{ geometry: { coordinates: [105.8412, 21.0245] }, properties: { name: "Hanoi", label: "Hanoi, Vietnam", layer: "locality" } }],
    };

    function router(ors: () => Response, nominatim: () => Response) {
      return vi.fn(async (url: string) => (url.includes("nominatim.openstreetmap.org") ? nominatim() : ors()));
    }

    it("ORS trả kết quả cụ thể (venue) → dùng ORS, không gọi Nominatim", async () => {
      const fetchFn = router(() => jsonResponse(TIMES_CITY), () => jsonResponse(HOAN_KIEM));
      await createGeocoder({ apiKey: "k", fetchFn })("Times City");
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it("ORS chỉ trả cấp thành phố (locality) → dùng Nominatim", async () => {
      const fetchFn = router(() => jsonResponse(COARSE), () => jsonResponse(HOAN_KIEM));
      expect(await createGeocoder({ apiKey: "k", fetchFn })("Hồ Gươm, Hà Nội")).toEqual({
        query: "Hồ Gươm, Hà Nội",
        name: "Hồ Hoàn Kiếm",
        address: "Hồ Hoàn Kiếm, Hà Nội, Việt Nam",
        lat: 21.0288,
        lng: 105.8525,
      });
      const url = new URL((fetchFn.mock.calls[1] as unknown as [string])[0]);
      expect(url.origin + url.pathname).toBe("https://nominatim.openstreetmap.org/search");
      expect(url.searchParams.get("q")).toBe("Hồ Gươm, Hà Nội");
      expect(url.searchParams.get("countrycodes")).toBe("vn");
      expect(url.searchParams.get("format")).toBe("jsonv2");
      const init = (fetchFn.mock.calls[1] as unknown as [string, RequestInit])[1];
      expect((init.headers as Record<string, string>)["User-Agent"]).toMatch(/running-planner/);
    });

    it("ORS lỗi HTTP → vẫn dùng được Nominatim", async () => {
      const fetchFn = router(() => jsonResponse({ error: "quota" }, 429), () => jsonResponse(HOAN_KIEM));
      expect(await createGeocoder({ apiKey: "k", fetchFn })("Hồ Gươm")).toMatchObject({ name: "Hồ Hoàn Kiếm" });
    });

    it("có bias → Nominatim nhận viewbox quanh điểm đó", async () => {
      const fetchFn = router(() => jsonResponse({ features: [] }), () => jsonResponse(HOAN_KIEM));
      await createGeocoder({ apiKey: "k", fetchFn })("Hồ Gươm", { lat: 21, lng: 105.8 });
      const url = new URL((fetchFn.mock.calls[1] as unknown as [string])[0]);
      const [w, n, e, s] = url.searchParams.get("viewbox")!.split(",").map(Number);
      expect(w).toBeLessThan(105.8);
      expect(e).toBeGreaterThan(105.8);
      expect(n).toBeGreaterThan(21);
      expect(s).toBeLessThan(21);
    });

    it("cả hai không có kết quả → PLACE_NOT_FOUND", async () => {
      const fetchFn = router(() => jsonResponse(COARSE), () => jsonResponse([]));
      await expect(createGeocoder({ apiKey: "k", fetchFn })("Atlantis")).rejects.toMatchObject({
        code: "PLACE_NOT_FOUND",
      });
    });

    it("cả hai lỗi → SERVICE_UNAVAILABLE", async () => {
      const fetchFn = router(() => jsonResponse({}, 503), () => jsonResponse({}, 503));
      await expect(createGeocoder({ apiKey: "k", fetchFn })("A")).rejects.toMatchObject({
        code: "SERVICE_UNAVAILABLE",
      });
    });
  });

  it("HTTP lỗi hoặc mất mạng → SERVICE_UNAVAILABLE", async () => {
    const g1 = createGeocoder({ apiKey: "k", fetchFn: async () => jsonResponse({ error: "quota" }, 429) });
    await expect(g1("A")).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    const g2 = createGeocoder({
      apiKey: "k",
      fetchFn: async () => {
        throw new TypeError("fetch failed");
      },
    });
    await expect(g2("A")).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
  });
});
