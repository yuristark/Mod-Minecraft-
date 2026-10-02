# Planilha Segura

Site de uma página para limpar, padronizar e automatizar planilhas. Tudo roda no navegador: nenhum arquivo é enviado para servidor.

Para usar, abra `index.html` no navegador. Também dá para publicar a pasta em qualquer hospedagem de arquivos estáticos, como o GitHub Pages.

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
- **Prévia:** as células alteradas aparecem marcadas. A visão "Original" mostra cada linha removida e a etapa que a removeu.
- **Exportação:** XLSX, CSV com proteção contra fórmulas maliciosas, JSON, ou cópia para colar no Excel.
- **Lote:** aplica a mesma receita a vários arquivos, juntando tudo numa aba ou gerando uma aba por arquivo.
- **Agendamento:** gera um Google Apps Script com a própria receita. O script roda a cada hora, todo dia, toda semana ou a cada edição, faz backup do resultado anterior e registra um histórico.
- **Receitas:** podem ser salvas no navegador ou exportadas e importadas em `.json`.

O motor de limpeza (`PlanilhaEngine`) não depende da página. É o mesmo código que vai embutido no Apps Script gerado.
