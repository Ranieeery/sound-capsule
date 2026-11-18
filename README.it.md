**English** · [Português](README.pt-BR.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Italiano](README.it.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [Русский](README.ru.md) · [Polski](README.pl.md)

# Sound Capsule

Trasforma i tuoi scrobble di Last.fm in una **capsula sonora verticale 1080×1920** (formato story) pronta da scaricare o condividere. L'aggregazione avviene interamente nel browser, senza login e senza database.

**Deploy:** <https://sound-capsule-lastfm.vercel.app>

![Card generata](docs/screenshots/capsule-1080x1920.png)

> Gli screenshot usano dati simulati per mostrare gli stati dell'interfaccia. L'immagine di sfondo della card è un ritratto sintetico di test; in produzione proviene da Deezer o da una foto caricata dall'utente.

Esempio con nomi giapponesi, coreani e cinesi resi nel PNG esportato: [card CJK](docs/screenshots/cjk-1080x1920.png).

## Funzionalità

- **Schermata iniziale** con input utente (accetta il nome utente o l'URL del profilo), periodo (ultima settimana, mese corrente o intervallo personalizzato), anteprima 9:16 e azioni di download/condivisione.
- **Periodo personalizzato con durata massima di 3 mesi di calendario** — nessuna finestra fissa di 90 giorni e nessuna restrizione sulle date scelte (dalla data di registrazione a Last.fm a oggi).
- **Card 9:16** (432×768 CSS, esportata come PNG 1080×1920) con il 30 % superiore come foto dell'artista e un corpo solido `#212121`.
- **Cinque temi colore fissi** (Ember, Tide, Moss, Plum, Sand) che cambiano solo l'accento della card — nessun color picker libero.
- **Foto dell'artista** su tre livelli: abbinamento automatico su Deezer → upload locale opzionale (mai inviato al server) → fallback canvas con iniziali.
- **Due colonne numerate** (Top artisti e Top brani, 1–5) con troncamento tramite puntini di sospensione e supporto CJK (giapponese, coreano e cinese).
- **Tempo di ascolto stimato** evidenziato a tinta piena del tema, un tooltip che spiega il calcolo e formattazione tramite `Intl`.
- **Embed autonomo**: il pulsante «Copia embed» genera un blocco HTML `<a><img></a>` con il PNG in base64 — senza upload, senza storage e senza dipendere da un URL immagine ospitato (~0,5–0,8 MB). Funziona dove è consentito l'HTML grezzo.
- **Anteprima del link**: incollando l'URL del sito in WhatsApp, Discord, Twitter/X, Telegram ecc., compaiono titolo e descrizione localizzati e un'immagine Open Graph brandizzata 1200×630.
- **Avanzamento reale della paginazione** («Pagina 12 di 40»), skeleton nell'anteprima e annullamento con `AbortController`.
- **i18n** in `pt`, `en`, `es`, `fr`, `de`, `it`, `ja`, `ko`, `zh`, `ru` e `pl`, con rilevamento tramite `Accept-Language`, route con prefisso, testi/date/numeri formattati con `Intl` e un menu a tendina della lingua personalizzato e accessibile.
- **Crediti sulla card** («Data from Last.fm», link al profilo e URL del sito), con opzione per nascondere il nome utente dalla card.
- **Sfondo `<canvas>`** con sottili linee d'onda che reagiscono al mouse, si mettono in pausa quando la scheda è nascosta e si disattivano con `prefers-reduced-motion`.
- **Accessibile**: navigazione da tastiera, label, `role="progressbar"`, alert, contrasto AA e rispetto della riduzione del movimento.
- **Osservabilità**: Vercel Web Analytics e Speed Insights, senza cookie, per monitorare visite e Core Web Vitals.

## Persistenza: solo lingua e tema

| Dato | Dove viene salvato | Dettaglio |
| --- | --- | --- |
| Lingua | cookie `NEXT_LOCALE` | solo `pt`, `en`, … |
| Colore della card | `localStorage` (`sound-capsule:theme`) | solo l'id dell'accento |
| Nome utente, date, risultato API, foto caricata | **memoria** | persi al refresh (F5) |

Cambiare lingua conserva nome utente e card in memoria (senza nuove richieste a Last.fm), ma un reload cancella questi dati. Nessun dato di scrobble, cronologia o foto viene persistito.

## Stack

| Livello | Scelta |
| --- | --- |
| Framework | Next.js 15 (App Router) + TypeScript |
| Styling | Tailwind CSS 4 |
| i18n | `next-intl` 4 |
| Export immagine | `html-to-image` (lato client) |
| Test | Vitest |
| Deploy | Vercel (serverless, statico + route handlers) |

## Come funziona

```text
Browser
  ├─ valida utente/periodo (max. 3 mesi di calendario)
  ├─ /api/lastfm  ──────────►  API Last.fm (chiave iniettata sul server)
  │     └─ user.getInfo, user.getRecentTracks, track.getInfo
  ├─ pagina TUTTE le pagine degli scrobble (concorrenza 3 + pacer da 150 ms)
  ├─ aggrega in memoria: top artisti, top brani, tempo di ascolto
  ├─ /api/artist-image ─────►  ricerca Deezer (migliore corrispondenza normalizzata)
  ├─ /api/image-proxy  ─────►  CDN di Deezer (allowlist *.dzcdn.net)
  ├─ foto utente opzionale ─►  canvas locale (non lascia mai il browser)
  └─ renderizza la card nel DOM ed esporta un PNG 1080×1920
```

L'app non recupera dati al caricamento della pagina; solo quando l'utente clicca su Genera. Le risposte pubbliche usano la cache CDN con `Vercel-CDN-Cache-Control`; un cache hit non invoca la function.

## Esecuzione in locale

### Requisiti

- Node.js **20.9+**
- pnpm **9+** (il repository è stato sviluppato con pnpm 11)

### 1. Ottenere una chiave API di Last.fm

1. Vai su <https://www.last.fm/api/account/create>.
2. Compila il nome dell'app (es. *Sound Capsule*), l'URL `https://sound-capsule-lastfm.vercel.app` e la descrizione.
3. Copia la **chiave API** generata (il *shared secret* non serve, perché non c'è autenticazione utente).

### 2. Configurare l'ambiente

```bash
cp .env.example .env.local
# modifica .env.local e compila:
LASTFM_API_KEY=your_key_here
```

La variabile è **solo lato server**. Non usare mai il prefisso `NEXT_PUBLIC_`, e non finisce nel bundle client.

### 3. Installare ed eseguire

```bash
pnpm install
pnpm dev
```

Apri <http://localhost:3000> — il middleware reindirizza alla lingua rilevata da `Accept-Language` (o dal cookie `NEXT_LOCALE`).

### Script

| Comando | Descrizione |
| --- | --- |
| `pnpm dev` | server di sviluppo |
| `pnpm build` | build di produzione |
| `pnpm start` | serve la build di produzione |
| `pnpm test` | test unitari (Vitest) |
| `pnpm test:watch` | test in watch mode |
| `pnpm typecheck` | verifica dei tipi con `tsc --noEmit` |

## Deploy su Vercel

Il deploy attuale è su <https://sound-capsule-lastfm.vercel.app>.

1. Carica il progetto su un repository GitHub/GitLab/Bitbucket.
2. In Vercel, clicca su **Add New → Project** e importa il repository.
3. Il preset **Next.js** viene rilevato automaticamente. Conferma:
   - Install Command: `pnpm install`
   - Build Command: `pnpm build`
   - Output: default di Next.js
4. In **Settings → Environment Variables**, aggiungi `LASTFM_API_KEY` in Production (e, se vuoi testare le preview, anche in Preview/Development).
5. Esegui il deploy. Non ci sono database, migrazioni, cron job o storage da configurare.
6. Opzionale: configura un dominio personalizzato in **Settings → Domains**.

Il progetto è pensato per il piano **Hobby** (personale/non commerciale): ogni capsula tipica effettua ~60–176 invocazioni di function, e la cache CDN evita di ripetere chiamate stabili. L'upload della foto è 100 % locale, quindi non consuma function, banda né il limite di 4,5 MB del corpo delle richieste di Vercel.

Note di produzione:

- I route handler usano `AbortSignal.timeout(10s)` per l'upstream; ogni chiamata è breve e indipendente.
- `track.getInfo` e le immagini restano in CDN per 24 h; i dati utente per 1–5 min. Gli errori non vengono mai messi in cache.
- Il proxy delle immagini risponde in modalità streaming per non raggiungere il limite di 4,5 MB delle risposte non in streaming.
- I font CJK sono self-hosted da `next/font` durante la build; l'ambiente deve poter accedere a Google Fonts.

## Struttura

```text
app/
  [locale]/
    layout.tsx            # layout radice: font, provider i18n, metadata/SEO
    page.tsx              # schermata iniziale (server) + CapsuleStudio (client)
    [...rest]/page.tsx    # route sconosciute → notFound()
  api/
    lastfm/route.ts       # proxy con allowlist di metodi e parametri
    artist-image/route.ts # ricerca Deezer + abbinamento normalizzato
    image-proxy/route.ts  # proxy immagini (allowlist + streaming)
  robots.ts               # robots.txt (blocca /api/, punta alla sitemap)
  sitemap.ts              # sitemap delle 11 route con alternates
  globals.css             # token di design (Tailwind 4)
  icon.svg                # brand/favicon
components/
  CapsuleStudio.tsx       # form, tema, upload, avanzamento, export/share/embed
  CapsuleCard.tsx         # card 432×768 con crediti e tema
  CardHero.tsx            # foto artista/upload o fallback canvas
  BackgroundCanvas.tsx    # onde di sfondo (mouse, reduced motion, nascosto)
  SiteHeader.tsx / SiteFooter.tsx / BrandMark.tsx
  LocaleSwitcher.tsx      # menu a tendina della lingua personalizzato e accessibile
i18n/                     # routing/request/navigation di next-intl
lib/
  lastfmClient.ts         # paginazione, concorrenza, pacer, retry/backoff, abort
  aggregate.ts            # aggregazione e stima dei minuti (testato)
  periods.ts              # intervalli, limite di 3 mesi, Intl
  artistMatch.ts          # abbinamento normalizzato Deezer
  artistImage.ts          # risoluzione/precaricamento della foto hero
  localPhoto.ts           # validazione/resize locale della foto caricata
  cardThemes.ts           # accenti fissi e persistenza solo dell'id
  studioSession.ts        # stato in memoria per il cambio lingua
  site.ts / httpCache.ts  # URL/User-Agent e header di cache
  exportCard.ts           # embed dei font + html-to-image → PNG 1080×1920
  initials.ts / locales.ts
public/
  og.png                  # anteprima Open Graph/Twitter 1200×630
  llms.txt                # riepilogo del progetto per agenti/LLM
messages/                 # pt, en, es, fr, de, it, ja, ko, zh, ru, pl
tests/                    # Vitest
docs/screenshots/         # screenshot di riferimento
```

## Anteprima del link, SEO e scoperta

- `metadataBase` + Open Graph/Twitter Card su tutte le 11 route, con titolo e descrizione localizzati.
- Immagine `public/og.png` (1200×630) usata in `og:image` e `twitter:image`; è l'anteprima mostrata quando il link viene incollato in WhatsApp, Discord, Telegram, Twitter/X ecc.
- `/robots.txt` generato da `app/robots.ts`, che consente il sito, blocca `/api/` e punta alla sitemap.
- `/sitemap.xml` generato da `app/sitemap.ts`, con le 11 route e gli alternates `hreflang`.
- `/llms.txt` con un riepilogo fattuale del prodotto, delle fonti dati e dell'informativa sulla privacy per gli agenti IA.

## Decisioni tecniche

### Perché `user.getRecentTracks` invece di `user.getTopTracks`?

`getTopTracks`/`getTopArtists` accettano solo finestre fisse (`7day`, `1month`…), e il «mese» di Last.fm non è il mese di calendario corrente. L'app pagina `user.getRecentTracks` con `from`/`to` (unix) e aggrega in locale, garantendo che **«mese corrente»** vada esattamente dal giorno 1 a oggi nel fuso orario del visitatore.

- `limit=200` per pagina; la prima pagina scopre `totalPages`.
- Le pagine rimanenti vengono eseguite in parallelo con **concorrenza 3**, con un **pacer di 150 ms tra le chiamate** per rispettare le indicazioni d'uso di Last.fm.
- Retry con **backoff esponenziale** per l'errore 29 (rate limit), i 5xx e i guasti di rete.
- Il brano «now playing» (`@attr.nowplaying`) viene ignorato.
- Il pulsante **Annulla** interrompe tutte le richieste in corso (`AbortController`).

### Tempo di ascolto

Last.fm non espone il tempo di ascolto. La stima:

1. Recupera la durata reale (`track.getInfo` → `duration` in ms) per i **50 brani più ascoltati** (concorrenza 3).
2. I brani senza durata, con durata 0 o fuori dalla top 50 usano **3,5 min (210 s)**.
3. `minuti = arrotondare(Σ durata × scrobble / 60,000)`.

L'interfaccia mostra il valore come approssimativo (`≈ 66 minuti`) e il tooltip spiega il calcolo. Il fallback e il limite della top 50 sono configurabili in `lib/periods.ts`.

### Foto dell'artista

Last.fm non restituisce più foto reali (placeholder). L'app chiama Deezer, sceglie il risultato con la migliore similarità normalizzata e dà priorità alla **corrispondenza esatta più popolare** tra nomi duplicati — senza questo, un «Twice» oscuro potrebbe apparire al posto di TWICE. L'utente può anche caricare una foto locale (JPEG/PNG/WebP, fino a 10 MB): viene ridimensionata sul canvas e usata solo nella memoria del browser. Se non viene trovato nulla, la card usa il fallback procedurale su canvas.

### Temi

Cinque accenti fissi in `lib/cardThemes.ts`; cambia solo il colore di accento della card (brand e tempo di ascolto). L'id scelto è l'unico dato del tema salvato, in `localStorage`. Il sito in sé resta neutro.

### Stato tra le lingue

`CapsuleStudio` mantiene i dati non localizzati in uno store in memoria (`lib/studioSession.ts`). Al cambio lingua il componente viene rimontato, si idrata dallo store e ricalcola solo i testi con il nuovo locale — **zero richieste a Last.fm**. La lingua in sé viene persistita nel cookie `NEXT_LOCALE`.

### Export 1080×1920

`html-to-image` renderizza la card (432×768) con `pixelRatio: 2.5`. Prima dell'export:

- `document.fonts.ready` + due frame di layout;
- ogni `<img>` della card viene decodificata;
- un embedding di font su misura include **solo i subset il cui `unicode-range` interseca i caratteri della card**, evitando di scaricare megabyte di slice CJK inutili.

Il PNG finale è esattamente **1080×1920** (verificato in un browser, anche con una foto caricata dall'utente).

### Design

Palette neutra, un unico colore di accento pieno per card, senza neon/gradienti/glassmorphism:

| Token | Valore |
| --- | --- |
| Sfondo | `#0f0f10` |
| Superficie del form | `#171719` |
| Input | `#111113` |
| Corpo della card | `#212121` |
| Accenti | Ember `#F06848`, Tide `#5B9DFF`, Moss `#7ED08A`, Plum `#C084FC`, Sand `#E7C27A` |
| Testo | `#f4f4f5` / attenuato `#a1a1aa` |

Tipografia: Geist (sans) + Geist Mono (numeri/dettagli) + Noto Sans JP/KR/SC per CJK.

## Privacy, sicurezza e TOS

- `LASTFM_API_KEY` esiste solo sul server; il client non la riceve mai.
- `/api/lastfm` accetta solo `user.getInfo`, `user.getRecentTracks` e `track.getInfo`; rifiuta `api_key`/`format` inviati dal client, valida gli interi (intervalli e limiti), il nome utente e i caratteri di controllo.
- `/api/image-proxy` accetta solo URL `https` su `*.dzcdn.net`, rivalida l'host dopo i redirect, richiede `Content-Type: image/*` e risponde in modalità streaming.
- L'app invia uno User-Agent identificabile a Last.fm/Deezer.
- Attribuzione secondo i [TOS di Last.fm](https://www.last.fm/api/tos): un link «powered by Last.fm» nel footer e i crediti «Data from Last.fm», profilo e URL del sito sulla card esportata.
- **Unici dati persistiti**: lingua (cookie) e accento della card (`localStorage`). Non ci sono database, storage di scrobble, login o cookie di sessione.
- Nulla della cronologia dell'utente viene registrato nei log dell'app. Il progetto è personale e non commerciale.

### Osservabilità

- Vercel Web Analytics (`@vercel/analytics`) e Speed Insights (`@vercel/speed-insights`) sono installati nel layout della locale.
- Entrambi sono senza cookie: non raccolgono nomi utente, dati della card o dati di scrobble.
- Nel piano Hobby, Web Analytics include 50.000 eventi/mese e Speed Insights include 10.000 eventi negli ultimi 30 giorni; entrambi sono gratuiti entro questi limiti e la raccolta si mette in pausa invece di fatturare l'eccedenza.

## i18n

- Locales: `pt` (predefinita, contenuti pt-BR), `en`, `es`, `fr`, `de`, `it`, `ja`, `ko`, `zh` (cinese semplificato), `ru` e `pl`.
- Rilevamento tramite `Accept-Language` nel middleware (il cookie `NEXT_LOCALE` ha priorità); il cambio manuale nell'header conserva la route e la card in memoria. Il selettore è un menu a tendina personalizzato, non il `<select>` nativo.
- Date e numeri usano `Intl` con il locale regionale corretto (`pt-BR`, `en-US`, `es-ES`, `fr-FR`, `de-DE`, `it-IT`, `ja-JP`, `ko-KR`, `zh-CN`, `ru-RU`, `pl-PL`).
- Il testo della card è tradotto insieme all'interfaccia; l'immagine esportata usa già la lingua attiva.
- Font: Geist carica latin/latin-ext/cirillico; Noto Sans JP/KR/SC copre i caratteri CJK della card.

## Test

```bash
pnpm test        # 108 test unitari
pnpm typecheck
pnpm build
```

Copertura attuale:

- normalizzazione degli URL di profilo incollati nel campo utente;
- aggregazione degli scrobble, spareggi, CJK e calcolo del tempo di ascolto;
- intervalli di periodo, il limite di **3 mesi di calendario**, febbraio/mesi di 31 giorni, registrazione, futuro e `Intl`;
- client Last.fm con `fetch` mockato: paginazione, now playing, retry 29/rete, abort, durate della top 50, errori 6/17, data di registrazione (`unixtime`);
- abbinamento artisti su Deezer (incluso lo spareggio per popolarità tra nomi duplicati);
- route API: allowlist, chiave lato server, User-Agent, header di cache, streaming del proxy immagini;
- temi e store di sessione;
- validazione dell'upload locale (tipo/dimensione).

Inoltre, il flusso è stato verificato in Chromium con Last.fm/Deezer simulati: tema, upload, crediti, nome utente nascosto, embed autonomo (clipboard), cambio lingua senza nuove richieste, menu a tendina personalizzato (mouse, tastiera e clic fuori), route `ko`/`ru`/`zh`/`pl`, scroll automatico all'anteprima su mobile, solo cookie/localStorage consentiti, F5, validazione di 3 mesi ed export **1080×1920**. Il flusso reale è stato eseguito anche contro l'API di Last.fm/Deezer con un profilo attivo.

## Limitazioni note

- **Periodo massimo di 3 mesi di calendario**: pensato per rientrare nell'uso ragionevole di Last.fm e nel piano Hobby. I recap annuali richiederebbero un'architettura/limite diversi.
- **Il tempo di ascolto è una stima**: dipende dalle durate di `track.getInfo` e dal fallback di 210 s; brani live/remix possono divergere.
- **Le foto vengono da Deezer**: l'abbinamento per nome può fallire per artisti omonimi o non trovare nulla (usa il fallback canvas). Nomi in un'altra scrittura (ad es. 南翔子, indicizzato come «Shoko Minami») potrebbero non avere corrispondenza. L'upload locale copre questi casi.
- **Gli upload non vengono persistiti**: la foto esiste solo in memoria e sparisce al refresh (F5), come il risultato e il nome utente.
- **I profili privati** («hide recent listening») restituiscono l'errore 17; l'app spiega come abilitarlo.
- **L'export lato client** dipende dal browser (testato in Chromium). Su dispositivi vecchi o Safari con poca memoria il PNG può fallire; c'è un messaggio di errore.
- **La Web Share API** non è disponibile in tutti i browser; in questi casi l'app scarica il PNG.
- La card renderizza foto e font solo dopo il caricamento; l'anteprima attende il caricamento prima di abilitare il PNG.

## Risoluzione dei problemi

| Sintomo | Causa probabile / soluzione |
| --- | --- |
| «Al server manca la chiave API» | `LASTFM_API_KEY` assente in `.env.local` (o su Vercel); riavvia il server. |
| «Utente non trovato» | nome utente non valido o inesistente; controllalo su `last.fm/user/<name>`. |
| «Scrobble privati» | attiva «Mostra ascolti recenti» nelle impostazioni privacy di Last.fm. |
| «Nessuno scrobble nel periodo» | il periodo scelto non ha cronologia pubblica. |
| «Rate limit» | aspetta e riprova; l'app applica già pacer e backoff. |
| Anteprima senza foto | Deezer non ha trovato l'artista; carica una foto o usa il fallback geometrico. |
| «Usa JPEG, PNG o WebP» / «massimo 10 MB» | formato/dimensione della foto locale fuori dall'intervallo consentito. |
| I font CJK non compaiono | verifica che la build sia riuscita a scaricare Noto Sans JP/KR/SC da Google Fonts. |
| La build fallisce su `prerender /404` | sintomo di `node_modules` corrotto; rimuovi `node_modules` ed esegui di nuovo `pnpm install`. |

## Disclaimer

Sound Capsule è un progetto indipendente, non affiliato a Last.fm né a nessun servizio di streaming. I dati musicali sono pubblici e forniti dall'API di Last.fm; le foto degli artisti provengono da Deezer o dall'utente. L'uso del piano Hobby di Vercel è personale e non commerciale.
