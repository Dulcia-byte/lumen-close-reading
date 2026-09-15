import { ustcChat } from "../../lib/ustc-llm";

export async function POST(request: Request) {
  try {
    const { word, sentence } = await request.json() as { word?: string; sentence?: string };
    if (!word || !sentence) return Response.json({ error: "A word and sentence are required." }, { status: 400 });
    const response = await ustcChat([
        { role: "system", content: "You are a concise learner's dictionary. Return JSON only with keys word, lemma, partOfSpeech, ukIpa, usIpa, definition, chineseMeaning. definition is one clear English sentence for the selected word's meaning in context. chineseMeaning is a short Chinese meaning in the same context. Do not include examples, collocations, synonyms, or study labels. IPA values must include slash marks." },
        { role: "user", content: `Selected word: ${word}\nSentence: ${sentence.slice(0, 600)}` },
      ], 0.2);
    const result = await response.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
    if (!response.ok) return Response.json({ error: result.error?.message || "DeepSeek rejected the request." }, { status: response.status });
    const content = result.choices?.[0]?.message?.content;
    if (!content) throw new Error("DeepSeek returned an empty definition.");
    return Response.json(JSON.parse(content.replace(/^```json\s*|\s*```$/g, "")));
  } catch (reason) {
    return Response.json({ error: reason instanceof Error ? reason.message : "The definition could not be generated." }, { status: 500 });
  }
}
