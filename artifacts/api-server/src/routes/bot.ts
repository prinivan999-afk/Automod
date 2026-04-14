import { Router, type IRouter } from "express";
import { desc, eq, and } from "drizzle-orm";
import { db, botAccountsTable, leadChatMessagesTable, leadsTable } from "@workspace/db";
import { SaveBotAccountBody } from "@workspace/api-zod";
import { getUserIdFromRequest } from "./auth-helper";

const router: IRouter = Router();

router.get("/bot/accounts", async (req, res): Promise<void> => {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "Требуется авторизация." });
    return;
  }

  const accounts = await db
    .select()
    .from(botAccountsTable)
    .where(eq(botAccountsTable.userId, userId))
    .orderBy(desc(botAccountsTable.updatedAt));

  res.json(accounts.map(formatBotAccount));
});

router.post("/bot/accounts", async (req, res): Promise<void> => {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "Требуется авторизация." });
    return;
  }

  const parsed = SaveBotAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;
  const existing = await db
    .select()
    .from(botAccountsTable)
    .where(and(eq(botAccountsTable.platform, data.platform), eq(botAccountsTable.userId, userId)))
    .limit(1);

  const values = {
    userId,
    platform: data.platform,
    accountName: data.accountName,
    accountHandle: data.accountHandle,
    notificationChat: data.notificationChat,
    isActive: data.isActive ?? true,
  };

  let account;
  if (existing.length > 0) {
    [account] = await db
      .update(botAccountsTable)
      .set(values)
      .where(and(eq(botAccountsTable.id, existing[0].id), eq(botAccountsTable.userId, userId)))
      .returning();
  } else {
    [account] = await db.insert(botAccountsTable).values(values).returning();
  }

  res.json(formatBotAccount(account));
});

router.get("/lead-chat/messages", async (req, res): Promise<void> => {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "Требуется авторизация." });
    return;
  }

  const messages = await db
    .select({ message: leadChatMessagesTable })
    .from(leadChatMessagesTable)
    .innerJoin(leadsTable, eq(leadChatMessagesTable.leadId, leadsTable.id))
    .where(eq(leadsTable.userId, userId))
    .orderBy(desc(leadChatMessagesTable.createdAt))
    .limit(50);

  res.json(messages.map((m) => formatLeadChatMessage(m.message)));
});

function formatBotAccount(account: typeof botAccountsTable.$inferSelect) {
  return {
    ...account,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

function formatLeadChatMessage(message: typeof leadChatMessagesTable.$inferSelect) {
  return {
    ...message,
    createdAt: message.createdAt.toISOString(),
  };
}

export default router;
