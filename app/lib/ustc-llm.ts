const USTC_API_BASE = "https://api.llm.ustc.edu.cn/v1";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
type ModelList = { data?: Array<{ id?: string }>; error?: { message?: string } };

let selectedModel: string | undefined;

async function getModel(apiKey: string) {
  if (process.env.USTC_LLM_MODEL) return process.env.USTC_LLM_MODEL;
  if (selectedModel) return selectedModel;
  const response = await fetch(`${USTC_API_BASE}/models`, { headers: { Authorization: `Bearer ${apiKey}` } });
  const result = await response.json() as ModelList;
  if (!response.ok) throw new Error(result.error?.message || "科大 API Key 验证失败。");
  const models = (result.data || []).map((item) => item.id).filter((id): id is string => Boolean(id));
  selectedModel = models.find((id) => id.toLowerCase().includes("deepseek") && id.toLowerCase().includes("flash"))
    || models.find((id) => id.toLowerCase().includes("deepseek")) || models[0];
  if (!selectedModel) throw new Error("此科大 API Key 暂无可用模型。");
  return selectedModel;
}

export async function ustcChat(apiKey: string, messages: ChatMessage[], temperature: number) {
  const model = await getModel(apiKey);
  return fetch(`${USTC_API_BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, temperature, response_format: { type: "json_object" }, messages }),
  });
}
