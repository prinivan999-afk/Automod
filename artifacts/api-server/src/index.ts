import app from "./app";
import { logger } from "./lib/logger";
import { startTelegramBot, startAppointmentCleanupJob } from "./telegram-bot";
import TelegramBot from "node-telegram-bot-api";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const isDev = process.env.NODE_ENV === "development";

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startAppointmentCleanupJob();

  let botInstance: TelegramBot | null = null;

  const shutdown = () => {
    if (botInstance) {
      botInstance.stopPolling().finally(() => process.exit(0));
    } else {
      process.exit(0);
    }
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  const botEnabled = !isDev || process.env.BOT_ENABLED === "true";

  if (!botEnabled) {
    logger.info(
      "Development mode: Telegram bot disabled. Set BOT_ENABLED=true to enable in dev."
    );
  } else {
    if (isDev) {
      logger.info("Development mode: Starting Telegram bot (BOT_ENABLED=true)");
    }
    startTelegramBot()
      .then((bot) => {
        botInstance = bot;
      })
      .catch((err) => {
        logger.error({ err }, "Failed to start Telegram bot");
      });
  }
});
