**English** · [Português](README.pt-BR.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Italiano](README.it.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [Русский](README.ru.md) · [Polski](README.pl.md)

# Sound Capsule

Aus Last.fm-Scrobbles wird eine **vertikale 1080×1920-Sound-Kapsel** (Story-Format), bereit zum Herunterladen oder Teilen. Die Aggregation erfolgt vollständig im Browser, ohne Login und ohne Datenbank.

**Deployment:** <https://sound-capsule-lastfm.vercel.app>

![Generierte Karte](docs/screenshots/capsule-1080x1920.png)

> Die Screenshots verwenden simulierte Daten, um die Zustände der Oberfläche zu zeigen. Das Hintergrundbild der Karte ist ein synthetisches Testporträt; in der Produktion stammt es von Deezer oder aus einem hochgeladenen Foto.

Beispiel mit japanischen, koreanischen und chinesischen Namen im exportierten PNG: [Karte CJK](docs/screenshots/cjk-1080x1920.png).

## Funktionen

- **Startseite** mit Nutzereingabe (akzeptiert den Benutzernamen oder die Profil-URL), Zeitraum (letzte Woche, aktueller Monat oder benutzerdefinierter Bereich), 9:16-Vorschau sowie Aktionen zum Herunterladen und Teilen.
- **Benutzerdefinierter Zeitraum mit maximal 3 Kalendermonaten** — kein festes 90-Tage-Fenster, und die gewählten Daten sind nicht eingeschränkt (vom Last.fm-Registrierungsdatum bis heute).
- **9:16-Karte** (432×768 CSS, exportiert als 1080×1920-PNG) mit den oberen 30 % als Künstlerfoto und einem soliden `#212121`-Körper.
- **Fünf feste Farbthemen** (Ember, Tide, Moss, Plum, Sand), die nur die Akzentfarbe der Karte ändern — kein freier Farbwähler.
- **Künstlerfoto** in drei Ebenen: automatische Zuordnung auf Deezer → optionaler lokaler Upload (wird nie an den Server gesendet) → Canvas-Fallback mit Initialen.
- **Zwei nummerierte Spalten** (Top-Künstler und Top-Titel, 1–5) mit Ellipsen-Kürzung und CJK-Unterstützung (Japanisch, Koreanisch und Chinesisch).
- **Geschätzte Hörzeit** in solider Themenfarbe hervorgehoben, ein Tooltip zur Erklärung der Berechnung und Formatierung über `Intl`.
- **Eigenständiges Embed**: Die Schaltfläche „Embed-Code kopieren“ erzeugt einen HTML-Block `<a><img></a>` mit dem PNG als Base64 — ohne Upload, ohne Speicherung und ohne Abhängigkeit von einer gehosteten Bild-URL (~0,5–0,8 MB). Funktioniert dort, wo rohes HTML erlaubt ist.
- **Linkvorschau**: Wenn die Site-URL in WhatsApp, Discord, Twitter/X, Telegram usw. eingefügt wird, erscheinen ein lokalisierter Titel, eine Beschreibung und ein gebrandetes Open-Graph-Bild mit 1200×630.
- **Echter Paginierungsfortschritt** („Seite 12 von 40“), ein Skeleton in der Vorschau und Abbruch über `AbortController`.
- **i18n** in `pt`, `en`, `es`, `fr`, `de`, `it`, `ja`, `ko`, `zh`, `ru` und `pl`, mit `Accept-Language`-Erkennung, präfixierten Routen, über `Intl` formatierten Texten/Daten/Zahlen und einem eigenen, barrierefreien Sprachen-Dropdown.
- **Karten-Credits** („Data from Last.fm“, Profil-Link und Site-URL) mit der Option, den Benutzernamen auf der Karte auszublenden.
- **`<canvas>`-Hintergrund** mit dezenten Wellenlinien, die auf die Maus reagieren, bei ausgeblendetem Tab pausieren und sich mit `prefers-reduced-motion` abschalten.
- **Barrierefrei**: Tastaturnavigation, Labels, `role="progressbar"`, Alerts, AA-Kontrast und Berücksichtigung reduzierter Animationen.
- **Observability**: Vercel Web Analytics und Speed Insights, cookielos, zur Messung von Besuchen und Core Web Vitals.

## Persistenz: nur Sprache und Theme

| Daten | Speicherort | Details |
| --- | --- | --- |
| Sprache | `NEXT_LOCALE`-Cookie | nur `pt`, `en`, … |
| Kartenfarbe | `localStorage` (`sound-capsule:theme`) | nur die Akzent-ID |
| Benutzername, Daten, API-Ergebnis, hochgeladenes Foto | **Arbeitsspeicher** | gehen bei F5 verloren |

Ein Sprachwechsel behält Benutzername und Karte im Arbeitsspeicher (ohne neue Anfragen an Last.fm), ein Reload löscht diese Daten jedoch. Es werden keine Scrobble-, Verlaufs- oder Fotodaten persistiert.

## Stack

| Ebene | Wahl |
| --- | --- |
| Framework | Next.js 15 (App Router) + TypeScript |
| Styling | Tailwind CSS 4 |
| i18n | `next-intl` 4 |
| Bildexport | `html-to-image` (clientseitig) |
| Tests | Vitest |
| Deployment | Vercel (serverless, statisch + Route Handlers) |

## Wie es funktioniert

```text
Browser
  ├─ validiert Nutzer/Zeitraum (max. 3 Kalendermonate)
  ├─ /api/lastfm  ──────────►  Last.fm-API (Key serverseitig injiziert)
  │     └─ user.getInfo, user.getRecentTracks, track.getInfo
  ├─ lädt ALLE Scrobble-Seiten (Parallelität 3 + 150-ms-Pacer)
  ├─ aggregiert im Arbeitsspeicher: Top-Künstler, Top-Titel, Hörzeit
  ├─ /api/artist-image ─────►  Deezer-Suche (beste normalisierte Übereinstimmung)
  ├─ /api/image-proxy  ─────►  Deezer-CDN (Allowlist *.dzcdn.net)
  ├─ optionales Nutzerfoto ─►  lokales Canvas (verlässt den Browser nicht)
  └─ rendert die Karte im DOM und exportiert ein 1080×1920-PNG
```

Die App lädt beim Seitenaufruf keine Daten; erst wenn auf Generieren geklickt wird. Öffentliche Antworten nutzen CDN-Caching mit `Vercel-CDN-Cache-Control`; ein Cache-Hit ruft die Funktion nicht auf.

## Lokal ausführen

### Voraussetzungen

- Node.js **20.9+**
- pnpm **9+** (das Repository wurde mit pnpm 11 entwickelt)

### 1. Last.fm-API-Key besorgen

1. <https://www.last.fm/api/account/create> aufrufen.
2. App-Namen (z. B. *Sound Capsule*), die URL `https://sound-capsule-lastfm.vercel.app` und die Beschreibung eintragen.
3. Den erzeugten **API-Key** kopieren (das *shared secret* wird nicht benötigt, da es keine Benutzerauthentifizierung gibt).

### 2. Umgebung konfigurieren

```bash
cp .env.example .env.local
# .env.local bearbeiten und ausfüllen:
LASTFM_API_KEY=your_key_here
```

Die Variable ist **nur serverseitig**. Das Präfix `NEXT_PUBLIC_` darf nie verwendet werden, und sie gelangt nicht in das Client-Bundle.

### 3. Installieren und starten

```bash
pnpm install
pnpm dev
```

<http://localhost:3000> öffnen — die Middleware leitet auf die anhand von `Accept-Language` erkannte Locale weiter (oder die aus dem `NEXT_LOCALE`-Cookie).

### Scripts

| Befehl | Beschreibung |
| --- | --- |
| `pnpm dev` | Entwicklungsserver |
| `pnpm build` | Produktions-Build |
| `pnpm start` | stellt den Produktions-Build bereit |
| `pnpm test` | Unit-Tests (Vitest) |
| `pnpm test:watch` | Tests im Watch-Modus |
| `pnpm typecheck` | Typprüfung mit `tsc --noEmit` |

## Deployment auf Vercel

Das aktuelle Deployment befindet sich unter <https://sound-capsule-lastfm.vercel.app>.

1. Das Projekt in ein Repository auf GitHub/GitLab/Bitbucket pushen.
2. In Vercel auf **Add New → Project** klicken und das Repository importieren.
3. Das **Next.js**-Preset wird automatisch erkannt. Bestätigen:
   - Install Command: `pnpm install`
   - Build Command: `pnpm build`
   - Output: Next.js-Standard
4. Unter **Settings → Environment Variables** `LASTFM_API_KEY` in Production hinzufügen (und, um Previews zu testen, auch in Preview/Development).
5. Deployen. Es gibt keine Datenbank, Migrationen, Cronjobs oder Speicher zu konfigurieren.
6. Optional: eine eigene Domain unter **Settings → Domains** konfigurieren.

Das Projekt ist für den **Hobby**-Plan (privat/nicht kommerziell) konzipiert: Eine typische Kapsel löst ~60–176 Funktionsaufrufe aus, und CDN-Caching vermeidet wiederholte stabile Aufrufe. Der Foto-Upload erfolgt zu 100 % lokal und verbraucht daher keine Funktion, keine Bandbreite und nicht das 4,5-MB-Body-Limit von Vercel.

Produktionshinweise:

- Die Route Handlers verwenden `AbortSignal.timeout(10s)` für das Upstream; jeder Aufruf ist kurz und unabhängig.
- `track.getInfo` und Bilder bleiben 24 h im CDN; Nutzerdaten bleiben 1–5 min. Fehler werden nie gecacht.
- Der Bild-Proxy antwortet im Streaming-Modus, um das 4,5-MB-Limit für nicht gestreamte Antworten nicht zu erreichen.
- Die CJK-Schriften werden während des Builds von `next/font` selbst gehostet; die Umgebung benötigt Zugriff auf Google Fonts.

## Struktur

```text
app/
  [locale]/
    layout.tsx            # Root-Layout: Schriften, i18n-Provider, Metadata/SEO
    page.tsx              # Startseite (Server) + CapsuleStudio (Client)
    [...rest]/page.tsx    # unbekannte Routen → notFound()
  api/
    lastfm/route.ts       # Proxy mit Allowlist für Methoden und Parameter
    artist-image/route.ts # Deezer-Suche + normalisierter Abgleich
    image-proxy/route.ts  # Bild-Proxy (Allowlist + Streaming)
  robots.ts               # robots.txt (blockiert /api/, verweist auf die Sitemap)
  sitemap.ts              # Sitemap der 11 Routen mit Alternates
  globals.css             # Design-Tokens (Tailwind 4)
  icon.svg                # Marke/Favicon
components/
  CapsuleStudio.tsx       # Formular, Theme, Upload, Fortschritt, Export/Share/Embed
  CapsuleCard.tsx         # 432×768-Karte mit Credits und Theme
  CardHero.tsx            # Künstlerfoto/Upload oder Canvas-Fallback
  BackgroundCanvas.tsx    # Hintergrundwellen (Maus, Reduced Motion, ausgeblendet)
  SiteHeader.tsx / SiteFooter.tsx / BrandMark.tsx
  LocaleSwitcher.tsx      # eigenes, barrierefreies Sprachen-Dropdown
i18n/                     # next-intl Routing/Request/Navigation
lib/
  lastfmClient.ts         # Paginierung, Parallelität, Pacer, Retry/Backoff, Abbruch
  aggregate.ts            # Aggregation und Minuten-Schätzung (getestet)
  periods.ts              # Intervalle, 3-Monats-Limit, Intl
  artistMatch.ts          # normalisierter Deezer-Abgleich
  artistImage.ts          # Auflösung/Vorladen des Hero-Fotos
  localPhoto.ts           # lokale Validierung/Größenänderung des Upload-Fotos
  cardThemes.ts           # feste Akzente und Persistenz nur der ID
  studioSession.ts        # In-Memory-Zustand für den Sprachwechsel
  site.ts / httpCache.ts  # URL/User-Agent und Cache-Header
  exportCard.ts           # Font-Einbettung + html-to-image → 1080×1920-PNG
  initials.ts / locales.ts
public/
  og.png                  # Open-Graph/Twitter-Vorschau 1200×630
  llms.txt                # Projektzusammenfassung für Agenten/LLMs
messages/                 # pt, en, es, fr, de, it, ja, ko, zh, ru, pl
tests/                    # Vitest
docs/screenshots/         # Referenz-Screenshots
```

## Linkvorschau, SEO und Auffindbarkeit

- `metadataBase` + Open Graph/Twitter Card auf allen 11 Routen, mit lokalisiertem Titel und lokalisierter Beschreibung.
- Bild `public/og.png` (1200×630), verwendet in `og:image` und `twitter:image`; es ist die Vorschau, die beim Einfügen des Links in WhatsApp, Discord, Telegram, Twitter/X usw. erscheint.
- `/robots.txt`, erzeugt von `app/robots.ts`: erlaubt die Site, blockiert `/api/` und verweist auf die Sitemap.
- `/sitemap.xml`, erzeugt von `app/sitemap.ts`, mit den 11 Routen und `hreflang`-Alternates.
- `/llms.txt` mit einer sachlichen Zusammenfassung des Produkts, der Datenquellen und der Datenschutzrichtlinie für KI-Agenten.

## Technische Entscheidungen

### Warum `user.getRecentTracks` statt `user.getTopTracks`?

`getTopTracks`/`getTopArtists` akzeptieren nur feste Fenster (`7day`, `1month`…), und der „Monat“ von Last.fm ist nicht der aktuelle Kalendermonat. Die App paginiert `user.getRecentTracks` mit `from`/`to` (Unix) und aggregiert lokal, sodass **„aktueller Monat“** genau vom 1. Tag bis jetzt in der Zeitzone des Besuchers reicht.

- `limit=200` pro Seite; die erste Seite ermittelt `totalPages`.
- Die übrigen Seiten laufen parallel mit **Parallelität 3**, mit einem **Pacer von 150 ms zwischen den Aufrufen**, um die Nutzungshinweise von Last.fm einzuhalten.
- Retry mit **exponentiellem Backoff** für Fehler 29 (Rate Limit), 5xx und Netzwerkfehler.
- Der „now playing“-Titel (`@attr.nowplaying`) wird ignoriert.
- Die Schaltfläche **Abbrechen** bricht alle laufenden Anfragen ab (`AbortController`).

### Hörzeit

Last.fm stellt keine Hörzeit bereit. Die Schätzung:

1. Die echte Dauer (`track.getInfo` → `duration` in ms) wird für die **50 meistgehörten Titel** abgerufen (Parallelität 3).
2. Titel ohne Dauer, mit Dauer 0 oder außerhalb der Top 50 verwenden **3,5 min (210 s)**.
3. `Minuten = runden(Σ Dauer × Scrobbles / 60,000)`.

Die UI zeigt den Wert als Näherung (`≈ 66 Minuten`) und der Tooltip erklärt die Berechnung. Fallback und Top-50-Limit sind in `lib/periods.ts` konfigurierbar.

### Künstlerfoto

Last.fm liefert keine echten Fotos mehr (nur Platzhalter). Die App ruft Deezer auf, wählt das Ergebnis mit der besten normalisierten Ähnlichkeit und priorisiert bei doppelten Namen die **populärste exakte Übereinstimmung** — ohne das könnte ein obskures „Twice“ statt TWICE erscheinen. Nutzer können zudem ein lokales Foto hochladen (JPEG/PNG/WebP, bis 10 MB): Es wird auf dem Canvas skaliert und nur im Arbeitsspeicher des Browsers verwendet. Wird nichts gefunden, verwendet die Karte den prozeduralen Canvas-Fallback.

### Themes

Fünf feste Akzente in `lib/cardThemes.ts`; nur die Akzentfarbe der Karte ändert sich (Marke und Hörzeit). Die gewählte ID ist der einzige gespeicherte Theme-Wert, in `localStorage`. Die Site selbst bleibt neutral.

### Zustand über Sprachen hinweg

`CapsuleStudio` hält die nicht lokalisierten Daten in einem In-Memory-Store (`lib/studioSession.ts`). Beim Sprachwechsel wird die Komponente neu gemountet und aus dem Store hydratisiert; dabei werden nur die Texte mit der neuen Locale neu berechnet — **null Anfragen an Last.fm**. Die Sprache selbst wird im `NEXT_LOCALE`-Cookie persistiert.

### Export 1080×1920

`html-to-image` rendert die Karte (432×768) mit `pixelRatio: 2.5`. Vor dem Export:

- `document.fonts.ready` + zwei Layout-Frames;
- jedes `<img>` in der Karte wird dekodiert;
- eine maßgeschneiderte Font-Einbettung enthält **nur die Subsets, deren `unicode-range` die Zeichen der Karte schneidet**, um nicht Megabyte unnötiger CJK-Slices herunterzuladen.

Das finale PNG ist exakt **1080×1920** (im Browser verifiziert, auch mit einem vom Nutzer hochgeladenen Foto).

### Design

Neutrale Palette, pro Karte eine einzige solide Akzentfarbe, kein Neon/Verlauf/Glassmorphism:

| Token | Wert |
| --- | --- |
| Hintergrund | `#0f0f10` |
| Formularfläche | `#171719` |
| Eingaben | `#111113` |
| Kartenkörper | `#212121` |
| Akzente | Ember `#F06848`, Tide `#5B9DFF`, Moss `#7ED08A`, Plum `#C084FC`, Sand `#E7C27A` |
| Text | `#f4f4f5` / gedämpft `#a1a1aa` |

Typografie: Geist (Sans) + Geist Mono (Zahlen/Details) + Noto Sans JP/KR/SC für CJK.

## Datenschutz, Sicherheit und TOS

- `LASTFM_API_KEY` existiert nur auf dem Server; der Client erhält ihn nie.
- `/api/lastfm` akzeptiert nur `user.getInfo`, `user.getRecentTracks` und `track.getInfo`; es lehnt vom Client gesendete `api_key`/`format` ab, validiert Ganzzahlen (Bereiche und Limits), den Benutzernamen und Steuerzeichen.
- `/api/image-proxy` akzeptiert nur `https`-URLs auf `*.dzcdn.net`, revalidiert den Host nach Weiterleitungen, verlangt `Content-Type: image/*` und antwortet im Streaming-Modus.
- Die App sendet einen identifizierbaren User-Agent an Last.fm/Deezer.
- Namensnennung gemäß den [Last.fm TOS](https://www.last.fm/api/tos): ein „powered by Last.fm“-Link im Footer und die Credits „Data from Last.fm“, Profil und Site-URL auf der exportierten Karte.
- **Einzige persistierte Daten**: Sprache (Cookie) und Kartenakzent (`localStorage`). Es gibt keine Datenbank, keinen Scrobble-Speicher, keinen Login und keine Session-Cookies.
- Nichts aus dem Verlauf der Nutzer wird in den App-Logs aufgezeichnet. Das Projekt ist privat und nicht kommerziell.

### Observability

- Vercel Web Analytics (`@vercel/analytics`) und Speed Insights (`@vercel/speed-insights`) sind im Locale-Layout eingebunden.
- Beide sind cookielos: Sie erfassen keine Benutzernamen, Kartendaten oder Scrobble-Daten.
- Im Hobby-Plan umfasst Web Analytics 50.000 Events/Monat und Speed Insights 10.000 Events in den letzten 30 Tagen; beide sind innerhalb dieser Limits kostenlos, und die Erfassung pausiert, statt Überschreitungen in Rechnung zu stellen.

## i18n

- Locales: `pt` (Standard, pt-BR-Inhalt), `en`, `es`, `fr`, `de`, `it`, `ja`, `ko`, `zh` (vereinfachtes Chinesisch), `ru` und `pl`.
- Erkennung über `Accept-Language` in der Middleware (das `NEXT_LOCALE`-Cookie hat Vorrang); manuelles Umschalten im Header behält die Route und die Karte im Arbeitsspeicher. Der Selektor ist ein eigenes Dropdown, nicht das native `<select>`.
- Daten und Zahlen verwenden `Intl` mit der korrekten regionalen Locale (`pt-BR`, `en-US`, `es-ES`, `fr-FR`, `de-DE`, `it-IT`, `ja-JP`, `ko-KR`, `zh-CN`, `ru-RU`, `pl-PL`).
- Der Kartentext wird zusammen mit der Oberfläche übersetzt; das exportierte Bild verwendet bereits die aktive Sprache.
- Schriften: Geist lädt Latin/Latin-Ext/Kyrillisch; Noto Sans JP/KR/SC deckt die CJK-Zeichen der Karte ab.

## Tests

```bash
pnpm test        # 108 Unit-Tests
pnpm typecheck
pnpm build
```

Aktuelle Abdeckung:

- Normalisierung von Profil-URLs, die in das Nutzerfeld eingefügt werden;
- Scrobble-Aggregation, Tie-Breaker, CJK und Hörzeit-Berechnung;
- Zeitraumsintervalle, das **3-Kalendermonats**-Limit, Februar/31-Tage-Monate, Registrierung, Zukunft und `Intl`;
- Last.fm-Client mit gemocktem `fetch`: Paginierung, Now Playing, Retry 29/Netzwerk, Abbruch, Top-50-Dauern, Fehler 6/17, Registrierungsdatum (`unixtime`);
- Deezer-Künstlerabgleich (inklusive Popularitäts-Tie-Breaking bei doppelten Namen);
- API-Routen: Allowlist, Server-Key, User-Agent, Cache-Header, Bild-Proxy-Streaming;
- Themes und Session-Store;
- Validierung des lokalen Uploads (Typ/Größe).

Zusätzlich wurde der Ablauf in Chromium mit simuliertem Last.fm/Deezer verifiziert: Theme, Upload, Credits, ausgeblendeter Benutzername, eigenständiges Embed (Zwischenablage), Sprachwechsel ohne neue Anfragen, eigenes Dropdown (Maus, Tastatur und Klick außerhalb), Routen `ko`/`ru`/`zh`/`pl`, automatisches Scrollen zur Vorschau auf Mobilgeräten, nur Cookie/localStorage erlaubt, F5, 3-Monats-Validierung und **1080×1920**-Export. Der reale Ablauf wurde außerdem gegen die Last.fm/Deezer-API mit einem aktiven Profil getestet.

## Bekannte Einschränkungen

- **Maximaler Zeitraum von 3 Kalendermonaten**: ausgelegt auf die vernünftige Nutzung von Last.fm und den Hobby-Plan. Jährliche Rückblicke würden eine andere Architektur bzw. ein anderes Limit erfordern.
- **Die Hörzeit ist eine Schätzung**: Sie hängt von den `track.getInfo`-Dauern und dem 210-s-Fallback ab; Live-Titel und Remixe können abweichen.
- **Fotos kommen von Deezer**: Der Namensabgleich kann bei gleichnamigen Künstlern fehlschlagen oder nichts finden (dann greift der Canvas-Fallback). Namen in einer anderen Schrift (z. B. 南翔子, indexiert als „Shoko Minami“) haben möglicherweise keinen Treffer. Der lokale Upload deckt diese Fälle ab.
- **Uploads werden nicht persistiert**: Das Foto existiert nur im Arbeitsspeicher und ist bei F5 weg, wie das Ergebnis und der Benutzername.
- **Private Profile** („hide recent listening“) liefern Fehler 17; die App erklärt, wie das aktiviert wird.
- **Clientseitiger Export** hängt vom Browser ab (in Chromium getestet). Auf alten Geräten oder Safari mit wenig Speicher kann das PNG fehlschlagen; es gibt eine Fehlermeldung.
- **Die Web Share API** ist nicht in jedem Browser verfügbar; in diesen Fällen lädt die App das PNG herunter.
- Die Karte rendert Fotos und Schriften erst nach dem Laden; die Vorschau wartet auf das Laden, bevor sie das PNG freigibt.

## Fehlerbehebung

| Symptom | Wahrscheinliche Ursache / Lösung |
| --- | --- |
| „Dem Server fehlt der API-Schlüssel“ | `LASTFM_API_KEY` fehlt in `.env.local` (oder bei Vercel); Server neu starten. |
| „Benutzer nicht gefunden“ | ungültiger oder nicht existierender Benutzername; unter `last.fm/user/<name>` prüfen. |
| „Private Scrobbles“ | „Kürzlich gehörte Titel anzeigen“ in den Last.fm-Datenschutzeinstellungen aktivieren. |
| „Keine Scrobbles im Zeitraum“ | der gewählte Zeitraum hat keinen öffentlichen Verlauf. |
| „Rate Limit“ | warten und erneut versuchen; die App nutzt bereits Pacer und Backoff. |
| Vorschau ohne Foto | Deezer hat den Künstler nicht gefunden; ein Foto hochladen oder den geometrischen Fallback verwenden. |
| „JPEG, PNG oder WebP verwenden“ / „maximal 10 MB“ | Format/Größe des lokalen Fotos außerhalb des erlaubten Bereichs. |
| CJK-Schriften erscheinen nicht | prüfen, ob der Build Noto Sans JP/KR/SC von Google Fonts herunterladen konnte. |
| Build schlägt bei `prerender /404` fehl | Symptom eines beschädigten `node_modules`; `node_modules` entfernen und `pnpm install` erneut ausführen. |

## Haftungsausschluss

Sound Capsule ist ein unabhängiges Projekt und nicht mit Last.fm oder einem Streaming-Dienst verbunden. Die Musikdaten sind öffentlich und werden von der Last.fm-API bereitgestellt; Künstlerfotos stammen von Deezer oder von Nutzern. Die Nutzung des Vercel-Hobby-Plans ist privat und nicht kommerziell.
