# Pronto para vender

Este guia explica, em ordem, o que fazer para começar a vender, o que entregar ao cliente e quando você **não** pode vender.

## 1. Antes de tudo: quando você NÃO pode vender (ainda)

| Situação | Por quê | O que fazer |
| --- | --- | --- |
| **Você tem menos de 18 anos** | Mercado Pago, CNPJ/MEI e contratos de venda exigem maioridade, ou emancipação | Venda em nome de um responsável (pai, mãe), com a conta bancária, o Mercado Pago e o CNPJ no nome dele |
| **O nome do produto já é de outra pessoa** | "Planilha Segura" é o nome do site que você me mostrou (feito no ChatGPT). Se ele não for seu, ou se o nome estiver registrado no INPI, usar o mesmo nome pode render processo por concorrência desleal ou uso de marca | Pesquise o nome em **busca.inpi.gov.br** e no Google. Se houver dúvida, troque o nome em `marca.json` (veja a seção 3): o produto inteiro muda de nome sozinho |
| **Copiar textos ou imagens de outro site** | Direito autoral | Este código foi escrito do zero e não copia o outro site. Não cole textos ou imagens de lá na sua divulgação |
| **Prometer o que o produto não faz** | Propaganda enganosa (Código de Defesa do Consumidor) | Não diga "100% seguro" nem "vitalício" sem explicar. Diga "pagamento único, sem mensalidade" e "processado no seu computador" |
| **Vender sem declarar a renda** | Imposto de Renda | Pessoa física declara pelo carnê-leão. Com vendas frequentes, abra uma empresa. Algumas atividades de software não podem ser MEI, então confirme o enquadramento com um contador |
| **Coletar dados sem avisar** | LGPD | A loja já mostra a Política de Privacidade. Se vender só o arquivo, ele não coleta nada |

O código é seu para vender. Os componentes de terceiros permitem uso comercial: SheetJS (Apache 2.0), supabase-js e qrcode-generator (MIT). Os créditos e as licenças já vão dentro do produto. Não os remova.

## 2. Escolha como vender

| | **A. Vender o arquivo** | **B. Loja própria com login** | **C. Vender o negócio inteiro** |
| --- | --- | --- | --- |
| Para quem | Começar hoje, sem servidor | Vender para muita gente com liberação automática | Um empresário que quer revender com a marca dele |
| O que o cliente recebe | Um `.zip` com o aplicativo (um arquivo `.html`), LEIA-ME e licença | Uma conta no seu site | O pacote da loja completa + manual |
| Pagamento | Pix para a sua chave (qualquer banco) ou link do Mercado Pago | Mercado Pago (Pix, cartão até 12x, boleto) e/ou Pix direto | Combinado com o comprador |
| Entrega | Você manda o arquivo, ou a plataforma manda sozinha | Automática, ou com um clique seu no caso do Pix direto | Você manda o `.zip` e transfere a loja pelo painel |
| Proteção contra cópia | Baixa: o arquivo pode ser repassado. O nome do cliente gravado nele desestimula | Boa: quem não pagou não recebe o aplicativo | — |
| Custos | Nenhum | Supabase (grátis no começo), domínio (cerca de R$ 40/ano), taxa do Mercado Pago por venda (Pix direto não tem taxa) | — |

### A. Vender o arquivo: passo a passo

1. Preencha `marca.json` (seção 3) e gere tudo com `python3 build.py`.
2. Divulgue com o preço: Instagram, WhatsApp, grupos de empresas, contadores, escritórios.
3. **Receba o pagamento.** Duas formas:
   - **Pix** para a sua chave, de qualquer banco (Nubank, Inter, Itaú, Bradesco, Caixa, BB, Santander, C6, PicPay…). Confira no extrato antes de enviar.
   - **Link de pagamento do Mercado Pago:** no app do Mercado Pago, vá em *Cobrar → Link de pagamento*. Aceita Pix, cartão até 12x e boleto, sem programar nada.
4. **Entregue.** Mande o pacote por e-mail ou WhatsApp (tem menos de 400 KB):
   - **Pacote padrão:** `dist/pacotes/planilha-segura-1.2.0-arquivo.zip`.
   - **Pacote com o nome do cliente** (recomendado, desestimula repasse):
     ```
     python3 build.py --cliente "Nome do Cliente" --email cliente@email.com
     ```
     O arquivo sai em `dist/pacotes/clientes/`. O nome aparece dentro do aplicativo e na licença.
5. Emita a nota fiscal ou recibo.

**Entrega automática sem programar:** plataformas de produto digital (Hotmart, Kiwify, Eduzz) recebem o pagamento (Pix, cartão, boleto) e entregam o arquivo sozinhas logo após a compra. Basta subir o `.zip` como produto. Elas cobram uma taxa por venda.

**Mensagem pronta para mandar ao cliente:**

> Olá, [nome]! Obrigado pela compra 🎉
> Segue em anexo o seu **Planilha Segura**. É só extrair o .zip e dar dois cliques no arquivo .html: abre no navegador, não precisa instalar nada e funciona até sem internet. Suas planilhas não saem do seu computador.
> No arquivo LEIA-ME tem o passo a passo. Qualquer dúvida, é só me chamar por aqui. Você tem 7 dias para desistir, se não gostar.

### B. Loja própria com login

Siga o **MANUAL-DO-DONO.md** do começo ao fim (cerca de 40 minutos). Formas de pagamento disponíveis no painel:
- **Mercado Pago:** Pix de qualquer banco, cartão de crédito (Visa, Mastercard, Elo, American Express, Hipercard) em até 12x e boleto. A liberação é automática.
- **Pix direto:** o cliente paga com QR Code ou "copia e cola" no app de qualquer banco, direto para a sua chave, sem taxa. Ele clica em "Já fiz o Pix"; você confere no extrato e clica em **Confirmar** no painel (Vendas).

Pode ligar as duas: o cliente escolhe.

### C. Vender o negócio inteiro

1. Mande `dist/pacotes/planilha-segura-1.2.0-loja-completa.zip`. As pastas estão numeradas na ordem da instalação, e o manual vai junto.
2. Siga a seção 5 do MANUAL-DO-DONO ("Passar a loja para outro dono").
3. Faça um contrato simples de cessão do software, com valor, o que está incluído e se você continua podendo vender o seu.

## 3. Personalizar com a sua marca

Edite `marca.json` e rode `python3 build.py`:

```json
{
  "nome": "Planilha Segura",
  "slogan": "Menos rotina. Mais controle.",
  "vendedor": "Seu nome ou sua empresa (aparece na licença)",
  "email_suporte": "seu-email@exemplo.com",
  "site": ""
}
```

O nome muda em todo lugar: aplicativo, loja, script do Google Sheets, Excel gerado, pacotes, LEIA-ME e licença. Na loja, o nome, o preço e a descrição também podem ser trocados pelo painel do dono.

## 4. Checklist final

- [ ] Nome conferido no INPI e no Google
- [ ] `marca.json` com o seu e-mail de suporte e o seu nome/empresa
- [ ] `python3 build.py` rodado
- [ ] Testei o pacote: extraí o `.zip`, abri o `.html` com dois cliques, abri uma planilha e baixei o Excel
- [ ] Preço definido. Compare com concorrentes; ferramentas parecidas costumam custar de R$ 29 a R$ 197
- [ ] Forma de receber escolhida (Pix, link do Mercado Pago ou plataforma)
- [ ] Sei como vou emitir nota/recibo e declarar a renda
- [ ] (Loja) Fiz uma compra de teste completa com as contas de teste do Mercado Pago e uma por Pix direto
- [ ] Repositório do GitHub **privado** (ele contém o aplicativo completo)

## 5. Suporte e reembolso

- Responda rápido: a maioria das dúvidas está no LEIA-ME e na aba "Guia e boas práticas".
- Pedido de reembolso em até 7 dias: devolva o valor (é lei) e peça para o cliente apagar o arquivo.
- Na loja, reembolsos do Mercado Pago retiram o acesso sozinhos. No Pix direto, devolva pelo app do banco e bloqueie o acesso no painel.
