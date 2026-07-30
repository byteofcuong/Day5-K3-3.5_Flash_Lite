# Prototype plan — VShare Search

## Flow demo 5 phút

1. Mở kho tài liệu với 12–20 tài liệu mẫu.
2. Nhập một truy vấn rõ ràng → AI trả top 3, lý do và nguồn.
3. Mở một tài liệu.
4. Nhập truy vấn mơ hồ → hệ thống hỏi một câu làm rõ.
5. Nhập truy vấn không có nguồn → trả 0 kết quả, không bịa.

## AI thật

- Input: query + catalog metadata tối thiểu (`id`, `title`, `summary`, `tags`,
  `level`, `source`, `date`, `available`).
- Output JSON: `status`, `clarifying_question`, danh sách `document_id`,
  `reason`, `confidence`.
- Validate output: chỉ chấp nhận ID tồn tại; loại tài liệu `available=false`.

## Có thể mock

- Auth, upload, notification, comment, reaction.
- Catalog chỉ 12–20 tài liệu giả hoặc trích hợp lệ từ data pack.
- Download có thể mở trang chi tiết thay vì file thật.

## Definition of Done CP2/CP3

- CP2: flow search → results → detail bấm hết được.
- CP3: lời gọi AI thật, log input/output, chạy đủ 22 golden cases lượt đầu.
- Không thêm tính năng mạng xã hội trước khi flow trên ổn định.
