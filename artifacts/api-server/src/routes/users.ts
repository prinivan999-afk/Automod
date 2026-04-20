import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { randomBytes } from "crypto";
import { RegisterUserBody, GetUserProfileQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

let cachedBotUsername: string | null = process.env.TELEGRAM_BOT_USERNAME ?? null;

export function setBotUsername(username: string) {
  cachedBotUsername = username;
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

function generateVerificationCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
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
    const existingUser = existing[0];

    if (existingUser.telegramUsernameVerified) {
      res.status(409).json({
        error: `Аккаунт @${cleanUsername} уже зарегистрирован и верифицирован.`,
      });
      return;
    }

    res.json(formatUser(existingUser));
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

router.post("/users/regenerate-token", async (req, res): Promise<void> => {
  const apiToken = req.body?.apiToken as string | undefined;
  if (!apiToken) {
    res.status(400).json({ error: "apiToken обязателен" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.apiToken, apiToken))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "Пользователь не найден" });
    return;
  }

  const newToken = generateToken();
  const [updated] = await db
    .update(usersTable)
    .set({ apiToken: newToken })
    .where(eq(usersTable.id, user.id))
    .returning();

  res.json(formatUser(updated));
});

router.post("/users/request-verification", async (req, res): Promise<void> => {
  const apiToken = req.body?.apiToken as string | undefined;
  if (!apiToken) {
    res.status(400).json({ error: "apiToken обязателен" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.apiToken, apiToken))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "Пользователь не найден" });
    return;
  }

  if (user.telegramUsernameVerified) {
    res.json({ alreadyVerified: true, botUsername: cachedBotUsername });
    return;
  }

  const code = generateVerificationCode();
  await db
    .update(usersTable)
    .set({ verificationCode: code })
    .where(eq(usersTable.id, user.id));

  res.json({ code, botUsername: cachedBotUsername });
});

router.get("/users/bot-username", async (_req, res): Promise<void> => {
  res.json({ botUsername: cachedBotUsername });
});

function formatUser(user: typeof usersTable.$inferSelect) {
  return {
    ...user,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export default router;
