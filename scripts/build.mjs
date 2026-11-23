import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyFile(srcRel, destRel) {
  const src = path.join(ROOT, srcRel);
  const dest = path.join(DIST, destRel);
  if (!fs.existsSync(src)) {
    throw new Error(`Archivo requerido no encontrado: ${srcRel}`);
  }
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

fs.rmSync(DIST, { recursive: true, force: true });
ensureDir(DIST);

copyFile('static/index.html', 'index.html');
copyFile('static/app-engine.js', 'app-engine.js');
copyFile('data/planilla_curso.csv', 'data/planilla_curso.csv');
copyFile('firebase-applet-config.json', 'firebase-applet-config.json');

// Copiar librerías JS locales para que Excel (.xlsx/.csv) y PDF funcionen offline/sin CDNs frágiles
copyFile('node_modules/xlsx/dist/xlsx.full.min.js', 'vendor/xlsx.full.min.js');
copyFile('node_modules/jspdf/dist/jspdf.umd.min.js', 'vendor/jspdf.umd.min.js');
copyFile('node_modules/jspdf-autotable/dist/jspdf.plugin.autotable.min.js', 'vendor/jspdf.plugin.autotable.min.js');

console.log('[build] Build estático generado en dist/ listo para Netlify y AI Studio.');
