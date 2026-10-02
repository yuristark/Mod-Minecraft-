# WC Edificações — site institucional + painel administrativo

Site completo para construtora/edificadora: páginas públicas, portfólio de obras com filtros,
simulador de custo de obra, formulário de orçamento e painel administrativo com login.

> **Vai vender ou entregar este site?** Veja o [GUIA-DE-VENDA.md](GUIA-DE-VENDA.md): o que o produto
> entrega, o que pedir ao cliente, hospedagem, checklist de entrega e questões legais.

| Camada | Tecnologia |
|---|---|
| Front-end | React 19 + TypeScript + Vite + Tailwind CSS |
| 3D e animação | three.js (cenas 3D) · Motion (animações de UI) · CSS (keyframes, scroll-driven, View Transitions) |
| Back-end | Node.js 20+ + Express 5 |
| Banco | PostgreSQL 14+ |
| Imagens | sharp (reprocessamento e remoção de metadados) |

```
wc-edificacoes/
├── client/          front-end (site + painel)
│   └── src/config/site.ts   ← DADOS DA EMPRESA (edite aqui)
├── server/          API, banco, uploads
│   ├── migrations/  schema SQL
│   ├── src/         código da API
│   └── test/        testes de API e segurança (27 testes)
└── deploy/          exemplos de Nginx, Docker e PM2
```

---

## Animações e 3D

Todo o movimento do site segue um **sistema de motion design** único — as mesmas curvas e durações
em CSS, em React e na cena 3D:

| Arquivo | O que tem |
|---|---|
| `client/src/motion/tokens.ts` | Curvas (nomenclatura `Curves.*` do Flutter e Material 3), durações, molas (`SpringDescription`) e `interval()` para animações escalonadas |
| `client/src/index.css` (`:root`) | Os mesmos tokens como variáveis CSS (`--ease-*`, `--dur-*`) e todas as animações em CSS |
| `client/src/motion/flutter.tsx` | Widgets inspirados no Flutter: `AnimatedSwitcher`, `Staggered`/`StaggerItem` (Interval), `TweenNumber` (TweenAnimationBuilder) e `heroName()` (Hero) |
| `client/src/motion/ui.tsx` | Micro-interações: `Reveal`, `SplitWords` (título palavra por palavra), `Magnetic`, `TiltCard` (inclinação 3D + brilho), `ScrollProgress`, `Parallax`, `ScrollLine`, inclinação pela velocidade de rolagem |
| `client/src/three/hero.ts` | Cena 3D da página inicial: edifício erguido pavimento a pavimento, grua içando vigas, solda, janelas acendendo |
| `client/src/three/model.ts` | Maquete 3D do simulador: volumetria muda com tipo, padrão e área; arraste para girar |
| `client/src/lib/ripple.ts` | Onda de toque nos botões (InkWell do Material/Flutter) |

O que o visitante vê:
- **Página inicial** — cena three.js em tempo real (com HUD de pavimentos/estrutura), título revelado palavra por
  palavra, botões magnéticos, contadores animados, letreiro que inclina com a velocidade da rolagem, linha do
  processo que se desenha ao rolar, cartões com inclinação 3D.
- **Troca de página** — View Transitions API: a página sai subindo e a nova entra de baixo (FadeUpwards do Flutter);
  a capa do cartão de obra "voa" até a página da obra (Hero).
- **Cabeçalho** — esconde ao rolar para baixo, indicador deslizante entre os links, barra de progresso de leitura,
  menu móvel com revelação circular e itens escalonados.
- **Obras** — filtros com fundo deslizante; ao filtrar, os cartões se reorganizam com animação de layout.
- **Simulador** — maquete 3D, valores interpolados, barras de custo animadas, opções com seleção deslizante.
- **CSS puro** — preenchimento dos botões, grade de prancha em movimento, granulação, varredura, brilho de
  carregamento (shimmer), anel pulsante em obras em andamento, borda cônica girando, gancho balançando no 404.

Desempenho e acessibilidade:
- O three.js (~145 kB gzip) é baixado **só quando uma cena aparece**, num arquivo separado; a cena pausa fora da
  tela e com a aba oculta, e limita a resolução em celulares.
- Sem WebGL, o site mostra o desenho técnico em SVG no lugar da cena.
- `prefers-reduced-motion`: cenas 3D ficam estáticas, transições e transformações são desligadas.
- Compatível com a CSP estrita: nenhuma biblioteca injeta `<style>` ou scripts inline (o modo `popLayout` do
  Motion, que injetaria `<style>`, não é usado).

> Sobre "Flutter animations": Flutter é um framework de apps em Dart e não roda dentro deste site React.
> O que foi trazido é o modelo de animação dele (curvas, AnimatedSwitcher, staggered/Interval,
> TweenAnimationBuilder, Hero e transição de página FadeUpwards), reimplementado para a web.

---

## 1. Rodar no seu computador

Pré-requisitos: Node.js 20+, PostgreSQL rodando localmente.

```bash
# Banco (uma vez)
psql -U postgres -c "CREATE USER wc WITH PASSWORD 'senha_dev';"
psql -U postgres -c "CREATE DATABASE wc_edificacoes OWNER wc;"

# API
cd server
cp .env.example .env          # ajuste DATABASE_URL, NODE_ENV=development, IP_HASH_SECRET
npm install
npm run migrate               # cria as tabelas
npm run seed                  # (opcional) obras de exemplo
npm run create-admin          # cria o login do painel (pede nome, e-mail e senha)
npm run dev                   # http://localhost:3000

# Front-end (outro terminal)
cd client
npm install                   # ou pnpm install
npm run dev                   # http://localhost:5173  (o /api é redirecionado para a porta 3000)
```

Painel: `http://localhost:5173/admin`

**Demonstração sem servidor:** `cd client && npm run build:demo` gera `dist-demo/index.html`,
um arquivo único com dados fictícios (login demo preenchido na tela). Útil para mostrar ao cliente.
Abra **no navegador** — visualizadores de arquivo do celular não executam JavaScript. Para ter um link
público (bom para testar no celular), use o workflow `.github/workflows/demo-pages.yml` (GitHub Pages).

---

## 2. Personalizar para o cliente

1. **`client/src/config/site.ts`** — nome, endereço do site (`url`), CNPJ, CREA, telefone, WhatsApp, e-mail,
   endereço, redes sociais, ano de fundação, encarregado LGPD. Os campos marcados `PREENCHER` estão provisórios;
   `npm run check:config` lista os que faltam (o build também avisa). Título, descrição, Open Graph e dados
   estruturados (JSON-LD) do `index.html` são gerados a partir deste arquivo (`client/build/siteHtml.ts`).
   Depois de trocar logo/nome, rode `npm run assets` (Node 22+) para gerar ícones e `og-image.png`.
2. **`client/src/data/services.ts`** — textos de serviços, etapas e compromissos.
3. **`client/src/index.css`** (`:root`) — cores da marca. `client/public/favicon.svg` — ícone.
4. **Política de privacidade** — `client/src/pages/Privacidade.tsx` é um modelo; peça revisão jurídica.
5. **Obras** — cadastre no painel (com fotos). Remova as de exemplo: `npm run seed -- --remove`.
6. **Simulador** — ajuste os valores por m² no painel em *Simulador* (use referências da região, ex. CUB do Sinduscon).

---

## 3. Publicar (produção)

O Express serve a API **e** o front compilado no mesmo domínio — isso permite cookies
`SameSite=Strict`, CSP sem exceções e nenhuma configuração de CORS.

### Opção A — VPS (Ubuntu) com Nginx + PM2

```bash
# no servidor
git clone <repo> /var/www/wc-edificacoes && cd /var/www/wc-edificacoes
cd client && npm ci && npm run build && cd ..
cd server && npm ci --omit=dev
cp .env.example .env && nano .env      # NODE_ENV=production, ALLOWED_ORIGINS=https://..., TRUST_PROXY=1
npm run migrate && npm run create-admin
npm i -g pm2 && pm2 start ../deploy/ecosystem.config.cjs && pm2 save && pm2 startup
```

Copie `deploy/nginx.conf` para `/etc/nginx/sites-available/`, ajuste o domínio e gere o HTTPS:
`sudo certbot --nginx -d wcedificacoes.com.br -d www.wcedificacoes.com.br`

### Opção B — Docker

```bash
cp server/.env.example server/.env    # preencha
docker compose -f deploy/docker-compose.yml up -d --build
docker compose -f deploy/docker-compose.yml exec app npm run create-admin
```

Coloque um proxy com HTTPS na frente (Nginx, Caddy ou Cloudflare).

### Variáveis obrigatórias em produção
`DATABASE_URL`, `IP_HASH_SECRET` (≥ 32 caracteres aleatórios), `ALLOWED_ORIGINS` (só `https://`),
`TRUST_PROXY` (nº de proxies na frente). A API **não inicia** se faltarem.

Recomendadas: `SITE_URL` (usado no `sitemap.xml`, `robots.txt` e nos e-mails) e o bloco `SMTP_*` + `NOTIFY_EMAIL`
para receber **um e-mail a cada novo pedido de orçamento** (funciona com o e-mail do domínio, Google Workspace
com senha de app, Brevo, Resend etc.). Sem SMTP o site funciona normalmente — os pedidos ficam só no painel.

---

## 4. Segurança implementada

### Back-end
| Risco | Proteção |
|---|---|
| SQL injection | 100% consultas parametrizadas (`$1, $2…`); busca escapa `%` e `_` do LIKE |
| Validação | Todos os dados validados com Zod (tipos, tamanhos, listas fixas); campos desconhecidos são descartados |
| Senhas | Argon2id (parâmetros OWASP), rehash automático, política mínima de 12 caracteres |
| Força bruta | Rate limit por IP no login + bloqueio da conta após 5 erros (15 min) + resposta idêntica para e-mail inexistente (sem enumeração, mesmo tempo de resposta) |
| Sessão | Token aleatório de 256 bits em cookie `HttpOnly`, `Secure`, `SameSite=Strict`, prefixo `__Host-`; no banco fica só o hash SHA-256; expira por inatividade (60 min) e por tempo total (8 h); rotação no login; máx. 5 sessões; troca de senha derruba as demais |
| CSRF | 3 camadas: SameSite=Strict + verificação de `Origin` em toda escrita + token sincronizado (`X-CSRF-Token`) nas rotas do painel |
| XSS | CSP estrita sem `unsafe-inline`/`unsafe-eval`; React escapa todo texto; nenhum `dangerouslySetInnerHTML`; caracteres de controle e bidi removidos |
| Uploads | Só JPG/PNG/WebP verificados pelo **conteúdo** (não pela extensão); SVG recusado; limite de tamanho e pixels (anti "decompression bomb"); imagem re-codificada para WebP com **EXIF/GPS removido**; nome aleatório (UUID); servidos com `nosniff` e CSP `sandbox` |
| Spam no formulário | Honeypot + tempo mínimo de preenchimento + rate limit (5/h por IP) + Cloudflare Turnstile opcional |
| Dados adulterados | Estimativa de custo e status são calculados/definidos no servidor; o que vem do navegador é ignorado |
| CSV injection | Exportação prefixa células que começam com `= + - @` |
| Cabeçalhos | Helmet: HSTS (preload), X-Frame-Options DENY, frame-ancestors none, nosniff, Referrer-Policy, COOP/CORP, Permissions-Policy; `X-Powered-By` removido; API com `Cache-Control: no-store` |
| Vazamento de erros | Stack traces nunca vão ao cliente (só um `requestId` para achar no log); logs com redação de cookies, senhas, e-mail e telefone |
| DoS | Limite de JSON 32 KB, timeouts de consulta (10 s) e de conexão HTTP (anti slowloris), rate limit geral |
| LGPD | Consentimento registrado com data/hora; IP guardado só como HMAC; exclusão definitiva pelo painel; política de privacidade; sem cookies de rastreamento |
| E-mail de aviso | Enviado depois de responder ao visitante (falha no SMTP nunca perde o pedido); assunto sem quebras de linha (anti header injection); dados pessoais não vão para o log |
| Auditoria | Log de logins, falhas, bloqueios, exportações e alterações (visível em *Conta e segurança*) |

### Front-end
- Fontes hospedadas no próprio site (sem Google Fonts → CSP mais fechada e sem rastreio de terceiros).
- Token CSRF só em memória (nunca em `localStorage`); cookie de sessão inacessível ao JavaScript.
- Parâmetros da URL validados contra listas fixas antes do uso; redirecionamento pós-login só para rotas internas (anti *open redirect*).
- Links externos com `rel="noopener noreferrer"`; painel com `noindex` e bloqueado no `robots.txt`.
- Código do painel e do three.js carregados sob demanda (visitantes não baixam o admin); build sem source maps.
- Nenhuma dependência que injete `<style>`/scripts inline — por isso a CSP pode ser estrita.

### Compatibilidade e "nunca tela branca"
- Código compilado para **iOS 14+ / Safari 14+, Chrome/Android 87+, Firefox 78+** (`build.target` em `vite.config.ts`).
  Antes, o build saía só para navegadores de 2023+ e iPhones com iOS < 16.4 abriam uma página em branco.
- Se o JavaScript não rodar (visualizador de arquivos, navegador antigo, bloqueio), aparece uma página com nome,
  descrição e botões de WhatsApp/telefone/e-mail. Se algo quebrar durante o uso, uma tela de erro com os contatos.
- Cenas 3D: sem WebGL, mostram o desenho técnico em SVG.

### Testes
```bash
cd server
TEST_DATABASE_URL=postgres://wc:senha@localhost:5432/wc_test npm test
```
27 testes cobrindo: cabeçalhos, SQL injection, XSS armazenado, CSRF, enumeração de usuários,
bloqueio de conta, cookie seguro, upload malicioso (SVG disfarçado, EXIF), path traversal,
CSV injection, limites de tamanho, política de senha, rate limit, sitemap/robots e aviso por e-mail
(inclusive falha do SMTP sem perder o pedido). `npm audit`: 0 vulnerabilidades.

---

## 5. Checklist antes de entregar ao cliente

- [ ] `site.ts` preenchido — `npm run check:config -- --strict` passa
- [ ] Ícones e imagem de compartilhamento gerados com a marca do cliente (`npm run assets`)
- [ ] SMTP configurado e um orçamento de teste recebido por e-mail
- [ ] Sitemap enviado no Google Search Console (`https://dominio/sitemap.xml`)
- [ ] Obras de exemplo removidas e obras reais cadastradas com fotos
- [ ] Valores do simulador revisados com o cliente
- [ ] Política de privacidade revisada
- [ ] `.env` de produção com `NODE_ENV=production`, segredo forte e `ALLOWED_ORIGINS` correto
- [ ] Usuário do PostgreSQL **sem** superusuário, senha forte, porta 5432 fechada para a internet
- [ ] HTTPS ativo (teste em https://securityheaders.com e https://www.ssllabs.com/ssltest)
- [ ] Backup diário do banco **e** da pasta `server/uploads` (ex.: `pg_dump` via cron)
- [ ] Senha do admin entregue ao cliente por canal seguro; peça para trocá-la no primeiro acesso
- [ ] (Opcional) Turnstile configurado se houver spam

## 6. Manutenção

- **Esqueceu a senha do painel?** No servidor: `npm run create-admin` com o mesmo e-mail redefine a senha.
- **Atualizações:** rode `npm audit` e `npm outdated` mensalmente nas duas pastas.
- **Mais de uma instância da API?** Troque o rate limit em memória por Redis (`rate-limit-redis`).
- **Backup:** `pg_dump -Fc wc_edificacoes > backup-$(date +%F).dump` + cópia de `server/uploads/`.

## 7. Próximos passos sugeridos (não incluídos)
Aviso por WhatsApp (API oficial) a cada novo orçamento, autenticação em dois fatores no painel e
Google Analytics/Meta Pixel (exigiria banner de cookies e ajuste da CSP). Aviso por e-mail e sitemap.xml já estão incluídos.
