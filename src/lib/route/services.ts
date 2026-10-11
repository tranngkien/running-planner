import { GoogleGenAI } from "@google/genai";
import { RouteError } from "./errors";
import { createPromptParser } from "./gemini";
import type { RouteServices } from "./generate";
import { createMockServices } from "./mock";
import { createGeocoder } from "./places";
import { createLoopRouter } from "./routes";

const DEFAULT_GEMINI_MODEL = "gemini-flash-lite-latest";
const DEFAULT_GEMINI_FALLBACK_MODEL = "gemini-flash-latest";

export function getRouteServices(env: NodeJS.ProcessEnv = process.env): RouteServices {
  if (env.ROUTE_SERVICE_MODE === "mock") return createMockServices();

  const geminiKey = env.GEMINI_API_KEY;
  const orsKey = env.ORS_API_KEY;
  if (!geminiKey || !orsKey) {
    console.error("[services] Thiếu GEMINI_API_KEY hoặc ORS_API_KEY");
    throw new RouteError("SERVICE_UNAVAILABLE");
  }

  return {
    parsePrompt: createPromptParser({
      client: new GoogleGenAI({ apiKey: geminiKey }),
      model: env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
      fallbackModel: env.GEMINI_FALLBACK_MODEL || DEFAULT_GEMINI_FALLBACK_MODEL,
    }),
    geocode: createGeocoder({ apiKey: orsKey }),
    computeLoop: createLoopRouter({ apiKey: orsKey }),
  };
}
