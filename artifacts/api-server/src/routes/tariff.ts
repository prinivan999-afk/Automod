import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, tariffSettingsTable } from "@workspace/db";
import { ai } from "@workspace/integrations-gemini-ai";
import {
  AnalyzeTariffBody,
  SaveTariffSettingsBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/tariff/analyze", async (req, res): Promise<void> => {
  const parsed = AnalyzeTariffBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { rawText, businessType } = parsed.data;

  const prompt = `Ты — помощник для анализа прайс-листов бизнеса.

Тебе дан текст с описанием товаров/услуг и ценами от бизнесмена.
${businessType ? `Тип бизнеса: ${businessType}` : ""}

Текст от бизнесмена:
"""
${rawText}
"""

Твоя задача:
1. Извлечь все товары/услуги с ценами
2. Структурировать их в список
3. Определить тип бизнеса
4. Создать промпт для AI-бота, который будет общаться с клиентами

Верни ТОЛЬКО JSON в следующем формате (без markdown, без \`\`\`json):
{
  "businessType": "тип бизнеса (например: Кондитерская, Фотограф, Дизайнер)",
  "items": [
    {
      "name": "название товара/услуги",
      "description": "краткое описание или null",
      "price": "цена (например: '500 руб', 'от 1000 руб', '200 руб/кг')",
      "unit": "единица измерения или null (шт, кг, час, и т.д.)",
      "category": "категория или null"
    }
  ],
  "summary": "Краткое описание прайс-листа в 1-2 предложениях на русском",
  "botPrompt": "Системный промпт для AI-бота на русском, который описывает бизнес, все товары с ценами, и инструкции как общаться с клиентами. Бот должен здороваться, выяснять потребности клиента, называть цены, уточнять детали (количество, срок, пожелания) и в конце формировать итог заявки."
}`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { maxOutputTokens: 8192 },
  });

  const text = response.text ?? "";

  let parsed2: {
    businessType: string;
    items: Array<{
      name: string;
      description: string | null;
      price: string;
      unit: string | null;
      category: string | null;
    }>;
    summary: string;
    botPrompt: string;
  };

  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    parsed2 = JSON.parse(cleaned);
  } catch {
    req.log.error({ text }, "Failed to parse Gemini JSON response");
    res.status(500).json({ error: "AI не смог структурировать прайс-лист. Попробуйте переформулировать." });
    return;
  }

  res.json(parsed2);
});

router.get("/tariff/settings", async (req, res): Promise<void> => {
  const [settings] = await db
    .select()
    .from(tariffSettingsTable)
    .orderBy(tariffSettingsTable.updatedAt)
    .limit(1);

  if (!settings) {
    res.status(200).json(null);
    return;
  }

  res.json(formatTariff(settings));
});

router.post("/tariff/settings", async (req, res): Promise<void> => {
  const parsed = SaveTariffSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await db.select().from(tariffSettingsTable).limit(1);

  let saved;
  if (existing.length > 0) {
    [saved] = await db
      .update(tariffSettingsTable)
      .set(parsed.data)
      .where(eq(tariffSettingsTable.id, existing[0].id))
      .returning();
  } else {
    [saved] = await db
      .insert(tariffSettingsTable)
      .values(parsed.data)
      .returning();
  }

  res.json(formatTariff(saved));
});

function formatTariff(t: typeof tariffSettingsTable.$inferSelect) {
  return {
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export default router;
