import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { randomBytes } from "crypto";
import { RegisterUserBody, GetUserProfileQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

router.post("/users/register", async (req, res): Promise<void> => {
  const parsed = RegisterUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { telegramUsername } = parsed.data;
  const cleanUsername = telegramUsername.replace(/^@/, "").toLowerCase().trim();

  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.telegramUsername, cleanUsername))
    .limit(1);

  if (existing.length > 0) {
    res.json(formatUser(existing[0]));
    return;
  }

  const apiToken = generateToken();
  const [user] = await db
    .insert(usersTable)
    .values({
      telegramUsername: cleanUsername,
      apiToken,
    })
    .returning();

  res.json(formatUser(user));
});

router.get("/users/profile", async (req, res): Promise<void> => {
  const parsed = GetUserProfileQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.apiToken, parsed.data.apiToken))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "Пользователь не найден" });
    return;
  }

  res.json(formatUser(user));
});

function formatUser(user: typeof usersTable.$inferSelect) {
  return {
    ...user,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export default router;
