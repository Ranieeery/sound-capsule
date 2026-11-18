# Planejamento da próxima iteração

Status: **implementado** — este documento fica como registro das decisões da iteração.
Data: 2026-11-18.
Deploy: <https://semaninha-sigma.vercel.app>
Escopo: projeto pessoal/**não comercial** (Hobby da Vercel e TOS do Last.fm).

## Decisões fechadas

| Tema | Decisão |
| --- | --- |
| Uso comercial | Fora de escopo. Hobby e API do Last.fm são para uso pessoal não comercial. |
| Período personalizado | **Duração máxima de 3 meses de calendário**, sem restringir a janela de datas. |
| Dados persistidos | **Somente idioma e cor/tema escolhidos.** Nada do Last.fm, usuário, resultado ou foto. |
| Estado do fluxo | Memória do cliente. Troca de idioma preserva; F5 perde (exceto idioma e tema). |
| Tema do card | **Opção A**: accents fixos curados, sem color picker. |
| Fotos | Deezer automático → **upload local opcional** (nunca enviado ao servidor) → canvas com iniciais. |
| Picker de candidatos Deezer | Descartado por ora. |
| Last.fm | P0: User-Agent, atribuição e throttle. Crédito no card conforme TOS. |

Ordem do topo do card: **foto enviada** → **match Deezer** → **canvas**.

## 0. Deploy e URLs

- URL pública: <https://semaninha-sigma.vercel.app>
- Usar essa URL no README, no User-Agent do Last.fm/Deezer e como Application URL no cadastro da API key.
- `metadataBase`/alternates do Next.js podem usar essa origem.
- Após implementar, validar um preview de deploy: atribuição, UA, cache e persistência.

## 1. Período: 3 meses de calendário

Confirmado: o limite é de **duração máxima de 3 meses de calendário**, não uma janela fixa de 90
dias nem uma restrição de quais datas podem ser escolhidas.

- Pode escolher qualquer início desde o registro no Last.fm e qualquer fim até hoje.
- O intervalo não pode passar de 3 meses (aritmética de calendário, `addMonths(start, 3)`).
- “90 dias” é só referência aproximada, não regra rígida e não janela de datas.
- Validar 28/29/30/31 dias, virada de ano e o limite exato.
- Mensagens: “Máx. 3 meses” e aviso de que períodos longos demoram.

Requisições aproximadas por cápsula:

| Período | Scrobbles | Requisições Last.fm |
| --- | ---: | ---: |
| Semana | 500 | ~54 |
| Mês | 3.000 | ~66 |
| 3 meses (moderado) | 9.000 | ~96 |
| 3 meses (pesado) | 25.000 | ~176 |

## 2. Dados persistidos (única exceção à privacidade)

Guardar **apenas**:

| Dado | Onde | Como |
| --- | --- | --- |
| Idioma | Cookie do next-intl (`NEXT_LOCALE`) | `localeCookie` com `maxAge` longo; só o locale (`pt`…`ja`) |
| Cor/tema | `localStorage` | Só o id do accent (`ember`, `tide`…) |

Não persistir em local/cookie/storage:

- username digitado;
- resultado da API/`CapsuleData`;
- foto enviada;
- período/datas.

Esses dados ficam apenas em memória e são descartados no F5, exceto o que sustenta a troca de
idioma (store em memória, não storage).

Ajustes necessários:

- ativar `localeCookie` no `i18n/routing.ts` (hoje está `false`);
- ler o tema do `localStorage` após mount para evitar hydration mismatch (default `ember`);
- atualizar textos de privacidade do site e README:
  “Apenas idioma e tema ficam salvos neste navegador; nenhum dado do Last.fm é armazenado.”
  (hoje o texto diz “nada do seu perfil é armazenado”, que continua verdadeiro, mas precisa da exceção.)
- teste automatizado/checagem manual: nenhuma outra chave de storage/cookie é criada;
  idioma e tema sobrevivem ao F5; resultado/username somem.

## 3. Last.fm: itens 1–3

1. **User-Agent identificável** no proxy e no Deezer:
   `SoundCapsule/1.0 (+https://semaninha-sigma.vercel.app)`.
2. **Atribuição**:
   - link/botão “powered by Last.fm” no rodapé do site;
   - links para perfil/artistas/faixas onde fizer sentido;
   - crédito no card exportado (ex.: `Data from Last.fm`) conforme TOS;
   - não usar logo/marca do Last.fm fora das brand guidelines.
3. **Throttle/redução**:
   - concorrência de páginas e de `track.getInfo` de 4 → 3;
   - pacer de ~3–4 req/s no cliente;
   - cache de sessão para não repetir páginas ao regerar o mesmo período;
   - cache de CDN longo para `track.getInfo`;
   - manter retry/backoff no erro 29 e cancelamento.

## 4. Cache no serverless / plano free da Vercel

Hobby ([fonte](https://vercel.com/docs/plans/hobby)):

| Recurso | Hobby |
| --- | ---: |
| Function Invocations | 1.000.000 / mês |
| CDN Requests | 1.000.000 / mês |
| Fast Data Transfer | 100 GB / mês |
| Active CPU | 4 CPU-h / mês |
| Provisioned Memory | 360 GB-h / mês |
| Duração máxima | 300 s |
| Corpo request/response | 4,5 MB (não-streamed) |

- Respostas com `s-maxage` entram no CDN; **cache hit não invoca function nem conta duração**
  ([CDN Cache](https://vercel.com/docs/caching/cdn-cache), [pricing](https://vercel.com/pricing)).
- Cache em memória no serverless não é confiável; usar CDN + store do cliente.
- Headers planejados: `Cache-Control: public, max-age=0, must-revalidate` +
  `Vercel-CDN-Cache-Control: public, s-maxage=…`.
- `user.getRecentTracks` com `to` em segundos tem pouco cache hit; o ganho vem de
  `track.getInfo`, `artist-image` e `image-proxy`.
- Proxy de imagem: hoje aceita 12 MB, mas resposta não-streamed na Vercel tem teto de 4,5 MB.
  Plano: limitar para <4,5 MB ou fazer streaming.
- Upload de foto não consome função/banda/limite de 4,5 MB porque não sai do navegador.
- Sem KV/Redis/Blob. Limitador global distribuído só se houver tráfego público real.

TTLs:

| Rota | CDN | Navegador |
| --- | --- | --- |
| `user.getInfo` | 300 s | no-store/revalidate |
| `user.getRecentTracks` | 60–300 s (ganho baixo) | no-store |
| `track.getInfo` | 24 h + SWR 7 d | no-store |
| `artist-image` | 24 h | no-store |
| `image-proxy` | 24 h | no-store |

## 5. Estado entre idiomas (memória)

- `lib/studioSession.ts` com singleton + `useSyncExternalStore`.
- Guarda apenas em memória: username, período/datas, `CapsuleData`, range, hero URL, foto enviada,
  tema ativo (tema também espelhado no localStorage por ser persistido).
- Recalcular labels/título/minutos com o locale atual.
- Ao remontar por troca de idioma: hidratar do store, **não** refazer `fetchCapsule` nem prefetch
  de `user.getInfo` se já houver dados.
- F5: perde tudo, menos idioma (cookie) e tema (localStorage).
- Cuidado com SSR/hidratação.

Resultado: troca de idioma = 0 requisições ao Last.fm.

## 6. Upload local de foto

Custo Vercel: **zero**. Nada é enviado ao servidor.

- input `file` local; JPEG/PNG/WebP; limite ~10 MB; rejeitar SVG/GIF animado;
- decode + resize no canvas para ~1440 px; data URL em memória;
- prioridade sobre o Deezer; “Remover” volta ao automático; se falhar, canvas;
- export PNG embeda a data URL sem CORS/tainted canvas;
- troca de idioma mantém (store); F5 perde (não é dado persistido);
- validar tipo/tamanho; cuidado com memória em celular.

## 7. Temas (Opção A)

- `lib/cardThemes.ts` com 5 accents fixos: Ember `#F06848` (padrão), Tide `#5B9DFF`,
  Moss `#7ED08A`, Plum `#C084FC`, Sand `#E7C27A`.
- Só o accent do card muda; fundo `#212121`, textos e bordas iguais.
- Seletor acessível na prévia; `localStorage` guarda só o id; preview e export usam o mesmo tema.
- Sem API. Validar contraste e gerar screenshots.

## 8. Privacidade / textos

Atualizar:

- rodapé/README: guardar apenas idioma e tema; nenhum dado do Last.fm/username/foto é persistido;
- remover qualquer promessa absoluta de “nada é armazenado”;
- documentar o cookie `NEXT_LOCALE` e a chave de tema no localStorage.

## Testes e aceite

- Unitários: limite 3 meses, store, temas, upload, normalização de username.
- E2E: troca de idioma sem novas requisições; upload + export 1080×1920; cada tema exporta;
  erros de upload; idioma e tema sobrevivem ao F5; username/resultado somem.
- Deploy preview: UA, atribuição, headers de cache, apenas storage/cookies permitidos e consumo no dashboard.

## Decisões finais (implementadas)

1. Crédito no card: **`Data from Last.fm` + `last.fm/user/<username>`**, com opção de ocultar o username; URL do site no card.
2. Upload: 10 MB, JPEG/PNG/WebP, processado só no navegador.
3. Paleta: Ember, Tide, Moss, Plum, Sand.
4. Persistência: apenas idioma (cookie) e tema (`localStorage`); username/resultado/foto em memória.
5. Limite do período personalizado: 3 meses de calendário.
6. Cache/rate: CDN + pacer, sem KV/Redis/Blob.

