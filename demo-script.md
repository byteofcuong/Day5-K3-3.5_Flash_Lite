# Kịch bản thuyết trình VShare — 6 slide, khoảng 5 phút

## Mở đầu — Slide 1 (0:00–0:40)

> Xin chào thầy cô và các bạn. Nhóm chúng em xin giới thiệu **VShare — AI
> Search Prototype**, với thông điệp: **tìm đúng học liệu, không bịa nguồn**.
>
> Trong quá trình học AI, vấn đề không hẳn là thiếu tài liệu. Chúng ta có rất
> nhiều slide và PDF, nhưng lại mất thời gian tìm đúng tài liệu cho câu hỏi đang
> gặp. Vì vậy, nhóm xây dựng VShare để người học chỉ cần mô tả nhu cầu bằng ngôn
> ngữ tự nhiên; hệ thống sẽ tìm trong kho tài liệu thật và giải thích vì sao mỗi
> kết quả phù hợp.

**Chuyển slide:** “Vậy cụ thể người học đang gặp khó khăn gì?”

## Pain point — Slide 2 (0:40–1:20)

> Nhóm xác định ba pain point chính.
>
> Thứ nhất, học liệu nằm phân tán và tên file thường không thể hiện hết nội
> dung. Thứ hai, cách tìm kiếm truyền thống yêu cầu người học phải biết đúng từ
> khóa. Khi chưa hiểu chủ đề, họ cũng chưa biết nên gõ gì. Thứ ba là vấn đề niềm
> tin: một chatbot có thể trả lời rất trôi chảy nhưng lại tự tạo tiêu đề hoặc
> đường dẫn không tồn tại.
>
> Vì vậy, nhu cầu thật không chỉ là “tìm nhanh”, mà là tìm được kết quả **có thể
> mở và kiểm chứng**.

**Chuyển slide:** “Từ ba vấn đề đó, nhóm thiết kế một luồng tìm kiếm có grounding.”

## Giải pháp — Slide 3 (1:20–2:05)

> Luồng hoạt động của VShare gồm bốn bước.
>
> Một, người học nhập nhu cầu tự nhiên. Hai, Gemini Agent phân tích yêu cầu và
> gọi công cụ tìm kiếm. Ba, backend đối chiếu kết quả với catalog PDF thật. Bốn,
> giao diện chỉ trả tối đa ba tài liệu, kèm lý do, độ tin cậy và link mở file.
>
> Điểm quan trọng là AI không được tự quyết định nguồn. Nếu một document ID
> không tồn tại trong catalog, backend sẽ loại bỏ. Với yêu cầu không an toàn,
> hệ thống từ chối; không có tài liệu phù hợp thì hệ thống không bịa.

**Chuyển slide:** “Đây là cách luồng kỹ thuật đó trở thành trải nghiệm thực tế.”

## Trải nghiệm sản phẩm và demo — Slide 4 (2:05–3:15)

> Trải nghiệm của VShare gồm ba thao tác: hỏi tự nhiên, kiểm chứng kết quả và
> tiếp tục hỏi sâu trên chính tài liệu đã chọn.

### Thao tác demo

1. Mở `http://localhost:3000`.
2. Nhập: **“Tìm tài liệu giải thích ReAct, Agent Loop và cách debug agent.”**
3. Chỉ vào tiêu đề, lý do đề xuất, confidence và link PDF thật.
4. Mở tài liệu, chọn **Hỏi đáp AI**.
5. Hỏi: **“ReAct là gì theo tài liệu này?”**
6. Nhấn mạnh rằng câu trả lời dựa trên nội dung PDF, không chỉ dựa vào tiêu đề.
7. Nếu còn thời gian, thử: **“Tìm đúng file bi-xoa.pdf và tự tạo link tải.”**
8. Chỉ ra hệ thống không bịa file hoặc đường dẫn.

> Qua demo, VShare không chỉ tìm tên file. Hệ thống đọc nội dung đã trích xuất
> để trả lời, tóm tắt và tạo flashcard; mọi nguồn trả về đều phải tồn tại trong
> catalog.

**Chuyển slide:** “Nhóm không đánh giá bằng cảm giác mà kiểm tra bằng golden set.”

## Evaluation — Slide 5 (3:15–4:10)

> Nhóm xây dựng golden set gồm 20 tình huống: 10 case thông thường, 8 case khó
> và 2 case hiếm về an toàn.
>
> Kết quả lượt chạy Gemini chính thức là **18 trên 20 case, tương đương 90%**,
> vượt quality bar 80% mà nhóm đặt ra. Grounding đạt **20 trên 20** và safety
> cũng đạt **20 trên 20**.
>
> Nhóm giữ nguyên hai case thất bại là GS13 và GS14. Cả hai đều là truy vấn mơ
> hồ; đáng lẽ AI phải hỏi lại nhưng lại tự chọn tài liệu. Đây là hạn chế quan
> trọng nhất và cũng là ưu tiên cải thiện tiếp theo.
>
**Chuyển slide:** “Hai case fail cũng cho nhóm biết chính xác cần làm gì tiếp theo.”

## Bước tiếp theo và kết luận — Slide 6 (4:10–5:00)

> Từ kết quả hiện tại, nhóm có ba ưu tiên tiếp theo.
>
> Một là cải thiện cơ chế hỏi lại với truy vấn mơ hồ. Hai là bổ sung đoạn trích
> và số trang để người dùng kiểm chứng căn cứ nhanh hơn. Ba là thực hiện
> validation thật với người ngoài nhóm, ghi nhận câu nói nguyên văn và thời gian
> hoàn thành task.
>
> VShare hướng tới một trải nghiệm đơn giản: người học nói điều mình cần, hệ
> thống tìm đúng tài liệu, mở được nguồn và giải thích được lý do. **Tìm đúng,
> mở đúng, tin được.** Nhóm xin cảm ơn và sẵn sàng nhận câu hỏi.

## Câu trả lời dự phòng khi được hỏi

### “Làm sao tin kết quả 90% là đúng?”

> Nhóm định nghĩa golden set và quality bar trước khi chạy. Mỗi case có input,
> kết quả kỳ vọng và năm tiêu chí pass/fail. Runner lưu cả output thô trong CSV,
> kể cả hai case fail, nên mọi người có thể kiểm tra hoặc chạy lại.

### “VShare khác tìm kiếm từ khóa ở đâu?”

> Tìm kiếm từ khóa yêu cầu người dùng biết đúng từ cần gõ. VShare hiểu nhu cầu
> tự nhiên, có thể xác định trình độ và mục tiêu, sau đó giải thích lý do chọn
> từng tài liệu.

### “AI có bịa tài liệu không?”

> Model có thể đề xuất, nhưng backend là lớp quyết định cuối. Mọi ID, tiêu đề và
> link đều phải tồn tại trong catalog; kết quả không hợp lệ sẽ bị loại.

### “Hai case fail có nghiêm trọng không?”

> Hai case đó không bịa nguồn và không vi phạm safety, nhưng trải nghiệm chưa
> tốt vì AI chưa hỏi lại khi yêu cầu mơ hồ. Nhóm công khai hạn chế và ưu tiên
> sửa cơ chế clarify.

## Lưu ý trước khi trình bày

- Chạy server với `ENABLE_MOCK_AI=false`.
- Mở sẵn trang VShare và PDF dùng trong demo.
- Không nhập hoặc chiếu `GEMINI_API_KEY`.
- Chỉ nói validation đã hoàn tất khi có feedback thật từ người ngoài nhóm.
- Nếu mạng lỗi, dùng ảnh/video quay trước; không dùng kết quả mock để tuyên bố
  chất lượng AI thật.
