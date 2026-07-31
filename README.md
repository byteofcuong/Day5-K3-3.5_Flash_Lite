# VShare — AI Search Prototype

VShare là web app giúp học viên tìm học liệu trong kho tài liệu cộng đồng bằng
ngôn ngữ tự nhiên. AI chỉ đề xuất tài liệu có thật trong catalog, trả tối đa ba
kết quả kèm lý do, độ tin cậy và link mở file.

## Thông tin nhóm

| Mã học viên | Họ và tên | Phân công |
|---|---|---|
| 2A202601940 | Nguyễn Hoàng Việt | Phân tích nhu cầu; Product Canvas; golden set; evaluation; user validation; hoàn thiện `spec.md`; hỗ trợ Backend |
| 2A202601771 | Nguyễn Phú Cường | Phân tích nhu cầu; Product Canvas; UI/UX; Frontend; responsive UI; kết nối API |
| 2A202601841 | Nguyễn Quốc Hùng | Phân tích nhu cầu; Product Canvas; Backend và API; AI/RAG; xử lý PDF, tìm kiếm và lưu trữ |
| 2A202601141 | Mai Quốc Hiếu | Phân tích nhu cầu; Product Canvas; tổng hợp khảo sát; hỗ trợ Backend; slide, kịch bản và demo |
| Chưa cung cấp | Nguyễn Chí Công | Đề xuất ý tưởng sản phẩm và ý tưởng giao diện |

> Cần bổ sung mã học viên của Nguyễn Chí Công trước khi nộp.

## Vấn đề và giải pháp

Học liệu trong cộng đồng thường nằm rải rác, tên file không phản ánh đầy đủ nội
dung và tìm kiếm từ khóa dễ trả kết quả thiếu liên quan. VShare dùng AI Agent kết
hợp công cụ tìm kiếm catalog để hiểu nhu cầu, tìm tài liệu và giải thích vì sao
từng kết quả phù hợp. Backend kiểm tra grounding nên AI không được tự tạo ID,
tiêu đề hoặc link tài liệu.

## Tính năng chính

- Tìm học liệu bằng câu hỏi tự nhiên và lọc theo metadata.
- Trả tối đa tài liệu kèm lý do, confidence và link mở file.
- Hỏi lại khi yêu cầu chưa rõ; từ chối yêu cầu ngoài phạm vi hoặc không an toàn.
- Đăng ký, đăng nhập, tải lên, quản lý và đánh giá tài liệu.
- Phòng thảo luận; tóm tắt, chat với tài liệu và tạo flashcard bằng AI.
- Lưu trace các lượt gọi AI để kiểm tra và tái lập evaluation.

## Chạy prototype

Yêu cầu: Node.js và npm.

```powershell
cd codebase
npm.cmd install
Copy-Item .env.example .env
npm.cmd run seed
npm.cmd start
```

Trong `codebase/.env`, điền `JWT_SECRET` dài tối thiểu 32 ký tự và
`GEMINI_API_KEY`, sau đó mở `http://localhost:3000`.

Tài khoản demo:

- `viet@vshare.local` hoặc `admin@vshare.local`
- Mật khẩu: `VShare@2026`

Muốn chạy offline, đặt `ENABLE_MOCK_AI=true`. Chế độ mock chỉ kiểm tra luồng ứng
dụng, không được dùng làm kết quả evaluation chính thức.

## Kiến trúc và mức độ hoàn thiện

- Frontend: HTML, CSS và JavaScript ES modules trong `codebase/public/`.
- Backend: Express theo luồng `routes → services → repositories → store`.
- AI: Gemini chạy vòng lặp ReAct và gọi công cụ tìm kiếm tài liệu.
- Dữ liệu: JSON store sinh từ catalog, không yêu cầu database ngoài.
- Grounding: Backend loại kết quả không tồn tại trong catalog PDF thật.

Prototype ở mức **Working** với giao diện, API và tìm kiếm AI. Chế độ mock chỉ là
phương án dự phòng offline; evaluation chính thức sử dụng Gemini thật.

## Evaluation

Golden set gồm 20 case: 10 case thường, 8 case khó và 2 case hiếm. Mỗi case được
chấm theo relevance, grounding, explanation, uncertainty và safety.

| Chỉ số | Kết quả | Quality bar | Đánh giá |
|---|---:|---:|---|
| Overall | 18/20 = **90%** | ≥80% | Đạt |
| Grounding | 20/20 = **100%** | 100% | Đạt |
| Safety | 20/20 = **100%** | 100% | Đạt |

GS13 và GS14 chưa đạt vì truy vấn mơ hồ nhưng AI trả tài liệu thay vì hỏi lại.
Nhóm giữ nguyên các case fail để phản ánh trung thực hạn chế hiện tại.

- Quy tắc chấm: `eval/README.md`
- Golden set: `eval/golden-set.csv`
- Kết quả chính thức: `eval/run-gemini-2026-07-30T19-33-05-593Z.csv`
- Chạy lại: `cd codebase; npm.cmd run eval`

## Validation và trạng thái bài nộp

Kế hoạch user test nằm trong `validation/plan.md`. Repo hiện **chưa có feedback
thực tế từ 5 người ngoài nhóm**, vì vậy validation chưa hoàn tất.

| Deliverable | Trạng thái |
|---|---|
| AI Spec (`spec.md`) | Đã có |
| Prototype (`codebase/`) | Đã có |
| Golden set và kết quả (`eval/`) | Đã có |
| Kế hoạch validation (`validation/plan.md`) | Đã có |
| Feedback user test | Chưa thu thập |
| `demo-slides.pdf` | Chưa có |
| Reflection cá nhân (`reflection/`) | Chưa có |

## Kiểm thử

```powershell
cd codebase
npm.cmd test
```

Chi tiết API, cấu trúc source và lưu ý kiểm thử nằm trong `codebase/README.md`.

---

## Tài liệu hackathon

## Bắt đầu từ đâu?

1. Đọc **`01-de-bai.md`** để chọn hướng và hiểu tiêu chí.
2. Mở **`02-guide.md`** — hướng dẫn từng giai đoạn, đứng ở đâu đọc mục đó.
3. Viết spec theo **`03-template-ai-spec.md`** — deliverable trung tâm của cả sự kiện.
4. Đọc **`04-rubric.md`** ngay từ đầu — biết trước bài được chấm theo tiêu chí nào.

| File / thư mục | Nội dung |
|---|---|
| `01-de-bai.md` | Đề bài 3 hướng · 5 tiêu chí nghiệm thu · ràng buộc chung |
| `02-guide.md` | Hướng dẫn 5 giai đoạn: khám phá → spec → build → đo & validate → demo |
| `03-template-ai-spec.md` | Template AI Spec (nộp tại **hạn chốt spec** — xem Lịch) |
| `04-rubric.md` | Rubric 100 điểm (25 nộp checkpoint + 75 chấm bài) + checklist xác minh 6 mốc |
| `data/` | Dữ liệu thật đã ẩn danh: chatlog VLearn tutor + 6 transcript bài giảng + 2 bộ slide bản hackathon — dùng để tìm bằng chứng và xây golden set |
| `tham-khao/` | JTBD Playbook (PDF) + worksheet JTBD đầy đủ — đọc khi muốn đào sâu |

## Lịch — 6 mốc

| Mốc | Khoá 3 | Khoá 4 |
|---|---|---|
| Khai mạc + phát đề | 09:00 ngày 1 | 14:00 ngày 1 |
| CP1 · Chốt Canvas | 10:00 ngày 1 | 15:00 ngày 1 |
| CP2 · Show được thứ bấm được | 12:00 ngày 1 | 17:00 ngày 1 |
| CP3 · AI chạy thật + đo lượt đầu | 16:00 ngày 1 | 10:30 ngày 2 |
| CP4 · Chốt tiến độ | 17:30 ngày 1 | 12:00 ngày 2 |
| CP5 · Xác minh + validation + dry run | 09:00 ngày 2 | 14:00 ngày 2 |
| CP6 · Demo | 10:00 ngày 2 | 15:00 ngày 2 |

**Hạn chốt spec.md** (quality bar khoá từ thời điểm này, mỗi khoá theo lịch của mình): **Khoá 3 — 23:59 ngày 1** · **Khoá 4 — 12:00 ngày 2** (ngay tại CP4).

Mỗi mốc cần show gì và được xác minh thế nào: xem bảng trong `04-rubric.md`.

## Nộp bài

Một repo nhóm, cấu trúc như sau. Spec chốt tại hạn chốt spec của khoá mình (xem Lịch); bản hoàn chỉnh trước CP6.

```
repo/
├── README.md          ← thành viên (mã HV + tên) + phân công có tên từng phần
├── spec.md            ← AI Spec theo 03-template-ai-spec.md
├── demo-slides.pdf    ← slide 6 trang theo 02-guide.md §5.1
├── codebase/          ← prototype (ghi rõ phần nào mock)
├── eval/              ← golden set + bảng kết quả các lượt chạy
├── validation/        ← feedback log từ vòng user test
└── reflection/        ← mỗi người 1 file
```

## Chấm điểm

Tổng **100 điểm = 25 điểm nộp checkpoint + 75 điểm chấm bài nộp**. Chi tiết từng ý điểm: `04-rubric.md`.

**25 điểm nộp — mỗi checkpoint 5 điểm (CP1-CP5):** nộp đúng hạn → 5 điểm · nộp muộn → 0 điểm cho mốc đó. Mỗi thành viên nộp riêng, cả nhóm dùng chung một link repo.

**75 điểm chấm — trên artifact trong repo, mỗi con điểm trỏ về một file:**

| Khối | Điểm | Chấm trên file nào |
|---|---|---|
| R1 · Bằng chứng & impact | 15 | `spec.md` §1-§2 + log khảo sát/mining |
| R2 · Lát cắt & thiết kế | 15 | `spec.md` §4 |
| R3 · Chỗ khó & kịch bản rủi ro | 11 | `spec.md` §5-§6 |
| R4 · Kiểm thử | 15 | `spec.md` §7 + `eval/` |
| R5 · Prototype chạy được | 8 | `codebase/` + demo |
| R6 · Validation với user | 8 | `validation/` |
| R7 · Quy trình & repo | 3 | cấu trúc repo |

Ba điều nên biết trước khi làm:

- Điểm dựa trên **chuỗi quyết định và bằng chứng**, không dựa trên mức độ hoành tráng của sản phẩm.
- Kết quả đo **ghi nhận trung thực** — kể cả khi không đạt mục tiêu nhóm tự đặt — vẫn được tính đủ điểm. Số liệu bị chỉnh sửa hoặc che giấu sẽ không được tính.
- Reflection cá nhân chấm riêng theo rubric của khoá. Điểm vòng demo, chấm chéo trong zone và thưởng thêm (nếu có) theo thể lệ công bố lúc khai mạc.

## Luật chung

1. Prototype có 3 mức **Sketch / Mock / Working** — mức nào cũng bắt buộc **≥1 lời gọi AI chạy thật**.
2. **Vibe-coding rule:** dùng AI để build thoải mái, nhưng không giải thích được phần có tên mình thì phần đó 0 điểm (kiểm tra tại CP5).
3. **Quality bar** chốt tại hạn chốt spec của khoá mình (K3: 23:59 ngày 1 · K4: 12:00 ngày 2) và giữ nguyên sau đó.
4. Chỉ dùng dữ liệu trong `data/` hoặc dữ liệu giả tự sinh — không dùng dữ liệu thật của người thật. Không commit API key.
5. Tuân thủ **quy định bảo mật dữ liệu** bên dưới — đây là điều kiện để được cấp data.

## Bảo mật dữ liệu được cung cấp

Dữ liệu trong `data/` là dữ liệu thật của khoá học (đã ẩn danh), cấp riêng cho hackathon này. Khi nhận data, nhóm cam kết:

1. **Chỉ dùng trong phạm vi hackathon** — cho việc tìm bằng chứng, xây golden set và build prototype. Không dùng cho mục đích khác.
2. **Không chia sẻ ra ngoài khoá học** — không đăng lên mạng xã hội, không gửi cho người ngoài, không đưa vào bất kỳ dataset hay repo công khai nào.
3. **Không commit data pack vào repo nộp bài** — repo nhóm chỉ chứa trích dẫn ngắn để minh hoạ (vài dòng); golden set trích từ data ghi rõ mã đoạn/mã hội thoại thay vì dán nguyên văn dài.
4. **Cẩn trọng khi đưa data vào công cụ ngoài** — chỉ đưa phần tối thiểu cần cho việc đang làm; lưu ý API/công cụ free tier có thể dùng dữ liệu để huấn luyện (xem `02-guide.md` §3.4).
5. **Không cố suy ngược danh tính** từ dữ liệu đã ẩn danh ([học viên], mã U/C/T/M).
6. Sau sự kiện, **xoá các bản sao data pack** khỏi máy cá nhân và các công cụ đã upload nếu ban tổ chức yêu cầu.

Vi phạm được xử lý theo quy định của khoá và có thể ảnh hưởng trực tiếp đến điểm của nhóm.
