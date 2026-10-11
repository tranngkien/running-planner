# PLAN — Running Planner

Tham chiếu yêu cầu: [SPEC.md](SPEC.md). Quy trình: [WORKFLOW.md](WORKFLOW.md).

## Tech stack
- **Next.js (App Router) + TypeScript**, 1 service duy nhất trên Cloud Run.
- **Tailwind CSS** (+ component tự viết theo skill UI/UX).
- **Google Maps JS API** qua `@vis.gl/react-google-maps`; **Places API (New) Text Search**; **Routes API computeRoutes** (`WALK`).
- **Gemini Pro mới nhất** qua `@google/genai`, structured output.
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
2. `geocode(name)` cho từng địa danh (Places). Không tìm thấy → lỗi R13.
3. `computeLoop([start, ...waypoints, start])` (Routes) → quãng đường `D0`.
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

## Rủi ro / điểm cần lưu ý
- Gemini Pro free tier có giới hạn request/phút thấp → nếu bị 429 thường xuyên, cân nhắc dùng bản Flash cho bước bóc prompt.
- Tuyến đi bộ của Google có thể vòng vèo; điểm vòng có thể rơi vào sông/hồ → thuật toán thử cả hai phía vuông góc.
- Cloud Run và Google Maps cần billing account; đặt budget alert để tránh phát sinh phí.

## Tiến độ
- [x] T0 — Cài skill UI/UX
- [x] T1 — Scaffold
- [x] T2 — Auth
- [x] T3 — Hình học
- [x] T4 — Khớp cự ly
- [x] T5 — Wrapper dịch vụ
- [x] T6 — Endpoint generate
- [ ] T7 — UI
- [ ] T8 — Deploy
