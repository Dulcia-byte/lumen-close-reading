const USTC_API_BASE = "https://api.llm.ustc.edu.cn/v1";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function ustcChat(apiKey: string, messages: ChatMessage[], temperature: number) {
  const configuredModel = process.env.USTC_LLM_MODEL;
  const models = configuredModel
    ? [configuredModel]
    : ["deepseek-v4-flash-ascend", "deepseek-v4-flash"];
  let lastResponse: Response | undefined;

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch(`${USTC_API_BASE}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, temperature, response_format: { type: "json_object" }, messages }),
      });
      lastResponse = response;
      if (response.ok) return response;
      if (response.status < 500) break;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 400));
    }
    if (lastResponse && ![400, 401, 403, 404].includes(lastResponse.status)) break;
  }

  if (!lastResponse) {
    return Response.json({ error: { message: "科大大模型服务没有返回响应。" } }, { status: 503 });
  }
  const contentType = lastResponse.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return lastResponse;
  const upstreamStatus = lastResponse.status;
  return Response.json({
    error: {
      message: upstreamStatus >= 500
        ? `科大大模型服务暂时无法连接（${upstreamStatus}），请稍后重试。`
        : `科大大模型服务拒绝了请求（${upstreamStatus}）。`,
    },
  }, { status: upstreamStatus >= 500 ? 503 : upstreamStatus });
}
