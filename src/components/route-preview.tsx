import { decodePolyline } from "@/lib/route/geo";
import type { RoutePoint } from "./route-types";

const SIZE = 600;
const PAD = 48;

/** Bản xem trước tuyến bằng SVG, dùng khi chưa cấu hình Google Maps browser key. */
export function RoutePreview({ polyline, points }: { polyline: string; points: RoutePoint[] }) {
  const path = decodePolyline(polyline);
  const all = [...path, ...points];
  const lats = all.map((p) => p.lat);
  const lngs = all.map((p) => p.lng);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const latScale = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
  const span = Math.max(maxLat - minLat, (maxLng - minLng) * latScale) || 1e-3;
  const scale = (SIZE - PAD * 2) / span;
  const project = (p: { lat: number; lng: number }) => ({
    x: PAD + (p.lng - minLng) * latScale * scale,
    y: SIZE - PAD - (p.lat - minLat) * scale,
  });

  const d = path.map((p, i) => `${i === 0 ? "M" : "L"}${project(p).x.toFixed(1)},${project(p).y.toFixed(1)}`).join(" ");
  const labelled = points.filter((p) => p.kind !== "detour");

  return (
    <figure data-testid="route-preview" className="flex h-full flex-col">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label="Sơ đồ tuyến chạy"
        className="min-h-0 w-full flex-1"
      >
        <path d={d} fill="none" stroke="var(--route)" strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
        {labelled.map((p, i) => {
          const { x, y } = project(p);
          return (
            <g key={`${p.lat},${p.lng}`}>
              <circle cx={x} cy={y} r={13} fill={p.kind === "start" ? "var(--start)" : "var(--ink)"} />
              <text x={x} y={y} dy="0.35em" textAnchor="middle" fontSize={13} fontWeight={600} fill="#fff">
                {p.kind === "start" ? "S" : i}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="px-4 pb-3 text-xs text-muted">
        Sơ đồ đơn giản. Cấu hình NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY để xem trên Google Maps.
      </figcaption>
    </figure>
  );
}
