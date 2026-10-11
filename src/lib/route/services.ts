import { GoogleGenAI } from "@google/genai";
import { RouteError } from "./errors";
import { createPromptParser } from "./gemini";
import type { RouteServices } from "./generate";
import { createMockServices } from "./mock";
import { createGeocoder } from "./places";
import { createLoopRouter } from "./routes";

const DEFAULT_GEMINI_MODEL = "gemini-pro-latest";

export function getRouteServices(env: NodeJS.ProcessEnv = process.env): RouteServices {
  if (env.ROUTE_SERVICE_MODE === "mock") return createMockServices();

  const geminiKey = env.GEMINI_API_KEY;
  const mapsKey = env.GOOGLE_MAPS_SERVER_KEY;
  if (!geminiKey || !mapsKey) {
    console.error("[services] Thiếu GEMINI_API_KEY hoặc GOOGLE_MAPS_SERVER_KEY");
    throw new RouteError("SERVICE_UNAVAILABLE");
  }

  return {
    parsePrompt: createPromptParser({
      client: new GoogleGenAI({ apiKey: geminiKey }),
      model: env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
    }),
    geocode: createGeocoder({ apiKey: mapsKey }),
    computeLoop: createLoopRouter({ apiKey: mapsKey }),
  };
}
