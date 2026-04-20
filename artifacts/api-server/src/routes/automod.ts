import { Router } from "express";
import { eq, desc, and, sql } from "drizzle-orm";
import { db, businessConnectionsTable, automodSettingsTable, automodMessagesTable } from "@workspace/db";
import {
  SaveAutomodSettingsBody,
  ToggleAutomodConnectionBody,
} from "@workspace/api-zod";
import { getUserIdFromRequest } from "./auth-helper";

const router = Router();

async function getOrCreateSettings(userId: number) {
  const [existing] = await db
    .select()
    .from(automodSettingsTable)
    .where(eq(automodSettingsTable.userId, userId))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(automodSettingsTable)
    .values({
      userId,
      aiName: "Ассистент",
      systemPrompt: "Ты вежливый и полезный ассистент для бизнеса. Отвечай кратко и по делу. Если не знаешь ответ — попроси клиента обратиться к менеджеру.",
      tone: "friendly",
      isEnabled: true,
    })
    .returning();
  return created;
}

router.get("/automod/settings", async (req, res): Promise<void> => {
  const userId = await getUserIdFromRequest(req);
  if (!userId) { res.status(401).json({ error: "Требуется авторизация" }); return; }
  const settings = await getOrCreateSettings(userId);
  res.json({
    ...settings,
    createdAt: settings.createdAt.toISOString(),
    updatedAt: settings.updatedAt.toISOString(),
  });
});

router.post("/automod/settings", async (req, res): Promise<void> => {
  const userId = await getUserIdFromRequest(req);
  if (!userId) { res.status(401).json({ error: "Требуется авторизация" }); return; }

  const parsed = SaveAutomodSettingsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const existing = await getOrCreateSettings(userId);
  const [updated] = await db
    .update(automodSettingsTable)
    .set(parsed.data)
    .where(eq(automodSettingsTable.id, existing.id))
    .returning();

  res.json({
    ...updated,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
});

router.get("/automod/connections", async (req, res): Promise<void> => {
  const userId = await getUserIdFromRequest(req);
  if (!userId) { res.status(401).json({ error: "Требуется авторизация" }); return; }

  const connections = await db
    .select()
    .from(businessConnectionsTable)
    .where(eq(businessConnectionsTable.userId, userId))
    .orderBy(desc(businessConnectionsTable.createdAt));

  res.json(connections.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  })));
});

router.patch("/automod/connections/:id/toggle", async (req, res): Promise<void> => {
  const userId = await getUserIdFromRequest(req);
  if (!userId) { res.status(401).json({ error: "Требуется авторизация" }); return; }

  const id = parseInt(req.params.id, 10);
  const parsed = ToggleAutomodConnectionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [updated] = await db
    .update(businessConnectionsTable)
    .set({ isEnabled: parsed.data.isEnabled })
    .where(and(eq(businessConnectionsTable.id, id), eq(businessConnectionsTable.userId, userId)))
    .returning();

  if (!updated) { res.status(404).json({ error: "Подключение не найдено" }); return; }

  res.json({
    ...updated,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
});

router.get("/automod/activity", async (req, res): Promise<void> => {
  const userId = await getUserIdFromRequest(req);
  if (!userId) { res.status(401).json({ error: "Требуется авторизация" }); return; }

  const connections = await db
    .select({ businessConnectionId: businessConnectionsTable.businessConnectionId })
    .from(businessConnectionsTable)
    .where(eq(businessConnectionsTable.userId, userId));

  const connectionIds = connections.map((c) => c.businessConnectionId);

  if (connectionIds.length === 0) { res.json([]); return; }

  const messages = await db
    .select()
    .from(automodMessagesTable)
    .where(
      sql`${automodMessagesTable.businessConnectionId} = ANY(ARRAY[${sql.join(connectionIds.map((id) => sql`${id}`), sql`, `)}]::text[])`
    )
    .orderBy(desc(automodMessagesTable.createdAt))
    .limit(50);

  res.json(messages.map((m) => ({
    ...m,
    createdAt: m.createdAt.toISOString(),
  })));
});

router.get("/automod/stats", async (req, res): Promise<void> => {
  const userId = await getUserIdFromRequest(req);
  if (!userId) { res.status(401).json({ error: "Требуется авторизация" }); return; }

  const settings = await getOrCreateSettings(userId);

  const connections = await db
    .select()
    .from(businessConnectionsTable)
    .where(eq(businessConnectionsTable.userId, userId));

  const totalConnections = connections.length;
  const activeConnections = connections.filter((c) => c.isEnabled).length;
  const totalMessagesHandled = connections.reduce((sum, c) => sum + (c.messagesHandled ?? 0), 0);

  const connectionIds = connections.map((c) => c.businessConnectionId);
  let todayMessages = 0;
  if (connectionIds.length > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const countResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(automodMessagesTable)
      .where(
        sql`${automodMessagesTable.businessConnectionId} = ANY(ARRAY[${sql.join(connectionIds.map((id) => sql`${id}`), sql`, `)}]::text[])
          AND ${automodMessagesTable.createdAt} >= ${today}`
      );
    todayMessages = Number(countResult[0]?.count ?? 0);
  }

  res.json({
    totalConnections,
    activeConnections,
    totalMessagesHandled,
    todayMessages,
    isGlobalEnabled: settings.isEnabled,
  });
});

export default router;
