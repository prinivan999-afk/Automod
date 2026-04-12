import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, botAccountsTable, leadChatMessagesTable } from "@workspace/db";
import { SaveBotAccountBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/bot/accounts", async (_req, res): Promise<void> => {
  const accounts = await db
    .select()
    .from(botAccountsTable)
    .orderBy(desc(botAccountsTable.updatedAt));

  res.json(accounts.map(formatBotAccount));
});

router.post("/bot/accounts", async (req, res): Promise<void> => {
  const parsed = SaveBotAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;
  const existing = await db
    .select()
    .from(botAccountsTable)
    .where(eq(botAccountsTable.platform, data.platform))
    .limit(1);

  const values = {
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
      .where(eq(botAccountsTable.id, existing[0].id))
      .returning();
  } else {
    [account] = await db.insert(botAccountsTable).values(values).returning();
  }

  res.json(formatBotAccount(account));
});

router.get("/lead-chat/messages", async (_req, res): Promise<void> => {
  const messages = await db
    .select()
    .from(leadChatMessagesTable)
    .orderBy(desc(leadChatMessagesTable.createdAt))
    .limit(50);

  res.json(messages.map(formatLeadChatMessage));
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