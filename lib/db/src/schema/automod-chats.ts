import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const automodChatsTable = pgTable("automod_chats", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  businessConnectionId: text("business_connection_id").notNull(),
  chatId: text("chat_id").notNull(),
  chatTitle: text("chat_title"),
  chatUsername: text("chat_username"),
  chatType: text("chat_type"),
  isExcluded: boolean("is_excluded").notNull().default(false),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAutomodChatSchema = createInsertSchema(automodChatsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAutomodChat = z.infer<typeof insertAutomodChatSchema>;
export type AutomodChat = typeof automodChatsTable.$inferSelect;
