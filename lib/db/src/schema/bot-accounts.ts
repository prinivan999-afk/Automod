import { boolean, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const botAccountsTable = pgTable("bot_accounts", {
  id: serial("id").primaryKey(),
  platform: text("platform").notNull(),
  accountName: text("account_name").notNull(),
  accountHandle: text("account_handle").notNull(),
  notificationChat: text("notification_chat").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBotAccountSchema = createInsertSchema(botAccountsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBotAccount = z.infer<typeof insertBotAccountSchema>;
export type BotAccount = typeof botAccountsTable.$inferSelect;