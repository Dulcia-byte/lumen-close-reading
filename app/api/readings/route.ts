import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

type Reading = { id:string; title:string; passage:string; tags?:string[]; updatedAt:number };
async function ensureSchema(){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS reading_history (
    user_id TEXT NOT NULL,
    id TEXT NOT NULL,
    title TEXT NOT NULL,
    passage TEXT NOT NULL,
    tags TEXT NOT NULL DEFAULT '[]',
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, id)
  )`).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_reading_history_user_updated ON reading_history(user_id, updated_at DESC)").run();
}
export async function GET(){const user=await getChatGPTUser();if(!user)return Response.json({error:"Sign in required"},{status:401});await ensureSchema();const result=await env.DB.prepare("SELECT id,title,passage,tags,updated_at AS updatedAt FROM reading_history WHERE user_id=? ORDER BY updated_at DESC LIMIT 50").bind(user.userId).all<{id:string;title:string;passage:string;tags:string;updatedAt:number}>();return Response.json({items:result.results.map((row)=>({...row,tags:JSON.parse(row.tags||"[]")}))});}
export async function POST(request:Request){const user=await getChatGPTUser();if(!user)return Response.json({error:"Sign in required"},{status:401});const item=await request.json() as Reading;if(!item.id||!item.title||!item.passage)return Response.json({error:"Invalid reading"},{status:400});await ensureSchema();await env.DB.prepare("INSERT INTO reading_history(user_id,id,title,passage,tags,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,id) DO UPDATE SET title=excluded.title,passage=excluded.passage,tags=excluded.tags,updated_at=excluded.updated_at").bind(user.userId,item.id,item.title,item.passage,JSON.stringify(item.tags||[]),item.updatedAt||Date.now()).run();await env.DB.prepare("DELETE FROM reading_history WHERE user_id=? AND id NOT IN (SELECT id FROM reading_history WHERE user_id=? ORDER BY updated_at DESC LIMIT 50)").bind(user.userId,user.userId).run();return Response.json({ok:true});}
export async function DELETE(request:Request){const user=await getChatGPTUser();if(!user)return Response.json({error:"Sign in required"},{status:401});const {id}=await request.json() as {id?:string};if(!id)return Response.json({error:"Invalid reading"},{status:400});await ensureSchema();await env.DB.prepare("DELETE FROM reading_history WHERE user_id=? AND id=?").bind(user.userId,id).run();return Response.json({ok:true});}