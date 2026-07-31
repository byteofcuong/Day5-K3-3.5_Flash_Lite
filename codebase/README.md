# VShare AI Search Prototype

Web app tìm học liệu có căn cứ trong kho tài liệu cộng đồng VShare.
Không cần database: toàn bộ dữ liệu nằm trong `data/db.json`.

## Chạy nhanh

```powershell
npm.cmd install
Copy-Item .env.example .env      # điền JWT_SECRET và GEMINI_API_KEY
npm.cmd run seed                 # tạo data/db.json từ data/catalog.json
npm.cmd start
```

Mở `http://localhost:3000`. Tài khoản demo:
`viet@vshare.local` hoặc `admin@vshare.local` — mật khẩu `VShare@2026`.

Chạy offline không tốn quota AI:

```powershell
$env:ENABLE_MOCK_AI="true"; npm.cmd start
```

## Kiến trúc

### Backend — `src/`

Luồng phụ thuộc một chiều: `routes → services → repositories → store`.
Tầng dưới không bao giờ biết tầng trên.

| Thư mục | Trách nhiệm |
|---|---|
| `config/` | Đọc và **kiểm tra** biến môi trường. Sai cấu hình thì server không khởi động. |
| `store/` | `db.json` giữ trong RAM, ghi xuống đĩa theo kiểu atomic (ghi tệp tạm rồi rename) và debounce. |
| `repositories/` | Truy vấn từng collection. Đồng bộ, không async logic. |
| `services/` | Toàn bộ quy tắc nghiệp vụ và validation. Ném `HttpError`, không tự set status code. |
| `middleware/` | Auth, upload, error. `error.mw.js` là nơi **duy nhất** dựng response lỗi. |
| `routes/` | Chỉ ánh xạ HTTP ↔ service. Không chứa logic. |
| `ai/`, `search.js` | **Agent — không sửa.** Chỉ được gọi từ `services/search.service.js` và `routes/ai.routes.js`. |

Quy ước response:

- Danh sách: `{ items, total }`
- Đơn lẻ: `{ document }`, `{ user }`, `{ message }`
- Lỗi: `{ error, code }` — mọi lỗi, mọi endpoint

### Frontend — `public/`

Không build step, ES modules chạy thẳng trên trình duyệt.

```
js/
  core/       dom · api · store · router · markdown   (hạ tầng, không biết gì về VShare)
  state/      session                                  (trạng thái dùng chung)
  components/ doc-card · chat-panel · modal · states  (mảnh UI tái sử dụng)
  views/      feed · search · chat · rooms · upload · my-docs · doc-detail
  main.js     bảng route + bootstrap
```

Bốn quy tắc giữ cho kiến trúc không rã:

1. **Markup và hành vi ở cùng một chỗ.** `index.html` chỉ là khung rỗng; mỗi view
   tự render nội dung của mình. Không còn ID nào phải khớp thủ công giữa hai tệp.
2. **Escape mặc định.** Mọi giá trị nội suy vào `` html`…` `` được escape tự động;
   muốn chèn markup thật phải gọi `raw()` một cách chủ ý.
3. **Chỉ dùng event delegation.** Không `onclick` inline, không hàm global —
   listener gắn trên node cha nên sống sót qua mọi lần re-render.
4. **Một bảng route duy nhất.** Thanh nav được sinh ra từ chính bảng mà router
   dùng để resolve, nên không thể có mục nav trỏ tới view không tồn tại.

Mỗi view có vòng đời `render(container, ctx)` / `destroy()`; router gọi `destroy()`
trước khi chuyển trang nên interval và listener được dọn sạch.

## Agent và grounding

`POST /api/search` chạy vòng lặp ReAct thật (Thought → Action → Observation →
Final Answer), tối đa 4 bước.

`services/search.service.js` **lọc grounding** trước khi trả về: kết quả nào có
`documentId` không tồn tại trong catalog sẽ bị loại và đếm vào `groundingRejected`.
Đây là chỗ thực thi yêu cầu §7 của `spec.md`. Mỗi kết quả trả về kèm luôn object
`document` để UI hiển thị tiêu đề, trình độ và tag thay vì ID thô.

Mọi lượt gọi AI được ghi vào `traces/ai-calls.jsonl`.

## Eval

```powershell
npm.cmd start          # terminal 1
npm.cmd run eval       # terminal 2
```

Kết quả lưu ở `../eval/run-gemini-*.csv`. File `run-mock-*` chỉ kiểm tra plumbing,
không dùng làm kết quả CP3.

## API

| Method | Endpoint | Auth |
|---|---|---|
| POST | `/api/auth/register` · `/api/auth/login` | – |
| GET | `/api/auth/me` | ✔ |
| POST | `/api/auth/logout` | ✔ |
| GET | `/api/documents?q=&category=` | – |
| GET | `/api/documents/:id` · `/:id/download` · `/:id/ratings` | – |
| GET | `/api/contributors` | – |
| GET | `/api/my/documents` | ✔ |
| POST | `/api/documents` (multipart) | ✔ |
| DELETE | `/api/documents/:id` (gỡ mềm) | ✔ chủ sở hữu |
| PATCH | `/api/documents/:id/visibility` | ✔ chủ sở hữu |
| POST | `/api/documents/:id/rate` | ✔ |
| POST | `/api/search` · `/api/chat` | – |
| POST | `/api/documents/:id/summarize` · `/chat` · `/flashcards` | – |
| GET | `/api/rooms` · `/api/rooms/:id/messages` | – |
| POST | `/api/rooms/:id/messages` | ✔ |
| GET | `/api/health` | – |

## Dữ liệu

`data/db.json` được sinh từ `data/catalog.json` và không commit vào git.
Muốn tạo lại từ đầu: `npm.cmd run seed -- --force`.

Tệp upload nằm trong `uploads/`. Không đưa dữ liệu người thật hoặc API key vào repo.

## Kiểm thử

```powershell
npm.cmd test
```
