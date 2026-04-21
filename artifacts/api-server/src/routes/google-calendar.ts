import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db, usersTable } from "@workspace/db";
import { getUserIdFromRequest } from "./auth-helper";
import {
  buildAuthUrl,
  createOAuthClient,
  fetchUserEmail,
  isGoogleConfigured,
} from "../lib/google-calendar";

const router: IRouter = Router();

const stateStore = new Map<string, { userId: number; expiresAt: number }>();

function cleanupStates() {
  const now = Date.now();
  for (const [key, value] of stateStore) {
    if (value.expiresAt < now) stateStore.delete(key);
  }
}

router.get("/calendar/google/status", async (req, res): Promise<void> => {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "Требуется авторизация." });
    return;
  }
  if (!isGoogleConfigured()) {
    res.json({ configured: false, connected: false });
    return;
  }
  const [user] = await db
    .select({
      googleEmail: usersTable.googleEmail,
      googleRefreshToken: usersTable.googleRefreshToken,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  res.json({
    configured: true,
    connected: Boolean(user?.googleRefreshToken),
    email: user?.googleEmail ?? null,
  });
});

router.get("/calendar/google/auth", async (req, res): Promise<void> => {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "Требуется авторизация." });
    return;
  }
  if (!isGoogleConfigured()) {
    res.status(500).json({ error: "Google OAuth не настроен на сервере." });
    return;
  }
  cleanupStates();
  const state = randomBytes(16).toString("hex");
  stateStore.set(state, { userId, expiresAt: Date.now() + 10 * 60 * 1000 });
  const url = buildAuthUrl(state);
  res.json({ url });
});

router.post("/calendar/google/disconnect", async (req, res): Promise<void> => {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "Требуется авторизация." });
    return;
  }
  await db
    .update(usersTable)
    .set({
      googleRefreshToken: null,
      googleAccessToken: null,
      googleTokenExpiry: null,
      googleEmail: null,
    })
    .where(eq(usersTable.id, userId));
  res.json({ success: true });
});

export const oauthCallbackHandler: import("express").RequestHandler = async (req, res) => {
  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;
  const errorParam = req.query.error as string | undefined;

  if (errorParam) {
    res.send(renderResultPage(false, `Доступ не предоставлен: ${errorParam}`));
    return;
  }
  if (!code || !state) {
    res.status(400).send(renderResultPage(false, "Отсутствуют параметры code или state."));
    return;
  }
  const entry = stateStore.get(state);
  stateStore.delete(state);
  if (!entry || entry.expiresAt < Date.now()) {
    res.status(400).send(renderResultPage(false, "Сессия авторизации истекла. Попробуйте снова."));
    return;
  }
  if (!isGoogleConfigured()) {
    res.status(500).send(renderResultPage(false, "Google OAuth не настроен."));
    return;
  }

  try {
    const oauth2 = createOAuthClient();
    const { tokens } = await oauth2.getToken(code);
    if (!tokens.refresh_token) {
      res.status(400).send(
        renderResultPage(
          false,
          "Google не вернул refresh_token. Откройте https://myaccount.google.com/permissions, удалите доступ к этому приложению и подключитесь снова."
        )
      );
      return;
    }
    const email = tokens.access_token ? await fetchUserEmail(tokens.access_token) : null;
    await db
      .update(usersTable)
      .set({
        googleRefreshToken: tokens.refresh_token,
        googleAccessToken: tokens.access_token ?? null,
        googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        googleEmail: email,
      })
      .where(eq(usersTable.id, entry.userId));

    res.send(renderResultPage(true, email ?? "Google Calendar"));
  } catch (e) {
    console.error("[oauth2callback] error:", e);
    res.status(500).send(renderResultPage(false, "Ошибка при обмене кода на токен."));
  }
};

function renderResultPage(success: boolean, message: string): string {
  const color = success ? "#10b981" : "#ef4444";
  const title = success ? "✅ Google Calendar подключён" : "❌ Не удалось подключить";
  const body = success
    ? `Аккаунт <b>${escape(message)}</b> успешно подключён.<br>Это окно можно закрыть и вернуться в CRM.`
    : escape(message);
  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;background:#0a0a0a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px}
.card{max-width:420px;text-align:center;padding:32px;border:1px solid #222;border-radius:12px;background:#111}
h1{color:${color};margin:0 0 16px;font-size:20px}
p{color:#aaa;line-height:1.5}
button{margin-top:20px;background:${color};color:#fff;border:0;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:14px}</style>
</head><body><div class="card"><h1>${title}</h1><p>${body}</p>
<button onclick="window.close()">Закрыть окно</button>
<script>setTimeout(()=>window.close(),3000)</script>
</div></body></html>`;
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export default router;
