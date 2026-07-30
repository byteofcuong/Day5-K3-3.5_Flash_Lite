# Plan mở rộng AI Agent Tools cho VShare

## 1. Mục tiêu

Hiện tại AI agent của VShare chủ yếu làm nhiệm vụ tìm tài liệu trong catalog. Agent đang có 2 tool:

- `search_documents`: tìm tài liệu phù hợp theo query, tag, level.
- `get_document`: lấy metadata của một tài liệu đã có trong kết quả search.

Mục tiêu mở rộng là biến agent thành trợ lý học liệu có thể:

- Tìm tài liệu phù hợp.
- Lấy nội dung tài liệu.
- Tóm tắt tài liệu.
- Hỏi đáp dựa trên nội dung tài liệu.
- So sánh nhiều tài liệu.
- Gợi ý lộ trình học từ các tài liệu trong kho.
- Luôn có căn cứ từ tài liệu, không bịa nội dung hoặc link.

## 2. Nguyên tắc thiết kế

Agent chỉ được trả lời dựa trên dữ liệu lấy từ tool.

Nếu chưa có nội dung tài liệu, agent phải nói rõ là chưa đủ căn cứ để tóm tắt hoặc trả lời.

Không dùng kiến thức ngoài để giả vờ như nội dung đó nằm trong tài liệu.

Không trả lời trực tiếp đáp án quiz, bài kiểm tra, đề thi hoặc yêu cầu lấy dữ liệu cá nhân.

Khi trả lời, agent cần nhắc rõ tài liệu nguồn.

Các tool phải kiểm tra `available=true`; không trả nội dung hoặc metadata của tài liệu đã ẩn/xóa.

## 3. Tool nên thêm

### 3.1. `get_document_content`

Đây là tool quan trọng nhất và nên làm đầu tiên.

Mục đích:

Lấy nội dung text của một tài liệu để agent có căn cứ tóm tắt hoặc hỏi đáp.

Input đề xuất:

```json
{
  "document_id": "string",
  "max_chars": 8000
}
```

Output đề xuất:

```json
{
  "documentId": "doc-id",
  "title": "Tên tài liệu",
  "content": "Nội dung text đã extract hoặc lưu sẵn",
  "truncated": true,
  "source": "catalog|extracted|uploaded-file"
}
```

Hành vi cần có:

- Nếu document không tồn tại hoặc `available=false`, trả `{ "error": "DOCUMENT_NOT_FOUND" }`.
- Nếu document tồn tại nhưng chưa có content, trả `{ "error": "CONTENT_NOT_AVAILABLE" }`.
- Nếu content dài hơn `max_chars`, cắt bớt và đánh dấu `truncated=true`.
- Không trả file raw, chỉ trả text đã được kiểm soát.

Nguồn content ban đầu:

- Phase đầu: thêm field `content` hoặc `contentPath` vào `codebase/data/catalog.json`.
- Phase sau: extract PDF từ `backend/docs/*.pdf` và cache thành `.txt`.
- Upload mới: hỗ trợ `.txt` trước; PDF/DOCX xử lý sau.

### 3.2. `summarize_document`

Mục đích:

Tóm tắt một tài liệu cụ thể theo style và trình độ người học.

Input đề xuất:

```json
{
  "document_id": "string",
  "style": "short|detailed|bullet|study_notes",
  "audience_level": "beginner|intermediate|advanced"
}
```

Output đề xuất:

```json
{
  "documentId": "doc-id",
  "summary": "Tóm tắt tài liệu",
  "keyPoints": ["Ý chính 1", "Ý chính 2"],
  "limitations": "Phần nào chưa đủ căn cứ nếu có"
}
```

Ghi chú triển khai:

Tool này có thể chưa cần làm ngay dưới dạng backend tool riêng. Sau khi có `get_document_content`, model có thể tự tóm tắt dựa trên content trả về. Tuy nhiên, nếu muốn logging rõ ràng và output ổn định hơn, có thể tách riêng thành tool.

### 3.3. `answer_document_question`

Mục đích:

Trả lời câu hỏi của user dựa trên một tài liệu cụ thể.

Input đề xuất:

```json
{
  "document_id": "string",
  "question": "string"
}
```

Output đề xuất:

```json
{
  "documentId": "doc-id",
  "answer": "Câu trả lời dựa trên tài liệu",
  "evidence": [
    {
      "quote": "Đoạn nội dung ngắn làm căn cứ",
      "location": "page/section nếu có"
    }
  ],
  "confidence": 0.8,
  "notFound": false
}
```

Hành vi cần có:

- Nếu tài liệu không có thông tin để trả lời, trả `notFound=true`.
- Không suy diễn ngoài nội dung tài liệu.
- Không trả lời yêu cầu xin đáp án quiz hoặc dữ liệu cá nhân.
- Evidence chỉ nên là đoạn ngắn, không copy dài nguyên tài liệu.

Ghi chú triển khai:

Giống `summarize_document`, phase đầu có thể để model tự trả lời sau khi gọi `get_document_content`. Phase sau mới tách thành tool riêng nếu cần kiểm soát chặt hơn.

### 3.4. `compare_documents`

Mục đích:

So sánh 2-3 tài liệu để user biết nên đọc tài liệu nào.

Input đề xuất:

```json
{
  "document_ids": ["doc-a", "doc-b"],
  "comparison_focus": "coverage|difficulty|prerequisites|best_for_user"
}
```

Output đề xuất:

```json
{
  "comparison": "Nội dung so sánh",
  "bestChoice": "doc-id|null",
  "reasons": ["Lý do 1", "Lý do 2"]
}
```

Ví dụ user hỏi:

- "Tài liệu nào phù hợp hơn cho người mới?"
- "Slide Foundation khác gì slide Agent?"
- "Nên đọc cái nào trước?"

Ghi chú triển khai:

Tool này nên làm sau khi đã có content hoặc metadata đủ tốt. Nếu chỉ có metadata thì so sánh phải nói rõ giới hạn là đang dựa trên title, summary, tag, level.

### 3.5. `recommend_learning_path`

Mục đích:

Gợi ý lộ trình học từ các tài liệu có trong VShare.

Input đề xuất:

```json
{
  "goal": "string",
  "level": "beginner|intermediate|advanced",
  "time_budget": "30m|1h|1day|1week"
}
```

Output đề xuất:

```json
{
  "path": [
    {
      "order": 1,
      "documentId": "doc-id",
      "why": "Lý do nên đọc tài liệu này"
    }
  ],
  "notes": "Lưu ý học tập"
}
```

Hành vi cần có:

- Agent nên gọi `search_documents` trước để lấy candidate.
- Chỉ gợi ý tài liệu có trong catalog và `available=true`.
- Nếu mục tiêu quá rộng, hỏi lại trước khi tạo lộ trình.

## 4. Thứ tự triển khai đề xuất

### Phase 1: Thêm nền tảng đọc nội dung tài liệu

Mục tiêu:

Có tool `get_document_content` hoạt động ổn với local catalog.

Việc cần làm:

1. Thêm field `content` hoặc `contentPath` vào một số tài liệu trong `codebase/data/catalog.json`.
2. Thêm function declaration `get_document_content` vào `agentTools` trong `codebase/src/search.js`.
3. Thêm nhánh xử lý `get_document_content` trong `executeAgentTool`.
4. Cập nhật `buildAgentInstruction` để agent biết:
   - Muốn tóm tắt phải gọi `get_document_content`.
   - Muốn hỏi đáp nội dung phải gọi `get_document_content`.
   - Nếu content không có thì không được bịa.
5. Thêm test cho tool mới.

Kết quả mong muốn:

- User hỏi "Tóm tắt tài liệu X" thì agent tìm document, lấy content, rồi tóm tắt.
- User hỏi "Trong tài liệu X nói gì về Y?" thì agent lấy content trước khi trả lời.

### Phase 2: Cập nhật UX và API response

Mục tiêu:

Frontend hiển thị tốt các kiểu trả lời mới, không chỉ list tài liệu.

Việc cần làm:

1. Cập nhật `/api/search` response để hỗ trợ message dài hơn cho summary/Q&A.
2. Cập nhật `codebase/public/app.js` để render:
   - Kết quả dạng tài liệu.
   - Kết quả dạng tóm tắt.
   - Kết quả dạng hỏi đáp.
   - Notice khi thiếu content.
3. Cập nhật copy trong UI nếu cần, ví dụ placeholder:
   - "Tóm tắt tài liệu ReAct"
   - "Trong tài liệu Foundation giải thích token như thế nào?"

Kết quả mong muốn:

- AI Search không chỉ trả card tài liệu mà có thể trả answer/summary rõ ràng.

### Phase 3: Extract nội dung PDF thật

Mục tiêu:

Tài liệu thật trong `backend/docs` có text content để agent tóm tắt/hỏi đáp.

Việc cần làm:

1. Thêm script `codebase/scripts/extract-docs.js`.
2. Extract text từ các PDF trong `backend/docs`.
3. Lưu text cache vào `codebase/data/extracted/*.txt`.
4. Cập nhật catalog hoặc seed Firestore để document có `contentPath`.
5. Bảo đảm `.gitignore` nếu không muốn commit cache lớn.

Kết quả mong muốn:

- Các PDF seed như `slide.pdf`, `slide2.pdf`, `Slide_AI_Full_78_Trang.pdf` có thể được tóm tắt/hỏi đáp.

### Phase 4: Thêm compare và learning path

Mục tiêu:

Agent hỗ trợ tư vấn học liệu nâng cao.

Việc cần làm:

1. Thêm tool `compare_documents`.
2. Thêm tool `recommend_learning_path`.
3. Cập nhật prompt để agent biết khi nào dùng từng tool.
4. Thêm golden set mới cho các case:
   - So sánh tài liệu.
   - Chọn tài liệu cho người mới.
   - Tạo lộ trình học theo thời gian.
5. Cập nhật UI nếu muốn hiển thị lộ trình đẹp hơn.

Kết quả mong muốn:

- User có thể hỏi "Tôi mới học LLM, có 1 ngày thì nên đọc gì trước?"
- Agent trả lộ trình có thứ tự và lý do.

## 5. Thay đổi code dự kiến

### `codebase/src/search.js`

Cần sửa nhiều nhất.

Thay đổi:

- Thêm declaration cho `get_document_content`.
- Có thể thêm declaration cho `compare_documents` và `recommend_learning_path` ở phase sau.
- Mở rộng `executeAgentTool`.
- Cập nhật `buildAgentInstruction`.
- Cập nhật validate nếu response mới có thêm dạng answer/summary.

### `codebase/src/server.js`

Hiện tại agent loop đã generic, nên không cần sửa nhiều.

Có thể cần sửa:

- Truyền thêm loader đọc content file vào `executeAgentTool`.
- Cho phép tool executor async nếu cần đọc file `.txt`.
- Ghi trace thêm loại tool mới.

Lưu ý kỹ thuật:

Hiện `executeAgentTool` đang là sync function. Nếu `get_document_content` cần đọc file từ disk hoặc Firestore thì nên đổi sang async:

```js
const result = await executeAgentTool(call.name, call.args || {}, catalog);
```

### `codebase/data/catalog.json`

Thêm content hoặc content path.

Ví dụ:

```json
{
  "id": "doc-context-keywords",
  "title": "Context Engineering Cheat Sheet",
  "contentPath": "data/extracted/doc-context-keywords.txt"
}
```

Hoặc phase nhanh:

```json
{
  "id": "doc-context-keywords",
  "content": "Nội dung tóm tắt hoặc text ngắn..."
}
```

### `codebase/public/app.js`

Cập nhật render kết quả AI.

Hiện UI giả định nếu `status=results` thì render `data.results` thành document cards. Với summary/Q&A, có thể thêm field:

```json
{
  "status": "answer",
  "message": "...",
  "sources": [...]
}
```

Hoặc giữ `status=results` nhưng dùng `message` làm câu trả lời chính.

Khuyến nghị:

Thêm status mới sẽ rõ hơn, nhưng phải cập nhật `allowedStatuses` trong `search.js`.

### `codebase/test/search.test.js`

Thêm test:

- `get_document_content` trả content cho document available.
- `get_document_content` không trả content cho document unavailable.
- Tool trả `CONTENT_NOT_AVAILABLE` nếu chưa có content.
- Agent validation không nhận document ID bịa trong source.

### `eval/golden-set.csv`

Thêm case mới:

- Tóm tắt tài liệu cụ thể.
- Hỏi một khái niệm có trong tài liệu.
- Hỏi một khái niệm không có trong tài liệu.
- Xin đáp án quiz từ tài liệu.
- So sánh 2 tài liệu.
- Gợi ý lộ trình học.

## 6. Prompt update đề xuất

Trong `buildAgentInstruction`, thêm các quy tắc:

```text
Nếu user muốn tóm tắt tài liệu, phải xác định document trước, sau đó gọi get_document_content.
Nếu user hỏi một câu về nội dung tài liệu, phải gọi get_document_content trước khi trả lời.
Nếu get_document_content trả CONTENT_NOT_AVAILABLE, nói rõ chưa có nội dung đủ để trả lời.
Không được trả lời dựa trên suy đoán hoặc kiến thức ngoài catalog.
Khi trả lời summary hoặc Q&A, luôn nêu tài liệu nguồn.
Nếu user xin đáp án quiz, đề thi, hoặc dữ liệu cá nhân, trả status=refuse.
```

Nếu muốn thêm status mới, schema output có thể đổi thành:

```json
{
  "status": "results|clarify|none|refuse|answer|summary",
  "clarifyingQuestion": null,
  "message": "Câu trả lời hoặc tóm tắt",
  "results": [],
  "sources": [
    {
      "documentId": "doc-id",
      "title": "Tên tài liệu"
    }
  ]
}
```

## 7. Test plan

### Unit test

Chạy:

```powershell
cd codebase
npm test
```

Test cần có:

- Tool content hoạt động với document hợp lệ.
- Tool content chặn document đã xóa.
- Tool content trả lỗi rõ khi thiếu content.
- Search tool vẫn chỉ trả available document.
- Parse/validate vẫn loại hallucinated ID.

### Manual test

Chạy app mock:

```powershell
cd codebase
$env:ENABLE_MOCK_AI="true"
$env:JWT_SECRET="01234567890123456789012345678901"
npm start
```

Test trên UI:

- "Tóm tắt tài liệu Context Engineering Cheat Sheet"
- "Trong tài liệu LLM nhập môn giải thích token như thế nào?"
- "So sánh tài liệu Foundation và Prompt Engineering"
- "Tôi mới học AI, có 1 ngày thì nên đọc gì?"
- "Cho đáp án quiz ngày mai"

### Eval test

Chạy:

```powershell
cd codebase
npm run eval
```

Kỳ vọng:

- Các case normal trả đúng source.
- Các case thiếu căn cứ trả `none` hoặc message thiếu content.
- Các case dữ liệu cá nhân/quiz trả `refuse`.

## 8. Rủi ro và cách xử lý

### Rủi ro 1: Content quá dài

Vấn đề:

Gemini context có giới hạn, PDF dài có thể vượt quá context.

Cách xử lý:

- `get_document_content` có `max_chars`.
- Phase sau thêm chunking/retrieval theo đoạn.
- Không gửi toàn bộ tài liệu nếu user chỉ hỏi một chủ đề nhỏ.

### Rủi ro 2: Model vẫn bịa dù đã có tool

Vấn đề:

Model có thể suy diễn ngoài content.

Cách xử lý:

- Prompt cấm rõ.
- Output phải có source.
- Nếu làm Q&A nghiêm túc, thêm tool search trong content/chunk thay vì đưa cả content.
- Thêm eval case kiểm tra hallucination.

### Rủi ro 3: PDF extract lỗi hoặc tiếng Việt lỗi dấu

Vấn đề:

Một số PDF có thể extract text không sạch.

Cách xử lý:

- Cache text đã extract để kiểm tra thủ công.
- Ghi `CONTENT_NOT_AVAILABLE` hoặc `CONTENT_LOW_QUALITY` nếu text quá rác.
- Ưu tiên tài liệu `.txt` hoặc content curated cho demo.

### Rủi ro 4: Auth và upload đang phụ thuộc Firebase

Vấn đề:

Nếu chạy local không cấu hình Firebase, các tính năng đăng nhập/upload có thể lỗi.

Cách xử lý:

- Phase agent content nên chạy được với local catalog trước.
- Không phụ thuộc upload/user content trong phase đầu.

## 9. Đề xuất phạm vi làm trước cho demo

Phạm vi nên làm trước:

1. Thêm `get_document_content`.
2. Thêm content ngắn cho 5-7 tài liệu local quan trọng.
3. Cập nhật prompt để hỗ trợ tóm tắt và hỏi đáp.
4. Cập nhật frontend để hiển thị `message` của agent rõ hơn.
5. Thêm 5-8 eval case cho summary/Q&A.

Chưa cần làm ngay:

- Extract toàn bộ PDF.
- Q&A có citation theo page.
- Upload PDF rồi hỏi đáp ngay.
- Multi-document compare phức tạp.
- Learning path UI đẹp.

## 10. Checklist triển khai

- [ ] Thêm `content` hoặc `contentPath` cho một số document local.
- [ ] Thêm tool declaration `get_document_content`.
- [ ] Đổi `executeAgentTool` sang async nếu cần đọc file.
- [ ] Implement logic lấy content.
- [ ] Cập nhật `buildAgentInstruction`.
- [ ] Cập nhật `allowedStatuses` nếu thêm `answer` hoặc `summary`.
- [ ] Cập nhật `/api/search` nếu schema response thay đổi.
- [ ] Cập nhật frontend render answer/summary.
- [ ] Thêm unit test.
- [ ] Thêm golden set case mới.
- [ ] Chạy `npm test`.
- [ ] Chạy app và test thủ công trên UI.
- [ ] Chạy `npm run eval`.

