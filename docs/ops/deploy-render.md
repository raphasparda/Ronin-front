# Deploy do front no Render (Static Site)

Público: quem publica e mantém o ronin-web no Render.

O ronin-web é publicado como **Static Site**: o Render roda o build, serve o `dist/` pela CDN e repassa `/api/*` para o Web Service da API (ronin-api). Para o navegador, front e API ficam na mesma origem: o cookie de sessão é da própria origem do site e a CSP usa só `'self'`.

A configuração da API no Render (variáveis `APP_ORIGIN`, `SETUP_TOKEN`, `TRUST_PROXY` etc.) fica no `docs/ops/` do **ronin-api**. O `APP_ORIGIN` da API precisa ser a URL pública deste Static Site (ex.: `https://ronin.onrender.com`), porque é essa a origem que o navegador envia.

## 1. Criar o Static Site

_New → Static Site_, repositório `raphasparda/Ronin-front`.

| Campo             | Valor                         |
| ----------------- | ----------------------------- |
| Branch            | `main`                        |
| Root Directory    | vazio (raiz do repositório)   |
| Build Command     | `sh scripts/render-build.sh`  |
| Publish Directory | `dist`                        |
| Auto-Deploy       | `On Commit` (padrão)          |

### Variáveis de ambiente

| Nome                 | Tipo       | Obrigatória | Valor                                                                                                                                  |
| -------------------- | ---------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `GH_RONIN_END_TOKEN` | **segredo** | sim         | fine-grained PAT (dono `raphasparda`) com acesso só ao repositório `Ronin-End`, permissão _Contents: Read-only_. O mesmo usado no segredo `RONIN_API_TOKEN` do CI |
| `NODE_VERSION`       | texto      | sim         | `24` (igual ao `.nvmrc`; o `engine-strict` do `.npmrc` recusa outra versão)                                                            |
| `RONIN_API_REF`      | texto      | não         | branch ou tag do Ronin-End usada como fonte do `@raphasparda/ronin-shared`. Padrão: `main`                                             |

O PAT expira (máximo 1 ano): anote a data e renove no Render e no GitHub Actions ao mesmo tempo.

## 2. O que o build faz

`scripts/render-build.sh` (POSIX `sh`, roda no Linux do Render):

1. Falha na hora, com mensagem clara, se `GH_RONIN_END_TOKEN` não estiver definida.
2. Clona `raphasparda/Ronin-End` em `../ronin-api` (`--depth 1`, branch `RONIN_API_REF`). O `@raphasparda/ronin-shared` vem de `link:../ronin-api/packages/shared`, por isso a pasta fica ao lado deste repositório. O token nunca é impresso: o script não usa `set -x`, qualquer saída do `git` passa por uma redação que troca o token por `***` e, depois do clone, a URL do remote volta a ser a pública, sem token.
3. `corepack enable` numa pasta temporária (versão do pnpm do `packageManager`, sem mexer no Node global).
4. No ronin-api: `pnpm install --frozen-lockfile --prod --filter @raphasparda/ronin-shared`. Instala só o pacote de contratos com dependências de produção (o `zod`), sem ferramentas de desenvolvimento nem o PostgreSQL embutido. O pnpm ainda liga as dependências de produção da raiz do workspace (cerca de 100 pacotes, contra 300 do install completo); o build não usa nenhuma delas.
5. No ronin-web: `pnpm install --frozen-lockfile` e `pnpm build`. O `NODE_ENV=development` vale só para o install (para trazer as devDependencies, como o Vite); o `pnpm build` roda sem ele, senão o bundle sairia em modo de desenvolvimento.
6. Confere que `dist/index.html` existe.

Se `../ronin-api` já existir, o script para sem apagar nada.

### Testar o script localmente (Git Bash, sem token)

`RONIN_API_GIT_URL` troca a URL do clone e dispensa o token. Numa pasta temporária, para não tocar no `../ronin-api` de desenvolvimento:

```sh
mkdir -p /tmp/render-test && cd /tmp/render-test
git clone "/e/Projetos pessoais/ronin-web" ronin-web
cd ronin-web
RONIN_API_GIT_URL="file:///e/Projetos pessoais/ronin-api" sh scripts/render-build.sh
```

Use `file://` (e não o caminho direto) para o `--depth 1` valer. O clone pega o que está commitado no ronin-api, não o que está só na árvore de trabalho.

## 3. Redirects/Rewrites

Em _Redirects/Rewrites_, nesta ordem (o Render aplica a primeira regra que casar):

| #   | Source   | Destination                                  | Action  |
| --- | -------- | -------------------------------------------- | ------- |
| 1   | `/api/*` | `https://<ronin-api>.onrender.com/api/*`     | Rewrite |
| 2   | `/*`     | `/index.html`                                | Rewrite |

- `<ronin-api>` é o nome do Web Service da API. A regra 1 precisa vir antes da 2, senão as chamadas da API recebem o `index.html`.
- A regra 2 é o fallback da SPA: `/b/<id>`, `/meus-cards` etc. abrem o app em vez de 404. Arquivos que existem no `dist/` (`/assets/*`, `/theme-init.js`, ícones) continuam sendo servidos direto.
- Com a regra 1 o navegador só fala com a origem do Static Site, por isso não há CORS e a CSP usa `connect-src 'self'`.

## 4. Headers

Em _Headers_. Path `/*` vale para todo o site; `/assets/*` sobrescreve o `Cache-Control` dos arquivos com hash.

| Path        | Header                      | Valor                                                                                                                                                                                                                                  |
| ----------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/*`        | `Content-Security-Policy`   | `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob: https://<R2_PUBLIC_HOST>; font-src 'self'; connect-src 'self' https://<R2_PUBLIC_HOST>; manifest-src 'self'; worker-src 'self'; object-src 'none'; frame-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` |
| `/*`        | `X-Content-Type-Options`    | `nosniff`                                                                                                                                                                                                                              |
| `/*`        | `X-Frame-Options`           | `DENY`                                                                                                                                                                                                                                 |
| `/*`        | `Referrer-Policy`           | `strict-origin-when-cross-origin`                                                                                                                                                                                                      |
| `/*`        | `Permissions-Policy`        | `accelerometer=(), autoplay=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), usb=(), browsing-topics=()`                                                          |
| `/*`        | `Cross-Origin-Opener-Policy` | `same-origin`                                                                                                                                                                                                                         |
| `/*`        | `Strict-Transport-Security` | `max-age=31536000; includeSubDomains`                                                                                                                                                                                                  |
| `/*`        | `Cache-Control`             | `no-cache`                                                                                                                                                                                                                             |
| `/assets/*` | `Cache-Control`             | `public, max-age=31536000, immutable`                                                                                                                                                                                                  |

### Por que a CSP é assim

- **`script-src 'self'`** sem `'unsafe-inline'` nem `'unsafe-eval'`: o `index.html` não tem script inline. O tema é aplicado antes da primeira pintura por `public/theme-init.js`, arquivo externo. O Vite gera só `<script type="module" src="/assets/...">`.
- **Zod sem `eval`**: o Zod 4 sonda `new Function` ao criar schemas de objeto, e a CSP registra essa tentativa como violação mesmo com o erro tratado. `src/lib/zod-csp.ts` liga `z.config({ jitless: true })`; o `vite.config.ts` coloca esse arquivo no mesmo chunk do `zod` para ele rodar antes dos schemas do `@raphasparda/ronin-shared`. Não remova o grupo `zod` do `codeSplitting` sem refazer a validação abaixo.
- **`style-src 'self'`**: o CSS sai em `/assets/*.css`. Os estilos dinâmicos do React e do `@dnd-kit` são aplicados por `element.style`, que a CSP não bloqueia.
- **`font-src 'self'`**: a Figtree vem do `@fontsource-variable` e é empacotada em `/assets/*.woff2`.
- **`img-src 'self' data: blob: https://<R2_PUBLIC_HOST>`**: imagens de `public/` e eventuais `data:` que o Vite embute; `blob:` é a pré-visualização local da capa enquanto o envio acontece; o host do R2 serve a capa por URL assinada (Fatia 11, ADR 0016).
- **`connect-src 'self' https://<R2_PUBLIC_HOST>`**: a API chega pelo rewrite `/api/*`; o host do R2 recebe o `PUT` do upload direto da capa.
- **`<R2_PUBLIC_HOST>` é um espaço reservado** (tarefa 11.9): troque pelo host real do bucket depois de criá-lo — `<bucket>.<account-id>.r2.cloudflarestorage.com` (endpoint S3 do R2) ou o domínio próprio ligado ao bucket. Sem esse host na CSP o navegador bloqueia o `PUT` do upload e a imagem da capa. Enquanto a instância não tem R2 configurado, `features.cardCovers` vem `false`, a UI não mostra "Adicionar capa" e a CSP pode ficar sem o host (os dois trechos `https://<R2_PUBLIC_HOST>` saem da linha).
- **`frame-ancestors 'none'`** e `X-Frame-Options: DENY`: ninguém embute o app em iframe.

### Cache

- `/assets/*` tem hash no nome: cache de 1 ano, `immutable`.
- Todo o resto (o `index.html`, inclusive quando servido pelo fallback da SPA, `theme-init.js`, ícones) vai com `no-cache`: o navegador revalida e pega o `index.html` novo logo depois do deploy.

Depois do primeiro deploy, confira que o `/assets/*` ficou com o cache longo (se o Render aplicar a regra `/*` por cima, o `no-cache` vale para tudo: o site funciona, só perde o cache dos assets):

```sh
curl -sI https://<site>.onrender.com/ | grep -i "cache-control\|content-security"
curl -sI https://<site>.onrender.com/assets/<arquivo>.js | grep -i cache-control
curl -sI https://<site>.onrender.com/api/setup/status
```

### Validação da CSP (feita antes de documentar)

Build de produção servido por um servidor estático local com exatamente os headers acima, regra mais específica vencendo, e o fallback da SPA. Chromium headless (Playwright) com listener de `securitypolicyviolation` e do console, API simulada nas rotas `/api/*`:

| Tela                                                      | Violações |
| --------------------------------------------------------- | --------- |
| API fora do ar (tela "Não foi possível abrir o Ronin")    | 0         |
| Configurar a equipe com código de configuração, claro e escuro 360px | 0 |
| Entrar, claro e escuro 360px                              | 0         |
| Quadros                                                   | 0         |
| Quadro com arraste de card                                | 0         |
| Detalhe do card (Markdown, comentários), escuro           | 0         |
| Meus cards 360px                                          | 0         |

Antes do ajuste do Zod, todas as telas registravam `script-src eval` no chunk dos schemas.

Capa do card (Fatia 11): a validação com o host do R2 só pode ser refeita quando o bucket existir (tarefa 11.9). Telas a repetir com o host preenchido: quadro com card com capa, detalhe do card com capa, envio de capa (o `PUT` direto no R2) — nenhuma violação de `img-src` nem de `connect-src`.

Para repetir depois de mudar dependências ou o `index.html`: `pnpm build`, sirva o `dist/` com os headers da tabela e o fallback para `index.html`, abra as telas no Chromium e procure `Refused to` / `Content Security Policy` no console.

## 5. Atualizar

- **Front**: push na `main` do Ronin-front dispara o deploy (Auto-Deploy). Para refazer sem commit: _Manual Deploy → Deploy latest commit_ (ou _Clear build cache & deploy_ se suspeitar de cache).
- **Contrato novo no ronin-api**: um push no Ronin-End **não** redeploya o front. Depois do merge na `main` do Ronin-End, dispare _Manual Deploy_ aqui se o front precisar do contrato novo. Para buildar contra outra branch do ronin-api, mude `RONIN_API_REF` e redeploye (e volte para `main` depois).
- **Token expirado**: o build falha no clone com `git clone falhou`. Gere um PAT novo e atualize `GH_RONIN_END_TOKEN` (Render) e `RONIN_API_TOKEN` (GitHub Actions).

## Falhas comuns

- **`GH_RONIN_END_TOKEN não definida`**: variável ausente ou cadastrada em outro serviço.
- **`git clone falhou`**: token expirado, sem acesso ao Ronin-End ou `RONIN_API_REF` inexistente.
- **`ERR_PNPM_OUTDATED_LOCKFILE`**: `package.json` mudou sem o `pnpm-lock.yaml` (deste repositório ou do ronin-api).
- **`Unsupported engine`**: `NODE_VERSION` diferente de 24.
- **Tela em branco com erro de CSP no console**: algo novo precisa de uma fonte fora de `'self'` (script inline, CDN, fonte externa). Prefira trazer o recurso para o bundle a afrouxar a CSP.
- **Chamadas da API voltam HTML**: a regra `/api/*` está depois do fallback `/*` ou aponta para o host errado.
- **403 em toda mutação**: `APP_ORIGIN` da API diferente da URL do Static Site.
