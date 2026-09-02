# CLAUDE.md — Neumáticos Quesada

## Proyecto
Web + sistema de citas con recordatorio WhatsApp para taller de neumáticos en Mislata, Valencia.

## Ubicación del proyecto
- **Ruta local: `C:\dev\Quesada`** — clon limpio desde GitHub del **17/08/2026**.
- **Ya NO está en OneDrive.** La carpeta antigua quedó renombrada como `Prueba 3 - VIEJO` y se eliminará.
- **Motivo del traslado**: OneDrive sincronizando una carpeta con `.git` dentro es fuente conocida de **corrupción del repositorio**. No devolver el proyecto a una ruta sincronizada.

## Stack
- Frontend: index.html único, Tailwind CDN, Inter + Barlow Condensed (Google Fonts, títulos) + Font Awesome 6.5
- Backend: Node.js + http nativo (sin frameworks)
- Datos: citas.json (array JSON), config.json (configuración del taller)
- WhatsApp: Twilio API (código intacto, **parado** por el bloqueo de Meta; vía manual con enlaces wa.me — ver "Recordatorios manuales")
- Backup remoto: GitHub Contents API con `fetch` nativo (sin dependencia)
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
├── favicon.ico       ← raíz del repo, solo para el rastreador (ver "Favicon")
├── imagenes/         ← favicons nq2f (5), logos de marca .svg (7 — `logo-dunlop.svg` y `logo-pirelli.svg` saneados: sin fondos "horneados", el detalle interior vuelve como transparencia real evenodd/máscara, imprescindible para el filtro monocromo del marquee), `logo_quesada_navy.png` (logo de empresa para header+footer, transparente y sin pastilla blanca, sobre fondo navy), fotos del taller (audi/benelli/honda/jeep/michelin-taller.jpeg), taller-fachada.jpeg (fallback hero), rueda-scroll.png (rueda-progreso, verificado: carga en producción). `logo-empresa.jpg` sigue en la carpeta pero **ya no se referencia** (huérfano tras adoptar logo_quesada_navy.png). `og-image.jpg` (1200×630, preview social Open Graph — ver sección propia)
├── videos/           ← hero-quesada.mp4, hero-quesada-movil.mp4, hero-poster.jpg, hero-poster-movil.jpg (ver sección Hero — vídeo de fondo)
├── .env              ← credenciales (nunca al repo)
├── backups/          ← NO está en el repo: vive en `DATA_DIR/backups/` (en Render, `/data/backups/`), copias diarias `citas-YYYY-MM-DD.json` (ver "Backup de citas")
├── CNAME             ← dominio propio para GitHub Pages: neumaticosquesada.com
├── robots.txt        ← raíz del repo, servido por GitHub Pages (ver "SEO técnico")
├── sitemap.xml       ← raíz del repo, una sola URL (ver "SEO técnico")
└── package.json

> Nota: `taller-interior.jpeg` y `Horario.jpeg` (fotos reales del taller) se archivaron fuera del repo en `..\Quesada-archivo\` — posible uso futuro en revisión visual o slider antes/después.

> **Limpieza del repo (17/08/2026)**: eliminados **12 PNG de capturas de desarrollo** de la raíz (~14 MB); no los referenciaba nada. `imagenes/` y `videos/` revisados uno a uno: **sin peso muerto, todo se usa**.

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

- **Objeto `VACACIONES`** (cabecera del script principal, ~línea 1946): `{activo, desde, hasta, textoCorto, textoLargo, fechaVuelta}`. **Estado actual: `activo: false` en los tres HTML** (desactivado el 25/08/2026, commit `9652cab`). El rango **2026-08-08 → 2026-08-31** y `fechaVuelta: '1 de septiembre'` se dejan escritos como plantilla del próximo cierre.
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
- **No confundir con Twilio**: el número que enviará los recordatorios automáticos es **distinto** (`+34 931 55 01 88`, comprado en Twilio) y se configura aparte, en variables de entorno del backend.

## Favicon
- Set completo en `imagenes/`: `nq2f-favicon.ico`, `nq2f-16.png`, `nq2f-32.png`, `nq2f-192.png`, `nq2f-apple-touch-icon.png`.
- **Fondo amarillo corporativo** (q-yellow) en los 5 nq2f y en el `favicon.ico` de la raíz — los 6 archivos regenerados el 25/08/2026 (commit `668150a`). Las declaraciones del `<head>` no cambiaron.
- Declarado en `<head>` con 5 `<link>` (icon .ico `sizes="any"`, icon png 16/32/192, apple-touch-icon).
- **`favicon.ico` también en la RAÍZ del repo**: Google lo busca por defecto en `/favicon.ico` y devolvía **404**. Es solo para el rastreador — **las 5 declaraciones del `<head>` siguen apuntando a `imagenes/` y siguen siendo válidas**. No hay que cambiarlas ni borrar el de la raíz.

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
  "matricula": "",
  "vehiculo": "",
  "kilometros": "",
  "precio": "",
  "mensaje": "",
  "estado": "pendiente|confirmada|atendida|cancelada",
  "recordatorioEnviado": false,
  "creadaEn": "ISO timestamp"
}
```

- **`telefono`**: **OPCIONAL** (clientes empresa sin móvil o solo con fijo). Vacío, ausente o solo espacios → válido. Con contenido: 9 dígitos que empiecen por **6, 7, 8 o 9** tras limpiar espacios, guiones y prefijo `+34`/`34`. Se guarda tal cual lo escribió Vicky (solo `trim()`). **El WhatsApp sigue exigiendo móvil**: eso lo decide `telefonoWa()` (ver "Recordatorios manuales"), no la validación.
- **`detalle`**: string **opcional**, máximo 100 caracteres. Para lo que Vicky anota en la agenda de papel (medida del neumático, tipo de vehículo). Las citas anteriores **no lo tienen**: el código tolera `undefined` en todas partes (listado, plantilla de WhatsApp). **Es nota interna**: no sale en el texto del recordatorio al cliente.
- **`matricula`, `vehiculo`, `kilometros`, `precio`**: los cuatro **opcionales** (vacío → válido), normalizados por `camposVehiculo(body)` en `POST` y `PUT` (única normalización, sin copias): matrícula en **MAYÚSCULAS y sin espacios** (≤15 car.), vehículo solo `trim()` (≤60 car.), kilómetros solo dígitos (≤7), precio dígitos con coma o punto decimal (`^\d+([.,]\d+)?$`, ≤10 car.). **Km y precio se guardan como STRING a propósito**: ni ceros a la izquierda perdidos, ni `""` convertido en `0`, ni un precio redondeado por `Number()`. En el panel los inputs son `type="text"` con `inputmode` numérico por la misma razón. Las citas anteriores **no los tienen** (`undefined` tolerado en listado y pantalla del taller).
- **`estado: atendida`**: cita ya realizada. En el listado del panel la fila va **atenuada (`opacity-50`) y solo el nombre tachado**; hora, servicio y acciones siguen legibles. No se oculta ni cambia de posición. **OJO**: su significado va a cambiar con el rediseño del ciclo de estados (ver "Pendiente").

## Endpoints server.js
| Método | Ruta                              | Descripción                                    |
|--------|-----------------------------------|------------------------------------------------|
| GET    | /                                 | Sirve index.html (pública) |
| GET    | /taller?k=TALLER_TOKEN            | **PÚBLICA, fuera del bloque `/admin`**: pantalla de solo lectura del taller. Token incorrecto/ausente/no configurado → 404 genérico (ver "Pantalla del taller") |
| GET    | /admin                            | Panel HTML con tabla de citas (auth básica). Por defecto solo citas con fecha >= hoy en ascendente; `?ver=todas` → histórico completo en descendente (ver "Panel /admin — vista de citas") |
| GET    | /admin/backup                     | Descarga `citas.json` en crudo como `citas-YYYY-MM-DD.json` (`Content-Disposition: attachment`, `Cache-Control: no-store`). 404 si aún no existe el archivo (ver "Backup de citas") |
| GET    | /admin/recordatorios              | Vista manual: citas confirmadas de **mañana** con enlaces `wa.me` prerrellenados (ver "Recordatorios manuales") |
| POST   | /admin/cita                       | Crea cita nueva desde el panel admin con estado=confirmada directamente (auth básica). 400 si body inválido o falla `validarCita` (mensaje del campo concreto) |
| PUT    | /admin/cita/:id                   | Edita los datos de una cita existente. Misma `validarCita` que el alta pero con `permitirPasado=true`. **Conserva `id`, `creadaEn`, `estado` y `recordatorioEnviado`.** 404 si no existe; 400 si falla validación |
| POST   | /admin/cita/:id/estado            | Cambia estado (pendiente/confirmada/atendida/cancelada). 400 si body inválido o estado no válido; 404 si la cita no existe |
| POST   | /admin/cita/:id/enviado           | Marca `recordatorioEnviado=true` **sin llamar a Twilio** (recordatorio mandado a mano desde `/admin/recordatorios`). 404 si no existe |
| POST   | /admin/cita/:id/recordatorio      | Envía WhatsApp vía Twilio y marca recordatorioEnviado=true. 404 si no existe; 500 con mensaje genérico si Twilio falla (detalle solo en log, teléfonos enmascarados). **Sigue en el código pero la UI ya no lo llama** (Meta bloqueó la WABA) |
| DELETE | /admin/cita/:id                   | Borra la cita por id (splice). 404 si no existe; `{ok:true}` si borra |

Respuestas de error comunes a todas las rutas `/admin`:
- **401** sin/con credenciales incorrectas (auth básica)
- **429** IP bloqueada por rate-limit (5 fallos de auth en 15 min → 15 min de bloqueo)
- **403** POST/PUT/DELETE que falla el anti-CSRF (`Sec-Fetch-Site` cross-site, `Origin`/`Referer` que no coincide con el host, o `Origin: null`)
- **413** body > 10 KB (rutas POST/PUT con `parseBody`)

## Panel /admin — vista de citas (server.js)
- **Vista por defecto ("Próximas")**: `GET /admin` filtra `c.fecha >= hoyMadrid()` y ordena por fecha y hora **ascendente** (la próxima cita arriba). **Solo filtro de visualización**: `citas.json` no se toca.
- **Vista histórico**: `GET /admin?ver=todas` — listado completo en **descendente** (lo más reciente arriba).
- **Orden por comparación de strings**: `` `${fecha} ${hora}`.localeCompare(...) `` — comparar `YYYY-MM-DD HH:MM` como texto equivale a comparar cronológicamente.
- **Cabecera**: enlace que alterna "Ver todas las citas" ↔ "Volver a próximas citas"; el contador etiqueta la vista activa ("Próximas: N citas" / "Todas: N citas").
- **Desplegable de estado**: ofrece `confirmada`, `atendida` y `cancelada`; `pendiente` aparece únicamente si la cita ya está en ese estado. La validación del servidor (`POST /admin/cita/:id/estado`) acepta los cuatro.
- **Columnas del listado**: Nombre | Teléfono (`—` si vacío) | Fecha y hora | Servicio (+ detalle debajo) | Vehículo (matrícula en negrita; debajo "vehículo · NNNN km", el `·` solo si hay ambos) | Precio (a la derecha, con `€`) | Estado | Acciones. Los km van en la columna Vehículo y no bajo el precio: sueltos en la columna Precio no se entendía qué eran.
- **Botón "Editar"** por fila: abre el **mismo formulario** de nueva cita en modo edición (los datos viajan en atributos `data-*` escapados) y manda `PUT /admin/cita/:id`. Sin formulario ni validación duplicados.
- **Botón "WhatsApp"** por fila: **ya no llama a Twilio**. Es un enlace `wa.me` con `textoRecordatorio(c, false)` (sin la palabra "mañana": el listado tiene citas de cualquier fecha). Si `telefonoWa()` devuelve `null` (fijo o vacío) muestra la pastilla "Sin WhatsApp". `sendWhatsApp()` y su endpoint siguen en el código, solo dejan de llamarse desde aquí.
- **Cabecera**: enlaces "Descargar copia de seguridad" (`GET /admin/backup`) y "Recordatorios de mañana" (`GET /admin/recordatorios`).

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
- **`writeCitas` crea el directorio** (`fs.mkdirSync(path.dirname(CITAS_PATH), {recursive:true})` antes de escribir). **Motivo**: con un `DATA_DIR` inexistente `writeFileSync` lanzaba ENOENT, el handler global lo recogía como `unhandledRejection`, el panel respondía igual, el formulario se cerraba y **la cita se perdía SIN aviso**. Mismo remedio que aplica `backupCitas()` a `BACKUP_DIR`.
- **Handlers globales de proceso**: `unhandledRejection` → loggea y sigue vivo (una rejection suelta es local a una petición, no tira la web pública); `uncaughtException` → loggea el stack y `process.exit(1)` para que Render reinicie limpio.

## Seguridad — panel /admin (server.js)
- **Auth básica en tiempo constante**: `checkAuth` compara usuario/contraseña hasheando ambos lados con SHA-256 y comparando con `crypto.timingSafeEqual` (`safeEqual`), evita timing attacks y filtrar la longitud real de las credenciales.
- **Rate-limit de intentos por IP**: 5 fallos en 15 min → bloqueo de 15 min (`AUTH_MAX_FAILS`/`AUTH_WINDOW_MS`/`AUTH_BLOCK_MS`, respuesta 429 mientras dure). Estado en memoria (`Map`, se pierde al reiniciar el proceso), con barrido horario que purga entradas expiradas. IP real vía `getClientIp` (primer valor de `x-forwarded-for` — fiable solo detrás del proxy de Render; fallback `remoteAddress` en local).
- **Log de intentos fallidos**: IP + timestamp en `console.warn`, nunca las credenciales probadas.
- **Anti-CSRF en tres niveles** (`isSameOrigin`, toda petición **POST/PUT/DELETE** bajo `/admin` — PUT añadido con la edición de citas): 1) `Sec-Fetch-Site` si el navegador la manda (inmune a la referrer policy) — solo `same-origin`/`none` pasan; 2) si no, `Origin` (o `Referer` de reserva) debe coincidir con el host propio, y el literal `"null"` (iframe sandbox, `file://`, redirect cross-origin) se rechaza explícitamente; 3) sin ninguna de las tres cabeceras (curl, herramientas API) se permite. Petición cross-origin desde navegador → 403.
- **Anti-XSS en el panel**: `escapeHtml` escapa todo dato variable (`nombre`, `telefono`, `fecha`, `hora`, `servicio`, `detalle`, `matricula`, `vehiculo`, `kilometros`, `precio`, `estado`, `id`, `TALLER_NOMBRE`) antes de interpolarlo en `adminHTML`, `recordatoriosHTML` y `tallerHTML`, incluidos los atributos `data-*` del botón Editar.
- **Validación de entrada** (`validarCita(body, permitirPasado=false)`, `POST /admin/cita` y `PUT /admin/cita/:id`): nombre obligatorio (≤100 car.), teléfono **opcional** (vacío válido; con contenido `^[6789]\d{8}` tras limpiar prefijo/espacios/guiones — fijos admitidos), fecha `YYYY-MM-DD` con calendario real **y no anterior a hoy** (`hoyMadrid()`, hoy sí se permite), hora `HH:MM` válida, servicio ≤100 car., `detalle` **opcional** ≤100 car., matrícula ≤15, vehículo ≤60, kilómetros `^\d{1,7}$`, precio ≤10 car. y `^\d+([.,]\d+)?$` (los cuatro opcionales) — primer campo inválido → 400 con mensaje específico. **`permitirPasado=true` SOLO lo pasa el PUT**: salta únicamente la regla "fecha no anterior a hoy" para corregir citas ya pasadas; el resto de reglas aplica igual. `POST /admin/cita/:id/estado` valida que el estado sea `pendiente|confirmada|atendida|cancelada` → 400 si no.
- **Token de la pantalla del taller** (`GET /taller?k=`): comparado con el mismo `safeEqual` del login (SHA-256 + `timingSafeEqual`, nunca `!==`). Cualquier fallo responde el **mismo 404 genérico** del final del handler, byte a byte: la ruta no revela que existe (nunca 401 ni 500). Ver "Pantalla del taller".
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
TALLER_TOKEN=              # token de la pantalla /taller?k=...; sin definir, /taller responde 404 siempre
GITHUB_BACKUP_ENABLED=     # true → subida diaria del backup a GitHub (03:15)
GITHUB_BACKUP_TOKEN=       # PAT de GitHub con acceso de escritura al repo privado. CADUCA EL 26/08/2027
GITHUB_BACKUP_REPO=        # owner/repo del repo privado de backups
```

## Backend en producción (Render)
- **URL del servicio**: `https://neumaticos-quesada.onrender.com`
- **Panel admin**: `https://neumaticos-quesada.onrender.com/admin` — este es el acceso real de Vicky, sustituye a `localhost:3001/admin` (que queda solo para desarrollo).
- **Plan Starter**, región **Frankfurt (EU Central)**, **auto-deploy desde `main`**: cada push a `main` redespliega automáticamente.
- **Disco persistente de 1 GB montado en `/data`**, con `DATA_DIR=/data` en variables de entorno. **VERIFICADO**: las citas sobreviven a los redeploys.
- **Variables de entorno configuradas en el dashboard de Render** (no en `.env`): `DATA_DIR`, `ADMIN_USER`, `ADMIN_PASS` (contraseña fuerte, ya **no** `quesada123`), `TALLER_NOMBRE`, `TALLER_TELEFONO`, **`TALLER_TOKEN`** (pantalla del taller) y las tres **`GITHUB_BACKUP_ENABLED/TOKEN/REPO`** (backup remoto). Las `TWILIO_*` **NO están cargadas y no se van a cargar mientras Meta mantenga bloqueada la WABA** (ver "Twilio + Meta"); el `TWILIO_CONTENT_SID` no existe porque la plantilla nunca llegó a aprobarse.
- **Backups en `/data/backups/`** (mismo disco persistente). **Pantalla del taller**: `https://neumaticos-quesada.onrender.com/taller?k=<TALLER_TOKEN>`.
- **`PORT` lo inyecta Render automáticamente** — no configurarlo a mano.

## Cron jobs
Tres `cron.schedule` independientes, todos con `timezone: 'Europe/Madrid'` explícito:

| Hora  | Función | Qué hace |
|-------|---------|----------|
| 03:00 | `backupCitas()` | Copia diaria de `citas.json` a `DATA_DIR/backups/` + purga (ver "Backup de citas") |
| 03:15 | `subirBackupGitHub()` | Sube la copia del día al repo privado de GitHub. 15 min después para que el archivo ya exista |
| 19:00 | recordatorios Twilio | Envía WhatsApp de las citas de mañana — **parado en la práctica** (sin `TWILIO_*` en Render) |

Recordatorios (19:00):
- El recordatorio se envía a las 19:00 del día anterior a la cita.
- Filtra: estado=confirmada, fecha=mañana, recordatorioEnviado=false **y `telefonoWa(c.telefono) !== null`** (sin móvil válido no hay WhatsApp: fijos y vacíos quedan fuera; sin este filtro `sendWhatsApp()` construiría `whatsapp:+34` vacío o un destino a un fijo y llamaría a Twilio igual). Esas citas siguen visibles en `/admin/recordatorios` como "Teléfono no válido".
- Acción: envía WhatsApp y marca recordatorioEnviado=true
- **Fecha de "mañana" en Madrid**: `fechaMadrid(new Date(Date.now() + 24*60*60*1000))`, no `toISOString()` (mismo motivo que `hoyMadrid()`: el proceso corre en UTC). Válido **solo aquí** porque el cron dispara a las 19:00 — si se mueve a última hora de la noche hay que recalcular. **Los handlers HTTP NO copian esta forma**: usan `fechaManana()` (ver "Recordatorios manuales").

## Backup de citas (tres capas)
Las dos primeras capas viven en el **mismo disco de Render**; la tercera está fuera.

- **Capa 1 — `backupCitas()`** (cron 03:00 + arranque): copia `citas.json` a `DATA_DIR/backups/citas-YYYY-MM-DD.json` (fecha `hoyMadrid()`), escritura atómica `.tmp` + `rename`, `mkdirSync` de `BACKUP_DIR` antes.
  - **Lee el archivo CRUDO, nunca vía `readCitas()`**: esa función renombra `citas.json` a `.corrupt-*` si no parsea, y desde un backup eso sería destructivo. Si el JSON no parsea **NO escribe nada** (log `GRAVE`): la última copia buena vale más que una corrupta de hoy.
  - **Aviso de caída brusca**: si el array tiene menos de la **mitad** de citas que el backup anterior (o está vacío), `console.warn` fuerte pero **escribe igualmente** — puede ser una limpieza legítima o un `DATA_DIR` mal montado tras un deploy; las copias previas no se tocan.
  - **Backup de arranque**: `server.listen` llama a `backupCitas()` **solo si no existe** el archivo del día — cubre un proceso caído a las 03:00 sin que un redeploy posterior pise el backup bueno de la madrugada.
- **`purgarBackups()`** (al final de cada `backupCitas()`): retención **`BACKUP_KEEP_DAYS = 30`** con mínimo **`BACKUP_KEEP_MIN = 7`** copias siempre conservadas aunque todas superen los 30 días. Solo toca archivos que casan con `^citas-\d{4}-\d{2}-\d{2}\.json$` (`.corrupt-*`, `citas.json` o cualquier otro nombre se ignora). **La antigüedad se mide por la fecha del NOMBRE, nunca por mtime** (un restore o una copia lo alteran). Los `.tmp` huérfanos se borran aparte solo si tienen más de 24 h.
- **Capa 2 — `GET /admin/backup`**: descarga manual desde el panel (enlace "Descargar copia de seguridad" en la cabecera). Sirve los bytes crudos sin parsear: si estuviera corrupto, la copia sirve para forense.
- **Capa 3 — `subirBackupGitHub(fecha)`** (cron 03:15): sube `backups/citas-YYYY-MM-DD.json` al repo privado `GITHUB_BACKUP_REPO` vía **GitHub Contents API** (`fetch` nativo, sin dependencias): GET previo para obtener el `sha` si el archivo ya existe (404 = primera subida, no es error) y PUT con `content` en base64 (201 crea / 200 actualiza). `AbortSignal.timeout(15000)` en ambas llamadas; cabecera `User-Agent` obligatoria (GitHub rechaza sin ella). Solo actúa con `GITHUB_BACKUP_ENABLED === 'true'`; sin token o repo avisa **una sola vez** (flag `githubBackupAvisado`). Si no existe el archivo local del día, avisa que el backup de las 03:00 debió fallar y no sube nada. 409 → el repo no tiene rama inicial (crear un commit inicial).
  - **Fallo SIEMPRE silencioso**: todo el cuerpo va en `try/catch` — un backup remoto que falla solo loggea, nunca tumba el proceso ni afecta a los recordatorios.
  - **⚠️ EL PAT DE GITHUB CADUCA EL 26/08/2027.** A partir de ese día la subida falla (solo se verá en el log de Render, `[backup-remoto]`); las capas 1 y 2 siguen funcionando. Hay que generar un PAT nuevo y actualizar `GITHUB_BACKUP_TOKEN` en Render **antes** de esa fecha.

## Recordatorios manuales (vía wa.me) — sustituto de Twilio
Camino paralelo al de Twilio, activo desde que Meta bloqueó la WABA (ver "Twilio + Meta"). No toca `sendWhatsApp()`, ni el cron de las 19:00, ni la plantilla de Meta.

- **`GET /admin/recordatorios`** (`recordatoriosHTML`, HTML propio, no reutiliza `adminHTML`): citas **confirmadas de mañana** ordenadas por hora, una tarjeta por cita con hora, nombre, servicio + detalle, teléfono, botón verde "Enviar por WhatsApp" (enlace `wa.me` con `?text=` prerrellenado, `target=_blank rel=noopener`) y botón "Marcar enviado". Sin móvil válido la tarjeta muestra "Teléfono no válido" en rojo. Las ya enviadas van atenuadas con badge "Ya enviado" y sin botón de marcar. Enlace en la cabecera del panel ("Recordatorios de mañana").
- **`POST /admin/cita/:id/enviado`**: marca `recordatorioEnviado=true` **sin llamar a Twilio**. Lectura fresca + parcheo de un solo registro (regla del proyecto). Hereda `isSameOrigin`.
- **`fechaManana()`**: "mañana" en Madrid para handlers HTTP. **NO copia el `Date.now() + 24h` del cron**: esa forma solo es segura a las 19:00. Un handler se ejecuta a cualquier hora, así que parte de `hoyMadrid()` **anclado a mediodía UTC** (`T12:00:00Z`) y suma 24 h desde ahí — cae siempre dentro del día siguiente, haya cambio de hora o no. La usan `/admin/recordatorios` y `/taller`.
- **`telefonoWa(tel)`**: devuelve `'34XXXXXXXXX'` listo para `wa.me`, o `null` si no es un **móvil** español (`^[67]\d{8}$` tras limpiar espacios/guiones/prefijo). Misma normalización que `sendWhatsApp()`, pero aquí un número mal metido no rompe nada: `null` → aviso en la fila. **Es la única función que decide si una cita puede recibir WhatsApp** — la validación de `validarCita` admite fijos.
- **`textoRecordatorio(cita, incluirManana=true)`**: texto plano del `?text=` ("Hola {nombre}, te recordamos tu cita en {TALLER_NOMBRE} mañana {fecha legible} a las {hora} para {servicio}. Si no puedes venir, respóndenos a este mensaje. ¡Gracias!"). `incluirManana=false` sustituye "mañana" por "el" — lo usa el listado general de `/admin`, donde la cita puede ser de cualquier fecha.
  - **NO incluye `detalle`**: es nota interna de Vicky (medidas, tipo de rueda) y **no debe salir al cliente**. Corregido en commit `d976991`.
  - **DELIBERADO: no usa `contentVar()`**. Esa función LANZA con cualquier campo vacío y aquí una sola cita mal metida tumbaría la vista entera; se hace fallback a cadena vacía y sale una fila incompleta.
- **Dos escapados distintos, no intercambiables**: `encodeURIComponent` SOLO para el valor de `?text=` (es una URL); `escapeHtml` para todo lo demás (es HTML). El `href` queda seguro dentro del atributo porque `encodeURIComponent` ya percent-codifica `" < > &` y `wa` viene de `telefonoWa()`, que solo devuelve dígitos validados por regex.
- **Flujo operativo de Vicky**: abrir "Recordatorios de mañana" → pulsar "Enviar por WhatsApp" (abre el WhatsApp del taller con el mensaje escrito) → enviar → "Marcar enviado".

## Pantalla del taller (GET /taller)
Vista de **SOLO LECTURA** para una pantalla colgada en el taller, encendida todo el día y visible por cualquiera que pase. `tallerHTML(citas, fecha, esManana)`.

- **RUTA PÚBLICA a propósito, FUERA del bloque `/admin`**: no usa `checkAuth`. Una pantalla permanentemente logueada con auth básica daría el **panel completo** a cualquiera que se sentara delante. Autoriza por **`?k=TALLER_TOKEN`** en la query, comparado con `safeEqual` (tiempo constante). `TALLER_TOKEN` sin definir, token ausente o incorrecto → **el mismo 404 genérico** del final del handler, nunca 401 ni 500.
- **Datos que muestra**: hora, **NOMBRE DE PILA** (lo anterior al primer espacio del nombre completo), servicio, detalle, matrícula (pastilla con borde) y vehículo. **PROHIBIDO**: precio, kilómetros, apellidos, teléfono e id. Los ve el cliente que espera y cualquiera que pase. Sin enlaces a `/admin` ni a ninguna otra vista: **callejón sin salida a propósito**.
- **Solo citas `confirmada`** de HOY (`hoyMadrid()`), ordenadas por hora. **Si no queda ninguna, salta sola a MAÑANA** (`fechaManana()`): rótulo **"MAÑANA"** grande en amarillo delante de la fecha, imposible de confundir desde varios metros. Si mañana tampoco hay nada, lista vacía con la fecha de mañana. Sin enlaces ni query para alternar (la pantalla no es táctil); como cada refresco recalcula todo, al cambiar el día en Madrid vuelve sola a "hoy". **OJO**: con el rediseño de estados, `atendida` pasará a significar "el coche está aquí" y la pantalla tendrá que mostrarlas también (ver "Pendiente").
- **Auto-refresh cada 60 s SIN JS**: `<meta http-equiv="refresh" content="60">` **sin URL** en el content. El HTML Standard define ese caso como navegación a la URL completa del documento, **query incluida**, así que el `?k=` se conserva en cada refresco (verificado en Chrome, Firefox, Safari y Edge). Deliberadamente no se pone la URL: sería redundante y dejaría el token escrito también dentro del HTML. `Cache-Control: no-store`.
- **HTML autocontenido, CSS inline, cero dependencias de red** (ni Tailwind CDN, a diferencia del panel): una pantalla que pasa semanas abierta no puede quedarse sin estilos porque un CDN falle en uno de los refrescos. Replica el lenguaje visual del panel (navy `#060D1F`, tarjetas `#0D1B3E`, acento `#FFD700`) en un `<style>` propio; tipografías grandes (hora 3.2rem, nombre 2.2rem) para leerse de lejos.
- **Móvil** (`@media (max-width: 700px)`): la tarjeta pasa a columna y se reducen tamaños — con el `.hora` de 9.5rem el nombre y el servicio se salían del viewport. Uso secundario (móvil de los mecánicos); el principal sigue siendo la pantalla fija.

## WhatsApp — envío por plantilla Meta (server.js)
> **PARADO desde el 25/08/2026**: Meta restringió la WABA y la plantilla nunca se aprobó (ver "Twilio + Meta"). `sendWhatsApp()`, el cron de las 19:00 y `POST /admin/cita/:id/recordatorio` **siguen en el código sin tocarse**, pero la UI ya no los llama y las `TWILIO_*` no están en Render. El sustituto operativo es "Recordatorios manuales (vía wa.me)". Lo de abajo sigue siendo válido por si la apelación prospera.

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
| Twilio        | ⚠️     | Bundle aprobado + **número comprado** `+34 931 55 01 88` (SMS, solo a España). Sin uso mientras Meta mantenga el bloqueo — ver "Twilio + Meta" |
| Meta / WABA   | ❌     | **WABA y portfolio RESTRINGIDOS por Meta el 25/08/2026** (falso positivo de "automation"); verificación de empresa RECHAZADA; apelación pendiente. Recordatorios automáticos parados — ver "Twilio + Meta" |
| Recordatorios manuales | ✅ | `/admin/recordatorios` + enlaces wa.me en el listado. Es la vía operativa real — ver sección propia |
| Backup citas  | ✅     | Tres capas: copia diaria 03:00 (30 días, mín. 7) + descarga desde el panel + subida a GitHub 03:15. **PAT caduca el 26/08/2027** — ver "Backup de citas" |
| Pantalla taller | ✅   | `GET /taller?k=TOKEN`, solo lectura, salta a mañana, refresh 60 s sin JS — ver sección propia |
| Deploy Render | ✅     | En producción — plan Starter, Frankfurt, disco 1 GB en /data, auto-deploy desde main (ver sección propia) |
| Enlaces wa.me | ✅     | Los 4 apuntan ya al fijo del taller (34963593087), no al número personal — ver "Teléfono del taller en index.html" |
| Vacaciones    | ✅     | Aviso **desactivado** (`activo: false` en los 3 HTML); bloque conservado para el próximo cierre — ver sección propia |
| SEO técnico   | ✅     | JSON-LD AutoRepair + robots.txt + sitemap.xml en producción, validados en Rich Results Test — ver sección propia |
| Search Console | ✅    | Dominio verificado por DNS TXT, sitemap enviado, indexación solicitada — ver "Google Business Profile" |
| Concurrencia  | ✅     | Probada con autocannon: 50 citas / 20 conexiones, sin pérdidas — ver sección propia |
| Google Business | ✅   | Ficha reclamada, servicios ampliados, web corregida a neumaticosquesada.com — ver sección propia |
| Entrega       | ✅     | **ENTREGADO Y COBRADO**: contrato firmado por ambas partes, factura KAIRO-2026-001 (855 €) pagada — ver "Entrega" |
| Limpieza repo | ✅     | 12 PNG de capturas fuera (~14 MB), favicon.ico en raíz, assets sin peso muerto — 17/08/2026 |

## WhatsApp — Aclaración operativa
- El WhatsApp Business actual del taller sigue gestionado manualmente por Vicky (sin cambios).
- Número Twilio **`+34 931 55 01 88`**, exclusivo para envío de recordatorios automáticos — no sustituye el canal de atención al cliente existente. **Hoy sin uso** por el bloqueo de Meta.
- **Los recordatorios los manda Vicky a mano** desde el WhatsApp del taller (963 593 087) usando `/admin/recordatorios` — ver "Recordatorios manuales".

## Twilio + Meta — estado del número y de la WABA

### Bundle regulatorio (Twilio)
- **APROBADO el 12/08/2026** · SID `BU0ffed7d91ff7a2d5cdf61554fa058b56` · Nombre `Neumaticos Quesada - ES Mobile` · Tipo **Mobile** · End user: Business (NEUCERGON, S.L.)
- **Address SID validado**: `AD29705a0c0d287badd5a2a096d3b272e3`

### Número
- **COMPRADO: `+34 931 55 01 88`** (número de Twilio, prefijo de **Barcelona**, capability **SMS**).
- **OJO — solo envía SMS a números españoles.** Limitación del número, no de la configuración.

### Meta
- **Business Portfolio**: `Neumaticos Quesada`, ID **`822408117559544`**. Creado por **Dani Rubio (propietario)**; **Samuel** como administrador.
- **WABA creada**, ID **`2362194940977658`**.
- **Display name "Neumáticos Quesada": PENDING** de aprobación de Meta.
- **Plantilla `recordatorio_cita_taller` enviada a aprobación** (categoría **Utility**, español, **5 variables** — ver "WhatsApp — envío por plantilla Meta").
- **Verificación de empresa: RECHAZADA.** (Antes: iniciada y parada a la espera del DNI de un representante legal — Dani o Carles, no el desarrollador.)

### Bloqueo de Meta (25/08/2026)
- Meta **restringió la WABA `2362194940977658` y el Business Portfolio `822408117559544`** el **25/08/2026** por *"automation that doesn't follow our rules"*.
- **Evaluado como FALSO POSITIVO.** Contexto: la plantilla seguía en PENDING y las `TWILIO_*` nunca se cargaron en Render, así que el sistema no había enviado ningún mensaje.
- **Apelación presentada, PENDIENTE.** Display name y plantilla nunca llegaron a aprobarse.
- **Consecuencia operativa**: los **recordatorios automáticos están parados**. El sustituto es la **vía manual** (`/admin/recordatorios` + enlaces wa.me, ver sección propia). El código de Twilio se conserva intacto por si la apelación prospera.

## Registro de WhatsApp Business API — lecciones
Aprendido a base de errores durante el alta. Releer esto ANTES de repetir el proceso en otro proyecto.

- **EL BLOQUEO PRINCIPAL — datos del portfolio antes que la WABA**: el Business Portfolio de Meta debe tener **rellenos** denominación legal, dirección, teléfono, web y **Tax ID** *antes* de crear la WABA. Con el portfolio vacío Meta devuelve **`Error #2593030: Your account couldn't be created`** **sin explicar la causa**. En cuanto se rellenan los datos, el error desaparece.
- **La identidad de Meta necesita Facebook, no solo Instagram**: una cuenta de solo-Instagram da **"You don't have access"**. Además, **las cuentas de Facebook creadas el mismo día suelen ser rechazadas** — hay que usar una cuenta con antigüedad.
- **Una sola sesión de Meta por navegador**: con varias sesiones abiertas, el popup de Twilio **coge una arbitraria** y ofrece el portfolio equivocado.
- **El código de verificación del número aparece en el PASO 3 de la pantalla de Twilio** — **NO llega a ningún móvil**. No esperar un SMS.
- **Orden correcto del proceso**: bundle → número → **datos del portfolio** → WABA + sender → plantilla → aprobación (~24 h) → variables en Render.

## Google Business Profile
- **Ficha RECLAMADA** — lo estaba desde el principio, por la **cuenta personal de Carles** (`carlesvespino46@gmail.com`). **No hizo falta verificación por carta ni por vídeo.**
- **`neucergon@gmail.com` añadido como Propietario.** Carles sigue como **Propietario principal**.
- **Horario semanal y vacaciones (10-31 de agosto)**: ya estaban bien cargados, no se tocaron.
- **Servicios**: había solo 2 (Neumáticos, Calibración de ruedas) → **añadidos el resto**.
- **Sitio web de la ficha**: apuntaba al **enlace de WhatsApp**; corregido a **`neumaticosquesada.com`**.
- **295 reseñas**, respondidas habitualmente por el cliente — **sin atasco que resolver**.
- **1.324 interacciones de clientes**: es el **canal con más movimiento del negocio**, por encima de la web.

### Google Search Console — HECHO
- **Dominio `neumaticosquesada.com` verificado por registro DNS TXT** (propiedad de dominio, no solo prefijo de URL).
- **`sitemap.xml` enviado** e **indexación de la home solicitada**.
- Cuenta: la del negocio (`neucergon@gmail.com`).

## Deuda técnica
- Status callback de Twilio: el SID devuelto significa "aceptado", no "entregado". Saber si el cliente recibió el recordatorio requiere un webhook de status. Solo aplica si la apelación a Meta prospera y se reactiva Twilio.
- **Doble toque en táctil en los CTA "Solicitar servicio"** de Reparación, Alineación y TPMS (1.ª, 2.ª y 5.ª cards). Descartado: hover (neutralizado en `@media (hover:none)`), reveal en movimiento (unobserve aplicado), cola del smooth scroll (falla también esperando 3s y con scroll manual), superposiciones, listeners táctiles y offset de header/banner. La comparativa estática está agotada: la card 2 es idéntica a la 3 y una falla y la otra no. En escritorio con ratón funciona. Siguiente paso si se retoma: instrumentar en móvil real con un listener de diagnóstico en captura. **Impacto bajo**: los CTA llevan a `#contacto`, en la misma página.
- **Enlace WhatsApp del listado sin filtro por estado**: el enlace `wa.me` de cada fila de `/admin` aparece en cualquier cita con móvil válido, **incluidas canceladas y atendidas**, y no distingue las ya recordadas (`recordatorioEnviado`). Ya no sale sin móvil (muestra "Sin WhatsApp"), pero el filtro por estado sigue sin existir. Se resolverá de paso con el rediseño del ciclo de estados (ver "Pendiente").

## Pendiente (trabajo futuro acordado, no deuda)
Por orden de ejecución. **Nota de alcance**: los puntos **a–d son desarrollo nuevo, fuera del mantenimiento de la cláusula 5.4** del contrato. Se asumen **sin coste por ser el primer cliente**, pero conviene que quede constancia.

- **a) Rediseño del ciclo de estados.** El circuito real del taller es: **confirmada → atendida (el coche está aquí) → acabada (trabajo terminado, Vicky tiene que llamar) → pagada (cliente avisado, ha pagado y se ha llevado el coche)**. Más **cancelada**.
  - **ATENCIÓN: `atendida` CAMBIA DE SIGNIFICADO.** Hoy significa "hecha y cerrada"; pasará a significar "el coche está en el taller". Eso obliga a que **la pantalla del taller muestre también las atendidas**, no solo las confirmadas.
  - **Color de fila**: solo **`acabada` destaca** (borde y fondo amarillo), porque es el único estado que reclama acción de Vicky. `pagada` y `cancelada` atenuadas.
  - **Marcado**: un **tic que avanza un paso**, más el desplegable para corregir.
- **b) Escritura acotada desde la pantalla del taller.** Un endpoint que **SOLO permita avanzar de confirmada/atendida a acabada**, con el mismo `TALLER_TOKEN`. Nada de editar, borrar ni retroceder: si el token se filtrara, el daño máximo sería marcar citas como acabadas. **Pendiente decidir** si se usa desde tablet o desde el móvil de los mecánicos. Posible: que puedan **meter los kilómetros al marcar acabado**, que es cuando los apuntan.
- **c) Aviso a Vicky en el panel.** Banda con "**N coches acabados · llamar al cliente**", actualizada por **sondeo cada 20-30 s**. Sin sonido ni popups. Desaparece al pasar la cita a `pagada`.
- **d) Formato del listado.** Fecha en `dd/mm/aaaa` y hora separada visualmente. Va al final porque depende de qué columnas existan tras a–c. **CRÍTICO: el orden del listado usa `` `${fecha} ${hora}`.localeCompare() `` sobre los datos crudos en ISO** — cambiar SOLO la representación, **nunca los datos**.
- **e) Informe mensual de citas** en el panel. Acordado post-entrega, sin coste.
- **Tarea menor de código**: el comentario de `server.js` ~línea 1500 (sobre `GET /admin/recordatorios`) dice que `isSameOrigin` "solo aplica a POST/DELETE"; ya incluye PUT. Corregirlo en la próxima sesión que toque esa zona.

## Entrega — CERRADA
- **Manual de una página para Vicky: HECHO** (PDF A4). Soporte indicado en el manual: **637 62 18 80**.
- **Contrato: FIRMADO POR AMBAS PARTES.** Samuel y Carles con certificado; **Dani firmó y además confirmó por correo** (los administradores son mancomunados, su firma era necesaria).
- **Factura `KAIRO-2026-001`: 855 €, COBRADA** (transferencia recibida).
- **`citas.json` de producción** arrancó vacío, sin citas de prueba (verificado en la entrega).

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
- **NUNCA usar `Set-Content` de PowerShell sobre archivos del proyecto**: reescribe en la codificación ANSI del sistema y **destruye el UTF-8** (acentos, `ñ`, `€`, `—` quedan corruptos). Los archivos se editan **solo con el editor** (o con la herramienta de edición de Claude Code). Mismo aviso que `Out-File` en la prueba de concurrencia, pero peor: ahí solo rompía un body de test, aquí rompe el código fuente.
- **Antigravity reformatea HTML al guardar**: un cambio de una línea puede generar un diff de varias (reindentado, atributos reordenados). **Revisar el diff antes de cada commit** y no dar por hecho que el diff refleja solo lo que se tocó a mano.
- La pantalla `/taller` es **pública por diseño**: cualquier dato nuevo que se añada ahí debe pasar el filtro "¿puede verlo un cliente que espera?". Precio, km, apellidos y teléfono, **nunca**.
