require('dotenv').config();
const crypto = require('crypto');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const twilio = require('twilio');
const cron = require('node-cron');

const PORT = process.env.PORT || 3001;
const DATA_DIR = process.env.DATA_DIR || __dirname;
const CITAS_PATH = path.join(DATA_DIR, 'citas.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const BACKUP_KEEP_DAYS = 30;
const BACKUP_KEEP_MIN = 7;

// Cliente perezoso: instanciarlo al cargar el módulo hace que unas
// credenciales ausentes o mal escritas tumben TODO el servidor al arrancar
// (incluido el panel /admin), cuando lo único que debería caer es el envío
// de recordatorios. Se crea en el primer envío y se cachea.
let twilioClient = null;
function getTwilioClient() {
  if (!twilioClient) {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}

// Red de seguridad de proceso. Una rejection asíncrona suelta (p. ej. un await
// que lanza dentro del handler HTTP) es local a esa petición y no corrompe el
// estado global: loggeamos y seguimos vivos para no tirar la web pública.
process.on('unhandledRejection', (reason) => {
  console.error('[process] unhandledRejection:', reason instanceof Error ? reason.stack : reason);
});
// Una excepción no capturada deja el proceso en estado indefinido: loggeamos el
// stack y salimos limpio para que Render reinicie. El disparador persistente del
// bucle de reinicios (JSON corrupto) ya lo neutraliza readCitas.
process.on('uncaughtException', (err) => {
  console.error('[process] uncaughtException:', err.stack || err.message);
  process.exit(1);
});

function readCitas() {
  if (!fs.existsSync(CITAS_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(CITAS_PATH, 'utf8'));
  } catch (err) {
    console.error(`[citas] citas.json ilegible o corrupto: ${err.message}`);
    try {
      const backup = `${CITAS_PATH}.corrupt-${Date.now()}`;
      fs.renameSync(CITAS_PATH, backup);
      console.error(`[citas] Archivo corrupto preservado en ${backup}`);
    } catch (renameErr) {
      console.error(`[citas] No se pudo preservar el archivo corrupto: ${renameErr.message}`);
    }
    return [];
  }
}

function writeCitas(citas) {
  const tmp = `${CITAS_PATH}.tmp`;
  // Sin esto, un DATA_DIR inexistente lanza ENOENT: el handler global lo
  // recoge como unhandledRejection, el panel responde igual, el formulario
  // se cierra y la cita se pierde SIN aviso. Mismo remedio que backupCitas()
  // aplica a BACKUP_DIR. La escritura atómica tmp + rename no cambia.
  fs.mkdirSync(path.dirname(CITAS_PATH), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(citas, null, 2));
  fs.renameSync(tmp, CITAS_PATH);
}

const BACKUP_RE = /^citas-\d{4}-\d{2}-\d{2}\.json$/;
const BACKUP_TMP_RE = /^citas-\d{4}-\d{2}-\d{2}\.json\.tmp$/;

// Copia diaria de citas.json a BACKUP_DIR. Lee el archivo CRUDO, nunca vía
// readCitas(): esa función renombra citas.json a .corrupt-* si no parsea,
// y desde un backup eso sería destructivo. Si el JSON no parsea NO se
// escribe nada: la última copia buena vale más que una corrupta de hoy.
function backupCitas() {
  try {
    if (!fs.existsSync(CITAS_PATH)) {
      console.log('[backup] citas.json no existe todavía; nada que copiar');
      return;
    }
    const raw = fs.readFileSync(CITAS_PATH, 'utf8');
    let citas;
    try {
      citas = JSON.parse(raw);
    } catch (err) {
      console.error(`[backup] GRAVE: citas.json no parsea (${err.message}); backup OMITIDO para no pisar la última copia buena`);
      return;
    }
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const nombreHoy = `citas-${hoyMadrid()}.json`;
    const destino = path.join(BACKUP_DIR, nombreHoy);

    // Caída brusca respecto al backup previo (vacío o por debajo de la
    // mitad): puede ser legítimo (limpieza de citas) o un DATA_DIR mal
    // montado tras un deploy. Se avisa fuerte pero se escribe igualmente:
    // las copias previas no se tocan.
    if (Array.isArray(citas)) {
      const previo = fs.readdirSync(BACKUP_DIR)
        .filter(f => BACKUP_RE.test(f) && f < nombreHoy)
        .sort()
        .pop();
      if (previo) {
        try {
          const previas = JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, previo), 'utf8'));
          if (Array.isArray(previas) && previas.length > 0 && citas.length < previas.length * 0.5) {
            console.warn(`[backup] ¡ATENCIÓN! citas.json ${citas.length === 0 ? 'está VACÍO' : `ha caído a ${citas.length} citas`} y ${previo} tenía ${previas.length}. Posible pérdida de datos.`);
          }
        } catch (err) {
          console.warn(`[backup] No se pudo comparar con ${previo}: ${err.message}`);
        }
      }
    }

    const tmp = `${destino}.tmp`;
    fs.writeFileSync(tmp, raw);
    fs.renameSync(tmp, destino);
    console.log(`[backup] Copia diaria escrita: ${nombreHoy} (${Buffer.byteLength(raw)} bytes)`);

    purgarBackups();
  } catch (err) {
    console.error(`[backup] Error inesperado: ${err.message}`);
  }
}

// Purga SOLO archivos de BACKUP_DIR que casan exactamente con los patrones
// esperados; .corrupt-*, citas.json o cualquier otro nombre se ignora. La
// antigüedad de los backups se mide por la fecha del NOMBRE, nunca por
// mtime (un restore o una copia lo alteran). Conserva siempre los
// BACKUP_KEEP_MIN más recientes, aunque todos superen BACKUP_KEEP_DAYS.
function purgarBackups() {
  const entradas = fs.readdirSync(BACKUP_DIR);
  const backups = entradas
    .filter(f => BACKUP_RE.test(f))
    .sort()
    .reverse(); // descendente: el más reciente primero

  // Nombre-límite: caduca todo backup con fecha ESTRICTAMENTE anterior.
  // Restar días en ms es seguro: un desfase de ±1h por DST solo movería
  // el límite un día en llamadas pegadas a medianoche, y BACKUP_KEEP_MIN
  // garantiza igualmente las copias recientes.
  const limite = `citas-${fechaMadrid(new Date(Date.now() - BACKUP_KEEP_DAYS * 24 * 60 * 60 * 1000))}.json`;
  const caducados = backups.slice(BACKUP_KEEP_MIN).filter(f => f < limite);
  if (caducados.length > 0) {
    const borrados = [];
    for (const f of caducados) {
      try {
        fs.unlinkSync(path.join(BACKUP_DIR, f));
        borrados.push(f);
      } catch (err) {
        console.warn(`[backup] No se pudo borrar ${f}: ${err.message}`);
      }
    }
    console.log(`[backup] Purga: ${borrados.length} backups antiguos borrados (${borrados.join(', ')})`);
  }

  // .tmp huérfanos: restos de una escritura interrumpida. Solo con más de
  // 24h de antigüedad (uno reciente puede ser una escritura en curso).
  // Bucle aparte: no cuentan para BACKUP_KEEP_MIN / BACKUP_KEEP_DAYS.
  for (const f of entradas.filter(f => BACKUP_TMP_RE.test(f))) {
    try {
      const ruta = path.join(BACKUP_DIR, f);
      if (Date.now() - fs.statSync(ruta).mtimeMs > 24 * 60 * 60 * 1000) {
        fs.unlinkSync(ruta);
        console.log(`[backup] .tmp huérfano borrado: ${f}`);
      }
    } catch (err) {
      console.warn(`[backup] No se pudo borrar ${f}: ${err.message}`);
    }
  }
}

// --- Backup remoto a GitHub (tercera capa de copia) ---------------------
// Las dos capas locales (citas.json y BACKUP_DIR) viven en el MISMO disco
// de Render; esta sube la copia del día a un repo privado vía Contents API.
// Fallo SIEMPRE silencioso: todo el cuerpo va en try/catch — un backup
// remoto que falla solo loggea, nunca tumba el proceso ni afecta a los
// recordatorios de las 19:00.
let githubBackupAvisado = false;
async function subirBackupGitHub(fecha = hoyMadrid()) {
  try {
    if (process.env.GITHUB_BACKUP_ENABLED !== 'true') return;
    const token = process.env.GITHUB_BACKUP_TOKEN;
    const repo = process.env.GITHUB_BACKUP_REPO;
    if (!token || !repo) {
      if (!githubBackupAvisado) {
        githubBackupAvisado = true;
        console.warn('[backup-remoto] GITHUB_BACKUP_ENABLED=true pero falta GITHUB_BACKUP_TOKEN o GITHUB_BACKUP_REPO; subida omitida');
      }
      return;
    }

    const nombre = `citas-${fecha}.json`;
    const origen = path.join(BACKUP_DIR, nombre);
    if (!fs.existsSync(origen)) {
      console.warn(`[backup-remoto] No existe ${nombre} en el disco; el backup local de las 03:00 debió fallar. Subida omitida`);
      return;
    }
    const raw = fs.readFileSync(origen, 'utf8');

    const url = `https://api.github.com/repos/${repo}/contents/backups/${nombre}`;
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'neumaticos-quesada-backup', // GitHub rechaza peticiones sin User-Agent
    };

    // PASO 1: sha del archivo si ya existe (re-subida del mismo día).
    // 404 = primera subida, no es error.
    let sha;
    const resGet = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
    if (resGet.ok) {
      sha = (await resGet.json()).sha;
    } else if (resGet.status !== 404) {
      console.error(`[backup-remoto] GET previo falló con ${resGet.status}: ${(await resGet.text()).slice(0, 200)}`);
      return;
    }

    // PASO 2: crear (201) o actualizar (200) el archivo en el repo.
    const resPut = await fetch(url, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        message: `backup: citas ${fecha}`,
        content: Buffer.from(raw, 'utf8').toString('base64'),
        ...(sha ? { sha } : {}),
      }),
    });

    if (resPut.status === 200 || resPut.status === 201) {
      console.log(`[backup-remoto] ${nombre} subido a ${repo} (${Buffer.byteLength(raw)} bytes)`);
      return;
    }
    const extracto = (await resPut.text()).slice(0, 200);
    if (resPut.status === 409) {
      console.error(`[backup-remoto] PUT devolvió 409: el repo no tiene rama inicial (crear un commit inicial en ${repo}). ${extracto}`);
    } else {
      console.error(`[backup-remoto] PUT falló con ${resPut.status}: ${extracto}`);
    }
  } catch (err) {
    console.error(`[backup-remoto] Error inesperado: ${err.message}`);
  }
}

// Tope de body (#10): 10 KB sobra para cualquier formulario del panel.
// Sentinel que parseBody resuelve al superarlo; el caller responde 413.
const MAX_BODY_BYTES = 10 * 1024;
const BODY_TOO_LARGE = Symbol('body-too-large');

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let received = 0;
    let tooLarge = false;
    req.on('data', chunk => {
      if (tooLarge) return;
      received += chunk.length;
      if (received > MAX_BODY_BYTES) {
        tooLarge = true;
        raw = '';
        resolve(BODY_TOO_LARGE);
        return;
      }
      raw += chunk;
    });
    req.on('end', () => {
      if (tooLarge) return;
      const ct = req.headers['content-type'] || '';
      if (ct.includes('application/x-www-form-urlencoded')) {
        const params = new URLSearchParams(raw);
        const obj = {};
        for (const [k, v] of params) obj[k] = v;
        resolve(obj);
      } else {
        // Estricto: si no parsea como objeto JSON, null → el caller responde 400.
        try {
          const parsed = JSON.parse(raw);
          resolve(typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : null);
        } catch {
          resolve(null);
        }
      }
    });
    req.on('error', reject);
  });
}

// Comparación en tiempo constante: se hashea cada lado con SHA-256 y se
// comparan los hashes con timingSafeEqual. Hashear ambos lados garantiza
// buffers del mismo tamaño (requisito de timingSafeEqual) y no filtra la
// longitud real de las credenciales.
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function checkAuth(req) {
  if (!process.env.ADMIN_USER || !process.env.ADMIN_PASS) return false;
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Basic ')) return false;
  const decoded = Buffer.from(header.slice(6), 'base64').toString();
  const sep = decoded.indexOf(':');
  if (sep === -1) return false;
  const user = decoded.slice(0, sep);
  const pass = decoded.slice(sep + 1);
  const userOk = safeEqual(user, process.env.ADMIN_USER);
  const passOk = safeEqual(pass, process.env.ADMIN_PASS);
  return userOk && passOk;
}

// Anti-CSRF en tres niveles, de más fiable a menos:
//  1. Sec-Fetch-Site: la manda el navegador y es inmune a la referrer
//     policy; "same-origin" y "none" (navegación iniciada por el usuario)
//     son legítimos, "same-site"/"cross-site" no.
//  2. Origin (o Referer de reserva): debe coincidir con el propio host.
//     El literal "null" (iframe sandbox, file://, redirect cross-origin)
//     se rechaza explícitamente: es justo el vector que hay que parar.
//  3. Sin ninguna de las tres (curl, herramientas API) se permite: el
//     objetivo es bloquear peticiones cross-origin desde navegador.
function isSameOrigin(req) {
  const site = req.headers['sec-fetch-site'];
  if (site) return site === 'same-origin' || site === 'none';

  const origin = req.headers.origin || req.headers.referer;
  if (!origin) return true;
  if (origin === 'null') return false;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

// Rate-limit de auth por IP: 5 fallos en 15 min → bloqueo de 15 min.
// En memoria (Map); se pierde al reiniciar el proceso, suficiente como
// freno a fuerza bruta contra /admin.
const AUTH_MAX_FAILS = 5;
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_BLOCK_MS = 15 * 60 * 1000;
const authAttempts = new Map(); // ip → { fails, windowStart, blockedUntil }

// En Render el proceso corre detrás de proxy: remoteAddress sería siempre la
// IP del proxy. La IP real del cliente llega como primer valor de la cabecera
// x-forwarded-for; remoteAddress queda de fallback para ejecución local.
// OJO: x-forwarded-for solo es confiable detrás del proxy de Render (él la
// sobrescribe); si algún día el server corre expuesto sin proxy, un cliente
// podría falsearla y habría que revisar esta función.
function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return xff.split(',')[0].trim();
  return req.socket.remoteAddress || 'desconocida';
}

function isBlocked(ip) {
  const rec = authAttempts.get(ip);
  return !!rec && rec.blockedUntil > Date.now();
}

// Devuelve true si este fallo acaba de activar el bloqueo de la IP.
function registerAuthFail(ip) {
  const now = Date.now();
  let rec = authAttempts.get(ip);
  if (!rec || now - rec.windowStart > AUTH_WINDOW_MS) {
    rec = { fails: 0, windowStart: now, blockedUntil: 0 };
    authAttempts.set(ip, rec);
  }
  rec.fails += 1;
  if (rec.fails === AUTH_MAX_FAILS) {
    rec.blockedUntil = now + AUTH_BLOCK_MS;
    return true;
  }
  return false;
}

function clearAuthFails(ip) {
  authAttempts.delete(ip);
}

// Barrido horario: purga entradas con ventana y bloqueo ya expirados para
// que el Map no crezca sin límite. unref() para no retener el proceso.
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of authAttempts) {
    if (rec.blockedUntil < now && now - rec.windowStart > AUTH_WINDOW_MS) {
      authAttempts.delete(ip);
    }
  }
}, 60 * 60 * 1000).unref();

// Enmascara teléfonos en textos de log (#12): los errores de Twilio incluyen
// el número de destino en err.message. Deja solo los 2 últimos dígitos para
// poder correlacionar con la cita sin exponer el número completo.
function maskPhones(text) {
  return String(text).replace(/(?:whatsapp:)?\+?\d[\d\s\-]{7,}\d/g, m => {
    const digits = m.replace(/\D/g, '');
    return `***${digits.slice(-2)}`;
  });
}

// Envío por plantilla aprobada de Meta (Content Template Builder). NO existe
// camino de texto libre: fuera de la ventana de 24h Meta rechaza el body
// suelto, así que un fallback silencioso solo produciría fallos opacos.
async function sendWhatsApp(cita) {
  const contentSid = process.env.TWILIO_CONTENT_SID;
  if (!contentSid) {
    throw new Error('TWILIO_CONTENT_SID no configurado: no se puede enviar la plantilla de WhatsApp');
  }

  const clean = cita.telefono.replace(/[\s\-]/g, '').replace(/^(\+34|34)/, '');
  const to = `whatsapp:+34${clean}`;
  // {{4}} lleva servicio + detalle en una sola variable: la plantilla de Meta
  // tiene exactamente 5 y añadir una sexta obligaría a reaprobarla entera.
  const servicioDetalle = cita.detalle
    ? `${cita.servicio} — ${cita.detalle}`
    : cita.servicio;
  const contentVariables = JSON.stringify({
    1: contentVar(cita.nombre, 'nombre'),
    2: contentVar(fechaLegible(cita.fecha), 'fecha'),
    3: contentVar(cita.hora, 'hora'),
    4: contentVar(servicioDetalle, 'servicio'),
    5: contentVar(process.env.TALLER_TELEFONO, 'TALLER_TELEFONO'),
  });

  // Simulación: ni una llamada a Twilio. El payload se loggea enmascarado
  // (destino y teléfono del taller viajan dentro).
  if (process.env.TWILIO_DRY_RUN === 'true') {
    console.log('[whatsapp][DRY_RUN] payload:', maskPhones(JSON.stringify({
      to, contentSid, contentVariables,
    })));
    return { sid: 'DRYRUN', dryRun: true };
  }

  return getTwilioClient().messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM,
    to,
    contentSid,
    contentVariables,
  });
}

// Recordatorios automáticos diarios a las 19:00
cron.schedule('0 19 * * *', async () => {
  const citas = readCitas();
  // "Mañana" en Europe/Madrid, mismo enfoque que hoyMadrid(): el proceso corre
  // en UTC y toISOString() desfasaría el día en horario local de tarde/noche.
  // Sumar 24h en ms es seguro AQUÍ porque el cron dispara a las 19:00: el
  // desfase de ±1h del cambio de hora nunca cruza medianoche. Si se mueve
  // el cron a última hora de la noche, hay que recalcular en zona Madrid.
  const tomorrowStr = fechaMadrid(new Date(Date.now() + 24 * 60 * 60 * 1000));

  const pendientes = citas.filter(c =>
    c.estado === 'confirmada' &&
    c.fecha === tomorrowStr &&
    !c.recordatorioEnviado
  );

  let enviados = 0;
  for (const cita of pendientes) {
    try {
      const envio = await sendWhatsApp(cita);
      // En simulación no hubo entrega real: marcar la cita dejaría el test
      // local irrepetible (la siguiente pasada ya la filtraría fuera).
      if (envio?.dryRun) {
        console.log(`[cron][DRY_RUN] ${cita.id}: no se marca recordatorioEnviado`);
        continue;
      }
      // Persistencia inmediata sobre lectura fresca: el array leído al empezar
      // el barrido está obsoleto tras cada await (el panel puede haber creado,
      // borrado o modificado citas mientras tanto). Escribirlo entero al final
      // pisaría esos cambios.
      const actuales = readCitas();
      const target = actuales.find(c => c.id === cita.id);
      if (!target) {
        console.warn(`[cron] Cita ${cita.id} ya no existe al persistir el recordatorio; se omite`);
        continue;
      }
      target.recordatorioEnviado = true;
      writeCitas(actuales);
      enviados += 1;
    } catch (err) {
      console.error(`Error recordatorio ${cita.id}:`, maskPhones(err.message));
    }
  }

  console.log(`[cron] Recordatorios: ${enviados} enviados de ${pendientes.length} pendientes`);
}, { timezone: 'Europe/Madrid' });

// Backup diario de citas.json a las 03:00 — bloque independiente; no toca
// el cron de recordatorios de las 19:00.
cron.schedule('0 3 * * *', backupCitas, { timezone: 'Europe/Madrid' });

// Subida del backup del día a GitHub a las 03:15 — 15 min después del backup
// local para que el archivo ya exista. Bloque independiente: no toca el cron
// de las 03:00 ni el de recordatorios de las 19:00.
cron.schedule('15 3 * * *', () => {
  subirBackupGitHub().catch(err => console.error('[backup-remoto]', err.message));
}, { timezone: 'Europe/Madrid' });

// Escapa datos variables antes de interpolarlos en el HTML del panel (anti-XSS).
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// "Hoy" en Europe/Madrid como YYYY-MM-DD. NO usamos toISOString(): el proceso
// corre en UTC en Render y Madrid va +1/+2h, así que entre las 22:00/23:00 y
// medianoche hora local UTC sigue en el día anterior y la fecha se desfasaría.
const FMT_FECHA_MADRID = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit'
});
function fechaMadrid(date) {
  const p = {};
  for (const { type, value } of FMT_FECHA_MADRID.formatToParts(date)) p[type] = value;
  return `${p.year}-${p.month}-${p.day}`;
}
function hoyMadrid() {
  return fechaMadrid(new Date());
}

// "2026-08-12" → "martes 12 de agosto", para la variable {{2}} de la plantilla.
// Se ancla a mediodía UTC: Madrid va +1/+2h, así que nunca cae en el día
// anterior al formatear en zona local.
const FMT_FECHA_LEGIBLE = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid', weekday: 'long', day: 'numeric', month: 'long'
});
function fechaLegible(fecha) {
  return FMT_FECHA_LEGIBLE.format(new Date(`${fecha}T12:00:00Z`));
}

// ---- Vista manual de recordatorios (GET /admin/recordatorios) ----
// Camino paralelo al de Twilio: genera enlaces wa.me para que Vicky mande los
// recordatorios a mano desde el WhatsApp del taller. No toca sendWhatsApp(),
// ni el cron, ni la plantilla de Meta.

// "Mañana" en Europe/Madrid.
//
// OJO — NO se copia el `Date.now() + 24h` del cron. Esa forma solo es segura
// AHÍ porque el cron dispara a las 19:00: desde ese punto, el salto de ±1h del
// cambio de hora no llega a cruzar medianoche. Un handler HTTP se ejecuta a
// cualquier hora del día, así que no hereda esa garantía. Aquí se parte de
// hoyMadrid() anclado a MEDIODÍA UTC: sumar 24h desde ahí cae siempre bien
// dentro del día siguiente, haya cambio de hora o no.
function fechaManana() {
  const base = new Date(`${hoyMadrid()}T12:00:00Z`);
  return fechaMadrid(new Date(base.getTime() + 24 * 60 * 60 * 1000));
}

// Teléfono en formato wa.me ('34XXXXXXXXX'), o null si no es un móvil español
// válido. Misma normalización que sendWhatsApp(), pero aquí un número mal
// metido no puede romper nada: se devuelve null y la fila muestra un aviso.
function telefonoWa(tel) {
  const clean = String(tel ?? '').replace(/[\s\-]/g, '').replace(/^(\+34|34)/, '');
  return /^[67]\d{8}$/.test(clean) ? `34${clean}` : null;
}

// Texto prerrellenado del enlace wa.me. Texto plano, sin plantilla de Meta: lo
// envía Vicky desde su propia conversación, dentro de la ventana de 24h.
//
// DELIBERADO: no se usa contentVar(). Esa función LANZA con cualquier campo
// vacío, y aquí una sola cita mal metida tumbaría la vista entera en vez de
// mostrar una fila incompleta. Fallback a cadena vacía.
//
// `incluirManana` por defecto TRUE para /admin/recordatorios, que solo lista
// citas del día siguiente. El listado general de /admin pasa false: ahí la
// cita puede ser de cualquier fecha y "mañana" sería sencillamente falso.
function textoRecordatorio(cita, incluirManana = true) {
  const nombre = String(cita.nombre ?? '').trim();
  const hora = String(cita.hora ?? '').trim();
  const servicio = String(cita.servicio ?? '').trim();
  const taller = process.env.TALLER_NOMBRE || 'Neumáticos Quesada';
  const cuando = incluirManana ? 'mañana' : 'el';
  return `Hola ${nombre}, te recordamos tu cita en ${taller} ${cuando} `
    + `${fechaLegible(cita.fecha)} a las ${hora} para ${servicio}. `
    + `Si no puedes venir, respóndenos a este mensaje. ¡Gracias!`;
}

// Meta rechaza variables de plantilla vacías, con saltos de línea o con
// series largas de espacios. Fallar aquí, antes de llamar a Twilio, da un
// error legible en el log en vez de un código opaco de Meta a las 19:00.
function contentVar(valor, campo) {
  const v = String(valor ?? '').replace(/\s+/g, ' ').trim();
  if (!v) throw new Error(`Variable de plantilla vacía: ${campo}`);
  return v;
}

// Horario del taller: L-J 08:00-14:00 y 15:30-20:00, V 08:00-16:00, sáb y dom
// cerrado. Devuelve null si la cita cae dentro, o el motivo si no.
//
// OJO: esta función está DUPLICADA a propósito (servidor y cliente).
// Si cambia el horario, hay que tocar las dos, además de
// updateStatus() y el JSON-LD de index.html. Cuatro sitios en total.
// (La copia del cliente está en el <script> de adminHTML.)
//
// Es solo una GUÍA para avisar en el panel: NO se llama desde validarCita()
// ni bloquea nada. Las excepciones (urgencias, favores, un sábado suelto)
// deben poder guardarse sin fricción.
function horarioTaller(fecha, hora) {
  // Formato inválido: no es asunto de esta función, ya lo reporta validarCita.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) return null;

  // Día de la semana en Europe/Madrid, NUNCA getDay() sobre un Date construido
  // a pelo (daría el día en la zona local del navegador o en UTC en Render).
  // Se ancla a mediodía UTC para que el offset de Madrid (+1/+2h) no pueda
  // desplazar el día. Mismo patrón que fechaLegible().
  const dia = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid', weekday: 'short'
  }).format(new Date(`${fecha}T12:00:00Z`));

  if (dia === 'Sat' || dia === 'Sun') {
    return 'Fuera del horario habitual (sáb y dom cerrado)';
  }

  const min = Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
  const tramos = dia === 'Fri'
    ? [[8 * 60, 16 * 60]]                            // V: 08:00-16:00 continuo
    : [[8 * 60, 14 * 60], [15 * 60 + 30, 20 * 60]];  // L-J: mañana y tarde

  // Límites inclusivos: una cita a la hora exacta de cierre no avisa.
  for (const [ini, fin] of tramos) {
    if (min >= ini && min <= fin) return null;
  }
  return 'Fuera del horario habitual (L-J: 8-14 y 15:30-20, V: 8-16)';
}

// Validación de entrada del panel admin (#7). Devuelve el mensaje de error
// del primer campo inválido, o null si todo es correcto.
function validarCita(body) {
  const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
  if (!nombre) return 'El nombre es obligatorio';
  if (nombre.length > 100) return 'El nombre no puede superar los 100 caracteres';

  const tel = typeof body.telefono === 'string'
    ? body.telefono.replace(/[\s\-]/g, '').replace(/^(\+34|34)/, '')
    : '';
  if (!/^[67]\d{8}$/.test(tel)) return 'El teléfono debe ser un móvil español (9 dígitos, empieza por 6 o 7)';

  const fecha = typeof body.fecha === 'string' ? body.fecha : '';
  const fm = fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!fm) return 'La fecha debe tener formato YYYY-MM-DD';
  const y = Number(fm[1]), mo = Number(fm[2]), d = Number(fm[3]);
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) {
    return 'La fecha no existe en el calendario';
  }
  // El atributo min del input es saltable (devtools, curl): manda el servidor.
  // Comparación de cadenas YYYY-MM-DD = comparación cronológica.
  // Hoy mismo se permite: solo se rechaza estrictamente anterior.
  if (fecha < hoyMadrid()) return 'La fecha no puede ser anterior a hoy';

  const hora = typeof body.hora === 'string' ? body.hora : '';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) return 'La hora debe tener formato HH:MM válido';

  if (typeof body.servicio === 'string' && body.servicio.length > 100) {
    return 'El servicio no puede superar los 100 caracteres';
  }

  if (typeof body.detalle === 'string' && body.detalle.length > 100) {
    return 'El detalle no puede superar los 100 caracteres';
  }

  return null;
}

function adminHTML(citas, verTodas = false) {
  const estadoBadge = e =>
    e === 'confirmada' ? 'bg-green-900/50 text-green-400 border border-green-700/50' :
    e === 'cancelada'  ? 'bg-red-900/50 text-red-400 border border-red-700/50' :
    e === 'atendida'   ? 'bg-gray-900/50 text-gray-400 border border-gray-700/50' :
                         'bg-yellow-900/50 text-yellow-400 border border-yellow-700/50';

  const rows = citas.length === 0
    ? '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-500">Sin citas registradas</td></tr>'
    : citas.map(c => {
      const id = escapeHtml(c.id);
      const wa = telefonoWa(c.telefono);
      // Atendida = ya realizada: fila atenuada (como "Ya enviado" en
      // /admin/recordatorios) y solo el nombre tachado — hora, servicio y
      // acciones siguen legibles. No se oculta ni cambia de posición.
      const atendida = c.estado === 'atendida';

      // El POST a /admin/cita/:id/recordatorio (Twilio) devuelve 500 mientras
      // Meta tenga la plantilla bloqueada. Hasta entonces la fila abre wa.me
      // con el texto ya escrito, igual que /admin/recordatorios. El endpoint y
      // sendWhatsApp() siguen ahí, solo dejan de llamarse desde aquí.
      //
      // textoRecordatorio(c, false): este listado incluye citas de cualquier
      // fecha, no solo las de mañana.
      //
      // DOS ESCAPADOS DISTINTOS, no intercambiables: encodeURIComponent SOLO
      // para el valor de ?text= (es una URL), escapeHtml para el resto (HTML).
      const accionWa = wa
        ? `<a href="https://wa.me/${wa}?text=${encodeURIComponent(textoRecordatorio(c, false))}"
              target="_blank" rel="noopener"
              class="text-xs bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-3 py-1.5 rounded-lg transition-colors font-medium whitespace-nowrap">WhatsApp</a>`
        : `<span class="text-xs bg-white/5 text-gray-500 border border-white/10 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap">Sin WhatsApp</span>`;
      return `
      <tr class="border-b border-white/5 hover:bg-white/5 transition-colors${atendida ? ' opacity-50' : ''}">
        <td class="px-4 py-3 text-white font-medium${atendida ? ' line-through' : ''}">${escapeHtml(c.nombre)}</td>
        <td class="px-4 py-3 text-gray-300">${escapeHtml(c.telefono)}</td>
        <td class="px-4 py-3 text-gray-300 whitespace-nowrap">${escapeHtml(c.fecha)} ${escapeHtml(c.hora)}</td>
        <td class="px-4 py-3 text-gray-300">${escapeHtml(c.servicio)}${c.detalle ? `<div class="text-xs text-gray-500 mt-0.5">${escapeHtml(c.detalle)}</div>` : ''}</td>
        <td class="px-4 py-3">
          <span class="px-2 py-1 rounded-full text-xs font-medium ${estadoBadge(c.estado)}">${escapeHtml(c.estado)}</span>
        </td>
        <td class="px-4 py-3 flex items-center gap-2">
          <form method="post" action="/admin/cita/${id}/estado" class="inline">
            <select name="estado" onchange="this.form.submit()" class="text-xs bg-[#060D1F] border border-white/10 text-gray-300 rounded-lg px-2 py-1.5 cursor-pointer focus:outline-none focus:border-[#2563EB]">
              ${c.estado === 'pendiente' ? '<option selected>pendiente</option>' : ''}
              <option ${c.estado === 'confirmada'  ? 'selected' : ''}>confirmada</option>
              <option ${c.estado === 'atendida'    ? 'selected' : ''}>atendida</option>
              <option ${c.estado === 'cancelada'   ? 'selected' : ''}>cancelada</option>
            </select>
          </form>
          ${accionWa}
          <button onclick="eliminarCita('${id}')" class="text-xs bg-red-900/50 hover:bg-red-800/60 text-red-400 border border-red-700/50 px-3 py-1.5 rounded-lg transition-colors font-medium">Eliminar</button>
        </td>
      </tr>`;
    }).join('');

  const taller = escapeHtml(process.env.TALLER_NOMBRE || 'Panel de Citas');
  const hoy = hoyMadrid();   // formato YYYY-MM-DD, seguro para interpolar
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${taller} — Admin</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    /* Los inputs date/time usan controles nativos: sin color-scheme, el
       navegador los dibuja en tema claro (icono oscuro sobre navy = invisible)
       y el desplegable del calendario sale blanco. */
    #nc-fecha, #nc-hora { color-scheme: dark; }
    #nc-fecha::-webkit-calendar-picker-indicator,
    #nc-hora::-webkit-calendar-picker-indicator {
      opacity: .75;
      cursor: pointer;
      transition: opacity .15s;
    }
    #nc-fecha:hover::-webkit-calendar-picker-indicator,
    #nc-hora:hover::-webkit-calendar-picker-indicator { opacity: 1; }
  </style>
</head>
<body class="bg-[#060D1F] min-h-screen p-6 font-sans">
  <div class="max-w-6xl mx-auto">
    <header class="flex items-center justify-between mb-8">
      <div>
        <p class="text-[#FFD700] text-xs font-semibold uppercase tracking-widest mb-1">Panel de administración</p>
        <h1 class="text-2xl font-bold text-white">${taller}</h1>
      </div>
      <div class="flex items-center gap-3">
        <a href="${verTodas ? '/admin' : '/admin?ver=todas'}" class="text-sm text-gray-400 hover:text-white transition-colors">${verTodas ? 'Volver a próximas citas' : 'Ver todas las citas'}</a>
        <a href="/admin/backup" download class="text-sm text-gray-400 hover:text-white transition-colors">Descargar copia de seguridad</a>
        <span class="bg-[#0D1B3E] text-gray-400 text-sm px-4 py-2 rounded-full border border-white/10">${verTodas ? 'Todas' : 'Próximas'}: ${citas.length} cita${citas.length !== 1 ? 's' : ''}</span>
      </div>
    </header>

    <div class="mb-5 flex flex-wrap items-center gap-3">
      <button onclick="toggleNuevaCita()" class="bg-[#FFD700] hover:bg-[#E6C200] text-[#060D1F] text-sm font-bold px-5 py-2.5 rounded-lg transition-colors">+ Nueva cita</button>
      <a href="/admin/recordatorios" class="bg-[#0D1B3E] hover:bg-white/10 text-gray-300 border border-white/10 text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">Recordatorios de mañana</a>
      <div id="nueva-cita-form" class="hidden mt-4 w-full bg-[#0D1B3E] border border-white/10 rounded-xl p-6 max-w-2xl">
        <h2 class="text-base font-semibold text-white mb-5">Nueva cita</h2>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Nombre</label>
            <input id="nc-nombre" type="text" class="w-full bg-[#060D1F] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2563EB]">
          </div>
          <div>
            <label class="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Teléfono</label>
            <input id="nc-telefono" type="tel" class="w-full bg-[#060D1F] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2563EB]">
          </div>
          <div>
            <label class="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Fecha</label>
            <input id="nc-fecha" type="date" min="${hoy}" class="w-full bg-[#060D1F] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2563EB]">
          </div>
          <div>
            <label class="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Hora</label>
            <input id="nc-hora" type="time" class="w-full bg-[#060D1F] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2563EB]">
          </div>
          <p id="nc-horario-aviso" class="hidden col-span-2 -mt-1 text-xs text-amber-400"></p>
          <div class="col-span-2">
            <label class="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Servicio</label>
            <select id="nc-servicio" class="w-full bg-[#060D1F] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2563EB]">
              <option value="">— Selecciona servicio —</option>
              <option value="Pinchazo turismo">Pinchazo turismo</option>
              <option value="Pinchazo furgoneta">Pinchazo furgoneta</option>
              <option value="Pinchazo moto">Pinchazo moto</option>
              <option value="Montaje de neumáticos">Montaje de neumáticos</option>
              <option value="Alineado">Alineado</option>
              <option value="Cruce">Cruce</option>
              <option value="Equilibrado">Equilibrado</option>
              <option value="Válvulas TPMS">Válvulas TPMS</option>
            </select>
          </div>
          <div class="col-span-2">
            <label class="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Detalle (opcional)</label>
            <input id="nc-detalle" type="text" maxlength="100" placeholder="4 ruedas, 205/55 R16" class="w-full bg-[#060D1F] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#2563EB]">
          </div>
        </div>
        <div class="mt-5 flex gap-3">
          <button onclick="guardarNuevaCita()" class="bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">Guardar cita</button>
          <button onclick="toggleNuevaCita()" class="text-sm text-gray-400 hover:text-white px-4 py-2 transition-colors">Cancelar</button>
        </div>
        <p id="nc-error" class="hidden mt-3 text-red-400 text-sm"></p>
      </div>
    </div>

    <div class="bg-[#0D1B3E] rounded-xl overflow-x-auto border border-white/5">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-white/10">
            <th class="px-4 py-3.5 text-left text-xs font-semibold text-[#FFD700] uppercase tracking-wider">Nombre</th>
            <th class="px-4 py-3.5 text-left text-xs font-semibold text-[#FFD700] uppercase tracking-wider">Teléfono</th>
            <th class="px-4 py-3.5 text-left text-xs font-semibold text-[#FFD700] uppercase tracking-wider">Fecha / Hora</th>
            <th class="px-4 py-3.5 text-left text-xs font-semibold text-[#FFD700] uppercase tracking-wider">Servicio</th>
            <th class="px-4 py-3.5 text-left text-xs font-semibold text-[#FFD700] uppercase tracking-wider">Estado</th>
            <th class="px-4 py-3.5 text-left text-xs font-semibold text-[#FFD700] uppercase tracking-wider">Acciones</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>
  <script>
    function toggleNuevaCita() {
      document.getElementById('nueva-cita-form').classList.toggle('hidden');
    }

    // OJO: esta función está DUPLICADA a propósito (servidor y cliente).
    // Si cambia el horario, hay que tocar las dos, además de
    // updateStatus() y el JSON-LD de index.html. Cuatro sitios en total.
    // (La copia del servidor está en server.js, justo antes de validarCita.)
    function horarioTaller(fecha, hora) {
      // Formato inválido: no es asunto de esta función, ya lo valida el servidor.
      if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(fecha)) return null;
      if (!/^([01]\\d|2[0-3]):[0-5]\\d$/.test(hora)) return null;

      // Día de la semana en Europe/Madrid, NUNCA getDay() sobre un Date
      // construido a pelo (daría el día en la zona local del navegador).
      // Anclado a mediodía UTC para que el offset de Madrid no desplace el día.
      var dia = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Madrid', weekday: 'short'
      }).format(new Date(fecha + 'T12:00:00Z'));

      if (dia === 'Sat' || dia === 'Sun') {
        return 'Fuera del horario habitual (sáb y dom cerrado)';
      }

      var min = Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
      var tramos = dia === 'Fri'
        ? [[8 * 60, 16 * 60]]                            // V: 08:00-16:00 continuo
        : [[8 * 60, 14 * 60], [15 * 60 + 30, 20 * 60]];  // L-J: mañana y tarde

      // Límites inclusivos: una cita a la hora exacta de cierre no avisa.
      for (var i = 0; i < tramos.length; i++) {
        if (min >= tramos[i][0] && min <= tramos[i][1]) return null;
      }
      return 'Fuera del horario habitual (L-J: 8-14 y 15:30-20, V: 8-16)';
    }

    // AVISO, NO BLOQUEO: solo pinta texto. Sin alert(), no impide guardar y no
    // se consulta desde guardarNuevaCita(). El horario es una guía.
    function avisoHorario() {
      var aviso = document.getElementById('nc-horario-aviso');
      var fecha = document.getElementById('nc-fecha').value;
      var hora  = document.getElementById('nc-hora').value;
      var motivo = (fecha && hora) ? horarioTaller(fecha, hora) : null;
      if (motivo) {
        aviso.textContent = motivo;
        aviso.classList.remove('hidden');
      } else {
        aviso.classList.add('hidden');
      }
    }
    ['nc-fecha', 'nc-hora'].forEach(function (id) {
      var el = document.getElementById(id);
      el.addEventListener('change', avisoHorario);
      el.addEventListener('input', avisoHorario);   // teclado, no solo el picker
    });

    async function eliminarCita(id) {
      if (!confirm('¿Eliminar esta cita? Esta acción no se puede deshacer.')) return;
      const res = await fetch('/admin/cita/' + id, { method: 'DELETE' });
      if (res.ok) location.reload();
    }
    async function guardarNuevaCita() {
      const nombre   = document.getElementById('nc-nombre').value.trim();
      const telefono = document.getElementById('nc-telefono').value.trim();
      const fecha    = document.getElementById('nc-fecha').value;
      const hora     = document.getElementById('nc-hora').value;
      const servicio = document.getElementById('nc-servicio').value;
      const detalle  = document.getElementById('nc-detalle').value.trim();
      const errEl    = document.getElementById('nc-error');

      if (!nombre || !telefono || !fecha || !hora || !servicio) {
        errEl.textContent = 'Todos los campos son obligatorios.';
        errEl.classList.remove('hidden');
        return;
      }
      errEl.classList.add('hidden');

      const res = await fetch('/admin/cita', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, telefono, fecha, hora, servicio, detalle })
      });

      if (res.ok) {
        location.reload();
      } else {
        errEl.textContent = 'Error al guardar la cita.';
        errEl.classList.remove('hidden');
      }
    }
  </script>
</body>
</html>`;
}

// HTML propio de la vista de recordatorios. NO reutiliza adminHTML: es otra
// tabla, otros botones y nada de formularios de edición. Mismo lenguaje visual
// (fondo #060D1F, tarjetas #0D1B3E, acento #FFD700).
function recordatoriosHTML(citas, fecha) {
  const taller = escapeHtml(process.env.TALLER_NOMBRE || 'Panel de Citas');
  const fechaTxt = escapeHtml(fechaLegible(fecha));

  const cuerpo = citas.length === 0
    ? `<div class="bg-[#0D1B3E] border border-white/10 rounded-xl p-10 text-center">
        <p class="text-white font-medium mb-1">No hay citas confirmadas para mañana</p>
        <p class="text-sm text-gray-500">Nada que recordar el ${fechaTxt}. Solo aparecen las citas confirmadas.</p>
      </div>`
    : citas.map(c => {
      const id = escapeHtml(c.id);
      const enviado = c.recordatorioEnviado === true;
      const wa = telefonoWa(c.telefono);

      // DOS ESCAPADOS DISTINTOS, no intercambiables:
      //  - encodeURIComponent SOLO para el valor de ?text= (es una URL).
      //  - escapeHtml para todo lo demás (es HTML).
      // El href queda seguro dentro del atributo entrecomillado porque
      // encodeURIComponent ya percent-codifica " < > y &; y `wa` viene de
      // telefonoWa(), que solo devuelve dígitos validados por regex.
      const accionWa = wa
        ? `<a href="https://wa.me/${wa}?text=${encodeURIComponent(textoRecordatorio(c))}"
              target="_blank" rel="noopener"
              class="text-sm bg-green-600 hover:bg-green-500 text-white font-semibold px-4 py-2 rounded-lg transition-colors whitespace-nowrap">Enviar por WhatsApp</a>`
        : `<span class="text-sm bg-red-900/50 text-red-400 border border-red-700/50 px-4 py-2 rounded-lg whitespace-nowrap">Teléfono no válido</span>`;

      const botonMarcar = enviado
        ? ''
        : `<button onclick="marcarEnviado('${id}')"
              class="text-sm bg-[#060D1F] hover:bg-white/10 text-gray-300 border border-white/10 px-4 py-2 rounded-lg transition-colors whitespace-nowrap">Marcar enviado</button>`;

      return `
      <div class="bg-[#0D1B3E] border border-white/10 rounded-xl p-5 mb-3 flex flex-col md:flex-row md:items-center gap-4${enviado ? ' opacity-50' : ''}">
        <div class="shrink-0">
          <span class="inline-block bg-[#060D1F] border border-white/10 text-[#FFD700] font-bold px-3 py-1.5 rounded-lg">${escapeHtml(c.hora)}</span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-white font-semibold">
            ${escapeHtml(c.nombre)}
            ${enviado ? '<span class="ml-2 align-middle text-[11px] font-medium uppercase tracking-wide bg-green-900/50 text-green-400 border border-green-700/50 px-2 py-0.5 rounded-full">Ya enviado</span>' : ''}
          </p>
          <p class="text-sm text-gray-300 mt-1">${escapeHtml(c.servicio)}${c.detalle ? ` <span class="text-gray-500">— ${escapeHtml(c.detalle)}</span>` : ''}</p>
          <p class="text-xs text-gray-500 mt-1">${escapeHtml(c.telefono)}</p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          ${accionWa}
          ${botonMarcar}
        </div>
      </div>`;
    }).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${taller} — Recordatorios</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-[#060D1F] min-h-screen p-6 font-sans">
  <div class="max-w-4xl mx-auto">
    <header class="flex flex-wrap items-center justify-between gap-4 mb-8">
      <div>
        <p class="text-[#FFD700] text-xs font-semibold uppercase tracking-widest mb-1">Recordatorios de mañana</p>
        <h1 class="text-2xl font-bold text-white">${fechaTxt}</h1>
      </div>
      <div class="flex items-center gap-3">
        <a href="/admin" class="text-sm text-gray-400 hover:text-white transition-colors">← Volver al panel</a>
        <span class="bg-[#0D1B3E] text-gray-400 text-sm px-4 py-2 rounded-full border border-white/10">${citas.length} cita${citas.length !== 1 ? 's' : ''} confirmada${citas.length !== 1 ? 's' : ''}</span>
      </div>
    </header>

    <p class="text-sm text-gray-500 mb-5">Cada enlace abre WhatsApp con el mensaje ya escrito. Envíalo desde el WhatsApp del taller y pulsa «Marcar enviado».</p>

    ${cuerpo}
  </div>

  <script>
    async function marcarEnviado(id) {
      const res = await fetch('/admin/cita/' + id + '/enviado', { method: 'POST' });
      if (res.ok) location.reload();
      else alert('No se pudo marcar el recordatorio como enviado.');
    }
  </script>
</body>
</html>`;
}

// Cabeceras de seguridad para TODAS las respuestas (#9). Se fijan con
// setHeader antes de cualquier writeHead: nosniff evita el sniffing de
// MIME, DENY impide embeber el panel en iframes, same-origin no filtra
// URLs internas a terceros y HSTS fuerza HTTPS en Render (inocuo en
// local HTTP).
// OJO — no volver a "no-referrer": por el Fetch Standard, esa política
// obliga al navegador a mandar `Origin: null` en peticiones no-CORS con
// método != GET/HEAD (los <form method="post"> del panel), lo que hacía
// que isSameOrigin bloqueara con 403 los propios formularios del admin.
// "same-origin" conserva Origin y Referer reales en same-origin y los
// suprime hacia cualquier otro host.
function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
}

const server = http.createServer(async (req, res) => {
  setSecurityHeaders(res);
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;

  // GET / → sirve index.html
  if (req.method === 'GET' && (p === '/' || p === '/index.html')) {
    const htmlPath = path.join(__dirname, 'index.html');
    if (!fs.existsSync(htmlPath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('index.html no encontrado');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(htmlPath));
    return;
  }

  // Rutas /admin — requieren auth básica
  if (p.startsWith('/admin')) {
    const ip = getClientIp(req);
    if (isBlocked(ip)) {
      res.writeHead(429, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Demasiados intentos. Inténtalo de nuevo más tarde.');
      return;
    }
    if (!checkAuth(req)) {
      const hasCreds = (req.headers['authorization'] || '').startsWith('Basic ');
      // Se loggea IP y timestamp, nunca las credenciales probadas.
      if (hasCreds) {
        console.warn(`[auth] ${new Date().toISOString()} — intento fallido en /admin desde ${ip}`);
        if (registerAuthFail(ip)) {
          console.warn(`[auth] ${new Date().toISOString()} — IP ${ip} bloqueada ${AUTH_BLOCK_MS / 60000} min tras ${AUTH_MAX_FAILS} fallos`);
        }
      }
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Admin"', 'Content-Type': 'text/plain' });
      res.end('Acceso no autorizado');
      return;
    }
    clearAuthFails(ip);

    // Anti-CSRF: POST/DELETE con Origin/Referer ajeno → 403.
    if ((req.method === 'POST' || req.method === 'DELETE') && !isSameOrigin(req)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Origen no permitido' }));
      return;
    }

    // GET /admin/backup — descarga directa de citas.json (bytes crudos, sin
    // parsear: si estuviera corrupto, la copia también sirve para forense).
    if (req.method === 'GET' && p === '/admin/backup') {
      if (!fs.existsSync(CITAS_PATH)) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('No encontrado');
        return;
      }
      try {
        const buf = fs.readFileSync(CITAS_PATH);
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="citas-${hoyMadrid()}.json"`,
          'Content-Length': buf.length,
          'Cache-Control': 'no-store',
        });
        res.end(buf);
      } catch (err) {
        console.error(`[backup] Error al servir citas.json para descarga: ${err.message}`);
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Error interno');
      }
      return;
    }

    // GET /admin/recordatorios — citas confirmadas de mañana con enlaces wa.me
    // listos para enviar a mano. Camino manual: ni Twilio ni plantilla de Meta.
    // Hereda auth y rate-limit del bloque /admin; al ser GET no pasa por
    // isSameOrigin (solo aplica a POST/DELETE).
    if (req.method === 'GET' && p === '/admin/recordatorios') {
      const manana = fechaManana();
      const visibles = readCitas()
        .filter(c => c.fecha === manana && c.estado === 'confirmada')
        .sort((a, b) => String(a.hora).localeCompare(String(b.hora)));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(recordatoriosHTML(visibles, manana));
      return;
    }

    // GET /admin
    if (req.method === 'GET' && p === '/admin') {
      const citas = readCitas();
      const verTodas = url.searchParams.get('ver') === 'todas';
      const hoy = hoyMadrid();
      // Solo visualización: citas.json no se toca. Comparar strings
      // "YYYY-MM-DD HH:MM" equivale a comparar cronológicamente.
      const cmpAsc = (a, b) => `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`);
      // Por defecto: solo de hoy en adelante, la próxima cita arriba.
      // Histórico (?ver=todas): todo el listado, lo más reciente arriba.
      const visibles = verTodas
        ? [...citas].sort((a, b) => cmpAsc(b, a))
        : citas.filter(c => c.fecha >= hoy).sort(cmpAsc);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(adminHTML(visibles, verTodas));
      return;
    }

    // POST /admin/cita — nueva cita con estado confirmada (Vicky ya cerró con el cliente)
    if (req.method === 'POST' && p === '/admin/cita') {
      const body = await parseBody(req);
      if (body === BODY_TOO_LARGE) {
        res.writeHead(413, { 'Content-Type': 'application/json', 'Connection': 'close' });
        res.end(JSON.stringify({ ok: false, error: 'Cuerpo demasiado grande' }));
        return;
      }
      if (!body) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Cuerpo de la petición inválido' }));
        return;
      }
      const errorValidacion = validarCita(body);
      if (errorValidacion) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: errorValidacion }));
        return;
      }
      const cita = {
        id: uuidv4(),
        nombre: body.nombre || '',
        telefono: body.telefono || '',
        fecha: body.fecha || '',
        hora: body.hora || '',
        servicio: body.servicio || '',
        detalle: typeof body.detalle === 'string' ? body.detalle.trim() : '',
        mensaje: '',
        estado: 'confirmada',
        recordatorioEnviado: false,
        creadaEn: new Date().toISOString(),
      };
      const citas = readCitas();
      citas.push(cita);
      writeCitas(citas);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, id: cita.id }));
      return;
    }

    // POST /admin/cita/:id/estado
    const estadoMatch = p.match(/^\/admin\/cita\/([^/]+)\/estado$/);
    if (req.method === 'POST' && estadoMatch) {
      const body = await parseBody(req);
      if (body === BODY_TOO_LARGE) {
        res.writeHead(413, { 'Content-Type': 'application/json', 'Connection': 'close' });
        res.end(JSON.stringify({ ok: false, error: 'Cuerpo demasiado grande' }));
        return;
      }
      if (!body) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Cuerpo de la petición inválido' }));
        return;
      }
      const citas = readCitas();
      const cita = citas.find(c => c.id === estadoMatch[1]);
      if (!cita) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Cita no encontrada' }));
        return;
      }
      const validos = ['pendiente', 'confirmada', 'cancelada', 'atendida'];
      if (!validos.includes(body.estado)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Estado inválido: debe ser pendiente, confirmada, cancelada o atendida' }));
        return;
      }
      cita.estado = body.estado;
      writeCitas(citas);
      res.writeHead(302, { Location: '/admin' });
      res.end();
      return;
    }

    // DELETE /admin/cita/:id
    const deleteMatch = p.match(/^\/admin\/cita\/([^/]+)$/);
    if (req.method === 'DELETE' && deleteMatch) {
      const citas = readCitas();
      const idx = citas.findIndex(c => c.id === deleteMatch[1]);
      if (idx === -1) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Cita no encontrada' }));
        return;
      }
      citas.splice(idx, 1);
      writeCitas(citas);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // POST /admin/cita/:id/enviado — marca el recordatorio como enviado a mano
    // desde la vista /admin/recordatorios. NO llama a Twilio: solo persiste la
    // marca. Dentro del bloque POST/DELETE, así hereda isSameOrigin.
    const enviadoMatch = p.match(/^\/admin\/cita\/([^/]+)\/enviado$/);
    if (req.method === 'POST' && enviadoMatch) {
      // Lectura fresca justo antes de escribir y parcheo de un solo registro
      // (regla del proyecto): nunca se reescribe un array leído antes de tiempo.
      const citas = readCitas();
      const cita = citas.find(c => c.id === enviadoMatch[1]);
      if (!cita) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Cita no encontrada' }));
        return;
      }
      cita.recordatorioEnviado = true;
      writeCitas(citas);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // POST /admin/cita/:id/recordatorio
    const recMatch = p.match(/^\/admin\/cita\/([^/]+)\/recordatorio$/);
    if (req.method === 'POST' && recMatch) {
      const citas = readCitas();
      const cita = citas.find(c => c.id === recMatch[1]);
      if (!cita) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Cita no encontrada' }));
        return;
      }
      try {
        const envio = await sendWhatsApp(cita);
        if (envio?.dryRun) {
          // Sin entrega real no se persiste nada: el test local queda repetible.
          console.log(`[recordatorio][DRY_RUN] ${cita.id}: no se marca recordatorioEnviado`);
        } else {
          // Relectura tras el await: el array de arriba quedó obsoleto durante la
          // llamada a Twilio y escribirlo pisaría cambios concurrentes.
          const actuales = readCitas();
          const target = actuales.find(c => c.id === recMatch[1]);
          if (target) {
            target.recordatorioEnviado = true;
            writeCitas(actuales);
          } else {
            console.warn(`[recordatorio] Cita ${recMatch[1]} ya no existe al persistir; WhatsApp enviado igualmente`);
          }
        }
        res.writeHead(302, { Location: '/admin' });
        res.end();
      } catch (err) {
        console.error(`[recordatorio] Error al enviar WhatsApp para cita ${cita.id}:`, maskPhones(err.message));
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'No se pudo enviar el recordatorio' }));
      }
      return;
    }
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`${process.env.TALLER_NOMBRE || 'Server'} escuchando en puerto ${PORT}`);

  // Sin Twilio configurado la web y el panel siguen siendo plenamente
  // usables (solo cae el envío de recordatorios): se avisa, no se aborta.
  const faltan = [
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_WHATSAPP_FROM',
    'TWILIO_CONTENT_SID',
    'TALLER_TELEFONO',   // alimenta la variable {{5}}: contentVar() lanza si falta
  ].filter(k => !process.env[k]);
  if (faltan.length) {
    console.warn(`[twilio] Variables sin configurar: ${faltan.join(', ')}. Los recordatorios de WhatsApp fallarán hasta que se definan.`);
  }

  // Misma filosofía que el aviso de Twilio: se avisa, no se aborta.
  if (process.env.GITHUB_BACKUP_ENABLED === 'true' &&
      (!process.env.GITHUB_BACKUP_TOKEN || !process.env.GITHUB_BACKUP_REPO)) {
    console.warn('[backup-remoto] GITHUB_BACKUP_ENABLED=true pero falta GITHUB_BACKUP_TOKEN o GITHUB_BACKUP_REPO; la subida diaria a GitHub no funcionará.');
  }

  // Backup de arranque: cubre huecos si el proceso estaba caído a las 03:00.
  // Solo si aún no existe el archivo del día — un redeploy posterior no debe
  // pisar el backup bueno de la madrugada con un estado más reciente.
  if (!fs.existsSync(path.join(BACKUP_DIR, `citas-${hoyMadrid()}.json`))) {
    backupCitas();
  }
});
