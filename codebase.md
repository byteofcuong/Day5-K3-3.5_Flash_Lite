# Codebase Overview

## 1. Mục tiêu repository

Repository này là bài nộp/prototype cho Mini Hackathon AI. Phần gốc repo chứa đề bài, spec, checkpoint, evidence, eval và validation. Phần ứng dụng chạy được nằm trong thư mục `codebase/`.

Prototype chính là **VShare AI Search Prototype**: một web app chia sẻ tài liệu học tập, có bảng tin tài liệu, đăng nhập/đăng ký, upload tài liệu, quản lý tài liệu cá nhân và tìm kiếm tài liệu bằng AI.

## 2. Cấu trúc thư mục chính

```text
.
├── README.md                  # Hướng dẫn hackathon và cấu trúc bài nộp
├── 01-de-bai.md               # Đề bài
├── 02-guide.md                # Hướng dẫn từng giai đoạn
├── 03-template-ai-spec.md     # Template AI Spec
├── 04-rubric.md               # Rubric chấm điểm
├── spec.md                    # AI Spec của nhóm
├── canvas.md                  # Canvas sản phẩm
├── demo-script.md             # Kịch bản demo
├── problem-candidates.md      # Các hướng bài toán đã cân nhắc
├── prototype-plan.md          # Kế hoạch prototype
├── checkpoints/               # Artifact cho CP1-CP5
├── evidence/                  # Bằng chứng khảo sát/mining
├── eval/                      # Golden set và kết quả chạy eval
├── validation/                # Kế hoạch/log validation
├── data/                      # Data pack hackathon đã ẩn danh
├── backend/docs/              # PDF thật dùng cho catalog Firebase seed
├── tham-khao/                 # Tài liệu tham khảo JTBD
└── codebase/                  # Prototype Node/Express + frontend tĩnh
```

## 3. Ứng dụng `codebase/`

```text
codebase/
├── package.json
├── package-lock.json
├── README.md
├── data/catalog.json
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── src/
│   ├── server.js
│   ├── search.js
│   ├── auth.js
│   └── firebase.js
├── scripts/
│   ├── seed-firebase.js
│   └── run-eval.js
├── test/search.test.js
└── uploads/.gitkeep
```

Stack chính:

- Runtime: Node.js ESM.
- Backend: Express 5.
- Auth: JWT + bcryptjs.
- Upload: multer, lưu local vào `codebase/uploads`.
- Data source: local JSON hoặc Firebase Firestore.
- AI: Gemini API hoặc mock mode.
- Frontend: HTML/CSS/vanilla JS, served static bởi Express.
- Test: `node --test`.

Scripts trong `codebase/package.json`:

```bash
npm run dev            # node --watch src/server.js
npm start              # node src/server.js
npm test               # node --test
npm run eval           # node scripts/run-eval.js
npm run firebase:seed  # node scripts/seed-firebase.js
```

## 4. Luồng chạy backend

Entry point là `codebase/src/server.js`.

Server khởi tạo:

- Load `.env` qua `dotenv/config`.
- Đọc catalog local từ `codebase/data/catalog.json`.
- Tạo thư mục `codebase/uploads` nếu chưa có.
- Serve static frontend từ `codebase/public`.
- Serve upload local qua `/uploads`.
- Serve PDF seed từ `backend/docs` qua `/library`.
- Export `app` và `localCatalog` để phục vụ test.

Data source:

- Nếu `DATA_SOURCE=firebase`, backend đọc/ghi Firestore qua `src/firebase.js`.
- Nếu không, backend dùng `codebase/data/catalog.json` và chỉ lấy document `available=true`.

AI search:

- Nếu `ENABLE_MOCK_AI=true`, `/api/search` dùng `mockSearch`.
- Nếu không, `/api/search` gọi Gemini qua REST endpoint `generateContent`.
- Gemini chạy agent loop tối đa 4 bước.
- Model được phép gọi tool `search_documents`, `get_document` và `get_document_content`.
- Ngoài tìm tài liệu, agent có thể trả lời dạng tóm tắt/hỏi đáp khi đã lấy được content có căn cứ từ tool.
- Trace AI/tool call được append vào `codebase/traces/ai-calls.jsonl`.

## 5. API chính

Auth:

- `POST /api/auth/register`: tạo user, hash password, tạo session, trả JWT.
- `POST /api/auth/login`: kiểm tra email/password, tạo session, trả JWT.
- `GET /api/auth/me`: lấy user hiện tại, cần Bearer token.
- `POST /api/auth/logout`: revoke session hiện tại.

Catalog/document:

- `GET /api/catalog`: danh sách document khả dụng.
- `GET /api/contributors?limit=5`: top contributors dựa trên post đã publish.
- `GET /api/documents/:id`: chi tiết document.
- `GET /api/documents/:id/download`: redirect tới `fileUrl`, tăng download nếu dùng Firebase.
- `POST /api/documents`: upload document mới, cần JWT, multipart form.
- `PATCH /api/documents/:id/visibility`: ẩn/hiện document, chỉ owner hoặc admin.
- `POST /api/documents/:id/bookmark`: lưu/bỏ bookmark, cần JWT.

Search/health:

- `POST /api/search`: nhận `{ "query": "..." }`, trả kết quả AI/mock.
- `GET /api/health`: trạng thái server, mock mode, data source, Firebase/Gemini configured.

## 6. Search và AI guardrails

Logic nằm ở `codebase/src/search.js`.

Các thành phần chính:

- `agentTools`: khai báo 3 function tool cho Gemini:
  - `search_documents`: tìm tối đa 5 tài liệu theo query/tags/level.
  - `get_document`: lấy metadata đầy đủ cho document ID đã xuất hiện trong kết quả tool, nhưng không expose trường `content`.
  - `get_document_content`: lấy nội dung text đã kiểm soát của một document khả dụng để agent tóm tắt hoặc hỏi đáp.
- `executeAgentTool`: thực thi retrieval đơn giản bằng lexical matching, level bonus và official source bonus.
- `buildAgentInstruction`: prompt yêu cầu agent chỉ dùng kho VShare, không bịa ID/link, hỏi lại nếu mơ hồ, từ chối quiz answer hoặc dữ liệu cá nhân, và bắt buộc gọi `get_document_content` trước khi tóm tắt/hỏi đáp trên nội dung tài liệu.
- `parseAndValidate`: parse JSON AI trả về, chỉ nhận status hợp lệ, loại document ID bịa, loại document unavailable, validate `sources`, giới hạn tối đa 3 kết quả và tối đa 5 nguồn.
- `mockSearch`: fallback/mock để kiểm tra plumbing và UI.

Status hợp lệ của AI output:

- `results`: có kết quả.
- `clarify`: cần hỏi thêm một câu.
- `none`: không có căn cứ trong catalog.
- `refuse`: từ chối yêu cầu không phù hợp.
- `summary`: agent đã tóm tắt tài liệu dựa trên content lấy từ tool.
- `answer`: agent đã trả lời câu hỏi dựa trên content lấy từ tool.

Điểm quan trọng: backend không tin hoàn toàn output của model. Dù model trả document ID bịa hoặc ID đã xóa, `parseAndValidate` sẽ loại bỏ và chuyển thành `none` nếu không còn kết quả hợp lệ. Với `summary`/`answer`, backend chỉ giữ `sources` trỏ tới document đang `available=true`; nếu model khai nguồn bịa thì nguồn đó bị loại.

`get_document_content` cũng có guardrail riêng:

- Chỉ trả nội dung của document `available=true`.
- Trả `{ "error": "DOCUMENT_NOT_FOUND" }` nếu document không tồn tại hoặc đã ẩn/xóa.
- Trả `{ "error": "CONTENT_NOT_AVAILABLE" }` nếu document có metadata nhưng chưa có trường `content`.
- Giới hạn `max_chars` trong khoảng 1.000-12.000 ký tự để tránh nhồi context quá dài.
- `search_documents` và `get_document` dùng `publicDocument`, nên không rò rỉ content vào những tool chỉ cần metadata.

## 7. Auth và session

Logic auth nằm ở `codebase/src/auth.js`.

- JWT được ký bằng `JWT_SECRET`, bắt buộc dài tối thiểu 32 ký tự.
- Token có issuer `vshare-api` và audience `vshare-web`.
- Mặc định hết hạn sau `2h`, có thể đổi qua `JWT_EXPIRES_IN`.
- `requireAuth` kiểm tra Bearer token, session trong Firestore, trạng thái revoke/expire và user active.
- `publicUser` loại `passwordHash` trước khi trả về client.

Lưu ý: auth hiện phụ thuộc các hàm Firestore trong `firebase.js`. Vì vậy các endpoint cần đăng nhập chỉ hoạt động đúng khi Firebase đã được cấu hình.

## 8. Firebase layer

Logic nằm ở `codebase/src/firebase.js`.

Biến môi trường tối thiểu:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

Firestore collections được dùng:

- `users`
- `sessions`
- `documents`
- `posts`
- `documentInteractions`

Các hàm chính:

- Document: `listDocuments`, `getDocument`, `saveDocument`, `seedDocuments`, `incrementDownload`.
- User/session: `findUserByEmail`, `getUser`, `createUser`, `createSession`, `getSession`, `revokeSession`.
- Community: `savePost`, `listTopContributors`, `saveInteraction`.
- Storage helper: `uploadDocumentFile`, hiện chỉ dùng nếu cấu hình `FIREBASE_STORAGE_BUCKET`.

## 9. Frontend

Frontend nằm trong `codebase/public`.

`index.html` định nghĩa các màn hình:

- Bảng tin tài liệu.
- Top contributors.
- AI Search.
- Đăng tài liệu.
- Tài liệu của tôi.
- Dialog đăng nhập/đăng ký.
- Dialog chi tiết tài liệu.

`app.js` xử lý:

- Gọi API bằng `fetch`.
- Lưu token trong `localStorage` với key `vshare_token`.
- Render card tài liệu.
- Filter feed theo text/category.
- Submit search tới `/api/search`.
- Render kết quả `summary`/`answer` thành card trả lời riêng, hiển thị `message` và các `sources` đã validate.
- Upload form tới `/api/documents`.
- Load tài liệu cá nhân và toggle visibility.
- Login/register/logout.
- Mở dialog chi tiết document.

`styles.css` là CSS thuần, layout responsive một cột trên mobile, tab navigation, card tài liệu, contributor list, form và dialog.

## 10. Dữ liệu local và dữ liệu seed

`codebase/data/catalog.json` chứa catalog local gồm các tài liệu mock/metadata học tập. Một số document có thêm trường `content` để `get_document_content` phục vụ tóm tắt/hỏi đáp. Có cả document `available=false` để test guardrail không trả tài liệu đã xóa, và có document khả dụng nhưng chưa có `content` để test nhánh `CONTENT_NOT_AVAILABLE`.

`codebase/scripts/seed-firebase.js` seed Firestore với:

- 5 users demo, password chung `VShare@2026`.
- 4 PDF thật từ `backend/docs`.
- Posts tương ứng với tài liệu official.
- Một số community posts để có bảng top contributors.
- Một số interactions mẫu như bookmark/like.

Tài khoản demo:

- Member: `viet@vshare.local` / `VShare@2026`
- Admin: `admin@vshare.local` / `VShare@2026`

## 11. Eval và test

Unit test:

- File: `codebase/test/search.test.js`.
- Chạy: `cd codebase && npm test`.
- Test hiện có tập trung vào guardrails search:
  - Loại document ID bịa.
  - Loại document unavailable.
  - Mock mode hỏi lại khi query quá mơ hồ.
  - Tool search chỉ trả document available và không expose `content`.
  - `get_document` không expose document đã xóa hoặc trường `content`.
  - `get_document_content` trả content có giới hạn cho document khả dụng.
  - `get_document_content` chặn document đã xóa và báo `CONTENT_NOT_AVAILABLE` khi thiếu content.
  - `parseAndValidate` chấp nhận `summary` và chỉ giữ `sources` hợp lệ.

Golden set:

- File: `eval/golden-set.csv`.
- Gồm 22 case: normal, hard, rare.
- Bao phủ các hành vi: trả đúng tài liệu, clarify, refuse, none, insufficient, chống prompt injection, không trả tài liệu đã xóa. Các case `summary`/`answer` hiện được hỗ trợ ở code path agent và unit test; golden set vẫn chủ yếu đo luồng search/recommendation.

Eval runner:

- File: `codebase/scripts/run-eval.js`.
- Chạy against app đang mở tại `VSHARE_URL` hoặc mặc định `http://localhost:3000`.
- Gọi `/api/health` để xác định mode `mock` hay `gemini`.
- Gọi `/api/search` cho từng case.
- Ghi kết quả vào `eval/run-{mock|gemini}-{timestamp}.csv`.
- Mock run chỉ kiểm tra plumbing, không phải kết quả CP3 chính thức.

## 12. Biến môi trường thường dùng

Các biến quan trọng:

```env
PORT=3000
ENABLE_MOCK_AI=true
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
JWT_SECRET=at-least-32-characters
JWT_EXPIRES_IN=2h
DATA_SOURCE=local
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
FIREBASE_STORAGE_BUCKET=
```

Chế độ local/mock nhanh:

```powershell
cd codebase
npm install
$env:ENABLE_MOCK_AI="true"
$env:JWT_SECRET="01234567890123456789012345678901"
npm start
```

Chế độ Gemini thật:

```powershell
cd codebase
$env:ENABLE_MOCK_AI="false"
$env:GEMINI_API_KEY="..."
$env:JWT_SECRET="01234567890123456789012345678901"
npm start
```

Chế độ Firestore:

```powershell
cd codebase
$env:DATA_SOURCE="firebase"
# cấu hình FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
npm run firebase:seed
npm start
```

## 13. Artifact runtime và bảo mật

`.gitignore` đang loại:

- `node_modules/`
- `*.env`
- `.DS_Store`

Runtime tạo thêm:

- `codebase/uploads/`: file upload local.
- `codebase/traces/ai-calls.jsonl`: trace AI/Gemini/tool call.
- `eval/run-*.csv`: kết quả eval.

Không commit:

- API key.
- `.env`.
- Firebase service account JSON/private key.
- Dữ liệu thật chưa được phép chia sẻ.

## 14. Điểm cần lưu ý kỹ thuật

- `server.js` dùng local catalog cho anonymous catalog/search, nhưng auth/session/document upload cần Firebase vì `auth.js` gọi Firestore.
- Upload local chỉ bền khi chạy trên máy hiện tại. Deploy lâu dài cần Firebase Storage hoặc object storage tương đương.
- `multer` chỉ cho các extension: `.pdf`, `.docx`, `.xlsx`, `.pptx`, `.txt`, `.png`, `.jpg`, `.jpeg`, `.zip`, tối đa 20 MB.
- Gemini agent loop giới hạn 4 bước để tránh vòng lặp vô hạn.
- `parseAndValidate` là lớp chống hallucination quan trọng nhất: chỉ tài liệu có trong catalog và `available=true` mới được trả.
- Một số nội dung tiếng Việt có thể hiển thị sai trong terminal Windows nếu encoding không phải UTF-8, nhưng file source là UTF-8 theo khai báo HTML và nội dung thực tế.

