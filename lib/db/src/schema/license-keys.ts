import { pgTable, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const licenseKeysTable = pgTable("license_keys", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  type: text("type", { enum: ["trial", "paid"] }).notNull().default("paid"),
  durationDays: integer("duration_days").notNull().default(30),
  isUsed: boolean("is_used").notNull().default(false),
  usedByUserId: integer("used_by_user_id").references(() => usersTable.id),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLicenseKeySchema = createInsertSchema(licenseKeysTable).omit({
  id: true,
  createdAt: true,
});
export type InsertLicenseKey = z.infer<typeof insertLicenseKeySchema>;
export type LicenseKey = typeof licenseKeysTable.$inferSelect;
