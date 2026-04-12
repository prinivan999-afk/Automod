import { Router, type IRouter } from "express";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { db, leadsTable } from "@workspace/db";
import {
  ListLeadsQueryParams,
  CreateLeadBody,
  GetLeadParams,
  UpdateLeadBody,
  UpdateLeadParams,
  DeleteLeadParams,
  UpdateLeadStatusParams,
  UpdateLeadStatusBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/leads", async (req, res): Promise<void> => {
  const parsed = ListLeadsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { status, platform, dateFrom, dateTo } = parsed.data;

  const conditions = [];
  if (status) conditions.push(eq(leadsTable.status, status));
  if (platform) conditions.push(eq(leadsTable.platform, platform));
  if (dateFrom) conditions.push(gte(leadsTable.createdAt, new Date(dateFrom)));
  if (dateTo) conditions.push(lte(leadsTable.createdAt, new Date(dateTo)));

  const leads = await db
    .select()
    .from(leadsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(leadsTable.createdAt);

  res.json(leads.map(formatLead));
});

router.post("/leads", async (req, res): Promise<void> => {
  const parsed = CreateLeadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;
  const isPriority = data.isPriority ?? (data.status === "hot");

  const [lead] = await db
    .insert(leadsTable)
    .values({
      clientName: data.clientName,
      platform: data.platform,
      service: data.service,
      details: data.details ?? null,
      quantity: data.quantity ?? null,
      deadline: data.deadline ?? null,
      price: data.price ?? null,
      comment: data.comment ?? null,
      status: data.status,
      recommendation: data.recommendation ?? generateRecommendation(data.status),
      isPriority,
    })
    .returning();

  res.status(201).json(formatLead(lead));
});

router.get("/leads/:id", async (req, res): Promise<void> => {
  const params = GetLeadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [lead] = await db
    .select()
    .from(leadsTable)
    .where(eq(leadsTable.id, params.data.id));

  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }

  res.json(formatLead(lead));
});

router.patch("/leads/:id", async (req, res): Promise<void> => {
  const params = UpdateLeadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateLeadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Partial<typeof leadsTable.$inferInsert> = {};
  const data = parsed.data;
  if (data.clientName !== undefined) updateData.clientName = data.clientName;
  if (data.platform !== undefined) updateData.platform = data.platform;
  if (data.service !== undefined) updateData.service = data.service;
  if (data.details !== undefined) updateData.details = data.details;
  if (data.quantity !== undefined) updateData.quantity = data.quantity;
  if (data.deadline !== undefined) updateData.deadline = data.deadline;
  if (data.price !== undefined) updateData.price = data.price;
  if (data.comment !== undefined) updateData.comment = data.comment;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.recommendation !== undefined) updateData.recommendation = data.recommendation;
  if (data.isPriority !== undefined) updateData.isPriority = data.isPriority;

  const [lead] = await db
    .update(leadsTable)
    .set(updateData)
    .where(eq(leadsTable.id, params.data.id))
    .returning();

  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }

  res.json(formatLead(lead));
});

router.delete("/leads/:id", async (req, res): Promise<void> => {
  const params = DeleteLeadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [lead] = await db
    .delete(leadsTable)
    .where(eq(leadsTable.id, params.data.id))
    .returning();

  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }

  res.sendStatus(204);
});

router.patch("/leads/:id/status", async (req, res): Promise<void> => {
  const params = UpdateLeadStatusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateLeadStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const newStatus = parsed.data.status;
  const [lead] = await db
    .update(leadsTable)
    .set({
      status: newStatus,
      isPriority: newStatus === "hot",
      recommendation: generateRecommendation(newStatus),
    })
    .where(eq(leadsTable.id, params.data.id))
    .returning();

  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }

  res.json(formatLead(lead));
});

router.get("/analytics/summary", async (_req, res): Promise<void> => {
  const [totals] = await db
    .select({
      total: sql<number>`count(*)::int`,
      hot: sql<number>`count(*) filter (where status = 'hot')::int`,
      warm: sql<number>`count(*) filter (where status = 'warm')::int`,
      cold: sql<number>`count(*) filter (where status = 'cold')::int`,
      priority: sql<number>`count(*) filter (where is_priority = true)::int`,
      today: sql<number>`count(*) filter (where created_at >= current_date)::int`,
    })
    .from(leadsTable);

  const allLeads = await db.select({ price: leadsTable.price }).from(leadsTable);
  const prices = allLeads
    .map((l) => parseFloat(l.price ?? ""))
    .filter((p) => !isNaN(p));
  const averagePrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : null;

  res.json({
    totalLeads: totals?.total ?? 0,
    hotLeads: totals?.hot ?? 0,
    warmLeads: totals?.warm ?? 0,
    coldLeads: totals?.cold ?? 0,
    averagePrice,
    priorityLeads: totals?.priority ?? 0,
    todayLeads: totals?.today ?? 0,
  });
});

router.get("/analytics/by-platform", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      platform: leadsTable.platform,
      count: sql<number>`count(*)::int`,
    })
    .from(leadsTable)
    .groupBy(leadsTable.platform);

  res.json(rows);
});

router.get("/analytics/by-status", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      status: leadsTable.status,
      count: sql<number>`count(*)::int`,
    })
    .from(leadsTable)
    .groupBy(leadsTable.status);

  res.json(rows);
});

router.get("/analytics/recent", async (_req, res): Promise<void> => {
  const leads = await db
    .select()
    .from(leadsTable)
    .orderBy(leadsTable.createdAt)
    .limit(10);

  res.json(leads.map(formatLead));
});

function formatLead(lead: typeof leadsTable.$inferSelect) {
  return {
    ...lead,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  };
}

function generateRecommendation(status: string): string {
  switch (status) {
    case "hot":
      return "Связаться как можно быстрее — клиент готов купить";
    case "warm":
      return "Уточнить детали заказа и ответить на вопросы";
    case "cold":
      return "Предложить скидку или альтернативный вариант";
    default:
      return "Уточнить статус клиента";
  }
}

export default router;
