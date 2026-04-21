import { Router, type IRouter } from "express";
import { eq, and, gte, lte } from "drizzle-orm";
import {
  db,
  workScheduleTable,
  appointmentsTable,
  scheduleOverridesTable,
  servicesTable,
} from "@workspace/db";
import { getUserIdFromRequest } from "./auth-helper";
import { getAvailableSlots, getEffectiveDay } from "../lib/schedule-engine";

const router: IRouter = Router();

const DAY_NAMES = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];

router.get("/schedule", async (req, res): Promise<void> => {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "Требуется авторизация." });
    return;
  }

  const schedule = await db
    .select()
    .from(workScheduleTable)
    .where(eq(workScheduleTable.userId, userId))
    .orderBy(workScheduleTable.dayOfWeek);

  if (schedule.length === 0) {
    const defaultSchedule = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
      dayOfWeek: day,
      isWorking: day >= 1 && day <= 5,
      startTime: "09:00",
      endTime: "18:00",
      slotDuration: 30,
      breakStart: null as string | null,
      breakEnd: null as string | null,
      bufferMinutes: 0,
    }));
    res.json(
      defaultSchedule.map((d) => ({
        ...d,
        id: 0,
        userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        dayName: DAY_NAMES[d.dayOfWeek],
      }))
    );
    return;
  }

  res.json(
    schedule.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      dayName: DAY_NAMES[s.dayOfWeek],
    }))
  );
});

router.post("/schedule", async (req, res): Promise<void> => {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "Требуется авторизация." });
    return;
  }

  const { days } = req.body;

  if (!Array.isArray(days)) {
    res.status(400).json({ error: "Ожидается массив days" });
    return;
  }

  const existing = await db
    .select()
    .from(workScheduleTable)
    .where(eq(workScheduleTable.userId, userId));
  const existingMap = new Map(existing.map((e) => [e.dayOfWeek, e]));

  const results = [];
  for (const day of days) {
    const {
      dayOfWeek,
      isWorking,
      startTime,
      endTime,
      slotDuration,
      breakStart,
      breakEnd,
      bufferMinutes,
    } = day;
    const existingDay = existingMap.get(dayOfWeek);

    const values = {
      isWorking,
      startTime,
      endTime,
      slotDuration,
      breakStart: breakStart || null,
      breakEnd: breakEnd || null,
      bufferMinutes: bufferMinutes ?? 0,
    };

    if (existingDay) {
      const [updated] = await db
        .update(workScheduleTable)
        .set(values)
        .where(and(eq(workScheduleTable.id, existingDay.id), eq(workScheduleTable.userId, userId)))
        .returning();
      results.push(updated);
    } else {
      const [created] = await db
        .insert(workScheduleTable)
        .values({ userId, dayOfWeek, ...values })
        .returning();
      results.push(created);
    }
  }

  res.json(
    results.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      dayName: DAY_NAMES[s.dayOfWeek],
    }))
  );
});

router.get("/schedule/available-slots", async (req, res): Promise<void> => {
  const { date, userId: queryUserId, serviceId, duration } = req.query;
  if (!date || typeof date !== "string") {
    res.status(400).json({ error: "Укажите дату (YYYY-MM-DD)" });
    return;
  }

  const resolvedUserId = queryUserId
    ? parseInt(queryUserId as string)
    : await getUserIdFromRequest(req);
  if (!resolvedUserId) {
    res.status(400).json({ error: "Укажите userId или пройдите авторизацию" });
    return;
  }

  let dur: number | undefined;
  if (serviceId) {
    const [svc] = await db
      .select()
      .from(servicesTable)
      .where(and(eq(servicesTable.id, parseInt(serviceId as string)), eq(servicesTable.userId, resolvedUserId)))
      .limit(1);
    if (svc) dur = svc.durationMinutes;
  } else if (duration) {
    dur = parseInt(duration as string);
  }

  const result = await getAvailableSlots(resolvedUserId, date, dur);
  res.json({ date, ...result });
});

// === Date overrides (holidays / custom hours) ===
router.get("/schedule/overrides", async (req, res): Promise<void> => {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "Требуется авторизация." });
    return;
  }

  const { from, to } = req.query;
  const conditions = [eq(scheduleOverridesTable.userId, userId)];
  if (typeof from === "string") conditions.push(gte(scheduleOverridesTable.date, from));
  if (typeof to === "string") conditions.push(lte(scheduleOverridesTable.date, to));

  const overrides = await db
    .select()
    .from(scheduleOverridesTable)
    .where(and(...conditions))
    .orderBy(scheduleOverridesTable.date);

  res.json(
    overrides.map((o) => ({
      ...o,
      createdAt: o.createdAt.toISOString(),
    }))
  );
});

router.post("/schedule/overrides", async (req, res): Promise<void> => {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "Требуется авторизация." });
    return;
  }

  const { date, isWorking, startTime, endTime, note } = req.body;
  if (!date || typeof date !== "string") {
    res.status(400).json({ error: "Укажите дату (YYYY-MM-DD)" });
    return;
  }

  const values = {
    userId,
    date,
    isWorking: !!isWorking,
    startTime: startTime || null,
    endTime: endTime || null,
    note: note || null,
  };

  const [existing] = await db
    .select()
    .from(scheduleOverridesTable)
    .where(and(eq(scheduleOverridesTable.userId, userId), eq(scheduleOverridesTable.date, date)))
    .limit(1);

  let row;
  if (existing) {
    [row] = await db
      .update(scheduleOverridesTable)
      .set(values)
      .where(eq(scheduleOverridesTable.id, existing.id))
      .returning();
  } else {
    [row] = await db.insert(scheduleOverridesTable).values(values).returning();
  }

  res.json({ ...row, createdAt: row.createdAt.toISOString() });
});

router.delete("/schedule/overrides/:id", async (req, res): Promise<void> => {
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
    .delete(scheduleOverridesTable)
    .where(and(eq(scheduleOverridesTable.id, id), eq(scheduleOverridesTable.userId, userId)));
  res.sendStatus(204);
});

// === Appointments ===
router.get("/appointments", async (req, res): Promise<void> => {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "Требуется авторизация." });
    return;
  }

  const { from, to } = req.query;
  const conditions = [eq(appointmentsTable.userId, userId)];
  if (typeof from === "string") conditions.push(gte(appointmentsTable.date, from));
  if (typeof to === "string") conditions.push(lte(appointmentsTable.date, to));

  const appointments = await db
    .select()
    .from(appointmentsTable)
    .where(and(...conditions))
    .orderBy(appointmentsTable.date, appointmentsTable.timeSlot);

  res.json(
    appointments.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    }))
  );
});

router.post("/appointments", async (req, res): Promise<void> => {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "Требуется авторизация." });
    return;
  }

  const { date, timeSlot, clientName, clientChatId, leadId, service, phone, serviceId } = req.body;
  if (!date || !timeSlot || !clientName) {
    res.status(400).json({ error: "Укажите дату, время и имя клиента" });
    return;
  }

  let durationMinutes = 30;
  let serviceName: string | null = service ?? null;
  if (serviceId) {
    const [svc] = await db
      .select()
      .from(servicesTable)
      .where(and(eq(servicesTable.id, parseInt(String(serviceId))), eq(servicesTable.userId, userId)))
      .limit(1);
    if (svc) {
      durationMinutes = svc.durationMinutes;
      serviceName = svc.name;
    }
  } else {
    const day = await getEffectiveDay(userId, date);
    durationMinutes = day.slotDuration;
  }

  const [appointment] = await db
    .insert(appointmentsTable)
    .values({
      userId,
      date,
      timeSlot,
      clientName,
      clientChatId,
      leadId,
      service: serviceName,
      serviceId: serviceId ? parseInt(String(serviceId)) : undefined,
      durationMinutes,
      phone,
      status: "booked",
    })
    .returning();

  res.status(201).json({ ...appointment, createdAt: appointment.createdAt.toISOString() });
});

router.delete("/appointments/:id", async (req, res): Promise<void> => {
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
    .delete(appointmentsTable)
    .where(and(eq(appointmentsTable.id, id), eq(appointmentsTable.userId, userId)));

  res.sendStatus(204);
});

export default router;
