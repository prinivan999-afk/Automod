import { GoogleGenAI } from "@google/genai";

const apiKey =
  (process.env.AI_INTEGRATIONS_GEMINI_API_KEY ??
  process.env.GEMINI_API_KEY)?.trim();

if (!apiKey) {
  throw new Error(
    "Gemini API key not found. " +
    "On Replit set AI_INTEGRATIONS_GEMINI_API_KEY via the Gemini integration. " +
    "On Railway/other set GEMINI_API_KEY from https://aistudio.google.com/apikey"
  );
}

const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL?.trim();

// Auto-detect production / cloud environment (like Railway)
const isCloud = process.env.NODE_ENV === "production" || !!process.env.RAILWAY_STATIC_URL;

// If we are in the cloud (Railway) but baseUrl points to localhost, it is a copy-paste error from local/Replit env.
// We must ignore the local baseUrl and use the direct Google Gemini API.
const activeBaseUrl = (baseUrl && isCloud && (baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1")))
  ? undefined
  : baseUrl;

const rawAi = new GoogleGenAI({
  apiKey,
  ...(activeBaseUrl
    ? { httpOptions: { apiVersion: "", baseUrl: activeBaseUrl } }
    : {}),
});

// Any activeBaseUrl means we are using an OpenAI-compatible proxy (like OmniRoute or OpenRouter).
// Since these proxies expect OpenAI-compatible format (like /chat/completions), we must intercept the calls
// and translate them. Google GenAI SDK does not support OpenAI-compatible proxies out of the box.
const isCustomProxy = !!activeBaseUrl;

// Helper to clean up model names for direct Google API calls
const cleanModel = (model: string) => {
  if (!activeBaseUrl && model.startsWith("ag/")) {
    return model.slice(3); // e.g. "ag/gemini-2.5-flash" -> "gemini-2.5-flash"
  }
  return model;
};

// Helper for OpenAI-compatible proxy translation (OmniRoute, OpenRouter, etc.)
async function callCustomProxy(params: any, stream: boolean = false) {
  let model = params.model;
  if (model && model.startsWith("ag/")) {
    model = "antigravity/" + model.slice(3);
  }

  const messages = (params.contents || []).map((c: any) => ({
    role: c.role === "model" ? "assistant" : c.role,
    content: c.parts?.[0]?.text || ""
  }));

  const response = await fetch(`${activeBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: params.config?.maxOutputTokens,
      stream
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Proxy error: ${response.status} - ${errText}`);
  }

  return response;
}

// Proxy models.generateContent and models.generateContentStream
const originalGenerateContent = rawAi.models.generateContent.bind(rawAi.models);
const originalGenerateContentStream = rawAi.models.generateContentStream.bind(rawAi.models);

(rawAi.models as any).generateContent = async (params: any) => {
  if (isCustomProxy) {
    const res = await callCustomProxy(params, false);
    const data = await res.json();
    return {
      text: data.choices?.[0]?.message?.content || ""
    };
  }

  if (params && typeof params.model === "string") {
    params.model = cleanModel(params.model);
  }
  return originalGenerateContent(params);
};

(rawAi.models as any).generateContentStream = async (params: any) => {
  if (isCustomProxy) {
    const res = await callCustomProxy(params, true);
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    
    async function* makeStream() {
      let buffer = "";
      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        
        for (const line of lines) {
          const cleaned = line.trim();
          if (!cleaned.startsWith("data: ")) continue;
          const dataStr = cleaned.slice(6);
          if (dataStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(dataStr);
            const text = parsed.choices?.[0]?.delta?.content || "";
            if (text) {
              yield { text };
            }
          } catch {}
        }
      }
    }
    return makeStream();
  }

  if (params && typeof params.model === "string") {
    params.model = cleanModel(params.model);
  }
  return originalGenerateContentStream(params);
};

export const ai = rawAi;
