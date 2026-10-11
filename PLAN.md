# PLAN — Running Planner

Tham chiếu yêu cầu: [SPEC.md](SPEC.md). Quy trình: [WORKFLOW.md](WORKFLOW.md).

## Tech stack
- **Next.js (App Router) + TypeScript**, 1 service duy nhất trên Cloud Run.
- **Tailwind CSS** (+ component tự viết theo skill UI/UX).
- **OpenRouteService** (free, key không cần thẻ): geocode search (Pelias) để tìm toạ độ, directions `foot-walking` để dựng tuyến. Polyline mã hoá 1e5 giống Google.
- **Leaflet + react-leaflet** với bản đồ nền OpenStreetMap (không cần key).
- *(Trước đây dùng Google Maps Platform; đã bỏ vì billing account không có thẻ hợp lệ — xem T9.)*
- **Gemini Flash-Lite mới nhất** (`gemini-flash-lite-latest`, free tier) qua `@google/genai`, structured output; dự phòng `gemini-flash-latest` khi lỗi 429/5xx (hạn mức/ngày của Flash rất thấp). Gemini Pro không có free tier nên không dùng.
- Auth: `bcryptjs` + `jose` (JWT cookie httpOnly), `middleware.ts`.
- Test: **Vitest** (unit/integration), **Playwright** (E2E).
- Deploy: Dockerfile (Next standalone) → `gcloud run deploy`, region `asia-southeast1`, Secret Manager.

## Cấu trúc
```
src/app/login/page.tsx            # form login
src/app/page.tsx                  # màn chính
src/app/api/auth/login/route.ts
src/app/api/auth/logout/route.ts
src/app/api/routes/generate/route.ts
src/middleware.ts
src/lib/auth/{password,session}.ts
src/lib/route/{geo,fit,gemini,places,routes,generate,errors}.ts
src/components/...
tests/unit/**, tests/e2e/**
```

## Thuật toán tạo tuyến (`generate.ts`)
1. `parsePrompt(prompt)` → `{ start, waypoints[] }` (Gemini). Không có `start` → lỗi R12.
2. `geocode(name)` cho từng địa danh (ORS geocode). Không tìm thấy → lỗi R13.
3. `computeLoop([start, ...waypoints, start])` (ORS directions) → quãng đường `D0`.
4. `fitDistance`:
   - `D0 > target·1.03` → lỗi R11 (kèm `minKm = D0`).
   - `|D0 − target| ≤ 3%` → xong.
   - Ngược lại: chọn đoạn dài nhất của vòng, đặt điểm vòng lệch vuông góc tại trung điểm, tìm nhị phân bán kính lệch `r ∈ [0, (target − D0)/2]` (mở rộng cận trên nếu cần) đến khi đạt ±3%, tối đa 8 lần gọi Routes. Không hội tụ → lỗi R11.
5. Trả về `{ polyline, distanceKm, points[] }`.

Các lời gọi dịch vụ ngoài được inject qua tham số để test bằng mock.

## Task

### T1 — Scaffold project
- Next.js + TS + Tailwind + ESLint, Vitest, Playwright, Dockerfile, `.env.example`, script `npm test` / `npm run test:e2e`.
- Test: 1 smoke test Vitest chạy được; `npm run build` thành công.

### T2 — Auth (R1–R4)
- `password.ts`: `verifyPassword(plain, hash)`.
- `session.ts`: `createSession(username)`, `verifySession(token)`.
- API login/logout, `middleware.ts`, trang `/login`.
- Test case:
  - verifyPassword đúng / sai / hash rỗng.
  - session hợp lệ, sai chữ ký, hết hạn.
  - login API: đúng → 200 + Set-Cookie; sai → 401 + thông báo chung; thiếu trường → 400.
  - logout API: xoá cookie.
  - middleware: không cookie → redirect `/login` (trang) / 401 (API); cookie hợp lệ → cho qua; `/login` luôn cho qua.

### T3 — Hình học (`geo.ts`)
- `haversineKm`, `midpoint`, `offsetPerpendicular(a, b, km, side)`, `decodePolyline`.
- Test case: khoảng cách Hà Nội–HCM ≈ 1137 km (±1%), cùng điểm = 0, offset vuông góc đúng khoảng cách, decode polyline mẫu của Google.

### T4 — Thuật toán khớp cự ly (`fit.ts`)
- `fitDistance({ points, targetKm, computeLoop, tol=0.03, maxCalls=8 })`.
- Test case (mock `computeLoop` dạng hàm tuyến tính theo bán kính):
  - D0 đã trong ±3% → trả về ngay, không thêm điểm.
  - D0 quá dài → lỗi `ROUTE_IMPOSSIBLE` kèm `minKm`.
  - D0 ngắn → thêm 1 điểm vòng, kết quả trong ±3%, số lần gọi ≤ 8.
  - Mock không bao giờ đạt → lỗi `ROUTE_IMPOSSIBLE`.

### T5 — Wrapper dịch vụ ngoài
- `gemini.ts` `parsePrompt`, `places.ts` `geocode`, `routes.ts` `computeLoop` (dùng `fetch`/SDK, inject được).
- Test case (mock fetch/SDK): parse JSON hợp lệ; thiếu start → `NO_START`; Places rỗng → `PLACE_NOT_FOUND`; HTTP 429/5xx → `SERVICE_UNAVAILABLE`; Routes trả distanceMeters + polyline đúng định dạng.

### T6 — Endpoint `/api/routes/generate` (R5–R15)
- Validate input (zod), gọi `generate`, map lỗi → HTTP status + message tiếng Việt.
- Test case: input sai → 400; mỗi mã lỗi → đúng message; thành công → 200 với `distanceKm`, `polyline`, `points`.

### T7 — UI màn chính
- Thiết kế theo skill UI/UX; form prompt + cự ly, map, panel kết quả, hiển thị lỗi, nút đăng xuất.
- Test E2E (Playwright, mock API): AC1–AC9 theo luồng giao diện.

### T8 — Deploy Cloud Run
- Bật API, Secret Manager, `gcloud run deploy`, budget alert, giới hạn key.
- Kiểm tra: smoke test URL thật (AC1, AC2, AC4), kiểm tra AC10 trên bundle build.
- Cập nhật README hướng dẫn deploy.

### T9 — Chuyển sang OpenStreetMap (thay Google Maps)
- Lý do: Google Maps Platform báo "You must enable Billing" — thẻ của billing account đã đóng, Google không cho thêm thẻ mới (`OR_BACR2_31`).
- `places.ts` → ORS geocode `GET /geocode/search` (`text`, `boundary.country=VN`, `size=1`, `focus.point.*` khi có bias).
- `routes.ts` → ORS `POST /v2/directions/foot-walking/json` (toạ độ `[lng,lat]`, vòng khép kín, `instructions:false`, `radiuses` 1000 m).
- Bản đồ: Leaflet + tile OSM, polyline decode bằng `decodePolyline`; bỏ component Google Maps và sơ đồ SVG.
- Env: `ORS_API_KEY` (server) thay cho `GOOGLE_MAPS_SERVER_KEY` / `NEXT_PUBLIC_GOOGLE_MAPS_*`.
- Test case:
  - geocode: đúng URL/query, bias → `focus.point`, `[lng,lat]` → `{lat,lng}`, rỗng → `PLACE_NOT_FOUND`, HTTP lỗi/mất mạng → `SERVICE_UNAVAILABLE`.
  - directions: đúng URL/header/body, vòng khép kín, trả km + polyline; lỗi 2009/2010 hoặc không có `routes` → `NO_ROUTE`; 429/503/mất mạng → `SERVICE_UNAVAILABLE`.
  - E2E AC4: bản đồ Leaflet vẽ polyline.
- Phát sinh (chạy thật): ORS geocode trả kết quả thô (ví dụ "Hồ Gươm" → `locality: Hanoi`) → coi kết quả layer `locality/region/county/country/macro*/localadmin` là không đủ chính xác và dự phòng sang **Nominatim** (OSM, free, không key, header User-Agent). ORS lỗi HTTP cũng dự phòng sang Nominatim; cả hai lỗi → `SERVICE_UNAVAILABLE`; cả hai không có kết quả → `PLACE_NOT_FOUND`.
  - Test: ORS venue → dùng ORS, không gọi Nominatim; ORS locality → dùng Nominatim; ORS lỗi → Nominatim; Nominatim có bias → gửi `viewbox`; cả hai rỗng → `PLACE_NOT_FOUND`; cả hai lỗi → `SERVICE_UNAVAILABLE`.
- Phát sinh: Gemini thỉnh thoảng trả 503 "high demand" → `parsePrompt` thử lại tối đa 2 lần (backoff) với lỗi 429/500/503.
  - Test: 503 rồi thành công → kết quả đúng, gọi 2 lần; 503 liên tục → `SERVICE_UNAVAILABLE` sau 3 lần; lỗi 400 → không thử lại.
- Phát sinh: khi có file `.env*`, `@next/env` diễn giải lại cả biến môi trường sẵn có chứa `$` → hash bcrypt thô bị thành chuỗi rỗng. Thêm `normalizeHash()` trong `password.ts` nhận hash thô hoặc base64; `.env.local`, E2E dùng dạng base64.
  - Test: hash thô → giữ nguyên; base64 → giải mã ra `$2…`; chuỗi rác/rỗng → `""`; login API đúng mật khẩu với hash base64 → 200.

## Rủi ro / điểm cần lưu ý
- Gemini Flash free tier có giới hạn request/phút và /ngày; bị 429 thì app báo "Dịch vụ tạm thời không khả dụng". Key Gemini đặt trong project không gắn billing để không phát sinh phí.
- ORS free có hạn mức theo ngày/phút; mỗi lần tạo tuyến tốn 1–(số địa danh) lượt geocode + tối đa 8 lượt directions.
- Geocode tiếng Việt của Pelias/OSM kém Google: địa danh có thể lệch hoặc không tìm thấy → Gemini nên trả tên kèm quận/thành phố.
- Tile OSM: tuân thủ tile usage policy (lượng truy cập thấp, có attribution).
- Điểm vòng có thể rơi vào sông/hồ → `radiuses` 1000 m + thuật toán thử cả hai phía vuông góc.
- Billing account của Cloud Run không có thẻ hợp lệ: mức dùng 0đ thì không sao, nếu phát sinh phí Google có thể tạm ngưng project. Budget alert 25.000đ đã đặt.

## Tiến độ
- [x] T0 — Cài skill UI/UX
- [x] T1 — Scaffold
- [x] T2 — Auth
- [x] T3 — Hình học
- [x] T4 — Khớp cự ly
- [x] T5 — Wrapper dịch vụ
- [x] T6 — Endpoint generate
- [x] T7 — UI
- [ ] T8 — Deploy (đã deploy lần đầu; chờ T9)
- [ ] T9 — Chuyển sang OpenStreetMap
