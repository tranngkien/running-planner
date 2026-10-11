import { describe, expect, it } from "vitest";
import {
  decodePolyline,
  destinationPoint,
  haversineKm,
  midpoint,
  offsetPerpendicular,
} from "@/lib/route/geo";

const HANOI = { lat: 21.0285, lng: 105.8542 };
const HCM = { lat: 10.8231, lng: 106.6297 };

describe("haversineKm", () => {
  it("Hà Nội – TP.HCM ≈ 1137 km", () => {
    expect(haversineKm(HANOI, HCM)).toBeGreaterThan(1125);
    expect(haversineKm(HANOI, HCM)).toBeLessThan(1150);
  });

  it("cùng một điểm = 0", () => {
    expect(haversineKm(HANOI, HANOI)).toBe(0);
  });
});

describe("midpoint", () => {
  it("nằm giữa hai điểm", () => {
    const a = { lat: 21, lng: 105.8 };
    const b = { lat: 21.02, lng: 105.84 };
    const m = midpoint(a, b);
    expect(haversineKm(a, m)).toBeCloseTo(haversineKm(m, b), 3);
  });
});

describe("offsetPerpendicular", () => {
  const a = { lat: 21.0, lng: 105.8 };
  const b = { lat: 21.0, lng: 105.9 };

  it("cách trung điểm đúng khoảng cách yêu cầu", () => {
    const p = offsetPerpendicular(a, b, 2, 1);
    expect(haversineKm(midpoint(a, b), p)).toBeCloseTo(2, 1);
  });

  it("cách đều hai đầu đoạn (vuông góc)", () => {
    const p = offsetPerpendicular(a, b, 3, -1);
    expect(haversineKm(a, p)).toBeCloseTo(haversineKm(b, p), 2);
  });

  it("hai phía cho hai điểm khác nhau", () => {
    const left = offsetPerpendicular(a, b, 1, 1);
    const right = offsetPerpendicular(a, b, 1, -1);
    expect(Math.sign(left.lat - 21)).not.toBe(Math.sign(right.lat - 21));
  });
});

describe("destinationPoint", () => {
  it("đi 5 km theo hướng bắc", () => {
    const p = destinationPoint(HANOI, 0, 5);
    expect(haversineKm(HANOI, p)).toBeCloseTo(5, 2);
    expect(p.lat).toBeGreaterThan(HANOI.lat);
  });
});

describe("decodePolyline", () => {
  it("giải mã chuỗi mẫu của Google", () => {
    const pts = decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
    expect(pts).toHaveLength(3);
    expect(pts[0].lat).toBeCloseTo(38.5, 5);
    expect(pts[0].lng).toBeCloseTo(-120.2, 5);
    expect(pts[2].lat).toBeCloseTo(43.252, 5);
    expect(pts[2].lng).toBeCloseTo(-126.453, 5);
  });

  it("chuỗi rỗng → mảng rỗng", () => {
    expect(decodePolyline("")).toEqual([]);
  });
});
