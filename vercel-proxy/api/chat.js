function authorized(header) {
  const expected = process.env.LUMEN_PROXY_TOKEN;
  return Boolean(expected && header === `Bearer ${expected}`);
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") return response.status(405).json({ error: { message: "Method not allowed." } });
  if (!authorized(request.headers.authorization)) return response.status(401).json({ error: { message: "Unauthorized." } });

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return response.status(503).json({ error: { message: "DeepSeek API is not configured." } });

  const body = request.body;
  if (!Array.isArray(body?.messages) || body.messages.length < 1 || body.messages.length > 20) {
    return response.status(400).json({ error: { message: "Invalid messages." } });
  }
  if (body.messages.some((item) => !item || !["system", "user", "assistant"].includes(item.role) || typeof item.content !== "string" || item.content.length > 12_000)) {
    return response.status(400).json({ error: { message: "Invalid message content." } });
  }

  try {
    const upstream = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
        temperature: typeof body.temperature === "number" ? Math.min(2, Math.max(0, body.temperature)) : 0.2,
        response_format: { type: "json_object" },
        messages: body.messages,
      }),
    });
    const text = await upstream.text();
    response.status(upstream.status);
    response.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json; charset=utf-8");
    return response.send(text);
  } catch {
    return response.status(502).json({ error: { message: "Unable to reach DeepSeek." } });
  }
}
