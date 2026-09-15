import { ustcChat } from "../../lib/ustc-llm";

export async function POST(request: Request) {
  try {
    const { passage, mode } = await request.json();
    if (!passage || typeof passage !== "string") return Response.json({ tags: [] });
    const language = mode === "en" ? "Write labels in English." : "Write every label as English / 中文.";
    const response = await ustcChat([
        { role: "system", content: `Return JSON only with a tags array containing 1-3 short topic labels for the passage. ${language} Order labels strictly from broad domain to narrow subject, for example Technology, Ecology, Extreme weather. Do not summarize, number, or add punctuation to labels.` },
        { role: "user", content: passage.slice(0,8000) },
      ], 0.1);
    if (!response.ok) return Response.json({ tags: [] });
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content.replace(/^```json\s*|\s*```$/g, ""));
    return Response.json({ tags: Array.isArray(parsed.tags) ? parsed.tags.filter((tag: unknown)=>typeof tag==="string"&&tag.trim()).slice(0,3) : [] });
  } catch { return Response.json({ tags: [] }); }
}
