# WORKFLOW

Quy trình bắt buộc cho mọi thay đổi trong project **running-planner** (áp dụng cho cả người và AI agent).

```
Setup Git → SPEC.md → PLAN.md → Viết test (fail) → Code (test pass) → Test lại toàn bộ → Commit
```

---

## Bước 0 — Khởi tạo Git (làm một lần khi bắt đầu project)

### 0.1 Khởi tạo repository
```bash
git init
git branch -M main
git config user.name "<tên>"     # nếu chưa cấu hình global
git config user.email "<email>"
```

### 0.2 Tạo `.gitignore`
Tạo trước khi commit lần đầu để không lỡ commit file rác hoặc bí mật. Tối thiểu gồm:

```gitignore
# Dependencies
node_modules/
.venv/
venv/
__pycache__/

# Build output
dist/
build/
out/
coverage/

# Môi trường & bí mật
.env
.env.*
!.env.example

# Log
*.log
npm-debug.log*

# IDE / OS
.vscode/*
!.vscode/settings.json
.idea/
.DS_Store
Thumbs.db
```

Bổ sung thêm theo ngôn ngữ / framework khi chọn stack (tham khảo https://github.com/github/gitignore).

### 0.3 Các file nền tảng khác
- `.gitattributes`: chuẩn hoá xuống dòng, tránh lỗi CRLF/LF giữa Windows và macOS/Linux:
  ```gitattributes
  * text=auto eol=lf
  *.bat text eol=crlf
  *.ps1 text eol=crlf
  ```
- `.env.example`: liệt kê các biến môi trường cần có, **không** chứa giá trị thật.
- `README.md`: mô tả ngắn project, cách cài đặt và cách chạy test.

### 0.4 Commit đầu tiên
```bash
git add .gitignore .gitattributes README.md WORKFLOW.md
git commit -m "chore: khởi tạo project"
```

### 0.5 Kết nối remote (nếu có)
```bash
git remote add origin <url-repo>
git push -u origin main
```

### 0.6 Quy ước nhánh
- `main`: luôn ở trạng thái chạy được, toàn bộ test pass.
- Mỗi tính năng / bug làm trên nhánh riêng: `feat/<tên>`, `fix/<tên>`, merge về `main` khi xong và đã test pass.

**Checklist trước khi sang bước 1:**
- [ ] `git init` xong, nhánh `main`
- [ ] Có `.gitignore`, `.gitattributes`
- [ ] Đã commit đầu tiên

---

## Bước 1 — Viết SPEC.md và PLAN.md trước

**Không được viết bất kỳ dòng code nào khi chưa có SPEC.md và PLAN.md.**

### SPEC.md — Làm *cái gì*
- Mục tiêu / vấn đề cần giải quyết
- Phạm vi: những gì **có** làm và **không** làm
- Yêu cầu chức năng (dạng danh sách, đánh số để test tham chiếu được)
- Yêu cầu phi chức năng (hiệu năng, bảo mật, UX…) nếu có
- Tiêu chí chấp nhận (acceptance criteria) — mỗi tiêu chí phải kiểm chứng được bằng test

### PLAN.md — Làm *như thế nào*
- Các bước triển khai, chia nhỏ thành task
- File / module sẽ tạo hoặc sửa
- Danh sách test case dự kiến cho từng task
- Rủi ro, điểm chưa rõ cần hỏi lại

**Checklist trước khi sang bước 2:**
- [ ] SPEC.md đã có tiêu chí chấp nhận rõ ràng
- [ ] PLAN.md đã liệt kê task và test case tương ứng
- [ ] Các điểm chưa rõ đã được hỏi và chốt

> Khi yêu cầu thay đổi giữa chừng: cập nhật SPEC.md / PLAN.md **trước**, sau đó mới sửa test và code.

---

## Bước 2 — Viết test case trước, code sau (TDD)

Với mỗi task trong PLAN.md:

1. **Red** — Viết test cho hành vi mong muốn (dựa theo tiêu chí chấp nhận trong SPEC.md). Chạy test và xác nhận test **fail** vì đúng lý do (chưa có chức năng, không phải lỗi cú pháp).
2. **Green** — Viết code tối thiểu để test **pass**.
3. **Refactor** — Dọn code cho sạch, test vẫn phải pass.

Quy tắc:
- Không viết code chức năng khi chưa có test fail tương ứng.
- Test phải bao phủ: trường hợp bình thường, trường hợp biên, trường hợp lỗi.
- Sửa bug: viết test tái hiện bug trước (fail), rồi mới sửa.
- Không sửa / xoá test chỉ để cho pass — nếu test sai thì sửa SPEC/PLAN trước và ghi rõ lý do.

---

## Bước 3 — Test lại, rồi commit

### 3.1 Test lại sau khi code
Sau khi code xong một task, **bắt buộc** chạy lại:
- [ ] Toàn bộ test suite (không chỉ test của task vừa làm)
- [ ] Lint / type-check (nếu project có cấu hình)
- [ ] Kiểm tra thủ công chức năng vừa làm nếu có giao diện

**Có test fail → không commit.** Sửa cho đến khi toàn bộ xanh.

### 3.2 Commit
- Commit ngay sau mỗi task hoàn thành và đã test pass — commit nhỏ, mỗi commit một mục đích.
- Commit gồm cả test và code của task đó (và cập nhật SPEC/PLAN nếu có).
- Message theo Conventional Commits:

```
<type>: <mô tả ngắn>

<chi tiết nếu cần, tham chiếu mục trong SPEC.md / task trong PLAN.md>
```

`type`: `feat` | `fix` | `test` | `refactor` | `docs` | `chore`

Ví dụ:
```
feat: tính pace trung bình theo tuần

Task 2 trong PLAN.md, đáp ứng yêu cầu R3 trong SPEC.md.
```

- Đánh dấu task đã xong trong PLAN.md.

---

## Tóm tắt checklist cho mỗi task

0. [ ] Đang ở nhánh riêng cho task (`feat/...` / `fix/...`)
1. [ ] SPEC.md và PLAN.md đã có và cập nhật
2. [ ] Viết test → chạy → **fail**
3. [ ] Viết code → chạy → **pass**
4. [ ] Refactor
5. [ ] Chạy lại **toàn bộ** test + lint → **pass**
6. [ ] Commit (test + code), đánh dấu task xong trong PLAN.md
