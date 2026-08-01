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

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

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
  fs.writeFileSync(tmp, JSON.stringify(citas, null, 2));
  fs.renameSync(tmp, CITAS_PATH);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      const ct = req.headers['content-type'] || '';
      if (ct.includes('application/x-www-form-urlencoded')) {
        const params = new URLSearchParams(raw);
        const obj = {};
        for (const [k, v] of params) obj[k] = v;
        resolve(obj);
      } else {
        try { resolve(JSON.parse(raw)); } catch { resolve({}); }
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

async function sendWhatsApp(telefono, mensaje) {
  const clean = telefono.replace(/[\s\-]/g, '').replace(/^(\+34|34)/, '');
  return twilioClient.messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM,
    to: `whatsapp:+34${clean}`,
    body: mensaje,
  });
}

function buildReminderText(cita) {
  const taller = process.env.TALLER_NOMBRE || 'el taller';
  return `Hola ${cita.nombre} 👋 Soy el asistente de ${taller}. Te recordamos que tienes cita el ${cita.fecha} a las ${cita.hora} para ${cita.servicio}. ¡Te esperamos!`;
}

// Recordatorios automáticos diarios a las 19:00
cron.schedule('0 19 * * *', async () => {
  const citas = readCitas();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const pendientes = citas.filter(c =>
    c.estado === 'confirmada' &&
    c.fecha === tomorrowStr &&
    !c.recordatorioEnviado
  );

  for (const cita of pendientes) {
    try {
      await sendWhatsApp(cita.telefono, buildReminderText(cita));
      cita.recordatorioEnviado = true;
    } catch (err) {
      console.error(`Error recordatorio ${cita.id}:`, err.message);
    }
  }

  if (pendientes.length > 0) writeCitas(citas);
  console.log(`[cron] Recordatorios enviados: ${pendientes.length}`);
}, { timezone: 'Europe/Madrid' });

function adminHTML(citas) {
  const estadoBadge = e =>
    e === 'confirmada' ? 'bg-green-900/50 text-green-400 border border-green-700/50' :
    e === 'cancelada'  ? 'bg-red-900/50 text-red-400 border border-red-700/50' :
                         'bg-yellow-900/50 text-yellow-400 border border-yellow-700/50';

  const rows = citas.length === 0
    ? '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-500">Sin citas registradas</td></tr>'
    : citas.map(c => `
      <tr class="border-b border-white/5 hover:bg-white/5 transition-colors">
        <td class="px-4 py-3 text-white font-medium">${c.nombre}</td>
        <td class="px-4 py-3 text-gray-300">${c.telefono}</td>
        <td class="px-4 py-3 text-gray-300 whitespace-nowrap">${c.fecha} ${c.hora}</td>
        <td class="px-4 py-3 text-gray-300">${c.servicio}</td>
        <td class="px-4 py-3">
          <span class="px-2 py-1 rounded-full text-xs font-medium ${estadoBadge(c.estado)}">${c.estado}</span>
        </td>
        <td class="px-4 py-3 flex items-center gap-2">
          <form method="post" action="/admin/cita/${c.id}/estado" class="inline">
            <select name="estado" onchange="this.form.submit()" class="text-xs bg-[#060D1F] border border-white/10 text-gray-300 rounded-lg px-2 py-1.5 cursor-pointer focus:outline-none focus:border-[#2563EB]">
              <option ${c.estado === 'pendiente'   ? 'selected' : ''}>pendiente</option>
              <option ${c.estado === 'confirmada'  ? 'selected' : ''}>confirmada</option>
              <option ${c.estado === 'cancelada'   ? 'selected' : ''}>cancelada</option>
            </select>
          </form>
          <form method="post" action="/admin/cita/${c.id}/recordatorio" class="inline">
            <button class="text-xs bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-3 py-1.5 rounded-lg transition-colors font-medium">WhatsApp</button>
          </form>
          <button onclick="eliminarCita('${c.id}')" class="text-xs bg-red-900/50 hover:bg-red-800/60 text-red-400 border border-red-700/50 px-3 py-1.5 rounded-lg transition-colors font-medium">Eliminar</button>
        </td>
      </tr>`).join('');

  const taller = process.env.TALLER_NOMBRE || 'Panel de Citas';
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${taller} — Admin</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-[#060D1F] min-h-screen p-6 font-sans">
  <div class="max-w-6xl mx-auto">
    <header class="flex items-center justify-between mb-8">
      <div>
        <p class="text-[#FFD700] text-xs font-semibold uppercase tracking-widest mb-1">Panel de administración</p>
        <h1 class="text-2xl font-bold text-white">${taller}</h1>
      </div>
      <span class="bg-[#0D1B3E] text-gray-400 text-sm px-4 py-2 rounded-full border border-white/10">${citas.length} cita${citas.length !== 1 ? 's' : ''}</span>
    </header>

    <div class="mb-5">
      <button onclick="toggleNuevaCita()" class="bg-[#FFD700] hover:bg-[#E6C200] text-[#060D1F] text-sm font-bold px-5 py-2.5 rounded-lg transition-colors">+ Nueva cita</button>
      <div id="nueva-cita-form" class="hidden mt-4 bg-[#0D1B3E] border border-white/10 rounded-xl p-6 max-w-2xl">
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
            <input id="nc-fecha" type="date" class="w-full bg-[#060D1F] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2563EB]">
          </div>
          <div>
            <label class="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Hora</label>
            <input id="nc-hora" type="time" class="w-full bg-[#060D1F] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2563EB]">
          </div>
          <div class="col-span-2">
            <label class="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Servicio</label>
            <select id="nc-servicio" class="w-full bg-[#060D1F] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#2563EB]">
              <option value="">— Selecciona servicio —</option>
              <option value="Reparación de neumáticos">Reparación de neumáticos</option>
              <option value="Alineación y geometría">Alineación y geometría</option>
              <option value="Montaje de neumáticos">Montaje de neumáticos</option>
              <option value="Equilibrado de ruedas">Equilibrado de ruedas</option>
            </select>
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
        body: JSON.stringify({ nombre, telefono, fecha, hora, servicio })
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

const server = http.createServer(async (req, res) => {
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

    // GET /admin
    if (req.method === 'GET' && p === '/admin') {
      const citas = readCitas();
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(adminHTML(citas));
      return;
    }

    // POST /admin/cita — nueva cita con estado confirmada (Vicky ya cerró con el cliente)
    if (req.method === 'POST' && p === '/admin/cita') {
      const body = await parseBody(req);
      const cita = {
        id: uuidv4(),
        nombre: body.nombre || '',
        telefono: body.telefono || '',
        fecha: body.fecha || '',
        hora: body.hora || '',
        servicio: body.servicio || '',
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
      const citas = readCitas();
      const cita = citas.find(c => c.id === estadoMatch[1]);
      if (!cita) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Cita no encontrada' }));
        return;
      }
      const validos = ['pendiente', 'confirmada', 'cancelada'];
      if (validos.includes(body.estado)) cita.estado = body.estado;
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
        await sendWhatsApp(cita.telefono, buildReminderText(cita));
        cita.recordatorioEnviado = true;
        writeCitas(citas);
        res.writeHead(302, { Location: '/admin' });
        res.end();
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
      return;
    }
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`${process.env.TALLER_NOMBRE || 'Server'} escuchando en puerto ${PORT}`);
});
