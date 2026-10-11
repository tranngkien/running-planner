import { describe, expect, it, vi } from "vitest";
import { createGeocoder } from "@/lib/route/places";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function lastCall(fetchFn: ReturnType<typeof vi.fn>) {
  const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
  return { url, headers: init.headers as Record<string, string>, body: JSON.parse(init.body as string) };
}

describe("createGeocoder (Places API Text Search)", () => {
  it("trả toạ độ địa điểm đầu tiên và gửi đúng request", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        places: [
          {
            displayName: { text: "Times City" },
            formattedAddress: "458 Minh Khai, Hà Nội",
            location: { latitude: 20.9955, longitude: 105.8686 },
          },
        ],
      }),
    );
    const geocode = createGeocoder({ apiKey: "server-key", fetchFn });
    expect(await geocode("Cổng Times City")).toEqual({
      query: "Cổng Times City",
      name: "Times City",
      address: "458 Minh Khai, Hà Nội",
      lat: 20.9955,
      lng: 105.8686,
    });

    const { url, headers, body } = lastCall(fetchFn);
    expect(url).toBe("https://places.googleapis.com/v1/places:searchText");
    expect(headers["X-Goog-Api-Key"]).toBe("server-key");
    expect(headers["X-Goog-FieldMask"]).toContain("places.location");
    expect(body.textQuery).toBe("Cổng Times City");
    expect(body.regionCode).toBe("VN");
    expect(body.languageCode).toBe("vi");
  });

  it("có bias → gửi locationBias quanh điểm đó", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ places: [{ displayName: { text: "X" }, location: { latitude: 1, longitude: 2 } }] }),
    );
    await createGeocoder({ apiKey: "k", fetchFn })("Cầu Long Biên", { lat: 21, lng: 105.8 });
    expect(lastCall(fetchFn).body.locationBias.circle.center).toEqual({ latitude: 21, longitude: 105.8 });
  });

  it("không có kết quả → PLACE_NOT_FOUND kèm tên địa điểm", async () => {
    const geocode = createGeocoder({ apiKey: "k", fetchFn: async () => jsonResponse({}) });
    await expect(geocode("Chỗ Không Có Thật")).rejects.toMatchObject({
      code: "PLACE_NOT_FOUND",
      message: "Không tìm thấy địa điểm: Chỗ Không Có Thật",
    });
  });

  it("HTTP lỗi hoặc mất mạng → SERVICE_UNAVAILABLE", async () => {
    const g1 = createGeocoder({ apiKey: "k", fetchFn: async () => jsonResponse({ error: {} }, 429) });
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
