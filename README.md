# Asistente Docente Inteligente — Seguimiento e Intensificación

Proyecto desarrollado por **Micaela Ruggeri** como herramienta de apoyo para el seguimiento académico por unidades, la detección temprana de instancias de intensificación y la generación de informes pedagógicos.

## Enfoque y propósito

La idea detrás de este tablero surge de una necesidad concreta del trabajo docente: consolidar calificaciones por unidad, identificar trayectorias que requieren intensificación y redactar devoluciones claras sin depender de procesos manuales dispersos.

El sistema combina reglas de evaluación definidas para el seguimiento por unidad, visualización de métricas y generación de reportes listos para exportar o imprimir.

## Evolución del proyecto

- **Primera etapa:** prototipo inicial orientado al procesamiento de datos con Python (`FastAPI` y `Pandas`).
- **Etapa actual:** migración a una aplicación web con `Node.js`, `Netlify Functions`, `Firebase` (autenticación y persistencia en Firestore) e integración opcional con `Gemini AI` (con fallback a análisis local cuando no se utiliza API externa).

## Funcionalidades clave

- **Seguimiento por unidades:** carga de planillas (`.xlsx`, `.xls`, `.csv`) y carga/edición directa desde la interfaz, con ordenamiento por apellido y nombre.
- **Detección de intensificación:** cálculo automático según criterios de aprobación e intensificación por unidad.
- **Informes y exportación:** generación de reportes en PDF A4 (individuales, por lote o generales) y exportación a `.xlsx` y `.md`.
- **Respaldo y asistencia analítica:** guardado asociado a cuenta de usuario en la nube o respaldo local en navegador, junto con un asistente de apoyo analítico.

## Autoría y contexto

Desarrollado por **Micaela Ruggeri** como parte de su recorrido en docencia de matemática y ciencia de datos / inteligencia aplicada.
