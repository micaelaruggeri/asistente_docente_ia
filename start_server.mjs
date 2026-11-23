import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { generateGeminiText, hasGeminiKey } from './lib/gemini-handler.mjs';
import { authorizeAiRequest } from './lib/ai-auth.mjs';

const PORT = Number(process.env.PORT || 3000);
const ROOT = process.cwd();
const DIST_DIR = path.join(ROOT, 'dist');

// Asegurar build actualizado al iniciar
execFileSync('node', [path.join(ROOT, 'scripts', 'build.mjs')], { stdio: 'inherit' });

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(data));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 5 * 1024 * 1024) {
        reject(new Error('Payload demasiado grande.'));
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('JSON inválido.'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (req.method === 'GET' && pathname === '/api/status') {
    const authz = await authorizeAiRequest(req.headers.authorization);
    return sendJson(res, 200, {
      status: 'ready',
      has_gemini: hasGeminiKey(),
      ai_authorized: authz.ok,
      runtime: 'node',
    });
  }

  if (req.method === 'GET' && pathname === '/api/firebase-config') {
    const cfgPath = path.join(ROOT, 'firebase-applet-config.json');
    if (!fs.existsSync(cfgPath)) {
      return sendJson(res, 404, { detail: 'Configuración de Firebase no encontrada.' });
    }
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    return sendJson(res, 200, cfg);
  }

  if (req.method === 'POST' && pathname === '/api/ai') {
    try {
      const authz = await authorizeAiRequest(req.headers.authorization);
      if (!authz.ok) {
        return sendJson(res, authz.status, {
          ok: false,
          has_gemini: hasGeminiKey(),
          ai_authorized: false,
          detail: authz.error,
        });
      }
      const body = await readJsonBody(req);
      const prompt = String(body?.prompt || '').trim();
      const systemInstruction = String(body?.systemInstruction || '').trim();
      if (!prompt) {
        return sendJson(res, 400, { detail: 'El prompt no puede estar vacío.' });
      }
      if (!hasGeminiKey()) {
        return sendJson(res, 200, { ok: false, has_gemini: false, ai_authorized: true, detail: 'Modo analítico local activo.' });
      }
      const result = await generateGeminiText({ prompt, systemInstruction });
      return sendJson(res, 200, result);
    } catch (err) {
      console.error('[server] Error en /api/ai:', err);
      return sendJson(res, 500, {
        ok: false,
        has_gemini: hasGeminiKey(),
        detail: err?.message || 'Error consultando Gemini AI.',
      });
    }
  }

  // Servir archivos estáticos desde dist/ (idéntico a Netlify publish="dist")
  let relPath = pathname === '/' ? '/index.html' : pathname;
  relPath = path.normalize(relPath).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(DIST_DIR, relPath);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] || 'application/octet-stream';

  if (req.method === 'HEAD') {
    res.writeHead(200, { 'Content-Type': mime });
    res.end();
    return;
  }

  res.writeHead(200, {
    'Content-Type': mime,
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300',
  });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[start_server] Netlify-compatible server running on http://0.0.0.0:${PORT}`);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    server.close(() => process.exit(0));
  });
}
