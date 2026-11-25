// Motor de procesamiento de planillas, reportes y PDF 100% en el navegador (compatible con Netlify)
(function (global) {
  'use strict';

  const PASSING_GRADE = 6.75;
  const LOCAL_STORAGE_KEY = 'docente_local_courses_v1';

  const RE_EXAMEN = /^(.*?)\s*(?:[([\-–—]\s*(?:examen|exam\.?|ex\.?|eval(?:uaci[oó]n)?\.?|parcial|instancia\s*1)\s*[)\]]?|\s+(?:examen|exam\.?|eval(?:uaci[oó]n)?\.?))$/i;
  const RE_RECU = /^(.*?)\s*(?:[([\-–—]\s*(?:recu(?:peratorio|peraci[oó]n|p)?\.?|rec\.?|instancia\s*2)\s*[)\]]?|\s+(?:recu(?:peratorio|peraci[oó]n|p)?\.?|rec\.?))$/i;
  const RE_INTENSIF = /^(.*?)\s*(?:[([\-–—]\s*(?:intensific(?:ada|o|ó|\.)?|intensif\.?|verif(?:icada)?\.?)\s*[)\]]?|\s+(?:intensificada|intensific[oó]|intensif\.?))$/i;
  const RE_PANDAS_DUP = /(?:\.\d+|_\d+)$/;
  const RE_GRADE_NUM = /^(\d+(?:\.\d+)?)(?:\s*\/\s*10|\s*(?:pts?|puntos?|\+|-))?$/i;

  const META_ALIASES = {
    colegio: new Set(['colegio', 'escuela', 'institucion', 'institución', 'establecimiento']),
    curso: new Set(['curso', 'grado', 'division', 'división', 'año', 'anio', 'aula', 'comision', 'comisión']),
    nombre: new Set(['nombre', 'nombres', 'first_name']),
    apellido: new Set(['apellido', 'apellidos', 'last_name']),
    alumno: new Set(['alumno', 'alumna', 'estudiante', 'alumno/a', 'nombre y apellido', 'apellido y nombre']),
  };

  const IGNORED_META_COLS = new Set(['id', 'id_alumno']);
  const EXTRA_TEXT_COLS = new Set([
    'legajo',
    'dni',
    'observaciones',
    'observacion',
    'notas_generales',
    'comentario',
    'comentarios',
    'asistencia',
    'concepto',
    'seguimiento',
  ]);

  const TRAJECTORY_PATTERNS = {
    preliminar1: /^(?:1[°ºer]*\s*(?:informe\s*)?preliminar|(?:informe\s*)?preliminar\s*1)(?:\s*\(.*\))?$/i,
    preliminar2: /^(?:2[°ºdo]*\s*(?:informe\s*)?preliminar|(?:informe\s*)?preliminar\s*2)(?:\s*\(.*\))?$/i,
    cuatrimestre1: /^(?:(?:nota\s*)?1[°ºer]*\s*cuatrimestre|cuatrimestre\s*1|1[°ºer]*\s*cuat\.?)$/i,
    cuatrimestre2: /^(?:(?:nota\s*)?2[°ºdo]*\s*cuatrimestre|cuatrimestre\s*2|2[°ºdo]*\s*cuat\.?)$/i,
    informe1: /^(?:1[°ºer]*\s*informe\s*(?:1[°ºer]*\s*)?(?:cuatrimestr(?:al|e)|bimestr(?:al|e)|cierre)|informe\s*(?:cierre\s*)?1[°ºer]*\s*cuatrimestr(?:al|e)|informe\s*cuatrimestre\s*1)(?:\s*\(.*\))?$/i,
    informe2: /^(?:2[°ºdo]*\s*informe\s*(?:2[°ºdo]*\s*)?(?:cuatrimestr(?:al|e)|bimestr(?:al|e)|cierre)|informe\s*(?:cierre\s*)?2[°ºdo]*\s*cuatrimestr(?:al|e)|informe\s*cuatrimestre\s*2)(?:\s*\(.*\))?$/i,
    notaFinal: /^(?:nota\s*final|calificaci[oó]n\s*final|cierre\s*final|final)$/i,
  };

  const FALLBACK_DEMO_CSV = [
    'colegio,curso,nombre,apellido,Unidad 1 - Números (Examen),Unidad 1 - Números (Recu),Unidad 2 - Ecuaciones (Examen),Unidad 2 - Ecuaciones (Recu),Unidad 3 - Funciones (Examen),Unidad 3 - Funciones (Recu),Unidad 4 - Geometría (Examen),Unidad 4 - Geometría (Recu),1° Informe Preliminar (TEA/TEP/TED),1° Cuatrimestre,1° Informe Cuatrimestre (TEA/TEP/TED),2° Informe Preliminar (TEA/TEP/TED),2° Cuatrimestre,2° Informe Cuatrimestre (TEA/TEP/TED),Nota Final',
    'Instituto San Martín,3° A,Juan,Pérez,8.5,,9.0,,7.5,,8.0,,,,,,,',
    'Instituto San Martín,3° A,María,Gómez,7.0,,5.5,7.5,8.0,,7.0,,,,,,,',
    'Instituto San Martín,3° A,Lucas,Martínez,4.0,5.5,5.0,6.0,7.5,,4.5,5.0,,,,,,,',
    'Instituto San Martín,3° A,Valentina,Rodríguez,9.0,,10.0,,9.5,,9.0,,,,,,,',
    'Instituto San Martín,3° A,Mateo,López,6.0,7.0,4.0,5.0,6.5,,8.0,,,,,,,',
    'Instituto San Martín,3° B,Sofía,Díaz,10.0,,9.5,,9.0,,10.0,,,,,,,',
    'Instituto San Martín,3° B,Benjamín,Fernández,3.5,4.0,4.0,5.5,5.0,6.0,3.0,,,,,,,',
    'Instituto San Martín,3° B,Camila,Sánchez,7.5,,6.0,6.5,8.0,,7.0,,,,,,,',
    'Instituto San Martín,3° B,Tomás,Romero,,7.5,7.0,,5.0,5.5,6.5,6.0,,,,,,,',
    'Escuela Belgrano,4° A,Martina,Álvarez,5.0,4.5,3.0,4.0,4.5,5.0,6.0,6.5,,,,,,,',
    'Escuela Belgrano,4° A,Joaquín,Silva,8.0,,7.5,,8.5,,7.0,,,,,,,',
    'Escuela Belgrano,4° A,Emma,Torres,6.5,8.0,7.0,,5.5,6.0,8.5,,,,,,,',
  ].join('\n');

  function normalizeKey(text) {
    return String(text || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\s\-–—_:]+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function makeSafeId(rawKey, prefix = 'id') {
    const str = String(rawKey || '');
    const asciiOnly = str.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
    const slug = asciiOnly.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 48);
    // Hash FNV-1a estable de 32 bits en hex
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    const digest = (h >>> 0).toString(16).padStart(8, '0');
    const base = slug ? `${prefix}_${slug}_${digest}` : `${prefix}_${digest}`;
    return base.slice(0, 96);
  }

  function toGrade(val) {
    if (val === null || val === undefined || typeof val === 'boolean') return null;
    if (typeof val === 'number') {
      return Number.isFinite(val) ? Math.round(val * 100) / 100 : null;
    }
    const s = String(val).trim().replace(',', '.');
    if (!s || ['nan', 'none', 'null', 'ausente', 'aus', 'aus.', '-', '—', 'n/a', 's/n', 'nc'].includes(s.toLowerCase())) {
      return null;
    }
    const n = Number(s);
    if (Number.isFinite(n)) return Math.round(n * 100) / 100;
    const m = RE_GRADE_NUM.exec(s);
    if (m) {
      const f = Number(m[1]);
      return Number.isFinite(f) ? Math.round(f * 100) / 100 : null;
    }
    return null;
  }

  function toBoolFlag(val) {
    if (val === true || val === 1) return true;
    if (val === false || val === 0 || val === null || val === undefined) return false;
    const s = String(val).trim().toLowerCase();
    return ['si', 'sí', 'true', '1', 'x', 'ok', '✓', '✔', 'intensificada', 'intensifico', 'intensificó', 'aprobada'].includes(s);
  }

  function toBimestralReport(val) {
    if (val === null || val === undefined) return '';
    const s = String(val).trim().toUpperCase();
    if (s === 'TEA' || s === 'TEP' || s === 'TED') return s;
    return '';
  }

  function normalizeTrayectoria(raw) {
    const src = raw || {};
    const preliminar1 = toBimestralReport(src.preliminar1);
    const cuatrimestre1 = toGrade(src.cuatrimestre1);
    const informe1 = toBimestralReport(src.informe1 !== undefined ? src.informe1 : src.bimestre1);
    const preliminar2 = toBimestralReport(src.preliminar2);
    const cuatrimestre2 = toGrade(src.cuatrimestre2);
    const informe2 = toBimestralReport(src.informe2 !== undefined ? src.informe2 : src.bimestre2);
    const canCloseFinal = cuatrimestre1 !== null && cuatrimestre2 !== null && cuatrimestre1 >= 7 && cuatrimestre2 >= 7;
    const suggestedFinal = canCloseFinal
      ? Math.round(((cuatrimestre1 + cuatrimestre2) / 2) * 100) / 100
      : null;

    let notaFinal = null;
    if (canCloseFinal) {
      const explicitFinal = toGrade(src.notaFinal);
      notaFinal = explicitFinal !== null ? explicitFinal : (src.notaFinalCleared ? null : suggestedFinal);
    }

    return {
      preliminar1,
      cuatrimestre1,
      informe1,
      preliminar2,
      cuatrimestre2,
      informe2,
      can_close_final: canCloseFinal,
      suggested_final: suggestedFinal,
      notaFinal,
    };
  }

  function parseCsvTextToMatrix(text) {
    const cleanText = text.replace(/^\uFEFF/, '');
    const firstLine = cleanText.split(/\r?\n/)[0] || '';
    const semiCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const sep = semiCount > commaCount ? ';' : ',';

    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < cleanText.length; i++) {
      const ch = cleanText[i];
      if (inQuotes) {
        if (ch === '"') {
          if (cleanText[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === sep) {
        row.push(field);
        field = '';
      } else if (ch === '\r') {
        if (cleanText[i + 1] === '\n') i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else if (ch === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += ch;
      }
    }
    if (field.length > 0 || row.length > 0) {
      row.push(field);
      rows.push(row);
    }
    return rows.filter((r) => r.some((cell) => String(cell ?? '').trim() !== ''));
  }

  function decodeCsvBuffer(uint8) {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(uint8);
    } catch {
      return new TextDecoder('iso-8859-1').decode(uint8);
    }
  }

  function readSheetsFromFileBuffer(arrayBuffer, filename) {
    const ext = (filename.split('.').pop() || '').toLowerCase();
    const sheetBase = filename.replace(/\.[^.]+$/, '') || 'Planilla';

    if (ext === 'xlsx' || ext === 'xls') {
      if (!global.XLSX) {
        throw new Error('La librería de lectura Excel aún se está cargando.');
      }
      const wb = global.XLSX.read(arrayBuffer, { type: 'array' });
      const result = [];
      for (const sheetName of wb.SheetNames || []) {
        const ws = wb.Sheets[sheetName];
        if (!ws) continue;
        const matrix = global.XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
        const nonEmpty = matrix.filter((r) => Array.isArray(r) && r.some((v) => v !== null && v !== undefined && String(v).trim() !== ''));
        if (nonEmpty.length > 0) {
          result.push({ sheetName: String(sheetName).trim() || sheetBase, matrix: nonEmpty });
        }
      }
      if (result.length === 0) {
        throw new Error('El archivo Excel no contiene hojas con datos.');
      }
      return result;
    }

    const csvText = decodeCsvBuffer(new Uint8Array(arrayBuffer));
    const matrix = parseCsvTextToMatrix(csvText);
    if (matrix.length === 0) {
      throw new Error('El archivo CSV está vacío.');
    }
    return [{ sheetName: sheetBase, matrix }];
  }

  function detectColumns(columns) {
    const metaMap = { colegio: null, curso: null, nombre: null, apellido: null, alumno: null };
    const trayectoriaMap = {
      preliminar1: null,
      cuatrimestre1: null,
      informe1: null,
      preliminar2: null,
      cuatrimestre2: null,
      informe2: null,
      notaFinal: null,
    };
    const unitsMap = {};
    const unitOrder = [];
    const unitNormToKey = {};
    const extraCols = [];

    columns.forEach((rawCol, colIdx) => {
      const col = String(rawCol ?? '').trim();
      const colLower = col.toLowerCase();
      if (!col || colLower.startsWith('unnamed:') || colLower.startsWith('__empty')) return;

      const colClean = col.replace(RE_PANDAS_DUP, '').trim();
      const colCleanNorm = normalizeKey(colClean);

      let matchedMeta = false;
      for (const [key, aliases] of Object.entries(META_ALIASES)) {
        if (aliases.has(colClean.toLowerCase()) || aliases.has(colCleanNorm)) {
          if (metaMap[key] === null) {
            metaMap[key] = { idx: colIdx, header: colClean };
            matchedMeta = true;
            break;
          }
        }
      }
      if (matchedMeta || IGNORED_META_COLS.has(colClean.toLowerCase())) return;

      let matchedTraj = false;
      for (const [tKey, rx] of Object.entries(TRAJECTORY_PATTERNS)) {
        if (rx.test(colClean) || rx.test(colCleanNorm)) {
          if (trayectoriaMap[tKey] === null) {
            trayectoriaMap[tKey] = colIdx;
            matchedTraj = true;
            break;
          }
        }
      }
      if (matchedTraj) return;

      if (EXTRA_TEXT_COLS.has(colCleanNorm) || colClean.toLowerCase().startsWith('extra:')) {
        const label = colClean.toLowerCase().startsWith('extra:') ? colClean.slice(6).trim() : colClean;
        if (label) {
          extraCols.push({ label, idx: colIdx });
        }
        return;
      }

      const mIntensif = RE_INTENSIF.exec(colClean);
      const mRecu = mIntensif ? null : RE_RECU.exec(colClean);
      const mExam = (mIntensif || mRecu) ? null : RE_EXAMEN.exec(colClean);

      let unitName;
      let slot;
      if (mIntensif) {
        unitName = mIntensif[1].replace(/^[\s\-–—:()]+|[\s\-–—:()]+$/g, '');
        slot = 'intensificado';
      } else if (mRecu) {
        unitName = mRecu[1].replace(/^[\s\-–—:()]+|[\s\-–—:()]+$/g, '');
        slot = 'recu';
      } else if (mExam) {
        unitName = mExam[1].replace(/^[\s\-–—:()]+|[\s\-–—:()]+$/g, '');
        slot = 'examen';
      } else {
        unitName = colClean;
        slot = 'examen';
      }

      if (!unitName) unitName = colClean;
      const normName = normalizeKey(unitName);
      let existingKey = unitNormToKey[normName];
      if (!existingKey) {
        existingKey = unitName;
        unitOrder.push(existingKey);
        unitNormToKey[normName] = existingKey;
        unitsMap[existingKey] = { examen: null, recu: null, intensificado: null };
      }

      if (unitsMap[existingKey][slot] === null) {
        unitsMap[existingKey][slot] = colIdx;
      } else if (slot === 'examen' && unitsMap[existingKey].recu === null) {
        unitsMap[existingKey].recu = colIdx;
      }
    });

    const orderedUnits = {};
    unitOrder.forEach((u) => {
      orderedUnits[u] = unitsMap[u];
    });
    return { metaMap, trayectoriaMap, unitsMap: orderedUnits, extraCols };
  }

  function computeStudentRecord({ colegio, curso, nombre, apellido, sheetName, sourceFile, unitNames, rawGrades, rawIntensified = {}, rawTrayectoria = {}, extras }) {
    const unidadesDetalle = [];
    const unidadesIntensificar = [];
    const unidadesPendientesTotales = [];
    const notasVigentes = [];

    unitNames.forEach((uName) => {
      const pair = rawGrades[uName] || [null, null];
      const notaEx = pair[0];
      const notaRc = pair[1];
      const aprobadaPorNota = (notaEx !== null && notaEx >= PASSING_GRADE) || (notaRc !== null && notaRc >= PASSING_GRADE);
      const intensificado = aprobadaPorNota ? false : Boolean(rawIntensified[uName]);

      let uEstado;
      let motivo;
      let notaFinal;
      let requiereIntensificacion = false;

      if (notaEx !== null && notaEx >= PASSING_GRADE) {
        uEstado = 'Aprobada';
        motivo = notaEx < 7.0 ? `Aprobada en examen (${notaEx} equivale a 7)` : 'Aprobada en examen';
        notaFinal = notaEx;
      } else if (notaRc !== null && notaRc >= PASSING_GRADE) {
        uEstado = 'Aprobada (Recu)';
        motivo = notaRc < 7.0 ? `Aprobada en recuperatorio (${notaRc} equivale a 7)` : 'Aprobada en recuperatorio';
        notaFinal = notaRc;
      } else {
        requiereIntensificacion = true;
        if (notaEx === null && notaRc === null) {
          motivo = 'Sin calificaciones registradas (ausente en examen y recuperatorio)';
          notaFinal = null;
        } else if (notaRc === null) {
          motivo = `Examen desaprobado (${notaEx} < 6.75) y sin recuperatorio aprobado`;
          notaFinal = notaEx;
        } else {
          const exTxt = notaEx !== null ? String(notaEx) : 'Ausente';
          motivo = `Examen (${exTxt}) y Recuperatorio (${notaRc}) menores a 6.75`;
          notaFinal = notaEx !== null ? Math.max(notaEx, notaRc) : notaRc;
        }

        if (intensificado) {
          uEstado = 'Intensificada';
          motivo = `${motivo} — Ya intensificada (verificada)`;
        } else {
          uEstado = 'Intensifica';
        }
      }

      if (notaFinal !== null) notasVigentes.push(notaFinal);

      const unitInfo = {
        unidad: uName,
        examen: notaEx,
        recu: notaRc,
        nota_final: notaFinal,
        estado: uEstado,
        requiere_intensificacion: requiereIntensificacion,
        intensificado,
        intensifica: uEstado === 'Intensifica',
        motivo,
      };
      unidadesDetalle.push(unitInfo);
      if (unitInfo.intensifica) unidadesIntensificar.push(unitInfo);
      if (unitInfo.requiere_intensificacion) unidadesPendientesTotales.push(unitInfo);
    });

    const promedio = notasVigentes.length
      ? Math.round((notasVigentes.reduce((a, b) => a + b, 0) / notasVigentes.length) * 100) / 100
      : 0.0;
    const cantIntensificar = unidadesIntensificar.length;
    const cantPendientesTotales = unidadesPendientesTotales.length;
    const cantIntensificadas = cantPendientesTotales - cantIntensificar;
    const totalUnidades = unitNames.length;

    let estado;
    let nivelRiesgo;
    let motivosRiesgo;
    if (cantIntensificar === 0) {
      estado = cantIntensificadas > 0 ? 'Acreditado (Intensif.)' : 'Aprobado';
      nivelRiesgo = 'Bajo';
      motivosRiesgo = cantIntensificadas > 0
        ? `Completó la intensificación de ${cantIntensificadas} unidad(es)`
        : 'Todas las unidades aprobadas (>= 6.75 / equivale a 7)';
    } else {
      estado = 'Intensifica';
      const ratio = totalUnidades > 0 ? cantIntensificar / totalUnidades : 1.0;
      nivelRiesgo = cantIntensificar >= 3 || ratio >= 0.5 ? 'Alto' : 'Medio';
      const nombresInt = unidadesIntensificar.map((u) => u.unidad).join(', ');
      motivosRiesgo = `Debe intensificar ${cantIntensificar} unidad(es): ${nombresInt}`;
    }

    const trayectoria = normalizeTrayectoria(rawTrayectoria);

    return {
      id_alumno: 0,
      colegio: colegio || 'Sin especificar',
      curso: curso || 'Sin curso',
      hoja: sheetName || curso || 'Planilla',
      archivo_origen: sourceFile,
      nombre,
      apellido,
      nombre_completo: `${nombre} ${apellido}`.trim(),
      unidades: unidadesDetalle,
      unidades_nombres: [...unitNames],
      unidades_intensificar: unidadesIntensificar,
      unidades_pendientes_totales: unidadesPendientesTotales,
      cant_intensificar: cantIntensificar,
      cant_intensificadas: cantIntensificadas,
      cant_pendientes_totales: cantPendientesTotales,
      cant_aprobadas: totalUnidades - cantIntensificar,
      total_unidades: totalUnidades,
      promedio,
      estado,
      en_riesgo: cantIntensificar > 0,
      nivel_riesgo: nivelRiesgo,
      motivos_riesgo: motivosRiesgo,
      trayectoria,
      extras: { ...(extras || {}) },
    };
  }

  function parseSingleSheetMatrix(matrix, sheetName, sourceFile) {
    if (!matrix || matrix.length < 2) {
      return { students: [], error: `La hoja '${sheetName}' está vacía o no tiene filas de datos.` };
    }

    let headerRowIdx = 0;
    let headerCols = matrix[0].map((v, i) => (v !== null && v !== undefined && String(v).trim() !== '' ? String(v).trim() : `Unnamed: ${i}`));
    let detected = detectColumns(headerCols);

    const hasNameAndUnits = (det) =>
      ((det.metaMap.nombre && det.metaMap.apellido) || det.metaMap.alumno) && Object.keys(det.unitsMap).length > 0;

    if (!((detected.metaMap.nombre && detected.metaMap.apellido) || detected.metaMap.alumno)) {
      const limit = Math.min(5, matrix.length - 1);
      for (let hIdx = 1; hIdx <= limit; hIdx++) {
        const candCols = matrix[hIdx].map((v, i) => (v !== null && v !== undefined && String(v).trim() !== '' ? String(v).trim() : `Unnamed: ${i}`));
        const cand = detectColumns(candCols);
        if (hasNameAndUnits(cand)) {
          headerRowIdx = hIdx;
          headerCols = candCols;
          detected = cand;
          break;
        }
      }
    }

    const { metaMap, trayectoriaMap, extraCols } = detected;
    let { unitsMap } = detected;

    const hasNameCols = (metaMap.nombre !== null && metaMap.apellido !== null) || metaMap.alumno !== null;
    if (!hasNameCols) {
      return {
        students: [],
        error: `La hoja '${sheetName}' debe incluir las columnas 'nombre' y 'apellido' (o una columna 'alumno').`,
      };
    }
    if (Object.keys(unitsMap).length === 0) {
      return {
        students: [],
        error: `No se detectaron columnas de evaluaciones en '${sheetName}'. Usá columnas como 'Unidad 1 (Examen)' y 'Unidad 1 (Recu)'.`,
      };
    }

    const dataRows = matrix.slice(headerRowIdx + 1);
    const activeUnitsMap = {};
    for (const [uName, cols] of Object.entries(unitsMap)) {
      let hasAnyGrade = false;
      for (const r of dataRows) {
        if (cols.examen !== null && toGrade(r[cols.examen]) !== null) {
          hasAnyGrade = true;
          break;
        }
        if (cols.recu !== null && toGrade(r[cols.recu]) !== null) {
          hasAnyGrade = true;
          break;
        }
      }
      if (hasAnyGrade) activeUnitsMap[uName] = cols;
    }

    if (Object.keys(activeUnitsMap).length === 0) {
      return {
        students: [],
        error: `Las columnas de evaluaciones en '${sheetName}' no tienen ninguna nota numérica cargada.`,
      };
    }

    unitsMap = activeUnitsMap;
    const unitNames = Object.keys(unitsMap);
    const parsedStudents = [];

    for (const row of dataRows) {
      let nombre = '';
      let apellido = '';

      if (metaMap.nombre !== null && metaMap.apellido !== null) {
        nombre = row[metaMap.nombre.idx] != null ? String(row[metaMap.nombre.idx]).trim() : '';
        apellido = row[metaMap.apellido.idx] != null ? String(row[metaMap.apellido.idx]).trim() : '';
      } else {
        const full = row[metaMap.alumno.idx] != null ? String(row[metaMap.alumno.idx]).trim() : '';
        if (full.includes(',')) {
          const idxComma = full.indexOf(',');
          apellido = full.slice(0, idxComma).trim();
          nombre = full.slice(idxComma + 1).trim();
        } else if (full) {
          const parts = full.split(/\s+/);
          const colHeaderNorm = normalizeKey(metaMap.alumno.header);
          if (colHeaderNorm.includes('apellido') && colHeaderNorm.indexOf('apellido') < colHeaderNorm.indexOf('nombre')) {
            apellido = parts[0] || '';
            nombre = parts.slice(1).join(' ');
          } else {
            nombre = parts[0] || '';
            apellido = parts.slice(1).join(' ');
          }
        }
      }

      if (!nombre && !apellido) continue;

      const colegio =
        metaMap.colegio && row[metaMap.colegio.idx] != null && String(row[metaMap.colegio.idx]).trim() !== ''
          ? String(row[metaMap.colegio.idx]).trim()
          : 'Sin especificar';
      const curso =
        metaMap.curso && row[metaMap.curso.idx] != null && String(row[metaMap.curso.idx]).trim() !== ''
          ? String(row[metaMap.curso.idx]).trim()
          : sheetName || 'Sin curso';

      const rawGrades = {};
      const rawIntensified = {};
      unitNames.forEach((uName) => {
        const cEx = unitsMap[uName].examen;
        const cRc = unitsMap[uName].recu;
        const cIn = unitsMap[uName].intensificado;
        rawGrades[uName] = [cEx !== null ? toGrade(row[cEx]) : null, cRc !== null ? toGrade(row[cRc]) : null];
        rawIntensified[uName] = cIn !== null && cIn !== undefined ? toBoolFlag(row[cIn]) : false;
      });

      const extras = {};
      extraCols.forEach(({ label, idx }) => {
        extras[label] = row[idx] != null ? String(row[idx]).trim() : '';
      });

      const rawTrayectoria = {
        preliminar1: trayectoriaMap.preliminar1 !== null ? row[trayectoriaMap.preliminar1] : '',
        cuatrimestre1: trayectoriaMap.cuatrimestre1 !== null ? row[trayectoriaMap.cuatrimestre1] : null,
        informe1: trayectoriaMap.informe1 !== null ? row[trayectoriaMap.informe1] : '',
        preliminar2: trayectoriaMap.preliminar2 !== null ? row[trayectoriaMap.preliminar2] : '',
        cuatrimestre2: trayectoriaMap.cuatrimestre2 !== null ? row[trayectoriaMap.cuatrimestre2] : null,
        informe2: trayectoriaMap.informe2 !== null ? row[trayectoriaMap.informe2] : '',
        notaFinal: trayectoriaMap.notaFinal !== null ? row[trayectoriaMap.notaFinal] : null,
      };

      parsedStudents.push(
        computeStudentRecord({
          colegio,
          curso,
          nombre,
          apellido,
          sheetName,
          sourceFile,
          unitNames,
          rawGrades,
          rawIntensified,
          rawTrayectoria,
          extras,
        })
      );
    }

    if (parsedStudents.length === 0) {
      return { students: [], error: `No se encontraron alumnos válidos en '${sheetName}'.` };
    }
    return { students: parsedStudents, error: null };
  }

  class DocenteEngine {
    constructor() {
      this.students = [];
      this.units = [];
      this.extraColumns = [];
      this.colegios = [];
      this.cursos = [];
      this.loadedSources = [];
      this.isDemo = true;
      this.sourceFilename = 'planilla_curso.csv';
    }

    rebuildIndices() {
      this.students.forEach((s, i) => {
        s.id_alumno = i + 1;
      });
      const seenUnits = [];
      const seenExtras = [];
      const colSet = new Set();
      const curSet = new Set();

      this.students.forEach((s) => {
        colSet.add(s.colegio);
        curSet.add(s.curso);
        (s.unidades || []).forEach((u) => {
          if (!seenUnits.includes(u.unidad)) seenUnits.push(u.unidad);
        });
        Object.keys(s.extras || {}).forEach((k) => {
          if (!seenExtras.includes(k)) seenExtras.push(k);
        });
      });

      this.units = seenUnits;
      this.extraColumns = seenExtras;
      this.colegios = Array.from(colSet).sort((a, b) => a.localeCompare(b, 'es'));
      this.cursos = Array.from(curSet).sort((a, b) => a.localeCompare(b, 'es'));
    }

    saveLocalSnapshot() {
      try {
        if (this.isDemo) return;
        const courses = this.exportCoursesSnapshot(false);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ courses, sourceFilename: this.sourceFilename }));
      } catch {
        // Ignorar si el almacenamiento local está lleno/bloqueado
      }
    }

    loadLocalSnapshot() {
      try {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.courses) || parsed.courses.length === 0) return false;
        const ok = this.syncFromCoursesSnapshot(parsed.courses, parsed.sourceFilename || 'Sesión guardada local');
        return ok;
      } catch {
        return false;
      }
    }

    clearLocalSnapshot() {
      try {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      } catch {}
    }

    async loadDemoData(clearLocal = false) {
      if (clearLocal) this.clearLocalSnapshot();
      let csvText = FALLBACK_DEMO_CSV;
      try {
        const resp = await fetch('/data/planilla_curso.csv', { cache: 'no-cache' });
        if (resp.ok) {
          const txt = await resp.text();
          if (txt && txt.includes(',')) csvText = txt;
        }
      } catch {}

      const matrix = parseCsvTextToMatrix(csvText);
      const { students } = parseSingleSheetMatrix(matrix, 'Planilla Demo', 'planilla_curso.csv');
      this.students = students;
      this.loadedSources = ['planilla_curso.csv'];
      this.isDemo = true;
      this.sourceFilename = 'planilla_curso.csv';
      this.rebuildIndices();
      return true;
    }

    async updateFromFiles(fileList, mode = 'replace') {
      const newStudents = [];
      let sheetsCount = 0;
      const filenames = [];

      for (const file of fileList) {
        const buf = await file.arrayBuffer();
        const sheets = readSheetsFromFileBuffer(buf, file.name);
        filenames.push(file.name);
        const fileStudents = [];
        const sheetErrors = [];

        for (const { sheetName, matrix } of sheets) {
          const { students, error } = parseSingleSheetMatrix(matrix, sheetName, file.name);
          if (error) {
            sheetErrors.push(error);
            continue;
          }
          fileStudents.push(...students);
          sheetsCount++;
        }

        if (fileStudents.length === 0) {
          const firstErr = sheetErrors[0] || 'No se encontraron datos válidos.';
          return { ok: false, error: `[${file.name}] ${firstErr}` };
        }
        newStudents.push(...fileStudents);
      }

      if (newStudents.length === 0) {
        return { ok: false, error: 'No se encontraron alumnos en los archivos cargados.' };
      }

      if (mode === 'append' && this.students.length > 0 && !this.isDemo) {
        const incomingKeys = new Set(newStudents.map((s) => `${s.colegio.toLowerCase()}|${s.curso.toLowerCase()}`));
        const kept = this.students.filter((s) => !incomingKeys.has(`${s.colegio.toLowerCase()}|${s.curso.toLowerCase()}`));
        this.students = [...kept, ...newStudents];
        filenames.forEach((fn) => {
          if (!this.loadedSources.includes(fn)) this.loadedSources.push(fn);
        });
      } else {
        this.students = newStudents;
        this.loadedSources = filenames;
      }

      this.isDemo = false;
      this.sourceFilename = this.loadedSources.length === 1 ? this.loadedSources[0] : `${this.loadedSources.length} planillas`;
      this.rebuildIndices();
      this.saveLocalSnapshot();

      const stats = this.getSummaryStats();
      const actionTxt = mode === 'append' ? 'agregada/actualizada' : 'cargada';
      return {
        ok: true,
        message: `Planilla ${actionTxt} (${sheetsCount} hoja(s)): ${stats.total_alumnos} alumnos en ${stats.cursos.length} curso(s).`,
        stats,
        courses_snapshot: this.exportCoursesSnapshot(false),
      };
    }

    updateFromDirectData({ rows, units, extraColumns, mode = 'replace' }) {
      const cleanUnits = [];
      (units || []).forEach((u) => {
        const s = String(u || '').trim();
        if (s && !cleanUnits.includes(s)) cleanUnits.push(s);
      });
      if (cleanUnits.length === 0) {
        return { ok: false, error: 'Agregá al menos una unidad o columna de evaluación antes de guardar.' };
      }

      const cleanExtras = [];
      (extraColumns || []).forEach((ex) => {
        const s = String(ex || '').trim();
        if (s && !cleanExtras.includes(s)) cleanExtras.push(s);
      });

      const newStudents = [];
      (rows || []).forEach((r) => {
        const nombre = String(r.nombre || '').trim();
        const apellido = String(r.apellido || '').trim();
        if (!nombre && !apellido) return;

        const colegio = String(r.colegio || '').trim() || 'Sin especificar';
        const curso = String(r.curso || '').trim() || 'Sin curso';
        const gradesIn = r.grades || {};
        const extrasIn = r.extras || {};

        const rawGrades = {};
        const rawIntensified = {};
        cleanUnits.forEach((uName) => {
          const slot = gradesIn[uName] || {};
          rawGrades[uName] = [toGrade(slot.examen), toGrade(slot.recu)];
          rawIntensified[uName] = Boolean(slot.intensificado);
        });

        const extrasDict = {};
        cleanExtras.forEach((exName) => {
          const v = extrasIn[exName];
          extrasDict[exName] = v !== null && v !== undefined ? String(v).trim() : '';
        });

        newStudents.push(
          computeStudentRecord({
            colegio,
            curso,
            nombre,
            apellido,
            sheetName: curso,
            sourceFile: 'Carga directa en pantalla',
            unitNames: cleanUnits,
            rawGrades,
            rawIntensified,
            rawTrayectoria: r.trayectoria || {},
            extras: extrasDict,
          })
        );
      });

      if (newStudents.length === 0) {
        return { ok: false, error: 'Ingresá al menos un alumno con nombre o apellido.' };
      }

      if (mode === 'append' && this.students.length > 0 && !this.isDemo) {
        const incomingKeys = new Set(newStudents.map((s) => `${s.colegio.toLowerCase()}|${s.curso.toLowerCase()}`));
        const kept = this.students.filter((s) => !incomingKeys.has(`${s.colegio.toLowerCase()}|${s.curso.toLowerCase()}`));
        this.students = [...kept, ...newStudents];
        if (!this.loadedSources.includes('Carga directa')) this.loadedSources.push('Carga directa');
      } else {
        this.students = newStudents;
        this.loadedSources = ['Carga directa'];
      }

      this.isDemo = false;
      this.sourceFilename = this.loadedSources.length === 1 ? this.loadedSources[0] : `${this.loadedSources.length} fuentes`;
      this.rebuildIndices();
      this.saveLocalSnapshot();

      const stats = this.getSummaryStats();
      const actionTxt = mode === 'append' ? 'actualizados/agregados' : 'guardados';
      return {
        ok: true,
        message: `Datos ${actionTxt} en pantalla: ${stats.total_alumnos} alumnos en ${stats.cursos.length} curso(s).`,
        stats,
        courses_snapshot: this.exportCoursesSnapshot(false),
      };
    }

    filterStudents(colegio = null, curso = null) {
      let res = this.students;
      if (colegio && colegio !== 'Todos') res = res.filter((s) => s.colegio === colegio);
      if (curso && curso !== 'Todos') res = res.filter((s) => s.curso === curso);
      return res;
    }

    unitsForStudents(studentsList) {
      const seen = [];
      const schemas = new Set();
      studentsList.forEach((s) => {
        const uNames = (s.unidades || []).map((u) => u.unidad);
        schemas.add(uNames.join('||'));
        uNames.forEach((u) => {
          if (!seen.includes(u)) seen.push(u);
        });
      });
      return { units: seen, uniform: schemas.size <= 1 };
    }

    getSummaryStats(colegio = null, curso = null) {
      const filtered = this.filterStudents(colegio, curso);
      const { units: viewUnits, uniform: uniformSchema } = this.unitsForStudents(filtered);

      if (filtered.length === 0) {
        return {
          total_alumnos: 0,
          promedio_general: 0.0,
          tasa_aprobacion: 0.0,
          alumnos_aprobados: 0,
          alumnos_en_riesgo: 0,
          total_unidades: 0,
          unidades: [],
          uniform_units: true,
          colegios: this.colegios,
          cursos: this.cursos,
          mejor_alumno: null,
          intensificacion_por_unidad: [],
          is_demo: this.isDemo,
          source_filename: this.sourceFilename,
        };
      }

      const total = filtered.length;
      const aprobados = filtered.filter((s) => !s.en_riesgo).length;
      const intensifican = total - aprobados;
      const promedioGeneral = Math.round((filtered.reduce((acc, s) => acc + s.promedio, 0) / total) * 100) / 100;
      const tasaAprobacion = Math.round((aprobados / total) * 1000) / 10;

      const mejor = filtered.reduce((best, cur) => {
        const bestRatio = best.cant_aprobadas / Math.max(best.total_unidades, 1);
        const curRatio = cur.cant_aprobadas / Math.max(cur.total_unidades, 1);
        if (curRatio > bestRatio) return cur;
        if (curRatio === bestRatio && cur.promedio > best.promedio) return cur;
        return best;
      }, filtered[0]);

      const intensificacionPorUnidad = viewUnits.map((uName) => {
        const enrolled = [];
        filtered.forEach((s) => {
          const found = (s.unidades || []).find((u) => u.unidad === uName);
          if (found) enrolled.push(found);
        });
        const countInt = enrolled.filter((u) => u.intensifica).length;
        return {
          unidad: uName,
          cantidad_intensifican: countInt,
          cantidad_aprobados: enrolled.length - countInt,
        };
      });

      return {
        total_alumnos: total,
        promedio_general: promedioGeneral,
        tasa_aprobacion: tasaAprobacion,
        alumnos_aprobados: aprobados,
        alumnos_en_riesgo: intensifican,
        total_unidades: viewUnits.length,
        unidades: viewUnits,
        uniform_units: uniformSchema,
        colegios: this.colegios,
        cursos: this.cursos,
        mejor_alumno: {
          nombre: mejor.nombre_completo,
          promedio: mejor.promedio,
          curso: mejor.curso,
          colegio: mejor.colegio,
          id_alumno: mejor.id_alumno,
        },
        intensificacion_por_unidad: intensificacionPorUnidad,
        is_demo: this.isDemo,
        source_filename: this.sourceFilename,
      };
    }

    getStudentsList(colegio = null, curso = null) {
      const filtered = this.filterStudents(colegio, curso);
      return [...filtered].sort((a, b) => {
        const cmpAp = normalizeKey(a.apellido).localeCompare(normalizeKey(b.apellido));
        if (cmpAp !== 0) return cmpAp;
        const cmpNo = normalizeKey(a.nombre).localeCompare(normalizeKey(b.nombre));
        if (cmpNo !== 0) return cmpNo;
        const cmpCo = normalizeKey(a.colegio).localeCompare(normalizeKey(b.colegio));
        if (cmpCo !== 0) return cmpCo;
        return normalizeKey(a.curso).localeCompare(normalizeKey(b.curso));
      });
    }

    getAtRiskStudents(colegio = null, curso = null) {
      return this.getStudentsList(colegio, curso)
        .filter((s) => s.en_riesgo)
        .sort((a, b) => {
          if (b.cant_intensificar !== a.cant_intensificar) return b.cant_intensificar - a.cant_intensificar;
          const cmpAp = normalizeKey(a.apellido).localeCompare(normalizeKey(b.apellido));
          if (cmpAp !== 0) return cmpAp;
          return normalizeKey(a.nombre).localeCompare(normalizeKey(b.nombre));
        });
    }

    getStudentById(id) {
      const numId = Number(id);
      return this.students.find((s) => s.id_alumno === numId) || null;
    }

    toggleUnitIntensified(studentId, unitName, checked) {
      const numId = Number(studentId);
      const idx = this.students.findIndex((s) => s.id_alumno === numId);
      if (idx === -1) return { ok: false, error: 'Alumno no encontrado.' };

      const cur = this.students[idx];
      const rawGrades = {};
      const rawIntensified = {};
      (cur.unidades || []).forEach((u) => {
        rawGrades[u.unidad] = [u.examen, u.recu];
        rawIntensified[u.unidad] = u.unidad === unitName ? Boolean(checked) : Boolean(u.intensificado);
      });

      const updated = computeStudentRecord({
        colegio: cur.colegio,
        curso: cur.curso,
        nombre: cur.nombre,
        apellido: cur.apellido,
        sheetName: cur.hoja,
        sourceFile: cur.archivo_origen,
        unitNames: cur.unidades_nombres || (cur.unidades || []).map((u) => u.unidad),
        rawGrades,
        rawIntensified,
        rawTrayectoria: cur.trayectoria || {},
        extras: cur.extras,
      });
      updated.id_alumno = cur.id_alumno;
      this.students[idx] = updated;
      this.saveLocalSnapshot();

      const snapshotCourses = this.exportCoursesSnapshot(false);
      const targetCourseId = makeSafeId(`${updated.colegio.toLowerCase()}|${updated.curso.toLowerCase()}`, 'c');
      const targetCourse = snapshotCourses.find((c) => c.course_id === targetCourseId) || null;
      const targetRow = targetCourse
        ? targetCourse.rows.find(
            (r) =>
              normalizeKey(r.nombre) === normalizeKey(updated.nombre) &&
              normalizeKey(r.apellido) === normalizeKey(updated.apellido)
          ) || null
        : null;

      return {
        ok: true,
        student: updated,
        courseSnapshot: targetCourse,
        studentRow: targetRow,
        courses_snapshot: snapshotCourses,
      };
    }

    updateStudentTrayectoria(studentId, patch) {
      const numId = Number(studentId);
      const idx = this.students.findIndex((s) => s.id_alumno === numId);
      if (idx === -1) return { ok: false, error: 'Alumno no encontrado.' };

      const cur = this.students[idx];
      const rawGrades = {};
      const rawIntensified = {};
      (cur.unidades || []).forEach((u) => {
        rawGrades[u.unidad] = [u.examen, u.recu];
        rawIntensified[u.unidad] = Boolean(u.intensificado);
      });

      const curTr = cur.trayectoria || {};
      const incomingPatch = patch || {};
      const mergedTrayectoria = {
        ...curTr,
        ...incomingPatch,
      };

      const touchedCuat = Object.prototype.hasOwnProperty.call(incomingPatch, 'cuatrimestre1') ||
        Object.prototype.hasOwnProperty.call(incomingPatch, 'cuatrimestre2');
      if (touchedCuat && !Object.prototype.hasOwnProperty.call(incomingPatch, 'notaFinal')) {
        mergedTrayectoria.notaFinalCleared = false;
        const wasSuggestedOrEmpty = curTr.notaFinal === null || curTr.notaFinal === undefined ||
          (curTr.suggested_final !== null && curTr.notaFinal === curTr.suggested_final);
        if (wasSuggestedOrEmpty) {
          mergedTrayectoria.notaFinal = null;
        }
      }
      if (Object.prototype.hasOwnProperty.call(incomingPatch, 'notaFinal')) {
        mergedTrayectoria.notaFinalCleared = toGrade(incomingPatch.notaFinal) === null;
      }

      const updated = computeStudentRecord({
        colegio: cur.colegio,
        curso: cur.curso,
        nombre: cur.nombre,
        apellido: cur.apellido,
        sheetName: cur.hoja,
        sourceFile: cur.archivo_origen,
        unitNames: cur.unidades_nombres || (cur.unidades || []).map((u) => u.unidad),
        rawGrades,
        rawIntensified,
        rawTrayectoria: mergedTrayectoria,
        extras: cur.extras,
      });
      updated.id_alumno = cur.id_alumno;
      this.students[idx] = updated;
      this.saveLocalSnapshot();

      const snapshotCourses = this.exportCoursesSnapshot(false);
      const targetCourseId = makeSafeId(`${updated.colegio.toLowerCase()}|${updated.curso.toLowerCase()}`, 'c');
      const targetCourse = snapshotCourses.find((c) => c.course_id === targetCourseId) || null;
      const targetRow = targetCourse
        ? targetCourse.rows.find(
            (r) =>
              normalizeKey(r.nombre) === normalizeKey(updated.nombre) &&
              normalizeKey(r.apellido) === normalizeKey(updated.apellido)
          ) || null
        : null;

      return {
        ok: true,
        student: updated,
        courseSnapshot: targetCourse,
        studentRow: targetRow,
        courses_snapshot: snapshotCourses,
      };
    }

    getExtraColumnsForStudents(studentsList) {
      const cols = [];
      studentsList.forEach((s) => {
        Object.keys(s.extras || {}).forEach((k) => {
          if (!cols.includes(k)) cols.push(k);
        });
      });
      return cols;
    }

    exportCoursesSnapshot(includeDemo = false) {
      if (this.students.length === 0 || (this.isDemo && !includeDemo)) return [];
      const grouped = new Map();
      this.students.forEach((s) => {
        const col = String(s.colegio || 'Sin especificar').trim() || 'Sin especificar';
        const cur = String(s.curso || 'Sin curso').trim() || 'Sin curso';
        const key = `${col}|||${cur}`;
        if (!grouped.has(key)) grouped.set(key, { colegio: col, curso: cur, students: [] });
        grouped.get(key).students.push(s);
      });

      const out = [];
      for (const { colegio, curso, students } of grouped.values()) {
        const courseId = makeSafeId(`${colegio.toLowerCase()}|${curso.toLowerCase()}`, 'c');
        const grpUnits = [];
        const grpExtras = [];
        students.forEach((s) => {
          (s.unidades || []).forEach((u) => {
            const uName = String(u.unidad || '').trim();
            if (uName && !grpUnits.includes(uName)) grpUnits.push(uName);
          });
          Object.keys(s.extras || {}).forEach((k) => {
            const ex = String(k || '').trim();
            if (ex && !grpExtras.includes(ex)) grpExtras.push(ex);
          });
        });
        if (grpUnits.length === 0) grpUnits.push('Unidad 1');

        const usedStudentIds = {};
        const rows = students.map((s) => {
          const nombre = String(s.nombre || '').trim();
          const apellido = String(s.apellido || '').trim();
          const baseSid = makeSafeId(`${courseId}|${apellido.toLowerCase()}|${nombre.toLowerCase()}`, 's');
          const dupIdx = usedStudentIds[baseSid] || 0;
          usedStudentIds[baseSid] = dupIdx + 1;
          const studentId = dupIdx === 0 ? baseSid : `${baseSid}_${dupIdx + 1}`;

          const grades = {};
          (s.unidades || []).forEach((u) => {
            grades[u.unidad] = {
              examen: u.examen ?? null,
              recu: u.recu ?? null,
              intensificado: Boolean(u.intensificado),
            };
          });

          const extras = {};
          grpExtras.forEach((exName) => {
            const v = s.extras && s.extras[exName] !== undefined ? s.extras[exName] : '';
            extras[exName] = v !== null && v !== undefined ? String(v) : '';
          });

          const tr = normalizeTrayectoria(s.trayectoria);

          return {
            student_id: studentId,
            colegio,
            curso,
            nombre,
            apellido,
            grades,
            extras,
            trayectoria: {
              preliminar1: tr.preliminar1,
              cuatrimestre1: tr.cuatrimestre1,
              informe1: tr.informe1,
              preliminar2: tr.preliminar2,
              cuatrimestre2: tr.cuatrimestre2,
              informe2: tr.informe2,
              notaFinal: tr.notaFinal,
            },
          };
        });

        out.push({
          course_id: courseId,
          colegio,
          curso,
          units: grpUnits,
          extra_columns: grpExtras,
          rows,
        });
      }
      return out;
    }

    syncFromCoursesSnapshot(courses, sourceLabel = 'Guardado en la nube') {
      const rebuilt = [];
      (courses || []).forEach((c) => {
        const colegio = String(c.colegio || '').trim() || 'Sin especificar';
        const curso = String(c.curso || '').trim() || 'Sin curso';
        const cleanUnits = [];
        (c.units || []).forEach((u) => {
          const s = String(u || '').trim();
          if (s && !cleanUnits.includes(s)) cleanUnits.push(s);
        });
        if (cleanUnits.length === 0) cleanUnits.push('Unidad 1');

        const rawExtras = c.extra_columns || c.extraColumns || [];
        const cleanExtras = [];
        rawExtras.forEach((ex) => {
          const s = String(ex || '').trim();
          if (s && !cleanExtras.includes(s)) cleanExtras.push(s);
        });

        const rows = c.rows || c.students || [];
        rows.forEach((r) => {
          const nombre = String(r.nombre || '').trim();
          const apellido = String(r.apellido || '').trim();
          if (!nombre && !apellido) return;
          const rCol = String(r.colegio || colegio).trim() || colegio;
          const rCur = String(r.curso || curso).trim() || curso;
          const gradesIn = r.grades || {};
          const extrasIn = r.extras || {};

          const rawGrades = {};
          const rawIntensified = {};
          cleanUnits.forEach((uName) => {
            const slot = gradesIn[uName] || {};
            rawGrades[uName] = [toGrade(slot.examen), toGrade(slot.recu)];
            rawIntensified[uName] = Boolean(slot.intensificado);
          });

          const extrasDict = {};
          cleanExtras.forEach((exName) => {
            const v = extrasIn[exName];
            extrasDict[exName] = v !== null && v !== undefined ? String(v).trim() : '';
          });

          rebuilt.push(
            computeStudentRecord({
              colegio: rCol,
              curso: rCur,
              nombre,
              apellido,
              sheetName: rCur,
              sourceFile: sourceLabel,
              unitNames: cleanUnits,
              rawGrades,
              rawIntensified,
              rawTrayectoria: r.trayectoria || {},
              extras: extrasDict,
            })
          );
        });
      });

      if (rebuilt.length === 0) return false;
      this.students = rebuilt;
      this.isDemo = false;
      this.loadedSources = [sourceLabel];
      this.sourceFilename = sourceLabel;
      this.rebuildIndices();
      return true;
    }

    buildStudentIntensificationMarkdown(student) {
      const tr = normalizeTrayectoria(student.trayectoria);
      const p1Txt = tr.preliminar1 || 'Sin cargar';
      const c1Txt = tr.cuatrimestre1 !== null ? String(tr.cuatrimestre1) : 'Sin cargar';
      const i1Txt = tr.informe1 || 'Sin cargar';
      const p2Txt = tr.preliminar2 || 'Sin cargar';
      const c2Txt = tr.cuatrimestre2 !== null ? String(tr.cuatrimestre2) : 'Sin cargar';
      const i2Txt = tr.informe2 || 'Sin cargar';
      const nfTxt = tr.can_close_final
        ? (tr.notaFinal !== null
            ? `**${tr.notaFinal}**${tr.suggested_final === tr.notaFinal ? ' (Sugerida por promedio)' : ' (Editada/Cerrada)'}`
            : `Habilitada para cierre (Sugerida: ${tr.suggested_final})`)
        : 'No cerrada (requiere ambos cuatrimestres >= 7)';

      const lines = [
        '# Informe Individual de Seguimiento e Intensificación',
        '',
        `- **Estudiante:** ${student.nombre_completo}`,
        `- **Colegio:** ${student.colegio}`,
        `- **Curso:** ${student.curso}`,
        `- **Estado General:** **${student.estado}** (${student.cant_aprobadas}/${student.total_unidades} unidades aprobadas)`,
        `- **Promedio Vigente (unidades):** ${student.promedio}`,
        '',
        '## Trayectoria Cuatrimestral e Informes',
        `- **1° Cuatrimestre:** Preliminar: ${p1Txt} | Nota: ${c1Txt} | Informe Cierre: ${i1Txt}`,
        `- **2° Cuatrimestre:** Preliminar: ${p2Txt} | Nota: ${c2Txt} | Informe Cierre: ${i2Txt}`,
        `- **Nota Final:** ${nfTxt}`,
        '',
        '## Detalle por Unidad Evaluada',
        '',
        '| Unidad | Examen | Recuperatorio | Estado |',
        '| :--- | :---: | :---: | :--- |',
      ];

      (student.unidades || []).forEach((u) => {
        const exStr = u.examen !== null ? String(u.examen) : 'Ausente';
        const rcStr = u.recu !== null ? String(u.recu) : '—';
        const badge = u.intensifica ? 'Intensifica (Pendiente)' : u.estado === 'Intensificada' ? 'Intensificada ✓' : u.estado;
        lines.push(`| ${u.unidad} | ${exStr} | ${rcStr} | **${badge}** |`);
      });

      lines.push('');
      if (student.cant_intensificar === 0 && student.cant_intensificadas > 0) {
        lines.push('## Situación de Intensificación');
        lines.push(`**${student.nombre_completo}** completó y acreditó la intensificación de todas sus unidades pendientes (${student.cant_intensificadas}/${student.cant_pendientes_totales}). **No tiene unidades pendientes.**`);
      } else if (student.cant_intensificar === 0) {
        lines.push('## Situación de Intensificación');
        lines.push(`**${student.nombre_completo}** aprobó todas las unidades evaluadas con calificación igual o superior a **7**. **No debe intensificar ninguna unidad.**`);
      } else {
        lines.push(`## Unidades Pendientes de Intensificar (${student.cant_intensificar})`);
        lines.push(`Para acreditar la materia, **${student.nombre_completo}** todavía debe intensificar los contenidos de las siguientes unidades:`);
        lines.push('');
        student.unidades_intensificar.forEach((u) => {
          lines.push(`- **${u.unidad}**: ${u.motivo}.`);
        });
        if (student.cant_intensificadas > 0) {
          lines.push('');
          lines.push(`*Ya intensificadas y verificadas (${student.cant_intensificadas}): ${student.unidades.filter((u) => u.intensificado).map((u) => u.unidad).join(', ')}.*`);
        }
      }
      return lines.join('\n');
    }

    formatStudentsForPrompt(studentsList) {
      return studentsList
        .map((s) => {
          const unitParts = (s.unidades || []).map((u) => {
            const exS = u.examen !== null ? String(u.examen) : 'Aus';
            const rcS = u.recu !== null ? String(u.recu) : '-';
            return `${u.unidad} [Ex:${exS}, Recu:${rcS} -> ${u.estado}]`;
          });
          const intNames = (s.unidades_intensificar || []).map((u) => u.unidad).join(', ') || 'Ninguna';
          const doneNames = (s.unidades || []).filter((u) => u.intensificado).map((u) => u.unidad).join(', ');
          const doneTxt = doneNames ? ` | Ya intensificadas: ${doneNames}` : '';
          const tr = normalizeTrayectoria(s.trayectoria);
          const trTxt = ` | Prelim1:${tr.preliminar1 || '-'}, Cuat1:${tr.cuatrimestre1 ?? '-'}, Inf1:${tr.informe1 || '-'}, Prelim2:${tr.preliminar2 || '-'}, Cuat2:${tr.cuatrimestre2 ?? '-'}, Inf2:${tr.informe2 || '-'}, Final:${tr.notaFinal ?? (tr.can_close_final ? `Sug(${tr.suggested_final})` : 'Bloqueada(<7)')}`;
          const extrasEntries = Object.entries(s.extras || {}).filter(([, v]) => String(v).trim() !== '');
          const extrasTxt = extrasEntries.length
            ? ' | Extras: ' + extrasEntries.map(([k, v]) => `${k}=${v}`).join(', ')
            : '';
          return `- ${s.nombre_completo} | Colegio: ${s.colegio} | Curso: ${s.curso} | Estado: ${s.estado} | Promedio: ${s.promedio}${trTxt} | Pendientes de intensificar (${s.cant_intensificar}): ${intNames}${doneTxt} | Detalle: ${unitParts.join(' ; ')}${extrasTxt}`;
        })
        .join('\n');
    }

    buildChatLocalFallback(question, colegio, curso) {
      const qLower = question.toLowerCase();

      let activeColegio = colegio;
      let activeCurso = curso;

      const allColegios = [...new Set(this.students.map(s => s.colegio))];
      const allCursos = [...new Set(this.students.map(s => s.curso))];

      const mentionedColegio = allColegios.find(c => qLower.includes(c.toLowerCase()));
      const mentionedCurso = allCursos.find(cu => qLower.includes(cu.toLowerCase()));

      if (mentionedColegio && (!activeColegio || activeColegio === 'Todos')) {
        activeColegio = mentionedColegio;
      }
      if (mentionedCurso && (!activeCurso || activeCurso === 'Todos')) {
        activeCurso = mentionedCurso;
      }

      const studentsList = this.getStudentsList(activeColegio, activeCurso);
      const stats = this.getSummaryStats(activeColegio, activeCurso);
      const riskStudents = this.getAtRiskStudents(activeColegio, activeCurso);

      const matchingStudents = [];
      for (const s of studentsList) {
        const nom = (s.nombre || '').toLowerCase();
        const ape = (s.apellido || '').toLowerCase();
        const full = (s.nombre_completo || '').toLowerCase();
        if ((nom && qLower.includes(nom)) || (ape && qLower.includes(ape)) || (full && qLower.includes(full))) {
          matchingStudents.push(s);
        }
      }

      if (matchingStudents.length === 1) {
        return this.buildStudentIntensificationMarkdown(matchingStudents[0]);
      } else if (matchingStudents.length > 1) {
        const uniqueMap = new Map();
        matchingStudents.forEach(s => uniqueMap.set(s.nombre_completo + '|' + s.curso, s));
        const uniqueStudents = Array.from(uniqueMap.values());

        if (uniqueStudents.length === 1) {
          return this.buildStudentIntensificationMarkdown(uniqueStudents[0]);
        }

        let answer = `*(Encontré **${uniqueStudents.length} estudiantes** que coinciden con "${question}". ¿A cuál de ellos te referís?)*\n\n`;
        uniqueStudents.forEach((s, idx) => {
          answer += `${idx + 1}. **${s.nombre_completo}** — Curso: ${s.curso} (${s.colegio}) — Estado: ${s.estado}\n`;
        });
        answer += `\n*Por favor, indicá el nombre y apellido completo o el curso para ver su informe detallado.*`;
        return answer;
      }

      let answer = '*(Respuesta generada en modo local)*\n\n';
      const isCountQuestion = ['cuántos', 'cuantos', 'cuántas', 'cuantas', 'total', 'cantidad', 'número', 'numero'].some(k => qLower.includes(k));
      const stopWords = new Set(['unidad', 'exam', 'examen', 'recu', 'recuperatorio', 'parte', 'modulo', 'módulo', 'la', 'el', 'de', 'del', 'en', 'los', 'las']);
      
      const mentionedUnit = (stats.unidades || []).find(u => {
        const uLow = u.toLowerCase();
        if (qLower.includes(uLow)) return true;
        const words = uLow.split(/[\s\-–—()]+/).filter(w => w.length > 3 && !stopWords.has(w));
        return words.length > 0 && words.some(w => qLower.includes(w));
      });

      if (isCountQuestion && mentionedUnit) {
        const unitStats = stats.intensificacion_por_unidad.find(u => u.unidad.toLowerCase() === mentionedUnit.toLowerCase());
        const count = unitStats ? unitStats.cantidad_intensifican : 0;
        const totalEval = unitStats ? (unitStats.cantidad_intensifican + unitStats.cantidad_aprobados) : studentsList.length;
        
        answer += `En total, **${count} alumno(s)** tienen que intensificar la unidad **"${mentionedUnit}"**`;
        if (activeColegio && activeColegio !== 'Todos') answer += ` en **${activeColegio}**`;
        if (activeCurso && activeCurso !== 'Todos') answer += ` (${activeCurso})`;
        answer += ` (sobre un total de ${totalEval} alumnos evaluados en dicha unidad).\n`;

        if (count > 0) {
          const matchingUnitStudents = studentsList.filter(s => s.unidades_intensificar.some(u => u.unidad.toLowerCase() === mentionedUnit.toLowerCase()));
          answer += `\nDetalle de los alumnos:\n` + matchingUnitStudents.map(s => `- **${s.nombre_completo}** (${s.curso})`).join('\n');
        }
        return answer;
      }

      if (['intensific', 'riesgo', 'desaprob', 'quiénes deben', 'quienes deben', 'pendiente'].some((k) => qLower.includes(k))) {
        if (riskStudents.length === 0) {
          answer += '¡Excelente! Ningún alumno tiene unidades pendientes de intensificar.';
        } else {
          answer += `Hay **${riskStudents.length} alumnos** con unidades pendientes de intensificar:\n\n`;
          riskStudents.forEach((s) => {
            const uList = s.unidades_intensificar.map((u) => u.unidad).join(', ');
            answer += `- **${s.nombre_completo}** (${s.colegio} - ${s.curso}): intensifica **${uList}**.\n`;
          });
        }
      } else if (['aprob', 'tasa', 'acredit'].some((k) => qLower.includes(k))) {
        const aprobados = studentsList.filter((s) => !s.en_riesgo);
        answer += `Aprobaron/acreditaron **${aprobados.length} de ${stats.total_alumnos} alumnos** (${stats.tasa_aprobacion}%):\n`;
        aprobados.forEach((s) => {
          answer += `- **${s.nombre_completo}** (${s.curso}) — ${s.estado} (Prom: ${s.promedio})\n`;
        });
      } else if (['mejor', 'más alto', 'mas alto', 'destacado'].some((k) => qLower.includes(k))) {
        const ma = stats.mejor_alumno;
        answer += ma
          ? `El mejor rendimiento corresponde a **${ma.nombre}** (${ma.colegio} - ${ma.curso}) con promedio **${ma.promedio}**.`
          : 'No hay datos suficientes.';
      } else if (['unidad', 'costó', 'costo', 'dificil', 'difícil'].some((k) => qLower.includes(k))) {
        const sortedUnits = [...stats.intensificacion_por_unidad].sort((a, b) => b.cantidad_intensifican - a.cantidad_intensifican);
        if (sortedUnits.length === 0) {
          answer += 'No hay unidades evaluadas.';
        } else {
          answer += 'Detalle de intensificación por unidad:\n\n';
          sortedUnits.forEach((u) => {
            answer += `- **${u.unidad}**: ${u.cantidad_intensifican} intensifican / ${u.cantidad_aprobados} aprobados\n`;
          });
        }
      } else {
        answer +=
          'Podés preguntarme cosas como:\n' +
          '- *¿Qué alumnos tienen que intensificar y qué unidades debe cada uno?*\n' +
          '- *Haceme el detalle de [nombre o apellido del alumno]*\n' +
          '- *¿Qué unidad tiene más alumnos para intensificar?*\n' +
          '- *¿Quiénes aprobaron todas las unidades?*';
      }
      return answer;
    }

    buildLocalCourseReportMarkdown(colegio, curso) {
      const stats = this.getSummaryStats(colegio, curso);
      const riskStudents = this.getAtRiskStudents(colegio, curso);
      const filtroTxt = `Colegio: ${colegio || 'Todos'} | Curso: ${curso || 'Todos'}`;

      const lines = [
        '# Informe General de Intensificación y Seguimiento',
        `*${filtroTxt}*`,
        '',
        '## 1. Resumen Ejecutivo',
        `- **Total de alumnos:** ${stats.total_alumnos}`,
        `- **Unidades evaluadas (${stats.total_unidades}):** ${stats.unidades.join(', ')}`,
        `- **Aprobados (todas las unidades >= 7):** ${stats.alumnos_aprobados} (${stats.tasa_aprobacion}%)`,
        `- **Alumnos que deben intensificar:** ${stats.alumnos_en_riesgo}`,
        `- **Promedio general:** ${stats.promedio_general}`,
        '',
        '## 2. Unidades con Mayor Necesidad de Intensificación',
      ];
      stats.intensificacion_por_unidad.forEach((item) => {
        lines.push(`- **${item.unidad}**: ${item.cantidad_intensifican} alumno(s) intensifican / ${item.cantidad_aprobados} aprobados.`);
      });

      lines.push('');
      lines.push('## 3. Reporte por Alumno — Unidades Pendientes e Intensificadas');
      const tracked = this.getStudentsList(colegio, curso).filter((s) => s.cant_pendientes_totales > 0);
      if (tracked.length === 0) {
        lines.push('Todos los alumnos aprobaron todas las unidades con calificación >= 7.');
      } else {
        tracked.forEach((s) => {
          lines.push(`### ${s.nombre_completo} (${s.colegio} — ${s.curso})`);
          (s.unidades_pendientes_totales || []).forEach((u) => {
            const flag = u.intensificado ? '[✓ Intensificada]' : '[Pendiente]';
            lines.push(`- ${flag} **${u.unidad}**: ${u.motivo}.`);
          });
          lines.push('');
        });
      }
      return lines.join('\n');
    }

    downloadExcelExport(colegio = null, curso = null) {
      if (!global.XLSX) throw new Error('Librería Excel no disponible.');
      const students = this.getStudentsList(colegio, curso);
      if (students.length === 0) {
        return this.downloadTemplate('single-xlsx');
      }

      const { uniform } = this.unitsForStudents(students);
      const groups = new Map();
      if (uniform) {
        groups.set('Planilla', students);
      } else {
        students.forEach((s) => {
          const k = String(s.curso || 'Curso').trim().slice(0, 31) || 'Curso';
          if (!groups.has(k)) groups.set(k, []);
          groups.get(k).push(s);
        });
      }

      const wb = global.XLSX.utils.book_new();
      const usedNames = new Set();

      for (const [rawName, grp] of groups.entries()) {
        let sheetName = rawName.replace(/[\\/*?:[\]]/g, '_').slice(0, 31) || 'Curso';
        const baseName = sheetName;
        let suffix = 2;
        while (usedNames.has(sheetName)) {
          sheetName = `${baseName.slice(0, 28)}_${suffix}`;
          suffix++;
        }
        usedNames.add(sheetName);

        const { units: grpUnits } = this.unitsForStudents(grp);
        const grpExtras = this.getExtraColumnsForStudents(grp);

        const hasIntensifFlags = grp.some((s) => (s.unidades || []).some((u) => u.intensificado));

        const records = grp.map((s) => {
          const row = {
            colegio: s.colegio,
            curso: s.curso,
            nombre: s.nombre,
            apellido: s.apellido,
          };
          const uLookup = {};
          (s.unidades || []).forEach((u) => {
            uLookup[u.unidad] = u;
          });
          grpUnits.forEach((uName) => {
            const uObj = uLookup[uName];
            row[`${uName} (Examen)`] = uObj && uObj.examen !== null ? uObj.examen : null;
            row[`${uName} (Recu)`] = uObj && uObj.recu !== null ? uObj.recu : null;
            if (hasIntensifFlags) {
              row[`${uName} (Intensificada)`] = uObj && uObj.intensificado ? 'Sí' : '';
            }
          });
          grpExtras.forEach((exCol) => {
            const colHeader = EXTRA_TEXT_COLS.has(normalizeKey(exCol)) ? exCol : `Extra: ${exCol}`;
            row[colHeader] = (s.extras && s.extras[exCol]) || '';
          });
          const tr = normalizeTrayectoria(s.trayectoria);
          row['1° Informe Preliminar (TEA/TEP/TED)'] = tr.preliminar1 || '';
          row['1° Cuatrimestre'] = tr.cuatrimestre1;
          row['1° Informe Cuatrimestre (TEA/TEP/TED)'] = tr.informe1 || '';
          row['2° Informe Preliminar (TEA/TEP/TED)'] = tr.preliminar2 || '';
          row['2° Cuatrimestre'] = tr.cuatrimestre2;
          row['2° Informe Cuatrimestre (TEA/TEP/TED)'] = tr.informe2 || '';
          row['Nota Final'] = tr.notaFinal;
          return row;
        });

        const ws = global.XLSX.utils.json_to_sheet(records);
        global.XLSX.utils.book_append_sheet(wb, ws, sheetName);
      }

      const filename = `planilla_docente_${new Date().toISOString().slice(0, 10)}.xlsx`;
      global.XLSX.writeFile(wb, filename);
      return filename;
    }

    downloadTemplate(fmt) {
      if (fmt === 'csv') {
        const blob = new Blob([FALLBACK_DEMO_CSV + '\n'], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'plantilla_un_curso.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return 'plantilla_un_curso.csv';
      }

      if (!global.XLSX) throw new Error('Librería Excel no disponible.');
      const wb = global.XLSX.utils.book_new();

      if (fmt === 'multi-xlsx' || fmt === 'multi') {
        const emptyTraj = {
          '1° Informe Preliminar (TEA/TEP/TED)': '',
          '1° Cuatrimestre': null,
          '1° Informe Cuatrimestre (TEA/TEP/TED)': '',
          '2° Informe Preliminar (TEA/TEP/TED)': '',
          '2° Cuatrimestre': null,
          '2° Informe Cuatrimestre (TEA/TEP/TED)': '',
          'Nota Final': null,
        };
        const df3a = [
          {
            colegio: 'Instituto San Martín', curso: '3° A', nombre: 'Juan', apellido: 'Pérez',
            'U1 - Números (Examen)': 8.5, 'U1 - Números (Recu)': null,
            'U2 - Ecuaciones (Examen)': 9.0, 'U2 - Ecuaciones (Recu)': null,
            'U3 - Funciones (Examen)': 7.5, 'U3 - Funciones (Recu)': null,
            ...emptyTraj,
          },
          {
            colegio: 'Instituto San Martín', curso: '3° A', nombre: 'María', apellido: 'Gómez',
            'U1 - Números (Examen)': 7.0, 'U1 - Números (Recu)': null,
            'U2 - Ecuaciones (Examen)': 5.5, 'U2 - Ecuaciones (Recu)': 7.5,
            'U3 - Funciones (Examen)': 8.0, 'U3 - Funciones (Recu)': null,
            ...emptyTraj,
          },
          {
            colegio: 'Instituto San Martín', curso: '3° A', nombre: 'Lucas', apellido: 'Martínez',
            'U1 - Números (Examen)': 4.0, 'U1 - Números (Recu)': 5.5,
            'U2 - Ecuaciones (Examen)': 5.0, 'U2 - Ecuaciones (Recu)': 6.0,
            'U3 - Funciones (Examen)': 7.5, 'U3 - Funciones (Recu)': null,
            ...emptyTraj,
          },
        ];
        const df4a = [
          {
            colegio: 'Escuela Belgrano', curso: '4° A', nombre: 'Martina', apellido: 'Álvarez',
            'U1 - Polinomios (Examen)': 5.0, 'U1 - Polinomios (Recu)': 4.5,
            'U2 - Trigonometría (Examen)': 3.0, 'U2 - Trigonometría (Recu)': 4.0,
            'U3 - Estadística (Examen)': 7.5, 'U3 - Estadística (Recu)': null,
            'U4 - Probabilidad (Examen)': 6.0, 'U4 - Probabilidad (Recu)': 6.5,
            ...emptyTraj,
          },
          {
            colegio: 'Escuela Belgrano', curso: '4° A', nombre: 'Joaquín', apellido: 'Silva',
            'U1 - Polinomios (Examen)': 8.0, 'U1 - Polinomios (Recu)': null,
            'U2 - Trigonometría (Examen)': 7.5, 'U2 - Trigonometría (Recu)': null,
            'U3 - Estadística (Examen)': 8.5, 'U3 - Estadística (Recu)': null,
            'U4 - Probabilidad (Examen)': 7.0, 'U4 - Probabilidad (Recu)': null,
            ...emptyTraj,
          },
        ];
        global.XLSX.utils.book_append_sheet(wb, global.XLSX.utils.json_to_sheet(df3a), '3° A - San Martín');
        global.XLSX.utils.book_append_sheet(wb, global.XLSX.utils.json_to_sheet(df4a), '4° A - Belgrano');
        global.XLSX.writeFile(wb, 'plantilla_varios_cursos_multipestana.xlsx');
        return 'plantilla_varios_cursos_multipestana.xlsx';
      }

      const matrix = parseCsvTextToMatrix(FALLBACK_DEMO_CSV);
      const ws = global.XLSX.utils.aoa_to_sheet(matrix);
      global.XLSX.utils.book_append_sheet(wb, ws, 'Curso');
      global.XLSX.writeFile(wb, 'plantilla_un_curso.xlsx');
      return 'plantilla_un_curso.xlsx';
    }
  }

  function cleanPdfText(str) {
    return String(str || '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/≥/g, '>=')
      .replace(/—/g, '-')
      .replace(/[\u{10000}-\u{10FFFF}\u2600-\u27BF]/gu, '')
      .trim();
  }

  function exportPdfFromPages(pages, filename = 'reporte_docente.pdf') {
    if (!global.jspdf || !global.jspdf.jsPDF) {
      throw new Error('La librería jsPDF todavía se está cargando.');
    }
    const { jsPDF } = global.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const margin = 16;
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const usableW = pageW - margin * 2;

    const validPages = (pages || []).filter((p) => p && String(p).trim());
    if (validPages.length === 0) {
      throw new Error('No hay contenido para exportar a PDF.');
    }

    validPages.forEach((mdText, pageIdx) => {
      if (pageIdx > 0) doc.addPage();
      let y = margin;
      const lines = String(mdText).split(/\r?\n/);

      const ensureSpace = (neededMm) => {
        if (y + neededMm > pageH - 18) {
          doc.addPage();
          y = margin;
        }
      };

      let i = 0;
      while (i < lines.length) {
        const raw = lines[i].trim();
        if (!raw || raw === '---') {
          y += 2;
          i++;
          continue;
        }

        if (raw.startsWith('|') && raw.endsWith('|')) {
          const tableRows = [];
          while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
            const cells = lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
            const isSep = cells.some(Boolean) && cells.every((c) => !c || /^:?-{2,}:?$/.test(c));
            if (!isSep) tableRows.push(cells.map(cleanPdfText));
            i++;
          }
          if (tableRows.length > 0) {
            const head = [tableRows[0]];
            const body = tableRows.slice(1);
            const autoTableOpts = {
              startY: y,
              head,
              body,
              margin: { left: margin, right: margin },
              styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.2, textColor: [30, 41, 59], lineColor: [226, 232, 240], lineWidth: 0.2 },
              headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
              didParseCell: (hookData) => {
                if (hookData.section === 'body') {
                  const txt = String(hookData.cell.raw || '').toLowerCase();
                  if (txt.includes('intensificada') || txt.includes('aprobada')) {
                    hookData.cell.styles.textColor = [4, 120, 87];
                    hookData.cell.styles.fontStyle = 'bold';
                  } else if (txt.includes('intensifica')) {
                    hookData.cell.styles.textColor = [190, 18, 60];
                    hookData.cell.styles.fontStyle = 'bold';
                  }
                }
              },
            };
            if (typeof doc.autoTable === 'function') {
              doc.autoTable(autoTableOpts);
              y = (doc.lastAutoTable?.finalY || y + 20) + 5;
            } else if (typeof global.jspdf.autoTable === 'function') {
              global.jspdf.autoTable(doc, autoTableOpts);
              y = (doc.lastAutoTable?.finalY || y + 20) + 5;
            }
          }
          continue;
        }

        if (raw.startsWith('# ')) {
          ensureSpace(12);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(14);
          doc.setTextColor(15, 23, 42);
          const wrapped = doc.splitTextToSize(cleanPdfText(raw.slice(2)), usableW);
          doc.text(wrapped, margin, y);
          y += wrapped.length * 6.2 + 1;
          doc.setDrawColor(203, 213, 225);
          doc.line(margin, y, pageW - margin, y);
          y += 5;
        } else if (raw.startsWith('## ')) {
          ensureSpace(10);
          y += 2;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11.5);
          doc.setTextColor(30, 41, 59);
          const wrapped = doc.splitTextToSize(cleanPdfText(raw.slice(3)), usableW);
          doc.text(wrapped, margin, y);
          y += wrapped.length * 5.2 + 2;
        } else if (raw.startsWith('### ')) {
          ensureSpace(9);
          y += 1.5;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10.5);
          doc.setTextColor(51, 65, 85);
          const wrapped = doc.splitTextToSize(cleanPdfText(raw.slice(4)), usableW);
          doc.text(wrapped, margin, y);
          y += wrapped.length * 4.8 + 1.5;
        } else if (raw.startsWith('- ') || raw.startsWith('* ')) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9.5);
          doc.setTextColor(30, 41, 59);
          const wrapped = doc.splitTextToSize(`• ${cleanPdfText(raw.slice(2))}`, usableW - 3);
          ensureSpace(wrapped.length * 4.8 + 1.5);
          doc.text(wrapped, margin + 3, y);
          y += wrapped.length * 4.6 + 1.2;
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9.5);
          doc.setTextColor(30, 41, 59);
          const wrapped = doc.splitTextToSize(cleanPdfText(raw), usableW);
          ensureSpace(wrapped.length * 4.8 + 1.5);
          doc.text(wrapped, margin, y);
          y += wrapped.length * 4.6 + 1.5;
        }
        i++;
      }
    });

    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(120, 130, 145);
      doc.text(`Seguimiento Docente - Pagina ${p} de ${totalPages}`, pageW / 2, pageH - 10, { align: 'center' });
    }

    const safeName = String(filename || 'reporte_docente.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
    const finalName = safeName.toLowerCase().endsWith('.pdf') ? safeName : `${safeName}.pdf`;
    doc.save(finalName);
    return { pagesCount: validPages.length, filename: finalName };
  }

  global.DocenteEngine = DocenteEngine;
  global.exportPdfFromPages = exportPdfFromPages;
})(window);
