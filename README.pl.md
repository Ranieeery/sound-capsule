**English** · [Português](README.pt-BR.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Italiano](README.it.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [Русский](README.ru.md) · [Polski](README.pl.md)

# Sound Capsule

Twoje scrobbles z Last.fm można zamienić w **pionową kapsułę dźwięku 1080×1920** (format relacji), gotową do pobrania lub udostępnienia. Cała agregacja odbywa się w przeglądarce — bez logowania i bez bazy danych.

**Wdrożenie:** <https://sound-capsule-lastfm.vercel.app>

![Wygenerowana karta](docs/screenshots/capsule-1080x1920.png)

> Zrzuty ekranu wykorzystują symulowane dane, aby pokazać stany interfejsu. Obrazem tła karty jest syntetyczny portret testowy; w produkcji pochodzi z Deezer lub ze zdjęcia przesłanego przez użytkownika.

Przykład z japońskimi, koreańskimi i chińskimi nazwami w wyeksportowanym PNG: [karta CJK](docs/screenshots/cjk-1080x1920.png).

## Funkcje

- **Ekran główny** z polem użytkownika (przyjmuje nazwę użytkownika lub URL profilu), okresem (ostatni tydzień, bieżący miesiąc lub własny zakres), podglądem 9:16 oraz akcjami pobierania i udostępniania.
- **Własny okres o maksymalnej długości 3 miesięcy kalendarzowych** — bez stałego okna 90 dni i bez ograniczania wybranych dat (od daty rejestracji w Last.fm do dziś).
- **Karta 9:16** (432×768 w CSS, eksportowana jako PNG 1080×1920), której górne 30% to zdjęcie artysty, a korpus ma jednolity kolor `#212121`.
- **Pięć stałych motywów kolorystycznych** (Ember, Tide, Moss, Plum, Sand), które zmieniają wyłącznie akcent karty — bez swobodnego wyboru koloru.
- **Zdjęcie artysty** w trzech warstwach: automatyczne dopasowanie w Deezerze → opcjonalne przesłanie lokalne (nigdy nie trafia na serwer) → awaryjne tło canvas z inicjałami.
- **Dwie numerowane kolumny** (najczęściej słuchani artyści i najczęściej słuchane utwory, 1–5) z obcinaniem wielokropkiem i obsługą CJK (japoński, koreański i chiński).
- **Szacowany czas słuchania** wyróżniony jednolitym kolorem motywu, z podpowiedzią wyjaśniającą obliczenia i formatowaniem przez `Intl`.
- **Samodzielny embed**: przycisk „Kopiuj kod embed” generuje blok HTML `<a><img></a>` z PNG w base64 — bez przesyłania, bez przechowywania i bez zależności od hostowanego URL obrazu (~0,5–0,8 MB). Działa tam, gdzie dozwolony jest surowy HTML.
- **Podgląd linku**: po wklejeniu URL strony w WhatsApp, Discord, Twitter/X, Telegram itp. pojawiają się zlokalizowany tytuł i opis oraz markowy obraz Open Graph 1200×630.
- **Rzeczywisty postęp paginacji** („Strona 12 z 40”), szkielet podglądu i anulowanie przez `AbortController`.
- **i18n** w `pt`, `en`, `es`, `fr`, `de`, `it`, `ja`, `ko`, `zh`, `ru` i `pl`, z wykrywaniem przez `Accept-Language`, trasami z prefiksem, formatowaniem tekstów/dat/liczb przez `Intl` oraz niestandardową, dostępną listą rozwijaną języków.
- **Podpisy na karcie** („Data from Last.fm”, link do profilu i URL strony), z opcją ukrycia nazwy użytkownika na karcie.
- **Tło `<canvas>`** z subtelnymi liniami fali reagującymi na mysz, pauzującymi przy ukrytej karcie i wyłączanymi przez `prefers-reduced-motion`.
- **Dostępność**: nawigacja klawiaturą, etykiety, `role="progressbar"`, alerty, kontrast AA i poszanowanie ograniczenia ruchu.
- **Obserwowalność**: Vercel Web Analytics i Speed Insights bez cookies do śledzenia odwiedzin i Core Web Vitals.

## Trwałość danych: tylko język i motyw

| Dane | Gdzie są przechowywane | Szczegóły |
| --- | --- | --- |
| Język | cookie `NEXT_LOCALE` | tylko `pt`, `en`, … |
| Kolor karty | `localStorage` (`sound-capsule:theme`) | tylko id akcentu |
| Nazwa użytkownika, daty, wynik API, przesłane zdjęcie | **pamięć** | ginie po F5 |

Przełączanie języka zachowuje nazwę użytkownika i kartę w pamięci (bez nowych żądań do Last.fm), ale odświeżenie strony usuwa te dane. Żadne dane scrobbles, historii ani zdjęć nie są zapisywane.

## Stos technologiczny

| Warstwa | Wybór |
| --- | --- |
| Framework | Next.js 15 (App Router) + TypeScript |
| Stylowanie | Tailwind CSS 4 |
| i18n | `next-intl` 4 |
| Eksport obrazu | `html-to-image` (po stronie klienta) |
| Testy | Vitest |
| Wdrożenie | Vercel (serverless, statyka + route handlers) |

## Jak to działa

```text
Przeglądarka
  ├─ waliduje użytkownika i okres (maks. 3 miesiące kalendarzowe)
  ├─ /api/lastfm  ──────────►  Last.fm API (klucz wstrzykiwany na serwerze)
  │     └─ user.getInfo, user.getRecentTracks, track.getInfo
  ├─ pobiera WSZYSTKIE strony scrobbles (współbieżność 3 + pacer 150 ms)
  ├─ agreguje w pamięci: najczęściej słuchani artyści, utwory, czas słuchania
  ├─ /api/artist-image ─────►  wyszukiwanie Deezer (najlepsze znormalizowane dopasowanie)
  ├─ /api/image-proxy  ─────►  CDN Deezer (lista dozwolonych *.dzcdn.net)
  ├─ opcjonalne zdjęcie użytkownika ─►  lokalny canvas (nigdy nie opuszcza przeglądarki)
  └─ renderuje kartę w DOM i eksportuje PNG 1080×1920
```

Aplikacja nie pobiera danych przy wczytaniu strony, tylko po kliknięciu „Wygeneruj kapsułę”. Publiczne odpowiedzi korzystają z cache CDN przez `Vercel-CDN-Cache-Control`; trafienie w cache nie wywołuje funkcji.

## Uruchamianie lokalnie

### Wymagania

- Node.js **20.9+**
- pnpm **9+** (repozytorium rozwijano z pnpm 11)

### 1. Uzyskanie klucza API Last.fm

1. Należy wejść na <https://www.last.fm/api/account/create>.
2. Należy podać nazwę aplikacji (np. *Sound Capsule*), URL `https://sound-capsule-lastfm.vercel.app` i opis.
3. Należy skopiować wygenerowany **klucz API** (*shared secret* nie jest potrzebny, ponieważ nie ma uwierzytelniania użytkowników).

### 2. Konfiguracja środowiska

```bash
cp .env.example .env.local
# edytuj .env.local i uzupełnij:
LASTFM_API_KEY=your_key_here
```

Zmienna jest **tylko po stronie serwera**. Nigdy nie należy używać prefiksu `NEXT_PUBLIC_`; nie trafia też do bundle'a klienta.

### 3. Instalacja i uruchomienie

```bash
pnpm install
pnpm dev
```

Po otwarciu <http://localhost:3000> middleware przekierowuje do języka wykrytego z `Accept-Language` (lub z cookie `NEXT_LOCALE`).

### Skrypty

| Polecenie | Opis |
| --- | --- |
| `pnpm dev` | serwer deweloperski |
| `pnpm build` | build produkcyjny |
| `pnpm start` | serwuje build produkcyjny |
| `pnpm test` | testy jednostkowe (Vitest) |
| `pnpm test:watch` | testy w trybie watch |
| `pnpm typecheck` | sprawdzanie typów przez `tsc --noEmit` |

## Wdrażanie na Vercel

Obecne wdrożenie znajduje się pod adresem <https://sound-capsule-lastfm.vercel.app>.

1. Projekt należy wypchnąć do repozytorium na GitHub/GitLab/Bitbucket.
2. W Vercel należy kliknąć **Add New → Project** i zaimportować repozytorium.
3. Preset **Next.js** jest wykrywany automatycznie. Należy potwierdzić:
   - Install Command: `pnpm install`
   - Build Command: `pnpm build`
   - Output: domyślny dla Next.js
4. W **Settings → Environment Variables** należy dodać `LASTFM_API_KEY` w Production (a jeśli podglądy mają być testowane — także w Preview/Development).
5. Należy wdrożyć. Nie ma bazy danych, migracji, zadań cron ani magazynu do skonfigurowania.
6. Opcjonalnie: własną domenę można skonfigurować w **Settings → Domains**.

Projekt został zaprojektowany pod plan **Hobby** (osobisty/niekomercyjny): każda typowa kapsuła wykonuje ~60–176 wywołań funkcji, a cache CDN pozwala uniknąć powtarzania stabilnych wywołań. Przesyłanie zdjęcia jest w 100% lokalne, więc nie zużywa funkcji, transferu ani limitu 4.5 MB na ciało żądania w Vercel.

Uwagi produkcyjne:

- Handlery tras używają `AbortSignal.timeout(10s)` dla zapytań do upstreamu; każde wywołanie jest krótkie i niezależne.
- `track.getInfo` i obrazy pozostają w CDN przez 24 h; dane użytkownika przez 1–5 min. Błędy nigdy nie są cache'owane.
- Proxy obrazów odpowiada w trybie strumieniowym, więc nie trafia w limit 4.5 MB dla odpowiedzi niestrumieniowych.
- Czcionki CJK są hostowane samodzielnie przez `next/font` podczas builda; środowisko musi mieć dostęp do Google Fonts.

## Struktura

```text
app/
  [locale]/
    layout.tsx            # główny layout: czcionki, provider i18n, metadane/SEO
    page.tsx              # ekran główny (serwer) + CapsuleStudio (klient)
    [...rest]/page.tsx    # nieznane trasy → notFound()
  api/
    lastfm/route.ts       # proxy z listą dozwolonych metod i parametrów
    artist-image/route.ts # wyszukiwanie Deezer + znormalizowane dopasowanie
    image-proxy/route.ts  # proxy obrazów (lista dozwolonych + streaming)
  robots.ts               # robots.txt (blokuje /api/, wskazuje mapę witryny)
  sitemap.ts              # mapa witryny z 11 trasami i alternates
  globals.css             # tokeny designu (Tailwind 4)
  icon.svg                # marka/favicon
components/
  CapsuleStudio.tsx       # formularz, motyw, upload, postęp, eksport/udostępnianie/embed
  CapsuleCard.tsx         # karta 432×768 z podpisami i motywem
  CardHero.tsx            # zdjęcie artysty/upload albo awaryjne tło canvas
  BackgroundCanvas.tsx    # fale w tle (mysz, ograniczenie ruchu, ukrycie)
  SiteHeader.tsx / SiteFooter.tsx / BrandMark.tsx
  LocaleSwitcher.tsx      # niestandardowa, dostępna lista rozwijana języków
i18n/                     # routing/request/nawigacja next-intl
lib/
  lastfmClient.ts         # paginacja, współbieżność, pacer, retry/backoff, abort
  aggregate.ts            # agregacja i szacowanie minut (testowane)
  periods.ts              # interwały, limit 3 miesięcy, Intl
  artistMatch.ts          # znormalizowane dopasowanie w Deezerze
  artistImage.ts          # ustalanie/preload głównego zdjęcia
  localPhoto.ts           # lokalna walidacja/skalowanie przesłanego zdjęcia
  cardThemes.ts           # stałe akcenty i zapisywanie tylko id
  studioSession.ts        # stan w pamięci do przełączania języka
  site.ts / httpCache.ts  # URL/User-Agent i nagłówki cache
  exportCard.ts           # osadzanie czcionek + html-to-image → PNG 1080×1920
  initials.ts / locales.ts
public/
  og.png                  # podgląd Open Graph/Twitter 1200×630
  llms.txt                # podsumowanie projektu dla agentów/LLM
messages/                 # pt, en, es, fr, de, it, ja, ko, zh, ru, pl
tests/                    # Vitest
docs/screenshots/         # referencyjne zrzuty ekranu
```

## Podgląd linku, SEO i wykrywalność

- `metadataBase` + Open Graph/Twitter Card na wszystkich 11 trasach, ze zlokalizowanym tytułem i opisem.
- Obraz `public/og.png` (1200×630) używany w `og:image` i `twitter:image`; to podgląd wyświetlany po wklejeniu linku w WhatsApp, Discord, Telegram, Twitter/X itp.
- `/robots.txt` generowany przez `app/robots.ts`: zezwala na witrynę, blokuje `/api/` i wskazuje mapę witryny.
- `/sitemap.xml` generowany przez `app/sitemap.ts`, z 11 trasami i alternatywami `hreflang`.
- `/llms.txt` z rzeczowym podsumowaniem produktu, źródeł danych i polityki prywatności dla agentów AI.

## Decyzje techniczne

### Dlaczego `user.getRecentTracks`, a nie `user.getTopTracks`?

`getTopTracks`/`getTopArtists` przyjmują tylko stałe okna (`7day`, `1month`…), a „miesiąc” w Last.fm nie jest bieżącym miesiącem kalendarzowym. Aplikacja paginuje `user.getRecentTracks` z `from`/`to` (unix) i agreguje lokalnie, gwarantując, że **„bieżący miesiąc”** to dokładnie okres od 1. dnia do teraz w strefie czasowej odwiedzającego.

- `limit=200` na stronę; pierwsza strona odkrywa `totalPages`.
- Pozostałe strony działają równolegle z **współbieżnością 3** i **pacerem 150 ms między wywołaniami**, aby mieścić się w wytycznych Last.fm.
- Ponawianie z **wykładniczym backoffem** dla błędu 29 (limit zapytań), 5xx i awarii sieci.
- Utwór „teraz odtwarzany” (`@attr.nowplaying`) jest ignorowany.
- Przycisk **Anuluj** przerywa wszystkie trwające żądania (`AbortController`).

### Czas słuchania

Last.fm nie udostępnia czasu słuchania. Szacowanie:

1. Pobiera rzeczywistą długość (`track.getInfo` → `duration` w ms) dla **50 najczęściej odtwarzanych utworów** (współbieżność 3).
2. Utwory bez długości, o długości 0 lub poza top 50 używają **3,5 min (210 s)**.
3. `minutes = round(Σ duration × scrobbles / 60,000)`.

Interfejs pokazuje wartość jako przybliżoną (`≈ 66 min`), a podpowiedź wyjaśnia obliczenia. Wartość awaryjna i limit top 50 można skonfigurować w `lib/periods.ts`.

### Zdjęcie artysty

Last.fm nie zwraca już prawdziwych zdjęć (placeholder). Aplikacja wywołuje Deezer, wybiera wynik o najlepszym znormalizowanym podobieństwie i preferuje **najpopularniejsze dokładne dopasowanie** wśród zduplikowanych nazw — bez tego zamiast TWICE mógłby pojawić się nieznany „Twice”. Użytkownik może też przesłać lokalne zdjęcie (JPEG/PNG/WebP, do 10 MB): jest ono skalowane na canvasie i używane wyłącznie w pamięci przeglądarki. Jeśli nic nie zostanie znalezione, karta korzysta z proceduralnego tła canvas.

### Motywy

Pięć stałych akcentów w `lib/cardThemes.ts`; zmienia się tylko kolor akcentu karty (marka i czas słuchania). Zapisywany jest wyłącznie identyfikator motywu, w `localStorage`. Sama witryna pozostaje neutralna.

### Stan między językami

`CapsuleStudio` przechowuje niezależne od języka dane w magazynie w pamięci (`lib/studioSession.ts`). Po zmianie języka komponent jest ponownie montowany, hydratowany ze store'a i przelicza tylko teksty w nowym języku — **zero żądań do Last.fm**. Sam język jest zapisywany w cookie `NEXT_LOCALE`.

### Eksport 1080×1920

`html-to-image` renderuje kartę (432×768) z `pixelRatio: 2.5`. Przed eksportem:

- `document.fonts.ready` + dwie klatki układu;
- każdy `<img>` na karcie jest dekodowany;
- dedykowane osadzanie czcionek obejmuje **tylko te podzbiory, których `unicode-range` przecina znaki karty**, co pozwala uniknąć pobierania megabajtów niepotrzebnych wycinków CJK.

Końcowy PNG ma dokładnie **1080×1920** (zweryfikowano w przeglądarce, także ze zdjęciem przesłanym przez użytkownika).

### Design

Neutralna paleta, jeden jednolity kolor akcentu na kartę, bez neonu, gradientów i glassmorphismu:

| Token | Wartość |
| --- | --- |
| Tło | `#0f0f10` |
| Powierzchnia formularza | `#171719` |
| Pola wejściowe | `#111113` |
| Korpus karty | `#212121` |
| Akcenty | Ember `#F06848`, Tide `#5B9DFF`, Moss `#7ED08A`, Plum `#C084FC`, Sand `#E7C27A` |
| Tekst | `#f4f4f5` / wyciszony `#a1a1aa` |

Typografia: Geist (sans) + Geist Mono (liczby/szczegóły) + Noto Sans JP/KR/SC dla CJK.

## Prywatność, bezpieczeństwo i TOS

- `LASTFM_API_KEY` istnieje tylko na serwerze; klient nigdy go nie otrzymuje.
- `/api/lastfm` akceptuje wyłącznie `user.getInfo`, `user.getRecentTracks` i `track.getInfo`; odrzuca `api_key`/`format` przysłane przez klienta, waliduje liczby całkowite (zakresy i limity), nazwę użytkownika i znaki kontrolne.
- `/api/image-proxy` akceptuje wyłącznie URL-e `https` w domenie `*.dzcdn.net`, po przekierowaniach ponownie weryfikuje host, wymaga `Content-Type: image/*` i odpowiada w trybie strumieniowym.
- Aplikacja wysyła identyfikowalny User-Agent do Last.fm/Deezer.
- Atrybucja zgodnie z [Last.fm TOS](https://www.last.fm/api/tos): link „powered by Last.fm” w stopce oraz podpisy „Data from Last.fm”, profil i URL strony na eksportowanej karcie.
- **Jedyne zapisywane dane**: język (cookie) i akcent karty (`localStorage`). Nie ma bazy danych, przechowywania scrobbles, logowania ani ciasteczek sesyjnych.
- Niczego z historii użytkownika nie zapisuje się w logach aplikacji. Projekt jest osobisty i niekomercyjny.

### Obserwowalność

- Vercel Web Analytics (`@vercel/analytics`) i Speed Insights (`@vercel/speed-insights`) są zainstalowane w layoucie językowym.
- Oba działają bez cookies: nie zbierają nazw użytkowników, danych karty ani danych scrobbles.
- W planie Hobby Web Analytics obejmuje 50,000 zdarzeń miesięcznie, a Speed Insights — 10,000 zdarzeń w ciągu ostatnich 30 dni; w tych limitach oba są bezpłatne, a po przekroczeniu zbieranie danych zostaje wstrzymane zamiast obciążenia opłatą.

## i18n

- Języki: `pt` (domyślny, treść pt-BR), `en`, `es`, `fr`, `de`, `it`, `ja`, `ko`, `zh` (chiński uproszczony), `ru` i `pl`.
- Wykrywanie przez `Accept-Language` w middleware (cookie `NEXT_LOCALE` ma priorytet); ręczne przełączanie w nagłówku zachowuje trasę i kartę w pamięci. Selektor to niestandardowa lista rozwijana, a nie natywny `<select>`.
- Daty i liczby używają `Intl` z właściwym ustawieniem regionalnym (`pt-BR`, `en-US`, `es-ES`, `fr-FR`, `de-DE`, `it-IT`, `ja-JP`, `ko-KR`, `zh-CN`, `ru-RU`, `pl-PL`).
- Tekst karty jest tłumaczony razem z interfejsem; eksportowany obraz używa już aktywnego języka.
- Czcionki: Geist ładuje łacinkę/latin-ext/cyrylicę; Noto Sans JP/KR/SC pokrywa znaki CJK na karcie.

## Testy

```bash
pnpm test        # 108 testów jednostkowych
pnpm typecheck
pnpm build
```

Obecne pokrycie:

- normalizacja URL-i profili wklejanych w pole użytkownika;
- agregacja scrobbles, rozstrzyganie remisów, CJK i obliczanie czasu słuchania;
- interwały okresów, limit **3 miesięcy kalendarzowych**, luty/miesiące 31-dniowe, rejestracja, przyszłość i `Intl`;
- klient Last.fm z zamockowanym `fetch`: paginacja, now playing, ponawianie 29/sieć, abort, długości top 50, błędy 6/17, data rejestracji (`unixtime`);
- dopasowywanie artystów w Deezerze (w tym rozstrzyganie remisów popularnością przy zduplikowanych nazwach);
- trasy API: lista dozwolonych, klucz serwera, User-Agent, nagłówki cache, strumieniowanie proxy obrazów;
- motywy i magazyn sesji;
- walidacja lokalnego uploadu (typ/rozmiar).

Ponadto przepływ zweryfikowano w Chromium z symulowanym Last.fm/Deezer: motyw, upload, podpisy, ukryta nazwa użytkownika, samodzielny embed (schowek), przełączanie języka bez nowych żądań, niestandardowa lista rozwijana (mysz, klawiatura i kliknięcie poza), trasy `ko`/`ru`/`zh`/`pl`, automatyczne przewijanie do podglądu na urządzeniach mobilnych, dozwolone wyłącznie cookie/localStorage, F5, walidacja 3 miesięcy kalendarzowych i eksport **1080×1920**. Rzeczywisty przepływ uruchomiono także przeciwko API Last.fm/Deezer z aktywnym profilem.

## Znane ograniczenia

- **Maksymalny okres 3 miesięcy kalendarzowych**: zaprojektowany, aby mieścić się w rozsądnym użyciu Last.fm i planie Hobby. Roczne podsumowania wymagałyby innej architektury/limitu.
- **Czas słuchania jest szacunkiem**: zależy od długości z `track.getInfo` i awaryjnych 210 s; utwory na żywo/remiksy mogą się różnić.
- **Zdjęcia pochodzą z Deezer**: dopasowanie po nazwie może zawodzić przy artystach o tej samej nazwie lub nie znaleźć niczego (wtedy używane jest awaryjne tło canvas). Nazwy w innym piśmie (np. 南翔子, indeksowana jako „Shoko Minami”) mogą nie mieć dopasowania. Lokalny upload obejmuje takie przypadki.
- **Przesłane pliki nie są zapisywane**: zdjęcie istnieje tylko w pamięci i ginie po F5, podobnie jak wynik i nazwa użytkownika.
- **Profile prywatne** („hide recent listening”) zwracają błąd 17; aplikacja wyjaśnia, jak to włączyć.
- **Eksport po stronie klienta** zależy od przeglądarki (testowany w Chromium). Na starych urządzeniach/Safari z małą ilością pamięci PNG może się nie udać; wtedy pojawia się komunikat o błędzie.
- **Web Share API** nie jest dostępne we wszystkich przeglądarkach; w takich przypadkach aplikacja pobiera PNG.
- Karta renderuje zdjęcia i czcionki dopiero po ich załadowaniu; podgląd czeka na załadowanie, zanim włączy PNG.

## Rozwiązywanie problemów

| Objaw | Prawdopodobna przyczyna / rozwiązanie |
| --- | --- |
| „Na serwerze brakuje klucza API Last.fm” | Brak `LASTFM_API_KEY` w `.env.local` (lub w Vercel); należy ponownie uruchomić serwer. |
| „Nie znaleziono użytkownika Last.fm” | Nieprawidłowa lub nieistniejąca nazwa użytkownika; należy sprawdzić pod `last.fm/user/<name>`. |
| „Scrobbles tego użytkownika są prywatne” | Należy włączyć „Show recent listening” w ustawieniach prywatności Last.fm. |
| „W tym okresie nie znaleziono żadnych scrobbles” | Wybrany okres nie ma publicznej historii. |
| „Last.fm ograniczył liczbę zapytań” | Należy odczekać i spróbować ponownie; aplikacja stosuje już pacer i backoff. |
| Podgląd bez zdjęcia | Deezer nie znalazł artysty; należy przesłać zdjęcie lub użyć awaryjnego tła geometrycznego. |
| „Użyj formatu JPEG, PNG lub WebP” / „Obraz może mieć maksymalnie 10 MB” | Format/rozmiar lokalnego zdjęcia poza dozwolonym zakresem. |
| Czcionki CJK się nie pojawiają | Należy sprawdzić, czy build mógł pobrać Noto Sans JP/KR/SC z Google Fonts. |
| Build kończy się błędem przy `prerender /404` | Objaw uszkodzonego `node_modules`; należy usunąć `node_modules` i ponownie uruchomić `pnpm install`. |

## Zastrzeżenie

Sound Capsule to niezależny projekt, niezwiązany z Last.fm ani żadnym serwisem streamingowym. Dane muzyczne są publiczne i pochodzą z API Last.fm; zdjęcia artystów pochodzą z Deezer lub od użytkownika. Korzystanie z planu Hobby Vercel ma charakter osobisty i niekomercyjny.
