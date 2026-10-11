"use client";

import { AdvancedMarker, APIProvider, Map, Pin, Polyline, useMap } from "@vis.gl/react-google-maps";
import { useEffect } from "react";
import { decodePolyline } from "@/lib/route/geo";
import type { RoutePoint } from "./route-types";

const HANOI = { lat: 21.0285, lng: 105.8542 };

function FitBounds({ polyline }: { polyline?: string }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !polyline) return;
    const bounds = new google.maps.LatLngBounds();
    decodePolyline(polyline).forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, 64);
  }, [map, polyline]);
  return null;
}

export function GoogleRouteMap({
  apiKey,
  mapId,
  polyline,
  points = [],
}: {
  apiKey: string;
  mapId?: string;
  polyline?: string;
  points?: RoutePoint[];
}) {
  let waypointNo = 0;
  return (
    <APIProvider apiKey={apiKey} language="vi" region="VN">
      <Map
        mapId={mapId || "DEMO_MAP_ID"}
        defaultCenter={HANOI}
        defaultZoom={13}
        gestureHandling="greedy"
        disableDefaultUI={false}
        streetViewControl={false}
        className="h-full w-full"
      >
        {polyline && (
          <Polyline encodedPath={polyline} strokeColor="#2350d8" strokeOpacity={0.9} strokeWeight={5} />
        )}
        {points
          .filter((p) => p.kind !== "detour")
          .map((p) => {
            const isStart = p.kind === "start";
            if (!isStart) waypointNo++;
            return (
              <AdvancedMarker key={`${p.lat},${p.lng}`} position={p} title={p.name}>
                <Pin
                  background={isStart ? "#0e8a5f" : "#18261f"}
                  borderColor="#ffffff"
                  glyphColor="#ffffff"
                  glyph={isStart ? "S" : String(waypointNo)}
                />
              </AdvancedMarker>
            );
          })}
        <FitBounds polyline={polyline} />
      </Map>
    </APIProvider>
  );
}
