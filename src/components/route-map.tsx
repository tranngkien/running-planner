"use client";

import dynamic from "next/dynamic";
import type { GeneratedRoute } from "./route-types";

// Leaflet cần `window`, nên chỉ render phía trình duyệt
const LeafletMap = dynamic(() => import("./leaflet-map").then((m) => m.LeafletMap), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-muted">Đang tải bản đồ…</div>,
});

export function RouteMap({ route }: { route: GeneratedRoute | null }) {
  return (
    <div data-testid="route-map" className="absolute inset-0">
      <LeafletMap route={route} />
      {!route && (
        <p className="pointer-events-none absolute left-1/2 top-4 z-[1000] -translate-x-1/2 rounded-md bg-surface/95 px-4 py-2 text-sm text-muted shadow-sm">
          Nhập mô tả và chọn cự ly để tạo tuyến chạy.
        </p>
      )}
    </div>
  );
}
