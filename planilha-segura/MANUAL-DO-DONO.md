# Manual do dono — Planilha Segura

Este manual explica como colocar a loja da Planilha Segura no ar, como cuidar dela no dia a dia e como passá-la para outro dono. Não é preciso saber programar: tudo é feito pelos painéis do Supabase, do Mercado Pago e da hospedagem.

## 1. Como a loja funciona

| Parte | O que faz | Onde fica |
| --- | --- | --- |
| **Site da loja** | Tela de login, compra, o aplicativo e o painel do dono | Hospedagem (Netlify ou Cloudflare Pages) — pasta `dist/loja` |
| **Supabase** | Contas dos clientes, registro das vendas e o arquivo do aplicativo protegido | Conta Supabase do dono |
| **Mercado Pago** | Recebe o pagamento (Pix ou cartão) e avisa o Supabase | Conta Mercado Pago do dono |

O modelo é **pagamento único**: quem compra ganha acesso vitalício, sem mensalidade.

O caminho de uma venda:

1. O cliente cria a conta e clica em "Comprar".
2. Ele paga no Mercado Pago.
3. O Mercado Pago avisa o Supabase.
4. O acesso é liberado sozinho, em poucos segundos.

As planilhas dos clientes **nunca** passam pelo servidor. O Supabase guarda:
- a conta: e-mail, senha criptografada e os dados de perfil que o cliente preencher;
- o registro das compras;
- o registro de acessos: data, hora, IP e navegador de cada login e abertura do aplicativo.

O registro de acessos é exigido pelo Marco Civil da Internet (art. 15) e alimenta o painel "quem está online".

O dinheiro cai direto na conta Mercado Pago do dono. Ninguém mais tem acesso a ele.

## 2. O que você precisa ter em mãos

- Um e-mail que será o do dono.
- Conta no **Supabase** (supabase.com). O plano gratuito serve para começar.
- Conta de vendedor no **Mercado Pago**, de preferência com CNPJ.
- Conta no **Netlify** (netlify.com) ou no **Cloudflare Pages**, ambos gratuitos.
- Opcional: um domínio próprio, como `suaplanilha.com.br` (registro.br).
- Os arquivos do produto:

| Pasta ou arquivo | Para que serve |
| --- | --- |
| `dist/pacotes/...-loja-completa.zip` | Tudo de que você precisa, já separado em pastas numeradas na ordem da instalação |
| `dist/loja/` | Site que vai para a hospedagem |
| `dist/enviar-ao-supabase/planilha-segura.html` | Aplicativo protegido, que vai para o Supabase |
| `supabase/migrations/0001_planilha_segura.sql` | Estrutura do banco de dados |
| `supabase/functions/criar-pagamento/index.ts` | Função que cria o pagamento |
| `supabase/functions/webhook-mp/index.ts` | Função que recebe o aviso do Mercado Pago |

> **Importante:** nunca publique a pasta `dist/aberto/` nem o arquivo `dist/enviar-ao-supabase/planilha-segura.html` na hospedagem. Eles contêm o aplicativo sem proteção. Se o código estiver no GitHub, deixe o repositório **privado**.

## 3. Instalação (cerca de 40 minutos)

### Passo A — Criar o projeto no Supabase

1. Entre no Supabase e clique em **New project**.
2. Escolha um nome e a região **South America (São Paulo)**.
3. Guarde a senha do banco num lugar seguro.
4. Abra **SQL Editor** e clique em **New query**.
5. Cole o conteúdo inteiro de `supabase/migrations/0001_planilha_segura.sql` e clique em **Run**. Deve aparecer "Success".
6. Abra **Storage**. Já existe um depósito chamado **app**.
7. Entre nele e envie o arquivo `dist/enviar-ao-supabase/planilha-segura.html`. O nome precisa ser exatamente esse.
8. Abra **Authentication → Sign In / Providers → Email**:
   - deixe **Confirm email** ligado;
   - coloque a senha mínima em **8** caracteres.
9. Abra **Authentication → URL Configuration**:
   - em **Site URL**, coloque o endereço do site, por exemplo `https://suaplanilha.com.br/`;
   - em **Redirect URLs**, adicione o mesmo endereço.
   - Se ainda não tiver o endereço, volte aqui depois do passo D.
10. Abra **Project Settings → API** e anote dois valores:
    - **Project URL**, algo como `https://abcdefgh.supabase.co`;
    - **anon / publishable key**, a chave **pública**.
    - **Nunca** use a chave `service_role` / `secret` no site.

> **E-mails de confirmação:** o envio de e-mail que já vem no Supabase tem limite de poucas mensagens por hora. Para vender de verdade, configure um SMTP próprio em **Authentication → Emails → SMTP Settings**. Serviços como Resend ou Brevo têm plano gratuito.

### Passo B — Configurar o Mercado Pago

1. Entre em **mercadopago.com.br/developers** → **Suas integrações** → **Criar aplicação**.
2. Escolha pagamentos online com **Checkout Pro**.
3. Em **Credenciais de produção**, copie o **Access Token**, que começa com `APP_USR-`.
4. Em **Webhooks → Configurar notificações**:
   - URL de produção: `https://SUA_REFERENCIA.supabase.co/functions/v1/webhook-mp`, usando o Project URL do passo A;
   - evento: marque **Pagamentos**;
   - salve e copie a **assinatura secreta** que aparece.

### Passo B2 (opcional) — Aceitar Pix direto na sua conta

O Pix direto aceita pagamento de qualquer banco (Nubank, Inter, Itaú, Bradesco, Caixa, BB, Santander, C6, PicPay…) e não tem taxa. A diferença: o acesso só é liberado quando você confirma o recebimento no painel.

1. Depois de assumir a loja (passo E), abra **Painel do dono → Loja e preço → Formas de pagamento**.
2. Marque **Pix direto** e preencha:
   - a chave Pix (CPF/CNPJ só com números, e-mail, telefone no formato `+5511999998888` ou chave aleatória);
   - o nome do recebedor como aparece no banco, sem acento;
   - a cidade, sem acento.
3. Se quiser **só** Pix direto, desmarque Mercado Pago. Nesse caso, os passos B e C (Mercado Pago e funções) podem ser pulados.
4. Faça uma compra de teste pagando de outra conta sua e confira se o nome e o valor aparecem certos no aplicativo do banco.

O cliente vê um QR Code e um código "Pix copia e cola", com o valor e um código de 10 letras/números da compra (ele aparece na identificação do Pix). Depois de pagar, ele clica em **Já fiz o Pix**.

### Passo C — Publicar as funções no Supabase

1. No Supabase, abra **Edge Functions → Deploy a new function → Via Editor**.
2. Dê o nome **criar-pagamento** (exatamente assim).
3. Apague o exemplo, cole o conteúdo de `supabase/functions/criar-pagamento/index.ts` e clique em **Deploy**.
4. Repita com o nome **webhook-mp** e o arquivo `supabase/functions/webhook-mp/index.ts`.
5. Em cada uma das duas funções, abra **Details / Settings** e **desligue** a opção de verificação de JWT (**Verify JWT** / **Enforce JWT verification**). As duas funções conferem quem chamou dentro do próprio código.
6. Abra **Edge Functions → Secrets** e cadastre:

| Nome | Valor |
| --- | --- |
| `MP_ACCESS_TOKEN` | Access Token do passo B |
| `MP_WEBHOOK_SECRET` | Assinatura secreta do passo B |
| `SITE_URL` | Endereço do site, ex.: `https://suaplanilha.com.br/` |

> Quem usa o terminal pode publicar as funções pelo CLI, de dentro da pasta do projeto:
>
> ```
> npx supabase login
> npx supabase link --project-ref SUA_REFERENCIA
> npx supabase functions deploy
> ```
>
> O arquivo `supabase/config.toml` já desliga a verificação de JWT das duas funções.

### Passo D — Colocar o site no ar

1. Abra `dist/loja/config.json` num editor de texto (o Bloco de Notas serve). Troque os dois valores pelos do passo A:
   ```json
   {
     "supabaseUrl": "https://abcdefgh.supabase.co",
     "supabaseChavePublica": "a chave pública anon / publishable"
   }
   ```
   Para não precisar refazer isso a cada versão, faça a mesma troca em `loja/config.json`. O `python3 build.py` copia esse arquivo para `dist/loja`.
2. Entre em **app.netlify.com/drop** e arraste a pasta `dist/loja` inteira. O arquivo `_headers` aplica as proteções de segurança automaticamente.
3. Se tiver domínio, ligue-o em **Domain management**.
4. Confira se o endereço final está igual em três lugares:
   - `SITE_URL` (passo C);
   - **Site URL** do Supabase (passo A);
   - **Redirect URLs** do Supabase (passo A).

Se o site mostrar "o config.json está com a chave SECRETA", você colou a chave errada. Troque pela pública e, no Supabase, gere uma nova chave secreta, porque a antiga ficou exposta.

### Passo E — Assumir a loja

1. No Supabase, abra **SQL Editor** e rode, com o seu e-mail:
   ```sql
   select public.definir_dono_pelo_sql('seu-email@exemplo.com');
   ```
2. Abra o site, clique em **Criar conta** com esse mesmo e-mail e confirme pelo link que chegar no e-mail.
3. Entre no site. Vai aparecer o aviso **"Você foi indicado para ser o novo dono"**. Clique em **Assumir a loja**. O prazo é de 7 dias.
4. Clique em **Conta → Painel do dono**, defina o preço, o e-mail de suporte e marque **Vendas abertas**.

### Passo F — Testar antes de vender

1. No Mercado Pago, crie **contas de teste** em **Suas integrações → Contas de teste**: uma vendedora e uma compradora.
2. Use temporariamente o **Access Token de teste** em `MP_ACCESS_TOKEN`.
3. Crie uma conta de cliente no site, compre com a conta compradora de teste e confira que o aplicativo abre sozinho.
4. Reembolse essa compra no Mercado Pago e confira que o acesso foi retirado.
5. Volte o `MP_ACCESS_TOKEN` para o token de produção.
6. Faça uma compra real de valor baixo e reembolse.

## 4. Dia a dia

| Situação | O que fazer |
| --- | --- |
| Ver vendas e receita | Painel do dono → Vendas (dá para baixar em .csv) |
| Cliente pagou por Pix fora do site, ou é cortesia | Peça para criar a conta no site → Painel → Liberar acesso |
| Pedido de reembolso (o cliente tem 7 dias pelo Código de Defesa do Consumidor) | Reembolse no painel do Mercado Pago; o acesso é retirado sozinho |
| Cliente avisou que fez Pix direto | O painel mostra "Pix aguardando sua confirmação". Confira no extrato do banco o valor e, se possível, o código da compra. Depois: Vendas → **Confirmar** (libera o acesso) ou **Recusar** (o Pix não caiu) |
| Cliente pagou em dobro (abriu o pagamento duas vezes) | Nada: o sistema devolve a segunda cobrança automaticamente e o acesso continua. Confira no Histórico e no Mercado Pago se a devolução saiu |
| Cliente pagou, mas o acesso não liberou | Peça para ele clicar em **"Já paguei e não liberou"** na tela de compra: o site confere o pagamento direto no Mercado Pago. Se ainda assim não liberar, o aviso automático (webhook) está mal configurado: veja a seção 7 e libere manualmente enquanto isso |
| "Para conferir" maior que zero | Veja o Histórico. Pagamento com valor diferente do preço ou em dobro já é devolvido automaticamente: confirme no Mercado Pago. Contestação no cartão retira o acesso e precisa ser respondida no Mercado Pago |
| Mudar o preço | Painel → Loja → Preço. Vale para as próximas compras; quem já comprou continua com acesso |
| Parar de vender, ou usar só para você | Painel → desmarque **Vendas abertas**. Só você e quem você liberar entram |
| Cliente esqueceu a senha | Ele mesmo clica em "Esqueci minha senha" na tela de login |
| Ver quem está usando agora | Painel → Visão geral → **Online agora**, ou Painel → **Usuários** → filtro "Online agora" |
| Ver quem está logado e em quais aparelhos | Painel → **Usuários** (coluna Aparelhos). Clique na pessoa para ver aparelhos, IPs, últimos acessos, compras e histórico |
| Desconectar alguém (ex.: conta compartilhada) | Painel → Usuários → clique na pessoa → **Desconectar aparelhos**. Vale em até 1 hora |
| Cliente quer ver ou corrigir os próprios dados | Ele mesmo abre **Meu perfil** (menu com o nome dele no canto do aplicativo) |
| Cliente pede para apagar a conta (LGPD) | Ele mesmo faz em Meu perfil → Privacidade → Excluir minha conta. As compras ficam registradas sem vínculo com ele |
| Atualizar para uma nova versão | 1) Rode de novo o arquivo SQL inteiro no SQL Editor (ele atualiza sem apagar dados); 2) envie o novo `planilha-segura.html` ao depósito **app**, substituindo o antigo; 3) publique de novo a pasta `dist/loja` da mesma versão |

> As duas pastas de cada versão precisam andar juntas. A página da loja autoriza só o código daquela versão do aplicativo. Se você trocar só uma delas, o aplicativo não abre.

## 5. Passar a loja para outro dono

### Cenário 1 — Você vendeu o site para um cliente (instalação nova)

Este é o caminho recomendado:

1. O cliente cria **as próprias contas**: Supabase, Mercado Pago e Netlify.
2. Seguindo a seção 3, você (ou ele) instala tudo **nas contas dele**.
3. No passo E, use o e-mail **do cliente**.

O dinheiro das vendas cai direto na conta dele. Você nunca tem acesso às senhas nem ao dinheiro.

### Cenário 2 — Transferir uma loja que já está funcionando

Faça nesta ordem:

1. **Dono no site:** Painel → Propriedade da loja → digite o e-mail do novo dono e confirme. O novo dono cria a conta (se não tiver), entra e clica em **Assumir a loja** em até 7 dias. Até ele aceitar, nada muda.
2. **Supabase:** o novo dono cria uma organização no Supabase. O dono atual abre **Project Settings → General → Transfer project** e transfere o projeto para essa organização.
3. **Chaves do Supabase:** depois da transferência, o novo dono gera novas chaves em **Project Settings → API Keys** e atualiza o `config.json` do site. Assim o antigo dono não conserva nenhuma chave.
4. **Mercado Pago:** o novo dono cria a aplicação na conta dele (passo B) e troca `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET` em **Edge Functions → Secrets**. O antigo dono apaga o webhook da conta dele.
   - As vendas antigas continuam na conta antiga: reembolsos delas só o antigo dono consegue fazer.
5. **Hospedagem:** transfira o site no Netlify (**Site configuration → Transfer site**), ou o novo dono publica a pasta `dist/loja` na conta dele.
6. **Domínio:** faça a transferência de titularidade no registro.br.
7. **Termos e política de privacidade:** atualize o nome e o CNPJ do novo responsável.

Os clientes que já compraram **mantêm o acesso** durante toda a troca.

### Se o dono perder o acesso à conta

Quem controla o projeto no Supabase pode indicar um novo dono pelo SQL Editor, como no passo E:

```sql
select public.definir_dono_pelo_sql('novo-email@exemplo.com');
```

## 6. Segurança: o que nunca fazer

- Nunca coloque no site, no GitHub ou em mensagens:
  - a chave `service_role` / `secret` do Supabase;
  - o Access Token do Mercado Pago;
  - a assinatura secreta do webhook.
  Esses valores só existem em **Edge Functions → Secrets**.
- Não deixe o depósito **app** do Storage como público.
- Não publique `dist/aberto/` nem `dist/enviar-ao-supabase/` na hospedagem.
- Ative a verificação em duas etapas nas contas Supabase, Mercado Pago, Netlify e no e-mail do dono.

O que já vem protegido:

- cada cliente só enxerga a própria compra;
- o navegador não consegue se dar acesso nem virar dono;
- avisos de pagamento falsos são recusados pela assinatura secreta;
- o valor pago é conferido com o preço;
- reembolsos e contestações retiram o acesso.

**Limitação honesta:** nenhum software vendido é 100% à prova de cópia. Quem não pagou não recebe o aplicativo. Mas alguém que pagou e entende de programação consegue salvar a página. O objetivo é que comprar seja mais fácil do que piratear.

## 7. Problemas comuns

| Mensagem ou sintoma | Causa provável | Solução |
| --- | --- | --- |
| "Este site ainda não foi configurado" | `config.json` com os valores de exemplo | Passo D |
| "O banco de dados não está atualizado" | O SQL não foi executado, ou é de uma versão anterior | Rode de novo o arquivo SQL inteiro (Passo A, item 5) |
| A coluna "Aparelhos" aparece sempre zerada | O banco não deixou ler a lista de sessões do Supabase Auth | Os demais dados continuam funcionando; avise o suporte do produto |
| "O arquivo do aplicativo ainda não foi enviado" | Falta o arquivo no depósito **app** | Passo A, item 7 |
| O link de confirmação abre uma página errada | Site URL ou Redirect URLs diferentes do endereço real | Passo A, item 9 |
| E-mails de confirmação não chegam | Limite do e-mail padrão do Supabase | Configure SMTP próprio |
| "O Mercado Pago não respondeu" ao comprar | `MP_ACCESS_TOKEN` errado ou faltando | Passo C, item 6 |
| Pagou, mas o acesso não liberou | Webhook com URL ou assinatura errada | Mercado Pago → Webhooks → confira a URL e o evento "Pagamentos"; confira `MP_WEBHOOK_SECRET`; veja os logs em Edge Functions → webhook-mp → Logs. Enquanto isso, libere manualmente pelo painel |
| O aplicativo abre em branco depois de uma atualização | Versões diferentes da loja e do aplicativo | Envie os dois arquivos da mesma versão |

## 8. Antes de vender: parte legal

- **CNPJ** para emitir nota fiscal. Pergunte a um contador qual regime serve para venda de software.
- **Termos de Uso** no site: o que está incluído, reembolso em 7 dias, suporte, limite de responsabilidade.
- **"Acesso vitalício":** o acesso depende de a loja continuar no ar (Supabase e hospedagem pagos e ativos). Deixe isso claro nos Termos (por exemplo: "acesso por tempo indeterminado enquanto o serviço for oferecido") para não haver propaganda enganosa pelo Código de Defesa do Consumidor.
- **Política de Privacidade (LGPD):** o site já mostra uma política (link "Privacidade" na tela de entrada e em Meu perfil), preenchida com o nome do produto e o e-mail de suporte. Ela descreve exatamente o que o sistema guarda. Peça para um advogado revisar e complete com o nome e o CNPJ do responsável. O conteúdo dela: quais dados você guarda, para quê, por quanto tempo e como o cliente pede para apagar. Neste produto são:
  - conta: e-mail, nome e dados de perfil preenchidos pelo cliente, usados para liberar o acesso, dar suporte e emitir nota;
  - compras: valor, data e situação, guardados por obrigação fiscal;
  - registro de acessos: data, hora, IP e navegador, guardados por 13 meses. O Marco Civil da Internet exige no mínimo 6 meses, e o registro serve à segurança da conta;
  - o conteúdo das planilhas **não** é coletado.
  - O cliente vê tudo em Meu perfil, baixa uma cópia (.json) e pode excluir a conta sozinho. Se preferir fazer por ele: Supabase → Authentication → Users → excluir. Nos dois casos as compras e o registro de acessos ficam guardados sem vínculo com a pessoa.
- **Licença de terceiros:** o produto usa SheetJS Community Edition e supabase-js. Mantenha os créditos (tela de Segurança do aplicativo e aviso de licença dentro da página da loja) e os arquivos de licença em `vendor/`.
