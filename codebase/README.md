# VShare AI Search Prototype

## Chạy demo local không cần Firebase

Chế độ này lưu metadata demo vào `codebase/data/local-demo.json` và lưu file upload vào `codebase/uploads`. Không cần Firestore/Firebase Storage.

```powershell
npm.cmd install
$env:DATA_SOURCE="local"
$env:ENABLE_MOCK_AI="true"
$env:JWT_SECRET="01234567890123456789012345678901"
npm.cmd start
```

Mở `http://localhost:3000`, đăng ký một tài khoản bất kỳ rồi upload tài liệu. File `.txt` và `.pdf` sẽ được trích xuất text vào trường `content` để agent có thể tóm tắt/hỏi đáp trong demo. PDF seed trong `backend/docs` cũng được lazy-extract khi user mở hoặc hỏi tài liệu lần đầu. Các định dạng DOCX/PPTX/XLSX/ZIP hiện chỉ lưu file và metadata.

## Chạy mock để kiểm tra UI

```powershell
npm.cmd install
$env:ENABLE_MOCK_AI="true"
npm.cmd start
```

Mở `http://localhost:3000`.

## Chạy Gemini thật cho CP3

```powershell
Copy-Item .env.example .env
```

Điền `GEMINI_API_KEY`, đặt `ENABLE_MOCK_AI=false`, rồi:

```powershell
npm.cmd start
```

Terminal khác:

```powershell
npm.cmd run eval
```

Gemini chạy một agent loop thật: model tự chọn `search_documents`, có thể gọi
`get_document`, backend thực thi tool rồi gửi function response lại model.
Mỗi vòng tối đa 4 bước để tránh chạy vô hạn.

Mọi Gemini/tool call được ghi vào `traces/ai-calls.jsonl`. Eval thật được lưu thành
`../eval/run-gemini-*.csv`; file `run-mock-*` chỉ kiểm tra plumbing, không dùng
làm kết quả CP3.

Không đưa dữ liệu người thật hoặc API key vào repo.

## Kết nối Firebase Firestore

1. Tạo Firebase project và Firestore Database.
2. Firebase Console → Project settings → Service accounts → Generate new private key.
3. Copy `.env.example` thành `.env`, điền ba biến Firebase và đặt:

```env
DATA_SOURCE=firebase
```

4. Seed catalog:

```powershell
npm.cmd run firebase:seed
```

5. Khởi động lại app. Health endpoint phải báo:

```json
{"dataSource":"firebase","firebaseConfigured":true}
```

Không commit JSON service account hoặc private key. Firebase Storage là bước
riêng và yêu cầu dự án Blaze; Firestore catalog không cần Storage.

## Tài khoản và dữ liệu Firestore

Chạy `npm.cmd run firebase:seed` để tạo:

- `users`: 5 tài khoản với vai trò `admin`/`member`;
- `documents`: 4 PDF thật từ `backend/docs`;
- `posts`: bài đăng tương ứng với từng tài liệu;
- `documentInteractions`: dữ liệu bookmark/like mẫu;
- `sessions`: được tạo khi đăng nhập và thu hồi khi đăng xuất.

Tài khoản demo: `viet@vshare.local` / `VShare@2026`.
Tài khoản quản trị sở hữu 4 PDF: `admin@vshare.local` / `VShare@2026`.

Các API chính:

- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`;
- `GET /api/auth/me`, `GET /api/my/documents`;
- `GET /api/catalog`, `GET /api/documents/:id`;
- `POST /api/documents` (multipart upload, cần JWT);
- `PATCH /api/documents/:id/visibility` (chỉ chủ sở hữu/admin);
- `POST /api/documents/:id/bookmark`, `POST /api/search`.

Tệp upload mới được giữ trong `codebase/uploads` khi chạy local. Khi deploy lâu
dài, cấu hình Firebase Storage hoặc dịch vụ object storage để tệp không mất khi
máy chủ được tạo lại.


