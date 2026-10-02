# Planilha Segura

Aplicação web de uma página para limpar, padronizar e automatizar planilhas. Todo o processamento acontece no navegador de quem usa, sem servidor recebendo arquivos e sem conta para criar.

Versão atual: **1.1.1**

## Duas formas de usar

- **Aberto (sem login):** `dist/aberto/index.html`. Serve para uso próprio ou demonstração. Funciona abrindo o arquivo no navegador ou hospedando a pasta.
- **Loja (venda com pagamento único):** login, compra pelo Mercado Pago com acesso vitalício, painel do dono e troca de dono. Usa Supabase como back-end. A instalação completa, o uso diário e a transferência para outro dono estão no **[MANUAL-DO-DONO.md](MANUAL-DO-DONO.md)**.

## Estrutura

| Caminho | Conteúdo |
| --- | --- |
| `src/layout.html` | Estrutura e estilo do aplicativo |
| `src/engine.js` | Motor de limpeza (`PlanilhaEngine`), sem dependência da página. É o mesmo código embutido no Apps Script gerado. |
| `src/app.js` | Interface do aplicativo, diagnóstico, receitas, leitura e exportação de arquivos, geração do Apps Script |
| `src/xlsx.js` | Gerador próprio de Excel formatado |
| `loja/` | Site da loja: login, compra, perfil e painel do dono (`layout.html`, `loja.js`, `config.json`) |
| `supabase/migrations/` | Banco de dados: tabelas, regras de acesso (RLS) e funções. Um único arquivo, que pode rodar de novo para atualizar |
| `supabase/functions/` | Edge Functions `criar-pagamento` e `webhook-mp` |
| `vendor/` | SheetJS CE 0.18.5 (Apache 2.0) e supabase-js 2.117.2 (MIT), com as licenças |
| `build.py` | Gera `dist/` |
| `tests/` | Testes do motor e do diagnóstico, do gerador de Excel, do banco (Postgres real via PGlite) e das funções |

Comandos:
- `python3 build.py` gera:
  - `dist/aberto/`;
  - `dist/loja/` (vai para a hospedagem);
  - `dist/enviar-ao-supabase/planilha-segura.html` (vai para o Storage);
  - `dist/artifact.html`.
- `npm install && npm test` roda os testes. Precisa do Node 22.18 ou mais recente.

## Back-end da loja

- **Pagamento único:** cada compra é uma preferência do Mercado Pago Checkout Pro (Pix ou cartão). Quando o pagamento é aprovado, o acesso vitalício é liberado. Reembolso ou contestação retiram o acesso automaticamente.
- **Proteção do comprador:**
  - se a mesma pessoa pagar duas compras (por exemplo, abriu o pagamento em duas abas) ou pagar um valor diferente do preço, o pagamento é devolvido automaticamente pela API do Mercado Pago, com chave de idempotência;
  - o botão "Já paguei e não liberou" confere direto no Mercado Pago os pagamentos das compras pendentes da própria pessoa, caso o aviso automático atrase ou falhe;
  - política de privacidade embutida na loja.
- **Webhook seguro:**
  - confere a assinatura HMAC (`x-signature`) do Mercado Pago;
  - consulta o pagamento direto na API, sem confiar no conteúdo do aviso;
  - confere se o valor pago é exatamente o preço registrado na compra;
  - trata avisos repetidos e cobranças em dobro.
- **Banco com RLS:** o navegador só lê as próprias compras e o próprio acesso. Toda escrita passa por funções `security definer` que conferem quem chamou. As funções de pagamento só são executáveis pelo servidor (`service_role`).
- **Aplicativo protegido:** fica num depósito privado do Storage. A política de acesso só entrega o arquivo a quem comprou, recebeu acesso manual ou é o dono. A loja abre o aplicativo num iframe `srcdoc`.
- **Dono transferível:**
  - o dono atual indica um e-mail pelo painel;
  - a troca só acontece quando essa pessoa entra com o e-mail confirmado e aceita, em até 7 dias;
  - o primeiro dono (ou a recuperação) é definido pelo SQL Editor do Supabase.
- **Configurável sem programar:** nome do produto, descrição, preço, e-mail de suporte e "vendas abertas" ficam no painel. Endereço e chave pública do Supabase ficam em `config.json`. Os segredos ficam só em Edge Functions → Secrets.
- **Proteções do site da loja:**
  - CSP com hashes;
  - conexões limitadas ao próprio site e a `*.supabase.co`;
  - recusa de `config.json` com chave secreta;
  - CORS da função de pagamento limitado ao endereço do site;
  - histórico de eventos visível só para o dono.

## Recursos do aplicativo

- **Importação:** XLSX, XLSM, XLS, ODS, CSV (UTF-8 ou Windows-1252), TSV, TXT e JSON. Também aceita colar direto do Excel com Ctrl+V ou arrastar o arquivo para a página.
- **Diagnóstico automático com nota de saúde (0 a 100):** reconhece o tipo de cada coluna e aponta o que precisa ser corrigido. Os tipos reconhecidos são:
  - nome, e-mail, telefone, CPF/CNPJ e CEP;
  - data, moeda e número.
  - Os problemas apontados são espaços sobrando, linhas vazias ou repetidas, formatos misturados e documentos ou e-mails inválidos.
  - Cada problema vira uma sugestão. "Corrigir tudo" monta a receita sozinho.
- **Receita de limpeza:** etapas em ordem, que podem ser ligadas, desligadas, reordenadas, desfeitas e refeitas (Ctrl+Z / Ctrl+Shift+Z):
  - limpar espaços, remover acentos e símbolos, linhas ou colunas vazias, duplicadas;
  - preencher vazios com o valor de cima;
  - maiúsculas e minúsculas, localizar e substituir, filtrar linhas;
  - padronizar valores (R$), datas, telefones e CEP;
  - validar e-mail, CPF e CNPJ;
  - manter, remover, renomear, ordenar, dividir e juntar colunas;
  - coluna calculada (soma, subtração, multiplicação, divisão, percentual, dias entre datas);
  - resumir/agrupar (contagem, soma, média, mínimo, máximo por grupo).
- **8 modelos de receita:** limpeza básica, contatos, cadastro com endereço, financeiro, vendas por vendedor, estoque, funcionários e contagem por categoria. As colunas são reconhecidas pelo cabeçalho da planilha aberta; nenhum nome de coluna vem fixo.
- **Excel formatado (.xlsx):** gerador próprio (`src/xlsx.js`) que entrega:
  - cabeçalho destacado e fixo, filtros e larguras ajustadas;
  - números, moeda e datas como valores de verdade;
  - códigos com zero à esquerda (CPF, CEP) mantidos como texto.
- **Outras exportações:** CSV com proteção contra fórmulas, JSON, ou cópia para colar no Excel.
- **Lote:** a mesma receita em até 40 arquivos, num único Excel com aba de resumo.
- **Google Sheets no piloto automático:** gera um Apps Script com a receita, que roda a cada hora, todo dia, toda semana ou depois de edições. O resultado sai formatado:
  - cabeçalho, filtros, faixas alternadas;
  - números, moeda e datas como valores;
  - texto puro para códigos.
- **Guia e boas práticas:** as 10 regras de uma planilha bem feita, como automatizar, referência das etapas, perguntas frequentes e atalhos de teclado.
- **Meu perfil (sem login):** nome, empresa e e-mail guardados só no navegador, preferências (tema, separador do CSV), lista das receitas salvas, exportar todas as receitas e apagar todos os dados do navegador. Dentro da loja, o mesmo menu abre a conta completa.
- **Visual:** tema claro e escuro, layout para celular e computador.

## Loja: perfil e painel do dono

- **Meu perfil** (cada cliente):
  - dados pessoais (nome, empresa, cargo, telefone, CPF/CNPJ, cidade);
  - situação do acesso;
  - troca de senha e de e-mail;
  - aparelhos conectados, com navegador, IP e último uso, mais "sair de todos os outros aparelhos";
  - últimos acessos e compras;
  - baixar os próprios dados (.json) e excluir a conta (LGPD).
- **Painel do dono:**
  - **Visão geral:** usuários cadastrados, online agora, contas logadas, vendas, receita, pendências, gráfico de 30 dias e lista de quem está online;
  - **Usuários:** busca e filtros (online, logados, com e sem acesso) e o detalhe de cada pessoa: perfil, aparelhos e IPs, acessos, compras e histórico. Daqui o dono libera, bloqueia ou desconecta aparelhos;
  - **Vendas**, **Loja e preço** (inclui liberação manual), **Histórico** e **Propriedade**.
- "Online agora" vem de um sinal enviado a cada minuto enquanto o site está aberto. "Logados" vem das sessões do Supabase Auth. IP e navegador vêm dos cabeçalhos da requisição, registrados no servidor.

## Segurança

### Aplicativo (front-end)

- **Nenhum dado sai do navegador.** A política de segurança de conteúdo (CSP) usa `default-src 'none'` e `connect-src 'none'`, o que impede a página de fazer qualquer requisição de rede. Também não há scripts, fontes ou imagens de terceiros: tudo vem embutido no arquivo.
- **Só scripts autorizados executam.** Os scripts da página são liberados pelo hash SHA-256 do seu conteúdo. Qualquer script injetado é bloqueado pelo navegador.
- **Leitor de Excel isolado.** A biblioteca SheetJS nunca executa na página. Cada arquivo abre um Web Worker novo, sem acesso à página, que é encerrado ao terminar ou após 60 segundos. Isso contém as falhas conhecidas da versão 0.18.5: poluição de protótipo (CVE-2023-30533) e ReDoS (CVE-2024-22363).
- **Conteúdo da planilha é sempre texto.** Todo valor é escapado antes de aparecer na tela. Os dicionários internos não têm protótipo, então cabeçalhos como `__proto__` ou `constructor` não alteram o funcionamento do programa.
- **Proteção contra injeção de fórmulas.** Células que começam com `=`, `+`, `-`, `@`, tabulação ou retorno de carro recebem um apóstrofo no CSV, na cópia para o Excel e no Google Sheets. Números negativos continuam números. No XLSX, os valores são gravados como texto e nunca como fórmula.
- **Limites para evitar travamentos:**
  - 50 MB por arquivo;
  - 20 MB de texto colado;
  - 3 milhões de células por aba;
  - 60 abas por arquivo;
  - 60 etapas por receita;
  - 300 caracteres no texto a localizar.
- **Receitas importadas são validadas.** Só tipos, campos e opções conhecidos são aceitos, com tamanho limitado.
- **Nomes de arquivo higienizados** nos downloads.

### Cabeçalhos de hospedagem (`_headers` em `dist/aberto` e `dist/loja`)

- CSP com `frame-ancestors 'none'`;
- `X-Frame-Options: DENY`;
- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy: no-referrer`;
- `Permissions-Policy` restritiva;
- `Cross-Origin-Opener-Policy`;
- HSTS.

### Automação no Google Sheets (Apps Script gerado)

- Usa `@OnlyCurrentDoc`, então o script só acessa a planilha onde foi instalado.
- Não usa `UrlFetchApp` nem serviço externo.
- Valida a configuração antes de rodar e permite só uma execução por vez (`LockService`).
- Limita a leitura a 5 milhões de células.
- Grava valores com proteção contra fórmulas e nunca altera a aba de origem.
- Protege as abas de resultado, backup e histórico para que só quem instalou o script consiga editá-las, seguindo o padrão recomendado pelo Google.
- Junta edições seguidas numa única execução, 30 segundos depois, em vez de rodar a cada tecla.
- Em caso de falha, registra o erro no histórico e lança a exceção, para que o Google envie o aviso por e-mail.

### Privacidade (LGPD)

O conteúdo das planilhas nunca é coletado nem transmitido. No navegador, o único dado guardado é a configuração das receitas salvas pelo usuário (nomes de etapas e de colunas), no `localStorage`.

Na loja, o Supabase guarda:
- o e-mail e a senha criptografada de cada conta;
- o registro das compras;
- o histórico de eventos.

A política de privacidade de quem vende precisa informar isso (veja o MANUAL-DO-DONO).

## Componentes de terceiros

SheetJS Community Edition 0.18.5, © SheetJS LLC, licença Apache 2.0 (`vendor/LICENSE-sheetjs.txt`). Arquivo verificado pelo hash de integridade do pacote npm.

A versão corrigida (0.20.3) é distribuída só pelo site cdn.sheetjs.com. Para atualizar:

1. Baixe `xlsx.full.min.js` de lá para dentro de `vendor/`.
2. Ajuste o caminho em `build.py`.
3. Gere de novo com `python3 build.py`.
