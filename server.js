require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const twilio = require('twilio');
const cron = require('node-cron');

const PORT = process.env.PORT || 3001;
const CITAS_FILE = path.join(__dirname, 'citas.json');

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

function readCitas() {
  if (!fs.existsSync(CITAS_FILE)) return [];
  return JSON.parse(fs.readFileSync(CITAS_FILE, 'utf8'));
}

function writeCitas(citas) {
  fs.writeFileSync(CITAS_FILE, JSON.stringify(citas, null, 2));
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

function checkAuth(req) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Basic ')) return false;
  const [user, pass] = Buffer.from(header.slice(6), 'base64').toString().split(':');
  return user === process.env.ADMIN_USER && pass === process.env.ADMIN_PASS;
}

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
  return `Hola ${cita.nombre}, te recordamos tu cita en ${taller} el ${cita.fecha} a las ${cita.hora} para: ${cita.servicio}. ¡Te esperamos!`;
}

// Recordatorios automáticos diarios a las 10:00
cron.schedule('0 10 * * *', async () => {
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
});

function adminHTML(citas) {
  const estadoBadge = e =>
    e === 'confirmada' ? 'bg-green-100 text-green-800' :
    e === 'cancelada'  ? 'bg-red-100 text-red-800' :
                         'bg-yellow-100 text-yellow-800';

  const rows = citas.length === 0
    ? '<tr><td colspan="6" class="p-4 text-center text-gray-400">Sin citas registradas</td></tr>'
    : citas.map(c => `
      <tr class="border-b hover:bg-gray-50">
        <td class="p-3">${c.nombre}</td>
        <td class="p-3">${c.telefono}</td>
        <td class="p-3 whitespace-nowrap">${c.fecha} ${c.hora}</td>
        <td class="p-3">${c.servicio}</td>
        <td class="p-3">
          <span class="px-2 py-1 rounded text-xs font-medium ${estadoBadge(c.estado)}">${c.estado}</span>
        </td>
        <td class="p-3 space-x-1">
          <form method="post" action="/admin/cita/${c.id}/estado" class="inline">
            <select name="estado" onchange="this.form.submit()" class="text-xs border rounded px-1 py-1">
              <option ${c.estado === 'pendiente'   ? 'selected' : ''}>pendiente</option>
              <option ${c.estado === 'confirmada'  ? 'selected' : ''}>confirmada</option>
              <option ${c.estado === 'cancelada'   ? 'selected' : ''}>cancelada</option>
            </select>
          </form>
          <form method="post" action="/admin/cita/${c.id}/recordatorio" class="inline">
            <button class="text-xs bg-blue-700 text-white px-2 py-1 rounded hover:bg-blue-800">WhatsApp</button>
          </form>
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
<body class="bg-gray-100 min-h-screen p-6">
  <div class="max-w-5xl mx-auto">
    <h1 class="text-2xl font-bold text-blue-900 mb-6">${taller} — Citas (${citas.length})</h1>
    <div class="mb-4">
      <button onclick="toggleNuevaCita()" class="bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-2 rounded-lg">+ Nueva cita</button>
      <div id="nueva-cita-form" class="hidden mt-3 bg-white rounded-lg shadow p-5 max-w-2xl">
        <h2 class="text-base font-semibold text-gray-800 mb-4">Nueva cita</h2>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs text-gray-500 mb-1">Nombre</label>
            <input id="nc-nombre" type="text" class="w-full border rounded px-3 py-2 text-sm">
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">Teléfono</label>
            <input id="nc-telefono" type="tel" class="w-full border rounded px-3 py-2 text-sm">
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">Fecha</label>
            <input id="nc-fecha" type="date" class="w-full border rounded px-3 py-2 text-sm">
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">Hora</label>
            <input id="nc-hora" type="time" class="w-full border rounded px-3 py-2 text-sm">
          </div>
          <div class="col-span-2">
            <label class="block text-xs text-gray-500 mb-1">Servicio</label>
            <select id="nc-servicio" class="w-full border rounded px-3 py-2 text-sm">
              <option value="">— Selecciona servicio —</option>
              <option value="Reparación de neumáticos">Reparación de neumáticos</option>
              <option value="Alineación y geometría">Alineación y geometría</option>
              <option value="Montaje de neumáticos">Montaje de neumáticos</option>
              <option value="Equilibrado de ruedas">Equilibrado de ruedas</option>
            </select>
          </div>
        </div>
        <div class="mt-4 flex gap-2">
          <button onclick="guardarNuevaCita()" class="bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-2 rounded">Guardar cita</button>
          <button onclick="toggleNuevaCita()" class="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">Cancelar</button>
        </div>
        <p id="nc-error" class="hidden mt-2 text-red-600 text-sm"></p>
      </div>
    </div>
    <div class="bg-white rounded-lg shadow overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 text-gray-600 uppercase text-xs">
          <tr>
            <th class="p-3 text-left">Nombre</th>
            <th class="p-3 text-left">Teléfono</th>
            <th class="p-3 text-left">Fecha / Hora</th>
            <th class="p-3 text-left">Servicio</th>
            <th class="p-3 text-left">Estado</th>
            <th class="p-3 text-left">Acciones</th>
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

  // POST /cita
  if (req.method === 'POST' && p === '/cita') {
    const body = await parseBody(req);
    const cita = {
      id: uuidv4(),
      nombre: body.nombre || '',
      telefono: body.telefono || '',
      fecha: body.fecha || '',
      hora: body.hora || '',
      servicio: body.servicio || '',
      mensaje: body.mensaje || '',
      estado: 'pendiente',
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

  // Rutas /admin — requieren auth básica
  if (p.startsWith('/admin')) {
    if (!checkAuth(req)) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Admin"', 'Content-Type': 'text/plain' });
      res.end('Acceso no autorizado');
      return;
    }

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
