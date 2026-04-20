import { type Request } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

const tokenCache = new Map<string, { userId: number; expiresAt: number }>();
const TOKEN_CACHE_TTL_MS = 5 * 60 * 1000;

export async function getUserIdFromRequest(req: Request): Promise<number | null> {
  let token: string | undefined;
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    token = auth.slice(7).trim();
  } else {
    const xToken = req.headers["x-api-token"];
    if (typeof xToken === "string") token = xToken.trim();
  }
  if (!token) return null;

  const now = Date.now();
  const cached = tokenCache.get(token);
  if (cached && cached.expiresAt > now) {
    return cached.userId;
  }

  const [user] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.apiToken, token))
    .limit(1);

  if (user?.id) {
    tokenCache.set(token, { userId: user.id, expiresAt: now + TOKEN_CACHE_TTL_MS });
  }

  return user?.id ?? null;
}
