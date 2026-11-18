**English** · [Português](README.pt-BR.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Italiano](README.it.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [Русский](README.ru.md) · [Polski](README.pl.md)

# Sound Capsule

Convierte tus scrobbles de Last.fm en una **cápsula de sonido vertical de 1080×1920** (formato story) lista para descargar o compartir. La agregación se realiza íntegramente en el navegador, sin inicio de sesión y sin base de datos.

**Despliegue:** <https://sound-capsule-lastfm.vercel.app>

![Tarjeta generada](docs/screenshots/capsule-1080x1920.png)

> Las capturas usan datos simulados para mostrar los estados de la interfaz. La imagen de fondo de la tarjeta es un retrato sintético de prueba; en producción procede de Deezer o de una foto subida por el usuario.

Ejemplo con nombres en japonés, coreano y chino renderizados en el PNG exportado: [tarjeta CJK](docs/screenshots/cjk-1080x1920.png).

## Características

- **Pantalla de inicio** con campo de usuario (acepta el nombre de usuario o la URL del perfil), periodo (última semana, mes actual o intervalo personalizado), vista previa 9:16 y acciones de descarga y uso compartido.
- **Periodo personalizado con una duración máxima de 3 meses de calendario** — sin ventana fija de 90 días y sin restringir las fechas elegidas (desde la fecha de registro en Last.fm hasta hoy).
- **Tarjeta 9:16** (432×768 CSS, exportada como PNG de 1080×1920) con el 30 % superior como foto del artista y un cuerpo sólido `#212121`.
- **Cinco temas de color fijos** (Ember, Tide, Moss, Plum, Sand) que solo cambian el color de acento de la tarjeta — sin selector de color libre.
- **Foto del artista** en tres capas: coincidencia automática en Deezer → subida local opcional (nunca se envía al servidor) → respaldo en canvas con iniciales.
- **Dos columnas numeradas** (Top artistas y Top canciones, 1–5) con truncado por puntos suspensivos y compatibilidad con CJK (japonés, coreano y chino).
- **Tiempo de escucha estimado** destacado en color sólido del tema, tooltip que explica el cálculo y formato mediante `Intl`.
- **Embed autocontenido**: el botón «Copiar embed» genera un bloque HTML `<a><img></a>` con el PNG en base64 — sin subida, sin almacenamiento y sin depender de una URL de imagen alojada (~0,5–0,8 MB). Funciona donde se permite HTML en bruto.
- **Vista previa de enlaces**: al pegar la URL del sitio en WhatsApp, Discord, Twitter/X, Telegram, etc., aparecen un título y una descripción localizados y una imagen Open Graph 1200×630 de la marca.
- **Progreso real de paginación** («Página 12 de 40»), skeleton en la vista previa y cancelación con `AbortController`.
- **i18n** en `pt`, `en`, `es`, `fr`, `de`, `it`, `ja`, `ko`, `zh`, `ru` y `pl`, con detección por `Accept-Language`, rutas con prefijo, textos/fechas/números formateados con `Intl` y un desplegable de idioma personalizado y accesible.
- **Créditos en la tarjeta** («Data from Last.fm», enlace al perfil y URL del sitio), con opción de ocultar el nombre de usuario en la tarjeta.
- **Fondo `<canvas>`** con líneas de onda sutiles que reaccionan al ratón, se pausan con la pestaña oculta y se desactivan con `prefers-reduced-motion`.
- **Accesible**: navegación por teclado, etiquetas, `role="progressbar"`, alertas, contraste AA y respeto por el movimiento reducido.
- **Observabilidad**: Vercel Web Analytics y Speed Insights, sin cookies, para medir visitas y Core Web Vitals.

## Persistencia: solo idioma y tema

| Dato | Dónde se almacena | Detalle |
| --- | --- | --- |
| Idioma | cookie `NEXT_LOCALE` | solo `pt`, `en`, … |
| Color de la tarjeta | `localStorage` (`sound-capsule:theme`) | solo el id del acento |
| Nombre de usuario, fechas, resultado de la API, foto subida | **memoria** | desaparecen al pulsar F5 |

Cambiar de idioma conserva el nombre de usuario y la tarjeta en memoria (sin nuevas solicitudes a Last.fm), pero recargar la página borra esos datos. No se persiste ningún dato de scrobbles, historial ni foto.

## Stack

| Capa | Opción |
| --- | --- |
| Framework | Next.js 15 (App Router) + TypeScript |
| Estilos | Tailwind CSS 4 |
| i18n | `next-intl` 4 |
| Exportación de imagen | `html-to-image` (en el cliente) |
| Pruebas | Vitest |
| Despliegue | Vercel (serverless, estático + route handlers) |

## Cómo funciona

```text
Navegador
  ├─ valida el usuario/periodo (máx. 3 meses de calendario)
  ├─ /api/lastfm  ──────────►  API de Last.fm (clave inyectada en el servidor)
  │     └─ user.getInfo, user.getRecentTracks, track.getInfo
  ├─ pagina TODAS las páginas de scrobbles (concurrencia 3 + pausa de 150 ms)
  ├─ agrega en memoria: top artistas, top canciones, tiempo de escucha
  ├─ /api/artist-image ─────►  búsqueda en Deezer (mejor coincidencia normalizada)
  ├─ /api/image-proxy  ─────►  CDN de Deezer (lista de permitidos *.dzcdn.net)
  ├─ foto opcional del usuario ─►  canvas local (nunca sale del navegador)
  └─ renderiza la tarjeta en el DOM y exporta un PNG de 1080×1920
```

La aplicación no obtiene datos al cargar la página; solo cuando el usuario pulsa Generar. Las respuestas públicas usan caché de CDN con `Vercel-CDN-Cache-Control`; un acierto de caché no invoca la función.

## Ejecutar en local

### Requisitos

- Node.js **20.9+**
- pnpm **9+** (el repositorio se desarrolló con pnpm 11)

### 1. Obtener una clave de API de Last.fm

1. Entra en <https://www.last.fm/api/account/create>.
2. Rellena el nombre de la aplicación (p. ej., *Sound Capsule*), la URL `https://sound-capsule-lastfm.vercel.app` y la descripción.
3. Copia la **clave de API** generada (no hace falta el *shared secret*, ya que no hay autenticación de usuarios).

### 2. Configurar el entorno

```bash
cp .env.example .env.local
# edita .env.local y completa:
LASTFM_API_KEY=your_key_here
```

La variable es **solo del servidor**. Nunca uses el prefijo `NEXT_PUBLIC_`, y no se incluye en el bundle del cliente.

### 3. Instalar y ejecutar

```bash
pnpm install
pnpm dev
```

Abre <http://localhost:3000> — el middleware redirige al idioma detectado a partir de `Accept-Language` (o de la cookie `NEXT_LOCALE`).

### Scripts

| Comando | Descripción |
| --- | --- |
| `pnpm dev` | servidor de desarrollo |
| `pnpm build` | compilación de producción |
| `pnpm start` | sirve la compilación de producción |
| `pnpm test` | pruebas unitarias (Vitest) |
| `pnpm test:watch` | pruebas en modo watch |
| `pnpm typecheck` | comprobación de tipos con `tsc --noEmit` |

## Despliegue en Vercel

El despliegue actual está en <https://sound-capsule-lastfm.vercel.app>.

1. Sube el proyecto a un repositorio de GitHub/GitLab/Bitbucket.
2. En Vercel, haz clic en **Add New → Project** e importa el repositorio.
3. El preset **Next.js** se detecta automáticamente. Confirma:
   - Install Command: `pnpm install`
   - Build Command: `pnpm build`
   - Output: valor predeterminado de Next.js
4. En **Settings → Environment Variables**, añade `LASTFM_API_KEY` en Production (y, si quieres probar las previsualizaciones, también en Preview/Development).
5. Despliega. No hay base de datos, migraciones, cron jobs ni almacenamiento que configurar.
6. Opcional: configura un dominio personalizado en **Settings → Domains**.

El proyecto se ha diseñado para el plan **Hobby** (personal/no comercial): cada cápsula típica realiza ~60–176 invocaciones de función, y el almacenamiento en caché de la CDN evita repetir llamadas estables. La subida de fotos es 100 % local, así que no consume función, ancho de banda ni el límite de cuerpo de 4,5 MB de Vercel.

Notas de producción:

- Los route handlers usan `AbortSignal.timeout(10s)` para el upstream; cada llamada es corta e independiente.
- `track.getInfo` y las imágenes permanecen 24 h en la CDN; los datos de usuario permanecen 1–5 min. Los errores nunca se almacenan en caché.
- El proxy de imágenes responde en modo streaming para no alcanzar el límite de 4,5 MB de las respuestas sin streaming.
- Las fuentes CJK se autoalojan mediante `next/font` durante la compilación; el entorno necesita acceso a Google Fonts.

## Estructura

```text
app/
  [locale]/
    layout.tsx            # layout raíz: fuentes, proveedor de i18n, metadata/SEO
    page.tsx              # pantalla de inicio (servidor) + CapsuleStudio (cliente)
    [...rest]/page.tsx    # rutas desconocidas → notFound()
  api/
    lastfm/route.ts       # proxy con lista de permitidos de métodos y parámetros
    artist-image/route.ts # búsqueda en Deezer + coincidencia normalizada
    image-proxy/route.ts  # proxy de imágenes (lista de permitidos + streaming)
  robots.ts               # robots.txt (bloquea /api/, apunta al sitemap)
  sitemap.ts              # sitemap de las 11 rutas con alternates
  globals.css             # tokens de diseño (Tailwind 4)
  icon.svg                # marca/favicon
components/
  CapsuleStudio.tsx       # formulario, tema, subida, progreso, export/share/embed
  CapsuleCard.tsx         # tarjeta 432×768 con créditos y tema
  CardHero.tsx            # foto del artista/subida o respaldo en canvas
  BackgroundCanvas.tsx    # ondas de fondo (ratón, reduced motion, oculto)
  SiteHeader.tsx / SiteFooter.tsx / BrandMark.tsx
  LocaleSwitcher.tsx      # desplegable de idioma personalizado y accesible
i18n/                     # enrutado/petición/navegación de next-intl
lib/
  lastfmClient.ts         # paginación, concurrencia, pacer, retry/backoff, abort
  aggregate.ts            # agregación y estimación de minutos (probado)
  periods.ts              # intervalos, límite de 3 meses, Intl
  artistMatch.ts          # coincidencia normalizada en Deezer
  artistImage.ts          # resolución/precarga de la foto principal
  localPhoto.ts           # validación/redimensionado local de la foto subida
  cardThemes.ts           # acentos fijos y persistencia solo del id
  studioSession.ts        # estado en memoria para cambiar de idioma
  site.ts / httpCache.ts  # URL/User-Agent y cabeceras de caché
  exportCard.ts           # incrustación de fuentes + html-to-image → PNG 1080×1920
  initials.ts / locales.ts
public/
  og.png                  # vista previa Open Graph/Twitter 1200×630
  llms.txt                # resumen del proyecto para agentes/LLM
messages/                 # pt, en, es, fr, de, it, ja, ko, zh, ru, pl
tests/                    # Vitest
docs/screenshots/         # capturas de referencia
```

## Vista previa de enlaces, SEO y descubrimiento

- `metadataBase` + Open Graph/Twitter Card en las 11 rutas, con título y descripción localizados.
- Imagen `public/og.png` (1200×630) usada en `og:image` y `twitter:image`; es la vista previa que se muestra al pegar el enlace en WhatsApp, Discord, Telegram, Twitter/X, etc.
- `/robots.txt` generado por `app/robots.ts`, que permite el sitio, bloquea `/api/` y apunta al sitemap.
- `/sitemap.xml` generado por `app/sitemap.ts`, con las 11 rutas y alternates `hreflang`.
- `/llms.txt` con un resumen factual del producto, las fuentes de datos y la política de privacidad para agentes de IA.

## Decisiones técnicas

### ¿Por qué `user.getRecentTracks` en lugar de `user.getTopTracks`?

`getTopTracks`/`getTopArtists` solo aceptan ventanas fijas (`7day`, `1month`…), y el «mes» de Last.fm no es el mes natural actual. La aplicación pagina `user.getRecentTracks` con `from`/`to` (unix) y agrega en local, garantizando que **«mes actual»** sea exactamente desde el día 1 hasta ahora en la zona horaria del visitante.

- `limit=200` por página; la primera página descubre `totalPages`.
- Las páginas restantes se ejecutan en paralelo con **concurrencia 3**, con una **pausa de 150 ms entre llamadas** para mantenerse dentro de las indicaciones de uso de Last.fm.
- Reintentos con **backoff exponencial** para el error 29 (límite de peticiones), 5xx y fallos de red.
- La pista «now playing» (`@attr.nowplaying`) se ignora.
- El botón **Cancelar** aborta todas las solicitudes en curso (`AbortController`).

### Tiempo de escucha

Last.fm no expone el tiempo de escucha. La estimación:

1. Obtiene la duración real (`track.getInfo` → `duration` en ms) de las **50 pistas más escuchadas** (concurrencia 3).
2. Las pistas sin duración, con duración 0 o fuera del top 50 usan **3,5 min (210 s)**.
3. `minutos = redondear(Σ duración × scrobbles / 60,000)`.

La interfaz muestra el valor como aproximado (`≈ 66 minutos`) y el tooltip explica el cálculo. El valor de respaldo y el límite del top 50 son configurables en `lib/periods.ts`.

### Foto del artista

Last.fm ya no devuelve fotos reales (usa un placeholder). La aplicación llama a Deezer, elige el resultado con la mejor similitud normalizada y prioriza la **coincidencia exacta más popular** entre nombres duplicados; sin eso, un «Twice» desconocido podría aparecer en lugar de TWICE. El usuario también puede subir una foto local (JPEG/PNG/WebP, hasta 10 MB): se redimensiona en el canvas y se usa solo en la memoria del navegador. Si no se encuentra nada, la tarjeta usa el respaldo procedural en canvas.

### Temas

Cinco acentos fijos en `lib/cardThemes.ts`; solo cambia el color de acento de la tarjeta (marca y tiempo de escucha). El id elegido es el único dato de tema que se guarda, en `localStorage`. El sitio en sí permanece neutro.

### Estado entre idiomas

`CapsuleStudio` mantiene los datos no localizados en un almacén en memoria (`lib/studioSession.ts`). Al cambiar de idioma, el componente se vuelve a montar, se hidrata desde el almacén y solo recalcula los textos con el nuevo locale — **cero solicitudes a Last.fm**. El idioma en sí se persiste en la cookie `NEXT_LOCALE`.

### Exportación 1080×1920

`html-to-image` renderiza la tarjeta (432×768) con `pixelRatio: 2.5`. Antes de exportar:

- `document.fonts.ready` + dos frames de layout;
- todas las `<img>` de la tarjeta se decodifican;
- una incrustación de fuentes a medida incluye **solo los subconjuntos cuyo `unicode-range` interseca los caracteres de la tarjeta**, lo que evita descargar megabytes de porciones CJK innecesarias.

El PNG final es exactamente **1080×1920** (verificado en un navegador, incluso con una foto subida por el usuario).

### Diseño

Paleta neutra, un único color de acento sólido por tarjeta, sin neón/degradados/glassmorphism:

| Token | Valor |
| --- | --- |
| Fondo | `#0f0f10` |
| Superficie del formulario | `#171719` |
| Campos de entrada | `#111113` |
| Cuerpo de la tarjeta | `#212121` |
| Acentos | Ember `#F06848`, Tide `#5B9DFF`, Moss `#7ED08A`, Plum `#C084FC`, Sand `#E7C27A` |
| Texto | `#f4f4f5` / atenuado `#a1a1aa` |

Tipografía: Geist (sans) + Geist Mono (números/detalles) + Noto Sans JP/KR/SC para CJK.

## Privacidad, seguridad y TOS

- `LASTFM_API_KEY` existe solo en el servidor; el cliente nunca la recibe.
- `/api/lastfm` acepta solo `user.getInfo`, `user.getRecentTracks` y `track.getInfo`; rechaza `api_key`/`format` enviados por el cliente, valida enteros (rangos y límites), el nombre de usuario y los caracteres de control.
- `/api/image-proxy` acepta solo URL `https` en `*.dzcdn.net`, revalida el host tras las redirecciones, exige `Content-Type: image/*` y responde en modo streaming.
- La aplicación envía un User-Agent identificable a Last.fm/Deezer.
- Atribución conforme a los [TOS de Last.fm](https://www.last.fm/api/tos): un enlace «powered by Last.fm» en el pie de página y los créditos «Data from Last.fm», perfil y URL del sitio en la tarjeta exportada.
- **Únicos datos persistidos**: idioma (cookie) y acento de la tarjeta (`localStorage`). No hay base de datos, almacenamiento de scrobbles, inicio de sesión ni cookies de sesión.
- Nada del historial del usuario se registra en los logs de la aplicación. El proyecto es personal y no comercial.

### Observabilidad

- Vercel Web Analytics (`@vercel/analytics`) y Speed Insights (`@vercel/speed-insights`) están instalados en el layout de locale.
- Ambos no usan cookies: no recopilan nombres de usuario, datos de la tarjeta ni datos de scrobbles.
- En Hobby, Web Analytics incluye 50.000 eventos al mes y Speed Insights incluye 10.000 eventos durante los últimos 30 días; ambos son gratuitos dentro de esos límites, y la recopilación se pausa en lugar de facturar el exceso.

## i18n

- Locales: `pt` (predeterminado, contenido pt-BR), `en`, `es`, `fr`, `de`, `it`, `ja`, `ko`, `zh` (chino simplificado), `ru` y `pl`.
- Detección mediante `Accept-Language` en el middleware (la cookie `NEXT_LOCALE` tiene prioridad); el cambio manual en la cabecera conserva la ruta y la tarjeta en memoria. El selector es un desplegable personalizado, no el `<select>` nativo.
- Las fechas y los números usan `Intl` con el locale regional correcto (`pt-BR`, `en-US`, `es-ES`, `fr-FR`, `de-DE`, `it-IT`, `ja-JP`, `ko-KR`, `zh-CN`, `ru-RU`, `pl-PL`).
- El texto de la tarjeta se traduce junto con la interfaz; la imagen exportada ya usa el idioma activo.
- Fuentes: Geist carga latin/latin-ext/cirílico; Noto Sans JP/KR/SC cubre los caracteres CJK de la tarjeta.

## Pruebas

```bash
pnpm test        # 108 pruebas unitarias
pnpm typecheck
pnpm build
```

Cobertura actual:

- normalización de las URL de perfil pegadas en el campo de usuario;
- agregación de scrobbles, desempates, CJK y cálculo del tiempo de escucha;
- intervalos de periodo, el límite de **3 meses de calendario**, meses de febrero y de 31 días, registro, futuro e `Intl`;
- cliente de Last.fm con `fetch` simulado: paginación, now playing, reintentos 29/red, abort, duraciones del top 50, errores 6/17, fecha de registro (`unixtime`);
- coincidencia de artistas en Deezer (incluido el desempate por popularidad entre nombres duplicados);
- rutas de API: lista de permitidos, clave del servidor, User-Agent, cabeceras de caché, streaming del proxy de imágenes;
- temas y almacén de sesión;
- validación de la subida local (tipo/tamaño).

Además, el flujo se verificó en Chromium con Last.fm/Deezer simulados: tema, subida, créditos, nombre de usuario oculto, embed autocontenido (portapapeles), cambio de idioma sin nuevas solicitudes, desplegable personalizado (ratón, teclado y clic fuera), rutas `ko`/`ru`/`zh`/`pl`, desplazamiento automático a la vista previa en móvil, solo cookie/localStorage permitidos, F5, validación de 3 meses y exportación **1080×1920**. El flujo real también se ejecutó contra la API de Last.fm/Deezer con un perfil activo.

## Limitaciones conocidas

- **Periodo máximo de 3 meses de calendario**: diseñado para ajustarse al uso razonable de Last.fm y al plan Hobby. Los resúmenes anuales requerirían otra arquitectura/límite.
- **El tiempo de escucha es una estimación**: depende de las duraciones de `track.getInfo` y del respaldo de 210 s; las pistas en directo y los remixes pueden divergir.
- **Las fotos vienen de Deezer**: la coincidencia por nombre puede fallar en artistas homónimos o no encontrar nada (usa el respaldo en canvas). Los nombres en otro alfabeto (p. ej., 南翔子, indexado como «Shoko Minami») pueden no tener coincidencia. La subida local cubre esos casos.
- **Las subidas no se persisten**: la foto existe solo en la memoria y desaparece al pulsar F5, igual que el resultado y el nombre de usuario.
- **Los perfiles privados** («hide recent listening») devuelven el error 17; la aplicación explica cómo activarlo.
- **La exportación en el cliente** depende del navegador (probado en Chromium). En dispositivos antiguos o Safari con poca memoria el PNG puede fallar; hay un mensaje de error.
- **La Web Share API** no está disponible en todos los navegadores; en esos casos la aplicación descarga el PNG.
- La tarjeta solo renderiza fotos y fuentes cuando han terminado de cargarse; la vista previa espera a la carga antes de habilitar el PNG.

## Solución de problemas

| Síntoma | Causa probable / solución |
| --- | --- |
| «Al servidor le falta la clave de API» | falta `LASTFM_API_KEY` en `.env.local` (o en Vercel); reinicia el servidor. |
| «Usuario no encontrado» | nombre de usuario inválido o inexistente; compruébalo en `last.fm/user/<name>`. |
| «Scrobbles privados» | activa «Mostrar audición reciente» en la configuración de privacidad de Last.fm. |
| «No hay scrobbles en el periodo» | el periodo elegido no tiene historial público. |
| «Límite de peticiones» | espera y vuelve a intentarlo; la aplicación ya aplica una pausa y backoff. |
| Vista previa sin foto | Deezer no encontró al artista; sube una foto o usa el respaldo geométrico. |
| «Usa JPEG, PNG o WebP» / «máximo 10 MB» | formato o tamaño de la foto local fuera del rango permitido. |
| Las fuentes CJK no aparecen | comprueba que la compilación pudo descargar Noto Sans JP/KR/SC de Google Fonts. |
| La compilación falla en `prerender /404` | síntoma de `node_modules` corrupto; elimina `node_modules` y ejecuta `pnpm install` de nuevo. |

## Aviso legal

Sound Capsule es un proyecto independiente, no afiliado a Last.fm ni a ningún servicio de streaming. Los datos musicales son públicos y los proporciona la API de Last.fm; las fotos de artistas proceden de Deezer o del usuario. El uso del plan Hobby de Vercel es personal y no comercial.
