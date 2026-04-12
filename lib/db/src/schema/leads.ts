import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const leadsTable = pgTable("leads", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id),
  clientName: text("client_name").notNull(),
  platform: text("platform").notNull(),
  service: text("service").notNull(),
  details: text("details"),
  quantity: text("quantity"),
  deadline: text("deadline"),
  price: text("price"),
  comment: text("comment"),
  status: text("status").notNull().default("warm"),
  recommendation: text("recommendation"),
  isPriority: boolean("is_priority").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertLeadSchema = createInsertSchema(leadsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leadsTable.$inferSelect;
