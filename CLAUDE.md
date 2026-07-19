# CLAUDE.md — Neumáticos Quesada

## Proyecto
Web + sistema de citas con recordatorio WhatsApp para taller de neumáticos en Mislata, Valencia.

## Stack
- Frontend: index.html único, Tailwind CDN, Inter + Barlow Condensed (Google Fonts, títulos) + Font Awesome 6.5
- Backend: Node.js + http nativo (sin frameworks)
- Datos: citas.json (array JSON), config.json (configuración del taller)
- WhatsApp: Twilio API
- Scheduler: node-cron
- Dependencias npm: dotenv ^16.4.5, node-cron ^3.0.3, twilio ^5.3.0, uuid ^9.0.1
- Deploy: Render (Railway descartado — conflicto con Twilio)

## Colores del tema
- q-blue: #2563EB
- q-blue-d: #1D4ED8
- q-blue-pale: #EFF6FF
- q-yellow: #FFD700
- q-yellow-d: #E6C200
- q-navy: #060D1F
- q-navy-2: #0D1B3E
- q-cream: #F4F6F9 (neutro frío; antes crema cálido #F5F0E8)

## Estructura de archivos
proyecto/
├── index.html        ← web pública (completa)
├── server.js         ← backend Node.js (completo)
├── citas.json        ← se crea automáticamente al registrar la primera cita
├── config.json       ← no creado, no usado en el código actual
├── imagenes/         ← favicons nq2f (5), logos de marca .svg (7 — `logo-dunlop.svg` y `logo-pirelli.svg` saneados: sin fondos "horneados", el detalle interior vuelve como transparencia real evenodd/máscara, imprescindible para el filtro monocromo del marquee), `logo_quesada_navy.png` (logo de empresa para header+footer, transparente y sin pastilla blanca, sobre fondo navy), fotos del taller (audi/benelli/honda/jeep/michelin-taller.jpeg), taller-fachada.jpeg (fallback hero), rueda-scroll.png (rueda-progreso, verificado: carga en producción). `logo-empresa.jpg` sigue en la carpeta pero **ya no se referencia** (huérfano tras adoptar logo_quesada_navy.png). `og-image.jpg` (1200×630, preview social Open Graph — ver sección propia)
├── videos/           ← hero-quesada.mp4, hero-quesada-movil.mp4, hero-poster.jpg, hero-poster-movil.jpg (ver sección Hero — vídeo de fondo)
├── .env              ← credenciales (nunca al repo)
└── package.json

> Nota: `taller-interior.jpeg` y `Horario.jpeg` (fotos reales del taller) se archivaron fuera del repo en `..\Quesada-archivo\` — posible uso futuro en revisión visual o slider antes/después.

## Frontend — Secciones de index.html (en orden)

| id        | Fondo     | Descripción                                                  |
|-----------|-----------|--------------------------------------------------------------|
| #inicio   | q-navy    | Hero cinematic split-screen — vídeo de fondo (ver sección propia); fallback estático `taller-fachada.jpeg` |
| —         | q-navy-2  | Marquee infinito de marcas                                   |
| #nosotros | q-cream   | Bento grid "Sobre nosotros" + stats (4.9★, 245+ reseñas, 30+ años) |
| #servicios| q-navy    | Bento grid — 5 servicios: 2×2 (Reparación, Alineación, Montaje, Equilibrado) + card ancha "Válvulas TPMS y codificadas" (badge NUEVO); hover: translateY(-4px) + border-left q-yellow |
| —         | q-navy-2  | CTA banner "Tu seguridad empieza por las ruedas"             |
| #galeria  | q-cream   | Galería 2×2 del taller                                       |
| #resenas  | q-navy    | Tres reseñas reales de Google (Manu BR, Juan Padilla, I. Fuertes) |
| #contacto | q-navy    | Info de contacto + horario + live status + mapa embebido     |
| —         | #040916   | Footer                                                       |

## Frontend — Funcionalidades JS

- **Botón flotante WhatsApp** (`#wa-float`): enlace directo wa.me, esquina inferior derecha, animación de entrada.
- **Live status taller** (`#status-pill`): muestra "Abierto/Cerrado" según horario real (L–J 8–14/15:30–20, V 8–16 continuo). Se actualiza cada minuto.
- **Contadores animados** (`#nosotros` stats): `IntersectionObserver` + `requestAnimationFrame`, easing cúbico, se activan una sola vez al entrar en viewport.
- **Scroll reveal** (`.will-reveal`): animación blur-in + translate al entrar en viewport.
- **Nav activa**: Servicios | Nosotros | Taller | Reserva | Contacto (desktop y menú móvil).
- **Animaciones GSAP + ScrollTrigger**: hero con clip-reveal, marquee a velocidad constante (loop GSAP fijo; 16s móvil / 32s desktop), tipografía cinética en Servicios. Micro-interacciones: botones magnéticos, tilt 3D en tarjetas de servicio (**solo puntero fino/hover real — ver "Fix táctil"**), odómetro en contadores de stats, input matrícula estilizado. (Rueda-progreso de scroll documentada aparte — ver sección propia.)

## Frontend — Detalles de maquetación
- **Grid de servicios**: 5 servicios — 4 cards a `md:col-span-6` (simétrico 2×2) + 1 card ancha a `md:col-span-12` (Válvulas TPMS). El 2×2 antes era 7/5/5/7.
- **Títulos de servicio (h3)**: `font-bold` + `tracking-wide`. Antes `font-black` sin tracking.
- **Títulos h3 de servicio**: unificados a `text-2xl` en las 4 cards. Antes mezcla `text-2xl`/`text-xl` heredada del grid asimétrico 7/5/5/7 anterior.
- **Icono de Montaje**: `fa-crosshairs` (Font Awesome). Antes SVG custom.
- **`.svc-card`**: `border-left` visible en reposo (rgba amarillo .5), intensificado en hover.
- **Brillo especular en `.svc-card`** (sigue al cursor): pseudo-elemento `::after` (`inset:0`, `pointer-events:none`) con `radial-gradient(circle 320px at var(--mx,50%) var(--my,50%), rgba(255,255,255,.08), rgba(255,215,0,.04) 40%, transparent 70%)` — blanco con matiz q-yellow sutil. `opacity:0`→`1` solo en `:hover` (`transition opacity .3s`). Las vars `--mx`/`--my` se fijan en px desde el **mismo** handler `mousemove` del tilt 3D (líneas ~1854-1855), sin listener duplicado.
- **#nosotros**: la columna derecha (texto + stats) usa `justify-center` en vez de `flex-1` en la text-card, para eliminar espacio muerto.
- **Fondo de secciones claras** (`#nosotros`, `#galeria`): `q-cream` pasó de crema cálido `#F5F0E8` a neutro frío `#F4F6F9`, para armonizar con el navy y los logos monocromos.
- **Marquee monocromo** (`.marquee-logo`): logos a `height:36px`, `filter: brightness(0) invert(1)` (blanco puro), `opacity .55 → 1` en hover, sin cajas ni fondos. El marquee ya **no** pausa al hover (solo sube la opacidad el logo bajo el cursor).
- **Logo de empresa** (header + footer): `logo_quesada_navy.png`, transparente y sin pastilla blanca, sobre fondo navy. Sustituye al antiguo `logo-empresa.jpg` (ahora huérfano).
- **SVGs de marca saneados**: `logo-dunlop.svg` y `logo-pirelli.svg` reexportados sin fondos "horneados"; el detalle interior vuelve como transparencia real (evenodd/máscara), necesario para que el filtro monocromo del marquee no muestre cajas.
- **Hero — titular**: "Especialistas en neumáticos." (blanco) / "Y todo lo que les rodea." (itálica q-yellow), con máscara y reveal por línea (`.hero-mask` / `.hero-line`). Antes era otro copy.
- **Tipografía cinética** (`.kinetic-text`, fondo de Servicios): trazo `-webkit-text-stroke: 1px rgba(255,255,255,.13)` con relleno de fallback `rgba(255,255,255,.08)` — presencia real pero discreta. Scrub GSAP solo en desktop (`min-width:768px`).
- **CTAs de servicio**: las 4 cards unificadas a "Solicitar servicio →". Antes Alineación y Montaje decían solo "Solicitar →".
- **Card "Válvulas TPMS y codificadas"** (5.º servicio): `md:col-span-12`, layout horizontal en desktop (`md:flex-row md:items-center`, icono | texto | CTA a la derecha) y apilada en móvil. Icono `fa-gauge-high`, badge "NUEVO" (pastilla `bg-q-yellow` texto navy, `text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5`). Reusa `.svc-card` / `.bento-shine` / gradiente `from-[#0e1f42] to-[#060D1F]` / `will-reveal` literales → hereda tilt, brillo, neutralización táctil y reveal sin JS extra. **La tipografía cinética de fondo NO la incluye (decisión deliberada, no un olvido).**
- **Fix táctil `.svc-card`**: tilt/brillo se registran solo bajo `matchMedia('(hover:hover) and (pointer:fine)')` (+ `innerWidth>=768`); CSS `@media (hover:none)` neutraliza los `:hover` (transform/box-shadow/`::after` a 0; `border-left` con `!important` para vencer al del hover original). Motivo: en táctil el primer tap disparaba hover+tilt, desplazaba el enlace y no navegaba.
- **Kickers de sección**: patrón unificado por alineación — centrados (Servicios/Galería/Contacto/Reseñas) llevan raya `w-5 h-px` a ambos lados del texto; alineados a la izquierda (Hero/Nosotros) llevan raya solo a la izquierda. Reseñas se corrigió a este patrón (antes `<p>` plano sin rayas).
- **Footer**: enlace "Ver en Google Maps" eliminado de la barra inferior (colisionaba con `#wa-float`, ambos en la esquina inferior derecha); la barra queda solo con el copyright. El enlace sigue en la columna "General" → "Reseñas en Google" (misma URL `g.co/kgs/uhA6gAq`) y en la tarjeta de `#contacto`.
- **`#resenas` h2**: "4.9 sobre 5 *en Google.*" ("en Google." en itálica q-yellow, mismo patrón que el CTA "¿Listo para ponerte *en marcha?*"). Sustituye a "Reseñas reales"; se eliminó el subtítulo con icono G + "Reseñas verificadas de Google" por redundante.

## Favicon
- Set completo en `imagenes/`: `nq2f-favicon.ico`, `nq2f-16.png`, `nq2f-32.png`, `nq2f-192.png`, `nq2f-apple-touch-icon.png`.
- Declarado en `<head>` con 5 `<link>` (icon .ico `sizes="any"`, icon png 16/32/192, apple-touch-icon).

## Open Graph / Meta social (`<head>`)
- Bloque de metas OG + Twitter Card tras `<meta name="description">`: `og:type=website`, `og:site_name`, `og:title`, `og:description`, `og:url` (`https://salassamu-a11y.github.io/Quesada/`), `og:image` (URL **absoluta** a `imagenes/og-image.jpg`), `og:image:width=1200` / `og:image:height=630`, `og:locale=es_ES`; `twitter:card=summary_large_image`.
- **Asset** `imagenes/og-image.jpg` (1200×630): composición fachada + marca con el contenido centrado en la **zona segura cuadrada**, para sobrevivir al recorte cuadrado que aplica WhatsApp al preview (la imagen se recompuso expresamente por esto).

## Hero — vídeo de fondo (#inicio)
`.hero-img-wrap` (dentro de `#inicio`) contiene `<video id="hero-video">` + `<img class="hero-fallback-img">` (fallback estático `taller-fachada.jpeg`, no se borra del proyecto).

- **Selección de vídeo**: script inline justo tras el `<video>`, se ejecuta una sola vez al cargar (no reacciona a resize/rotación). Decide según `matchMedia('(max-width: 767px)')`: móvil → `videos/hero-quesada-movil.mp4` + poster `hero-poster-movil.jpg`; desktop → `videos/hero-quesada.mp4` + poster `hero-poster.jpg`.
- **Solo MP4**: se probó WebM + `canPlayType` pero Safari devuelve "maybe" para vp9 y falla en reproducción real (pantalla en blanco) — se sirve siempre MP4, asignado directo a `video.src` (sin `<source>` hijos; los `.webm` se retiraron del proyecto).
- **Fix autoplay iOS/Safari**: `video.muted = true` como propiedad (además del atributo `muted`), más `video.play()` con `.catch()` vacío tras `video.load()`.
- **`prefers-reduced-motion`**: el script hace return temprano (no fija src/poster, cero descarga de red); CSS oculta `.hero-video` y muestra `.hero-fallback-img`.
- **Sticky en móvil** (`max-width:767px`): `#inicio` pasa a `display:block` y `.hero-img-wrap` a `position:sticky; top:0; height:100svh` (fallback `100vh`) + `margin-bottom:-100svh`, para que el vídeo quede fijo a pantalla completa mientras el contenido del hero desliza por encima. Desktop no se toca (sigue `absolute inset-0 lg:left-[42%]`).
- Animación GSAP de entrada (zoom-out clip-reveal) aplica sobre `.hero-img-wrap video, .hero-img-wrap img` por igual.
- **Specs de los assets** (por si hay que regenerarlos, p. ej. con clips reales del taller): desktop 16:9 1600×900, móvil 9:16 720×1280 (recorte en ancho + bandas desenfocadas del propio vídeo), 15.3s en loop sin costura, montados a partir de 6 clips de stock.

## Rueda-progreso de scroll (#wheel-progress)
Botón "volver arriba" fijo (inferior izquierda) con forma de rueda de neumático realista.
- **Elemento visual**: `<img id="wheel-rotor" src="imagenes/rueda-scroll.png">` (no SVG dibujado — imagen real de rueda), `border-radius:50%`, `drop-shadow` base.
- **Overlay estático** (`#wheel-overlay`, SVG encima del img, `pointer-events:none`): arco de brillo especular fijo (no rota, simula luz de entorno) + aro de progreso `#wheel-ring` que se rellena con el scroll de la página (via `ScrollTrigger`, stroke-dashoffset).
- **Física de rotación — velocidad + fricción** (no ligada 1:1 a la posición de scroll): cada delta de scroll inyecta velocidad angular (`WHEEL_SPIN_FACTOR = 0.13`); loop `requestAnimationFrame` permanente aplica `rotation += angularVel` con fricción `*0.95` y corta a 0 bajo umbral 0.01 (evita repaints en reposo). Resultado: gira rápido con scroll rápido y decelera suave al parar, nunca en seco.
- **Efecto sobrecalentamiento por fricción**: variable `heat` (0→1) calculada cada frame (`heat += |angularVel| * HEAT_GAIN`, cap 1, `heat *= HEAT_DECAY` de enfriamiento continuo). Constantes calibradas: `HEAT_GAIN = 0.0005`, `HEAT_DECAY = 0.985`.
  - Visual: `#wheel-rotor` añade un segundo `drop-shadow` rojo-naranja que crece con `heat` (blur 0→14px, verde 140→60); `#wheel-heat` (div radial-gradient rojo-naranja detrás del img, `inset:15%`) simula el disco de freno incandescente entre los radios, `opacity = heat * 0.85`.
  - Umbral `heat < 0.03 → 0`, limpia estilos una sola vez al enfriar (flag `heatApplied`, evita repaints).
- **`prefers-reduced-motion`**: rueda estática, sin inercia ni efecto de calor.

## Modelo de cita (citas.json)
```json
{
  "id": "uuid",
  "nombre": "",
  "telefono": "",
  "fecha": "YYYY-MM-DD",
  "hora": "HH:MM",
  "servicio": "",
  "mensaje": "",
  "estado": "pendiente|confirmada|cancelada",
  "recordatorioEnviado": false,
  "creadaEn": "ISO timestamp"
}
```

## Endpoints server.js
| Método | Ruta                              | Descripción                                    |
|--------|-----------------------------------|------------------------------------------------|
| GET    | /admin                            | Panel HTML con tabla de citas (auth básica)    |
| POST   | /admin/cita/:id/estado            | Cambia estado (pendiente/confirmada/cancelada) |
| POST   | /admin/cita/:id/recordatorio      | Envía WhatsApp manual y marca recordatorioEnviado=true |
| POST   | /admin/cita                       | Crea cita nueva desde el panel admin con estado=confirmada directamente (auth básica) |
| DELETE | /admin/cita/:id                   | Borra la cita por id (splice). 404 si no existe; `{ok:true}` si borra |

## Variables de entorno (.env)
```
PORT=3001
ADMIN_USER=
ADMIN_PASS=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
TALLER_TELEFONO=
TALLER_NOMBRE=Neumáticos Quesada
```

## Cron job
- Hora: 19:00 cada día (`'0 19 * * *'`) → el recordatorio se envía a las 19:00 del día anterior a la cita
- Filtra: estado=confirmada, fecha=mañana, recordatorioEnviado=false
- Acción: envía WhatsApp y marca recordatorioEnviado=true

## Estado actual
| Área          | Estado | Notas                                                  |
|---------------|--------|--------------------------------------------------------|
| index.html    | ✅     | Completo — favicon nq2f, WA flotante                    |
| server.js     | ✅     | Completo — todos los endpoints implementados           |
| citas.json    | ⚠️     | Se crea al guardar la primera cita                     |
| config.json   | ❌     | No creado, no referenciado en el código                |
| Twilio        | ⚠️     | Cuenta pendiente de crear; credenciales vacías en .env |
| Deploy Render | ❌     | Pendiente (Railway descartado — conflicto con Twilio)  |

## WhatsApp — Aclaración operativa
- El WhatsApp Business actual del taller sigue gestionado manualmente por Vicky (sin cambios).
- Número Twilio **nuevo pendiente de compra**, exclusivo para envío de recordatorios automáticos — no sustituye el canal de atención al cliente existente.

## Reglas
- Claude Code nunca ejecuta curl ni llamadas reales a Twilio para debuggear
- Leer siempre citas.json con fs.readFileSync antes de escribir (evitar race conditions)
- El panel /admin usa auth básica HTTP nativa (sin librerías)
- Puerto: process.env.PORT || 3001
- Nunca añadir patrones globales de assets (*.png, *.jpg, etc.) al .gitignore: los favicons PNG estuvieron rotos en producción por un *.png heredado.
- Vídeo en web: siempre MP4 asignado directo a `video.src` — nunca `<source>` hijos ni confiar en `canPlayType` (Safari devuelve 'maybe' para WebM/vp9 y falla en reproducción real).
