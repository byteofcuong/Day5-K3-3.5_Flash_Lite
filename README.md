# VShare

VShare là MVP Streamlit để một cộng đồng khoảng 200 người đăng bài, chia sẻ
tài liệu và tìm lại nội dung. Metadata bài viết được lưu trong Cloudflare D1;
tệp được lưu riêng trong Cloudflare R2.

## Tính năng

- Đăng bài có tên người đăng, tiêu đề, nội dung và danh mục.
- Đính kèm PDF, DOCX, XLSX, PPTX, TXT, PNG, JPG hoặc ZIP, tối đa 20 MB.
- Bảng tin mới nhất, tìm theo tiêu đề/nội dung, lọc danh mục và phân trang.
- Tạo URL tải R2 có thời hạn 15 phút.
- Thông báo lỗi thân thiện; không đưa secret hoặc URL tạm vào database.

Không thuộc phạm vi MVP: đăng nhập/phân quyền, bình luận, reaction, realtime,
microservice và search engine riêng.

## Kiến trúc

Streamlit chạy server-side, gọi trực tiếp Cloudflare D1 REST API và R2
S3-compatible API. D1 chỉ giữ metadata và `file_key`; R2 giữ bytes của tệp.

```text
.
├── .streamlit/
│   ├── config.toml
│   └── secrets.toml.example
├── migrations/0001_initial.sql
├── src/
│   ├── config.py
│   ├── models.py
│   ├── services/
│   │   ├── d1_service.py
│   │   └── r2_service.py
│   ├── ui/
│   │   ├── feed_tab.py
│   │   └── form_tab.py
│   └── utils/helpers.py
├── tests/
├── app.py
├── requirements.txt
└── requirements-dev.txt
```

## Yêu cầu

- Python 3.10 trở lên.
- Tài khoản Cloudflare có D1 và R2.
- Cloudflare API token có quyền chạy truy vấn trên D1.
- R2 access key có quyền đọc, ghi và xóa object trong bucket.

## Tạo D1 và R2

Có thể dùng Cloudflare dashboard hoặc Wrangler:

```bash
npx wrangler d1 create vshare
npx wrangler r2 bucket create vshare
```

Ghi lại D1 database ID và Cloudflare account ID. Tạo một API token giới hạn cho
D1 trong Cloudflare dashboard. Trong **R2 > Manage R2 API Tokens**, tạo access
key chỉ cho bucket VShare với quyền Object Read & Write.

Không dùng Global API Key và không commit bất kỳ credential nào.

## Cấu hình local

Tạo file local từ mẫu:

```bash
cp .streamlit/secrets.toml.example .streamlit/secrets.toml
```

Nội dung cần có:

```toml
[cloudflare]
account_id = "your-cloudflare-account-id"
api_token = "your-d1-api-token"
d1_database_id = "your-d1-database-id"

[r2]
access_key_id = "your-r2-access-key-id"
secret_access_key = "your-r2-secret-access-key"
bucket_name = "vshare"
```

`.streamlit/secrets.toml` đã nằm trong `.gitignore`. File example chỉ chứa
placeholder.

## Chạy migration

Migration không tự chạy khi Streamlit rerun. Chạy một lần cho từng môi trường:

```bash
npx wrangler d1 execute vshare --remote \
  --file=migrations/0001_initial.sql
```

Nếu Wrangler không tìm thấy database theo tên, thêm `database_id` vào
`wrangler.toml` hoặc dùng đúng binding/database name theo hướng dẫn mà lệnh
`wrangler d1 create` trả về.

## Cài và chạy local

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
streamlit run app.py
```

App mặc định mở tại `http://localhost:8501`. Nếu thiếu cấu hình, app dừng an
toàn và liệt kê chính xác tên setting còn thiếu.

## Chạy kiểm thử

Network calls được mock; test không cần credential thật:

```bash
python -m pip install -r requirements-dev.txt
python -m pytest
python -m compileall -q app.py src tests
```

## Deploy Streamlit Community Cloud

1. Đẩy repo lên GitHub nhưng kiểm tra chắc chắn không có
   `.streamlit/secrets.toml`.
2. Trong Streamlit Community Cloud, chọn repo, branch và entrypoint `app.py`.
3. Mở **Advanced settings > Secrets**, dán cấu hình TOML ở trên với giá trị
   production.
4. Deploy, sau đó smoke test: đăng bài không file, đăng bài có file, tìm/lọc,
   chuyển trang và tải file trên desktop lẫn mobile.
5. Nếu Cloudflare giới hạn token theo IP, cho phép hạ tầng deploy hoặc bỏ giới
   hạn IP cho token riêng của app, nhưng vẫn giữ quyền tối thiểu.

Migration production phải được chạy thủ công trước deploy. Không thêm migration
logic vào app.

## Troubleshooting

- **Thiếu cấu hình bắt buộc**: kiểm tra đúng section `[cloudflare]`, `[r2]` và
  tên key trong file mẫu; restart Streamlit sau khi sửa secret.
- **D1 trả 401/403**: token sai, hết hạn, sai account hoặc thiếu quyền D1.
- **`no such table: posts`**: migration chưa chạy trên đúng remote database.
- **Upload R2 bị 403**: access key không có Object Write hoặc bucket name sai.
- **Tải file thất bại**: access key cần Object Read; URL chỉ có hạn 15 phút,
  hãy tạo lại liên kết.
- **File bị từ chối**: kiểm tra dung lượng tối đa 20 MB, extension và MIME type.
  Trình duyệt/hệ điều hành đôi khi gán MIME type lạ; đổi sang file đúng định
  dạng thay vì chỉ đổi đuôi.
- **Bảng tin chưa cập nhật ngay**: tạo bài thành công sẽ xóa cache; các thay đổi
  ghi ngoài app có thể cần tối đa 30 giây.

Lỗi hiển thị cho người dùng cố ý không chứa token, secret hay presigned URL.
Muốn debug sâu hơn, kiểm tra status/error trong Cloudflare dashboard và log
server, không in object credential.

## Architecture Rules for Codex

- Giữ `app.py` chỉ làm page config, header, tabs và gọi hàm render; dưới 50 dòng.
- UI chỉ chứa Streamlit widgets/layout. Network và storage nằm trong `services`.
- `services` không import Streamlit; mọi HTTP request phải có timeout.
- Cấu hình được đọc/validate tập trung trong `src/config.py`.
- Model và validation dữ liệu nằm trong `src/models.py`; helper dùng chung phải
  là hàm thuần.
- Mọi input trong SQL phải đi qua `params`; không nối hoặc nội suy input vào SQL.
  Chỉ các fragment SQL cố định do code kiểm soát được phép ghép.
- D1 lưu `file_key`, không lưu presigned URL. Object key dùng UUID và filename
  đã sanitize.
- Nếu upload R2 xong nhưng ghi D1 thất bại, luôn cố xóa object vừa upload.
- Migration có version và chỉ chạy thủ công, không chạy trong Streamlit rerun.
- Không thêm auth phức tạp, Worker API, Docker, queue, Redis hay abstraction
  nhiều tầng nếu yêu cầu sản phẩm chưa thay đổi.
