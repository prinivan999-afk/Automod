import TelegramBot from "node-telegram-bot-api";
import { eq } from "drizzle-orm";
import { db, usersTable, tariffSettingsTable, leadsTable, leadChatMessagesTable } from "@workspace/db";
import { ai } from "@workspace/integrations-gemini-ai";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

interface ConversationState {
  userId: number;
  sellerId: number;
  sellerUsername: string;
  messages: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }>;
  startedAt: number;
}

const conversations = new Map<number, ConversationState>();

async function getSellerByUsername(username: string) {
  const clean = username.replace(/^@/, "").toLowerCase().trim();
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.telegramUsername, clean))
    .limit(1);
  return user ?? null;
}

async function getBotPrompt(sellerId: number): Promise<string> {
  const [settings] = await db
    .select()
    .from(tariffSettingsTable)
    .orderBy(tariffSettingsTable.updatedAt)
    .limit(1);

  if (settings?.botPrompt) {
    return settings.botPrompt;
  }

  return `Ты — вежливый AI-помощник бизнеса в Telegram. 
Отвечай на вопросы клиентов, уточняй детали заказа (что нужно, количество, сроки, пожелания).
Общайся по-русски, будь приветлив и профессионален.
Когда клиент определился с заказом — скажи, что его заявка принята и менеджер свяжется с ним.`;
}

async function extractLeadFromConversation(
  messages: ConversationState["messages"],
  clientName: string,
  botPrompt: string
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

  const extractPrompt = `Ты анализируешь переписку клиента с AI-ботом бизнеса.

Переписка:
"""
${conversationText}
"""

Извлеки информацию о заявке. Верни ТОЛЬКО JSON (без markdown):
{
  "service": "что хочет клиент (кратко, 2-5 слов)",
  "details": "подробности или null",
  "quantity": "количество или null",
  "deadline": "срок или null",
  "price": "цена если называлась или null",
  "status": "hot если клиент готов купить, warm если интересуется, cold если просто смотрит",
  "readyToClose": true/false
}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: extractPrompt }] }],
      config: { maxOutputTokens: 1024 },
    });
    const text = (response.text ?? "").replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const data = JSON.parse(text);
    return data;
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
    `🆕 *Новая заявка от клиента*`,
    ``,
    `👤 Клиент: ${lead.clientName}`,
    `📦 Услуга: ${lead.service}`,
    lead.quantity ? `📊 Количество: ${lead.quantity}` : null,
    lead.deadline ? `⏰ Срок: ${lead.deadline}` : null,
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
    console.error("Failed to send lead to seller:", e);
  }
}

export function startTelegramBot() {
  if (!BOT_TOKEN) {
    console.warn("[TelegramBot] TELEGRAM_BOT_TOKEN not set, bot disabled");
    return null;
  }

  const bot = new TelegramBot(BOT_TOKEN, { polling: true });

  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;
    if (!userId) return;

    const text = `Привет! 👋

Я AI-помощник для клиентов. 

Чтобы начать, напишите *@username* продавца (например: *@misha_flowers*), и я помогу вам оформить заказ!`;

    await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
  });

  bot.onText(/\/token (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const token = match?.[1]?.trim();
    if (!token) return;

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.apiToken, token))
      .limit(1);

    if (!user) {
      await bot.sendMessage(chatId, "❌ Токен не найден. Проверьте токен в вашем личном кабинете.");
      return;
    }

    await db
      .update(usersTable)
      .set({ telegramChatId: String(chatId) })
      .where(eq(usersTable.id, user.id));

    await bot.sendMessage(
      chatId,
      `✅ Ваш аккаунт *${user.telegramUsername}* успешно привязан!\n\nТеперь все новые заявки будут приходить сюда.`,
      { parse_mode: "Markdown" }
    );
  });

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;
    const text = msg.text;

    if (!userId || !text) return;
    if (text.startsWith("/")) return;

    const existingConv = conversations.get(userId);

    if (!existingConv) {
      const usernameMatch = text.match(/@(\w+)/);
      if (!usernameMatch) {
        await bot.sendMessage(
          chatId,
          `Чтобы начать, укажите *@username* продавца.\n\nНапример: *@misha_flowers*`,
          { parse_mode: "Markdown" }
        );
        return;
      }

      const seller = await getSellerByUsername(usernameMatch[1]);
      if (!seller) {
        await bot.sendMessage(
          chatId,
          `❌ Продавец *@${usernameMatch[1]}* не найден в системе. Проверьте правильность username.`,
          { parse_mode: "Markdown" }
        );
        return;
      }

      const botPrompt = await getBotPrompt(seller.id);

      conversations.set(userId, {
        userId,
        sellerId: seller.id,
        sellerUsername: seller.telegramUsername,
        messages: [],
        startedAt: Date.now(),
      });

      const greeting = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${botPrompt}\n\nПоздоровайся с клиентом и спроси, чем можешь помочь. Ответь одним коротким сообщением.`,
              },
            ],
          },
        ],
        config: { maxOutputTokens: 512 },
      });

      const greetText = greeting.text ?? "Здравствуйте! Чем могу помочь?";

      conversations.get(userId)!.messages.push({
        role: "model",
        parts: [{ text: greetText }],
      });

      await bot.sendMessage(chatId, greetText);
      return;
    }

    const conv = existingConv;
    conv.messages.push({ role: "user", parts: [{ text }] });

    const botPrompt = await getBotPrompt(conv.sellerId);

    const contents = [
      { role: "user" as const, parts: [{ text: botPrompt }] },
      { role: "model" as const, parts: [{ text: "Понял, буду следовать инструкциям." }] },
      ...conv.messages,
    ];

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents,
      config: { maxOutputTokens: 1024 },
    });

    const replyText = response.text ?? "Минуту, уточняю информацию...";
    conv.messages.push({ role: "model", parts: [{ text: replyText }] });

    await bot.sendMessage(chatId, replyText);

    const msgCount = conv.messages.filter((m) => m.role === "user").length;
    const isReadyKeywords = /готов|оформи|заказ|беру|куплю|хочу купить|оформляем|давайте|да|согласен/i.test(text);
    const isLongEnough = msgCount >= 3;

    if ((isReadyKeywords && isLongEnough) || msgCount >= 8) {
      const clientName = msg.from?.username
        ? `@${msg.from.username}`
        : msg.from?.first_name ?? "Клиент из Telegram";

      const [seller] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, conv.sellerId))
        .limit(1);

      const leadData = await extractLeadFromConversation(conv.messages, clientName, botPrompt);

      if (leadData) {
        const [lead] = await db
          .insert(leadsTable)
          .values({
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
                ? "Связаться как можно быстрее — клиент готов купить"
                : leadData.status === "warm"
                  ? "Уточнить детали заказа и ответить на вопросы"
                  : "Предложить скидку или альтернативный вариант",
          })
          .returning();

        await db.insert(leadChatMessagesTable).values({
          leadId: lead.id,
          platform: "Telegram",
          title: `Новая заявка: ${clientName}`,
          message: [
            `Клиент: ${clientName}`,
            `Платформа: Telegram`,
            `Услуга: ${lead.service}`,
            lead.quantity ? `Количество: ${lead.quantity}` : null,
            lead.deadline ? `Срок: ${lead.deadline}` : null,
            lead.price ? `Цена: ${lead.price}` : null,
            lead.details ? `Детали: ${lead.details}` : null,
            `Статус: ${lead.status}`,
          ]
            .filter(Boolean)
            .join("\n"),
        });

        if (seller) {
          await sendLeadToSeller(bot, seller, lead);
        }

        await bot.sendMessage(
          chatId,
          `✅ Отлично! Ваша заявка принята. Менеджер свяжется с вами в ближайшее время.`
        );

        conversations.delete(userId);
      }
    }
  });

  bot.on("polling_error", (error) => {
    console.error("[TelegramBot] Polling error:", error.message);
  });

  console.log("[TelegramBot] Bot started successfully");
  return bot;
}
