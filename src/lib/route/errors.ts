export type RouteErrorCode =
  | "INVALID_INPUT"
  | "NO_START"
  | "PLACE_NOT_FOUND"
  | "NO_ROUTE"
  | "ROUTE_IMPOSSIBLE"
  | "SERVICE_UNAVAILABLE";

export type RouteErrorDetails = { minKm?: number; place?: string };

const MESSAGES: Record<RouteErrorCode, (d: RouteErrorDetails) => string> = {
  INVALID_INPUT: () => "Dữ liệu không hợp lệ",
  NO_START: () => "Không xác định được điểm xuất phát từ mô tả",
  PLACE_NOT_FOUND: (d) => `Không tìm thấy địa điểm: ${d.place ?? ""}`.trim(),
  NO_ROUTE: () => "Không tìm được đường đi giữa các địa điểm",
  ROUTE_IMPOSSIBLE: () => "Cự ly và mô tả không thể tạo được Map chạy hợp lệ",
  SERVICE_UNAVAILABLE: () => "Dịch vụ tạm thời không khả dụng, vui lòng thử lại",
};

export const HTTP_STATUS: Record<RouteErrorCode, number> = {
  INVALID_INPUT: 400,
  NO_START: 422,
  PLACE_NOT_FOUND: 422,
  NO_ROUTE: 422,
  ROUTE_IMPOSSIBLE: 422,
  SERVICE_UNAVAILABLE: 503,
};

export class RouteError extends Error {
  constructor(
    public readonly code: RouteErrorCode,
    public readonly details: RouteErrorDetails = {},
  ) {
    super(MESSAGES[code](details));
    this.name = "RouteError";
  }
}

export function isRouteError(e: unknown, code?: RouteErrorCode): e is RouteError {
  return e instanceof RouteError && (code === undefined || e.code === code);
}
