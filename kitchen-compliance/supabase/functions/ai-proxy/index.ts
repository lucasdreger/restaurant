import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type UsageLog = {
  site_id: string | null;
  user_id: string | null;
  action: string;
  provider: string;
  model?: string | null;
  tokens_used?: number;
  duration_ms: number;
  status: string;
  error_message?: string;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!authHeader) return null;

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

type AuthenticatedUser = {
  id: string;
  email?: string | null;
};

async function validateAccessToken(
  token: string,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<AuthenticatedUser | null> {
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: serviceRoleKey,
      },
    });

    if (!response.ok) return null;

    const user = await response.json();
    if (!user?.id || typeof user.id !== "string") return null;

    return { id: user.id, email: user.email ?? null };
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  let action = "unknown";
  let siteId: string | null = null;
  let userId: string | null = null;

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // NOTE:
    // `verify_jwt` is intentionally disabled for this function because some projects
    // using asymmetric JWT signing keys can hit false 401s at the function gateway.
    // We enforce auth manually by validating bearer tokens against Auth API.
    const token = extractBearerToken(req);
    if (!token) {
      return jsonResponse({ error: "Unauthorized: missing bearer token" }, 401);
    }

    const validatedUser = await validateAccessToken(token, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    userId = validatedUser?.id ?? null;
    if (!userId) {
      return jsonResponse({ error: "Unauthorized: invalid bearer token" }, 401);
    }

    const body = await req.json();
    action = body.action;
    siteId = body.site_id || null;

    let result: Response;

    switch (action) {
      case "transcribe": {
        if (!OPENAI_API_KEY) {
          throw new Error("OpenAI API key not configured. Contact admin.");
        }
        result = await handleTranscribe(body, OPENAI_API_KEY);
        break;
      }
      case "realtime_session": {
        if (!OPENAI_API_KEY) {
          throw new Error("OpenAI API key not configured. Contact admin.");
        }
        result = await handleRealtimeSession(body, OPENAI_API_KEY);
        break;
      }
      case "ocr": {
        if (!OPENROUTER_API_KEY) {
          throw new Error("OpenRouter API key not configured. Contact admin.");
        }
        result = await handleOCR(body, OPENROUTER_API_KEY);
        break;
      }
      case "tts": {
        if (!OPENAI_API_KEY) {
          throw new Error("OpenAI API key not configured. Contact admin.");
        }
        result = await handleTTS(body, OPENAI_API_KEY);
        break;
      }
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    const durationMs = Date.now() - startTime;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    await logUsage(supabase, {
      site_id: siteId,
      user_id: userId,
      action,
      provider: action === "ocr" ? "openrouter" : "openai",
      model: body.model || null,
      duration_ms: durationMs,
      status: "success",
    });

    return result;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[ai-proxy] Error in ${action}:`, errorMessage);

    try {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await logUsage(supabase, {
        site_id: siteId,
        user_id: userId,
        action,
        provider: action === "ocr" ? "openrouter" : "openai",
        duration_ms: durationMs,
        status: "error",
        error_message: errorMessage,
      });
    } catch (logErr) {
      console.error("[ai-proxy] Failed to log error:", logErr);
    }

    return jsonResponse({ error: errorMessage }, 500);
  }
});

async function handleTranscribe(
  body: { audio_base64: string; mime_type?: string; language?: string },
  apiKey: string,
): Promise<Response> {
  const { audio_base64, mime_type = "audio/webm", language = "en" } = body;

  const binaryString = atob(audio_base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const ext = mime_type.includes("webm")
    ? "webm"
    : mime_type.includes("mp4")
    ? "m4a"
    : mime_type.includes("ogg")
    ? "ogg"
    : "webm";

  const formData = new FormData();
  formData.append("file", new File([bytes], `audio.${ext}`, { type: mime_type }));
  formData.append("model", "whisper-1");
  formData.append("language", language);
  formData.append("response_format", "json");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Whisper API error ${response.status}: ${errText}`);
  }

  const result = await response.json();
  return jsonResponse({ text: result.text || "", duration: result.duration });
}

async function handleOCR(
  body: { image_base64: string; model?: string },
  apiKey: string,
): Promise<Response> {
  const { image_base64, model = "google/gemini-2.0-flash-001" } = body;

  const systemPrompt = `You are an expert invoice/delivery note parser for a restaurant kitchen. 
Extract the following information from the invoice image and return it as valid JSON:

{
  "supplier": "Company name of the supplier",
  "invoiceNumber": "Invoice or delivery note number",
  "invoiceDate": "Date in YYYY-MM-DD format",
  "items": [
    {
      "name": "Product name",
      "quantity": "Numeric quantity as string",
      "unit": "Unit (kg, g, l, ml, pcs, box, case, etc.)"
    }
  ],
  "rawText": "Brief summary of what you see on the invoice"
}

Rules:
- Extract ALL line items you can find
- Normalize units: kg, g, l, ml, pcs, box, case
- If quantity and unit are combined (e.g., "2.5kg"), separate them
- For items without clear units, use "pcs"
- Dates should be converted to YYYY-MM-DD format
- If you cannot find a field, use null
- Return ONLY valid JSON, no markdown or explanations`;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://chefvoice.app",
      "X-Title": "ChefVoice OCR",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Please extract all invoice data from this image." },
            { type: "image_url", image_url: { url: image_base64 } },
          ],
        },
      ],
      max_tokens: 2000,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("No content in OCR response");

  let parsed;
  try {
    const jsonStr = content.replace(/```json\n?|\n?```/g, "").trim();
    parsed = JSON.parse(jsonStr);
  } catch {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("Could not parse JSON from OCR response");
    }
  }

  return jsonResponse({
    ...parsed,
    provider: "openrouter",
    model,
    confidence: 95,
  });
}

async function handleRealtimeSession(
  body: { model?: string; voice?: string; language?: string; transcription_model?: string },
  apiKey: string,
): Promise<Response> {
  const {
    model = "gpt-4o-realtime-preview-2024-12-17",
    voice = "alloy",
    language = "en",
    transcription_model = "gpt-4o-transcribe",
  } = body;

  const instructions = language.startsWith("pt")
    ? "Você é um transcritor em tempo real para comandos de cozinha. Foque em transcrever fielmente a fala do usuário."
    : "You are a realtime transcriber for kitchen voice commands. Focus on faithful user speech transcription.";

  const createRealtimeSession = async (transcriptionModel: string) =>
    fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        voice,
        turn_detection: {
          type: "server_vad",
          prefix_padding_ms: 250,
          silence_duration_ms: 350,
          create_response: false,
        },
        input_audio_transcription: {
          model: transcriptionModel,
        },
        instructions,
      }),
    });

  let response = await createRealtimeSession(transcription_model);

  if (!response.ok && transcription_model !== "whisper-1") {
    const firstError = await response.text();
    console.warn(
      `[ai-proxy] Realtime transcription model ${transcription_model} failed, retrying with whisper-1:`,
      firstError,
    );
    response = await createRealtimeSession("whisper-1");
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI Realtime session error ${response.status}: ${errText}`);
  }

  const session = await response.json();
  return jsonResponse({
    id: session.id,
    model: session.model ?? model,
    expires_at: session.expires_at ?? null,
    client_secret: session.client_secret ?? null,
  });
}

async function handleTTS(
  body: { text: string; voice?: string; speed?: number },
  apiKey: string,
): Promise<Response> {
  const { text, voice = "alloy", speed = 1.0 } = body;

  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      input: text,
      voice,
      response_format: "mp3",
      speed,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI TTS error ${response.status}: ${errText}`);
  }

  const audioBuffer = await response.arrayBuffer();
  return new Response(audioBuffer, {
    headers: {
      ...corsHeaders,
      "Content-Type": "audio/mpeg",
      "Content-Length": audioBuffer.byteLength.toString(),
    },
  });
}

async function logUsage(supabase: any, log: UsageLog) {
  try {
    await supabase.from("api_usage_logs").insert(log);
  } catch (err) {
    console.error("[ai-proxy] Failed to log usage:", err);
  }
}
