# Chatbot Docente Inteligente — Seguimiento e Intensificación

Asistente docente y tablero de analítica educativa listo para desplegar **gratis en Netlify desde Git**, con guardado automático en la nube mediante **Firebase Authentication (Google)** y **Cloud Firestore**.

## ✨ Funcionalidades principales
- **Carga de planillas Excel (`.xlsx` / `.xls`) multipestaña y CSV**: detección automática de filas de encabezado, columnas de evaluación `(Examen)` / `(Recu)`, múltiples cursos/colegios y columnas extra (`Observaciones`, `Asistencia`, `Extra: ...`).
- **Carga Directa en pantalla**: creá cursos, unidades y columnas extra directamente desde el navegador, editá notas y guardá sin salir de la app.
- **Regla de acreditación e intensificación**: `>= 6.75` aprueba la unidad (equivale a 7); `<= 6.5` pasa a intensificación.
- **Ordenamiento alfabético por apellido** (`Apellido, Nombre`).
- **Reportes individuales, por lote y generales en PDF A4** (1 hoja por alumno), además de exportación a `.xlsx` y `.md`.
- **Respaldo gratuito en la nube**: inicio de sesión con Google + Firebase Firestore por docente, con respaldo local en navegador cuando no hay sesión iniciada.
- **Asistente analítico con IA (opcional)**: vía Netlify Function (`/api/ai`) usando Gemini si configurás `GEMINI_API_KEY` en las variables de entorno, o Modo Analítico Local automático si no configurás ninguna clave.

---

## 📁 Estructura del proyecto (100% Node / Netlify, sin Python)

```text
├── netlify.toml                  # Configuración automática para Netlify (build + functions + redirects)
├── netlify/functions/api.mjs     # Endpoint serverless (/api/status, /api/firebase-config, /api/ai)
├── lib/gemini-handler.mjs        # Integración opcional con Gemini API (@google/genai)
├── scripts/build.mjs             # Genera dist/ con HTML, motor JS, CSV demo, config Firebase y vendors locales
├── static/
│   ├── index.html                # Interfaz web del docente
│   └── app-engine.js             # Motor de planillas Excel/CSV, métricas, reportes y PDF
├── data/planilla_curso.csv       # Planilla de ejemplo
├── firebase-applet-config.json   # Configuración pública del proyecto Firebase
├── firestore.rules               # Reglas de seguridad de Cloud Firestore
├── start_server.mjs              # Servidor local Node.js (puerto 3000) idéntico a Netlify
└── package.json
```

---

## 🚀 Despliegue gratis en Netlify desde Git

1. Subí este proyecto a un repositorio en **GitHub**, **GitLab** o **Bitbucket**.
2. En **Netlify**, hacé clic en **Add new site → Import an existing project** y seleccioná tu repositorio.
3. Netlify leerá `netlify.toml` automáticamente:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
   - **Functions directory:** `netlify/functions`
4. Hacé clic en **Deploy site**.
5. *(Obligatorio para usar Google Login)* Copiá el dominio que te asignó Netlify (por ejemplo `tu-sitio.netlify.app`), entrá a **Firebase Console → Authentication → Settings → Authorized domains** y agregá ese dominio.
6. *(Opcional para respuestas con Gemini AI)* En **Netlify → Site configuration → Environment variables**, agregá `GEMINI_API_KEY`. Si no la agregás, el asistente funciona igualmente en **Modo Analítico Local**.

---

## 💻 Ejecución local

```bash
npm install
npm run build
npm start
```

Luego abrí `http://localhost:3000`.
