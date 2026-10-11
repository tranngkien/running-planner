# running-planner

Web app tạo map chạy bộ từ mô tả tiếng Việt và cự ly mong muốn. Gemini hiểu mô tả, Google Maps dựng tuyến vòng quay về điểm xuất phát.

- Yêu cầu: [SPEC.md](SPEC.md) · Kế hoạch: [PLAN.md](PLAN.md) · Quy trình làm việc: [WORKFLOW.md](WORKFLOW.md)
- Stack: Next.js 16 + TypeScript + Tailwind, Gemini (`@google/genai`), Google Maps (Maps JS, Places API (New), Routes API), Vitest, Playwright, Cloud Run.

## Chạy local

```bash
npm install
cp .env.example .env.local   # điền giá trị, xem bên dưới
npm run dev                  # http://localhost:3000
```

Tạo `ADMIN_PASSWORD_HASH` và `SESSION_SECRET`:

```bash
node -e "console.log(require('bcryptjs').hashSync('mat-khau-cua-ban', 12))"
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

> Trong `.env.local`, Next diễn giải ký tự `$` thành biến (kể cả trong dấu nháy). Hash bcrypt phải escape từng `$` thành `\$`: `ADMIN_PASSWORD_HASH=\$2b\$12\$...`. Giá trị trong Secret Manager thì giữ nguyên, không escape.

**Chạy thử không cần API key:** đặt `ROUTE_SERVICE_MODE=mock`. App dùng dữ liệu giả lập (nhận Times City, cầu Long Biên, Hồ Tây, Hồ Gươm) và hiển thị sơ đồ SVG thay cho Google Maps.

## Kiểm thử

```bash
npm test            # unit + integration (Vitest)
npm run test:e2e    # E2E (Playwright, tự build và chạy app ở chế độ mock)
npm run typecheck
npm run lint
```

Lần đầu chạy E2E: `npx playwright install chromium`.

## Deploy lên Google Cloud Run (free tier)

Cần cài [gcloud CLI](https://cloud.google.com/sdk/docs/install). Cloud Run và Google Maps đều **bắt buộc gắn billing account** dù dùng trong hạn mức miễn phí.

### 1. Tạo project và bật API

```bash
gcloud auth login
gcloud projects create <PROJECT_ID>
gcloud config set project <PROJECT_ID>
# Gắn billing: https://console.cloud.google.com/billing
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com places.googleapis.com routes.googleapis.com maps-backend.googleapis.com
```

### 2. Tạo API key

- **Gemini**: tạo ở [Google AI Studio](https://aistudio.google.com/apikey).
- **Maps server key** (Console → APIs & Services → Credentials): chỉ cho phép *Places API (New)* và *Routes API*. Không giới hạn referrer (gọi từ server).
- **Maps browser key**: chỉ cho phép *Maps JavaScript API*, giới hạn HTTP referrer là URL Cloud Run (thêm sau bước 5) và `http://localhost:3000/*`.
- (Tuỳ chọn) **Map ID** cho Advanced Markers: Console → Google Maps Platform → Map Management.

### 3. Lưu bí mật vào Secret Manager

```bash
printf '%s' '<GEMINI_API_KEY>'      | gcloud secrets create gemini-api-key --data-file=-
printf '%s' '<MAPS_SERVER_KEY>'     | gcloud secrets create maps-server-key --data-file=-
printf '%s' '<SESSION_SECRET>'      | gcloud secrets create session-secret --data-file=-
printf '%s' '<ADMIN_PASSWORD_HASH>' | gcloud secrets create admin-password-hash --data-file=-

PROJECT_NUMBER=$(gcloud projects describe <PROJECT_ID> --format='value(projectNumber)')
gcloud projects add-iam-policy-binding <PROJECT_ID> \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role=roles/secretmanager.secretAccessor
```

### 4. Build image

```bash
gcloud artifacts repositories create running-planner --repository-format=docker --location=asia-southeast1
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_MAPS_BROWSER_KEY=<MAPS_BROWSER_KEY>,_MAPS_MAP_ID=<MAP_ID>
```

### 5. Deploy

```bash
gcloud run deploy running-planner \
  --image=asia-southeast1-docker.pkg.dev/<PROJECT_ID>/running-planner/app:latest \
  --region=asia-southeast1 --allow-unauthenticated \
  --min-instances=0 --max-instances=1 --memory=512Mi \
  --set-env-vars=ADMIN_USERNAME=admin,GEMINI_MODEL=gemini-flash-latest \
  --set-secrets=GEMINI_API_KEY=gemini-api-key:latest,GOOGLE_MAPS_SERVER_KEY=maps-server-key:latest,SESSION_SECRET=session-secret:latest,ADMIN_PASSWORD_HASH=admin-password-hash:latest
```

`--allow-unauthenticated` để mở được trang web; app tự chặn bằng đăng nhập admin. `min-instances=0` giữ trong free tier (lần truy cập đầu sau một lúc không dùng sẽ chậm vài giây).

### 6. Chống phát sinh phí

- Billing → Budgets & alerts: đặt ngân sách 1 USD, cảnh báo 50/90/100%.
- APIs & Services → Places API / Routes API → Quotas: giới hạn số request/ngày (ví dụ 200).
- Artifact Registry: đặt cleanup policy giữ 2 image gần nhất (free 0,5 GB).

### Smoke test sau deploy

1. Mở URL Cloud Run → bị chuyển về `/login`.
2. Đăng nhập → tạo map "Xuất phát từ cổng Times City, đi qua cầu Long Biên", 21 km.
3. Thử "Xuất phát từ Times City, đi qua Hồ Tây", 3 km → thấy thông báo lỗi cự ly.
