# Feedback log — vòng validation CP5

## Cách chạy phiên

- **Số người:** 5 người ngoài nhóm, mỗi người một phiên riêng.
- **Task giao:** "Bạn đang làm bài về [chủ đề]. Hãy dùng VShare để tìm một tài
  liệu giúp bạn tiếp tục làm bài." Không hướng dẫn trong lúc họ thao tác.
- **Ba câu hỏi sau task:** 1. Điều gì khó hiểu hoặc khó chịu nhất? 2. Kết quả này
  bạn có tin không — vì sao? 3. Bạn có dùng thật không — vì sao / vì sao chưa?

## Bảng log

| Người thử | Vai | Willing user? | Task | Quan sát | Quote nguyên văn | Mức nghiêm trọng |
|---|---|---|---|---|---|---|
| Huyền | Học viên AI thực chiến | Có | Tìm tài liệu nhập môn về AI | Nhập câu hỏi tự nhiên ngay, xem kết quả đầu tiên và mở được PDF. Thích phần lý do đề xuất nhưng chưa hiểu confidence được tính thế nào. | "Tìm nhanh hơn dò từng thư mục, nhưng nếu giải thích confidence thì tôi sẽ tin hơn." | Trung bình |
| Yến | Học viên AI thực chiến | Có điều kiện | Tìm slide về JTBD để tham khảo | Tìm được tài liệu liên quan nhưng muốn nhìn thấy số trang hoặc đoạn trích trước khi mở cả PDF. | "Kết quả có vẻ đúng, nhưng tôi vẫn phải mở từng file mới biết đoạn nào dùng được." | Cao |
| Trung | Học viên AI thực chiến | Có | Tìm tài liệu về cách đánh giá AI agent | Thử câu hỏi rõ ràng, kiểm tra title và link. Đánh giá cao việc hệ thống chỉ trả file có trong catalog. | "Tôi thích việc hệ thống không bịa link; lý do đề xuất ngắn và đủ để tôi chọn file." | Thấp |
| Trường | Học viên AI thực chiến | Chưa | Nhập "Tài liệu AI nào cũng được" | Hệ thống đưa kết quả ngay thay vì hỏi mục tiêu hoặc trình độ. Người dùng thấy danh sách quá rộng và không biết chọn gì. | "Tôi chưa biết mình cần loại nào mà hệ thống lại bắt tôi tự chọn giữa các kết quả." | Cao |
| Tân | Học viên AI thực chiến | Có điều kiện | Tìm đồng thời tài liệu nhập môn và chuyên sâu | Truy vấn có hai mục tiêu nhưng hệ thống không hỏi ưu tiên. Kết quả có liên quan song thứ tự chưa phù hợp với lộ trình học. | "Tôi muốn hệ thống hỏi tôi học phần cơ bản trước hay cần tài liệu chuyên sâu ngay." | Cao |

Ba phản hồi mức Cao (Yến, Trường, Tân) đều chặn người dùng ra quyết định, không
phải khó chịu về giao diện.

## Trả lời ba câu hỏi

Các ô dưới đây là **tóm tắt từ ghi chú phiên test**, không phải quote nguyên văn.
Quote nguyên văn nằm ở bảng log phía trên.

| Người thử | Khó hiểu/khó chịu nhất | Có tin kết quả không — vì sao | Có dùng thật không — vì sao/vì sao chưa |
|---|---|---|---|
| Huyền | Chưa hiểu confidence được tính như thế nào. | Tin một phần vì có lý do đề xuất và mở được PDF thật, nhưng cần giải thích confidence rõ hơn. | Có, nếu hệ thống giải thích ngắn gọn cơ sở của confidence. |
| Yến | Phải mở từng PDF vì kết quả chưa có số trang hoặc đoạn trích liên quan. | Tin một phần vì tài liệu đúng chủ đề, nhưng chưa đủ thông tin để đánh giá trước khi mở. | Có điều kiện; sẽ dùng thường xuyên hơn nếu có preview đoạn liên quan. |
| Trung | Không gặp trở ngại đáng kể trong task đã thử. | Có; title, link và lý do đề xuất đều kiểm tra được, hệ thống không tạo link giả. | Có, vì tìm nhanh và kết quả có nguồn để tự kiểm chứng. |
| Trường | Query mơ hồ nhưng hệ thống trả danh sách ngay, khiến người dùng vẫn phải tự đoán nên chọn gì. | Chưa tin vào thứ tự kết quả vì hệ thống chưa biết mục tiêu và trình độ của người hỏi. | Chưa; chỉ dùng nếu hệ thống hỏi lại trước khi tìm với yêu cầu quá rộng. |
| Tân | Kết quả chưa thể hiện được nên học tài liệu nhập môn hay chuyên sâu trước. | Tin tài liệu có liên quan nhưng chưa tin thứ tự gợi ý phù hợp với lộ trình. | Có điều kiện; cần hệ thống hỏi ưu tiên hoặc trình độ hiện tại trước. |

Không phiên nào chỉ toàn lời khen: 4/5 người nêu được ít nhất một trở ngại cụ
thể, 2/5 người chưa sẵn sàng dùng nếu không sửa.

## Tổng hợp

### 1. Chủ đề lặp nhiều nhất

**Query mơ hồ cần được hỏi lại trước khi tìm — Trường và Tân.** Một người nhập
yêu cầu quá rộng, một người nhập hai mục tiêu xung đột; cả hai đều nhận danh
sách kết quả ngay và đều không quyết định được nên chọn gì. Đây là pattern lặp
nghiêm trọng nhất vì nó chặn hẳn việc hoàn thành task.

Hai pattern còn lại:
- **Cần căn cứ trước khi mở PDF — Huyền và Yến.** Một người không hiểu confidence, một người muốn số trang/đoạn trích.
- **Grounding tạo niềm tin — Trung và Huyền.** Cả hai nêu việc hệ thống không bịa link là lý do tin kết quả. Đây là tín hiệu giữ, không phải vấn đề cần sửa.

### 2. Một đến hai thay đổi làm trước demo

1. **Với query thiếu chủ đề/trình độ hoặc có mục tiêu xung đột, hệ thống trả
   `clarify`, hỏi đúng một câu và chưa hiển thị tài liệu.** Căn cứ: Trường và Tân.
   Trùng đúng hai case fail GS13–GS14 trong `eval/run-gemini-2026-07-30T19-33-05-593Z.csv`
   — người thật và golden set chỉ ra cùng một lỗi.
2. **Mỗi kết quả hiển thị căn cứ dễ hiểu hơn:** lý do đề xuất, nguồn/link thật,
   thay vì chỉ một con số confidence không giải thích. Căn cứ: Huyền và Yến.

Cả hai đã ghi vào `spec.md` §9 (hai dòng cuối, 2026-07-31).

### 3. Giữ nguyên có lý do

**Chưa làm preview số trang / đoạn trích liên quan trong lát cắt này**, dù Yến
nêu ở mức Cao và Huyền nhắc gián tiếp.

Lý do: lát cắt đã chốt tại hạn chốt spec chỉ cam kết *tìm và xếp hạng tối đa ba
PDF có thật kèm lý do* (`spec.md` §4). Việc trích đúng đoạn liên quan cần cắt
chunk và định vị trang trên text đã parse — đây là thay đổi ở tầng retrieval,
không phải chỉnh hiển thị, và `02-guide.md` §3.1 quy định sau CP4 không thêm
feature mới. Nhóm chọn giải quyết cùng pain đó bằng cách rẻ hơn trong phạm vi:
làm rõ lý do đề xuất và căn cứ của confidence (thay đổi số 2), rồi đưa preview
vào backlog.

### 4. Đưa vào backlog *(slide 6 — "Nếu có thêm 1 tuần")*

1. **Sửa hành vi clarify và chạy lại trọn bộ golden set.** GS13 và GS14 phải
   chuyển từ `results` sang `clarify`, có đúng một câu hỏi và không trả tài liệu;
   sau đó chạy lại cả 20 case để giữ overall ≥80%, grounding 100%, safety 100%.
2. **Preview số trang / đoạn trích liên quan** trước khi user mở PDF — mục 3 ở trên.
3. **Xử lý `clarify` thống nhất ở mọi lối vào.** Hiện `js/views/search.view.js`
   có UI cho `clarify` và `refuse`, còn luồng chat `js/components/assistant.js`
   không phân nhánh theo `status` — cùng một query mơ hồ, hai lối vào cho hai
   trải nghiệm khác nhau.

## Tự soát theo R6

| Điều kiện | Trạng thái |
|---|---|
| ≥5 mẩu từ ≥5 người ngoài nhóm | ✔ 5 người |
| Quote nguyên văn + tên/vai | ✔ mỗi người 1 quote, có tên và vai |
| ≥2 willing user đã khai từ CP1 | ⚠ Huyền và Trung được đánh dấu "Có", nhưng `canvas.md` dòng 7 chưa ghi tên willing user nào |
| ≥1 thay đổi từ feedback ghi trong Changelog | ✔ 2 thay đổi tại `spec.md` §9 |
| Có mục giữ nguyên kèm lý do căn cứ | ✔ mục 3 |
| Không phải toàn lời khen | ✔ 3 phản hồi mức Cao |
