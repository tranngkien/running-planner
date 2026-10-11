import { describe, expect, it, vi } from "vitest";
import { createPromptParser } from "@/lib/route/gemini";

function fakeClient(impl: () => Promise<{ text?: string }>) {
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
    });
    await expect(parse("x")).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
  });

  it("trả về không phải JSON → SERVICE_UNAVAILABLE", async () => {
    const parse = createPromptParser({ client: fakeClient(async () => ({ text: "xin chào" })), model: "m" });
    await expect(parse("x")).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
  });
});
