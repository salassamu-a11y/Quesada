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
├── privacidad.html   ← política de privacidad (noindex, ver "Páginas legales")
├── aviso-legal.html  ← aviso legal (noindex, ver "Páginas legales")
├── server.js         ← backend Node.js (completo)
├── citas.json        ← se crea automáticamente al registrar la primera cita
├── config.json       ← no creado, no usado en el código actual
├── imagenes/         ← favicons nq2f (5), logos de marca .svg (7 — `logo-dunlop.svg` y `logo-pirelli.svg` saneados: sin fondos "horneados", el detalle interior vuelve como transparencia real evenodd/máscara, imprescindible para el filtro monocromo del marquee), `logo_quesada_navy.png` (logo de empresa para header+footer, transparente y sin pastilla blanca, sobre fondo navy), fotos del taller (audi/benelli/honda/jeep/michelin-taller.jpeg), taller-fachada.jpeg (fallback hero), rueda-scroll.png (rueda-progreso, verificado: carga en producción). `logo-empresa.jpg` sigue en la carpeta pero **ya no se referencia** (huérfano tras adoptar logo_quesada_navy.png). `og-image.jpg` (1200×630, preview social Open Graph — ver sección propia)
├── videos/           ← hero-quesada.mp4, hero-quesada-movil.mp4, hero-poster.jpg, hero-poster-movil.jpg (ver sección Hero — vídeo de fondo)
├── .env              ← credenciales (nunca al repo)
├── CNAME             ← dominio propio para GitHub Pages: neumaticosquesada.com
├── robots.txt        ← raíz del repo, servido por GitHub Pages (ver "SEO técnico")
├── sitemap.xml       ← raíz del repo, una sola URL (ver "SEO técnico")
└── package.json

> Nota: `taller-interior.jpeg` y `Horario.jpeg` (fotos reales del taller) se archivaron fuera del repo en `..\Quesada-archivo\` — posible uso futuro en revisión visual o slider antes/después.

## Frontend — Secciones de index.html (en orden)

| id        | Fondo     | Descripción                                                  |
|-----------|-----------|--------------------------------------------------------------|
| #inicio   | q-navy    | Hero cinematic split-screen — vídeo de fondo (ver sección propia); fallback estático `taller-fachada.jpeg` |
| —         | q-navy-2  | Marquee infinito de marcas                                   |
| #nosotros | q-cream   | Bento grid "Sobre nosotros" + stats (4.9★, 290+ reseñas, 48+ años) |
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
- **Scroll reveal** (`.will-reveal`): animación blur-in + translate al entrar en viewport. Revela **una sola vez** y hace `unobserve` del elemento; se eliminó la rama de des-reveal. Aplica a toda la página, no solo a `#servicios`.
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
- **Antigüedad y reseñas (datos corregidos)**: fundación **1978** (antes figuraba 1994), copy "casi 50 años" (antes "más de 30"); contadores de stats a **48+ años** y **290+ reseñas** (stats de `#nosotros` y kicker del hero). El JSON-LD usa el mismo `foundingDate` 1978.
- **Rueda-progreso en móvil** (`#wheel-progress`, `<768px`): oculta por completo (`.js-anim #wheel-progress { display:none }`) y el JS de física/ScrollTrigger corta con `return` temprano bajo el mismo breakpoint — cero coste de física ni listeners en móvil. Antes solo se encogía (46px) a `≤640px`.
- **Botón flotante WhatsApp diferido en móvil** (`<768px`): permanece oculto (clase `.wa-defer`) hasta que el hero (`#inicio`) sale del viewport, vía `IntersectionObserver`; entonces gana `.wa-show` (fade + slide-up). Sin JS conserva la animación de entrada original. Además más compacto en móvil (icono 26px, padding reducido).
- **Cards de servicio compactas en móvil**: `min-h-[280px]` de la card de Reparación pasa a solo-desktop (`md:min-h-[280px]`); márgenes internos (icono→título, CTA) reducidos en móvil (`mb-4`/`mt-4` vs `mb-6`/`mt-6` desktop); card TPMS con `gap-4` en móvil vs `gap-6` desktop.
- **Hero en móvil**: padding inferior del contenido reducido (`pb-10` vs `pb-20` desktop).
- **CTA banner "Tu seguridad..."**: overlay adicional `bg-q-navy-2/60` solo en móvil (`md:hidden`) para mejorar el contraste del texto sobre la foto de fondo.
- **`#contacto` — tarjetas teléfono/email**: grid pasa de 2 columnas fijas a 1 columna en móvil (`grid-cols-1 md:grid-cols-2`); email usa `break-words` en vez de `break-all` (evita cortes agresivos en pantallas anchas).
- **`#resenas`**: `scroll-mt-20` en móvil para que el ancla de navegación no quede tapada por el header fijo (`md:scroll-mt-0` en desktop, sin header fijo que lo requiera).

## Cierre por vacaciones (index.html + páginas legales)
Aviso de cierre temporal controlado por un único objeto de configuración, sin backend.

- **Objeto `VACACIONES`** (cabecera del script principal, ~línea 1822): `{activo, desde, hasta, textoCorto, textoLargo, fechaVuelta}`. Rango actual **2026-08-08 → 2026-08-31** (inclusivo), `fechaVuelta: '1 de septiembre'`.
- **`enVacaciones()`**: obtiene "hoy" con `Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Madrid'})` y compara **strings `YYYY-MM-DD`**, nunca objetos `Date`. Motivo: el visitante puede estar en otra zona horaria; comparando fechas locales del navegador el aviso saldría un día antes/después según el país. Mismo patrón que `hoyMadrid()` en server.js.
- **Tres puntos de aviso**, todos condicionados por `enVacaciones()`:
  1. **Banner `#vac-banner`**: `<div>` al inicio del `<body>`, `fixed top-0 inset-x-0 z-[60]` (por encima del header, que va a `z-50`), fondo `q-yellow` sobre texto navy. Oculto por defecto (`style="display:none"` en el HTML) y mostrado por JS — sin JS no aparece nada roto.
  2. **Corte previo en `updateStatus()`** (`#status-pill`): sale antes del cálculo horario reutilizando el estilo "cerrado" existente (punto rojo, `ping` a opacidad 0) con `VACACIONES.textoCorto`.
  3. **Reescritura del `?text=` de los enlaces `wa.me`**: recorre `a[href^="https://wa.me/"]` y antepone `"Sé que estáis de vacaciones hasta el <fechaVuelta>. "` al texto prerrellenado, vía `new URL()` + `searchParams.set` (href malformado → `try/catch` que lo deja intacto).
- **Compensación de altura (`vacBannerH`)**: el banner desplaza todo hacia abajo, así que `aplicarAltura()` mide `b.offsetHeight` y ajusta `hdr.style.top`, el `padding-top` de `#inicio` y el offset del smooth-scroll de anclas. **Se remide con `ResizeObserver`** sobre el banner (fallback: listener de `resize`): medir `offsetHeight` una sola vez falla porque las fuentes web cambian el alto del texto al cargar y el banner puede pasar de una a dos líneas.
- **DUPLICADO EN TRES ARCHIVOS**: el objeto `VACACIONES` vive literal en `index.html`, `privacidad.html` y `aviso-legal.html`. **Cambiar las fechas obliga a tocar los tres.**
- **Desactivación**: poner `activo: false` — o simplemente dejar que el rango expire (`enVacaciones()` devuelve `false` fuera de `desde`–`hasta`). **No borrar el bloque**: se reutiliza en el siguiente cierre cambiando las fechas.

## Páginas legales
`privacidad.html` y `aviso-legal.html` en la raíz del repo, enlazadas desde la columna "General" del footer de **las tres páginas** (index incluida).

- **`noindex, follow`** en ambas: son páginas obligatorias por ley, no contenido a posicionar. Por eso **NO están en `sitemap.xml`** (una sola URL sigue siendo lo correcto).
- **Duplican un subconjunto de index.html**: head común, ~110 líneas de CSS (header, menú móvil, nav, `btn-yellow`, `wa-btn`), banner de vacaciones, header, footer y un script corto. **SIN** GSAP, sin `.js-anim`, sin scroll reveal, sin `updateStatus()`, sin `#wa-float`, sin smooth scroll y sin JSON-LD.
- **Por qué no un CSS compartido**: dos páginas que se tocarán una vez al año no justifican una dependencia de red adicional. La duplicación es deliberada.
- **Responsable del tratamiento**: NEUCERGON, S.L., CIF **B75730085**. Contacto: **963 593 087** y **neucergon@hotmail.com**.
- **Dirección — dos formas, no confundirlas**:
  - Forma **NAP** `C/ del Cardenal Benlloch, 67, bajo` → web, JSON-LD y páginas legales (debe coincidir literalmente con la ficha de Google).
  - Forma **fiscal** del censal `Calle Cardenal Benlloch 67, Planta B` → **solo** para trámites regulatorios (p. ej. el bundle de Twilio). Nunca en la web.

## Teléfono del taller en index.html
- **963 593 087** — fijo del taller, verificado en WhatsApp Business (mismo número para llamadas y WhatsApp).
- **Aparece LITERAL en 12 sitios**, en tres formatos distintos según el uso:

| Formato | Dónde | Nº de apariciones |
|---------|-------|-------------------|
| `34963593087` (prefijo, sin `+` ni espacios) | `href="https://wa.me/34963593087?text=..."` — header desktop, menú móvil, `#contacto`, `#wa-float` | 4 |
| `+34963593087` | `telephone` del JSON-LD del `<head>` | 1 |
| `963593087` (sin prefijo ni espacios) | `href="tel:963593087"` — header, menú móvil, CTA banner, `#contacto` (2×), footer | 6 |
| `963 593 087` (texto visible, agrupado 3-3-3) | texto de los enlaces `tel:` + **`<meta name="description">`** del `<head>` | — |

- **Si el taller cambia de número, hay que revisar TODOS**: los 4 `wa.me`, los 6 `tel:`, la meta description y el `telephone` del JSON-LD. No hay una única fuente de verdad. (`WA_NUMBER` y `waOpen()` se eliminaron de index.html — ya no cuentan.)
- **DELIBERADO: el número no se inyecta por JS.** Los CTA de WhatsApp deben funcionar aunque el JS falle o no llegue a ejecutarse; un `href` construido en runtime dejaría los 4 botones muertos ante cualquier error de script. La duplicación es el precio de esa garantía.
- **No confundir con Twilio**: el número que enviará los recordatorios automáticos es **distinto** (número Twilio pendiente de compra) y se configura aparte, en variables de entorno del backend.

## Favicon
- Set completo en `imagenes/`: `nq2f-favicon.ico`, `nq2f-16.png`, `nq2f-32.png`, `nq2f-192.png`, `nq2f-apple-touch-icon.png`.
- Declarado en `<head>` con 5 `<link>` (icon .ico `sizes="any"`, icon png 16/32/192, apple-touch-icon).

## Open Graph / Meta social (`<head>`)
- `<link rel="canonical" href="https://neumaticosquesada.com/">` justo tras `<meta name="description">`.
- Bloque de metas OG + Twitter Card: `og:type=website`, `og:site_name`, `og:title`, `og:description`, `og:url` (`https://neumaticosquesada.com/`), `og:image` (URL **absoluta** a `https://neumaticosquesada.com/imagenes/og-image.jpg`), `og:image:width=1200` / `og:image:height=630`, `og:locale=es_ES`; `twitter:card=summary_large_image`. Antes apuntaban a `salassamu-a11y.github.io/Quesada/` (subdominio de GitHub Pages); ahora usan el dominio propio, declarado también en `CNAME`.
- **Asset** `imagenes/og-image.jpg` (1200×630): composición fachada + marca con el contenido centrado en la **zona segura cuadrada**, para sobrevivir al recorte cuadrado que aplica WhatsApp al preview (la imagen se recompuso expresamente por esto).

## SEO técnico

### JSON-LD schema.org (index.html)
- Bloque `<script type="application/ld+json">` al **final del `<head>`** de index.html (~líneas 880-983), tipo **`AutoRepair`**, con `@id: https://neumaticosquesada.com/#business`.
- **Contenido**: `name`, `url`, `telephone` (`+34963593087`), `image` (og-image), `logo`, `foundingDate` 1978, `priceRange`, `address`, `geo` (39.473826, -0.421161), `openingHoursSpecification`, `sameAs`, `areaServed` y `hasOfferCatalog` con los 5 servicios.
- **Dirección — coherencia NAP**: `C/ del Cardenal Benlloch, 67, bajo`, en **forma castellana**, exactamente la misma que la ficha de Google. Los datos Name-Address-Phone deben coincidir literalmente entre web, JSON-LD y ficha; una variante ortográfica distinta se lee como otro negocio.
- **`openingHoursSpecification`: CUATRO entradas**, no dos:
  1. L–J mañana `08:00–14:00`
  2. L–J tarde `15:30–20:00`
  3. V continuo `08:00–16:00`
  4. Sábado + domingo `00:00–00:00`
  El fin de semana se declara cerrado **EXPLÍCITAMENTE**: en schema.org omitir un día no significa "cerrado", significa "sin datos" — y Google podría rellenarlo desde otras fuentes.
- **DELIBERADO: sin `aggregateRating` ni `review`.** Google penaliza el marcado de reseñas auto-declaradas sobre el propio negocio; las estrellas de los resultados de búsqueda vienen del Google Business Profile, no del JSON-LD.
- **Si cambia el horario de la web, hay que actualizar TAMBIÉN el JSON-LD**: el horario vive en **CUATRO sitios** sin sincronización automática — JSON-LD, `updateStatus()` (index.html), `horarioTaller()` (server.js) y su copia literal en el `<script>` del panel (ver "Aviso de horario en el panel").
- **VERIFICADO en producción** con `search.google.com/test/rich-results`: 2 elementos válidos (Empresas locales + Organización), sin errores.

### robots.txt y sitemap.xml
- Ambos en la **raíz del repo**, servidos directamente por GitHub Pages.
- El sitemap tiene **una sola URL**: es una web de página única y **las anclas (`#servicios`, `#contacto`…) NO son URLs** — no se listan.
- `lastmod` es **fijo**: conviene actualizarlo a mano cuando cambie el contenido de la home.

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
  "detalle": "",
  "mensaje": "",
  "estado": "pendiente|confirmada|cancelada",
  "recordatorioEnviado": false,
  "creadaEn": "ISO timestamp"
}
```

- **`detalle`**: string **opcional**, máximo 100 caracteres. Para lo que Vicky anota en la agenda de papel (medida del neumático, tipo de vehículo). Las citas anteriores **no lo tienen**: el código tolera `undefined` en todas partes (listado, plantilla de WhatsApp).

## Endpoints server.js
| Método | Ruta                              | Descripción                                    |
|--------|-----------------------------------|------------------------------------------------|
| GET    | /admin                            | Panel HTML con tabla de citas (auth básica). Por defecto solo citas con fecha >= hoy en ascendente; `?ver=todas` → histórico completo en descendente (ver "Panel /admin — vista de citas") |
| POST   | /admin/cita/:id/estado            | Cambia estado (pendiente/confirmada/cancelada). 400 si body inválido o estado no válido; 404 si la cita no existe |
| POST   | /admin/cita/:id/recordatorio      | Envía WhatsApp manual y marca recordatorioEnviado=true. 404 si no existe; 500 con mensaje genérico si Twilio falla (detalle solo en log, teléfonos enmascarados) |
| POST   | /admin/cita                       | Crea cita nueva desde el panel admin con estado=confirmada directamente (auth básica). 400 si body inválido o falla `validarCita` (mensaje del campo concreto) |
| DELETE | /admin/cita/:id                   | Borra la cita por id (splice). 404 si no existe; `{ok:true}` si borra |

Respuestas de error comunes a todas las rutas `/admin`:
- **401** sin/con credenciales incorrectas (auth básica)
- **429** IP bloqueada por rate-limit (5 fallos de auth en 15 min → 15 min de bloqueo)
- **403** POST/DELETE que falla el anti-CSRF (`Sec-Fetch-Site` cross-site, `Origin`/`Referer` que no coincide con el host, o `Origin: null`)
- **413** body > 10 KB (rutas POST con `parseBody`)

## Panel /admin — vista de citas (server.js)
- **Vista por defecto ("Próximas")**: `GET /admin` filtra `c.fecha >= hoyMadrid()` y ordena por fecha y hora **ascendente** (la próxima cita arriba). **Solo filtro de visualización**: `citas.json` no se toca.
- **Vista histórico**: `GET /admin?ver=todas` — listado completo en **descendente** (lo más reciente arriba).
- **Orden por comparación de strings**: `` `${fecha} ${hora}`.localeCompare(...) `` — comparar `YYYY-MM-DD HH:MM` como texto equivale a comparar cronológicamente.
- **Cabecera**: enlace que alterna "Ver todas las citas" ↔ "Volver a próximas citas"; el contador etiqueta la vista activa ("Próximas: N citas" / "Todas: N citas").
- **Desplegable de estado**: ofrece solo `confirmada` y `cancelada`; `pendiente` aparece únicamente si la cita ya está en ese estado. La validación del servidor (`POST /admin/cita/:id/estado`) sigue aceptando los tres.

## Servicios del panel (desglose operativo)
- **8 opciones en el desplegable** del formulario de nueva cita: Pinchazo turismo, Pinchazo furgoneta, Pinchazo moto, Montaje de neumáticos, Alineado, Cruce, Equilibrado, Válvulas TPMS. **Sustituyen a las 5 anteriores.**
- **NO tocan la web pública**: `#servicios` de index.html sigue con las **5 categorías comerciales** (Reparación, Alineación, Montaje, Equilibrado, TPMS). El desplegable del panel es el **desglose operativo interno**, otra cosa distinta — no hay que sincronizarlos.
- **Citas antiguas sin migrar**: conservan sus servicios originales ("Reparación de neumáticos", "Alineación y geometría"…). Son **datos históricos** y el listado los muestra tal cual. Deliberado: no se migró nada.
- **Detalle en el listado**: va **bajo el servicio, en la misma celda**, en gris y tamaño menor. Sin detalle no se muestra nada (ni etiqueta ni línea vacía).

## Aviso de horario en el panel (horarioTaller)
- **`horarioTaller(fecha, hora)`** (server.js ~línea 357): devuelve `null` si la cita cae dentro del horario del taller, o el motivo (string) si no. L–J 8–14 y 15:30–20, V 8–16, sáb y dom cerrado. Límites **inclusivos** (una cita a la hora exacta de cierre no avisa). Formato inválido → `null` (eso ya lo reporta `validarCita`).
- **Día de la semana en `Europe/Madrid`**: `Intl.DateTimeFormat` con `weekday`, anclado a `T12:00:00Z` (mediodía UTC) para que el offset de Madrid no desplace el día — nunca `getDay()` sobre un `Date` construido a pelo.
- **Es AVISO, NO BLOQUEO**: no se llama desde `validarCita` ni impide guardar — las excepciones (urgencias, un sábado suelto) deben poder guardarse. En el formulario del panel el aviso sale en `#nc-horario-aviso` (texto ámbar) al cambiar fecha u hora (listeners `change` + `input`).
- **DUPLICADA A PROPÓSITO**: copia literal de la función en el `<script>` de `adminHTML` (cliente), además de la del servidor. Con `updateStatus()` y el JSON-LD de index.html, **el horario vive en CUATRO sitios** — si cambia el horario del taller hay que tocar los cuatro.

## Persistencia y resiliencia (server.js) — sesión A
- **Fix race condition en recordatorios**: tanto el cron como el envío manual (`POST /admin/cita/:id/recordatorio`) releen `citas.json` (`readCitas()`) justo antes de marcar `recordatorioEnviado=true`, en vez de reusar el array leído al principio del barrido — el array inicial queda obsoleto tras cada `await` a Twilio si el panel crea/borra/edita citas mientras tanto. Si la cita ya no existe al persistir, se loggea y se omite en vez de reescribirla.
- **`DATA_DIR` configurable**: `const DATA_DIR = process.env.DATA_DIR || __dirname`; `citas.json` vive en `DATA_DIR/citas.json`. **CRÍTICO para Render**: hay que configurar `DATA_DIR` apuntando al disco persistente (p. ej. `/var/data`), porque el filesystem del servicio es efímero y sin ello las citas se pierden en cada deploy/reinicio. En local no hace falta (fallback `__dirname`).
- **`readCitas` a prueba de corrupción**: si `citas.json` no parsea, lo renombra a `citas.json.corrupt-<timestamp>` (preserva el archivo para forense) y devuelve `[]` — evita el bucle de reinicios por JSON corrupto.
- **`writeCitas` atómico**: escribe a `citas.json.tmp` y luego `fs.renameSync` al destino — nunca queda un citas.json a medio escribir si el proceso muere.
- **Handlers globales de proceso**: `unhandledRejection` → loggea y sigue vivo (una rejection suelta es local a una petición, no tira la web pública); `uncaughtException` → loggea el stack y `process.exit(1)` para que Render reinicie limpio.

## Seguridad — panel /admin (server.js)
- **Auth básica en tiempo constante**: `checkAuth` compara usuario/contraseña hasheando ambos lados con SHA-256 y comparando con `crypto.timingSafeEqual` (`safeEqual`), evita timing attacks y filtrar la longitud real de las credenciales.
- **Rate-limit de intentos por IP**: 5 fallos en 15 min → bloqueo de 15 min (`AUTH_MAX_FAILS`/`AUTH_WINDOW_MS`/`AUTH_BLOCK_MS`, respuesta 429 mientras dure). Estado en memoria (`Map`, se pierde al reiniciar el proceso), con barrido horario que purga entradas expiradas. IP real vía `getClientIp` (primer valor de `x-forwarded-for` — fiable solo detrás del proxy de Render; fallback `remoteAddress` en local).
- **Log de intentos fallidos**: IP + timestamp en `console.warn`, nunca las credenciales probadas.
- **Anti-CSRF en tres niveles** (`isSameOrigin`, toda petición POST/DELETE bajo `/admin`): 1) `Sec-Fetch-Site` si el navegador la manda (inmune a la referrer policy) — solo `same-origin`/`none` pasan; 2) si no, `Origin` (o `Referer` de reserva) debe coincidir con el host propio, y el literal `"null"` (iframe sandbox, `file://`, redirect cross-origin) se rechaza explícitamente; 3) sin ninguna de las tres cabeceras (curl, herramientas API) se permite. Petición cross-origin desde navegador → 403.
- **Anti-XSS en el panel**: `escapeHtml` escapa todo dato variable (`nombre`, `telefono`, `fecha`, `hora`, `servicio`, `estado`, `id`, `TALLER_NOMBRE`) antes de interpolarlo en `adminHTML`.
- **Validación de entrada** (`validarCita`, `POST /admin/cita`): nombre obligatorio (≤100 car.), teléfono móvil español (`^[67]\d{8}` tras limpiar prefijo/espacios/guiones), fecha `YYYY-MM-DD` con calendario real **y no anterior a hoy** (`hoyMadrid()`, hoy sí se permite), hora `HH:MM` válida, servicio ≤100 car., `detalle` **opcional** ≤100 car. — primer campo inválido → 400 con mensaje específico. `POST /admin/cita/:id/estado` valida que el estado sea `pendiente|confirmada|cancelada` → 400 si no.
- **`hoyMadrid()`**: "hoy" en zona `Europe/Madrid` vía `Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Madrid', ...})`, no `toISOString()` — el proceso corre en UTC en Render y entre las 22–24h hora local `toISOString()` seguiría en el día anterior, desfasando la validación de fecha mínima. El input `type="date"` del panel (`nc-fecha`) lleva `min="${hoy}"` en el HTML, pero es saltable (devtools/curl) — la validación real la hace el servidor.
- **Inputs `date`/`time` del panel en tema oscuro**: `#nc-fecha`/`#nc-hora` llevan `color-scheme: dark` (si no, el navegador los dibuja en tema claro — icono invisible sobre fondo navy y desplegable de calendario blanco) + estilo del icono `::-webkit-calendar-picker-indicator` (opacity .75→1 en hover).
- **`parseBody` estricto**: JSON que no sea un objeto (array, primitivo, inválido) resuelve `null` → 400 "Cuerpo de la petición inválido", en vez de `{}` silencioso.
- **Tope de tamaño de body**: `MAX_BODY_BYTES = 10 KB`; si se supera, `parseBody` resuelve el sentinel `BODY_TOO_LARGE` y el caller responde 413.
- **Errores genéricos al cliente**: `POST /admin/cita/:id/recordatorio` ya no devuelve `err.message` de Twilio en la respuesta (mensaje genérico "No se pudo enviar el recordatorio"); el detalle real se loggea en servidor con `maskPhones()`.
- **Teléfonos enmascarados en logs**: `maskPhones()` sustituye cualquier número de teléfono en un texto de log por `***XX` (últimos 2 dígitos), aplicado a los errores de Twilio (cron y envío manual) antes de loggear.
- **Cabeceras de seguridad** (`setSecurityHeaders`, todas las respuestas): `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, `Strict-Transport-Security: max-age=31536000; includeSubDomains`. **OJO — no volver a `no-referrer`**: por el Fetch Standard obliga al navegador a mandar `Origin: null` en peticiones no-CORS con método != GET/HEAD (los `<form method="post">` del panel), lo que hacía que `isSameOrigin` bloqueara con 403 los propios formularios del admin. `same-origin` conserva Origin/Referer reales en same-origin y los suprime hacia cualquier otro host.
- **Panel — servicios y detalle**: el select de servicio del formulario "nueva cita" (`POST /admin/cita`) pasa a **8 opciones operativas** y se añade el campo libre `detalle` (ver "Servicios del panel"). `escapeHtml` también se aplica a `detalle` antes de interpolarlo en `adminHTML`.

## Variables de entorno (.env)
```
PORT=3001
DATA_DIR=          # opcional en local; en Render OBLIGATORIO → ruta del disco persistente (p. ej. /var/data)
ADMIN_USER=
ADMIN_PASS=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
TWILIO_CONTENT_SID=        # Content SID de la plantilla aprobada en Meta
TWILIO_DRY_RUN=            # true → simula el envío sin llamar a Twilio (logs enmascarados)
TALLER_TELEFONO=
TALLER_NOMBRE=Neumáticos Quesada
```

## Backend en producción (Render)
- **URL del servicio**: `https://neumaticos-quesada.onrender.com`
- **Panel admin**: `https://neumaticos-quesada.onrender.com/admin` — este es el acceso real de Vicky, sustituye a `localhost:3001/admin` (que queda solo para desarrollo).
- **Plan Starter**, región **Frankfurt (EU Central)**, **auto-deploy desde `main`**: cada push a `main` redespliega automáticamente.
- **Disco persistente de 1 GB montado en `/data`**, con `DATA_DIR=/data` en variables de entorno. **VERIFICADO**: las citas sobreviven a los redeploys.
- **Variables de entorno configuradas en el dashboard de Render** (no en `.env`): `DATA_DIR`, `ADMIN_USER`, `ADMIN_PASS` (contraseña fuerte, ya **no** `quesada123`), `TALLER_NOMBRE`, `TALLER_TELEFONO`. Las `TWILIO_*` están **pendientes** de crear la cuenta.
- **`PORT` lo inyecta Render automáticamente** — no configurarlo a mano.

## Cron job
- Hora: 19:00 cada día (`'0 19 * * *'`, timezone `Europe/Madrid` fijado explícitamente en `cron.schedule`) → el recordatorio se envía a las 19:00 del día anterior a la cita
- Filtra: estado=confirmada, fecha=mañana, recordatorioEnviado=false
- Acción: envía WhatsApp y marca recordatorioEnviado=true
- **Fecha de "mañana" en Madrid**: `fechaMadrid(new Date(Date.now() + 24*60*60*1000))`, no `toISOString()` (mismo motivo que `hoyMadrid()`: el proceso corre en UTC). Válido porque el cron dispara a las 19:00 — si se mueve a última hora de la noche hay que recalcular.

## WhatsApp — envío por plantilla Meta (server.js)
- **Sin texto libre**: `sendWhatsApp(cita)` envía siempre vía `contentSid` (Content Template Builder de Twilio/Meta) + `contentVariables` — no existe fallback a body suelto, porque fuera de la ventana de 24h Meta lo rechaza.
- **Variables de la plantilla**: `{{1}}` nombre, `{{2}}` fecha legible (`fechaLegible()`, ej. "martes, 12 de agosto"), `{{3}}` hora, `{{4}}` **servicio + detalle** concatenados con `" — "` (sin detalle, solo el servicio), `{{5}}` `TALLER_TELEFONO`. `contentVar()` valida cada una (colapsa espacios, `trim()`) y lanza si queda vacía — falla en el log a las 19:00 en vez de un error opaco de Meta. **El orden de las 5 variables debe coincidir exactamente con la plantilla aprobada en Meta.** Cambiarlo obliga a repetir el ciclo de aprobación entero. Si no coinciden, el mensaje sale con los datos cruzados y no hay error — solo un cliente confundido.
- **SIGUEN SIENDO EXACTAMENTE 5 VARIABLES.** El detalle se concatenó dentro de `{{4}}` precisamente para no añadir una sexta: cambiar el número de variables obliga a repetir el **ciclo de aprobación de Meta entero**.
- **Longitud**: peor caso ~**203 caracteres**, muy por debajo del límite de **1024** de Meta. No hace falta truncar.
- **Cliente Twilio perezoso**: `getTwilioClient()` instancia y cachea en el primer envío, ya no al cargar el módulo — credenciales ausentes/erróneas ya no tumban el servidor entero (incluido `/admin`) al arrancar, solo el envío de recordatorios.
- **Modo simulación** (`TWILIO_DRY_RUN=true`): `sendWhatsApp` no llama a Twilio, solo loggea el payload enmascarado (`maskPhones`) y devuelve `{sid:'DRYRUN', dryRun:true}`. Ni el cron ni el envío manual marcan `recordatorioEnviado` en dry-run (repetible en local).
- **Aviso al arrancar**: `server.listen` comprueba `TWILIO_ACCOUNT_SID/AUTH_TOKEN/WHATSAPP_FROM/CONTENT_SID/TALLER_TELEFONO` y avisa por `console.warn` si falta alguna — no aborta, la web y el panel siguen operativos sin Twilio.

## Verificación local del envío de WhatsApp
Con `TWILIO_DRY_RUN=true` en .env y `$env:PORT=3005; node server.js`:
1. Arranque: warn de variables sin configurar, el servidor NO muere
2. Recordatorio manual desde el panel → log `[whatsapp][DRY_RUN] payload:` con teléfonos enmascarados
3. `recordatorioEnviado` sigue en `false` en citas.json (test repetible)
4. Cita con un campo vacío → 500 genérico + log `Variable de plantilla vacía: <campo>`

Los .env cambian solo al reiniciar el proceso: Ctrl+C y volver a arrancar.

## Prueba de concurrencia (verificada)
Carga real contra `POST /admin/cita` en local con **autocannon**, para validar el patrón de persistencia bajo escrituras simultáneas.

- **Aislar los datos**: `$env:DATA_DIR` apuntando a una **carpeta temporal**. Nunca contra Render ni contra el `citas.json` de desarrollo.
- **Body en archivo** con `-i body.json`. **OJO — generarlo con `[IO.File]::WriteAllText`, NO con `Out-File -Encoding utf8`**: PowerShell añade BOM, `parseBody` devuelve `null` y todas las peticiones fallan con un 400 silencioso que parece un problema del servidor.
- **Pasar el JSON inline con `-b` tampoco funciona**: autocannon interpreta mal las barras de escape y falla con "Invalid URL".
- **Auth básica**: cabecera `Authorization` con las credenciales del `.env` **LOCAL**, no las de Render.
- **RESULTADO**: 20 conexiones simultáneas, 50 peticiones → **50 citas con 50 ids únicos**, sin pérdidas ni JSON corrupto. `writeCitas` atómico y el patrón de persistencia validados bajo carga.

## Estado actual
| Área          | Estado | Notas                                                  |
|---------------|--------|--------------------------------------------------------|
| index.html    | ✅     | Completo — favicon nq2f, WA flotante                    |
| server.js     | ✅     | Completo — todos los endpoints implementados           |
| citas.json    | ⚠️     | Se crea al guardar la primera cita                     |
| config.json   | ❌     | No creado, no referenciado en el código                |
| Twilio        | ⚠️     | Bundle regulatorio **APROBADO** (12/08/2026). Bloqueado ahora por **falta de inventario de números españoles** en Twilio — ver "Twilio — estado del bundle y del número" |
| Deploy Render | ✅     | En producción — plan Starter, Frankfurt, disco 1 GB en /data, auto-deploy desde main (ver sección propia) |
| Enlaces wa.me | ✅     | Los 4 apuntan ya al fijo del taller (34963593087), no al número personal — ver "Teléfono del taller en index.html" |
| Vacaciones    | ✅     | Aviso activo 2026-08-08 → 2026-08-31 (banner + pill + texto wa.me) — ver sección propia |
| SEO técnico   | ✅     | JSON-LD AutoRepair + robots.txt + sitemap.xml en producción, validados en Rich Results Test — ver sección propia |
| Concurrencia  | ✅     | Probada con autocannon: 50 citas / 20 conexiones, sin pérdidas — ver sección propia |

## WhatsApp — Aclaración operativa
- El WhatsApp Business actual del taller sigue gestionado manualmente por Vicky (sin cambios).
- Número Twilio **nuevo pendiente de compra**, exclusivo para envío de recordatorios automáticos — no sustituye el canal de atención al cliente existente.

## Twilio — estado del bundle y del número
- **Bundle regulatorio APROBADO el 12/08/2026**
  - SID: `BU0ffed7d91ff7a2d5cdf61554fa058b56`
  - Nombre: `Neumaticos Quesada - ES Mobile`
  - Tipo: **Mobile** · End user: Business (NEUCERGON, S.L.)
- **Address SID validado**: `AD29705a0c0d287badd5a2a096d3b272e3`
- **BLOQUEADO: no hay inventario de números españoles** en la consola de Twilio (búsqueda sin filtros → 0 resultados). **Ticket de solicitud de número exclusivo enviado el 17/08/2026**, esperando respuesta.
- **Alternativa si Twilio no responde**: **SIM prepago española** a nombre del taller. Meta solo necesita recibir el OTP **una vez**; el número **no tiene por qué ser de Twilio**. Requiere estar físicamente con la SIM → **no se puede hacer hasta que el taller reabra el 1 de septiembre**.
- **OJO — el bundle es específico por tipo de número**: si finalmente se compra un número **Local (fijo)** en vez de Mobile, hará falta un **bundle NUEVO de tipo Local**. Misma documentación, y ya se sabe que se aprueba.
- **Un fijo sirve igual como remitente de WhatsApp**: Meta verifica por OTP y admite **llamada de voz**, no solo SMS.

## Deuda técnica
- **Google Search Console: pendiente.** El SEO técnico de la web está hecho, pero falta verificar la propiedad y dar de alta el sitemap. **Bloqueado por acceso a la cuenta de Google del negocio.**
- **Google Business Profile: ficha SIN RECLAMAR** (verificado). 295 reseñas, 4,9★. Es la **palanca de mayor impacto** para posicionar en "neumáticos Mislata" — más que cualquier cambio en la web. Requiere la cuenta de Google del negocio y verificación **por postal o vídeo presencial**.
- Status callback de Twilio: el SID devuelto significa "aceptado", no "entregado". Saber si el cliente recibió el recordatorio requiere un webhook de status. Pendiente, no bloquea la entrega.
- **Doble toque en táctil en los CTA "Solicitar servicio"** de Reparación, Alineación y TPMS (1.ª, 2.ª y 5.ª cards). Descartado: hover (neutralizado en `@media (hover:none)`), reveal en movimiento (unobserve aplicado), cola del smooth scroll (falla también esperando 3s y con scroll manual), superposiciones, listeners táctiles y offset de header/banner. La comparativa estática está agotada: la card 2 es idéntica a la 3 y una falla y la otra no. En escritorio con ratón funciona. Siguiente paso si se retoma: instrumentar en móvil real con un listener de diagnóstico en captura. **Impacto bajo**: los CTA llevan a `#contacto`, en la misma página.
- **Botón WhatsApp del panel sin filtro**: funciona para cualquier cita, incluidas canceladas y ya recordadas — sin filtro por estado ni por `recordatorioEnviado`.
- **Backup de `citas.json`: NO EXISTE.** No hay copias de seguridad de ningún tipo; el archivo vive en un **único disco de Render**. Un fallo del disco y se pierden **todas** las citas.

## Pendiente (trabajo futuro acordado, no deuda)
- **Pantalla de solo lectura para el taller** (citas del día, sin edición). Acordada sin coste, después de la entrega.
- **Informe mensual de citas en el panel.** Post-entrega.
- **Citas de HOY cuya hora ya pasó**: siguen arriba del listado toda la jornada porque el filtro de "Próximas" es **por día, no por hora**. **Decisión aplazada** a cuando se haga la pantalla de solo lectura: la respuesta correcta es distinta para cada vista.
- **Botón WhatsApp del panel — refinamiento acordado**: ocultarlo en citas canceladas, marcar visualmente las ya enviadas y pedir confirmación al pulsar. Acordado hacerlo **cuando haya número de Twilio operativo** (resuelve la deuda "Botón WhatsApp del panel sin filtro").

## Reglas
- Claude Code nunca ejecuta curl ni llamadas reales a Twilio para debuggear
- Leer siempre citas.json con fs.readFileSync antes de escribir (evitar race conditions)
- Escritura de citas.json tras un `await` externo: SIEMPRE releer con `readCitas()` y parchear solo el registro afectado, nunca reescribir el array leído antes del await. Aplica a cualquier endpoint futuro que escriba después de llamar a una API.
- El panel /admin usa auth básica HTTP nativa (sin librerías)
- Puerto: process.env.PORT || 3001
- Nunca añadir patrones globales de assets (*.png, *.jpg, etc.) al .gitignore: los favicons PNG estuvieron rotos en producción por un *.png heredado.
- `git pull` antes de tocar el repo: GitHub Pages creó el archivo `CNAME` que sostiene el dominio propio; si se borra en un push, el dominio deja de funcionar.
- Verificación de frontend en local: servidor estático (`python -m http.server 3002`), nunca `file://` (las imágenes no cargan). Backend local en otro puerto: `$env:PORT=3005; node server.js`.
- Vídeo en web: siempre MP4 asignado directo a `video.src` — nunca `<source>` hijos ni confiar en `canPlayType` (Safari devuelve 'maybe' para WebM/vp9 y falla en reproducción real).
