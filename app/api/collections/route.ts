import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

type Kind = "word" | "phrase" | "sentence";
type SavedItem = { id: string; addedAt?: number; [key: string]: unknown };
const kinds: Kind[] = ["word", "phrase", "sentence"];

async function ensureSchema() {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS saved_items (
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('word', 'phrase', 'sentence')),
    item_id TEXT NOT NULL,
    payload TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, kind, item_id)
  )`).run();
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  await ensureSchema();
  const result = await env.DB.prepare("SELECT kind, payload FROM saved_items WHERE user_id = ? ORDER BY updated_at DESC").bind(user.userId).all<{ kind: Kind; payload: string }>();
  const collection: Record<Kind, SavedItem[]> = { word: [], phrase: [], sentence: [] };
  for (const row of result.results) { if (kinds.includes(row.kind)) { try { collection[row.kind].push(JSON.parse(row.payload)); } catch {} } }
  return Response.json(collection);
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const body = await request.json() as { items?: Partial<Record<Kind, SavedItem[]>> };
  await ensureSchema();
  const statements = kinds.flatMap((kind) => (body.items?.[kind] || []).slice(0, 1000).flatMap((item) => {
    if (!item || typeof item.id !== "string" || !item.id) return [];
    const updatedAt = typeof item.addedAt === "number" ? item.addedAt : Date.now();
    return [env.DB.prepare(`INSERT INTO saved_items (user_id, kind, item_id, payload, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, kind, item_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`).bind(user.userId, kind, item.id, JSON.stringify(item), updatedAt)];
  }));
  if (statements.length) await env.DB.batch(statements);
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const { kind, id } = await request.json() as { kind?: Kind; id?: string };
  if (!kind || !kinds.includes(kind) || typeof id !== "string" || !id) return Response.json({ error: "Invalid item" }, { status: 400 });
  await ensureSchema();
  await env.DB.prepare("DELETE FROM saved_items WHERE user_id = ? AND kind = ? AND item_id = ?").bind(user.userId, kind, id).run();
  return Response.json({ ok: true });
}