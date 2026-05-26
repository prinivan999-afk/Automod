import { GoogleGenAI } from "@google/genai";

// Support two modes:
//   Replit  — AI_INTEGRATIONS_GEMINI_API_KEY + AI_INTEGRATIONS_GEMINI_BASE_URL (proxy)
//   Railway / anywhere — GEMINI_API_KEY (direct Google API)
const apiKey =
  process.env.AI_INTEGRATIONS_GEMINI_API_KEY ??
  process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error(
    "Gemini API key not found. " +
    "On Replit set AI_INTEGRATIONS_GEMINI_API_KEY via the Gemini integration. " +
    "On Railway/other set GEMINI_API_KEY from https://aistudio.google.com/apikey"
  );
}

const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;

export const ai = new GoogleGenAI({
  apiKey,
  ...(baseUrl
    ? { httpOptions: { apiVersion: "", baseUrl } }
    : {}),
});
