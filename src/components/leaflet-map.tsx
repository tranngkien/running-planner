"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import { decodePolyline, type LatLng } from "@/lib/route/geo";
import type { GeneratedRoute } from "./route-types";

const HANOI: [number, number] = [21.0285, 105.8542];

/** Marker dạng chấm tròn có nhãn — tránh icon ảnh mặc định của Leaflet (lỗi đường dẫn khi bundle). */
function badgeIcon(label: string, background: string) {
  return L.divIcon({
    className: "",
    html: `<span style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:9999px;background:${background};color:#fff;font:600 12px/1 var(--font-sans);border:2px solid #fff;box-shadow:0 1px 3px rgba(24,38,31,.35)">${label}</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function FitBounds({ path }: { path: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (path.length === 0) return;
    map.fitBounds(L.latLngBounds(path.map((p) => [p.lat, p.lng])), { padding: [48, 48] });
  }, [map, path]);
  return null;
}

export function LeafletMap({ route }: { route: GeneratedRoute | null }) {
  const path = useMemo(() => (route ? decodePolyline(route.polyline) : []), [route]);
  let waypointNo = 0;

  return (
    <MapContainer center={HANOI} zoom={13} scrollWheelZoom className="h-full w-full">
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
      />
      {path.length > 0 && (
        <Polyline positions={path.map((p) => [p.lat, p.lng])} pathOptions={{ color: "#2350d8", weight: 5, opacity: 0.9 }} />
      )}
      {route?.points
        .filter((p) => p.kind !== "detour")
        .map((p) => {
          const isStart = p.kind === "start";
          const label = isStart ? "S" : String(++waypointNo);
          return (
            <Marker key={`${p.lat},${p.lng}`} position={[p.lat, p.lng]} icon={badgeIcon(label, isStart ? "#0e8a5f" : "#18261f")}>
              <Tooltip direction="top" offset={[0, -14]}>
                {p.name}
              </Tooltip>
            </Marker>
          );
        })}
      <FitBounds path={path} />
    </MapContainer>
  );
}
