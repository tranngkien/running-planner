# running-planner

Web app tạo map chạy bộ từ mô tả tiếng Việt và cự ly mong muốn. Gemini hiểu mô tả, dữ liệu OpenStreetMap (OpenRouteService + Nominatim) dựng tuyến vòng quay về điểm xuất phát, Leaflet hiển thị bản đồ.

- Yêu cầu: [SPEC.md](SPEC.md) · Kế hoạch: [PLAN.md](PLAN.md) · Quy trình làm việc: [WORKFLOW.md](WORKFLOW.md)
- Stack: Next.js 16 + TypeScript + Tailwind, Gemini (`@google/genai`), OpenRouteService, Nominatim, Leaflet + tile OpenStreetMap, Vitest, Playwright, Cloud Run.
- Toàn bộ dịch vụ bản đồ và AI dùng gói miễn phí, không cần thẻ thanh toán.

## Chạy local

```bash
npm install
cp .env.example .env.local   # điền giá trị, xem bên dưới
npm run dev                  # http://localhost:3000
```

| Biến | Lấy ở đâu |
|---|---|
| `ADMIN_PASSWORD_HASH` | `node -e "console.log(Buffer.from(require('bcryptjs').hashSync('mat-khau-cua-ban', 12)).toString('base64'))"` |
| `SESSION_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) — nên đặt trong project **không gắn billing** để dùng free tier |
| `ORS_API_KEY` | Đăng ký miễn phí tại [openrouteservice.org](https://openrouteservice.org/dev/#/signup) |

> `ADMIN_PASSWORD_HASH` nhận hash bcrypt dạng base64 (khuyên dùng) hoặc dạng thô `$2b$…`. Khi có file `.env*`, Next diễn giải ký tự `$` thành biến — kể cả với biến môi trường đặt sẵn — nên dạng thô dễ bị thành chuỗi rỗng; base64 không có `$`.

**Chạy thử không cần API key:** đặt `ROUTE_SERVICE_MODE=mock`. App dùng dữ liệu giả lập (nhận Times City, cầu Long Biên, Hồ Tây, Hồ Gươm).

## Kiểm thử

```bash
npm test            # unit + integration (Vitest)
npm run test:e2e    # E2E (Playwright, tự build và chạy app ở chế độ mock)
npm run typecheck
npm run lint
```

Lần đầu chạy E2E: `npx playwright install chromium`.

## Deploy lên Google Cloud Run (free tier)

Cần cài [gcloud CLI](https://cloud.google.com/sdk/docs/install). Cloud Run bắt buộc gắn billing account dù dùng trong hạn mức miễn phí.

### 1. Tạo project và bật API

```bash
gcloud auth login
gcloud projects create <PROJECT_ID>
gcloud config set project <PROJECT_ID>
# Gắn billing: https://console.cloud.google.com/billing
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
```

### 2. Lưu bí mật vào Secret Manager

Ghi giá trị ra file không có ký tự xuống dòng ở cuối rồi tạo secret (tránh dán key vào lệnh):

```bash
gcloud secrets create gemini-api-key      --data-file=gemini.txt
gcloud secrets create ors-api-key         --data-file=ors.txt
gcloud secrets create session-secret      --data-file=session.txt
gcloud secrets create admin-password-hash --data-file=hash.txt   # base64 hoặc dạng thô đều được

PROJECT_NUMBER=$(gcloud projects describe <PROJECT_ID> --format='value(projectNumber)')
gcloud projects add-iam-policy-binding <PROJECT_ID> \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role=roles/secretmanager.secretAccessor
```

### 3. Build image

```bash
gcloud artifacts repositories create running-planner --repository-format=docker --location=asia-southeast1
gcloud builds submit --config cloudbuild.yaml --region=asia-southeast1
```

### 4. Deploy

```bash
gcloud run deploy running-planner \
  --image=asia-southeast1-docker.pkg.dev/<PROJECT_ID>/running-planner/app:latest \
  --region=asia-southeast1 --allow-unauthenticated \
  --min-instances=0 --max-instances=1 --memory=512Mi \
  --set-env-vars=ADMIN_USERNAME=admin,GEMINI_MODEL=gemini-flash-lite-latest \
  --set-secrets=GEMINI_API_KEY=gemini-api-key:latest,ORS_API_KEY=ors-api-key:latest,SESSION_SECRET=session-secret:latest,ADMIN_PASSWORD_HASH=admin-password-hash:latest
```

`--allow-unauthenticated` để mở được trang web; app tự chặn bằng đăng nhập admin. `min-instances=0` giữ trong free tier (lần truy cập đầu sau một lúc không dùng sẽ chậm vài giây).

**Đổi mật khẩu:** thêm phiên bản mới cho secret `admin-password-hash` rồi `gcloud run services update running-planner --region=asia-southeast1 --update-secrets=ADMIN_PASSWORD_HASH=admin-password-hash:<version>`.

### 5. Chống phát sinh phí

- Billing → Budgets & alerts: đặt ngân sách nhỏ, cảnh báo 50/90/100%.
- Artifact Registry: đặt cleanup policy giữ 2 image gần nhất (free 0,5 GB).

### Smoke test sau deploy

1. Mở URL Cloud Run → bị chuyển về `/login`.
2. Đăng nhập → tạo map "Xuất phát từ cổng Times City, đi qua cầu Long Biên", 21 km.
3. Thử "Xuất phát từ Times City, đi qua Hồ Tây", 3 km → thấy thông báo lỗi cự ly.

## Giới hạn miễn phí

- Gemini free tier giới hạn request/phút và /ngày theo model; app tự thử lại và chuyển sang model dự phòng (`GEMINI_FALLBACK_MODEL`, mặc định `gemini-flash-latest`).
- OpenRouteService gói miễn phí có hạn mức theo ngày/phút; mỗi lần tạo tuyến dùng vài lượt geocode và tối đa 16 lượt directions.
- Nominatim (dự phòng geocode) yêu cầu tối đa ~1 request/giây và User-Agent hợp lệ.
- Tile OpenStreetMap chỉ dành cho lượng truy cập thấp, phải hiển thị attribution.
