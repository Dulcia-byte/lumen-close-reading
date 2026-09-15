import { ustcChat } from "../../lib/ustc-llm";

type Entry={id:string;text:string;context?:string};
export async function POST(request:Request){
  try{const {words=[],phrases=[]}=await request.json() as {words?:Entry[];phrases?:Entry[]};const entries=[...words.slice(0,80).map((item)=>({...item,id:`word:${item.id}`,kind:"word"})),...phrases.slice(0,80).map((item)=>({...item,id:`phrase:${item.id}`,kind:"phrase"}))];if(!entries.length)return Response.json({items:[]});const response=await ustcChat([{role:"system",content:"Return JSON only with an items array. For every input item preserve id exactly and add chineseMeaning: one concise, natural Chinese meaning matching its context. Do not omit items or add explanations."},{role:"user",content:JSON.stringify(entries)}],.1);if(!response.ok)return Response.json({items:[]});const data=await response.json();const parsed=JSON.parse((data.choices?.[0]?.message?.content||"{}").replace(/^```json\s*|\s*```$/g,""));return Response.json({items:Array.isArray(parsed.items)?parsed.items:[]});}catch{return Response.json({items:[]});}
}
