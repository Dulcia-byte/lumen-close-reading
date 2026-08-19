import { primaryKey, sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const savedItems = sqliteTable("saved_items", {
  userId: text("user_id").notNull(),
  kind: text("kind", { enum: ["word", "phrase", "sentence"] }).notNull(),
  itemId: text("item_id").notNull(),
  payload: text("payload").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.kind, table.itemId] })]);