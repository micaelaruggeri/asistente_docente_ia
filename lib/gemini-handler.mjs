import { GoogleGenAI } from '@google/genai';

export function hasGeminiKey() {
  return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim());
}

export async function generateGeminiText({ prompt, systemInstruction }) {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    return {
      ok: false,
      has_gemini: false,
      error: 'GEMINI_API_KEY no está configurada en el entorno.',
    };
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: String(prompt || ''),
    config: systemInstruction ? { systemInstruction: String(systemInstruction) } : undefined,
  });

  return {
    ok: true,
    has_gemini: true,
    text: (response.text || '').trim(),
  };
}
