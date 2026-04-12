import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { leadsTable } from "./leads";

export const leadChatMessagesTable = pgTable("lead_chat_messages", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").references(() => leadsTable.id, { onDelete: "set null" }),
  platform: text("platform").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLeadChatMessageSchema = createInsertSchema(leadChatMessagesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertLeadChatMessage = z.infer<typeof insertLeadChatMessageSchema>;
export type LeadChatMessage = typeof leadChatMessagesTable.$inferSelect;