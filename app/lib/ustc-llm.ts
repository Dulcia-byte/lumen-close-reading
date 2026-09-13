const DEEPSEEK_API_BASE = "https://api.deepseek.com";
const REQUEST_TIMEOUT_MS = 15_000;

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function ustcChat(apiKey: string, messages: ChatMessage[], temperature: number) {
  const model = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
  try {
    const response = await fetch(`${DEEPSEEK_API_BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, temperature, response_format: { type: "json_object" }, messages }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) return response;
    return Response.json({
      error: { message: response.ok ? "DeepSeek 官方接口返回了无法识别的内容。" : `DeepSeek 官方接口拒绝了请求（${response.status}）。` },
    }, { status: response.ok ? 502 : response.status });
  } catch (reason) {
    const timedOut = reason instanceof Error && (reason.name === "TimeoutError" || reason.name === "AbortError");
    return Response.json({
      error: { message: timedOut ? "DeepSeek 官方接口响应超时（15 秒），请稍后重试。" : "无法连接 DeepSeek 官方接口，请检查网络后重试。" },
    }, { status: 503 });
  }
}
