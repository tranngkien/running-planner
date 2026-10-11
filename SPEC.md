# SPEC — Running Planner

## Mục tiêu
Web app (dùng trên máy tính) giúp tạo map chạy bộ từ một câu mô tả tiếng Việt và cự ly mong muốn. App dùng AI (Gemini) để hiểu mô tả, dùng Google Maps để dựng tuyến chạy dạng **vòng tròn quay về điểm xuất phát**.

Ví dụ: *"Tôi muốn tạo 1 map chạy xuất phát từ cổng Times City và đi qua cầu Long Biên"* + cự ly **21 km** → hiển thị tuyến ~21 km trên bản đồ.

## Phạm vi

**Có làm**
- Đăng nhập bằng một tài khoản admin duy nhất.
- Tạo tuyến chạy từ prompt + cự ly, hiển thị trên Google Maps.
- Thông báo lỗi khi không tạo được tuyến hợp lệ.
- Deploy lên Google Cloud Run (free tier).

**Không làm**
- App mobile / iOS, định vị thiết bị, giọng đọc hướng dẫn, chạy nền.
- Đăng ký tài khoản, nhiều người dùng, phân quyền.
- Lưu lịch sử tuyến chạy (có thể làm sau).

## Yêu cầu chức năng

### Đăng nhập
- **R1** — Mọi trang và API (trừ `/login` và `/api/auth/login`) yêu cầu đăng nhập. Chưa đăng nhập: trang bị chuyển về `/login`, API trả `401`.
- **R2** — Chỉ có một tài khoản admin, cấu hình qua biến môi trường (`ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH` bcrypt). Không có chức năng đăng ký.
- **R3** — Đăng nhập đúng → tạo phiên (cookie httpOnly, ký JWT, hết hạn sau 7 ngày) và chuyển về trang chính. Sai → thông báo "Sai tên đăng nhập hoặc mật khẩu" (không nói rõ sai trường nào).
- **R4** — Có nút Đăng xuất, xoá phiên và quay về `/login`.

### Tạo tuyến chạy
- **R5** — Màn chính có: ô nhập mô tả (bắt buộc, tối đa 500 ký tự), chọn cự ly (5, 10, 15, 21, 42 km hoặc tự nhập 1–100 km), nút "Tạo map".
- **R6** — AI bóc mô tả thành: điểm xuất phát (bắt buộc) và danh sách điểm đi qua (0–5 điểm, theo đúng thứ tự trong mô tả).
- **R7** — Mỗi địa danh được tìm toạ độ trên Google Maps, ưu tiên khu vực Việt Nam.
- **R8** — Tuyến chạy là vòng tròn: xuất phát → các điểm đi qua → về điểm xuất phát, theo đường đi bộ.
- **R9** — Tổng quãng đường phải nằm trong khoảng **±3%** so với cự ly đã chọn. Nếu tuyến cơ bản ngắn hơn, hệ thống tự thêm điểm vòng để kéo dài cho đủ.
- **R10** — Kết quả hiển thị: đường đi trên bản đồ, marker cho điểm xuất phát và các điểm đi qua, tổng quãng đường (km, 2 chữ số thập phân), danh sách điểm.

### Lỗi
- **R11** — Nếu tuyến ngắn nhất đi qua các điểm đã mô tả **dài hơn** cự ly cho phép, hoặc không thể điều chỉnh để đạt cự ly → báo: **"Cự ly và mô tả không thể tạo được Map chạy hợp lệ"**, kèm cự ly tối thiểu ước tính nếu có.
- **R12** — Mô tả không xác định được điểm xuất phát → báo "Không xác định được điểm xuất phát từ mô tả".
- **R13** — Địa danh không tìm thấy trên bản đồ → báo "Không tìm thấy địa điểm: <tên>".
- **R14** — Lỗi dịch vụ ngoài (Gemini/Google Maps hết quota, mất kết nối) → báo "Dịch vụ tạm thời không khả dụng, vui lòng thử lại", không làm crash trang.
- **R15** — Dữ liệu đầu vào không hợp lệ (mô tả rỗng, cự ly ngoài 1–100) → API trả `400`, giao diện báo lỗi ngay tại ô nhập.

## Yêu cầu phi chức năng
- **N1** — API key phía server (Gemini, Places, Routes) không bao giờ gửi xuống trình duyệt. Key Maps JS phía trình duyệt bị giới hạn theo domain.
- **N2** — Thời gian tạo tuyến ≤ 20 giây trong điều kiện bình thường (không tính cold start).
- **N3** — Chạy trong free tier của Cloud Run (`min-instances=0`); chấp nhận cold start.
- **N4** — Giao diện tiếng Việt, tối ưu cho màn hình máy tính (≥ 1280px), vẫn dùng được ở màn hình nhỏ hơn.
- **N5** — Đạt cơ bản về accessibility: label cho ô nhập, focus nhìn thấy được, độ tương phản ≥ 4.5:1.

## Tiêu chí chấp nhận
- **AC1** — Chưa đăng nhập, mở `/` → bị chuyển về `/login`. Gọi `POST /api/routes/generate` → `401`. *(R1)*
- **AC2** — Đăng nhập sai mật khẩu → thấy thông báo lỗi, vẫn ở `/login`. Đúng → vào trang chính. *(R2, R3)*
- **AC3** — Bấm Đăng xuất → quay về `/login`, mở lại `/` bị chuyển về `/login`. *(R4)*
- **AC4** — Prompt "xuất phát từ cổng Times City, đi qua cầu Long Biên" + 21 km → thấy tuyến trên bản đồ, tổng quãng đường trong [20.37, 21.63] km, tuyến bắt đầu và kết thúc tại cùng điểm. *(R5–R10)*
- **AC5** — Prompt "xuất phát từ Times City, đi qua Hồ Tây" + 3 km → thấy "Cự ly và mô tả không thể tạo được Map chạy hợp lệ". *(R11)*
- **AC6** — Prompt "tôi muốn chạy bộ" (không có địa điểm) → thấy "Không xác định được điểm xuất phát từ mô tả". *(R12)*
- **AC7** — Prompt có địa danh không tồn tại → thấy "Không tìm thấy địa điểm: …". *(R13)*
- **AC8** — Giả lập Gemini/Google lỗi → thấy "Dịch vụ tạm thời không khả dụng, vui lòng thử lại". *(R14)*
- **AC9** — Gửi mô tả rỗng hoặc cự ly 0 / 101 → API `400`, giao diện báo lỗi tại ô nhập. *(R15)*
- **AC10** — Kiểm tra bundle JS phía client không chứa server key. *(N1)*
