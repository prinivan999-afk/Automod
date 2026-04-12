import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, usersTable, licenseKeysTable } from "@workspace/db";
import { randomBytes } from "crypto";

const router: IRouter = Router();

const TRIAL_DAYS = 3;
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "automind-admin-2024";

function calcLicenseStatus(user: typeof usersTable.$inferSelect): {
  status: "trial" | "active" | "expired" | "none";
  daysLeft: number | null;
  expiresAt: string | null;
  trialStartedAt: string | null;
} {
  const now = new Date();

  if (user.subscriptionExpiresAt && user.subscriptionExpiresAt > now) {
    const msLeft = user.subscriptionExpiresAt.getTime() - now.getTime();
    const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

    if (user.trialStartedAt) {
      const trialEnd = new Date(user.trialStartedAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
      const isPaidActive = user.subscriptionExpiresAt > trialEnd;
      return {
        status: isPaidActive ? "active" : "trial",
        daysLeft,
        expiresAt: user.subscriptionExpiresAt.toISOString(),
        trialStartedAt: user.trialStartedAt.toISOString(),
      };
    }

    return {
      status: "active",
      daysLeft,
      expiresAt: user.subscriptionExpiresAt.toISOString(),
      trialStartedAt: null,
    };
  }

  if (user.trialStartedAt) {
    return {
      status: "expired",
      daysLeft: 0,
      expiresAt: user.subscriptionExpiresAt?.toISOString() ?? null,
      trialStartedAt: user.trialStartedAt.toISOString(),
    };
  }

  return { status: "none", daysLeft: null, expiresAt: null, trialStartedAt: null };
}

router.get("/license/status", async (req, res): Promise<void> => {
  const { apiToken } = req.query as Record<string, string>;
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

  res.json(calcLicenseStatus(user));
});

router.post("/license/activate", async (req, res): Promise<void> => {
  const { apiToken, licenseKey } = req.body as { apiToken?: string; licenseKey?: string };

  if (!apiToken || !licenseKey) {
    res.status(400).json({ error: "apiToken и licenseKey обязательны" });
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

  const cleanKey = licenseKey.trim().toUpperCase();

  const [license] = await db
    .select()
    .from(licenseKeysTable)
    .where(eq(licenseKeysTable.key, cleanKey))
    .limit(1);

  if (!license) {
    res.status(400).json({ error: "Ключ не найден. Проверьте правильность ключа." });
    return;
  }

  if (license.isUsed && license.usedByUserId !== user.id) {
    res.status(400).json({ error: "Этот ключ уже был использован другим аккаунтом." });
    return;
  }

  const now = new Date();
  const currentExpiry = user.subscriptionExpiresAt && user.subscriptionExpiresAt > now
    ? user.subscriptionExpiresAt
    : now;

  const newExpiry = new Date(currentExpiry.getTime() + license.durationDays * 24 * 60 * 60 * 1000);

  const updateData: Partial<typeof usersTable.$inferInsert> = {
    subscriptionExpiresAt: newExpiry,
  };

  if (!user.trialStartedAt && license.type === "trial") {
    updateData.trialStartedAt = now;
  }

  await db.update(usersTable).set(updateData).where(eq(usersTable.id, user.id));

  if (!license.isUsed) {
    await db
      .update(licenseKeysTable)
      .set({ isUsed: true, usedByUserId: user.id, activatedAt: now })
      .where(eq(licenseKeysTable.id, license.id));
  }

  const [updated] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, user.id))
    .limit(1);

  res.json(calcLicenseStatus(updated));
});

router.post("/license/generate", async (req, res): Promise<void> => {
  const { adminSecret, count, durationDays } = req.body as {
    adminSecret?: string;
    count?: number;
    durationDays?: number;
  };

  if (adminSecret !== ADMIN_SECRET) {
    res.status(403).json({ error: "Доступ запрещён" });
    return;
  }

  const safeCount = Math.min(Math.max(Number(count) || 1, 1), 100);
  const safeDays = Math.max(Number(durationDays) || 30, 1);

  const keys: string[] = [];
  for (let i = 0; i < safeCount; i++) {
    const raw = randomBytes(12).toString("hex").toUpperCase();
    keys.push(`AM-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`);
  }

  await db.insert(licenseKeysTable).values(
    keys.map((key) => ({ key, type: "paid" as const, durationDays: safeDays }))
  );

  res.json({ keys, count: keys.length });
});

router.post("/license/start-trial", async (req, res): Promise<void> => {
  const { apiToken } = req.body as { apiToken?: string };

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

  if (user.trialStartedAt) {
    res.status(400).json({ error: "Пробный период уже был использован." });
    return;
  }

  const now = new Date();
  const trialExpiry = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  await db
    .update(usersTable)
    .set({ trialStartedAt: now, subscriptionExpiresAt: trialExpiry })
    .where(eq(usersTable.id, user.id));

  const [updated] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, user.id))
    .limit(1);

  res.json(calcLicenseStatus(updated));
});

export default router;
