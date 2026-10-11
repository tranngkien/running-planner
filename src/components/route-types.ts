import type { GeneratedRoute } from "@/lib/route/generate";

export type { GeneratedRoute, RoutePoint } from "@/lib/route/generate";

export type ApiError = {
  code: string;
  error: string;
  field?: "prompt" | "distanceKm" | null;
  minKm?: number;
};

export type GenerateResult = { ok: true; route: GeneratedRoute } | { ok: false; error: ApiError };
