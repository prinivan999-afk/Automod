import { google, calendar_v3 } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

function getRedirectUri(): string {
  const domain =
    process.env.PUBLIC_APP_URL ??
    (process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : "http://localhost:8080");
  return `${domain.replace(/\/$/, "")}/oauth2callback`;
}

export function isGoogleConfigured(): boolean {
  return Boolean(CLIENT_ID && CLIENT_SECRET);
}

export function createOAuthClient(): OAuth2Client {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("GOOGLE_CLIENT_ID и GOOGLE_CLIENT_SECRET не заданы в Secrets.");
  }
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, getRedirectUri());
}

export function buildAuthUrl(state: string): string {
  const oauth2 = createOAuthClient();
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
    state,
  });
}

async function getValidAccessToken(userId: number): Promise<string | null> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user?.googleRefreshToken) return null;

  const now = Date.now();
  const expiry = user.googleTokenExpiry?.getTime() ?? 0;
  if (user.googleAccessToken && expiry > now + 60_000) {
    return user.googleAccessToken;
  }

  const oauth2 = createOAuthClient();
  oauth2.setCredentials({ refresh_token: user.googleRefreshToken });
  try {
    const { credentials } = await oauth2.refreshAccessToken();
    const access = credentials.access_token ?? null;
    const expiryDate = credentials.expiry_date ? new Date(credentials.expiry_date) : null;
    if (access) {
      await db
        .update(usersTable)
        .set({ googleAccessToken: access, googleTokenExpiry: expiryDate })
        .where(eq(usersTable.id, userId));
    }
    return access;
  } catch (e) {
    console.error("[GoogleCalendar] Failed to refresh token:", e);
    return null;
  }
}

export async function getCalendarClient(userId: number): Promise<calendar_v3.Calendar | null> {
  const token = await getValidAccessToken(userId);
  if (!token) return null;
  const oauth2 = createOAuthClient();
  oauth2.setCredentials({ access_token: token });
  return google.calendar({ version: "v3", auth: oauth2 });
}

function buildEventTimes(date: string, timeSlot: string, durationMin: number) {
  const [h, m] = timeSlot.split(":").map(Number);
  const startISO = `${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
  const startDate = new Date(`${startISO}+03:00`); // Moscow tz fallback
  const endDate = new Date(startDate.getTime() + durationMin * 60_000);
  return { start: startDate, end: endDate };
}

export async function createCalendarEvent(
  userId: number,
  opts: {
    date: string;
    timeSlot: string;
    durationMin: number;
    summary: string;
    description?: string;
  }
): Promise<string | null> {
  const calendar = await getCalendarClient(userId);
  if (!calendar) return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const calendarId = user?.googleCalendarId ?? "primary";
  const { start, end } = buildEventTimes(opts.date, opts.timeSlot, opts.durationMin);
  try {
    const res = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: opts.summary,
        description: opts.description,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
      },
    });
    return res.data.id ?? null;
  } catch (e) {
    console.error("[GoogleCalendar] Failed to create event:", e);
    return null;
  }
}

export async function deleteCalendarEvent(userId: number, eventId: string): Promise<void> {
  const calendar = await getCalendarClient(userId);
  if (!calendar) return;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const calendarId = user?.googleCalendarId ?? "primary";
  try {
    await calendar.events.delete({ calendarId, eventId });
  } catch (e) {
    console.warn("[GoogleCalendar] Failed to delete event:", (e as Error).message);
  }
}

export async function getBusySlots(
  userId: number,
  date: string
): Promise<Array<{ start: Date; end: Date }>> {
  const calendar = await getCalendarClient(userId);
  if (!calendar) return [];
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const calendarId = user?.googleCalendarId ?? "primary";
  const dayStart = new Date(`${date}T00:00:00+03:00`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  try {
    const res = await calendar.freebusy.query({
      requestBody: {
        timeMin: dayStart.toISOString(),
        timeMax: dayEnd.toISOString(),
        items: [{ id: calendarId }],
      },
    });
    const busy = res.data.calendars?.[calendarId]?.busy ?? [];
    return busy
      .filter((b) => b.start && b.end)
      .map((b) => ({ start: new Date(b.start!), end: new Date(b.end!) }));
  } catch (e) {
    console.warn("[GoogleCalendar] freebusy failed:", (e as Error).message);
    return [];
  }
}

export async function fetchUserEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { email?: string };
    return data.email ?? null;
  } catch {
    return null;
  }
}
