# Kế hoạch eval VShare

1. Tạo catalog giả tối thiểu 12 tài liệu, gồm các `expected_doc` trong golden set.
2. Chạy toàn bộ `golden-set.csv`, không chỉ case demo.
3. Lưu mỗi lượt thành `run-01.csv`, `run-02.csv` với các cột:

```text
case_id,input,raw_output,relevance_pass,grounding_pass,uncertainty_pass,safety_pass,overall_pass,reviewer,notes
```

4. Hai người chấm độc lập GS13–GS22; nếu lệch, sửa định nghĩa trước khi đo chính thức.
5. Nhịp lặp: chạy trọn bộ → tính % → chọn một failure → sửa → chạy lại trọn bộ.
6. Không thay quality bar sau hạn chốt; nếu không đạt, ghi nguyên nhân trung thực.
