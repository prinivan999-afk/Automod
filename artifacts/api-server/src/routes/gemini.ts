import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { conversations, messages } from "@workspace/db";
import { ai } from "@workspace/integrations-gemini-ai";
import { generateImage } from "@workspace/integrations-gemini-ai/image";
import {
  CreateGeminiConversationBody,
  SendGeminiMessageBody,
  GenerateGeminiImageBody,
} from "@workspace/api-zod";

const router = Router();

router.get("/gemini/conversations", async (_req, res) => {
  try {
    const result = await db.select().from(conversations).orderBy(conversations.createdAt);
    res.json(result.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/gemini/conversations", async (req, res) => {
  try {
    const parsed = CreateGeminiConversationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [created] = await db.insert(conversations).values({ title: parsed.data.title }).returning();
    res.status(201).json({ ...created, createdAt: created.createdAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get("/gemini/conversations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
    if (!conv) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    const msgs = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(messages.createdAt);
    res.json({
      ...conv,
      createdAt: conv.createdAt.toISOString(),
      messages: msgs.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })),
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete("/gemini/conversations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [deleted] = await db.delete(conversations).where(eq(conversations.id, id)).returning();
    if (!deleted) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get("/gemini/conversations/:id/messages", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const msgs = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(messages.createdAt);
    res.json(msgs.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/gemini/conversations/:id/messages", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
    if (!conv) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    const parsed = SendGeminiMessageBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    await db.insert(messages).values({ conversationId: id, role: "user", content: parsed.data.content });

    const chatMessages = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(messages.createdAt);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullResponse = "";

    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: chatMessages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      config: { maxOutputTokens: 8192 },
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    }

    await db.insert(messages).values({ conversationId: id, role: "assistant", content: fullResponse });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/gemini/generate-image", async (req, res) => {
  try {
    const parsed = GenerateGeminiImageBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { b64_json, mimeType } = await generateImage(parsed.data.prompt);
    res.json({ b64_json, mimeType });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
