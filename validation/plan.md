# Kế hoạch validation

## Trước CP1

- Thu ≥20 khảo sát bằng `evidence/survey.md`.
- Lấy ≥3 tên đồng ý thử prototype.

## CP5 — ít nhất 5 người ngoài nhóm

Task: “Bạn đang làm bài về [chủ đề]. Hãy dùng VShare để tìm một tài liệu giúp
bạn tiếp tục làm bài.”

Không hướng dẫn trong lúc họ thao tác. Ghi:

| Người thử/tên | Vai | Willing user? | Task | Quan sát | Quote nguyên văn | Mức nghiêm trọng |
|---|---|---|---|---|---|---|
| Huyền | Học viên AI thực chiến | Có | Tìm tài liệu nhập môn về AI | Nhập câu hỏi tự nhiên ngay, xem kết quả đầu tiên và mở được PDF. Thích phần lý do đề xuất nhưng chưa hiểu confidence được tính thế nào. | “Tìm nhanh hơn dò từng thư mục, nhưng nếu giải thích confidence thì tôi sẽ tin hơn.” | Trung bình |
| Yến | Học viên AI thực chiến | Có điều kiện | Tìm slide về JTBD để tham khảo | Tìm được tài liệu liên quan nhưng muốn nhìn thấy số trang hoặc đoạn trích trước khi mở cả PDF. | “Kết quả có vẻ đúng, nhưng tôi vẫn phải mở từng file mới biết đoạn nào dùng được.” | Cao |
| Trung | Học viên AI thực chiến | Có | Tìm tài liệu về cách đánh giá AI agent | Thử câu hỏi rõ ràng, kiểm tra title và link. Đánh giá cao việc hệ thống chỉ trả file có trong catalog. | “Tôi thích việc hệ thống không bịa link; lý do đề xuất ngắn và đủ để tôi chọn file.” | Thấp |
| Trường | Học viên AI thực chiến | Chưa | Nhập “Tài liệu AI nào cũng được” | Hệ thống đưa kết quả ngay thay vì hỏi mục tiêu hoặc trình độ. Người dùng thấy danh sách quá rộng và không biết chọn gì. | “Tôi chưa biết mình cần loại nào mà hệ thống lại bắt tôi tự chọn giữa các kết quả.” | Cao |
| Tân | Học viên AI thực chiến | Có điều kiện | Tìm đồng thời tài liệu nhập môn và chuyên sâu | Truy vấn có hai mục tiêu nhưng hệ thống không hỏi ưu tiên. Kết quả có liên quan song thứ tự chưa phù hợp với lộ trình học. | “Tôi muốn hệ thống hỏi tôi học phần cơ bản trước hay cần tài liệu chuyên sâu ngay.” | Cao |

Hỏi đúng ba câu:

1. Điều gì khó hiểu hoặc khó chịu nhất?
2. Bạn có tin kết quả này không, vì sao?
3. Bạn có dùng thật không, vì sao hoặc vì sao chưa?

### Câu trả lời sau khi hỏi

Các ô dưới đây là phần tóm tắt từ ghi chú validation, không phải quote nguyên
văn bổ sung. Quote nguyên văn duy nhất vẫn nằm trong bảng quan sát phía trên.

| Người thử | Điều khó hiểu/khó chịu nhất | Có tin kết quả không, vì sao? | Có dùng thật không, vì sao/chưa? |
|---|---|---|---|
| Huyền | Chưa hiểu confidence được tính như thế nào. | Tin một phần vì có lý do đề xuất và mở được PDF thật, nhưng cần giải thích confidence rõ hơn. | Có, nếu hệ thống giải thích ngắn gọn cơ sở của confidence. |
| Yến | Phải mở từng PDF vì kết quả chưa có số trang hoặc đoạn trích liên quan. | Tin một phần vì tài liệu đúng chủ đề, nhưng chưa đủ thông tin để đánh giá trước khi mở. | Có điều kiện; sẽ dùng thường xuyên hơn nếu có preview đoạn liên quan. |
| Trung | Không gặp trở ngại đáng kể trong task đã thử. | Có; title, link và lý do đề xuất đều kiểm tra được, hệ thống không tạo link giả. | Có, vì tìm nhanh và kết quả có nguồn để tự kiểm chứng. |
| Trường | Query mơ hồ nhưng hệ thống trả danh sách ngay, khiến người dùng vẫn phải tự đoán nên chọn gì. | Chưa tin vào thứ tự kết quả vì hệ thống chưa biết mục tiêu và trình độ của người hỏi. | Chưa; chỉ dùng nếu hệ thống hỏi lại trước khi tìm với yêu cầu quá rộng. |
| Tân | Kết quả chưa thể hiện được nên học tài liệu nhập môn hay chuyên sâu trước. | Tin tài liệu có liên quan nhưng chưa tin thứ tự gợi ý phù hợp với lộ trình. | Có điều kiện; cần hệ thống hỏi ưu tiên hoặc trình độ hiện tại trước. |

### Pattern lặp

1. **Cần thêm căn cứ để quyết định trước khi mở:** Huyền và Yến đều tin kết quả
   hơn khi có giải thích, nhưng confidence chưa rõ và chưa có trang/đoạn trích.
2. **Query mơ hồ cần được hỏi lại:** Trường và Tân đều gặp khó khi yêu cầu quá
   rộng hoặc chứa hai mục tiêu; trả kết quả ngay làm họ phải tự thu hẹp nhu cầu.
3. **Grounding tạo niềm tin:** Trung và Huyền đánh giá tích cực việc có lý do,
   title/link thật và khả năng mở PDF để tự kiểm chứng.

### Hai thay đổi được chọn

1. Với query thiếu chủ đề/trình độ hoặc có mục tiêu xung đột, hệ thống phải trả
   `clarify`, hỏi đúng một câu và chưa hiển thị tài liệu.
2. Mỗi kết quả cần hiển thị căn cứ dễ hiểu hơn: lý do đề xuất, nguồn/link thật
   và ưu tiên bổ sung số trang hoặc đoạn trích liên quan; không chỉ hiển thị một
   con số confidence thiếu giải thích.

