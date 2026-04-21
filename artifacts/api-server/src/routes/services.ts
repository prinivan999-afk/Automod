import { Router, type IRouter } from "express";
import { and, asc, eq } from "drizzle-orm";
import { db, servicesTable } from "@workspace/db";
import { getUserIdFromRequest } from "./auth-helper";

const router: IRouter = Router();

router.get("/services", async (req, res): Promise<void> => {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "Требуется авторизация." });
    return;
  }
  const services = await db
    .select()
    .from(servicesTable)
    .where(eq(servicesTable.userId, userId))
    .orderBy(asc(servicesTable.sortOrder), asc(servicesTable.id));
  res.json(
    services.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }))
  );
});

// Public endpoint for the bot to fetch a seller's active services
router.get("/services/public", async (req, res): Promise<void> => {
  const userIdParam = req.query.userId;
  if (!userIdParam) {
    res.status(400).json({ error: "userId обязателен" });
    return;
  }
  const userId = parseInt(String(userIdParam));
  if (isNaN(userId)) {
    res.status(400).json({ error: "Неверный userId" });
    return;
  }
  const services = await db
    .select({
      id: servicesTable.id,
      name: servicesTable.name,
      durationMinutes: servicesTable.durationMinutes,
      price: servicesTable.price,
    })
    .from(servicesTable)
    .where(and(eq(servicesTable.userId, userId), eq(servicesTable.active, true)))
    .orderBy(asc(servicesTable.sortOrder), asc(servicesTable.id));
  res.json(services);
});

router.post("/services", async (req, res): Promise<void> => {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "Требуется авторизация." });
    return;
  }
  const { name, durationMinutes, price, active, sortOrder } = req.body;
  if (!name || !durationMinutes) {
    res.status(400).json({ error: "Укажите name и durationMinutes" });
    return;
  }
  const [created] = await db
    .insert(servicesTable)
    .values({
      userId,
      name: String(name).trim(),
      durationMinutes: parseInt(String(durationMinutes)),
      price: price ? String(price) : null,
      active: active !== false,
      sortOrder: sortOrder ?? 0,
    })
    .returning();
  res.status(201).json({
    ...created,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
  });
});

router.put("/services/:id", async (req, res): Promise<void> => {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "Требуется авторизация." });
    return;
  }
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Неверный ID" });
    return;
  }
  const { name, durationMinutes, price, active, sortOrder } = req.body;
  const patch: Record<string, unknown> = {};
  if (name !== undefined) patch.name = String(name).trim();
  if (durationMinutes !== undefined) patch.durationMinutes = parseInt(String(durationMinutes));
  if (price !== undefined) patch.price = price ? String(price) : null;
  if (active !== undefined) patch.active = !!active;
  if (sortOrder !== undefined) patch.sortOrder = parseInt(String(sortOrder));

  const [updated] = await db
    .update(servicesTable)
    .set(patch)
    .where(and(eq(servicesTable.id, id), eq(servicesTable.userId, userId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Услуга не найдена" });
    return;
  }
  res.json({
    ...updated,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
});

router.delete("/services/:id", async (req, res): Promise<void> => {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "Требуется авторизация." });
    return;
  }
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Неверный ID" });
    return;
  }
  await db
    .delete(servicesTable)
    .where(and(eq(servicesTable.id, id), eq(servicesTable.userId, userId)));
  res.sendStatus(204);
});

export default router;
