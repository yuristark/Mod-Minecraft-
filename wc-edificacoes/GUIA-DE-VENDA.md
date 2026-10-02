# Guia de venda e entrega — Site WC Edificações

Este guia junta tudo o que você precisa para **vender**, **personalizar** e **entregar** este site
para uma construtora. O passo a passo técnico está no `README.md`.

---

## 1. O que o produto entrega (para usar na proposta)

**Site institucional**
- Página inicial com cena 3D em tempo real (prédio sendo construído, grua em operação)
- Portfólio de obras com filtros por tipo e fase, página de cada obra com galeria de fotos
- Página de serviços, página da empresa, política de privacidade (LGPD)
- Simulador de custo de obra com maquete 3D que muda conforme tipo, padrão e área
- Formulário de orçamento com proteção anti-spam e protocolo de atendimento
- Botão flutuante de WhatsApp, links de telefone e e-mail em todas as páginas
- Perguntas frequentes (editáveis em `client/src/data/faq.ts`)
- Simulação e obras compartilháveis por link (WhatsApp, e-mail)
- Animações profissionais (transições entre páginas, revelações, micro-interações)
- Funciona em celular, tablet e computador; acessível (teclado, leitores de tela, "reduzir movimento")

**Painel administrativo** (`/admin`)
- Pedidos de orçamento com status (novo, em contato, proposta, fechado), busca e exportação para planilha (CSV)
- **Aviso por e-mail a cada novo pedido** (configurável)
- Cadastro de obras com fotos (as fotos são otimizadas e têm a localização GPS removida automaticamente)
- Ajuste dos valores do simulador por m²
- Registro de acessos e troca de senha

**Qualidade técnica** (diferencial para clientes mais exigentes)
- Segurança de nível profissional: proteção contra SQL injection, XSS, CSRF, força bruta, uploads maliciosos — com 32 testes automáticos
- LGPD: consentimento registrado, IP anonimizado, sem cookies de rastreamento (dispensa banner de cookies)
- SEO: título e descrição por página, `sitemap.xml` automático com as obras, dados estruturados para o Google (empresa, telefone, endereço), imagem de compartilhamento para WhatsApp/Instagram/LinkedIn
- Compatível com celulares a partir de iOS 14 e Android com Chrome 87; se o navegador não conseguir carregar o site, aparece uma página com os contatos (nunca tela branca)

---

## 2. O que pedir ao cliente

| Item | Onde entra |
|---|---|
| Razão social, CNPJ, CREA/CAU do responsável técnico, ano de fundação | `client/src/config/site.ts` |
| Telefone, WhatsApp, e-mail, endereço, horário, cidades atendidas | `client/src/config/site.ts` |
| Instagram, LinkedIn, YouTube (se tiver) | `client/src/config/site.ts` |
| Domínio (ex.: `construtora.com.br`) — registrado no nome do cliente no Registro.br | `site.ts` → `url` e `server/.env` |
| Logo em SVG (ou PNG de boa qualidade) e cores da marca | `client/public/favicon.svg`, `client/src/components/Brand.tsx`, `client/src/index.css` |
| Textos dos serviços e diferenciais (ou aprovação dos textos atuais) | `client/src/data/services.ts` |
| Fotos das obras (de preferência na horizontal, boa resolução) | cadastradas pelo painel |
| Valores de referência por m² da região | painel → Simulador |
| E-mail que vai receber os avisos de orçamento | `server/.env` → `NOTIFY_EMAIL` |
| Nome e e-mail do encarregado de dados (LGPD) | `site.ts` → `dpo` |

Depois de preencher `site.ts`, rode `npm run check:config` na pasta `client`: ele lista o que ainda está
provisório (hoje são **15 itens** marcados como `PREENCHER`). Use `npm run check:config -- --strict`
antes de publicar — ele falha se faltar algo.

Depois de trocar logo ou nome, gere de novo os ícones e a imagem de compartilhamento:
`npm run assets` (pasta `client`, Node 22+; na primeira vez rode `npx playwright install chromium`).

---

## 3. Demonstração para mostrar a clientes

- **Arquivo único:** `cd client && npm run build:demo` gera `dist-demo/index.html` (dados fictícios, painel com
  login de demonstração já preenchido). **Abra pelo navegador** (Chrome/Safari) — visualizadores de arquivo do
  celular (Arquivos do iPhone, prévia do WhatsApp/Drive) não executam o site e mostram só a página de contatos.
- **Link público (recomendado para celular):** o repositório já tem a automação `.github/workflows/demo-pages.yml`.
  Ative em *Settings → Pages → Source: GitHub Actions* e rode *Actions → Demonstração no GitHub Pages*.
  Alternativa sem configuração: arraste a pasta `client/dist-demo` em <https://app.netlify.com/drop>.

---

## 4. Hospedagem (custo recorrente do cliente)

O site precisa de um servidor Node.js + PostgreSQL (o painel e o formulário gravam dados).

| Opção | Indicado para | Observação |
|---|---|---|
| VPS (Hostinger, Contabo, DigitalOcean, Hetzner…) | quem vai cuidar de vários clientes | um VPS de entrada aguenta vários sites; passo a passo no README (Nginx + PM2 ou Docker) |
| Render / Railway / Fly.io + banco gerenciado (Neon, Supabase) | menos manutenção de servidor | configure `DATABASE_SSL=true` |

Também é preciso: domínio (Registro.br, anual) e um serviço de e-mail SMTP para os avisos
(o e-mail do próprio domínio, Google Workspace com "senha de app", Brevo, Resend…).

**Importante:** guarde backup diário do banco e da pasta `server/uploads` (comando no README, seção Manutenção).

---

## 5. Checklist de entrega

- [ ] `npm run check:config -- --strict` passa (nenhum `PREENCHER`)
- [ ] Logo, cores, ícones e imagem de compartilhamento atualizados (`npm run assets`)
- [ ] Textos revisados e aprovados pelo cliente; política de privacidade revisada por advogado
- [ ] Obras de exemplo removidas (`npm run seed -- --remove`) e obras reais cadastradas com fotos
- [ ] Valores do simulador conferidos com o cliente
- [ ] `.env` de produção: `NODE_ENV=production`, `SITE_URL`, `ALLOWED_ORIGINS`, `IP_HASH_SECRET` forte, `TRUST_PROXY`
- [ ] SMTP configurado e **um orçamento de teste enviado e recebido por e-mail**
- [ ] HTTPS ativo; testar em <https://securityheaders.com> e <https://www.ssllabs.com/ssltest>
- [ ] Testado em um iPhone e um Android reais (página inicial, simulador, envio de orçamento)
- [ ] Site cadastrado no Google Search Console com o `https://dominio/sitemap.xml`
- [ ] Perfil da empresa no Google (Google Business Profile) apontando para o site
- [ ] Backup automático configurado
- [ ] Senha do painel entregue por canal seguro; cliente trocou no primeiro acesso

---

## 6. Contrato e questões legais

- **Contrato de prestação de serviço** com: escopo (o que está na seção 1), prazo, número de rodadas de ajuste,
  quem paga hospedagem/domínio, suporte e manutenção (valor mensal, o que inclui, prazo de resposta).
- **Propriedade:** defina se o cliente recebe o código-fonte ou uma licença de uso. Se você vai revender o mesmo
  site para várias construtoras, deixe claro que é uma **licença de uso** de um produto seu, personalizada.
- **Bibliotecas usadas:** todas têm licenças que permitem uso comercial (MIT, ISC, Apache-2.0, BSD; as fontes
  Archivo e IBM Plex Mono são SIL Open Font License). A biblioteca de imagens do servidor (libvips, via `sharp`)
  é LGPL — pode ser usada em produto comercial sem abrir o seu código.
- **LGPD:** o cliente é o controlador dos dados; você (se hospedar) é operador — vale uma cláusula sobre isso no
  contrato. A política de privacidade é um modelo e deve ser revisada pelo jurídico do cliente.
- **Domínio sempre no nome (CNPJ) do cliente.**

---

## 7. Serviços extras que você pode oferecer

- Manutenção mensal (atualizações de segurança, backup, pequenas alterações, cadastro de obras)
- Fotos/vídeos profissionais das obras; tour 360°
- Google Analytics ou Meta Pixel (exige banner de cookies e ajuste da CSP — ver README)
- Autenticação em dois fatores no painel
- Versão em outros idiomas
