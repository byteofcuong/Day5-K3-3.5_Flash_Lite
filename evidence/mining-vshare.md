# Evidence mining — VShare

## Câu hỏi nghiên cứu

Trong chatlog VLearn, học viên có thường xuyên cần tìm, đánh giá, tóm tắt hoặc
hiểu học liệu không? Đây là tín hiệu gián tiếp để xem xét VShare, không phải bằng
chứng trực tiếp rằng học viên khó tìm tài liệu trong một cộng đồng.

## Nguồn và phạm vi

- File: `data/vlearn-pack/chatlog/chat_history_anonymized_for_hackathon.csv`
- Thời gian dữ liệu: 22–29/07/2026.
- 1.261 lượt hỏi của học viên, 369 user, 585 hội thoại.
- Chỉ phân tích dòng `role=student`; rating lấy từ dòng tutor cùng `turn_id`.

## Phương pháp đếm

Đối chiếu không phân biệt hoa/thường theo bốn nhóm từ khóa:

| Nhóm | Quy tắc |
|---|---|
| Tóm tắt | `tóm tắt`, `tổng hợp`, `ý chính`, `nội dung chính` |
| Tìm/vị trí | `ở đâu`, `trang nào`, `đoạn nào`, `phần nào`, `tìm`, `link`, `đường dẫn` |
| Nhắc học liệu | `tài liệu`, `slide`, `file`, `video`, `bài giảng`, `transcript` |
| Giải thích/hiểu | `giải thích`, `hiểu`, `là gì`, `ví dụ`, `phân biệt` |

Một lượt có thể thuộc nhiều nhóm, vì vậy không cộng các nhóm thành tổng.

## Kết quả

| Tín hiệu | Lượt | % trên 1.261 | User duy nhất | Hội thoại |
|---|---:|---:|---:|---:|
| Nhắc trực tiếp học liệu | 231 | 18,3% | 159 | 184 |
| Yêu cầu tóm tắt/ý chính | 141 | 11,2% | 98 | 121 |
| Tìm/vị trí | 33 | 2,6% | 26 | 30 |
| Giải thích/hiểu | 596 | 47,3% | 240 | 335 |

Trong nhóm “nhắc học liệu”, 20 lượt có rating và 15/20 là `down`. Rating rất
thưa nên con số này chỉ là tín hiệu cần điều tra, không đại diện toàn bộ 231 lượt.

## Ví dụ nguyên văn ngắn

| Nguồn | Ví dụ |
|---|---|
| C0001/T0649 | “tóm tắt nội dung chính trong slide này” |
| C0014/T0909 | “đưa file tài liệu đây để tải” |
| C0015/T0541 | “viết summary chi tiết và đầy đủ nhất về toàn bộ slide bài giảng” |
| C0018/T0699 | “tóm tắt toàn bộ slide sau đó đưa ra các ý chính” |
| C0029/T0524 | “bạn đọc được nội dung slide ko, giải thích cho mình slide 44” |
| C0031/T0408 | “tóm tắt các chủ đề chính của slide ... này” |
| C0040/T0857 | “viết từ slides thành bài đọc dễ tiếp thu” |
| C0057/T0415 | “tóm tắt nội dung, đưa ra keyword cần nhớ” |

## Diễn giải trung thực

Dữ liệu chứng minh học viên thường xuyên cần thao tác với học liệu và muốn biết
ý chính trước khi đọc sâu. Dữ liệu **không ghi lại** hành vi tìm tài liệu trên
Discord/Drive, thời gian tìm, hay mức độ tài liệu bị trôi. Vì vậy:

- Có thể dùng mining này làm bằng chứng ban đầu cho nhu cầu “đánh giá nhanh tài liệu”.
- Quyết định cuối giữa tìm kiếm ngữ nghĩa và tóm tắt phải cập nhật sau khảo sát.
