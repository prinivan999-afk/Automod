import TelegramBot from "node-telegram-bot-api";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";
import {
  db,
  usersTable,
  tariffSettingsTable,
  leadsTable,
  leadChatMessagesTable,
  workScheduleTable,
  appointmentsTable,
  botConversationsTable,
  telegramProcessedUpdatesTable,
} from "@workspace/db";
import { sql } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

type BotMessage = { role: "user" | "model"; parts: Array<{ text: string }> };

const DEFAULT_GREETING = "Здравствуйте! Я ваш дружелюбный AI-помощник. Чем могу помочь?";

const CLIENT_MAIN_KEYBOARD = {
  inline_keyboard: [
    [
      { text: "📋 Каталог / Услуги", callback_data: "menu_catalog" },
      { text: "💰 Узнать цену", callback_data: "menu_price" },
    ],
    [
      { text: "🛒 Оформить заказ", callback_data: "menu_order" },
      { text: "📅 Расписание", callback_data: "menu_schedule" },
    ],
    [
      { text: "📞 Связаться с менеджером", callback_data: "menu_contact" },
    ],
  ],
};

async function getConversation(chatId: string) {
  const [conv] = await db
    .select()
    .from(botConversationsTable)
    .where(eq(botConversationsTable.userChatId, chatId))
    .limit(1);
  return conv ?? null;
}

async function upsertConversation(chatId: string, data: Partial<typeof botConversationsTable.$inferInsert>) {
  const existing = await getConversation(chatId);
  if (existing) {
    const [updated] = await db
      .update(botConversationsTable)
      .set(data)
      .where(eq(botConversationsTable.userChatId, chatId))
      .returning();
    return updated;
  } else {
    const [created] = await db
      .insert(botConversationsTable)
      .values({ userChatId: chatId, messages: "[]", status: "waiting_seller", ...data })
      .returning();
    return created;
  }
}

async function addMessage(chatId: string, msg: BotMessage) {
  const conv = await getConversation(chatId);
  if (!conv) return;
  const messages: BotMessage[] = JSON.parse(conv.messages || "[]");
  messages.push(msg);
  await db
    .update(botConversationsTable)
    .set({ messages: JSON.stringify(messages) })
    .where(eq(botConversationsTable.userChatId, chatId));
  return messages;
}

async function generateGreeting(botPrompt: string, priceList: string | null): Promise<string> {
  const priceListIntro = priceList ? `\n\nПрайс-лист товаров/услуг:\n${priceList}` : "";
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${botPrompt}${priceListIntro}\n\nПоздоровайся с клиентом коротко и тепло. Сразу спроси, как к нему можно обращаться (имя). Скажи, что можешь помочь с выбором, ценами или оформлением заказа. Не перечисляй пункты меню — клиент сам выберет кнопку.\n\nВАЖНО: Пиши обычным текстом без какого-либо форматирования. Не используй звёздочки, подчёркивания, решётки и другие символы markdown.`,
            },
          ],
        },
      ],
      config: { maxOutputTokens: 8192 },
    });
    return response.text ?? DEFAULT_GREETING;
  } catch {
    return DEFAULT_GREETING;
  }
}

async function getSellerByUsername(username: string) {
  const clean = username.replace(/^@/, "").toLowerCase().trim();
  const [user] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.telegramUsername, clean), eq(usersTable.telegramUsernameVerified, true)))
    .limit(1);
  return user ?? null;
}

async function getSellerSettings(sellerId: number | null | undefined): Promise<{ botPrompt: string; priceList: string | null }> {
  let settings = null;

  if (sellerId) {
    const [byUser] = await db
      .select()
      .from(tariffSettingsTable)
      .where(eq(tariffSettingsTable.userId, sellerId))
      .orderBy(tariffSettingsTable.updatedAt)
      .limit(1);
    settings = byUser ?? null;
  }

  if (!settings) {
    const [any] = await db
      .select()
      .from(tariffSettingsTable)
      .orderBy(tariffSettingsTable.updatedAt)
      .limit(1);
    settings = any ?? null;
  }

  const defaultPrompt = `Ты — вежливый AI-помощник бизнеса в Telegram.
Отвечай на вопросы клиентов, уточняй детали (что нужно, количество, сроки, пожелания).
Общайся по-русски, будь приветлив и профессионален.
Когда клиент определился — скажи, что его заявка принята и менеджер свяжется с ним.`;

  const botPrompt = settings?.botPrompt ?? defaultPrompt;

  let priceList: string | null = null;
  if (settings?.structuredData) {
    try {
      const items = JSON.parse(settings.structuredData) as Array<{
        name: string;
        description?: string | null;
        price: string;
        unit?: string | null;
        category?: string | null;
      }>;
      if (items.length > 0) {
        priceList = items
          .map((item) => {
            const parts = [`• ${item.name}`];
            if (item.category) parts[0] = `[${item.category}] ${parts[0]}`;
            parts.push(`  Цена: ${item.price}${item.unit ? ` / ${item.unit}` : ""}`);
            if (item.description) parts.push(`  ${item.description}`);
            return parts.join("\n");
          })
          .join("\n");
      }
    } catch {
      priceList = settings.structuredData;
    }
  }

  return { botPrompt, priceList };
}

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

async function getNextAvailableSlots(dateStr: string, nearTime?: string, count = 2): Promise<string[]> {
  let dateObj: Date;
  try {
    dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) return [];
  } catch {
    return [];
  }

  const dayOfWeek = dateObj.getUTCDay();
  const [daySchedule] = await db
    .select()
    .from(workScheduleTable)
    .where(eq(workScheduleTable.dayOfWeek, dayOfWeek));

  if (!daySchedule || !daySchedule.isWorking) return [];

  const isoDate = dateObj.toISOString().split("T")[0];
  const allSlots = generateTimeSlots(daySchedule.startTime, daySchedule.endTime, daySchedule.slotDuration);

  const booked = await db
    .select()
    .from(appointmentsTable)
    .where(and(eq(appointmentsTable.date, isoDate), eq(appointmentsTable.status, "booked")));

  const bookedTimes = new Set(booked.map((b) => b.timeSlot));
  const freeSlots = allSlots.filter((s) => !bookedTimes.has(s));

  if (!nearTime) return freeSlots.slice(0, count);

  // Find the pivot index in allSlots (including booked ones)
  const pivotIdx = allSlots.indexOf(nearTime);
  if (pivotIdx === -1) return freeSlots.slice(0, count);

  // Walk outward from pivot: one slot before, one slot after
  const result: string[] = [];
  // Slot immediately before pivot
  for (let i = pivotIdx - 1; i >= 0 && result.length < count; i--) {
    if (freeSlots.includes(allSlots[i])) { result.push(allSlots[i]); break; }
  }
  // Slot immediately after pivot
  for (let i = pivotIdx + 1; i < allSlots.length && result.length < count; i++) {
    if (freeSlots.includes(allSlots[i])) { result.push(allSlots[i]); break; }
  }

  // If only one side had a free slot, fill with next nearest from either direction
  if (result.length < count) {
    for (const s of freeSlots) {
      if (!result.includes(s) && result.length < count) result.push(s);
    }
  }

  return result.sort();
}

async function isSlotBooked(date: string, timeSlot: string): Promise<boolean> {
  const existing = await db
    .select()
    .from(appointmentsTable)
    .where(
      and(
        eq(appointmentsTable.date, date),
        eq(appointmentsTable.timeSlot, timeSlot),
        eq(appointmentsTable.status, "booked")
      )
    )
    .limit(1);
  return existing.length > 0;
}

async function getAvailableSlotsText(dateStr: string): Promise<string> {
  let dateObj: Date;
  try {
    dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) throw new Error("invalid");
  } catch {
    return "Не удалось определить дату. Пожалуйста, укажите в формате ДД.ММ.ГГГГ.";
  }

  const dayOfWeek = dateObj.getDay();
  const DAY_NAMES = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];

  const [daySchedule] = await db
    .select()
    .from(workScheduleTable)
    .where(eq(workScheduleTable.dayOfWeek, dayOfWeek));

  if (!daySchedule || !daySchedule.isWorking) {
    return `К сожалению, ${DAY_NAMES[dayOfWeek]} — выходной день. Пожалуйста, выберите другую дату.`;
  }

  const isoDate = dateObj.toISOString().split("T")[0];
  const allSlots = generateTimeSlots(daySchedule.startTime, daySchedule.endTime, daySchedule.slotDuration);

  const booked = await db
    .select()
    .from(appointmentsTable)
    .where(and(eq(appointmentsTable.date, isoDate), eq(appointmentsTable.status, "booked")));

  const bookedTimes = new Set(booked.map((b) => b.timeSlot));
  const freeSlots = allSlots.filter((s) => !bookedTimes.has(s));

  if (freeSlots.length === 0) {
    return `На ${dateStr} все слоты заняты. Пожалуйста, выберите другую дату.`;
  }

  const formatted = dateObj.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  return `Свободное время на ${formatted}:\n${freeSlots.map((s) => `🕐 ${s}`).join("\n")}\n\nВыберите удобное время!`;
}

function hasWord(text: string, word: string): boolean {
  // \b doesn't work with Cyrillic in JS; use space/start/end/punctuation as boundaries
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[\\s,.:;!?«»()\\-])${escaped}(?:[\\s,.:;!?«»()\\-]|$)`).test(text) || text === word;
}

async function parseDateFromText(text: string): Promise<string | null> {
  const lower = text.toLowerCase();

  // Relative dates — check "послезавтра" before "завтра" to avoid substring match
  const today = new Date();
  if (hasWord(lower, "послезавтра")) {
    const d = new Date(today);
    d.setDate(d.getDate() + 2);
    return d.toISOString().split("T")[0];
  }
  if (hasWord(lower, "сегодня")) return today.toISOString().split("T")[0];
  if (hasWord(lower, "завтра")) {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  }

  const patterns = [
    /(\d{1,2})[./](\d{1,2})[./](\d{4})/,
    /(\d{1,2})[./](\d{1,2})/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const day = parseInt(match[1]);
      const month = parseInt(match[2]);
      const year = match[3] ? parseInt(match[3]) : new Date().getFullYear();
      const date = new Date(year, month - 1, day);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split("T")[0];
      }
    }
  }

  const russianMonths: Record<string, number> = {
    "январ": 1, "феврал": 2, "март": 3, "апрел": 4,
    "май": 5, "мая": 5, "июн": 6, "июл": 7, "август": 8,
    "сентябр": 9, "октябр": 10, "ноябр": 11, "декабр": 12,
  };

  const dayMonthMatch = text.match(/(\d{1,2})\s+(\w+)/);
  if (dayMonthMatch) {
    const day = parseInt(dayMonthMatch[1]);
    const monthWord = dayMonthMatch[2].toLowerCase();
    for (const [key, monthNum] of Object.entries(russianMonths)) {
      if (monthWord.startsWith(key)) {
        const year = new Date().getFullYear();
        const date = new Date(year, monthNum - 1, day);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split("T")[0];
        }
      }
    }
  }

  return null;
}

async function extractLeadFromConversation(
  messages: BotMessage[],
  clientName: string,
  priceList: string | null
): Promise<{
  service: string;
  details: string | null;
  quantity: string | null;
  deadline: string | null;
  price: string | null;
  status: "hot" | "warm" | "cold";
} | null> {
  const conversationText = messages
    .map((m) => `${m.role === "user" ? "Клиент" : "Бот"}: ${m.parts[0]?.text}`)
    .join("\n");

  const priceListSection = priceList
    ? `\nПрайс-лист продавца (используй ТОЧНЫЕ названия услуг из этого списка):\n"""\n${priceList}\n"""\n`
    : "";

  const extractPrompt = `Ты анализируешь переписку клиента с AI-ботом.
${priceListSection}
Переписка:
"""
${conversationText}
"""

Извлеки информацию о заявке. Важные правила:
- Поле "service": ТОЛЬКО то, что клиент явно подтвердил сам. Не включай услуги, которые бот предлагал, но клиент не подтвердил. ${priceList ? 'Используй ТОЧНОЕ название из прайса.' : 'Краткое описание 2-5 слов.'}
- Поле "details": кратко о пожеланиях или особенностях клиента (НЕ включай номер телефона и НЕ включай имя клиента — они хранятся отдельно). Если нечего добавить — null.
- Поле "deadline": дата и время если клиент подтвердил, иначе null.
- Поле "price": цена ТОЛЬКО выбранной клиентом услуги, иначе null.
Верни ТОЛЬКО JSON (без markdown):
{
  "service": "только подтверждённая услуга",
  "details": "краткие пожелания или null",
  "quantity": "количество или null",
  "deadline": "дата/срок или null",
  "price": "цена выбранной услуги или null",
  "status": "hot если клиент готов и выбрал время, warm если интересуется, cold если просто смотрит"
}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: extractPrompt }] }],
      config: { maxOutputTokens: 8192 },
    });
    const text = (response.text ?? "").replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function sendLeadToSeller(
  bot: TelegramBot,
  seller: typeof usersTable.$inferSelect,
  lead: typeof leadsTable.$inferSelect,
  existingMsgId?: number | null
): Promise<number | null> {
  if (!seller.telegramChatId) return null;

  const statusLabel = lead.status === "hot" ? "Горячий 🔥" : lead.status === "warm" ? "Тёплый" : "Холодный";
  const msg = [
    `🆕 <b>Заявка из Telegram</b>`,
    ``,
    `👤 Клиент: ${escapeHtml(lead.clientName)}`,
    `📦 Услуга: ${escapeHtml(lead.service)}`,
    lead.quantity ? `📊 Количество: ${escapeHtml(lead.quantity)}` : null,
    lead.deadline ? `📅 Дата/Срок: ${escapeHtml(lead.deadline)}` : null,
    lead.price ? `💰 Цена: ${escapeHtml(lead.price)}` : null,
    lead.details ? `📝 Детали: ${escapeHtml(lead.details)}` : null,
    ``,
    `Статус: ${statusLabel}`,
  ]
    .filter((l) => l !== null)
    .join("\n");

  try {
    if (existingMsgId) {
      try {
        await bot.editMessageText(msg, {
          chat_id: seller.telegramChatId,
          message_id: existingMsgId,
          parse_mode: "HTML",
        });
        return existingMsgId;
      } catch (editErr) {
        // If edit fails, fall back to sending a new message
        console.warn("[TelegramBot] Edit failed, sending new message:", (editErr as Error).message);
        const sent = await bot.sendMessage(seller.telegramChatId, msg, { parse_mode: "HTML" });
        return sent.message_id;
      }
    } else {
      const sent = await bot.sendMessage(seller.telegramChatId, msg, { parse_mode: "HTML" });
      return sent.message_id;
    }
  } catch (e) {
    console.error("[TelegramBot] Failed to send lead to seller:", e);
    return null;
  }
}

export async function markCompletedAppointments() {
  try {
    const booked = await db
      .select()
      .from(appointmentsTable)
      .where(eq(appointmentsTable.status, "booked"));

    if (booked.length === 0) return;

    const now = new Date();

    for (const appt of booked) {
      // Parse appointment date + time in UTC
      const [h, m] = appt.timeSlot.split(":").map(Number);
      const apptStart = new Date(`${appt.date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`);

      // Get slot duration from schedule for that day of week
      const dayOfWeek = apptStart.getUTCDay();
      const [schedule] = await db
        .select()
        .from(workScheduleTable)
        .where(eq(workScheduleTable.dayOfWeek, dayOfWeek));

      const slotMinutes = schedule?.slotDuration ?? 60;
      const apptEnd = new Date(apptStart.getTime() + slotMinutes * 60 * 1000);

      if (now >= apptEnd) {
        await db
          .update(appointmentsTable)
          .set({ status: "completed" })
          .where(eq(appointmentsTable.id, appt.id));
        console.log(`[Cleanup] Appointment ${appt.id} (${appt.clientName} ${appt.date} ${appt.timeSlot}) marked as completed`);
      }
    }
  } catch (err) {
    console.error("[Cleanup] Error marking completed appointments:", err);
  }
}

export function startAppointmentCleanupJob() {
  // Run immediately on startup, then every 5 minutes
  markCompletedAppointments();
  setInterval(markCompletedAppointments, 5 * 60 * 1000);
  console.log("[Cleanup] Appointment cleanup job started (every 5 min)");
}

export async function startTelegramBot() {
  if (!BOT_TOKEN) {
    console.warn("[TelegramBot] TELEGRAM_BOT_TOKEN not set, bot disabled");
    return null;
  }

  // Delete any existing webhook and drop pending updates to prevent duplicates on restart
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook?drop_pending_updates=true`);
  } catch {}

  // Wait briefly to allow old polling connections to terminate
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const bot = new TelegramBot(BOT_TOKEN, { polling: true });

  // Database-based deduplication — atomic across ALL server instances (dev + prod).
  // Uses PostgreSQL primary key conflict: only the first INSERT succeeds.
  const originalProcessUpdate = (bot as any).processUpdate.bind(bot);
  (bot as any).processUpdate = (update: any) => {
    (async () => {
      try {
        const rows = await db
          .insert(telegramProcessedUpdatesTable)
          .values({ updateId: update.update_id })
          .onConflictDoNothing()
          .returning();
        if (rows.length === 0) {
          console.log(`[TelegramBot] Skipping duplicate update ${update.update_id}`);
          return;
        }
        originalProcessUpdate(update);
      } catch (err) {
        console.error("[TelegramBot] Dedup DB error, processing anyway:", err);
        originalProcessUpdate(update);
      }
    })();
  };

  // Clean up old processed update IDs every hour (keep only last 24h)
  setInterval(async () => {
    try {
      await db.execute(
        sql`DELETE FROM telegram_processed_updates WHERE processed_at < NOW() - INTERVAL '24 hours'`
      );
    } catch {}
  }, 60 * 60 * 1000);

  bot.onText(/\/start(?:\s+(\S+))?/, async (msg, match) => {
    const chatId = String(msg.chat.id);
    const deepLinkParam = match?.[1]?.trim();

    // Deep link: /start username — auto-set seller context
    if (deepLinkParam) {
      const seller = await getSellerByUsername(deepLinkParam);

      if (seller) {
        await upsertConversation(chatId, {
          status: "active",
          sellerId: seller.id,
          sellerUsername: seller.telegramUsername,
          messages: "[]",
          leadId: null,
        });

        const { botPrompt, priceList } = await getSellerSettings(seller.id);
        const greeting = await generateGreeting(botPrompt, priceList);
        await bot.sendMessage(chatId, greeting, {
          parse_mode: "Markdown",
          reply_markup: CLIENT_MAIN_KEYBOARD,
        });
        return;
      }

      // Seller not found — fallback to manual entry
      await upsertConversation(chatId, {
        status: "waiting_seller",
        sellerId: null,
        sellerUsername: null,
        messages: "[]",
        leadId: null,
      });

      await bot.sendMessage(
        chatId,
        `❌ Продавец *@${deepLinkParam}* не найден.\n\nУкажите правильный *@username* продавца:`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    // No deep link — check if this is a seller (they have their own account)
    const senderUsername = msg.from?.username?.toLowerCase();
    if (senderUsername) {
      const [sellerAccount] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.telegramUsername, senderUsername))
        .limit(1);

      if (sellerAccount) {
        // This person is a registered seller — show seller panel
        const status = sellerAccount.telegramUsernameVerified ? "✅ Верифицирован" : "⚠️ Не верифицирован";
        await bot.sendMessage(
          chatId,
          `👋 С возвращением, *@${senderUsername}*!\n\n` +
          `Статус аккаунта: ${status}\n\n` +
          `Доступные команды:\n` +
          `• /mytoken — ваш токен для входа на сайт\n` +
          `• /schedule — ваш график работы\n\n` +
          `Для входа в личный кабинет — откройте сайт AutoMind.`,
          { parse_mode: "Markdown" }
        );
        return;
      }
    }

    // Not a seller — ask for seller username manually
    await upsertConversation(chatId, {
      status: "waiting_seller",
      sellerId: null,
      sellerUsername: null,
      messages: "[]",
      leadId: null,
    });

    await bot.sendMessage(
      chatId,
      `${DEFAULT_GREETING}\n\nЧтобы начать, укажите *@username* продавца.\nНапример: *@misha_flowers*`,
      { parse_mode: "Markdown" }
    );
  });

  bot.onText(/\/token (.+)/, async (msg, match) => {
    const chatId = String(msg.chat.id);
    const token = match?.[1]?.trim();
    if (!token) return;

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.apiToken, token))
      .limit(1);

    if (!user) {
      await bot.sendMessage(
        chatId,
        `❌ Токен не найден.\n\n` +
        `Возможные причины:\n` +
        `• Вы скопировали старый или неверный токен\n` +
        `• Аккаунт был пересоздан\n\n` +
        `Отправьте /mytoken — бот пришлёт ваш актуальный токен с готовой командой.`
      );
      return;
    }

    const realUsername = msg.from?.username?.toLowerCase();
    const realTelegramUserId = String(msg.from!.id);

    if (!realUsername) {
      await bot.sendMessage(
        chatId,
        `❌ Не удалось получить ваш Telegram username.\n\nУстановите username в настройках Telegram (Настройки → Изменить профиль → Имя пользователя) и попробуйте снова.`
      );
      return;
    }

    // Check if this Telegram user ID is already linked to a DIFFERENT verified account.
    // This prevents trial abuse by changing username and re-registering.
    const [existingByTgId] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.telegramUserId, realTelegramUserId))
      .limit(1);

    if (existingByTgId && existingByTgId.id !== user.id && existingByTgId.telegramUsernameVerified) {
      await bot.sendMessage(
        chatId,
        `⛔ Ваш Telegram-аккаунт уже привязан к другому профилю *@${existingByTgId.telegramUsername}*.\n\n` +
        `Один Telegram-аккаунт — один профиль AutoMind. Смена username не даёт новый пробный период.\n\n` +
        `Используйте тот же профиль или обратитесь в поддержку.`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    const updateData: Partial<typeof usersTable.$inferInsert> = {
      telegramChatId: chatId,
      telegramUserId: realTelegramUserId,
      telegramUsernameVerified: true,
    };

    if (user.telegramUsername !== realUsername) {
      const [conflicting] = await db
        .select()
        .from(usersTable)
        .where(and(eq(usersTable.telegramUsername, realUsername)))
        .limit(1);

      if (conflicting && conflicting.id !== user.id) {
        await bot.sendMessage(
          chatId,
          `⚠️ Username *@${realUsername}* уже зарегистрирован другим аккаунтом.\n\nЕсли это ваш username — обратитесь в поддержку.`,
          { parse_mode: "Markdown" }
        );
        return;
      }

      updateData.telegramUsername = realUsername;
    }

    await db
      .update(usersTable)
      .set(updateData)
      .where(eq(usersTable.id, user.id));

    const finalUsername = updateData.telegramUsername ?? user.telegramUsername;

    const usernameChanged = updateData.telegramUsername && updateData.telegramUsername !== user.telegramUsername;

    await bot.sendMessage(
      chatId,
      `✅ Аккаунт *@${finalUsername}* успешно верифицирован!\n\n` +
        (usernameChanged ? `ℹ️ Username обновлён с *@${user.telegramUsername}* на *@${finalUsername}*\n\n` : "") +
        `🔐 Ваш Telegram подтверждён — теперь покупатели могут найти вас, написав боту *@${finalUsername}*\n` +
        `📩 Новые заявки будут приходить в этот чат.`,
      { parse_mode: "Markdown" }
    );
  });

  // Register directly via bot — creates account in production DB
  bot.onText(/\/register/, async (msg) => {
    const chatId = String(msg.chat.id);
    const realUsername = msg.from?.username?.toLowerCase();
    const realTelegramUserId = String(msg.from?.id ?? "");

    if (!realUsername) {
      await bot.sendMessage(
        chatId,
        `❌ Не удалось получить ваш Telegram username.\n\nУстановите username в настройках Telegram (Настройки → Изменить профиль → Имя пользователя) и попробуйте снова.`
      );
      return;
    }

    // Check if already registered
    const [existing] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.telegramUsername, realUsername))
      .limit(1);

    if (existing) {
      // Already registered — just confirm and show token
      if (!existing.telegramUsernameVerified) {
        // Update telegramChatId and mark as verified
        await db.update(usersTable).set({
          telegramChatId: chatId,
          telegramUserId: realTelegramUserId,
          telegramUsernameVerified: true,
        }).where(eq(usersTable.id, existing.id));
      }
      await bot.sendMessage(
        chatId,
        `✅ Аккаунт *@${realUsername}* уже зарегистрирован и верифицирован!\n\n` +
        `🔑 Ваш токен для входа на сайт:\n\n\`${existing.apiToken}\`\n\n` +
        `Войдите в личный кабинет через «Уже есть аккаунт? Войти по токену» и вставьте этот токен.`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    // Create new account
    const apiToken = randomBytes(32).toString("hex");
    const [newUser] = await db
      .insert(usersTable)
      .values({
        telegramUsername: realUsername,
        apiToken,
        telegramChatId: chatId,
        telegramUserId: realTelegramUserId,
        telegramUsernameVerified: true,
      })
      .returning();

    await bot.sendMessage(
      chatId,
      `🎉 Аккаунт *@${realUsername}* создан и верифицирован!\n\n` +
      `🔑 Ваш токен для входа на сайт:\n\n\`${newUser.apiToken}\`\n\n` +
      `Войдите в личный кабинет:\n` +
      `1. Откройте сайт\n` +
      `2. Нажмите «Уже есть аккаунт? Войти по токену»\n` +
      `3. Вставьте токен выше\n\n` +
      `📩 Новые заявки будут приходить сюда.`,
      { parse_mode: "Markdown" }
    );
  });

  // Recovery command: send /mytoken from your Telegram account to get your API token back
  bot.onText(/\/mytoken/, async (msg) => {
    const chatId = String(msg.chat.id);
    const realUsername = msg.from?.username?.toLowerCase();

    if (!realUsername) {
      await bot.sendMessage(
        chatId,
        `❌ Не удалось получить ваш Telegram username. Установите username в настройках Telegram и попробуйте снова.`
      );
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.telegramUsername, realUsername))
      .limit(1);

    if (!user) {
      await bot.sendMessage(
        chatId,
        `❌ Аккаунт *@${realUsername}* не найден.\n\nДля регистрации отправьте команду /register — аккаунт создастся автоматически!`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    if (!user.telegramUsernameVerified) {
      await bot.sendMessage(
        chatId,
        `⚠️ Аккаунт *@${realUsername}* ещё не верифицирован.\n\n` +
        `Нажмите кнопку ниже — аккаунт будет подтверждён автоматически:`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[
              { text: "✅ Подтвердить аккаунт одной кнопкой", callback_data: `verify:${user.apiToken}` }
            ]]
          }
        }
      );
      return;
    }

    await bot.sendMessage(
      chatId,
      `🔑 Ваш API-токен:\n\n\`${user.apiToken}\`\n\n` +
      `Вставьте его в профиль на сайте → раздел "Профиль" → поле API-токен.\n\n` +
      `⚠️ Не передавайте токен третьим лицам.`,
      { parse_mode: "Markdown" }
    );
  });

  bot.onText(/\/zapisi/, async (msg) => {
    const chatId = String(msg.chat.id);
    const conv = await getConversation(chatId);

    if (!conv || conv.status === "waiting_seller") {
      await bot.sendMessage(chatId, "Сначала укажите @username продавца, чтобы я мог показать расписание.");
      return;
    }

    const schedule = await db
      .select()
      .from(workScheduleTable)
      .orderBy(workScheduleTable.dayOfWeek);

    if (schedule.length === 0) {
      await bot.sendMessage(chatId, "Расписание ещё не настроено. Обратитесь к администратору.");
      return;
    }

    const DAY_NAMES = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
    const scheduleText = schedule
      .map((s) => {
        if (!s.isWorking) return `${DAY_NAMES[s.dayOfWeek]}: выходной`;
        return `${DAY_NAMES[s.dayOfWeek]}: ${s.startTime}–${s.endTime} (каждые ${s.slotDuration} мин)`;
      })
      .join("\n");

    await bot.sendMessage(
      chatId,
      `📅 *График работы:*\n\n${scheduleText}\n\nНапишите удобную вам дату — покажу свободное время!`,
      { parse_mode: "Markdown" }
    );
  });

  bot.on("callback_query", async (query) => {
    const chatId = String(query.message?.chat.id);
    const data = query.data;
    if (!chatId || !data) return;

    try {
      await bot.answerCallbackQuery(query.id);
    } catch {
      // Ignore if already answered
    }

    try {

    // ── Verify account via button ──
    if (data.startsWith("verify:")) {
      const token = data.slice("verify:".length);
      const [user] = await db.select().from(usersTable).where(eq(usersTable.apiToken, token)).limit(1);
      if (!user) {
        await bot.sendMessage(chatId, "❌ Токен не найден. Попробуйте зарегистрироваться заново на сайте.");
        return;
      }
      const realUsername = query.from?.username?.toLowerCase();
      const realTelegramUserId = String(query.from.id);
      if (!realUsername) {
        await bot.sendMessage(chatId, "❌ Не удалось получить ваш Telegram username. Установите username в настройках Telegram.");
        return;
      }
      await db.update(usersTable).set({
        telegramChatId: chatId,
        telegramUserId: realTelegramUserId,
        telegramUsernameVerified: true,
        telegramUsername: realUsername,
      }).where(eq(usersTable.id, user.id));
      await bot.sendMessage(
        chatId,
        `✅ Аккаунт *@${realUsername}* успешно верифицирован!\n\n📩 Новые заявки будут приходить в этот чат.`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    const conv = await getConversation(chatId);

    if (data === "menu_catalog") {
      const { botPrompt, priceList } = await getSellerSettings(conv?.sellerId);
      let reply = "";
      if (priceList) {
        try {
          const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [{ role: "user", parts: [{ text: `${botPrompt}\n\nПрайс-лист:\n${priceList}\n\nКлиент нажал "Каталог". Покажи список доступных товаров/услуг с ценами. Используй ТОЛЬКО обычный текст без звёздочек, подчёркиваний, скобок и других символов форматирования. Коротко и понятно.` }] }],
            config: { maxOutputTokens: 8192 },
          });
          reply = response.text ?? priceList;
        } catch {
          reply = `📋 Наши услуги:\n\n${priceList}`;
        }
      } else {
        reply = "📋 Каталог товаров ещё не настроен. Напишите что вас интересует — я помогу!";
      }
      try {
        await bot.sendMessage(chatId, reply, {
          reply_markup: {
            inline_keyboard: [[{ text: "🛒 Оформить заказ", callback_data: "menu_order" }], [{ text: "◀️ Главное меню", callback_data: "menu_main" }]],
          },
        });
      } catch {
        // Fallback: send as plain text without keyboard if message fails
        await bot.sendMessage(chatId, reply.replace(/[*_`[\]()]/g, ""));
      }
    } else if (data === "menu_price") {
      await bot.sendMessage(chatId, "💰 Напишите, что вас интересует — и я назову цену или рассчитаю стоимость.", {
        reply_markup: { inline_keyboard: [[{ text: "◀️ Главное меню", callback_data: "menu_main" }]] },
      });
    } else if (data === "menu_order") {
      await bot.sendMessage(
        chatId,
        "🛒 *Оформление заказа*\n\nЧто именно вы хотите заказать? Напишите название товара или услуги, и я уточню детали.",
        {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "◀️ Главное меню", callback_data: "menu_main" }]] },
        }
      );
    } else if (data === "menu_schedule") {
      const schedule = await db.select().from(workScheduleTable).orderBy(workScheduleTable.dayOfWeek);
      if (schedule.length === 0) {
        await bot.sendMessage(chatId, "📅 Расписание ещё не настроено.", {
          reply_markup: { inline_keyboard: [[{ text: "◀️ Главное меню", callback_data: "menu_main" }]] },
        });
      } else {
        const DAY_NAMES = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
        const scheduleText = schedule
          .map((s) => (s.isWorking ? `${DAY_NAMES[s.dayOfWeek]}: ${s.startTime}–${s.endTime}` : `${DAY_NAMES[s.dayOfWeek]}: выходной`))
          .join("\n");
        await bot.sendMessage(chatId, `📅 *График работы:*\n\n${scheduleText}\n\nНапишите удобную дату — покажу свободные слоты!`, {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "◀️ Главное меню", callback_data: "menu_main" }]] },
        });
      }
    } else if (data === "menu_contact") {
      if (conv?.sellerUsername) {
        await bot.sendMessage(
          chatId,
          `📞 Вы можете написать напрямую менеджеру: *@${conv.sellerUsername}*\n\nИли продолжайте общаться здесь — я передам вашу заявку!`,
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: `💬 Написать @${conv.sellerUsername}`, url: `https://t.me/${conv.sellerUsername}` }],
                [{ text: "◀️ Главное меню", callback_data: "menu_main" }],
              ],
            },
          }
        );
      } else {
        await bot.sendMessage(chatId, "Напишите что вас интересует — я передам заявку менеджеру.", {
          reply_markup: { inline_keyboard: [[{ text: "◀️ Главное меню", callback_data: "menu_main" }]] },
        });
      }
    } else if (data === "menu_main") {
      await bot.sendMessage(chatId, "Выберите нужный раздел:", {
        reply_markup: CLIENT_MAIN_KEYBOARD,
      });
    } else if (data === "confirm_order") {
      await bot.sendMessage(chatId, "✅ Отлично! Ваша заявка подтверждена. Менеджер свяжется с вами в ближайшее время.", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "◀️ Главное меню", callback_data: "menu_main" }],
          ],
        },
      });
    }
    } catch (e) {
      console.error("[TelegramBot] callback_query error:", e);
      try {
        await bot.sendMessage(chatId, "Произошла ошибка. Попробуйте ещё раз.");
      } catch {}
    }
  });

  // Handle shared contacts (user taps "Share Phone Number" button)
  bot.on("contact", async (msg) => {
    const chatId = String(msg.chat.id);
    const contact = msg.contact;
    if (!contact) return;

    const phone = contact.phone_number;
    const clientName = msg.from?.username
      ? `@${msg.from.username}`
      : contact.first_name ?? msg.from?.first_name ?? "Клиент";

    // Remove the reply keyboard
    await bot.sendMessage(chatId, `📱 Спасибо! Номер *${phone}* получен. Передаю заявку менеджеру...`, {
      parse_mode: "Markdown",
      reply_markup: { remove_keyboard: true },
    });

    const conv = await getConversation(chatId);
    if (!conv || !conv.sellerId) return;

    const [seller] = await db.select().from(usersTable).where(eq(usersTable.id, conv.sellerId)).limit(1);
    const { priceList } = await getSellerSettings(conv.sellerId);
    const messages: BotMessage[] = JSON.parse(conv.messages || "[]");

    // Add phone message to history
    const phoneMsg = `Мой номер телефона: ${phone}`;
    messages.push({ role: "user", parts: [{ text: phoneMsg }] });

    const leadData = await extractLeadFromConversation(messages, clientName, priceList);
    const phoneDetails = `Телефон: ${phone}`;

    let existingLead = conv.leadId
      ? (await db.select().from(leadsTable).where(eq(leadsTable.id, conv.leadId)).limit(1))[0]
      : null;

    if (existingLead) {
      await db.update(leadsTable).set({
        details: existingLead.details ? `${existingLead.details}\n${phoneDetails}` : phoneDetails,
        status: "hot",
        isPriority: true,
      }).where(eq(leadsTable.id, existingLead.id));

      await db.insert(leadChatMessagesTable).values({
        leadId: existingLead.id,
        platform: "Telegram",
        title: `📱 Клиент ${clientName} оставил номер телефона`,
        message: `Клиент: ${clientName}\nТелефон: ${phone}\nСтатус обновлён: Горячий`,
      });
    } else {
      const [newLead] = await db.insert(leadsTable).values({
        userId: seller?.id ?? null,
        clientName,
        platform: "Telegram",
        service: leadData?.service ?? "Запрос от клиента",
        details: leadData?.details ? `${leadData.details}\n${phoneDetails}` : phoneDetails,
        quantity: leadData?.quantity ?? null,
        deadline: leadData?.deadline ?? null,
        price: leadData?.price ?? null,
        status: "hot",
        isPriority: true,
        recommendation: "Клиент оставил контакт — связаться немедленно",
      }).returning();
      existingLead = newLead;
      await upsertConversation(chatId, { leadId: newLead.id });

      await db.insert(leadChatMessagesTable).values({
        leadId: newLead.id,
        platform: "Telegram",
        title: `📱 Новая заявка с контактом: ${clientName}`,
        message: [
          `Клиент: ${clientName}`,
          `Платформа: Telegram`,
          `Телефон: ${phone}`,
          newLead.service ? `Услуга: ${newLead.service}` : null,
          newLead.details ? `Детали: ${newLead.details}` : null,
          `Статус: Горячий`,
        ].filter(Boolean).join("\n"),
      });
    }

    await db.update(botConversationsTable)
      .set({ messages: JSON.stringify(messages) })
      .where(eq(botConversationsTable.userChatId, chatId));

    if (seller) {
      // Always send a NEW message on phone confirmation so seller gets notified
      const msgId = await sendLeadToSeller(bot, seller, existingLead!, null);
      if (msgId) {
        await upsertConversation(chatId, { sellerMsgId: msgId });
      }
    }

    await bot.sendMessage(
      chatId,
      `✅ Заявка принята! Менеджер свяжется с вами по номеру ${phone} в ближайшее время.`,
      {
        reply_markup: { inline_keyboard: [[{ text: "◀️ Главное меню", callback_data: "menu_main" }]] },
      }
    );
  });

  bot.on("message", async (msg) => {
    const chatId = String(msg.chat.id);
    const userId = msg.from?.id;
    const text = msg.text;

    if (!userId || !text) return;
    if (text.startsWith("/")) return;

    let conv = await getConversation(chatId);

    if (!conv || conv.status === "waiting_seller") {
      const usernameMatch = text.match(/@(\w+)/);
      if (!usernameMatch) {
        await bot.sendMessage(
          chatId,
          `Чтобы начать, укажите *@username* продавца.\nНапример: *@misha_flowers*`,
          { parse_mode: "Markdown" }
        );
        return;
      }

      const seller = await getSellerByUsername(usernameMatch[1]);
      if (!seller) {
        await bot.sendMessage(
          chatId,
          `❌ Продавец *@${usernameMatch[1]}* не найден. Проверьте правильность username.`,
          { parse_mode: "Markdown" }
        );
        return;
      }

      const { botPrompt, priceList } = await getSellerSettings(seller.id);
      const greetText = await generateGreeting(botPrompt, priceList);

      conv = await upsertConversation(chatId, {
        sellerId: seller.id,
        sellerUsername: seller.telegramUsername,
        status: "active",
        messages: JSON.stringify([{ role: "model", parts: [{ text: greetText }] }]),
      });

      await bot.sendMessage(chatId, greetText, {
        reply_markup: CLIENT_MAIN_KEYBOARD,
      });
      return;
    }

    if (conv.status === "closed") {
      await upsertConversation(chatId, {
        status: "active",
        messages: "[]",
        leadId: null,
      });
      conv = (await getConversation(chatId))!;
    }

    const messages: BotMessage[] = JSON.parse(conv.messages || "[]");
    messages.push({ role: "user", parts: [{ text }] });

    // If user sends a time (HH:MM) and there's a pending date — create appointment directly
    const timeInTextMatch = conv.pendingDate ? text.match(/\b(\d{1,2}:\d{2})\b/) : null;
    if (timeInTextMatch && conv.pendingDate) {
      const timeSlot = timeInTextMatch[1];
      console.log(`[TelegramBot] Booking appointment: date=${conv.pendingDate} time=${timeSlot} chat=${chatId}`);
      const dateToBook = conv.pendingDate;

      const clientName = msg.from?.username
        ? `@${msg.from.username}`
        : msg.from?.first_name ?? "Клиент из Telegram";

      const { botPrompt: _bp, priceList } = await getSellerSettings(conv.sellerId);
      const [seller] = conv.sellerId
        ? await db.select().from(usersTable).where(eq(usersTable.id, conv.sellerId)).limit(1)
        : [undefined];

      // Upsert lead
      let leadId = conv.leadId;
      if (!leadId) {
        const leadData = await extractLeadFromConversation(messages, clientName, priceList);
        const [newLead] = await db.insert(leadsTable).values({
          userId: seller?.id ?? null,
          clientName,
          platform: "Telegram",
          service: leadData?.service ?? "Запись через бота",
          details: leadData?.details ?? null,
          quantity: leadData?.quantity ?? null,
          deadline: `${dateToBook} ${timeSlot}`,
          price: leadData?.price ?? null,
          status: "hot",
          isPriority: true,
          recommendation: "Клиент выбрал время записи — связаться для подтверждения",
        }).returning();
        leadId = newLead.id;
        await upsertConversation(chatId, { leadId: newLead.id });

        if (seller) {
          const msgId = await sendLeadToSeller(bot, seller, newLead, conv.sellerMsgId);
          if (msgId) await upsertConversation(chatId, { sellerMsgId: msgId });
        }
      } else {
        await db.update(leadsTable).set({
          deadline: `${dateToBook} ${timeSlot}`,
          status: "hot",
          isPriority: true,
        }).where(eq(leadsTable.id, leadId));
      }

      // Check if slot is already taken
      const slotTaken = await isSlotBooked(dateToBook, timeSlot);
      if (slotTaken) {
        const freeSlots = await getNextAvailableSlots(dateToBook, timeSlot);
        const dateObjRedir = new Date(dateToBook);
        const formattedRedir = dateObjRedir.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
        const redirectText = freeSlots.length > 0
          ? `К сожалению, время ${timeSlot} на ${formattedRedir} уже занято другим клиентом.\n\nВот ближайшие свободные слоты:\n${freeSlots.map((s) => `🕐 ${s}`).join("\n")}\n\nВыберите другое удобное время!`
          : `К сожалению, время ${timeSlot} на ${formattedRedir} уже занято, и других свободных слотов на этот день нет. Пожалуйста, выберите другую дату.`;
        messages.push({ role: "model", parts: [{ text: redirectText }] });
        await db.update(botConversationsTable)
          .set({ messages: JSON.stringify(messages) })
          .where(eq(botConversationsTable.userChatId, chatId));
        await bot.sendMessage(chatId, redirectText);
        return;
      }

      // Create appointment
      await db.insert(appointmentsTable).values({
        userId: seller?.id ?? null,
        leadId,
        date: dateToBook,
        timeSlot,
        clientName,
        clientChatId: chatId,
        status: "booked",
      });

      // Clear pending date
      await upsertConversation(chatId, { pendingDate: null });

      const dateObj = new Date(dateToBook);
      const formatted = dateObj.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
      const alreadyHasLead = !!conv.leadId;
      const confirmText = alreadyHasLead
        ? `✅ Запись обновлена: ${formatted} в ${timeSlot}!`
        : `✅ Вы записаны на ${formatted} в ${timeSlot}!\n\nЧтобы менеджер мог с вами связаться, укажите ваш номер телефона.`;

      messages.push({ role: "model", parts: [{ text: confirmText }] });
      await db.update(botConversationsTable)
        .set({ messages: JSON.stringify(messages) })
        .where(eq(botConversationsTable.userChatId, chatId));

      if (alreadyHasLead) {
        await bot.sendMessage(chatId, confirmText, {
          reply_markup: { inline_keyboard: [[{ text: "◀️ Главное меню", callback_data: "menu_main" }]] },
        });
      } else {
        await bot.sendMessage(chatId, confirmText, {
          reply_markup: {
            keyboard: [[{ text: "📱 Поделиться номером телефона", request_contact: true }]],
            one_time_keyboard: true,
            resize_keyboard: true,
          },
        });
      }
      return;
    }

    const detectedDate = await parseDateFromText(text);
    if (detectedDate) {
      console.log(`[TelegramBot] Date detected: ${detectedDate} for chat=${chatId}, saving pendingDate`);

      // If message also contains a time — book immediately without asking for slot
      const timeInDateMsg = text.match(/\b(\d{1,2}:\d{2})\b/);
      if (timeInDateMsg) {
        const timeSlot = timeInDateMsg[1];
        console.log(`[TelegramBot] Date+time in one message: ${detectedDate} ${timeSlot}, booking immediately`);
        const clientName = msg.from?.username
          ? `@${msg.from.username}`
          : msg.from?.first_name ?? "Клиент из Telegram";

        const { priceList } = await getSellerSettings(conv.sellerId);
        const [seller] = conv.sellerId
          ? await db.select().from(usersTable).where(eq(usersTable.id, conv.sellerId)).limit(1)
          : [undefined];

        let leadId = conv.leadId;
        if (!leadId) {
          const leadData = await extractLeadFromConversation(messages, clientName, priceList);
          const [newLead] = await db.insert(leadsTable).values({
            userId: seller?.id ?? null,
            clientName,
            platform: "Telegram",
            service: leadData?.service ?? "Запись через бота",
            details: leadData?.details ?? null,
            quantity: leadData?.quantity ?? null,
            deadline: `${detectedDate} ${timeSlot}`,
            price: leadData?.price ?? null,
            status: "hot",
            isPriority: true,
            recommendation: "Клиент выбрал время записи — связаться для подтверждения",
          }).returning();
          leadId = newLead.id;
          await upsertConversation(chatId, { leadId: newLead.id });
          if (seller) {
            const msgId = await sendLeadToSeller(bot, seller, newLead, conv.sellerMsgId);
            if (msgId) await upsertConversation(chatId, { sellerMsgId: msgId });
          }
        } else {
          await db.update(leadsTable).set({
            deadline: `${detectedDate} ${timeSlot}`,
            status: "hot",
            isPriority: true,
          }).where(eq(leadsTable.id, leadId));
        }

        // Check if slot is already taken
        const slotTaken2 = await isSlotBooked(detectedDate, timeSlot);
        if (slotTaken2) {
          const freeSlots2 = await getNextAvailableSlots(detectedDate, timeSlot);
          const dateObjRedir2 = new Date(detectedDate);
          const formattedRedir2 = dateObjRedir2.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
          const redirectText2 = freeSlots2.length > 0
            ? `К сожалению, время ${timeSlot} на ${formattedRedir2} уже занято другим клиентом.\n\nВот ближайшие свободные слоты:\n${freeSlots2.map((s) => `🕐 ${s}`).join("\n")}\n\nВыберите другое удобное время!`
            : `К сожалению, время ${timeSlot} на ${formattedRedir2} уже занято, и других свободных слотов на этот день нет. Пожалуйста, выберите другую дату.`;
          messages.push({ role: "model", parts: [{ text: redirectText2 }] });
          await db.update(botConversationsTable)
            .set({ messages: JSON.stringify(messages), pendingDate: null })
            .where(eq(botConversationsTable.userChatId, chatId));
          await bot.sendMessage(chatId, redirectText2);
          return;
        }

        await db.insert(appointmentsTable).values({
          userId: seller?.id ?? null,
          leadId,
          date: detectedDate,
          timeSlot,
          clientName,
          clientChatId: chatId,
          status: "booked",
        });

        await upsertConversation(chatId, { pendingDate: null });
        const dateObj = new Date(detectedDate);
        const formatted = dateObj.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
        const alreadyHasLead2 = !!conv.leadId;
        const confirmText = alreadyHasLead2
          ? `✅ Запись обновлена: ${formatted} в ${timeSlot}!`
          : `✅ Вы записаны на ${formatted} в ${timeSlot}!\n\nЧтобы менеджер мог с вами связаться, укажите ваш номер телефона.`;
        messages.push({ role: "model", parts: [{ text: confirmText }] });
        await db.update(botConversationsTable)
          .set({ messages: JSON.stringify(messages) })
          .where(eq(botConversationsTable.userChatId, chatId));
        if (alreadyHasLead2) {
          await bot.sendMessage(chatId, confirmText, {
            reply_markup: { inline_keyboard: [[{ text: "◀️ Главное меню", callback_data: "menu_main" }]] },
          });
        } else {
          await bot.sendMessage(chatId, confirmText, {
            reply_markup: {
              keyboard: [[{ text: "📱 Поделиться номером телефона", request_contact: true }]],
              one_time_keyboard: true,
              resize_keyboard: true,
            },
          });
        }
        return;
      }

      const slotsText = await getAvailableSlotsText(detectedDate);

      messages.push({ role: "model", parts: [{ text: slotsText }] });
      await db
        .update(botConversationsTable)
        .set({ messages: JSON.stringify(messages), pendingDate: detectedDate })
        .where(eq(botConversationsTable.userChatId, chatId));

      await bot.sendMessage(chatId, slotsText);
      return;
    }

    const { botPrompt, priceList } = await getSellerSettings(conv.sellerId);

    const noMarkdownNote = "\n\nВАЖНО: Пиши обычным текстом без какого-либо форматирования. Не используй звёздочки, подчёркивания, решётки и другие символы markdown. Только чистый читаемый текст.";
    const phoneNote = "\n\nПорядок работы с клиентом: 1) В самом начале разговора спроси, как можно обращаться к клиенту (имя). 2) Уточни все детали — услугу, дату и время записи. 3) Предложи дополнительные услуги если уместно. 4) Только после того как клиент подтвердил дату/время — попроси номер телефона для связи. Не проси телефон раньше времени. При указании цен всегда добавляй 'рублей' или 'руб.'";


    const systemPromptText = priceList
      ? `${botPrompt}\n\nПрайс-лист товаров/услуг:\n${priceList}\n\nИспользуй ТОЛЬКО эти товары/услуги из прайса при ответах на вопросы о наличии, ценах и описаниях. Если клиент спрашивает о чём-то не из прайса — сообщи, что такого нет в ассортименте.${phoneNote}${noMarkdownNote}`
      : `${botPrompt}${phoneNote}${noMarkdownNote}`;

    const contents = [
      { role: "user" as const, parts: [{ text: systemPromptText }] },
      { role: "model" as const, parts: [{ text: "Понял, буду следовать инструкциям и работать только по прайс-листу." }] },
      ...messages,
    ];

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents,
      config: { maxOutputTokens: 8192 },
    });

    const replyText = response.text ?? "Минуту, уточняю информацию...";
    messages.push({ role: "model", parts: [{ text: replyText }] });

    await db
      .update(botConversationsTable)
      .set({ messages: JSON.stringify(messages) })
      .where(eq(botConversationsTable.userChatId, chatId));

    // If bot is asking for phone number — show "Share Contact" reply keyboard (only if no lead yet)
    const botAsksForPhone = /номер телефона|ваш номер|поделитесь номером|укажите номер|телефон для связи|контактный номер|пришлите номер|напишите номер/i.test(replyText);
    if (botAsksForPhone && !conv.leadId) {
      await bot.sendMessage(chatId, replyText, {
        reply_markup: {
          keyboard: [[{ text: "📱 Поделиться номером телефона", request_contact: true }]],
          one_time_keyboard: true,
          resize_keyboard: true,
        },
      });
    } else {
      await bot.sendMessage(chatId, replyText);
    }

    const userMessages = messages.filter((m) => m.role === "user").length;
    const isReadyKeyword = /готов|оформи|запиши|беру|куплю|хочу купить|оформляем|давайте|да|согласен|записаться|запишите/i.test(text);
    const timePattern = /\d{1,2}:\d{2}/.test(text);
    // Phone number typed as text (e.g. +79991234567) — treat as lead trigger
    const phonePattern = /(\+7|8)[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/.test(text);

    const shouldCreateLead = (isReadyKeyword && userMessages >= 2) || (timePattern && userMessages >= 3) || phonePattern || userMessages >= 10;

    if (shouldCreateLead) {
      const clientName = msg.from?.username
        ? `@${msg.from.username}`
        : msg.from?.first_name ?? "Клиент из Telegram";

      const [seller] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, conv.sellerId!))
        .limit(1);

      const leadData = await extractLeadFromConversation(messages, clientName, priceList);

      // Extract phone number from text if present
      const phoneMatch = text.match(/(\+7|8)[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/);
      const phoneNumber = phoneMatch ? phoneMatch[0] : null;

      // Use fallback if AI couldn't extract lead data
      const effectiveLeadData = leadData ?? {
        service: "Запрос из Telegram",
        details: null,
        quantity: null,
        deadline: null,
        price: null,
        status: isReadyKeyword ? "hot" : "warm",
      };

      // Check if the AI-extracted deadline slot is already booked before creating a lead
      if (!conv.leadId && effectiveLeadData.deadline) {
        const dlTimeMatch = effectiveLeadData.deadline.match(/(\d{1,2}:\d{2})/);
        if (dlTimeMatch) {
          const dlDate = await parseDateFromText(effectiveLeadData.deadline);
          if (dlDate) {
            const slotTakenForLead = await isSlotBooked(dlDate, dlTimeMatch[1]);
            if (slotTakenForLead) {
              const freeAlts = await getNextAvailableSlots(dlDate, dlTimeMatch[1]);
              const dateObjAlt = new Date(dlDate);
              const formattedAlt = dateObjAlt.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
              const conflictMsg = freeAlts.length > 0
                ? `К сожалению, время ${dlTimeMatch[1]} на ${formattedAlt} уже занято другим клиентом.\n\nВот ближайшие свободные слоты:\n${freeAlts.map((s) => `🕐 ${s}`).join("\n")}\n\nВыберите другое удобное время!`
                : `К сожалению, время ${dlTimeMatch[1]} на ${formattedAlt} уже занято, и других свободных слотов на этот день нет. Пожалуйста, выберите другую дату.`;
              messages.push({ role: "model", parts: [{ text: conflictMsg }] });
              await db.update(botConversationsTable)
                .set({ messages: JSON.stringify(messages) })
                .where(eq(botConversationsTable.userChatId, chatId));
              await bot.sendMessage(chatId, conflictMsg);
              return;
            }
          }
        }
      }

      {
        let existingLead = conv.leadId
          ? (await db.select().from(leadsTable).where(eq(leadsTable.id, conv.leadId)).limit(1))[0]
          : null;

        if (existingLead) {
          const [updated] = await db
            .update(leadsTable)
            .set({
              service: effectiveLeadData.service || existingLead.service,
              details: (() => {
                const base = effectiveLeadData.details || existingLead.details || "";
                if (phoneNumber && !base.includes(phoneNumber)) return base + `\nТелефон: ${phoneNumber}`;
                return base || null;
              })(),
              quantity: effectiveLeadData.quantity || existingLead.quantity,
              deadline: effectiveLeadData.deadline || existingLead.deadline,
              price: effectiveLeadData.price || existingLead.price,
              status: phonePattern ? "hot" : effectiveLeadData.status,
              isPriority: phonePattern || effectiveLeadData.status === "hot",
            })
            .where(eq(leadsTable.id, existingLead.id))
            .returning();
          existingLead = updated;
        } else {
          const [newLead] = await db
            .insert(leadsTable)
            .values({
              userId: seller?.id ?? null,
              clientName,
              platform: "Telegram",
              service: effectiveLeadData.service,
              details: (() => {
                const base = effectiveLeadData.details ?? "";
                if (phoneNumber && !base.includes(phoneNumber)) return base + `\nТелефон: ${phoneNumber}`;
                return base || null;
              })(),
              quantity: effectiveLeadData.quantity,
              deadline: effectiveLeadData.deadline,
              price: effectiveLeadData.price,
              status: phonePattern ? "hot" : effectiveLeadData.status,
              isPriority: phonePattern || effectiveLeadData.status === "hot",
              recommendation: phonePattern
                ? "Клиент оставил номер телефона — связаться немедленно"
                : effectiveLeadData.status === "hot"
                  ? "Связаться как можно быстрее — клиент готов"
                  : effectiveLeadData.status === "warm"
                    ? "Уточнить детали и ответить на вопросы"
                    : "Предложить скидку или альтернативный вариант",
            })
            .returning();
          existingLead = newLead;

          await db.insert(leadChatMessagesTable).values({
            leadId: newLead.id,
            platform: "Telegram",
            title: `Новая заявка: ${clientName}`,
            message: [
              `Клиент: ${clientName}`,
              `Платформа: Telegram`,
              `Услуга: ${newLead.service}`,
              newLead.quantity ? `Количество: ${newLead.quantity}` : null,
              newLead.deadline ? `Дата/Срок: ${newLead.deadline}` : null,
              newLead.price ? `Цена: ${newLead.price}` : null,
              newLead.details ? `Детали: ${newLead.details}` : null,
              `Статус: ${newLead.status}`,
            ]
              .filter(Boolean)
              .join("\n"),
          });

          await upsertConversation(chatId, { leadId: newLead.id });
        }

        // Try to book appointment from deadline or current message
        if (existingLead) {
          const deadlineText = effectiveLeadData.deadline ?? null;
          // Extract time: first from AI-parsed deadline, then from current message
          const deadlineTimeMatch = deadlineText?.match(/(\d{1,2}:\d{2})/);
          const textTimeMatch = text.match(/(\d{1,2}:\d{2})/);
          const finalTimeSlot = deadlineTimeMatch?.[1] ?? textTimeMatch?.[1] ?? null;

          if (finalTimeSlot) {
            // Get ISO date: from conv.pendingDate, from deadline text, or from current message
            const dateFromDeadline = deadlineText ? await parseDateFromText(deadlineText) : null;
            const dateFromText = await parseDateFromText(text);
            const finalDate = conv.pendingDate ?? dateFromDeadline ?? dateFromText ?? null;

            if (finalDate) {
              // Only insert if slot not already booked
              const slotAlreadyTaken = await isSlotBooked(finalDate, finalTimeSlot);
              if (!slotAlreadyTaken) {
                await db.insert(appointmentsTable).values({
                  userId: seller?.id ?? null,
                  leadId: existingLead.id,
                  date: finalDate,
                  timeSlot: finalTimeSlot,
                  clientName,
                  clientChatId: chatId,
                  status: "booked",
                });
                // Update lead deadline to proper format
                await db.update(leadsTable).set({
                  deadline: `${finalDate} ${finalTimeSlot}`,
                }).where(eq(leadsTable.id, existingLead.id));
              }
            }
          }
        }

        // Notify seller: always for new leads, and also when phone is provided for existing leads
        const shouldNotifySeller = seller && (!conv.leadId || phonePattern);
        if (shouldNotifySeller) {
          // Send new message on phone confirmation; edit for intermediate updates
          const msgId = await sendLeadToSeller(bot, seller, existingLead!, phonePattern ? null : conv.sellerMsgId);
          if (msgId) {
            await upsertConversation(chatId, { sellerMsgId: msgId });
          }
        }

        if (!conv.leadId && !botAsksForPhone) {
          await bot.sendMessage(
            chatId,
            `Заявка зафиксирована! Чтобы менеджер мог с вами связаться, укажите ваш номер телефона.`,
            {
              reply_markup: {
                keyboard: [[{ text: "📱 Поделиться номером телефона", request_contact: true }]],
                one_time_keyboard: true,
                resize_keyboard: true,
              },
            }
          );
          await upsertConversation(chatId, { leadId: existingLead!.id });
        } else if (!conv.leadId) {
          await upsertConversation(chatId, { leadId: existingLead!.id });
        }
      }
    }
  });

  bot.on("polling_error", (error) => {
    console.error("[TelegramBot] Polling error:", error.message);
  });

  console.log("[TelegramBot] Bot started successfully");
  return bot;
}
