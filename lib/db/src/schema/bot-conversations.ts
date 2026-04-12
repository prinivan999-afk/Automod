import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const botConversationsTable = pgTable("bot_conversations", {
  id: serial("id").primaryKey(),
  userChatId: text("user_chat_id").notNull().unique(),
  sellerId: integer("seller_id"),
  sellerUsername: text("seller_username"),
  messages: text("messages").notNull().default("[]"),
  status: text("status").notNull().default("waiting_seller"),
  leadId: integer("lead_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBotConversationSchema = createInsertSchema(botConversationsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBotConversation = z.infer<typeof insertBotConversationSchema>;
export type BotConversation = typeof botConversationsTable.$inferSelect;
