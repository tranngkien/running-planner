import { describe, expect, it, vi } from "vitest";
import { createPromptParser } from "@/lib/route/gemini";

const noSleep = async () => {};

type GenerateArgs = { model: string; contents: string; config: Record<string, unknown> };

function fakeClient(impl: (args: GenerateArgs) => Promise<{ text?: string }>) {
  return { models: { generateContent: vi.fn(impl) } };
}

describe("createPromptParser (Gemini)", () => {
  it("bóc điểm xuất phát và điểm đi qua từ JSON", async () => {
    const client = fakeClient(async () => ({
      text: JSON.stringify({ start: "Cổng Times City, Hà Nội", waypoints: ["Cầu Long Biên, Hà Nội"] }),
    }));
    const parse = createPromptParser({ client, model: "gemini-pro-latest" });
    expect(await parse("xuất phát từ cổng Times City, đi qua cầu Long Biên")).toEqual({
      start: "Cổng Times City, Hà Nội",
      waypoints: ["Cầu Long Biên, Hà Nội"],
    });
    const args = (client.models.generateContent.mock.calls[0] as unknown[])[0] as {
      model: string;
      config: Record<string, unknown>;
    };
    expect(args.model).toBe("gemini-pro-latest");
    expect(args.config.responseMimeType).toBe("application/json");
    expect(args.config.responseJsonSchema).toBeDefined();
  });

  it("không có điểm xuất phát → NO_START", async () => {
    const parse = createPromptParser({
      client: fakeClient(async () => ({ text: JSON.stringify({ start: null, waypoints: [] }) })),
      model: "m",
    });
    await expect(parse("tôi muốn chạy bộ")).rejects.toMatchObject({ code: "NO_START" });
  });

  it("điểm xuất phát là chuỗi rỗng → NO_START", async () => {
    const parse = createPromptParser({
      client: fakeClient(async () => ({ text: JSON.stringify({ start: "  ", waypoints: [] }) })),
      model: "m",
    });
    await expect(parse("abc")).rejects.toMatchObject({ code: "NO_START" });
  });

  it("giới hạn tối đa 5 điểm đi qua, bỏ chuỗi rỗng", async () => {
    const parse = createPromptParser({
      client: fakeClient(async () => ({
        text: JSON.stringify({ start: "A", waypoints: ["B", "", "C", "D", "E", "F", "G"] }),
      })),
      model: "m",
    });
    expect((await parse("x")).waypoints).toEqual(["B", "C", "D", "E", "F"]);
  });

  it("Gemini lỗi (429/mạng) → SERVICE_UNAVAILABLE", async () => {
    const parse = createPromptParser({
      client: fakeClient(async () => {
        throw Object.assign(new Error("quota"), { status: 429 });
      }),
      model: "m",
      sleep: noSleep,
    });
    await expect(parse("x")).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
  });

  it("503 tạm thời rồi thành công → thử lại và trả kết quả", async () => {
    let calls = 0;
    const client = fakeClient(async () => {
      calls++;
      if (calls === 1) throw Object.assign(new Error("high demand"), { status: 503 });
      return { text: JSON.stringify({ start: "Hồ Gươm", waypoints: [] }) };
    });
    const parse = createPromptParser({ client, model: "m", sleep: noSleep });
    expect(await parse("x")).toEqual({ start: "Hồ Gươm", waypoints: [] });
    expect(calls).toBe(2);
  });

  it("503 liên tục → SERVICE_UNAVAILABLE sau 3 lần gọi", async () => {
    const client = fakeClient(async () => {
      throw Object.assign(new Error("high demand"), { status: 503 });
    });
    const parse = createPromptParser({ client, model: "m", sleep: noSleep });
    await expect(parse("x")).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    expect(client.models.generateContent).toHaveBeenCalledTimes(3);
  });

  it("model chính lỗi 503/429 liên tục → chuyển sang model dự phòng", async () => {
    const client = fakeClient(async (args) => {
      if (args.model === "chinh") throw Object.assign(new Error("quota"), { status: 429 });
      return { text: JSON.stringify({ start: "Hồ Gươm", waypoints: [] }) };
    });
    const parse = createPromptParser({ client, model: "chinh", fallbackModel: "du-phong", sleep: noSleep });
    expect(await parse("x")).toEqual({ start: "Hồ Gươm", waypoints: [] });
    const models = client.models.generateContent.mock.calls.map(([args]) => args.model);
    expect(models.at(-1)).toBe("du-phong");
  });

  it("lỗi 400 → không thử lại", async () => {
    const client = fakeClient(async () => {
      throw Object.assign(new Error("bad request"), { status: 400 });
    });
    const parse = createPromptParser({ client, model: "m", sleep: noSleep });
    await expect(parse("x")).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    expect(client.models.generateContent).toHaveBeenCalledTimes(1);
  });

  it("trả về không phải JSON → SERVICE_UNAVAILABLE", async () => {
    const parse = createPromptParser({ client: fakeClient(async () => ({ text: "xin chào" })), model: "m" });
    await expect(parse("x")).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
  });
});
