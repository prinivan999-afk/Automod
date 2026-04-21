import { boolean, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { leadsTable } from "./leads";
import { usersTable } from "./users";
import { servicesTable } from "./services";

export const appointmentsTable = pgTable(
  "appointments",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
    leadId: integer("lead_id").references(() => leadsTable.id, { onDelete: "set null" }),
    serviceId: integer("service_id").references(() => servicesTable.id, { onDelete: "set null" }),
    date: text("date").notNull(),
    timeSlot: text("time_slot").notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(30),
    clientName: text("client_name").notNull(),
    clientChatId: text("client_chat_id"),
    status: text("status").notNull().default("booked"),
    service: text("service"),
    phone: text("phone"),
    reminderDaySent: boolean("reminder_day_sent").notNull().default(false),
    reminderHourSent: boolean("reminder_hour_sent").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    bookedSlotUnique: uniqueIndex("appointments_booked_slot_unique")
      .on(t.userId, t.date, t.timeSlot)
      .where(sql`${t.status} = 'booked'`),
  })
);

export const insertAppointmentSchema = createInsertSchema(appointmentsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Appointment = typeof appointmentsTable.$inferSelect;
