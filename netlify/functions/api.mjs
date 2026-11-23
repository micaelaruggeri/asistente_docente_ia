import fs from 'node:fs';
import path from 'node:path';
import { generateGeminiText, hasGeminiKey } from '../../lib/gemini-handler.mjs';
import { authorizeAiRequest } from '../../lib/ai-auth.mjs';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function loadFirebaseConfig() {
  const candidates = [
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
    path.resolve(process.cwd(), 'dist', 'firebase-applet-config.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  }
  return null;
}

export default async (req) => {
  const url = new URL(req.url);
  const pathname = url.pathname.replace(/\/+$/, '');

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  if (req.method === 'GET' && pathname.endsWith('/status')) {
    const authz = await authorizeAiRequest(req.headers.get('authorization'));
    return jsonResponse({
      status: 'ready',
      has_gemini: hasGeminiKey(),
      ai_authorized: authz.ok,
      runtime: 'netlify',
    });
  }

  if (req.method === 'GET' && pathname.endsWith('/firebase-config')) {
    const cfg = loadFirebaseConfig();
    if (!cfg) {
      return jsonResponse({ detail: 'Configuración de Firebase no encontrada.' }, 404);
    }
    return jsonResponse(cfg);
  }

  if (req.method === 'POST' && pathname.endsWith('/ai')) {
    try {
      const authz = await authorizeAiRequest(req.headers.get('authorization'));
      if (!authz.ok) {
        return jsonResponse(
          { ok: false, has_gemini: hasGeminiKey(), ai_authorized: false, detail: authz.error },
          authz.status
        );
      }

      const body = await req.json();
      const prompt = String(body?.prompt || '').trim();
      const systemInstruction = String(body?.systemInstruction || '').trim();
      if (!prompt) {
        return jsonResponse({ detail: 'El prompt no puede estar vacío.' }, 400);
      }

      if (!hasGeminiKey()) {
        return jsonResponse({ ok: false, has_gemini: false, ai_authorized: true, detail: 'Modo analítico local activo.' }, 200);
      }

      const result = await generateGeminiText({ prompt, systemInstruction });
      return jsonResponse(result, 200);
    } catch (err) {
      console.error('Error en Netlify Gemini Function:', err);
      return jsonResponse(
        { ok: false, has_gemini: hasGeminiKey(), detail: err?.message || 'Error consultando Gemini AI.' },
        500
      );
    }
  }

  return jsonResponse({ detail: 'Endpoint no encontrado.' }, 404);
};
