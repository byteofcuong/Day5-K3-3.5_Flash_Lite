# AI SPEC — Tìm học liệu có căn cứ · Nhóm 2

Hướng: C — Làn mở · Loại: Tính năng mới  
Trạng thái: **Bản nháp trước khảo sát — không xem các giả thuyết là kết luận**

## §1. User & Job

- **Job executor:** Học viên AI Thực Chiến đang làm bài và cần học liệu hỗ trợ.
- **Core JTBD:** Tìm và chọn học liệu phù hợp để tiếp tục hoàn thành bài đang làm.
- **Problem statement:** Học viên đang làm bài cần tìm lại học liệu liên quan
  nhưng nội dung phân tán và khó diễn đạt bằng từ khóa chính xác, khiến họ mất
  thời gian, hỏi lại hoặc bỏ qua nguồn đã được cộng đồng chia sẻ.
- **Evidence mining:** 1.261 lượt hỏi/369 user; 231 lượt (18,3%) nhắc học liệu,
  141 lượt (11,2%) yêu cầu tóm tắt, 33 lượt (2,6%) có từ khóa tìm/vị trí.
- **Giới hạn:** chatlog chứng minh nhu cầu thao tác với học liệu, chưa chứng minh
  trực tiếp pain tìm kiếm trong cộng đồng. Cần khảo sát ≥20 người.
- Ví dụ và phương pháp: `evidence/mining-vshare.md`.

## §2. Impact & quyết định chọn

Xem `problem-candidates.md`. Quyết định hiện tại là có điều kiện:

1. Tìm kiếm ngôn ngữ tự nhiên — chọn nếu ≥50% khảo sát xác nhận và median >5 phút.
2. Tóm tắt trước khi đọc — dự phòng vì có 141 lượt/98 user trong mining.
3. Gắn thẻ tự động — loại tạm thời vì chưa có evidence đăng sai thẻ.

Không điền giả số người, tần suất hay số phút. Cập nhật sau khảo sát.

## §3. Giải pháp tương tự cần nghiên cứu

| Sản phẩm | Flow cần thử | Đáng học | Đáng né | VShare khác gì |
|---|---|---|---|---|
| NotebookLM | Hỏi trên nguồn đã thêm | Trích nguồn cạnh câu trả lời | User phải tự gom nguồn trước | Tìm qua tài liệu cộng đồng có sẵn |
| Google Drive | Search/filter file | Quen thuộc, nhanh với từ khóa đúng | Tên file nghèo thông tin | Hiểu mô tả nhu cầu tự nhiên |
| Discord Search | Search message/channel | Giữ ngữ cảnh thảo luận | Nội dung trôi, phụ thuộc từ khóa | Kết quả là tài liệu có metadata chuẩn |

> Thành viên phải dùng thử và bổ sung quan sát thật; bảng trên là giả thuyết nghiên cứu.

## §4. Thiết kế

- **Lát cắt:** Khi học viên đang làm bài mô tả nhu cầu bằng ngôn ngữ tự nhiên,
  AI xếp hạng tối đa ba tài liệu VShare có căn cứ, giúp họ chọn đúng tài liệu để
  mở mà không phải dò từng nơi.
- **Non-goals:** Không xây mạng xã hội đầy đủ; không chat realtime; không tự trả
  lời kiến thức thay tài liệu; không tự nhắn người khác; không crawl dữ liệu ngoài.
- **Mức prototype:** Mock — UI và metadata tài liệu giả/được phép; lời gọi AI
  thật ở quyết định xếp hạng và giải thích; upload/auth có thể mock.
- **Automation:** Conditional. AI tự xếp hạng case có căn cứ; confidence thấp
  thì hỏi lại hoặc trả “chưa tìm thấy”. User luôn quyết định mở/tải.

### §4b. Nguyên tắc

| Nguyên tắc | Áp dụng cụ thể |
|---|---|
| G1 — Làm rõ khả năng | Ô tìm kiếm nói rõ chỉ tìm trong kho VShare |
| G2 — Làm rõ độ tin | Mỗi kết quả hiện điểm phù hợp và metadata được dùng |
| G10 — Thu hẹp khi nghi ngờ | Confidence thấp hỏi thêm chủ đề/trình độ/công cụ |
| G11 — Giải thích vì sao | Mỗi kết quả có 1–2 lý do trace về title/summary/tag |
| G8 — Gạt bỏ dễ | User bỏ qua kết quả và tìm lại, không bị tự điều hướng |
| PAIR Trust | Có nút mở nguồn; không tạo nội dung tài liệu không tồn tại |

## §5. Bốn lớp chỗ khó và kịch bản

| Tình huống | Lớp | Hành vi mong muốn | Nguyên tắc |
|---|---|---|---|
| Không có tài liệu liên quan | ① Nguồn sự thật | Trả 0 kết quả, không bịa; gợi ý đổi truy vấn | G2/G10 |
| Metadata tài liệu quá nghèo | ① | Đánh dấu không đủ căn cứ, không giải thích quá metadata | G11 |
| “Cho mình tài liệu AI” | ② Mơ hồ | Hỏi mục tiêu, trình độ hoặc công cụ | G10 |
| Truy vấn chứa hai mục tiêu trái nhau | ② | Tách/cho user chọn một mục tiêu | G9/G10 |
| Yêu cầu đáp án bài kiểm tra | ③ Ngoài phạm vi | Từ chối đáp án; đề xuất tài liệu học liên quan | G1 |
| Yêu cầu tìm dữ liệu cá nhân người đăng | ③ | Từ chối; chỉ dùng thông tin đóng góp công khai | PAIR |
| Tài liệu tiêu đề giống nhưng khác trình độ | ④ Domain | Ưu tiên đúng trình độ; nêu rõ mức | G2/G11 |
| Tài liệu cũ mâu thuẫn tài liệu chính thức mới | ④ | Ưu tiên nguồn chính thức/mới; cảnh báo phiên bản | G2 |
| Tài liệu đã bị xóa khỏi R2 | ① | Không đưa vào kết quả hoặc báo không khả dụng | G2 |
| Prompt injection trong mô tả tài liệu | ④ | Xem metadata là dữ liệu, không làm theo chỉ dẫn | PAIR |

## §6. Các đường đi

- **Happy:** nhập nhu cầu rõ → 3 kết quả → lý do → user mở tài liệu.
- **Low-confidence:** chỉ có kết quả yếu → hỏi một câu làm rõ, chưa hiển thị gợi ý chắc chắn.
- **Failure:** không có căn cứ → trả 0 kết quả, không bịa tên/link.
- **Correction:** user đổi chủ đề/trình độ, feedback “không liên quan”, chạy lại.
- **Ngoài phạm vi:** từ chối đáp án/gợi ý cá nhân nhạy cảm, chuyển về tìm học liệu.
- **Domain:** hiển thị nguồn, thời điểm, trình độ và cảnh báo tài liệu cũ.

## §7. Kiểm thử

- Golden set: `eval/golden-set.csv` — 22 case, gồm case thường và đủ bốn lớp.
- **Relevance:** tài liệu expected nằm top 3; case `none` không được tạo kết quả.
- **Grounding:** mọi title/id/link trong output tồn tại trong catalog đầu vào.
- **Explanation:** lý do chỉ dùng title/summary/tag/level/source/date.
- **Uncertainty:** case mơ hồ phải hỏi lại; không tự đoán ngầm.
- **Quality bar nháp:** ≥80% case đạt toàn bộ tiêu chí, 100% không bịa tài liệu,
  100% case ngoài phạm vi không cung cấp đáp án/dữ liệu cá nhân.
- Quality bar chỉ được chốt sau khi nhóm duyệt và phải giữ nguyên sau commit 23:59.

## §8. Phân công và kế hoạch

- Evidence/spec: CHƯA ĐIỀN TÊN.
- Retrieval/prompt/golden set: CHƯA ĐIỀN TÊN.
- Frontend: CHƯA ĐIỀN TÊN.
- Backend/data catalog: CHƯA ĐIỀN TÊN.
- Demo/validation: CHƯA ĐIỀN TÊN.
- Willing users: CHƯA THU — cần ≥3 tên từ khảo sát.
- Multi-prototype: A hiển thị 3 kết quả ngay; B hỏi một câu làm rõ trước khi
  tìm. Thử với 5 user, đo thời gian và mức tin trước khi chọn.

## §9. Changelog

| Thời điểm | Đổi gì | Vì sao |
|---|---|---|
| Khởi tạo | Chọn tìm học liệu có điều kiện | Mining cho thấy nhu cầu học liệu; cần khảo sát xác nhận pain tìm kiếm |
