import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const automodSettingsTable = pgTable("automod_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }).unique(),
  aiName: text("ai_name").notNull().default("Ассистент"),
  systemPrompt: text("system_prompt").notNull().default("Ты вежливый и полезный ассистент для бизнеса. Отвечай кратко и по делу."),
  tone: text("tone").notNull().default("friendly"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAutomodSettingsSchema = createInsertSchema(automodSettingsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAutomodSettings = z.infer<typeof insertAutomodSettingsSchema>;
export type AutomodSettings = typeof automodSettingsTable.$inferSelect;
