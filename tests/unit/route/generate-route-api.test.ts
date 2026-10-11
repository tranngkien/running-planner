import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/routes/generate/route";

function req(body: unknown) {
  return new Request("http://localhost/api/routes/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  // Dùng bộ dịch vụ giả lập (không gọi Gemini/Google thật)
  process.env.ROUTE_SERVICE_MODE = "mock";
});

describe("POST /api/routes/generate", () => {
  it("thành công → 200 với tuyến vòng đúng cự ly ±3%", async () => {
    const res = await POST(req({ prompt: "Xuất phát từ cổng Times City, đi qua cầu Long Biên", distanceKm: 21 }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Math.abs(data.distanceKm - 21) / 21).toBeLessThanOrEqual(0.03);
    expect(data.targetKm).toBe(21);
    expect(typeof data.polyline).toBe("string");
    expect(data.points[0].kind).toBe("start");
    expect(data.points.some((p: { kind: string }) => p.kind === "waypoint")).toBe(true);
  });

  it.each([
    [{ prompt: "", distanceKm: 10 }, "prompt"],
    [{ prompt: "   ", distanceKm: 10 }, "prompt"],
    [{ prompt: "a".repeat(501), distanceKm: 10 }, "prompt"],
    [{ prompt: "Times City", distanceKm: 0 }, "distanceKm"],
    [{ prompt: "Times City", distanceKm: 101 }, "distanceKm"],
    [{ prompt: "Times City", distanceKm: "abc" }, "distanceKm"],
  ])("input không hợp lệ %j → 400, chỉ ra trường %s", async (body, field) => {
    const res = await POST(req(body));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("INVALID_INPUT");
    expect(data.field).toBe(field);
  });

  it("body không phải JSON → 400", async () => {
    expect((await POST(req("khong-phai-json"))).status).toBe(400);
  });

  it("cự ly quá ngắn → 422 'Cự ly và mô tả không thể tạo được Map chạy hợp lệ' kèm minKm", async () => {
    const res = await POST(req({ prompt: "Xuất phát từ Times City, đi qua Hồ Tây", distanceKm: 3 }));
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data).toMatchObject({
      code: "ROUTE_IMPOSSIBLE",
      error: "Cự ly và mô tả không thể tạo được Map chạy hợp lệ",
    });
    expect(data.minKm).toBeGreaterThan(3);
  });

  it("không có điểm xuất phát → 422 NO_START", async () => {
    const res = await POST(req({ prompt: "tôi muốn chạy bộ", distanceKm: 10 }));
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({
      code: "NO_START",
      error: "Không xác định được điểm xuất phát từ mô tả",
    });
  });

  it("địa điểm không tồn tại → 422 PLACE_NOT_FOUND", async () => {
    const res = await POST(req({ prompt: "Xuất phát từ Times City, đi qua Atlantis", distanceKm: 10 }));
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({
      code: "PLACE_NOT_FOUND",
      error: "Không tìm thấy địa điểm: Atlantis",
    });
  });

  it("dịch vụ ngoài lỗi → 503 SERVICE_UNAVAILABLE", async () => {
    const res = await POST(req({ prompt: "Times City [giả lập lỗi dịch vụ]", distanceKm: 10 }));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      error: "Dịch vụ tạm thời không khả dụng, vui lòng thử lại",
    });
  });

  it("thiếu cấu hình key ở chế độ thật → 503, không crash", async () => {
    process.env.ROUTE_SERVICE_MODE = "";
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_MAPS_SERVER_KEY;
    const res = await POST(req({ prompt: "Times City", distanceKm: 10 }));
    expect(res.status).toBe(503);
  });
});
