import { boolean, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { usersTable } from "./users";

export const scheduleOverridesTable = pgTable(
  "schedule_overrides",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    isWorking: boolean("is_working").notNull().default(false),
    startTime: text("start_time"),
    endTime: text("end_time"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userDateUnique: uniqueIndex("schedule_overrides_user_date_unique").on(t.userId, t.date),
  })
);

export const insertScheduleOverrideSchema = createInsertSchema(scheduleOverridesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertScheduleOverride = z.infer<typeof insertScheduleOverrideSchema>;
export type ScheduleOverride = typeof scheduleOverridesTable.$inferSelect;
