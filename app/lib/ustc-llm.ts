type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function ustcChat(messages: ChatMessage[], temperature: number) {
  const proxyUrl = process.env.DEEPSEEK_PROXY_URL;
  const proxyToken = process.env.DEEPSEEK_PROXY_TOKEN;
  if (!proxyUrl || !proxyToken) {
    return Response.json({ error: { message: "DeepSeek proxy is not configured." } }, { status: 503 });
  }
  try {
    const response = await fetch(proxyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${proxyToken}` },
      body: JSON.stringify({ temperature, response_format: { type: "json_object" }, messages }),
    });
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) return response;
    return Response.json({
      error: { message: response.ok ? "DeepSeek 官方接口返回了无法识别的内容。" : `DeepSeek 官方接口拒绝了请求（${response.status}）。` },
    }, { status: response.ok ? 502 : response.status });
  } catch (reason) {
    const timedOut = reason instanceof Error && (reason.name === "TimeoutError" || reason.name === "AbortError");
    return Response.json({
      error: { message: timedOut ? "DeepSeek 中转响应超时，请稍后重试。" : "无法连接 DeepSeek 中转，请稍后重试。" },
    }, { status: 503 });
  }
}
