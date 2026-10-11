"use client";

import { GoogleRouteMap } from "./google-route-map";
import { RoutePreview } from "./route-preview";
import type { GeneratedRoute } from "./route-types";

const BROWSER_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ?? "";
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? "";

export function RouteMap({ route }: { route: GeneratedRoute | null }) {
  if (BROWSER_KEY) {
    return <GoogleRouteMap apiKey={BROWSER_KEY} mapId={MAP_ID} polyline={route?.polyline} points={route?.points} />;
  }
  if (route) return <RoutePreview polyline={route.polyline} points={route.points} />;
  return (
    <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted">
      Nhập mô tả và chọn cự ly để tạo tuyến chạy.
    </div>
  );
}
