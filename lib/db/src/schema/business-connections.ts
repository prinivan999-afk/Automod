import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const businessConnectionsTable = pgTable("business_connections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  businessConnectionId: text("business_connection_id").notNull().unique(),
  ownerTelegramId: text("owner_telegram_id"),
  name: text("name").notNull(),
  username: text("username"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  messagesHandled: integer("messages_handled").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBusinessConnectionSchema = createInsertSchema(businessConnectionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBusinessConnection = z.infer<typeof insertBusinessConnectionSchema>;
export type BusinessConnection = typeof businessConnectionsTable.$inferSelect;
