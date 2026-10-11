import { RouteError } from "./errors";

export type ParsedPrompt = { start: string; waypoints: string[] };

/** Phần tối thiểu của `GoogleGenAI` mà parser cần, để test inject được. */
export type GenAIClient = {
  models: {
    generateContent(args: {
      model: string;
      contents: string;
      config: Record<string, unknown>;
    }): Promise<{ text?: string }>;
  };
};

const MAX_WAYPOINTS = 5;

const SYSTEM_INSTRUCTION = `Bạn bóc tách mô tả tuyến chạy bộ tiếng Việt thành dữ liệu có cấu trúc.
- "start": địa điểm xuất phát, viết thành tên tìm được trên Google Maps (thêm thành phố nếu suy ra được, ví dụ "Cổng Times City, Hà Nội"). Nếu mô tả không nêu địa điểm xuất phát nào, trả null.
- "waypoints": các địa điểm muốn chạy qua, đúng thứ tự trong mô tả, tối đa ${MAX_WAYPOINTS}. Không lặp lại điểm xuất phát.
- Không tự bịa địa điểm không có trong mô tả. Bỏ qua thông tin cự ly.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    start: { type: ["string", "null"], description: "Địa điểm xuất phát" },
    waypoints: { type: "array", items: { type: "string" }, maxItems: MAX_WAYPOINTS },
  },
  required: ["start", "waypoints"],
};

export function createPromptParser({ client, model }: { client: GenAIClient; model: string }) {
  return async function parsePrompt(prompt: string): Promise<ParsedPrompt> {
    let raw: unknown;
    try {
      const res = await client.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseJsonSchema: RESPONSE_SCHEMA,
          temperature: 0,
        },
      });
      raw = JSON.parse(res.text ?? "");
    } catch (e) {
      console.error("[gemini] parsePrompt lỗi:", e);
      throw new RouteError("SERVICE_UNAVAILABLE");
    }

    const data = (raw ?? {}) as { start?: unknown; waypoints?: unknown };
    const start = typeof data.start === "string" ? data.start.trim() : "";
    if (!start) throw new RouteError("NO_START");
    const waypoints = Array.isArray(data.waypoints)
      ? data.waypoints
          .filter((w): w is string => typeof w === "string" && w.trim() !== "")
          .map((w) => w.trim())
          .slice(0, MAX_WAYPOINTS)
      : [];
    return { start, waypoints };
  };
}
