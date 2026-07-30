import "dotenv/config";

/** Cổng kết nối gọi API Google Gemini (Hỗ trợ ReAct Tool Calling thật 100%) */
export async function callGeminiApi({ contents, systemInstruction, tools, temperature = 0.3 }) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY chưa được cấu hình trong file .env");
  }

  let model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  if (model === "gemini-2.5-flash" || model === "gemini-1.5-flash" || model === "gemini-2.0-flash") {
    model = "gemini-3.5-flash-lite";
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;

  const bodyPayload = {
    contents: systemInstruction 
      ? [{ role: "user", parts: [{ text: systemInstruction }] }, ...contents]
      : contents,
    generationConfig: { temperature }
  };

  if (tools) {
    bodyPayload.tools = tools;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bodyPayload)
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Gemini HTTP ${response.status}`);
  }

  const candidate = payload?.candidates?.[0];
  const parts = candidate?.content?.parts || [];

  // 1. Nếu Gemini quyết định trả về Tool Call (ReAct Action)
  const functionCallPart = parts.find((p) => p.functionCall);
  if (functionCallPart) {
    return {
      type: "functionCall",
      name: functionCallPart.functionCall.name,
      args: functionCallPart.functionCall.args,
      thought: parts.find(p => p.text)?.text || "Bắt đầu gọi Tool..."
    };
  }

  // 2. Nếu Gemini trả về văn bản phản hồi cuối cùng (Final Answer)
  return {
    type: "text",
    text: parts.find((p) => p.text)?.text || ""
  };
}
