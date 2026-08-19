type Mode = "en" | "zh" | "both";
type AnalysisKind = "sentence" | "paragraph";

export async function POST(request: Request) {
  try {
    const { sentence, mode = "both", kind = "sentence" } = await request.json() as { sentence?: string; mode?: Mode; kind?: AnalysisKind };
    if (!sentence) return Response.json({ error: "A sentence is required." }, { status: 400 });
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return Response.json({ error: "DeepSeek API is not configured." }, { status: 503 });
    const language = "所有分析内容必须使用简洁、自然的中文；保留必要的英文语法片段，并提供准确的中文翻译。";
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "deepseek-chat", temperature: 0.2, response_format: { type: "json_object" }, messages: [
        { role: "system", content: `You create compact close-reading notes for IELTS learners, similar to a good teacher's sentence walkthrough. ${language} Return JSON only with keys sentence, kind, logic, mainClause, structure, explanation, translation. kind must be ${kind}. logic is one concise statement of what the ${kind} is doing. mainClause identifies the grammatical backbone. structure is an array of 2-5 concise strings; label important blocks such as A, B, concession, relative clause, or result when useful, then explain their role and meaning. explanation is a short synthesis, not a repetition. Provide no example sentences, vocabulary lists, collocations, exercises, or unrelated advice. If translation is omitted, return an empty string.` },
        { role: "user", content: `Analyze this ${kind} only:\n${sentence.slice(0, 2400)}` },
      ] }),
    });
    const result = await response.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
    if (!response.ok) return Response.json({ error: result.error?.message || "DeepSeek rejected the request." }, { status: response.status });
    const content = result.choices?.[0]?.message?.content;
    if (!content) throw new Error("DeepSeek returned an empty analysis.");
    const parsed = JSON.parse(content.replace(/^```json\s*|\s*```$/g, ""));
    parsed.sentence = sentence;
    parsed.kind = kind;
    return Response.json(parsed);
  } catch (reason) {
    return Response.json({ error: reason instanceof Error ? reason.message : "The sentence could not be analyzed." }, { status: 500 });
  }
}
