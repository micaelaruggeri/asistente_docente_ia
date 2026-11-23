import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const ALLOWED_AI_EMAILS = new Set([
  'micaelaruggeri@gmail.com',
  'micaelaruggeri@abc.gob.ar',
]);

const FIREBASE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let cachedCerts = null;
let certsExpiresAt = 0;

export function getFirebaseProjectId() {
  const candidates = [
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
    path.resolve(process.cwd(), 'dist', 'firebase-applet-config.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (cfg && typeof cfg.projectId === 'string' && cfg.projectId.trim()) {
          return cfg.projectId.trim();
        }
      } catch {
        // continuar buscando
      }
    }
  }
  return (process.env.FIREBASE_PROJECT_ID || '').trim() || 'sublime-breaker-zpd8p';
}

async function fetchFirebasePublicCerts(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedCerts && now < certsExpiresAt) {
    return cachedCerts;
  }

  const res = await fetch(FIREBASE_CERTS_URL, { method: 'GET' });
  if (!res.ok) {
    throw new Error(`No se pudieron obtener certificados públicos de Firebase (${res.status}).`);
  }

  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = /max-age=(\d+)/i.exec(cacheControl);
  const maxAgeSec = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;
  cachedCerts = await res.json();
  certsExpiresAt = now + Math.max(60, maxAgeSec) * 1000;
  return cachedCerts;
}

function decodeBase64UrlJson(segment) {
  const raw = Buffer.from(segment, 'base64url').toString('utf8');
  return JSON.parse(raw);
}

export async function verifyFirebaseIdToken(idToken, { projectId = getFirebaseProjectId(), certsOverride = null } = {}) {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Token faltante.');
  }

  const parts = idToken.trim().split('.');
  if (parts.length !== 3) {
    throw new Error('Formato de token inválido.');
  }

  const [headerB64, payloadB64, sigB64] = parts;
  let header;
  let payload;
  try {
    header = decodeBase64UrlJson(headerB64);
    payload = decodeBase64UrlJson(payloadB64);
  } catch {
    throw new Error('Token malformado.');
  }

  if (header?.alg !== 'RS256' || typeof header?.kid !== 'string' || !header.kid) {
    throw new Error('Algoritmo o clave del token no válidos.');
  }

  let certs = certsOverride || (await fetchFirebasePublicCerts(false));
  let cert = certs?.[header.kid];
  if (!cert && !certsOverride) {
    certs = await fetchFirebasePublicCerts(true);
    cert = certs?.[header.kid];
  }
  if (!cert) {
    throw new Error('Clave pública de Firebase no encontrada.');
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();
  const sigValid = verifier.verify(cert, Buffer.from(sigB64, 'base64url'));
  if (!sigValid) {
    throw new Error('Firma del token inválida.');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp <= nowSec) {
    throw new Error('Sesión expirada. Volvé a iniciar sesión.');
  }
  if (typeof payload.iat !== 'number' || payload.iat > nowSec + 300) {
    throw new Error('Token emitido en el futuro.');
  }
  if (typeof payload.auth_time !== 'number' || payload.auth_time > nowSec + 300) {
    throw new Error('Hora de autenticación inválida.');
  }
  if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128) {
    throw new Error('Subject del token inválido.');
  }
  if (payload.aud !== projectId) {
    throw new Error('Audiencia del token inválida.');
  }
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error('Emisor del token inválido.');
  }

  return {
    uid: payload.sub,
    email: String(payload.email || '').trim().toLowerCase(),
    emailVerified: payload.email_verified === true,
  };
}

export function extractBearerToken(authHeader) {
  const raw = String(authHeader || '').trim();
  if (!raw.toLowerCase().startsWith('bearer ')) return null;
  const token = raw.slice(7).trim();
  return token || null;
}

export async function authorizeAiRequest(authHeader, opts = {}) {
  const token = extractBearerToken(authHeader);
  if (!token) {
    return {
      ok: false,
      status: 401,
      error: 'Iniciá sesión con una cuenta autorizada para usar Gemini AI.',
    };
  }

  try {
    const claims = await verifyFirebaseIdToken(token, opts);
    if (!claims.emailVerified || !ALLOWED_AI_EMAILS.has(claims.email)) {
      return {
        ok: false,
        status: 403,
        email: claims.email,
        error: 'Tu cuenta no está autorizada para usar Gemini AI. Podés usar el Modo Analítico Local gratuito.',
      };
    }
    return {
      ok: true,
      status: 200,
      uid: claims.uid,
      email: claims.email,
    };
  } catch (err) {
    return {
      ok: false,
      status: 401,
      error: err?.message || 'Token de sesión inválido.',
    };
  }
}
