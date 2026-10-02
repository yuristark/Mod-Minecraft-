# WC Edificações — site institucional + painel administrativo

Site completo para construtora/edificadora: páginas públicas, portfólio de obras com filtros,
simulador de custo de obra, formulário de orçamento e painel administrativo com login.

| Camada | Tecnologia |
|---|---|
| Front-end | React 19 + TypeScript + Vite + Tailwind CSS |
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
│   └── test/        testes de API e segurança (24 testes)
└── deploy/          exemplos de Nginx, Docker e PM2
```

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

---

## 2. Personalizar para o cliente

1. **`client/src/config/site.ts`** — nome, CNPJ, CREA, telefone, WhatsApp, e-mail, endereço,
   redes sociais, ano de fundação, encarregado LGPD. Os campos marcados `PREENCHER` estão provisórios.
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
| Auditoria | Log de logins, falhas, bloqueios, exportações e alterações (visível em *Conta e segurança*) |

### Front-end
- Fontes hospedadas no próprio site (sem Google Fonts → CSP mais fechada e sem rastreio de terceiros).
- Token CSRF só em memória (nunca em `localStorage`); cookie de sessão inacessível ao JavaScript.
- Parâmetros da URL validados contra listas fixas antes do uso; redirecionamento pós-login só para rotas internas (anti *open redirect*).
- Links externos com `rel="noopener noreferrer"`; painel com `noindex` e bloqueado no `robots.txt`.
- Código do painel carregado sob demanda (visitantes não baixam o admin); build sem source maps.
- Nenhuma dependência que injete `<style>`/scripts inline — por isso a CSP pode ser estrita.

### Testes
```bash
cd server
TEST_DATABASE_URL=postgres://wc:senha@localhost:5432/wc_test npm test
```
24 testes cobrindo: cabeçalhos, SQL injection, XSS armazenado, CSRF, enumeração de usuários,
bloqueio de conta, cookie seguro, upload malicioso (SVG disfarçado, EXIF), path traversal,
CSV injection, limites de tamanho, política de senha e rate limit. `npm audit`: 0 vulnerabilidades.

---

## 5. Checklist antes de entregar ao cliente

- [ ] `site.ts` preenchido (sem nenhum `PREENCHER`)
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
Aviso por e-mail/WhatsApp a cada novo orçamento (SMTP ou API), autenticação em dois fatores no
painel, sitemap.xml gerado a partir das obras, e Google Analytics/Meta Pixel (exigiria banner de cookies e ajuste da CSP).
