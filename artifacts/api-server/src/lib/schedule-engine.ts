import { and, eq } from "drizzle-orm";
import {
  db,
  workScheduleTable,
  scheduleOverridesTable,
  appointmentsTable,
} from "@workspace/db";

export interface EffectiveDay {
  isWorking: boolean;
  startTime: string;
  endTime: string;
  slotDuration: number;
  breakStart: string | null;
  breakEnd: string | null;
  bufferMinutes: number;
  source: "default" | "weekly" | "override";
  note?: string | null;
}

const DEFAULT_DAY: Omit<EffectiveDay, "isWorking" | "source"> = {
  startTime: "09:00",
  endTime: "18:00",
  slotDuration: 30,
  breakStart: null,
  breakEnd: null,
  bufferMinutes: 0,
};

function toMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function toHHMM(min: number): string {
  const h = Math.floor(min / 60).toString().padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export async function getEffectiveDay(userId: number, date: string): Promise<EffectiveDay> {
  const dateObj = new Date(date + "T00:00:00");
  const dayOfWeek = dateObj.getDay();

  const [override] = await db
    .select()
    .from(scheduleOverridesTable)
    .where(and(eq(scheduleOverridesTable.userId, userId), eq(scheduleOverridesTable.date, date)))
    .limit(1);

  const [weekly] = await db
    .select()
    .from(workScheduleTable)
    .where(and(eq(workScheduleTable.userId, userId), eq(workScheduleTable.dayOfWeek, dayOfWeek)))
    .limit(1);

  if (override) {
    if (!override.isWorking) {
      return {
        isWorking: false,
        ...DEFAULT_DAY,
        source: "override",
        note: override.note,
      };
    }
    return {
      isWorking: true,
      startTime: override.startTime ?? weekly?.startTime ?? DEFAULT_DAY.startTime,
      endTime: override.endTime ?? weekly?.endTime ?? DEFAULT_DAY.endTime,
      slotDuration: weekly?.slotDuration ?? DEFAULT_DAY.slotDuration,
      breakStart: weekly?.breakStart ?? null,
      breakEnd: weekly?.breakEnd ?? null,
      bufferMinutes: weekly?.bufferMinutes ?? 0,
      source: "override",
      note: override.note,
    };
  }

  if (!weekly) {
    return {
      isWorking: dayOfWeek >= 1 && dayOfWeek <= 5,
      ...DEFAULT_DAY,
      source: "default",
    };
  }

  return {
    isWorking: weekly.isWorking,
    startTime: weekly.startTime,
    endTime: weekly.endTime,
    slotDuration: weekly.slotDuration,
    breakStart: weekly.breakStart,
    breakEnd: weekly.breakEnd,
    bufferMinutes: weekly.bufferMinutes,
    source: "weekly",
  };
}

export function generateSlotsForDay(
  day: EffectiveDay,
  durationMinutes?: number
): string[] {
  if (!day.isWorking) return [];
  const dur = durationMinutes ?? day.slotDuration;
  const stride = day.slotDuration;
  const slots: string[] = [];
  const start = toMin(day.startTime);
  const end = toMin(day.endTime);
  const breakS = day.breakStart ? toMin(day.breakStart) : null;
  const breakE = day.breakEnd ? toMin(day.breakEnd) : null;

  let cur = start;
  while (cur + dur <= end) {
    const slotEnd = cur + dur;
    const overlapsBreak =
      breakS !== null && breakE !== null && cur < breakE && slotEnd > breakS;
    if (!overlapsBreak) {
      slots.push(toHHMM(cur));
    }
    cur += stride;
  }
  return slots;
}

export async function getAvailableSlots(
  userId: number,
  date: string,
  durationMinutes?: number
): Promise<{ slots: string[]; bookedSlots: string[]; isWorking: boolean; note?: string | null }> {
  const day = await getEffectiveDay(userId, date);
  if (!day.isWorking) {
    return { slots: [], bookedSlots: [], isWorking: false, note: day.note };
  }

  const dur = durationMinutes ?? day.slotDuration;
  const allSlots = generateSlotsForDay(day, dur);

  const booked = await db
    .select()
    .from(appointmentsTable)
    .where(
      and(
        eq(appointmentsTable.userId, userId),
        eq(appointmentsTable.date, date),
        eq(appointmentsTable.status, "booked")
      )
    );

  // Block by booked + buffer
  const blockedRanges = booked.map((b) => {
    const s = toMin(b.timeSlot);
    return {
      start: s - day.bufferMinutes,
      end: s + b.durationMinutes + day.bufferMinutes,
    };
  });

  const bookedTimes = new Set(booked.map((b) => b.timeSlot));

  const free = allSlots.filter((t) => {
    const s = toMin(t);
    const e = s + dur;
    return !blockedRanges.some((r) => s < r.end && e > r.start);
  });

  return {
    slots: free,
    bookedSlots: [...bookedTimes],
    isWorking: true,
    note: day.note,
  };
}
