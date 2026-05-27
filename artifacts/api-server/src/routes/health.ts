import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  res.json({
    status: "ok",
    env: {
      AI_INTEGRATIONS_GEMINI_BASE_URL: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL || "not set",
      GEMINI_API_KEY_exists: !!process.env.GEMINI_API_KEY,
      AI_INTEGRATIONS_GEMINI_API_KEY_exists: !!process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
      NODE_ENV: process.env.NODE_ENV || "not set",
    }
  });
});

export default router;
