# Planilha Segura

Aplicação web de uma página para limpar, padronizar e automatizar planilhas. Todo o processamento acontece no navegador de quem usa, sem servidor recebendo arquivos e sem conta para criar.

Versão atual: **1.0.0**

## Como usar

- **Usar localmente:** abra `dist/index.html` no navegador.
- **Hospedar:** publique a pasta `dist/` em qualquer hospedagem de arquivos estáticos (Netlify, Cloudflare Pages, GitHub Pages). Netlify e Cloudflare Pages aplicam automaticamente o arquivo `dist/_headers` com os cabeçalhos de segurança. Em outras hospedagens, configure esses mesmos cabeçalhos no servidor.

## Estrutura

| Caminho | Conteúdo |
| --- | --- |
| `src/layout.html` | Estrutura e estilo da página |
| `src/engine.js` | Motor de limpeza (`PlanilhaEngine`), sem dependência da página. É o mesmo código embutido no Apps Script gerado. |
| `src/app.js` | Interface, leitura e exportação de arquivos, geração do Apps Script |
| `vendor/` | SheetJS Community Edition 0.18.5 (Apache 2.0) e sua licença |
| `build.py` | Gera `dist/` a partir de `src/` e `vendor/` |
| `tests/` | Testes do motor de limpeza |

Para gerar uma nova versão: `python3 build.py`. Para testar o motor: `node tests/engine.test.js`.

## Recursos

- **Importação:** XLSX, XLSM, XLS, ODS, CSV (UTF-8 ou Windows-1252), TSV, TXT e JSON. Também aceita colar direto do Excel com Ctrl+V ou arrastar o arquivo para a página.
- **Receita de limpeza:** etapas que rodam em ordem e podem ser ligadas, desligadas e reordenadas:
  - limpar espaços;
  - remover linhas ou colunas vazias;
  - preencher vazios com o valor de cima;
  - remover duplicadas;
  - maiúsculas e minúsculas;
  - localizar e substituir;
  - filtrar linhas;
  - padronizar valores (R$), datas e telefones;
  - validar e-mail, CPF e CNPJ;
  - manter, remover, renomear ou ordenar colunas.
- **Receitas prontas:** "Limpeza básica", "Lista de contatos" e "Lançamentos financeiros". Elas não trazem nomes de colunas fixos: cada etapa reconhece a coluna certa (nome, e-mail, telefone, CPF/CNPJ, valor, data) pelo cabeçalho da planilha aberta.
- **Prévia:** as células alteradas aparecem marcadas. A visão "Original" mostra cada linha removida e a etapa que a removeu.
- **Exportação:** XLSX, CSV, JSON ou cópia para colar no Excel.
- **Lote:** aplica a mesma receita a até 40 arquivos, juntando tudo numa aba ou gerando uma aba por arquivo, com uma aba de resumo.
- **Agendamento:** gera um Google Apps Script com a própria receita. O script roda a cada hora, todo dia, toda semana ou depois de edições.
- **Receitas salvas:** podem ser salvas no navegador ou exportadas e importadas em `.json`.

O produto não inclui dados de exemplo: a página abre vazia e só mostra o que o usuário carregar.

## Segurança

### Página (front-end)

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

### Cabeçalhos de hospedagem (`dist/_headers`)

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

O produto não coleta, não armazena e não transmite dados pessoais. O único dado guardado é a configuração das receitas salvas pelo usuário (nomes de etapas e de colunas), no `localStorage` do próprio navegador.

## Componentes de terceiros

SheetJS Community Edition 0.18.5, © SheetJS LLC, licença Apache 2.0 (`vendor/LICENSE-sheetjs.txt`). Arquivo verificado pelo hash de integridade do pacote npm.

A versão corrigida (0.20.3) é distribuída só pelo site cdn.sheetjs.com. Para atualizar:

1. Baixe `xlsx.full.min.js` de lá para dentro de `vendor/`.
2. Ajuste o caminho em `build.py`.
3. Gere de novo com `python3 build.py`.
