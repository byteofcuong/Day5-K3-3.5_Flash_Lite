# CP3 — AI thật và đo lượt đầu

## Đã chuẩn bị

- Gemini agent loop thật: `codebase/src/server.js`.
- Tools thật: `search_documents` và `get_document`; backend thực thi rồi gửi
  function response trở lại Gemini.
- Prompt + output validator: `codebase/src/search.js`.
- Trace JSONL: `codebase/traces/ai-calls.jsonl`.
- Golden set 22 case: `eval/golden-set.csv`.
- Runner: `cd codebase && npm run eval`.

## Điều kiện chạy thật

1. Copy `codebase/.env.example` thành `codebase/.env`.
2. Điền `GEMINI_API_KEY`, giữ `ENABLE_MOCK_AI=false`.
3. `npm start`.
4. Terminal khác: `npm run eval`.
5. Giữ file `eval/run-*.csv`, kể cả case fail.

- [ ] Có API key và ít nhất một trace Gemini thật.
- [ ] Đã chạy đủ 22 case bằng Gemini.
- [ ] Có bảng kết quả và % lượt đầu.

Không tích các ô trên bằng kết quả mock.
