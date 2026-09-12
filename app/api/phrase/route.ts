import { ustcChat } from "../../lib/ustc-llm";

export async function POST(request:Request){
  try{
    const {phrase,contextSentence}=await request.json() as {phrase?:string;contextSentence?:string};
    if(!phrase||!contextSentence)return Response.json({error:"A phrase and sentence are required."},{status:400});
    const apiKey=process.env.DEEPSEEK_API_KEY;
    if(!apiKey)return Response.json({error:"DeepSeek API is not configured."},{status:503});
    const response=await ustcChat(apiKey,[{role:"system",content:"You are a concise learner's dictionary. Return JSON only with keys phrase, definition, chineseMeaning, contextSentence. Give one clear English sentence explaining the selected phrase's meaning in context and one short Chinese meaning. Do not include examples, collocations, synonyms, or study labels."},{role:"user",content:`Phrase: ${phrase}\nSentence: ${contextSentence.slice(0,600)}`}],.2);
    const result=await response.json() as {choices?:Array<{message?:{content?:string}}>;error?:{message?:string}};
    if(!response.ok)return Response.json({error:result.error?.message||"DeepSeek rejected the request."},{status:response.status});
    const content=result.choices?.[0]?.message?.content;if(!content)throw new Error("DeepSeek returned an empty explanation.");
    const parsed=JSON.parse(content.replace(/^```json\s*|\s*```$/g,""));parsed.phrase=phrase;parsed.contextSentence=contextSentence;return Response.json(parsed);
  }catch(reason){return Response.json({error:reason instanceof Error?reason.message:"The phrase could not be explained."},{status:500});}
}
