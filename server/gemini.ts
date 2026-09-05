import { GoogleGenAI } from "@google/genai";

let geminiClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY no está configurada. Por favor, proporcione la clave en el panel de Secrets de AI Studio o variables de entorno.");
    }
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');
}

export function isRunwayConfigured(): boolean {
  return Boolean(process.env.RUNWAY_API_KEY && process.env.RUNWAY_API_KEY.length > 5);
}

export function isElevenLabsConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_API_KEY.length > 5);
}

export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 5);
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.length > 5);
}

export interface ApiStatusSummary {
  gemini: { configured: boolean; model: string; label: string };
  veo: { configured: boolean; model: string; label: string };
  elevenlabs: { configured: boolean; label: string };
  runway: { configured: boolean; label: string };
  openai: { configured: boolean; label: string };
  stripe: { configured: boolean; label: string };
}

export function getApiStatusSummary(): ApiStatusSummary {
  const geminiOk = isGeminiConfigured();
  return {
    gemini: { configured: geminiOk, model: 'gemini-3.8-flash', label: 'Google Gemini Core' },
    veo: { configured: geminiOk, model: 'veo-3.1-lite-generate-preview', label: 'Google Veo Video AI' },
    elevenlabs: { configured: isElevenLabsConfigured(), label: 'ElevenLabs Voice Engine' },
    runway: { configured: isRunwayConfigured(), label: 'Runway Gen-3 Alpha' },
    openai: { configured: isOpenAIConfigured(), label: 'OpenAI Multimodal' },
    stripe: { configured: isStripeConfigured(), label: 'Stripe Gateway' },
  };
}

// Director IA: Plan structured project
export async function planDirectorProject(
  prompt: string,
  aspectRatio: '9:16' | '16:9' | '1:1' = '9:16',
  targetDuration: number = 30
) {
  const ai = getGeminiClient();

  const systemInstruction = `Eres el Director IA de GREY IA, un cineasta y productor audiovisual de élite mundial.
Tu misión es interpretar la idea del creador y descomponerla en una producción audiovisual completa y lista para ser ensamblada en el timeline de edición de GREY IA.

Reglas estrictas:
- El vídeo debe tener una duración estimada de ${targetDuration} segundos.
- Formato: ${aspectRatio}.
- Debe contener entre 3 y 6 escenas dinámicas con ritmo profesional.
- Cada escena debe incluir:
  * Número de escena y título.
  * Duración en segundos (la suma debe cuadrar con la duración total).
  * Prompt visual detallado en inglés (cinematic, 8k, lighting, camera shot type).
  * Guion de narración (voz en off) en español, con tono natural y persuasivo.
  * Diseño sonoro (efectos de sonido y descripción musical).
  * Subtítulo exacto para esa escena.
- La respuesta DEBE ser estrictamente un JSON válido con la siguiente estructura:
{
  "title": "Título del proyecto",
  "logline": "Resumen conceptual de 1 línea",
  "genre": "Género o estilo visual (ej. Documental cinematográfico, Cyberpunk, Drama, Motivacional)",
  "aspectRatio": "${aspectRatio}",
  "totalDuration": ${targetDuration},
  "overallVoiceTone": "Tono de la voz (ej. Épico, Calmado, Enérgico, Misterioso)",
  "scenes": [
    {
      "sceneNumber": 1,
      "title": "Introducción",
      "duration": 5,
      "visualPrompt": "Detailed cinematic prompt for video/image generation",
      "narrationScript": "Texto que la voz en off pronunciará en este fragmento.",
      "soundEffects": "Descripción del efecto de audio ambiente",
      "subtitle": "Texto visible del subtítulo",
      "cameraMotion": "Slow zoom in / Pan right / Drone shot"
    }
  ],
  "soundtrackPrompt": "Descripción detallada del fondo musical para generar o sincronizar.",
  "recommendedTags": ["tag1", "tag2", "tag3"]
}`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: `Idea del usuario: "${prompt}". Crea el desglose técnico y artístico completo para el director.`,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      temperature: 0.7,
    },
  });

  const text = response.text || '{}';
  try {
    return JSON.parse(text);
  } catch (err) {
    console.error('Failed to parse Director IA JSON:', text, err);
    throw new Error('El Director IA generó una respuesta no estructurada. Por favor, reintente con una descripción más específica.');
  }
}

// Viral Content Generator
export async function generateViralContent(
  topic: string,
  platform: 'tiktok' | 'shorts' | 'reels' | 'youtube',
  niche?: string
) {
  const ai = getGeminiClient();

  const systemInstruction = `Eres el estratega de contenido viral de GREY IA, especializado en maximizar retención (watch time) y viralidad en ${platform}.
Analiza el tema y genera un kit de producción viral de alta conversión.
Devuelve estrictamente un JSON con este formato:
{
  "topic": "${topic}",
  "platform": "${platform}",
  "hooks": [
    "Gancho 1 de alta curiosidad (0-3s)",
    "Gancho 2 de patrón interrumpido",
    "Gancho 3 de contraste radical",
    "Gancho 4 basado en datos sorprendentes",
    "Gancho 5 de pregunta provocadora"
  ],
  "fullScript": "Guion completo con marcas de tiempo [00:00 - 00:03], texto del narrador y notas de acción visual.",
  "titles": [
    "Título 1 clickeable sin clickbait falso",
    "Título 2 con misterio",
    "Título 3 directo y con beneficio"
  ],
  "description": "Descripción optimizada para SEO y algoritmo con llamada a la acción.",
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5", "#tag6"],
  "callToAction": "Llamada a la acción final para retención o comentarios",
  "visualTips": "3 consejos de edición y planos clave para este contenido"
}`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: `Tema: "${topic}". Nicho/Audiencia: "${niche || 'General'}". Plataforma: ${platform}.`,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      temperature: 0.8,
    },
  });

  const text = response.text || '{}';
  return JSON.parse(text);
}

// Real Image generation using Gemini nano banana model
export async function generateImageWithGemini(prompt: string, aspectRatio: string = "1:1"): Promise<string> {
  const ai = getGeminiClient();
  
  // Valid aspect ratios for nano banana models: "1:1", "3:4", "4:3", "9:16", "16:9"
  const validAspectRatios = ["1:1", "3:4", "4:3", "9:16", "16:9"];
  const finalRatio = validAspectRatios.includes(aspectRatio) ? aspectRatio : "1:1";

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-lite-image',
    contents: {
      parts: [
        { text: prompt },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: finalRatio as any,
      },
    },
  });

  const candidates = response.candidates;
  if (candidates && candidates.length > 0) {
    for (const part of candidates[0].content?.parts || []) {
      if (part.inlineData && part.inlineData.data) {
        const mime = part.inlineData.mimeType || 'image/png';
        return `data:${mime};base64,${part.inlineData.data}`;
      }
    }
  }

  throw new Error("El modelo de imagen no devolvió datos binarios de imagen.");
}
