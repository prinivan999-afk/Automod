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

const rawAi = new GoogleGenAI({
  apiKey,
  ...(baseUrl
    ? { httpOptions: { apiVersion: "", baseUrl } }
    : {}),
});

// If baseUrl is NOT set, we must strip the "ag/" prefix from model names
const cleanModel = (model: string) => {
  if (!baseUrl && model.startsWith("ag/")) {
    return model.slice(3); // e.g. "ag/gemini-2.5-flash" -> "gemini-2.5-flash"
  }
  return model;
};

// Proxy models.generateContent and models.generateContentStream to automatically clean model name
const originalGenerateContent = rawAi.models.generateContent.bind(rawAi.models);
const originalGenerateContentStream = rawAi.models.generateContentStream.bind(rawAi.models);

(rawAi.models as any).generateContent = async (params: any) => {
  if (params && typeof params.model === "string") {
    params.model = cleanModel(params.model);
  }
  return originalGenerateContent(params);
};

(rawAi.models as any).generateContentStream = async (params: any) => {
  if (params && typeof params.model === "string") {
    params.model = cleanModel(params.model);
  }
  return originalGenerateContentStream(params);
};

export const ai = rawAi;
