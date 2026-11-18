# Sound Capsule for Last.fm

Transforme seus scrobbles do Last.fm em uma **cápsula de som vertical 1080×1920** (formato story) pronta para baixar ou compartilhar. Sem login, sem banco de dados, sem armazenar nada do perfil: a agregação acontece inteiramente no navegador.

![Card gerado](docs/screenshots/capsule-1080x1920.png)

> As capturas usam dados simulados para demonstrar os estados da interface. A imagem de fundo do card é um retrato sintético de teste; em produção vem do Deezer.

Exemplo com nomes em japonês, coreano e chinês renderizados no PNG exportado: [card CJK](docs/screenshots/cjk-1080x1920.png).

## Recursos

- **Tela inicial** com input de usuário, período (última semana, mês atual ou intervalo personalizado), prévia 9:16 e ações de download/compartilhamento.
- **Card 9:16** (432×768 CSS, exportado a 1080×1920 PNG) com topo de 30% em foto do artista e corpo sólido `#212121`.
- **Duas colunas numeradas** (Top artistas e Top músicas, 1–5) com truncamento por reticências e suporte a CJK (japonês, coreano e chinês).
- **Minutagem estimada** com destaque sólido `#F06848`, tooltip explicando o cálculo e formatação via `Intl`.
- **Progresso real** de paginação ("Página 12 de 40"), skeleton na prévia e cancelamento com `AbortController`.
- **i18n** em `pt`, `en`, `es`, `fr`, `de`, `it` e `ja`, com detecção por `Accept-Language`, seletor manual no header, rotas prefixadas (`/pt`, `/en`, …), textos do card e datas/números formatados com `Intl`.
- **Fundo em `<canvas>`** com linhas de onda discretas que reagem ao mouse, pausam com a aba oculta e desligam com `prefers-reduced-motion`.
- **Fallback gráfico** em canvas (ondas + iniciais) quando o Deezer não encontra a foto do artista.
- **Acessível**: navegação por teclado, labels, `role="progressbar"`, alerts, contraste AA e respeito a movimento reduzido.

## Stack

| Camada | Escolha |
| --- | --- |
| Framework | Next.js 15 (App Router) + TypeScript |
| Estilo | Tailwind CSS 4 |
| i18n | `next-intl` 4 |
| Export da imagem | `html-to-image` (client-side) |
| Testes | Vitest |
| Deploy | Vercel (serverless, estático + route handlers) |

## Como funciona

```text
Navegador
  ├─ valida usuário/período
  ├─ /api/lastfm  ──────────►  Last.fm API (key injetada no servidor)
  │     └─ user.getInfo, user.getRecentTracks, track.getInfo
  ├─ pagina TODAS as páginas de scrobbles (concorrência 4, retry/backoff)
  ├─ agrega em memória: top artistas, top músicas, minutagem
  ├─ /api/artist-image ─────►  Deezer search (melhor match normalizado)
  ├─ /api/image-proxy  ─────►  CDN do Deezer (whitelist *.dzcdn.net)
  └─ renderiza o card no DOM e exporta PNG 1080×1920
```

Nada é persistido: sem banco, storage, login ou cookies de sessão. O único cache é o cache público de CDN das respostas (`s-maxage=300, stale-while-revalidate=60`), que não identifica o visitante.

## Rodando localmente

### Requisitos

- Node.js **20.9+**
- pnpm **9+** (o repositório foi desenvolvido com pnpm 11)

### 1. Obtenha uma API key do Last.fm

1. Acesse <https://www.last.fm/api/account/create>.
2. Preencha o nome do app (ex.: *Sound Capsule*) e o site/descrição.
3. Copie a **API key** gerada (não é necessário o *shared secret*, pois não há autenticação de usuário).

### 2. Configure o ambiente

```bash
cp .env.example .env.local
# edite .env.local e preencha:
LASTFM_API_KEY=sua_chave_aqui
```

A variável é **somente do servidor**. Nunca use o prefixo `NEXT_PUBLIC_` e ela não vai para o bundle do cliente.

### 3. Instale e rode

```bash
pnpm install
pnpm dev
```

Abra <http://localhost:3000> — o middleware redireciona para o locale detectado pelo `Accept-Language` (padrão `pt`).

### Scripts

| Comando | Descrição |
| --- | --- |
| `pnpm dev` | servidor de desenvolvimento |
| `pnpm build` | build de produção |
| `pnpm start` | serve o build de produção |
| `pnpm test` | testes unitários (Vitest) |
| `pnpm test:watch` | testes em watch mode |
| `pnpm typecheck` | checagem de tipos com `tsc --noEmit` |

## Deploy na Vercel

1. Suba o projeto para um repositório no GitHub/GitLab/Bitbucket.
2. Na Vercel, clique em **Add New → Project** e importe o repositório.
3. O preset **Next.js** é detectado automaticamente. Confirme:
   - Install Command: `pnpm install`
   - Build Command: `pnpm build`
   - Output: padrão do Next.js
4. Em **Settings → Environment Variables**, adicione `LASTFM_API_KEY` em Production (e, se quiser testar previews, também Preview/Development). O valor é secreto e fica só no servidor.
5. Faça o deploy. Não há banco de dados, migrations, cron jobs ou storage para configurar.
6. Opcional: configure domínio customizado em **Settings → Domains**.

Observações de produção:

- Os route handlers usam `AbortSignal.timeout(10s)` para o upstream. Mantenha o limite de duração das Functions compatível com o plano.
- As respostas dos proxies são cacheáveis no CDN da Vercel (`s-maxage=300`). Erros nunca são cacheados.
- As fontes CJK são self-hosted pelo `next/font` durante o build; o ambiente de build precisa conseguir baixar do Google Fonts.

## Estrutura

```text
app/
  [locale]/
    layout.tsx            # layout raiz: fontes, provider i18n, metadata/SEO
    page.tsx              # tela inicial (server) + CapsuleStudio (client)
    [...rest]/page.tsx    # rotas desconhecidas → notFound()
  api/
    lastfm/route.ts       # proxy com whitelist de métodos e params
    artist-image/route.ts # busca no Deezer + matching normalizado
    image-proxy/route.ts  # proxy de imagem com whitelist *.dzcdn.net
  globals.css             # tokens de design (Tailwind 4)
  icon.svg                # marca/favicon
components/
  CapsuleStudio.tsx       # formulário, estados, progresso, export/share
  CapsuleCard.tsx         # card 432×768 (exportado a 1080×1920)
  CardHero.tsx            # foto do artista ou fallback canvas
  BackgroundCanvas.tsx    # ondas de fundo (mouse, reduced motion, hidden)
  SiteHeader.tsx / SiteFooter.tsx / BrandMark.tsx
i18n/                     # routing, request config e navigation do next-intl
lib/
  lastfmClient.ts         # paginação, concorrência, retry/backoff, cancelamento
  aggregate.ts            # agregação e estimativa de minutos (testado)
  periods.ts              # intervalos, validação e formatação com Intl
  artistMatch.ts          # matching normalizado do Deezer
  artistImage.ts          # resolução/pré-carregamento da foto hero
  exportCard.ts           # embed de fontes + html-to-image → PNG 1080×1920
  initials.ts / locales.ts
messages/                 # pt, en, es, fr, de, it, ja
tests/                    # Vitest (agregação, períodos, client, rotas, etc.)
docs/screenshots/         # capturas de referência
```

## Decisões técnicas

### Por que `user.getRecentTracks` em vez de `user.getTopTracks`?

`getTopTracks`/`getTopArtists` só aceitam janelas fixas (`7day`, `1month`…), e o "mês" do Last.fm não é o mês corrente. O app pagina `user.getRecentTracks` com `from`/`to` (unix) e agrega localmente, garantindo que **"mês atual"** seja exatamente do dia 1 até agora no fuso do visitante.

- `limit=200` por página; a primeira página descobre `totalPages`.
- As demais páginas rodam em paralelo com **concorrência 4**.
- Retry com **backoff exponencial** para erro 29 (rate limit), 5xx e falhas de rede.
- A faixa "now playing" (`@attr.nowplaying`) é ignorada.
- O botão **Cancelar** aborta todas as requisições em andamento (`AbortController`).

### Minutagem

O Last.fm não expõe tempo ouvido. A estimativa:

1. Busca a duração real (`track.getInfo` → `duration` em ms) para as **50 faixas mais tocadas** (concorrência 4).
2. Faixas sem duração, com duração 0 ou fora do top 50 usam **3,5 min (210 s)**.
3. `minutos = arredondar(Σ duração × scrobbles / 60.000)`.

A UI sempre mostra o valor como aproximado (`≈ 66 minutos`) e o tooltip explica o cálculo. O fallback e o limite do top 50 são configuráveis em `lib/periods.ts` (`DEFAULT_TRACK_DURATION_SECONDS`, `MAX_DURATION_LOOKUPS`).

### Foto do artista

O Last.fm não retorna mais fotos reais (placeholder). O app chama o Deezer, escolhe o resultado com melhor similaridade de nome normalizada (sem acentos/pontuação, case-insensitive) e serve a imagem pelo próprio domínio via `/api/image-proxy`. Isso evita canvas "tainted" por CORS no export. Se nada for encontrado, o card usa o fallback procedural em canvas.

### Export 1080×1920

`html-to-image` renderiza o card (432×768) com `pixelRatio: 2.5`. Antes do export:

- `document.fonts.ready` + dois frames de layout;
- todas as `<img>` do card são decodificadas;
- um embed de fontes sob medida inclui **somente os subsetos cujo `unicode-range` intersecta os caracteres do card** — sem isso, fontes CJK fatiadas em dezenas de arquivos fariam o export baixar megabytes desnecessários.

O PNG final é exatamente **1080×1920** (verificado em navegador).

### Design

Paleta neutra, uma única cor de destaque sólida, sem neon/gradiente/glassmorphism:

| Token | Valor |
| --- | --- |
| Fundo | `#0f0f10` |
| Superfície do formulário | `#171719` |
| Inputs | `#111113` |
| Corpo do card | `#212121` |
| Destaque único | `#F06848` |
| Texto | `#f4f4f5` / muted `#a1a1aa` |

Tipografia: Geist (sans) + Geist Mono (números/detalhes) + Noto Sans JP/KR/SC para CJK.

## Privacidade e segurança

- `LASTFM_API_KEY` existe apenas no servidor; o cliente nunca a recebe.
- `/api/lastfm` aceita apenas `user.getInfo`, `user.getRecentTracks` e `track.getInfo`; rejeita `api_key`/`format` enviados pelo cliente, valida inteiros (faixas e limites), username e caracteres de controle.
- `/api/image-proxy` aceita somente URLs `https` em `*.dzcdn.net`, revalida o host após redirects, exige `Content-Type: image/*` e limita o tamanho.
- Sem cookies de sessão, sem banco, sem storage, sem login. O locale fica na URL (`localeCookie: false`).
- Nada do histórico do usuário é registrado em logs do app.

## i18n

- Locales: `pt` (padrão, conteúdo pt-BR), `en`, `es`, `fr`, `de`, `it`, `ja`.
- Detecção por `Accept-Language` no middleware; troca manual no header preserva a rota.
- Datas e números usam `Intl` com o locale regional correto (`pt-BR`, `en-US`, `es-ES`, `fr-FR`, `de-DE`, `it-IT`, `ja-JP`).
- O texto do card é traduzido junto com a interface; a imagem exportada já usa o idioma ativo.

## Testes

```bash
pnpm test        # 66 testes unitários
pnpm typecheck
pnpm build
```

Cobertura atual dos testes:

- agregação de scrobbles, desempates, CJK e cálculo de minutagem;
- intervalos de período, validação de datas (registro, futuro, 365 dias), `Intl`;
- cliente Last.fm com `fetch` mockado: paginação, now playing, retry 29/rede, abort, top 50 durações, erros 6/17;
- matching de artistas no Deezer;
- rotas de API: whitelist de métodos/params, key do servidor, cache headers, proxy de imagem e whitelist de domínio.

Além disso, o fluxo real foi verificado em Chromium com Last.fm/Deezer simulados: estados da tela, progresso real, cancelamento, validação de período personalizado, preview, download **1080×1920**, fallback de compartilhamento, mobile e erros traduzidos (23 verificações, todas passando).

## Limitações conhecidas

- **Minutagem é estimativa**: depende de durações do `track.getInfo` e do fallback de 210 s; faixas ao vivo/remixes podem divergir.
- **Fotos vêm do Deezer**: matching por nome pode errar em artistas homônimos ou não encontrar nada (usa fallback canvas). Não há fotos vindas do Last.fm.
- **Períodos longos** (até 365 dias) fazem muitas requisições e podem esbarrar no rate limit do Last.fm. A UI mostra progresso e permite cancelar; erros 29 persistentes geram mensagem clara.
- **Perfis privados** ("hide recent listening") retornam erro 17; o app explica como liberar.
- **Export client-side** depende do navegador (testado em Chromium). Em dispositivos muito antigos/Safari com pouca memória o PNG pode falhar; há mensagem de erro.
- **Web Share API** não existe em todos os navegadores; nesses casos o app baixa o PNG.
- O card renderiza fotos e fontes apenas quando carregadas; a prévia aguarda o carregamento antes de habilitar o PNG.

## Solução de problemas

| Sintoma | Causa provável / solução |
| --- | --- |
| "Servidor está sem a chave da API" | `LASTFM_API_KEY` ausente em `.env.local` (ou na Vercel) e reinicie o servidor. |
| "Usuário não encontrado" | username inválido ou inexistente; confira em `last.fm/user/<nome>`. |
| "Scrobbles privados" | habilite "Mostrar audição recente" nas configurações de privacidade do Last.fm. |
| "Nenhum scrobble no período" | o período escolhido não tem histórico público. |
| "Rate limit" | aguarde e tente de novo; para períodos longos prefira rodar com menos frequência. |
| Preview sem foto | Deezer não encontrou o artista; o fallback geométrico é esperado. |
| Fontes CJK não aparecem | verifique se o build conseguiu baixar Noto Sans JP/KR/SC do Google Fonts. |
| Build falha no `prerender /404` | sintoma de `node_modules` corrompido; remova `node_modules` e rode `pnpm install` novamente. |

## Aviso

Sound Capsule é um projeto independente, sem afiliação com o Last.fm ou qualquer serviço de streaming. Os dados musicais são públicos e fornecidos pela API do Last.fm; as fotos de artistas vêm do Deezer.
