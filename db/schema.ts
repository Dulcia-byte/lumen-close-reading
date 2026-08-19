import { index, primaryKey, sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const savedItems = sqliteTable("saved_items", {
  userId: text("user_id").notNull(),
  kind: text("kind", { enum: ["word", "phrase", "sentence"] }).notNull(),
  itemId: text("item_id").notNull(),
  payload: text("payload").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.kind, table.itemId] })]);
export const readingHistory = sqliteTable("reading_history", {
  userId: text("user_id").notNull(),
  id: text("id").notNull(),
  title: text("title").notNull(),
  passage: text("passage").notNull(),
  tags: text("tags").notNull().default("[]"),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.id] }), index("idx_reading_history_user_updated").on(table.userId, table.updatedAt)]);