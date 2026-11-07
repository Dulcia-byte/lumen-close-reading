import { CLOSE_READING_SYSTEM_PROMPT, CLOSE_READING_TEMPERATURE, buildCloseReadingUserMessage } from "../../lib/close-reading-prompt";
import { ustcChat } from "../../lib/ustc-llm";

type Mode = "en" | "zh" | "both";
type AnalysisKind = "sentence" | "paragraph";

function normalizeMarkdown(content: string) {
  let text = content.trim().replace(/^```[a-zA-Z]*\s*\n?/, "").replace(/\n?```$/, "").trim();
  const firstHeading = text.search(/^#{1,6}\s/m);
  if (firstHeading > 0) text = text.slice(firstHeading).trim();
  return text;
}

export async function POST(request: Request) {
  try {
    const { sentence, mode = "both", kind = "sentence" } = await request.json() as { sentence?: string; mode?: Mode; kind?: AnalysisKind };
    if (!sentence) return Response.json({ error: "A sentence is required." }, { status: 400 });
    const response = await ustcChat([
        { role: "system", content: CLOSE_READING_SYSTEM_PROMPT },
        { role: "user", content: buildCloseReadingUserMessage(sentence.slice(0, 2400), kind) },
      ], CLOSE_READING_TEMPERATURE, { json: false });
    const result = await response.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
    if (!response.ok) return Response.json({ error: result.error?.message || "DeepSeek rejected the request." }, { status: response.status });
    const content = result.choices?.[0]?.message?.content;
    if (!content) throw new Error("DeepSeek returned an empty analysis.");
    return Response.json({ sentence, kind, markdown: normalizeMarkdown(content) || content.trim() });
  } catch (reason) {
    return Response.json({ error: reason instanceof Error ? reason.message : "The sentence could not be analyzed." }, { status: 500 });
  }
}
