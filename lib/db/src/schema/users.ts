import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  telegramUsername: text("telegram_username").notNull().unique(),
  apiToken: text("api_token").notNull().unique(),
  telegramChatId: text("telegram_chat_id"),
  telegramUserId: text("telegram_user_id").unique(),
  telegramUsernameVerified: boolean("telegram_username_verified").notNull().default(false),
  verificationCode: text("verification_code"),
  plan: text("plan", { enum: ["basic", "business"] }).notNull().default("basic"),
  trialStartedAt: timestamp("trial_started_at", { withTimezone: true }),
  subscriptionExpiresAt: timestamp("subscription_expires_at", { withTimezone: true }),
  googleRefreshToken: text("google_refresh_token"),
  googleAccessToken: text("google_access_token"),
  googleTokenExpiry: timestamp("google_token_expiry", { withTimezone: true }),
  googleCalendarId: text("google_calendar_id").default("primary"),
  googleEmail: text("google_email"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
