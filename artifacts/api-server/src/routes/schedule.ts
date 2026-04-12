import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, workScheduleTable, appointmentsTable } from "@workspace/db";

const router: IRouter = Router();

const DAY_NAMES = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];

function generateTimeSlots(start: string, end: string, slotMinutes: number): string[] {
  const slots: string[] = [];
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);

  let current = sh * 60 + sm;
  const endMinutes = eh * 60 + em;

  while (current + slotMinutes <= endMinutes) {
    const h = Math.floor(current / 60).toString().padStart(2, "0");
    const m = (current % 60).toString().padStart(2, "0");
    slots.push(`${h}:${m}`);
    current += slotMinutes;
  }

  return slots;
}

router.get("/schedule", async (_req, res): Promise<void> => {
  const schedule = await db
    .select()
    .from(workScheduleTable)
    .orderBy(workScheduleTable.dayOfWeek);

  if (schedule.length === 0) {
    const defaultSchedule = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
      dayOfWeek: day,
      isWorking: day >= 1 && day <= 5,
      startTime: "09:00",
      endTime: "18:00",
      slotDuration: 30,
    }));
    res.json(defaultSchedule.map((d) => ({ ...d, id: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), dayName: DAY_NAMES[d.dayOfWeek] })));
    return;
  }

  res.json(schedule.map((s) => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    dayName: DAY_NAMES[s.dayOfWeek],
  })));
});

router.post("/schedule", async (req, res): Promise<void> => {
  const { days } = req.body;

  if (!Array.isArray(days)) {
    res.status(400).json({ error: "Ожидается массив days" });
    return;
  }

  const existing = await db.select().from(workScheduleTable);
  const existingMap = new Map(existing.map((e) => [e.dayOfWeek, e]));

  const results = [];
  for (const day of days) {
    const { dayOfWeek, isWorking, startTime, endTime, slotDuration } = day;
    const existingDay = existingMap.get(dayOfWeek);

    if (existingDay) {
      const [updated] = await db
        .update(workScheduleTable)
        .set({ isWorking, startTime, endTime, slotDuration })
        .where(eq(workScheduleTable.id, existingDay.id))
        .returning();
      results.push(updated);
    } else {
      const [created] = await db
        .insert(workScheduleTable)
        .values({ dayOfWeek, isWorking, startTime, endTime, slotDuration })
        .returning();
      results.push(created);
    }
  }

  res.json(results.map((s) => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    dayName: DAY_NAMES[s.dayOfWeek],
  })));
});

router.get("/schedule/available-slots", async (req, res): Promise<void> => {
  const { date } = req.query;
  if (!date || typeof date !== "string") {
    res.status(400).json({ error: "Укажите дату (YYYY-MM-DD)" });
    return;
  }

  const dateObj = new Date(date);
  const dayOfWeek = dateObj.getDay();

  const [daySchedule] = await db
    .select()
    .from(workScheduleTable)
    .where(eq(workScheduleTable.dayOfWeek, dayOfWeek));

  if (!daySchedule || !daySchedule.isWorking) {
    res.json({ date, slots: [], message: "Выходной день" });
    return;
  }

  const allSlots = generateTimeSlots(daySchedule.startTime, daySchedule.endTime, daySchedule.slotDuration);

  const booked = await db
    .select()
    .from(appointmentsTable)
    .where(and(eq(appointmentsTable.date, date), eq(appointmentsTable.status, "booked")));

  const bookedTimes = new Set(booked.map((b) => b.timeSlot));
  const freeSlots = allSlots.filter((s) => !bookedTimes.has(s));

  res.json({ date, slots: freeSlots, bookedSlots: [...bookedTimes] });
});

router.get("/appointments", async (_req, res): Promise<void> => {
  const appointments = await db
    .select()
    .from(appointmentsTable)
    .orderBy(appointmentsTable.date, appointmentsTable.timeSlot);

  res.json(appointments.map((a) => ({
    ...a,
    createdAt: a.createdAt.toISOString(),
  })));
});

router.post("/appointments", async (req, res): Promise<void> => {
  const { date, timeSlot, clientName, clientChatId, leadId } = req.body;
  if (!date || !timeSlot || !clientName) {
    res.status(400).json({ error: "Укажите дату, время и имя клиента" });
    return;
  }

  const [appointment] = await db
    .insert(appointmentsTable)
    .values({ date, timeSlot, clientName, clientChatId, leadId, status: "booked" })
    .returning();

  res.status(201).json({ ...appointment, createdAt: appointment.createdAt.toISOString() });
});

router.delete("/appointments/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Неверный ID" });
    return;
  }

  await db.delete(appointmentsTable).where(eq(appointmentsTable.id, id));
  res.sendStatus(204);
});

export { generateTimeSlots };
export default router;
