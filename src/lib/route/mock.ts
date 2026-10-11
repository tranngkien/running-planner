import { RouteError } from "./errors";
import type { RouteServices } from "./generate";
import { encodePolyline, haversineKm, type LatLng } from "./geo";

/**
 * Dịch vụ giả lập dùng cho E2E và chạy local không cần key (ROUTE_SERVICE_MODE=mock).
 * Không gọi Gemini/Google: nhận diện địa danh theo từ điển nhỏ, quãng đường = đường chim bay × 1.25.
 */
const KNOWN_PLACES: { keyword: string; name: string; location: LatLng | null }[] = [
  { keyword: "times city", name: "Times City", location: { lat: 20.9955, lng: 105.8686 } },
  { keyword: "long biên", name: "Cầu Long Biên", location: { lat: 21.0437, lng: 105.8579 } },
  { keyword: "hồ tây", name: "Hồ Tây", location: { lat: 21.0583, lng: 105.8197 } },
  { keyword: "hồ gươm", name: "Hồ Gươm", location: { lat: 21.0287, lng: 105.8524 } },
  { keyword: "atlantis", name: "Atlantis", location: null },
];

const WALK_FACTOR = 1.25;
const FAILURE_TRIGGER = "giả lập lỗi dịch vụ";

export function createMockServices(): RouteServices {
  return {
    async parsePrompt(prompt) {
      const text = prompt.toLowerCase();
      if (text.includes(FAILURE_TRIGGER)) throw new RouteError("SERVICE_UNAVAILABLE");
      const found = KNOWN_PLACES.map((p) => ({ ...p, at: text.indexOf(p.keyword) }))
        .filter((p) => p.at >= 0)
        .sort((a, b) => a.at - b.at)
        .map((p) => p.name);
      if (found.length === 0) throw new RouteError("NO_START");
      return { start: found[0], waypoints: found.slice(1) };
    },

    async geocode(query) {
      const place = KNOWN_PLACES.find((p) => p.name === query);
      if (!place?.location) throw new RouteError("PLACE_NOT_FOUND", { place: query });
      return { query, name: place.name, address: `${place.name}, Hà Nội`, ...place.location };
    },

    async computeLoop(points) {
      let km = 0;
      for (let i = 0; i < points.length; i++) km += haversineKm(points[i], points[(i + 1) % points.length]);
      return { distanceKm: km * WALK_FACTOR, polyline: encodePolyline([...points, points[0]]) };
    },
  };
}
