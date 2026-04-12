import TelegramBot from "node-telegram-bot-api";
import { eq, and } from "drizzle-orm";
import {
  db,
  usersTable,
  tariffSettingsTable,
  leadsTable,
  leadChatMessagesTable,
  workScheduleTable,
  appointmentsTable,
  botConversationsTable,
} from "@workspace/db";
import { ai } from "@workspace/integrations-gemini-ai";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

type BotMessage = { role: "user" | "model"; parts: Array<{ text: string }> };

const DEFAULT_GREETING = "Здравствуйте! Я ваш дружелюбный AI-помощник. Чем могу помочь?";

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

async function parseDateFromText(text: string): Promise<string | null> {
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

Извлеки информацию о заявке. ${priceList ? 'Поле "service" должно содержать ТОЧНОЕ название услуги из прайс-листа (если клиент выбрал что-то из него). Если услуга не из прайса — напиши кратко что хочет клиент.' : 'Поле "service" — что хочет клиент (кратко, 2-5 слов).'}
Верни ТОЛЬКО JSON (без markdown):
{
  "service": "точное название услуги из прайса или краткое описание (2-5 слов)",
  "details": "подробности, пожелания клиента или null",
  "quantity": "количество или null",
  "deadline": "дата/срок или null",
  "price": "цена из прайса если выбрана конкретная услуга, иначе цена если называлась или null",
  "status": "hot если клиент готов и выбрал время, warm если интересуется, cold если просто смотрит"
}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: extractPrompt }] }],
      config: { maxOutputTokens: 1024 },
    });
    const text = (response.text ?? "").replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function sendLeadToSeller(
  bot: TelegramBot,
  seller: typeof usersTable.$inferSelect,
  lead: typeof leadsTable.$inferSelect
) {
  if (!seller.telegramChatId) return;

  const msg = [
    `🆕 *Новая заявка из Telegram*`,
    ``,
    `👤 Клиент: ${lead.clientName}`,
    `📦 Услуга: ${lead.service}`,
    lead.quantity ? `📊 Количество: ${lead.quantity}` : null,
    lead.deadline ? `📅 Дата/Срок: ${lead.deadline}` : null,
    lead.price ? `💰 Цена: ${lead.price}` : null,
    lead.details ? `📝 Детали: ${lead.details}` : null,
    ``,
    `🔥 Статус: ${lead.status === "hot" ? "Горячий" : lead.status === "warm" ? "Тёплый" : "Холодный"}`,
  ]
    .filter((l) => l !== null)
    .join("\n");

  try {
    await bot.sendMessage(seller.telegramChatId, msg, { parse_mode: "Markdown" });
  } catch (e) {
    console.error("[TelegramBot] Failed to send lead to seller:", e);
  }
}

export function startTelegramBot() {
  if (!BOT_TOKEN) {
    console.warn("[TelegramBot] TELEGRAM_BOT_TOKEN not set, bot disabled");
    return null;
  }

  const bot = new TelegramBot(BOT_TOKEN, { polling: true });

  bot.onText(/\/start/, async (msg) => {
    const chatId = String(msg.chat.id);

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
      await bot.sendMessage(chatId, "❌ Токен не найден. Проверьте токен в личном кабинете.");
      return;
    }

    const realUsername = msg.from?.username?.toLowerCase();

    if (!realUsername) {
      await bot.sendMessage(
        chatId,
        `❌ Не удалось получить ваш Telegram username.\n\nУстановите username в настройках Telegram (Настройки → Изменить профиль → Имя пользователя) и попробуйте снова.`
      );
      return;
    }

    const updateData: Partial<typeof usersTable.$inferInsert> = {
      telegramChatId: chatId,
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

      const priceListIntro = priceList
        ? `\n\nПрайс-лист товаров/услуг:\n${priceList}`
        : "";

      const greetingResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${botPrompt}${priceListIntro}\n\nПоздоровайся с клиентом. Скажи: "Здравствуйте! Я ваш дружелюбный AI-помощник." и спроси чем можешь помочь. Одно короткое сообщение.`,
              },
            ],
          },
        ],
        config: { maxOutputTokens: 256 },
      });

      const greetText = greetingResponse.text ?? "Здравствуйте! Я ваш дружелюбный AI-помощник. Чем могу помочь?";

      conv = await upsertConversation(chatId, {
        sellerId: seller.id,
        sellerUsername: seller.telegramUsername,
        status: "active",
        messages: JSON.stringify([{ role: "model", parts: [{ text: greetText }] }]),
      });

      await bot.sendMessage(chatId, greetText);
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

    const detectedDate = await parseDateFromText(text);
    if (detectedDate) {
      const slotsText = await getAvailableSlotsText(detectedDate);

      messages.push({ role: "model", parts: [{ text: slotsText }] });
      await db
        .update(botConversationsTable)
        .set({ messages: JSON.stringify(messages) })
        .where(eq(botConversationsTable.userChatId, chatId));

      await bot.sendMessage(chatId, slotsText);
      return;
    }

    const { botPrompt, priceList } = await getSellerSettings(conv.sellerId);

    const systemPromptText = priceList
      ? `${botPrompt}\n\nПрайс-лист товаров/услуг:\n${priceList}\n\nИспользуй ТОЛЬКО эти товары/услуги из прайса при ответах на вопросы о наличии, ценах и описаниях. Если клиент спрашивает о чём-то не из прайса — сообщи, что такого нет в ассортименте.`
      : botPrompt;

    const contents = [
      { role: "user" as const, parts: [{ text: systemPromptText }] },
      { role: "model" as const, parts: [{ text: "Понял, буду следовать инструкциям и работать только по прайс-листу." }] },
      ...messages,
    ];

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents,
      config: { maxOutputTokens: 1024 },
    });

    const replyText = response.text ?? "Минуту, уточняю информацию...";
    messages.push({ role: "model", parts: [{ text: replyText }] });

    await db
      .update(botConversationsTable)
      .set({ messages: JSON.stringify(messages) })
      .where(eq(botConversationsTable.userChatId, chatId));

    await bot.sendMessage(chatId, replyText);

    const userMessages = messages.filter((m) => m.role === "user").length;
    const isReadyKeyword = /готов|оформи|запиши|беру|куплю|хочу купить|оформляем|давайте|да|согласен|записаться|запишите/i.test(text);
    const timePattern = /\d{1,2}:\d{2}/.test(text);

    const shouldCreateLead = (isReadyKeyword && userMessages >= 2) || (timePattern && userMessages >= 3) || userMessages >= 10;

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

      if (leadData) {
        let existingLead = conv.leadId
          ? (await db.select().from(leadsTable).where(eq(leadsTable.id, conv.leadId)).limit(1))[0]
          : null;

        if (existingLead) {
          const [updated] = await db
            .update(leadsTable)
            .set({
              service: leadData.service || existingLead.service,
              details: leadData.details || existingLead.details,
              quantity: leadData.quantity || existingLead.quantity,
              deadline: leadData.deadline || existingLead.deadline,
              price: leadData.price || existingLead.price,
              status: leadData.status,
              isPriority: leadData.status === "hot",
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
              service: leadData.service,
              details: leadData.details,
              quantity: leadData.quantity,
              deadline: leadData.deadline,
              price: leadData.price,
              status: leadData.status,
              isPriority: leadData.status === "hot",
              recommendation:
                leadData.status === "hot"
                  ? "Связаться как можно быстрее — клиент готов"
                  : leadData.status === "warm"
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

        if (timePattern && leadData.deadline) {
          const timeMatch = text.match(/(\d{1,2}:\d{2})/);
          if (timeMatch && existingLead) {
            const isoDate = leadData.deadline.includes("-")
              ? leadData.deadline
              : new Date().toISOString().split("T")[0];

            await db.insert(appointmentsTable).values({
              leadId: existingLead.id,
              date: isoDate,
              timeSlot: timeMatch[1],
              clientName,
              clientChatId: chatId,
              status: "booked",
            });
          }
        }

        if (seller && !conv.leadId) {
          await sendLeadToSeller(bot, seller, existingLead!);
        }

        if (!conv.leadId) {
          await bot.sendMessage(
            chatId,
            `✅ Отлично! Ваша заявка принята. Менеджер свяжется с вами в ближайшее время.`
          );
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
