# VShare — 7-Day Build Plan & Codex Master Prompt

## 1. Mục tiêu

Xây dựng VShare trong 7 ngày cho khoảng 200 người dùng:

- Đăng bài chia sẻ hoặc tài liệu.
- Upload file lên Cloudflare R2.
- Lưu metadata bài viết trong Cloudflare D1.
- Hiển thị newsfeed.
- Tìm kiếm theo tiêu đề/nội dung.
- Lọc theo danh mục.
- Tải tài liệu.
- Giao diện Streamlit dễ dùng trên desktop và mobile.

Không xây trong phiên bản này:

- Microservices hoặc Cloudflare Worker API riêng.
- Đăng nhập phức tạp, phân quyền nhiều cấp.
- Bình luận, reaction, notification, realtime.
- Full-text search engine riêng.
- Docker/Kubernetes, message queue hoặc observability stack.

## 2. Kiến trúc phù hợp

Streamlit chạy server-side và trực tiếp gọi:

- Cloudflare D1 REST API để đọc/ghi bài viết.
- Cloudflare R2 qua boto3 để upload và tạo URL tải file.

Secrets chỉ tồn tại trong `.streamlit/secrets.toml` ở local hoặc Secrets Management khi deploy. Không commit secrets.

```text
VShare/
├── .streamlit/
│   ├── config.toml
│   └── secrets.toml.example
├── src/
│   ├── __init__.py
│   ├── config.py
│   ├── models.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── d1_service.py
│   │   └── r2_service.py
│   ├── ui/
│   │   ├── __init__.py
│   │   ├── form_tab.py
│   │   └── feed_tab.py
│   └── utils/
│       ├── __init__.py
│       └── helpers.py
├── tests/
│   ├── test_helpers.py
│   └── test_models.py
├── migrations/
│   └── 0001_initial.sql
├── app.py
├── requirements.txt
├── .gitignore
└── README.md
```

## 3. Quy tắc kiến trúc

- `app.py`: chỉ cấu hình trang, header và tabs; mục tiêu dưới 50 dòng.
- `src/ui/`: chỉ chứa widget, layout và thông báo cho người dùng.
- `src/services/`: chứa D1/R2 client và network calls; trả về dict/list hoặc model, không gọi `st.*`.
- `src/config.py`: đọc và validate secrets tập trung.
- `src/models.py`: schema và validation dữ liệu.
- `src/utils/`: hàm thuần dùng chung.
- `migrations/`: schema có version; không chạy `CREATE TABLE` sau mỗi Streamlit rerun.
- Mọi HTTP call phải có timeout và lỗi dễ hiểu.
- Mọi câu SQL phải dùng parameters, không nối chuỗi từ input người dùng.

## 4. Data model tối thiểu

```sql
CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL,
    author_name TEXT NOT NULL,
    file_key TEXT,
    file_name TEXT,
    file_type TEXT,
    file_size INTEGER,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_posts_created_at
ON posts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_posts_category_created_at
ON posts(category, created_at DESC);
```

Quy ước:

- `id`: UUID.
- `created_at`: UTC ISO 8601.
- D1 chỉ lưu metadata.
- R2 lưu nội dung file.
- `file_key` là object key duy nhất, không phải URL tạm thời.

## 5. Kế hoạch 7 ngày

### Ngày 1 — Scaffold và cấu hình

- Tạo cấu trúc thư mục.
- Tách cấu hình secrets.
- Tạo migration D1.
- Tạo R2 bucket và D1 database nếu chưa có.
- Hoàn thành `.gitignore`, `config.toml`, `secrets.toml.example`.

Kết quả: app khởi động và báo rõ secret nào đang thiếu.

### Ngày 2 — D1 service

- Viết hàm tạo bài.
- Viết hàm lấy newsfeed có phân trang.
- Viết tìm kiếm và lọc category.
- Chuẩn hóa response và exception.

Kết quả: kiểm thử được D1 độc lập với UI.

### Ngày 3 — R2 service

- Validate tên file, MIME type và dung lượng.
- Sinh object key an toàn.
- Upload file.
- Tạo presigned GET URL để tải.
- Xóa file nếu việc lưu bài thất bại sau upload.

Kết quả: upload/download chạy với file hợp lệ và từ chối file không hợp lệ.

### Ngày 4 — Form đăng bài

- Form author, title, category, content và attachment.
- Validation rõ ràng.
- Spinner và success/error state.
- Ngăn submit hai lần.
- Reset form sau khi thành công.

Kết quả: đăng được bài có hoặc không có file.

### Ngày 5 — Newsfeed

- Post card.
- Search.
- Category filter.
- Pagination.
- Empty state.
- Nút tải tài liệu.

Kết quả: luồng đăng bài → xuất hiện trên feed → tải file hoạt động.

### Ngày 6 — Hardening và test

- Unit test helpers/models.
- Mock D1/R2 cho các case lỗi quan trọng.
- Timeout cho network calls.
- Giới hạn input và file.
- Cache hợp lý cho feed, có invalidate sau khi đăng bài.
- Kiểm tra không lộ secrets/log nhạy cảm.

Kết quả: test và syntax check đều pass.

### Ngày 7 — Deploy và tài liệu

- Deploy Streamlit.
- Cấu hình production secrets.
- Smoke test trên desktop/mobile.
- Viết README hoàn chỉnh.
- Ghi rõ migration và troubleshooting.

Kết quả: người khác clone repo và chạy được theo README.

## 6. Giới hạn hợp lý cho MVP

- Tối đa 20 MB/file.
- Cho phép: PDF, DOCX, XLSX, PPTX, TXT, PNG, JPG, ZIP.
- Tiêu đề: 5–150 ký tự.
- Nội dung: 10–10.000 ký tự.
- Tên người đăng: 2–60 ký tự.
- Page size: 10 bài.
- HTTP timeout: khoảng 10–20 giây.
- Presigned download URL: khoảng 15 phút.

## 7. Definition of Done

- `app.py` dưới 50 dòng và không chứa SQL/boto3 logic.
- Không commit token, secret hoặc `secrets.toml`.
- Đăng bài không file hoạt động.
- Đăng bài có file hoạt động.
- Search, category filter và pagination hoạt động.
- Download file hoạt động.
- Lỗi D1/R2 hiển thị thân thiện, không làm app crash.
- Không tạo database/table khi Streamlit rerun.
- Tests quan trọng pass.
- README đủ hướng dẫn setup, migration, chạy local và deploy.

## 8. Master Prompt cho Codex

```text
Bạn là senior Python engineer. Hãy build/refactor dự án VShare thành một
production-minded MVP có thể hoàn thành trong 1 tuần và phục vụ khoảng 200
người dùng.

MỤC TIÊU SẢN PHẨM
- Streamlit web app để đăng bài chia sẻ và tài liệu.
- Metadata bài viết lưu trong Cloudflare D1 qua REST API.
- File lưu trong Cloudflare R2 qua boto3/S3-compatible API.
- Có form đăng bài, upload, newsfeed, search, category filter, pagination và
  download.

NGUYÊN TẮC QUAN TRỌNG
- Không over-engineer.
- Không tạo microservice, Cloudflare Worker API, Docker, Kubernetes, queue,
  Redis, repository pattern nhiều tầng hoặc authentication phức tạp.
- Giữ dependencies ít và ổn định.
- Ưu tiên code rõ ràng, dễ đọc, dễ debug và đủ an toàn cho khoảng 200 user.
- Nếu repo đã có code, phải đọc và giữ lại hành vi đang hoạt động trước khi
  refactor. Không xóa hoặc viết lại tùy tiện phần không liên quan.

CẤU TRÚC BẮT BUỘC
VShare/
├── .streamlit/config.toml
├── .streamlit/secrets.toml.example
├── src/config.py
├── src/models.py
├── src/services/d1_service.py
├── src/services/r2_service.py
├── src/ui/form_tab.py
├── src/ui/feed_tab.py
├── src/utils/helpers.py
├── migrations/0001_initial.sql
├── tests/
├── app.py
├── requirements.txt
├── .gitignore
└── README.md

RANH GIỚI MODULE
- app.py chỉ page config, header, tabs và gọi render functions; dưới 50 dòng.
- ui chỉ xử lý Streamlit layout/widgets và gọi service.
- services chứa network/API/storage logic và không được import Streamlit.
- config đọc/validate secrets tập trung.
- models chứa schema và validation.
- helpers chỉ chứa pure functions dùng chung.
- migration không được tự động chạy trong mỗi lần Streamlit rerun.

YÊU CẦU KỸ THUẬT
- Python type hints cho public functions.
- D1 query phải parameterized, không nội suy trực tiếp input vào SQL.
- Mọi HTTP request có timeout và raise lỗi có context.
- R2 object key phải dùng UUID và tên file đã sanitize.
- D1 chỉ lưu object key và metadata, không lưu presigned URL.
- Validate extension, MIME type và dung lượng tối đa 20 MB.
- Nếu upload R2 thành công nhưng tạo post D1 thất bại, cố gắng xóa object vừa
  upload để tránh orphan file.
- Không log token, secret hoặc presigned URL.
- Có pagination phía D1, không tải toàn bộ bài viết rồi mới lọc trong Python.
- Dùng st.cache_data có TTL ngắn cho feed nếu phù hợp và clear cache sau khi
  tạo bài thành công.
- Hiển thị lỗi thân thiện cho user nhưng vẫn giữ thông tin kỹ thuật an toàn cho
  debug.

SCHEMA MVP
- Một bảng posts gồm: id, title, content, category, author_name, file_key,
  file_name, file_type, file_size, created_at.
- Index created_at và (category, created_at).
- UUID cho id; UTC ISO 8601 cho timestamp.

TEST TỐI THIỂU
- Test sanitize filename/object key.
- Test validation title/content/file size/type.
- Test mapping D1 response.
- Mock các trường hợp D1 timeout/error và R2 upload error.
- Không cần cố đạt coverage cao; ưu tiên các luồng dễ hỏng.

README PHẢI CÓ
- Giới thiệu và tính năng.
- Kiến trúc và directory structure.
- Yêu cầu môi trường.
- Cách tạo/cấu hình D1 và R2.
- Nội dung mẫu secrets.toml không chứa secret thật.
- Cách chạy migration.
- Cách cài và chạy local.
- Cách chạy tests.
- Cách deploy Streamlit.
- Troubleshooting phổ biến.
- Architecture Rules for Codex.

QUY TRÌNH THỰC HIỆN
1. Inspect toàn bộ repo và tóm tắt hiện trạng.
2. Nêu ngắn gọn kế hoạch sửa file nào.
3. Implement theo từng module, giữ tương thích hành vi cũ.
4. Chạy formatter/linter nếu có, compile check và tests.
5. Sửa mọi lỗi do thay đổi của bạn.
6. Kiểm tra git diff để tránh thay đổi ngoài phạm vi.
7. Báo cáo file đã tạo/sửa, test result và các bước cấu hình thủ công còn lại.

Không dừng ở việc đưa ví dụ code hoặc hướng dẫn chung. Hãy trực tiếp tạo/sửa
file trong repo và xác minh dự án chạy được. Nếu thiếu credentials thật, hãy
mock network calls khi test và tạo secrets.toml.example; tuyệt đối không bịa
credentials.
```
