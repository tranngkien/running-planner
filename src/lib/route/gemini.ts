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
/** Gemini thỉnh thoảng trả 503 "high demand" — lỗi tạm thời, thử lại với backoff. */
const RETRYABLE_STATUS = new Set([429, 500, 503]);
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 800;

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

export function createPromptParser({
  client,
  model,
  fallbackModel,
  sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
}: {
  client: GenAIClient;
  model: string;
  fallbackModel?: string;
  sleep?: (ms: number) => Promise<void>;
}) {
  const models = [...new Set([model, fallbackModel].filter((m): m is string => Boolean(m)))];

  /** Gọi Gemini, thử lại khi lỗi tạm thời (429/5xx); hết lượt thì chuyển sang model dự phòng. */
  async function generateJson(prompt: string): Promise<unknown> {
    for (const m of models) {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const res = await client.models.generateContent({
            model: m,
            contents: prompt,
            config: {
              systemInstruction: SYSTEM_INSTRUCTION,
              responseMimeType: "application/json",
              responseJsonSchema: RESPONSE_SCHEMA,
              temperature: 0,
            },
          });
          return JSON.parse(res.text ?? "");
        } catch (e) {
          const status = (e as { status?: number }).status;
          const retryable = status !== undefined && RETRYABLE_STATUS.has(status);
          console.error(`[gemini] ${m} lần ${attempt + 1} lỗi:`, e);
          if (!retryable) throw new RouteError("SERVICE_UNAVAILABLE");
          if (attempt < MAX_RETRIES) await sleep(RETRY_BASE_MS * 2 ** attempt);
        }
      }
    }
    throw new RouteError("SERVICE_UNAVAILABLE");
  }

  return async function parsePrompt(prompt: string): Promise<ParsedPrompt> {
    const raw = await generateJson(prompt);

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
