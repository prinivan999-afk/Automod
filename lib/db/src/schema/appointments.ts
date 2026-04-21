import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { leadsTable } from "./leads";
import { usersTable } from "./users";

export const appointmentsTable = pgTable("appointments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  leadId: integer("lead_id").references(() => leadsTable.id, { onDelete: "set null" }),
  date: text("date").notNull(),
  timeSlot: text("time_slot").notNull(),
  clientName: text("client_name").notNull(),
  clientChatId: text("client_chat_id"),
  status: text("status").notNull().default("booked"),
  service: text("service"),
  phone: text("phone"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAppointmentSchema = createInsertSchema(appointmentsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Appointment = typeof appointmentsTable.$inferSelect;
