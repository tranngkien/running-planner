"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { RouteMap } from "./route-map";
import type { ApiError, GeneratedRoute } from "./route-types";

const PRESETS = [5, 10, 15, 21, 42];
const MAX_PROMPT = 500;
const EXAMPLE = "Xuất phát từ cổng Times City, chạy qua cầu Long Biên rồi quay về";

type FieldErrors = { prompt?: string; distanceKm?: string };

const kmFormat = new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function Planner() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [preset, setPreset] = useState<number | "custom">(10);
  const [customKm, setCustomKm] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<ApiError | null>(null);
  const [route, setRoute] = useState<GeneratedRoute | null>(null);
  const [pending, setPending] = useState(false);

  function validate(): { prompt: string; distanceKm: number } | null {
    const errors: FieldErrors = {};
    const text = prompt.trim();
    const km = preset === "custom" ? Number(customKm) : preset;
    if (!text) errors.prompt = "Vui lòng nhập mô tả tuyến chạy";
    else if (text.length > MAX_PROMPT) errors.prompt = `Mô tả tối đa ${MAX_PROMPT} ký tự`;
    if (!Number.isFinite(km) || km < 1 || km > 100 || (preset === "custom" && customKm.trim() === "")) {
      errors.distanceKm = "Cự ly phải từ 1 đến 100 km";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length ? null : { prompt: text, distanceKm: km };
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const input = validate();
    if (!input) return;

    setPending(true);
    try {
      const res = await fetch("/api/routes/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const data = await res.json();
      if (res.ok) {
        setRoute(data as GeneratedRoute);
        return;
      }
      const apiError = data as ApiError;
      if (apiError.code === "INVALID_INPUT" && apiError.field) {
        setFieldErrors({ [apiError.field]: apiError.error });
      } else {
        setError(apiError);
      }
    } catch {
      setError({ code: "NETWORK", error: "Không kết nối được máy chủ, vui lòng thử lại" });
    } finally {
      setPending(false);
    }
  }

  const promptInvalid = Boolean(fieldErrors.prompt);
  const distanceInvalid = Boolean(fieldErrors.distanceKm);
  let waypointNo = 0;

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[420px_1fr]">
      <main className="flex min-h-0 flex-col gap-6 overflow-y-auto border-line p-6 lg:border-r">
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          <div>
            <label htmlFor="prompt" className="block text-sm font-medium">
              Mô tả tuyến chạy
            </label>
            <textarea
              id="prompt"
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={EXAMPLE}
              aria-invalid={promptInvalid}
              aria-describedby={promptInvalid ? "prompt-error" : "prompt-help"}
              className="mt-1.5 w-full resize-y rounded-md border border-line bg-surface px-3 py-2 text-base leading-relaxed aria-[invalid=true]:border-danger"
            />
            {promptInvalid ? (
              <p id="prompt-error" className="mt-1 text-sm text-danger">
                {fieldErrors.prompt}
              </p>
            ) : (
              <p id="prompt-help" className="mt-1 text-xs text-muted">
                Nêu điểm xuất phát và các nơi muốn chạy qua. Tuyến luôn quay về điểm xuất phát.
              </p>
            )}
          </div>

          <fieldset aria-describedby={distanceInvalid ? "distance-error" : undefined}>
            <legend className="text-sm font-medium">Cự ly</legend>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {[...PRESETS, "custom" as const].map((value) => {
                const checked = preset === value;
                return (
                  <label
                    key={value}
                    className={`relative rounded-md border px-3.5 py-2 text-sm font-medium transition-colors ${
                      checked ? "border-ink bg-ink text-white" : "border-line bg-surface hover:border-ink/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="distance"
                      value={value}
                      checked={checked}
                      onChange={() => setPreset(value)}
                      className="absolute inset-0 cursor-pointer opacity-0"
                    />
                    {value === "custom" ? "Khác" : `${value} km`}
                  </label>
                );
              })}
            </div>
            {preset === "custom" && (
              <div className="mt-3">
                <label htmlFor="custom-km" className="block text-sm">
                  Cự ly tự chọn (km)
                </label>
                <input
                  id="custom-km"
                  type="number"
                  inputMode="decimal"
                  min={1}
                  max={100}
                  step="0.1"
                  value={customKm}
                  onChange={(e) => setCustomKm(e.target.value)}
                  aria-invalid={distanceInvalid}
                  className="mt-1 w-32 rounded-md border border-line bg-surface px-3 py-2 text-base aria-[invalid=true]:border-danger"
                />
              </div>
            )}
            {distanceInvalid && (
              <p id="distance-error" className="mt-1 text-sm text-danger">
                {fieldErrors.distanceKm}
              </p>
            )}
          </fieldset>

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-route px-4 py-2.5 font-medium text-white transition-colors hover:bg-route-ink disabled:opacity-60"
          >
            {pending ? "Đang tạo tuyến…" : "Tạo map"}
          </button>
        </form>

        {error && (
          <div role="alert" className="rounded-md border border-danger/30 bg-danger-bg px-4 py-3 text-sm text-danger">
            <p className="font-medium">{error.error}</p>
            {error.minKm !== undefined && (
              <p className="mt-1">Tuyến ngắn nhất qua các điểm đã mô tả dài khoảng {kmFormat.format(error.minKm)} km.</p>
            )}
          </div>
        )}

        {route && !error && (
          <section aria-labelledby="result-heading" className="space-y-4">
            <h2 id="result-heading" className="sr-only">
              Kết quả
            </h2>
            <p data-testid="route-distance" data-km={route.distanceKm} className="flex items-baseline gap-2">
              <span className="text-4xl font-semibold tabular-nums tracking-tight">
                {kmFormat.format(route.distanceKm)}
              </span>
              <span className="text-muted">km, mục tiêu {route.targetKm} km</span>
            </p>
            <ol data-testid="route-points" className="space-y-2">
              {route.points.map((p) => {
                const badge = p.kind === "start" ? "S" : p.kind === "waypoint" ? String(++waypointNo) : "";
                return (
                  <li key={`${p.lat},${p.lng}`} className="flex gap-3">
                    <span
                      aria-hidden
                      className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        p.kind === "start"
                          ? "bg-start text-white"
                          : p.kind === "waypoint"
                            ? "bg-ink text-white"
                            : "border border-dashed border-muted"
                      }`}
                    >
                      {badge}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium">{p.name}</span>
                      {p.address && <span className="block truncate text-xs text-muted">{p.address}</span>}
                      {p.kind === "detour" && (
                        <span className="block text-xs text-muted">Thêm vào để đủ cự ly</span>
                      )}
                    </span>
                  </li>
                );
              })}
              <li className="flex gap-3 text-sm text-muted">
                <span aria-hidden className="mt-0.5 flex size-6 shrink-0 items-center justify-center">
                  ↺
                </span>
                Quay về điểm xuất phát
              </li>
            </ol>
          </section>
        )}
      </main>

      <section aria-label="Bản đồ" className="relative min-h-[420px] bg-surface lg:min-h-0">
        <RouteMap route={error ? null : route} />
      </section>
    </div>
  );
}
