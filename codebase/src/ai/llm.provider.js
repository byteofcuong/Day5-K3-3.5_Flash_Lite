import "dotenv/config";

/** Google Gemini API connector with proper systemInstruction support. */
export async function callGeminiApi({ contents, systemInstruction, tools, temperature = 0.3 }) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY chưa được cấu hình trong file .env");
  }

  let model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;

  const bodyPayload = {
    contents,
    generationConfig: { temperature },
  };

  if (systemInstruction) {
    bodyPayload.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  if (tools) {
    bodyPayload.tools = tools;
    bodyPayload.toolConfig = { functionCallingConfig: { mode: "AUTO" } };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bodyPayload),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Gemini HTTP ${response.status}`);
  }

  const candidate = payload?.candidates?.[0];
  const parts = candidate?.content?.parts || [];
  const functionCallPart = parts.find((p) => p.functionCall);

  if (functionCallPart) {
    return {
      type: "functionCall",
      name: functionCallPart.functionCall.name,
      args: functionCallPart.functionCall.args,
      thought: parts.find((p) => p.text)?.text || "Bắt đầu gọi tool...",
      // Gemini thinking models attach thoughtSignature metadata to response
      // parts. The next turn must receive every model part unchanged.
      modelParts: parts,
    };
  }

  return {
    type: "text",
    text: parts.find((p) => p.text)?.text || "",
  };
}
