(function () {
'use strict';
const VERSION = '{{VERSION}}';
const E = PlanilhaEngine();
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Number(n).toLocaleString('pt-BR');
const LIMITS = { bytes: 50 * 1024 * 1024, paste: 20 * 1024 * 1024, cells: 3000000, sheets: 60, batch: 40, steps: 60, page: 100, workerMs: 60000 };

/* ---------- Catálogo de etapas ---------- */
const COL_ALL = { t: 'cols', k: 'cols', l: 'Colunas', all: true };
const COLS = { t: 'cols', k: 'cols', l: 'Colunas' };
const CATALOG = {
  trim: { label: 'Limpar espaços', desc: 'Tira espaços no início e no fim, espaços repetidos e caracteres invisíveis copiados da web.', p: { cols: [], collapse: true }, f: [COL_ALL, { t: 'check', k: 'collapse', l: 'Juntar espaços repetidos no meio do texto' }] },
  removeEmptyRows: { label: 'Remover linhas vazias', desc: 'Apaga linhas sem nenhum dado.', p: {}, f: [] },
  removeEmptyCols: { label: 'Remover colunas vazias', desc: 'Apaga colunas sem nenhum dado.', p: {}, f: [] },
  fillDown: { label: 'Preencher vazios com o valor de cima', desc: 'Útil quando a planilha tinha células mescladas, com o valor só na primeira linha do grupo.', p: { cols: [] }, f: [COLS] },
  dedupe: { label: 'Remover duplicadas', desc: 'Mantém uma linha por valor repetido.', p: { cols: [], keep: 'first', ignoreCase: true }, f: [{ t: 'cols', k: 'cols', l: 'Comparar pelas colunas', all: true }, { t: 'select', k: 'keep', l: 'Manter', o: [['first', 'A primeira ocorrência'], ['last', 'A última ocorrência']] }, { t: 'check', k: 'ignoreCase', l: 'Ignorar maiúsculas e espaços na comparação' }] },
  case: { label: 'Maiúsculas e minúsculas', desc: 'Padroniza nomes, e-mails e códigos.', p: { cols: [], mode: 'title' }, f: [COLS, { t: 'select', k: 'mode', l: 'Formato', o: [['title', 'Nome Próprio (de, da e dos em minúscula)'], ['lower', 'tudo minúsculo'], ['upper', 'TUDO MAIÚSCULO'], ['sentence', 'Primeira letra maiúscula']] }] },
  replace: { label: 'Localizar e substituir', desc: 'Troca um texto por outro.', p: { cols: [], find: '', repl: '', whole: false, ignoreCase: true, regex: false }, f: [COL_ALL, { t: 'text', k: 'find', l: 'Localizar' }, { t: 'text', k: 'repl', l: 'Substituir por' }, { t: 'check', k: 'whole', l: 'Só quando for a célula inteira' }, { t: 'check', k: 'ignoreCase', l: 'Ignorar maiúsculas' }, { t: 'check', k: 'regex', l: 'Usar expressão regular' }] },
  filter: { label: 'Filtrar linhas', desc: 'Mantém ou remove linhas por uma condição.', p: { col: '', op: 'equals', value: '', action: 'remove' }, f: [{ t: 'col', k: 'col', l: 'Coluna' }, { t: 'select', k: 'op', l: 'Condição', o: [['contains', 'contém'], ['not_contains', 'não contém'], ['equals', 'é igual a'], ['not_equals', 'é diferente de'], ['starts', 'começa com'], ['ends', 'termina com'], ['empty', 'está vazia'], ['not_empty', 'não está vazia'], ['gt', 'maior que'], ['gte', 'maior ou igual a'], ['lt', 'menor que'], ['lte', 'menor ou igual a']] }, { t: 'text', k: 'value', l: 'Valor (número, data ou texto)' }, { t: 'select', k: 'action', l: 'O que fazer', o: [['remove', 'Remover as linhas que atendem'], ['keep', 'Manter só as linhas que atendem']] }] },
  number: { label: 'Padronizar valores', desc: 'Entende R$ 1.234,56, 1234.56 e (150,00) e escreve tudo no mesmo formato.', p: { cols: [], from: 'auto', to: 'br', decimals: '2' }, f: [COLS, { t: 'select', k: 'from', l: 'Como os números estão escritos', o: [['auto', 'Detectar (padrão brasileiro)'], ['br', '1.234,56'], ['us', '1,234.56']] }, { t: 'select', k: 'to', l: 'Escrever como', o: [['br', '1.234,56'], ['brl', 'R$ 1.234,56'], ['plain', '1234.56 (para importar em sistemas)']] }, { t: 'select', k: 'decimals', l: 'Casas decimais', o: [['auto', 'Manter'], ['0', '0'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']] }] },
  date: { label: 'Padronizar datas', desc: 'Entende 5/3/25, 2025-03-05, 05 mar 2025 e datas numéricas do Excel.', p: { cols: [], to: 'br' }, f: [COLS, { t: 'select', k: 'to', l: 'Escrever como', o: [['br', 'dd/mm/aaaa'], ['iso', 'aaaa-mm-dd']] }] },
  phone: { label: 'Padronizar telefones', desc: 'Formato (11) 98765-4321. Remove +55 e o zero da operadora.', p: { cols: [], ddi: false }, f: [COLS, { t: 'check', k: 'ddi', l: 'Incluir +55 na frente' }] },
  validate: { label: 'Validar e-mail, CPF ou CNPJ', desc: 'Confere os dígitos verificadores e o formato do e-mail.', p: { col: '', kind: 'email', action: 'mark', format: true, dropEmpty: false }, f: [{ t: 'col', k: 'col', l: 'Coluna' }, { t: 'select', k: 'kind', l: 'Tipo', o: [['email', 'E-mail'], ['cpf', 'CPF'], ['cnpj', 'CNPJ'], ['doc', 'CPF ou CNPJ']] }, { t: 'select', k: 'action', l: 'O que fazer', o: [['mark', 'Criar coluna Sim / Não'], ['remove', 'Remover linhas inválidas'], ['none', 'Só formatar os válidos']] }, { t: 'check', k: 'format', l: 'Formatar documentos válidos (000.000.000-00)' }, { t: 'check', k: 'dropEmpty', l: 'Ao remover, tirar também as linhas vazias nesta coluna' }] },
  select: { label: 'Manter ou remover colunas', desc: 'Tira colunas que não interessam.', p: { mode: 'remove', cols: [] }, f: [{ t: 'select', k: 'mode', l: 'Ação', o: [['remove', 'Remover estas colunas'], ['keep', 'Manter só estas colunas']] }, COLS] },
  rename: { label: 'Renomear coluna', desc: 'Muda o nome de uma coluna.', p: { from: '', to: '' }, f: [{ t: 'col', k: 'from', l: 'Coluna' }, { t: 'text', k: 'to', l: 'Novo nome' }] },
  sort: { label: 'Ordenar', desc: 'Ordena por data, número ou texto (detectado sozinho).', p: { col: '', dir: 'asc' }, f: [{ t: 'col', k: 'col', l: 'Coluna' }, { t: 'select', k: 'dir', l: 'Ordem', o: [['asc', 'Crescente (A→Z, menor primeiro, mais antiga primeiro)'], ['desc', 'Decrescente']] }] },
  clean: { label: 'Remover acentos e símbolos', desc: 'Tira acentos (ação → acao) e, se quiser, deixa só letras, só números ou só letras e números. Útil para códigos e importação em sistemas.', p: { cols: [], accents: true, keep: 'all' }, f: [COL_ALL, { t: 'check', k: 'accents', l: 'Remover acentos' }, { t: 'select', k: 'keep', l: 'Manter', o: [['all', 'Todos os caracteres'], ['letters', 'Só letras e espaços'], ['digits', 'Só números'], ['alnum', 'Letras, números e espaços']] }] },
  cep: { label: 'Padronizar CEP', desc: 'Escreve todos os CEPs como 00000-000, inclusive os que perderam o zero da frente.', p: { cols: [] }, f: [COLS] },
  split: { label: 'Dividir coluna', desc: 'Separa uma coluna em várias: nome e sobrenome, endereço, código e descrição.', p: { col: '', sep: 'space_first', custom: '', parts: '2', names: '', keepOriginal: true }, f: [{ t: 'col', k: 'col', l: 'Coluna' }, { t: 'select', k: 'sep', l: 'Separar por', o: [['space_first', 'Primeiro espaço (Primeiro nome | Sobrenome)'], ['space', 'Cada espaço'], ['comma', 'Vírgula'], ['semicolon', 'Ponto e vírgula'], ['dash', 'Hífen'], ['slash', 'Barra'], ['pipe', 'Barra vertical |'], ['custom', 'Outro (digite abaixo)']] }, { t: 'text', k: 'custom', l: 'Separador personalizado' }, { t: 'select', k: 'parts', l: 'Quantas colunas', o: [['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'], ['6', '6']] }, { t: 'text', k: 'names', l: 'Nomes das novas colunas (separados por vírgula, opcional)' }, { t: 'check', k: 'keepOriginal', l: 'Manter a coluna original' }] },
  merge: { label: 'Juntar colunas', desc: 'Cria uma coluna nova unindo outras: endereço completo, nome completo, código + descrição.', p: { cols: [], sep: 'space', custom: '', name: '', removeOriginals: false }, f: [COLS, { t: 'select', k: 'sep', l: 'Separador', o: [['space', 'Espaço'], ['comma', 'Vírgula'], ['dash', 'Hífen'], ['slash', 'Barra'], ['semicolon', 'Ponto e vírgula'], ['pipe', 'Barra vertical |'], ['none', 'Nenhum'], ['custom', 'Outro (digite abaixo)']] }, { t: 'text', k: 'custom', l: 'Separador personalizado' }, { t: 'text', k: 'name', l: 'Nome da nova coluna' }, { t: 'check', k: 'removeOriginals', l: 'Remover as colunas originais' }] },
  calc: { label: 'Coluna calculada', desc: 'Cria uma coluna com uma conta entre colunas ou com um número fixo: total = quantidade × preço, desconto de 10%, dias até o vencimento.', p: { a: '', op: 'mul', b: '', bConst: '', name: '', to: 'br', decimals: '2' }, f: [{ t: 'col', k: 'a', l: 'Primeira coluna' }, { t: 'select', k: 'op', l: 'Conta', o: [['add', 'Somar (+)'], ['sub', 'Subtrair (−)'], ['mul', 'Multiplicar (×)'], ['div', 'Dividir (÷)'], ['pct', 'Percentual (primeira × segunda ÷ 100)'], ['diffdays', 'Dias entre duas datas']] }, { t: 'col', k: 'b', l: 'Segunda coluna (ou deixe vazio e use um valor fixo)' }, { t: 'text', k: 'bConst', l: 'Valor fixo (número ou data)' }, { t: 'text', k: 'name', l: 'Nome da nova coluna' }, { t: 'select', k: 'to', l: 'Escrever como', o: [['br', '1.234,56'], ['brl', 'R$ 1.234,56'], ['plain', '1234.56']] }, { t: 'select', k: 'decimals', l: 'Casas decimais', o: [['0', '0'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['auto', 'Automático']] }] },
  group: { label: 'Resumir (agrupar)', desc: 'Transforma a lista num resumo: total vendido por vendedor, quantidade por cidade, média por categoria. Use no fim da receita.', p: { by: [], agg: 'sum', value: '', sortDesc: true }, f: [{ t: 'cols', k: 'by', l: 'Agrupar por' }, { t: 'select', k: 'agg', l: 'Calcular', o: [['count', 'Só contar as linhas'], ['sum', 'Soma'], ['avg', 'Média'], ['min', 'Mínimo'], ['max', 'Máximo']] }, { t: 'col', k: 'value', l: 'Coluna de valor' }, { t: 'check', k: 'sortDesc', l: 'Ordenar do maior para o menor' }] }
};
const GROUPS = [
  ['Limpeza', ['trim', 'removeEmptyRows', 'removeEmptyCols', 'fillDown', 'dedupe', 'clean']],
  ['Padronização', ['case', 'number', 'date', 'phone', 'cep', 'replace']],
  ['Conferência', ['validate', 'filter']],
  ['Estrutura e cálculo', ['select', 'rename', 'sort', 'split', 'merge', 'calc', 'group']]
];
const GROUP_OF = {};
GROUPS.forEach(([, list], gi) => list.forEach(t => { GROUP_OF[t] = gi + 1; }));

/* Receitas prontas não trazem nomes de colunas inventados: cada etapa sabe
   que tipo de coluna procura e a coluna é escolhida pelo cabeçalho da planilha aberta. */
const GUESS = {
  nome: /\b(nome|cliente|raz[aã]o social|contato|funcion[aá]rio|colaborador)\b/i,
  email: /e-?mail/i,
  tel: /(telefone|fone|celular|whats|tel\b)/i,
  doc: /\b(cpf|cnpj|documento)\b/i,
  cep: /\bcep\b/i,
  valor: /(valor|pre[cç]o|total|r\$|montante|sal[aá]rio)/i,
  preco: /(pre[cç]o|valor unit|custo)/i,
  qtd: /\b(qtd|qtde|quant|quantidade|estoque|saldo)\b/i,
  data: /(data|vencimento|emiss[aã]o|pagamento|admiss[aã]o|nascimento)/i,
  codigo: /\b(c[oó]digo|cod|sku|ref|refer[eê]ncia)\b/i,
  vendedor: /\b(vendedor|representante|consultor|atendente|respons[aá]vel)\b/i,
  categoria: /\b(categoria|grupo|tipo|departamento|setor|cidade|filial)\b/i
};
const GUESS_LABEL = { nome: 'coluna de nome', email: 'coluna de e-mail', tel: 'coluna de telefone', doc: 'coluna de CPF/CNPJ', cep: 'coluna de CEP', valor: 'coluna de valor', preco: 'coluna de preço', qtd: 'coluna de quantidade', data: 'coluna de data', codigo: 'coluna de código', vendedor: 'coluna de vendedor', categoria: 'coluna de categoria' };
let sid = 0;
const clone = o => JSON.parse(JSON.stringify(o));
const validG = g => typeof g === 'string' ? Object.prototype.hasOwnProperty.call(GUESS, g)
  : !!g && typeof g === 'object' && !Array.isArray(g) && Object.keys(g).length > 0 && Object.keys(g).every(k => /^(cols|col|a|b|by|value)$/.test(k) && typeof g[k] === 'string' && Object.prototype.hasOwnProperty.call(GUESS, g[k]));
// g: tipo de coluna procurado (texto) ou mapa {parâmetro: tipo}, ex.: { a: 'qtd', b: 'preco' }
const mk = (type, p, g) => { const st = { id: 's' + (++sid), type, on: true, p: Object.assign(clone(CATALOG[type].p), p || {}) }; if (g && validG(g)) st.g = clone(g); return st; };

const TEMPLATES = {
  basica: { cor: 1, desc: 'O essencial para qualquer planilha: tira espaços e caracteres invisíveis, linhas e colunas vazias e linhas repetidas.', faz: ['Espaços', 'Vazias', 'Duplicadas'],
    make: () => ({ name: 'Limpeza básica', steps: [mk('trim'), mk('removeEmptyRows'), mk('removeEmptyCols'), mk('dedupe')] }) },
  contatos: { cor: 2, desc: 'Lista de clientes ou CRM: nomes com iniciais maiúsculas, e-mails validados, telefones no padrão, CPF/CNPJ conferido e contatos repetidos removidos.', faz: ['Nomes', 'E-mail', 'Telefone', 'CPF/CNPJ', 'Duplicados'],
    make: () => ({ name: 'Lista de contatos', steps: [mk('trim'), mk('removeEmptyRows'), mk('case', { mode: 'title' }, 'nome'), mk('case', { mode: 'lower' }, 'email'), mk('validate', { kind: 'email' }, 'email'), mk('phone', null, 'tel'), mk('validate', { kind: 'doc' }, 'doc'), mk('dedupe', null, 'email')] }) },
  cadastro: { cor: 2, desc: 'Cadastro completo com endereço: tudo da lista de contatos mais CEP no padrão 00000-000.', faz: ['Nomes', 'CPF/CNPJ', 'Telefone', 'CEP', 'E-mail'],
    make: () => ({ name: 'Cadastro com endereço', steps: [mk('trim'), mk('removeEmptyRows'), mk('case', { mode: 'title' }, 'nome'), mk('validate', { kind: 'doc' }, 'doc'), mk('phone', null, 'tel'), mk('cep', null, 'cep'), mk('case', { mode: 'lower' }, 'email'), mk('validate', { kind: 'email' }, 'email'), mk('dedupe', null, 'doc')] }) },
  financeiro: { cor: 1, desc: 'Contas a pagar e receber, lançamentos e extratos: valores e datas padronizados, sem duplicidade e em ordem cronológica.', faz: ['Valores', 'Datas', 'Ordem', 'Duplicados'],
    make: () => ({ name: 'Lançamentos financeiros', steps: [mk('trim'), mk('removeEmptyRows'), mk('removeEmptyCols'), mk('number', { to: 'br', decimals: '2' }, 'valor'), mk('date', null, 'data'), mk('dedupe'), mk('sort', { dir: 'asc' }, 'data')] }) },
  vendas: { cor: 3, desc: 'Relatório de vendas: limpa a lista e cria o resumo do total vendido por vendedor, do maior para o menor.', faz: ['Valores', 'Datas', 'Resumo por vendedor'],
    make: () => ({ name: 'Vendas por vendedor', steps: [mk('trim'), mk('removeEmptyRows'), mk('date', null, 'data'), mk('number', { to: 'br', decimals: '2' }, 'valor'), mk('dedupe'), mk('group', { agg: 'sum', sortDesc: true }, { by: 'vendedor', value: 'valor' })] }) },
  estoque: { cor: 4, desc: 'Controle de estoque: códigos sem acento e em maiúsculas, quantidades e preços padronizados e o valor em estoque calculado (quantidade × preço).', faz: ['Códigos', 'Quantidades', 'Preços', 'Valor em estoque'],
    make: () => ({ name: 'Controle de estoque', steps: [mk('trim'), mk('removeEmptyRows'), mk('clean', { accents: true, keep: 'all' }, { cols: 'codigo' }), mk('case', { mode: 'upper' }, 'codigo'), mk('number', { to: 'br', decimals: '0' }, 'qtd'), mk('number', { to: 'br', decimals: '2' }, 'preco'), mk('dedupe', null, 'codigo'), mk('calc', { op: 'mul', name: 'Valor em estoque', to: 'brl', decimals: '2' }, { a: 'qtd', b: 'preco' })] }) },
  rh: { cor: 4, desc: 'Funcionários: nomes padronizados, CPF validado, datas de admissão e nascimento e salários no mesmo formato, em ordem alfabética.', faz: ['Nomes', 'CPF', 'Datas', 'Salários'],
    make: () => ({ name: 'Cadastro de funcionários', steps: [mk('trim'), mk('removeEmptyRows'), mk('case', { mode: 'title' }, 'nome'), mk('validate', { kind: 'cpf' }, 'doc'), mk('date', null, 'data'), mk('number', { to: 'br', decimals: '2' }, 'valor'), mk('dedupe', null, 'doc'), mk('sort', { dir: 'asc' }, 'nome')] }) },
  resumo: { cor: 3, desc: 'Resumo por categoria: conta quantas linhas existem em cada grupo (cidade, setor, categoria, filial).', faz: ['Contagem por grupo'],
    make: () => ({ name: 'Contagem por categoria', steps: [mk('trim'), mk('removeEmptyRows'), mk('group', { agg: 'count', sortDesc: true }, { by: 'categoria' })] }) }
};
function autofill(steps, headers) {
  if (!headers || !headers.length) return;
  const find = g => headers.find(x => GUESS[g] && GUESS[g].test(x));
  steps.forEach(st => {
    if (!st.g) return;
    const map = typeof st.g === 'string' ? { cols: st.g, col: st.g } : st.g;
    Object.keys(map).forEach(k => {
      if (!(k in st.p)) return;
      const h = find(map[k]);
      if (!h) return;
      if (Array.isArray(st.p[k])) { if (!st.p[k].length && !(typeof st.g === 'string' && (st.type === 'trim' || st.type === 'replace'))) st.p[k] = [h]; }
      else if (!st.p[k]) st.p[k] = h;
    });
  });
}

/* ---------- Estado ---------- */
const state = {
  src: null,          // {fileName, sheets:[{name, aoa}], sheet, headerRow}
  recipe: TEMPLATES.basica.make(),
  open: null, view: 'result', page: 0, search: '',
  input: null, res: null, batch: null, script: '',
  diag: null, diagRes: null, hist: [], fut: [], sessao: null
};

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
};

/* ---------- Leitor de Excel isolado ----------
   A biblioteca de Excel nunca roda na página. Cada arquivo abre um Web Worker
   novo, sem acesso à página, aos cookies ou à rede da página, que é destruído
   ao terminar (ou após 60 s). Um arquivo malicioso fica preso nesse ambiente. */
const WORKER_MAIN = `
self.onmessage = function (ev) {
  var m = ev.data || {};
  try {
    if (m.op === 'read') {
      var wb = XLSX.read(new Uint8Array(m.buf), { type: 'array', cellFormula: false, cellHTML: false, cellStyles: false, bookVBA: false, dateNF: 'dd/mm/yyyy' });
      var names = (wb.SheetNames || []).slice(0, m.maxSheets), total = 0;
      var sheets = names.map(function (name) {
        var ws = wb.Sheets[name];
        if (!ws || !ws['!ref']) return { name: String(name), aoa: [] };
        var r = XLSX.utils.decode_range(ws['!ref']);
        var cells = (r.e.r - r.s.r + 1) * (r.e.c - r.s.c + 1);
        if (cells > m.maxCells || total + cells > m.maxCells * 2) return { name: String(name), aoa: [], error: 'Aba grande demais (' + cells + ' células).' };
        total += cells;
        var aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '', blankrows: true, dateNF: 'dd/mm/yyyy' });
        return { name: String(name), aoa: aoa.map(function (row) { return Array.prototype.map.call(row || [], function (v) { return v == null ? '' : String(v); }); }) };
      });
      self.postMessage({ id: m.id, ok: true, sheets: sheets });
    } else throw new Error('Operação inválida');
  } catch (e) { self.postMessage({ id: m.id, ok: false, error: String(e && e.message || e) }); }
};`;
let workerUrl = null, jobId = 0;
function workerSource() {
  if (workerUrl) return workerUrl;
  const lib = $('#xlsx-src');
  if (!lib || !lib.textContent.trim()) throw new Error('O leitor de Excel não está disponível. Salve a planilha como CSV.');
  workerUrl = URL.createObjectURL(new Blob([lib.textContent, ';\n', WORKER_MAIN], { type: 'text/javascript' }));
  return workerUrl;
}
function xlsxJob(msg, transfer) {
  return new Promise((resolve, reject) => {
    let w;
    try { w = new Worker(workerSource()); } catch (e) { reject(new Error('Este navegador bloqueou o leitor de Excel isolado. Salve a planilha como CSV.')); return; }
    const id = ++jobId;
    const done = (fn, v) => { clearTimeout(t); w.terminate(); fn(v); };
    const t = setTimeout(() => done(reject, new Error('O arquivo demorou demais para ser lido e foi interrompido por segurança.')), LIMITS.workerMs);
    w.onmessage = ev => {
      const d = ev.data || {};
      if (d.id !== id) return;
      if (d.ok) done(resolve, d);
      else done(reject, new Error(friendlyXlsxError(d.error)));
    };
    w.onerror = ev => { ev.preventDefault(); done(reject, new Error('Não foi possível ler este arquivo.')); };
    w.postMessage(Object.assign({ id }, msg), transfer || []);
  });
}
function friendlyXlsxError(m) {
  m = String(m || '');
  if (/zip|corrupt|invalid|Unsupported/i.test(m) && !/password|ECMA-376/i.test(m)) return 'O arquivo parece corrompido ou não é uma planilha válida.';
  if (/password|encrypt|ECMA-376/i.test(m)) return 'O arquivo está protegido por senha ou criptografado. Remova a senha no Excel e tente de novo.';
  return 'Não foi possível ler este arquivo. Tente salvá-lo de novo como .xlsx ou CSV.';
}

/* ---------- Leitura de arquivos ---------- */
function decodeText(buf) {
  const u8 = new Uint8Array(buf);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(u8).replace(/^\uFEFF/, ''); }
  catch (e) { return new TextDecoder('windows-1252').decode(u8); }
}
function parseDelimited(text) {
  text = text.replace(/^\uFEFF/, '');
  const cands = [';', '\t', ',', '|'], counts = { ';': 0, '\t': 0, ',': 0, '|': 0 };
  let q = false, lines = 0;
  for (let i = 0; i < text.length && lines < 6; i++) {
    const c = text[i];
    if (c === '"') q = !q;
    else if (!q && c === '\n') lines++;
    else if (!q && Object.prototype.hasOwnProperty.call(counts, c)) counts[c]++;
  }
  const delim = cands.reduce((a, b) => counts[b] > counts[a] ? b : a, ';');
  const out = []; let row = [], val = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { val += '"'; i++; } else inQ = false; }
      else val += c;
    } else if (c === '"' && val === '') inQ = true;
    else if (c === delim) { row.push(val); val = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(val); out.push(row); row = []; val = ''; }
    else val += c;
  }
  if (val !== '' || row.length) { row.push(val); out.push(row); }
  while (out.length && out[out.length - 1].every(v => v === '')) out.pop();
  return out;
}
function cellText(v) { return v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); }
function parseJsonText(text) {
  const data = JSON.parse(text);
  if (data && Array.isArray(data.headers) && Array.isArray(data.rows)) return [data.headers.map(cellText)].concat(data.rows.map(r => (Array.isArray(r) ? r : []).map(cellText)));
  if (!Array.isArray(data) || !data.length) throw new Error('Use uma lista de objetos, um por linha.');
  if (Array.isArray(data[0])) return data.map(r => (Array.isArray(r) ? r : []).map(cellText));
  const keys = [], seen = new Set();
  data.forEach(o => { if (o && typeof o === 'object') Object.keys(o).forEach(k => { if (!seen.has(k)) { seen.add(k); keys.push(k); } }); });
  return [keys].concat(data.map(o => keys.map(k => (o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k)) ? cellText(o[k]) : '')));
}
function checkCells(aoa) {
  let n = 0;
  for (const r of aoa) { n += r.length; if (n > LIMITS.cells) throw new Error('O arquivo passa de 3 milhões de células, acima do limite.'); }
  return aoa;
}
async function readFile(file) {
  if (file.size > LIMITS.bytes) throw new Error(file.name + ' tem ' + (file.size / 1048576).toFixed(1) + ' MB. O limite é 50 MB.');
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!['csv', 'tsv', 'txt', 'json', 'xlsx', 'xlsm', 'xls', 'ods'].includes(ext)) throw new Error('Formato não suportado: .' + ext + '. Use XLSX, XLS, ODS, CSV, TSV, TXT ou JSON.');
  const buf = await file.arrayBuffer();
  if (['csv', 'tsv', 'txt'].includes(ext)) return [{ name: file.name.replace(/\.[^.]+$/, '') || 'Dados', aoa: checkCells(parseDelimited(decodeText(buf))) }];
  if (ext === 'json') {
    try { return [{ name: 'Dados', aoa: checkCells(parseJsonText(decodeText(buf))) }]; }
    catch (e) { throw new Error('JSON inválido: ' + e.message); }
  }
  const r = await xlsxJob({ op: 'read', buf, maxSheets: LIMITS.sheets, maxCells: LIMITS.cells }, [buf]);
  if (!r.sheets || !r.sheets.length) throw new Error('O arquivo não tem abas.');
  return r.sheets.map(s => {
    const aoa = s.aoa || [];
    while (aoa.length && aoa[aoa.length - 1].every(v => v === '')) aoa.pop();
    return { name: s.name, aoa, error: s.error };
  });
}
function uniqHeaders(arr, width) {
  const out = [];
  for (let i = 0; i < width; i++) {
    const base = String(arr[i] == null ? '' : arr[i]).replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim().slice(0, 200) || 'Coluna ' + (i + 1);
    let n = base, k = 2;
    while (out.some(h => h.toLocaleLowerCase('pt-BR') === n.toLocaleLowerCase('pt-BR'))) n = base + ' (' + (k++) + ')';
    out.push(n);
  }
  return out;
}
function aoaToGrid(aoa, headerRow) {
  const hr = Math.max(1, headerRow | 0);
  const body = aoa.slice(hr);
  let width = aoa[hr - 1] ? aoa[hr - 1].length : 0;
  body.forEach(r => { if (r.length > width) width = r.length; });
  width = Math.max(width, 1);
  return { headers: uniqHeaders(aoa[hr - 1] || [], width), rows: body.map(r => { const x = r.slice(0, width); while (x.length < width) x.push(''); return x; }) };
}

function loadSource(src) {
  state.src = src; state.page = 0; state.view = 'result'; state.search = ''; $('#search').value = '';
  const sh = src.sheets[src.sheet];
  if (sh && sh.error) toast(sh.error);
  $('#gsSource').value = sh ? sh.name : 'Dados';
  $('#gsHeader').value = src.headerRow;
  refreshInput();
  renderRecipe();
}
function refreshInput() {
  const s = state.src, sh = s.sheets[s.sheet];
  state.input = aoaToGrid(sh ? sh.aoa : [], s.headerRow);
  state.diag = E.analyze(state.input);
  autofill(state.recipe.steps, state.input.headers);
  recompute();
  renderSource();
}
let busy = false;
async function openFiles(files) {
  const file = files && files[0];
  if (!file || busy) return;
  busy = true;
  try {
    toast('Lendo ' + file.name + '…');
    const sheets = await readFile(file);
    const sheet = sheets.findIndex(s => s.aoa.length > 0);
    if (sheet < 0) throw new Error(sheets.some(s => s.error) ? sheets.find(s => s.error).error : 'Nenhuma aba com dados.');
    loadSource({ fileName: file.name, sheets, sheet, headerRow: 1 });
    showTab('limpar');
    toast(file.name + ' aberto. O arquivo não foi enviado para lugar nenhum.');
  } catch (e) { toast(e.message || 'Não foi possível ler o arquivo.'); }
  finally { busy = false; }
}

/* ---------- Processamento ---------- */
let timer = null;
function schedule(full) { clearTimeout(timer); timer = setTimeout(() => { recompute(); if (full) renderRecipe(); else updateBadges(); }, 140); }
function recompute() {
  state.res = state.input ? E.run(state.input, state.recipe.steps) : null;
  state.diagRes = state.res ? E.analyze(E.toGrid(state.res)) : null;
  store.set('ps.current', { name: state.recipe.name, steps: recipeData().steps });
  renderResults();
  renderScript();
}
function recipeData() { return { name: state.recipe.name, steps: state.recipe.steps.map(s => { const o = { type: s.type, on: s.on, p: s.p }; if (s.g) o.g = s.g; return o; }) }; }

/* ---------- Render: fonte ---------- */
const ICON = {
  file: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h8"/></svg>',
  upload: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M20 16v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3"/></svg>',
  rows: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18"/></svg>',
  pen: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  trash: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>',
  list: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>',
  spark: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z"/></svg>'
};
const TIPO_LABEL = { texto: 'Texto', nome: 'Nome', email: 'E-mail', documento: 'CPF/CNPJ', cep: 'CEP', telefone: 'Telefone', data: 'Data', moeda: 'Moeda', numero: 'Número', vazia: 'Vazia', verificacao: 'Verificação' };
function corNota(n) { return n >= 90 ? 'var(--ok)' : n >= 70 ? 'var(--warn)' : 'var(--danger)'; }
function anel(n, tam) {
  tam = tam || 118; const r = tam / 2 - (tam < 100 ? 6 : 9), c = 2 * Math.PI * r, sw = tam < 100 ? 7 : 10, vazio = n == null;
  return `<div class="ringw${tam < 100 ? ' mini' : ''}" style="width:${tam}px;height:${tam}px" role="img" aria-label="${vazio ? 'Sem nota' : 'Nota ' + n + ' de 100'}"><svg width="${tam}" height="${tam}" aria-hidden="true"><circle cx="${tam / 2}" cy="${tam / 2}" r="${r}" fill="none" stroke="var(--line)" stroke-width="${sw}"/>${vazio ? '' : `<circle cx="${tam / 2}" cy="${tam / 2}" r="${r}" fill="none" stroke="${corNota(n)}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - n / 100)}" style="transition:stroke-dashoffset .6s ease"/>`}</svg><div class="val"><div><b class="num" style="color:${vazio ? 'var(--muted)' : corNota(n)}">${vazio ? '—' : n}</b><small>de 100</small></div></div></div>`;
}
// Sugestões do diagnóstico do resultado que ainda não estão na receita.
function sugestoes() {
  const d = state.diagRes;
  if (!d) return [];
  const alvo = p => p.col || (p.cols || []).join('|');
  return d.sugestoes.filter(sg => !state.recipe.steps.some(st => st.on && st.type === sg.type && (st.type === 'trim' || st.type === 'removeEmptyRows' || st.type === 'removeEmptyCols' || st.type === 'dedupe' || alvo(st.p) === alvo(sg.p) || (alvo(st.p) === '' && sg.type !== 'validate'))));
}
function aplicarSugestoes(lista) {
  if (!lista.length) return;
  if (state.recipe.steps.length + lista.length > LIMITS.steps) { toast('Limite de ' + LIMITS.steps + ' etapas por receita.'); return; }
  snap();
  // limpeza estrutural primeiro, padronização depois
  const ordem = ['trim', 'removeEmptyRows', 'removeEmptyCols', 'case', 'number', 'date', 'phone', 'cep', 'validate', 'dedupe'];
  lista.slice().sort((a, b) => ordem.indexOf(a.type) - ordem.indexOf(b.type)).forEach(sg => state.recipe.steps.push(mk(sg.type, clone(sg.p))));
  recompute(); renderRecipe();
  toast(lista.length === 1 ? 'Etapa adicionada à receita.' : lista.length + ' etapas adicionadas à receita.');
}
function renderSource() {
  const s = state.src;
  if (!s) {
    $('#source').innerHTML = `<span class="fi">${ICON.file}</span><div class="who"><strong>Nenhuma planilha aberta</strong><small>XLSX, XLS, ODS, CSV, TSV ou JSON, até 50 MB. Também dá para colar células copiadas do Excel.</small></div>
      <div class="acts"><button class="btn primary" data-act="pick">Abrir planilha</button><button class="btn" data-act="paste-open">Colar dados</button></div>`;
    $('#ovFile').innerHTML = `<div class="drop" data-act="pick" role="button" tabindex="0" aria-label="Abrir planilha"><span class="big">${ICON.upload}</span><strong>Arraste sua planilha para cá</strong><small>ou clique para escolher no computador · até 50 MB</small></div>`;
    return;
  }
  const sh = s.sheets[s.sheet];
  const info = `${fmt(state.input.rows.length)} linhas · ${fmt(state.input.headers.length)} colunas`;
  $('#source').innerHTML = `
    <span class="fi">${ICON.file}</span>
    <div class="who"><strong>${esc(s.fileName)}</strong><small class="num">${info}</small></div>
    ${s.sheets.length > 1 ? `<label class="field"><span>Aba</span><select class="input" id="sheetSel">${s.sheets.map((x, i) => `<option value="${i}" ${i === s.sheet ? 'selected' : ''}>${esc(x.name)}${x.error ? ' (grande demais)' : ''}</option>`).join('')}</select></label>` : ''}
    <label class="field" style="max-width:130px"><span>Cabeçalho na linha</span><input class="input" id="headerRow" type="number" min="1" max="${Math.max(1, Math.min(50, sh ? sh.aoa.length : 1))}" value="${s.headerRow}"></label>
    <div class="acts">
      <button class="btn" data-act="pick">Trocar arquivo</button>
      <button class="btn" data-act="paste-open">Colar dados</button>
    </div>`;
  const nota = state.diagRes ? state.diagRes.nota : state.diag.nota;
  $('#ovFile').innerHTML = `<div class="filecard">
      <div class="top"><span class="fi">${ICON.file}</span><div style="min-width:0;flex:1"><b>${esc(s.fileName)}</b><small class="num">${info}</small></div>${anel(nota, 74)}</div>
      <div class="acts" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn lime" data-tab="limpar">Ir para a planilha</button><button class="btn" data-act="export" data-fmt="xlsx">Baixar Excel</button><button class="btn" data-act="pick">Trocar</button></div>
    </div>`;
}
function renderOverview() {
  const res = state.res, inp = state.input;
  const active = state.recipe.steps.filter(s => s.on).length;
  const metrica = (rot, val, sub, ico, cls) => `<div class="metric"><span class="mi ico ${cls || ''}">${ico}</span><span>${rot}</span><b class="num">${val}</b><small>${sub}</small></div>`;
  if (!res) {
    $('#metrics').innerHTML = metrica('Linhas na planilha', '—', 'Nenhuma planilha aberta', ICON.rows)
      + metrica('Células corrigidas', '—', 'Espaços, formatos e textos', ICON.pen, 'b')
      + metrica('Linhas removidas', '—', 'Vazias, repetidas ou filtradas', ICON.trash, 'w')
      + metrica('Receita', `${fmt(active)} ${active === 1 ? 'etapa' : 'etapas'}`, esc(state.recipe.name), ICON.list, 'p');
    $('#activity').innerHTML = '<li class="muted">Abra uma planilha para ver aqui o que cada etapa da receita corrigiu.</li>';
    $('#health').innerHTML = `<div class="health">${anel(null)}<div><b>Nenhuma planilha aberta</b><p class="muted" style="margin-top:6px;font-size:13px">Ao abrir um arquivo, o diagnóstico confere espaços sobrando, linhas vazias e repetidas, datas e valores em formatos diferentes, e-mails, telefones, CPF/CNPJ e CEP fora do padrão.</p></div></div>`;
    renderNavCount();
    return;
  }
  let changed = 0;
  res.rows.forEach(r => { changed += Object.keys(r.ch).length; });
  const removed = Math.max(0, inp.rows.length - res.rows.length);
  $('#metrics').innerHTML = metrica('Linhas na planilha', fmt(inp.rows.length), `${fmt(res.rows.length)} depois da limpeza`, ICON.rows)
    + metrica('Células corrigidas', fmt(changed), 'Espaços, formatos e textos', ICON.pen, 'b')
    + metrica('Linhas removidas', fmt(removed), 'Vazias, repetidas ou filtradas', ICON.trash, 'w')
    + metrica('Receita', `${fmt(active)} ${active === 1 ? 'etapa' : 'etapas'}`, esc(state.recipe.name), ICON.list, 'p');
  const items = state.recipe.steps.map((st, i) => ({ st, i, rep: res.report[i] })).filter(x => x.rep && !x.rep.skip && (x.rep.changed || x.rep.removed || x.rep.cols || x.rep.added || x.rep.warn.length));
  $('#activity').innerHTML = items.length ? items.slice(0, 6).map(({ st, i, rep }) => {
    const r = [];
    if (rep.changed) r.push(fmt(rep.changed) + (rep.changed === 1 ? ' célula' : ' células'));
    if (rep.removed) r.push(fmt(rep.removed) + (rep.removed === 1 ? ' linha removida' : ' linhas removidas'));
    if (rep.cols) r.push(fmt(rep.cols) + (rep.cols === 1 ? ' coluna removida' : ' colunas removidas'));
    if (rep.added) r.push('coluna criada');
    return `<li><span class="dot">${i + 1}</span><div><strong>${esc(CATALOG[st.type].label)}</strong><small>${esc(summary(st))}</small></div><span class="r">${rep.warn.length ? `<span style="color:var(--warn)">${esc(rep.warn[0])}</span>` : esc(r.join(' · '))}</span></li>`;
  }).join('') + (items.length > 6 ? `<li><span class="muted">e mais ${items.length - 6} etapa(s)</span></li>` : '') : '<li class="muted">A receita não precisou mudar nada nesta planilha.</li>';
  const antes = state.diag.nota, depois = state.diagRes.nota, sg = sugestoes();
  const problemas = state.diagRes.colunas.flatMap(c => c.problemas.map(pb => ({ c: c.nome, ...pb }))).sort((a, b) => b.qtd - a.qtd);
  if (state.diagRes.linhasVazias) problemas.unshift({ c: 'Planilha', texto: 'linha(s) vazia(s)', qtd: state.diagRes.linhasVazias });
  if (state.diagRes.linhasRepetidas) problemas.unshift({ c: 'Planilha', texto: 'linha(s) repetida(s)', qtd: state.diagRes.linhasRepetidas });
  $('#health').innerHTML = `<div class="health">${anel(depois)}<div style="display:grid;gap:10px;min-width:0">
      <div><b>${depois >= 90 ? 'Planilha em ótimo estado' : depois >= 70 ? 'Quase lá' : 'Precisa de atenção'}</b><p class="muted" style="font-size:12.5px">${antes !== depois ? `Original: ${antes} · com a receita: ${depois}` : 'Nota do arquivo com a receita atual'}</p></div>
      <ul class="hlist">${problemas.length ? problemas.slice(0, 4).map(pb => `<li><span class="dot"></span><span>${esc(pb.c)}: ${esc(fmt(pb.qtd))} ${esc(pb.texto.replace(/^\d+ /, ''))}</span></li>`).join('') : '<li><span class="dot ok"></span>Nenhum problema encontrado.</li>'}</ul>
      ${sg.length ? `<div><button class="btn primary small" data-act="sug-todas">${ICON.spark}Corrigir ${sg.length === 1 ? 'o problema' : 'os ' + sg.length + ' problemas'} automaticamente</button></div>` : ''}
    </div></div>`;
  renderNavCount();
}
function renderNavCount() {
  const n = sugestoes().length, el = $('#navSug');
  el.hidden = !n; el.textContent = n;
}
let sugAberto = false;
function renderDiag() {
  const el = $('#diag');
  if (!state.diagRes) { el.innerHTML = ''; return; }
  const d = state.diagRes, sg = sugestoes();
  const bom = !sg.length;
  el.innerHTML = `<div class="diag${bom ? ' bom' : ''}"><span class="score num" style="color:${corNota(d.nota)}">${d.nota}</span>
    <div class="txt"><b>${bom ? 'Nenhuma correção pendente' : sg.length + (sg.length === 1 ? ' correção sugerida' : ' correções sugeridas')}</b><small>Nota de saúde da planilha${state.diag && state.diag.nota !== d.nota ? ` (original: ${state.diag.nota})` : ''}${d.analisadas < d.linhas ? ` · diagnóstico das primeiras ${fmt(d.analisadas)} linhas` : ''}</small></div>
    ${bom ? '' : `<button class="btn small" data-act="sug-ver">${sugAberto ? 'Esconder' : 'Ver sugestões'}</button><button class="btn primary small" data-act="sug-todas">${ICON.spark}Corrigir tudo</button>`}</div>
    ${!bom && sugAberto ? `<div class="sugs">${sg.map((x, i) => `<div class="sug"><span class="ico ${({ validate: 'b', dedupe: 'w', removeEmptyRows: 'w', removeEmptyCols: 'w' })[x.type] || ''}" style="width:30px;height:30px">${ICON.spark}</span><div class="t"><b>${esc(CATALOG[x.type].label)}</b><small>${esc(x.motivo)}</small></div><button class="btn small" data-act="sug-uma" data-i="${i}">Adicionar</button></div>`).join('')}</div>` : ''}`;
}

/* ---------- Render: receita ---------- */
function summary(st) {
  const p = st.p, c = CATALOG[st.type];
  const list = a => a && a.length ? a.join(', ') : null;
  const pick = 'Escolha ' + (typeof st.g === 'string' ? 'a ' + GUESS_LABEL[st.g] : 'as colunas');
  const pick1 = typeof st.g === 'string' ? pick : 'Escolha a coluna';
  switch (st.type) {
    case 'trim': return list(p.cols) || 'Todas as colunas';
    case 'dedupe': return 'Comparando ' + (list(p.cols) || 'todas as colunas');
    case 'fillDown': case 'case': case 'number': case 'date': case 'phone': return list(p.cols) || pick;
    case 'replace': return p.find ? `“${p.find}” → “${p.repl}”` + (list(p.cols) ? ' em ' + list(p.cols) : '') : 'Defina o texto';
    case 'filter': { const op = c.f[1].o.find(o => o[0] === p.op); return p.col ? `${p.action === 'keep' ? 'Manter' : 'Remover'} se ${p.col} ${op ? op[1] : ''} ${['empty', 'not_empty'].includes(p.op) ? '' : '“' + p.value + '”'}` : 'Defina a condição'; }
    case 'validate': return p.col ? `${p.col} como ${{ email: 'e-mail', cpf: 'CPF', cnpj: 'CNPJ', doc: 'CPF ou CNPJ' }[p.kind] || ''}` : pick;
    case 'select': return (p.mode === 'keep' ? 'Manter ' : 'Remover ') + (list(p.cols) || '…');
    case 'rename': return p.from ? `${p.from} → ${p.to || '…'}` : 'Escolha a coluna';
    case 'sort': return p.col ? `${p.col}, ${p.dir === 'desc' ? 'decrescente' : 'crescente'}` : pick1;
    case 'clean': return (list(p.cols) || 'Todas as colunas') + ({ letters: ' · só letras', digits: ' · só números', alnum: ' · letras e números' }[p.keep] || '');
    case 'cep': return list(p.cols) || pick;
    case 'split': return p.col ? `${p.col} → ${p.sep === 'space_first' ? 'primeiro nome e sobrenome' : p.parts + ' colunas'}` : 'Escolha a coluna';
    case 'merge': return p.cols && p.cols.length > 1 ? `${p.cols.join(' + ')} → ${p.name || 'nova coluna'}` : 'Escolha duas ou mais colunas';
    case 'calc': { const ops = { add: '+', sub: '−', mul: '×', div: '÷', pct: '%', diffdays: 'dias até' }; return p.a ? `${p.name || 'Resultado'} = ${p.a} ${ops[p.op] || ''} ${p.b || p.bConst || '…'}` : 'Escolha as colunas'; }
    case 'group': return p.by && p.by.length ? `Por ${p.by.join(', ')}` + (p.agg !== 'count' && p.value ? ` · ${({ sum: 'soma', avg: 'média', min: 'mínimo', max: 'máximo' })[p.agg]} de ${p.value}` : ' · contagem') : 'Escolha as colunas do grupo';
  }
  return c.desc;
}
function badge(i) {
  const rep = state.res && state.res.report[i];
  if (!rep) return '';
  if (rep.skip) return 'Desligada';
  const parts = [];
  if (rep.changed) parts.push(`<span class="num">${fmt(rep.changed)} ${rep.changed === 1 ? 'célula alterada' : 'células alteradas'}</span>`);
  if (rep.removed) parts.push(`<span class="num">${fmt(rep.removed)} ${rep.removed === 1 ? 'linha removida' : 'linhas removidas'}</span>`);
  if (rep.cols) parts.push(`<span class="num">${fmt(rep.cols)} ${rep.cols === 1 ? 'coluna removida' : 'colunas removidas'}</span>`);
  if (rep.added) parts.push('coluna criada');
  if (rep.renamed) parts.push('renomeada');
  rep.info.forEach(x => parts.push(esc(x)));
  rep.warn.forEach(x => parts.push(`<span class="w">${esc(x)}</span>`));
  return parts.join(' · ');
}
function fieldHtml(st, f, i) {
  const v = st.p[f.k], id = `f-${st.id}-${f.k}`;
  const headers = (state.res && state.res.headersAt[i]) || (state.input ? state.input.headers : []);
  const hasData = !!state.input;
  if (f.t === 'check') return `<label class="check"><input type="checkbox" id="${id}" data-act="field" data-id="${st.id}" data-k="${f.k}" ${v !== false && v ? 'checked' : ''}> ${esc(f.l)}</label>`;
  if (f.t === 'select') return `<label class="field"><span>${esc(f.l)}</span><select class="input" id="${id}" data-act="field" data-id="${st.id}" data-k="${f.k}">${f.o.map(o => `<option value="${esc(o[0])}" ${String(v) === o[0] ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select></label>`;
  if (f.t === 'text') return `<label class="field"><span>${esc(f.l)}</span><input class="input" id="${id}" data-act="text" data-id="${st.id}" data-k="${f.k}" value="${esc(v)}" maxlength="500" autocomplete="off" spellcheck="false"></label>`;
  if (f.t === 'col') {
    const known = headers.some(h => h === v);
    return `<label class="field"><span>${esc(f.l)}</span><select class="input" id="${id}" data-act="field" data-id="${st.id}" data-k="${f.k}"><option value="">${hasData ? 'Escolha…' : 'Abra uma planilha para escolher'}</option>${!known && v ? `<option value="${esc(v)}" selected>${esc(v)}${hasData ? ' (não encontrada)' : ''}</option>` : ''}${headers.map(h => `<option value="${esc(h)}" ${h === v ? 'selected' : ''}>${esc(h)}</option>`).join('')}</select></label>`;
  }
  if (f.t === 'cols') {
    const sel = v || [];
    const lc = x => String(x).toLocaleLowerCase('pt-BR');
    const missing = sel.filter(x => !headers.some(h => lc(h) === lc(x)));
    const hint = !hasData && !sel.length ? '<span class="muted" style="font-size:12px">Abra uma planilha para escolher as colunas.</span>' : '';
    return `<div class="field"><span>${esc(f.l)}${f.all ? ' <span class="muted" style="font-weight:400">(nenhuma marcada = todas)</span>' : ''}</span><div class="cols" role="group" aria-label="${esc(f.l)}">
      ${headers.map(h => `<button type="button" class="colbtn" data-act="col" data-id="${st.id}" data-k="${f.k}" data-col="${esc(h)}" aria-pressed="${sel.some(x => lc(x) === lc(h))}">${esc(h)}</button>`).join('')}
      ${missing.map(m => `<button type="button" class="colbtn${hasData ? ' missing' : ''}" data-act="col" data-id="${st.id}" data-k="${f.k}" data-col="${esc(m)}" aria-pressed="true" title="${hasData ? 'Esta coluna não existe nesta planilha' : 'Clique para remover'}">${esc(m)} ✕</button>`).join('')}${hint}
    </div></div>`;
  }
  return '';
}
function renderRecipe() {
  $('#recipeName').value = state.recipe.name;
  const steps = state.recipe.steps;
  $('#steps').innerHTML = steps.length ? steps.map((st, i) => {
    const c = CATALOG[st.type], open = state.open === st.id;
    return `<li class="step${open ? ' open' : ''}${st.on ? '' : ' off'}" data-id="${st.id}">
      <div class="step-head">
        <span class="step-ic g${GROUP_OF[st.type] || 1}" aria-hidden="true">${i + 1}</span>
        <button class="step-title" data-act="open" data-id="${st.id}" aria-expanded="${open}">${esc(c.label)}<small>${esc(summary(st))}</small></button>
        <label class="switch" title="Ligar ou desligar a etapa"><input type="checkbox" data-act="onoff" data-id="${st.id}" ${st.on ? 'checked' : ''} aria-label="Etapa ${i + 1} ligada"><span></span></label>
      </div>
      <div class="step-badge" id="b-${st.id}"${badge(i) ? '' : ' hidden'}>${badge(i)}</div>
      ${open ? `<div class="step-body"><p class="muted" style="font-size:12px">${esc(c.desc)}</p>${c.f.map(f => fieldHtml(st, f, i)).join('')}
        <div class="step-tools">${i > 0 ? `<button class="link" data-act="up" data-id="${st.id}">Subir</button>` : ''}${i < steps.length - 1 ? `<button class="link" data-act="down" data-id="${st.id}">Descer</button>` : ''}<button class="link" data-act="dup" data-id="${st.id}">Duplicar</button><button class="link danger" data-act="del" data-id="${st.id}">Excluir</button></div></div>` : ''}
    </li>`;
  }).join('') : '<li class="muted" style="padding:12px 8px">Nenhuma etapa. Escolha uma abaixo ou abra uma receita pronta.</li>';
  renderRecipeList();
}
function updateBadges() {
  state.recipe.steps.forEach((st, i) => { const el = document.getElementById('b-' + st.id); if (el) { const b = badge(i); el.innerHTML = b; el.hidden = !b; } });
  state.recipe.steps.forEach(st => { const li = document.querySelector(`.step[data-id="${st.id}"] .step-title small`); if (li) li.textContent = summary(st); });
}
function renderRecipeList() {
  const saved = store.get('ps.recipes', []);
  const list = Array.isArray(saved) ? saved : [];
  $('#recipeLoad').innerHTML = `<option value="">Abrir receita…</option><optgroup label="Prontas">${Object.keys(TEMPLATES).map(k => `<option value="t:${k}">${esc(TEMPLATES[k].make().name)}</option>`).join('')}</optgroup>${list.length ? `<optgroup label="Salvas neste navegador">${list.map((r, i) => `<option value="s:${i}">${esc(r && r.name)}</option>`).join('')}</optgroup>` : ''}`;
}
function renderAddStep() {
  $('#addStep').innerHTML = '<option value="">+ Adicionar etapa…</option>' + GROUPS.map(([g, list]) => `<optgroup label="${g}">${list.map(t => `<option value="${t}">${esc(CATALOG[t].label)}</option>`).join('')}</optgroup>`).join('');
}

/* ---------- Render: resultado ---------- */
function stepLabel(si) { const st = state.recipe.steps[si]; return st ? (si + 1) + '. ' + CATALOG[st.type].label : ''; }
function renderResults() {
  const res = state.res, inp = state.input;
  renderOverview();
  renderDiag();
  if (!res) {
    $('#sumline').textContent = 'Nenhuma planilha aberta';
    $('#notice').innerHTML = '';
    $('#tablewrap').innerHTML = `<div class="blank"><span class="big">${ICON.upload}</span><strong>Sua planilha aparece aqui</strong><p>Abra um arquivo ou cole células do Excel. Você confere cada mudança antes de baixar.</p>
      <div class="acts"><button class="btn primary" data-act="pick">Abrir planilha</button><button class="btn" data-act="paste-open">Colar dados</button></div></div>`;
    $('#pager').innerHTML = '';
    return;
  }
  let changedCells = 0;
  res.rows.forEach(r => { changedCells += Object.keys(r.ch).length; });
  $('#sumline').innerHTML = `<b>${fmt(inp.rows.length)} → ${fmt(res.rows.length)}</b> linhas · <b>${fmt(changedCells)}</b> células alteradas`;
  const warns = res.report.reduce((n, r) => n + (r.warn ? r.warn.length : 0), 0);
  $('#notice').innerHTML = warns ? `<div class="warnline">${warns} ${warns === 1 ? 'aviso' : 'avisos'} na receita. Confira as etapas com texto em laranja.</div>` : '';
  document.querySelectorAll('[data-act="view"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
  renderTable();
}
function renderTable() {
  const res = state.res, inp = state.input;
  if (!res) return;
  const hr = state.src.headerRow;
  const q = state.search.trim().toLocaleLowerCase('pt-BR');
  let headers, rows;
  if (state.view === 'result') {
    headers = res.headers;
    rows = res.rows.map(r => ({ v: r.v, ln: r.o + hr + 1, ch: r.ch }));
  } else {
    headers = inp.headers;
    rows = inp.rows.map((v, o) => ({ v, ln: o + hr + 1, gone: res.removed[o] }));
  }
  if (q) rows = rows.filter(r => r.v.some(x => String(x).toLocaleLowerCase('pt-BR').includes(q)));
  const pages = Math.max(1, Math.ceil(rows.length / LIMITS.page));
  state.page = Math.max(0, Math.min(state.page, pages - 1));
  const slice = rows.slice(state.page * LIMITS.page, (state.page + 1) * LIMITS.page);
  const addedCols = new Set();
  if (state.view === 'result') res.headers.forEach(h => { if (!inp.headers.includes(h)) addedCols.add(h); });
  const valCols = new Set(res.headers.filter(h => / válido\?$/.test(h)));
  const dg = state.view === 'result' ? state.diagRes : state.diag;
  const tipoCol = h => { const c = dg && dg.colunas.find(x => x.nome === h); return c ? TIPO_LABEL[c.tipo] || '' : ''; };
  const head = `<thead><tr><th class="ln" title="Linha na planilha original">Linha</th>${headers.map(h => `<th class="${addedCols.has(h) ? 'chg' : ''}" scope="col" title="${esc(h)}">${esc(h)}<small>${esc(tipoCol(h))}</small></th>`).join('')}</tr></thead>`;
  const body = slice.map(r => {
    const title = r.gone != null ? ` title="Removida na etapa ${esc(stepLabel(r.gone))}"` : '';
    return `<tr${r.gone != null ? ' class="gone"' : ''}${title}><td class="ln num">${r.ln}</td>${r.v.map((x, i) => {
      const h = headers[i], cls = [];
      if (r.ch && r.ch[h]) cls.push('chg');
      if (x === '') cls.push('empty');
      if (state.view === 'result' && valCols.has(h)) cls.push(x === 'Sim' ? 'ok' : x === 'Não' ? 'bad' : '');
      return `<td${cls.length ? ` class="${cls.join(' ')}"` : ''}${String(x).length > 40 ? ` title="${esc(x)}"` : ''}>${esc(x)}</td>`;
    }).join('')}</tr>`;
  }).join('');
  $('#tablewrap').innerHTML = `<table class="grid">${head}<tbody>${body || `<tr><td class="ln"></td><td colspan="${headers.length || 1}" style="padding:20px">${q ? 'Nada encontrado para essa busca.' : 'Nenhuma linha restou depois da receita.'}</td></tr>`}</tbody></table>`;
  $('#pager').innerHTML = `
    <div class="legend"><span><i class="m"></i>alterada pela receita</span>${state.view === 'original' ? '<span><i class="g"></i>linha removida (passe o mouse para ver a etapa)</span>' : ''}</div>
    <div style="display:flex;gap:8px;align-items:center"><span class="num">${fmt(rows.length)} ${rows.length === 1 ? 'linha' : 'linhas'}${pages > 1 ? ` · página ${state.page + 1} de ${pages}` : ''}</span>
    ${pages > 1 ? `<button class="btn small" data-act="page" data-d="-1" ${state.page === 0 ? 'disabled' : ''}>Anterior</button><button class="btn small" data-act="page" data-d="1" ${state.page >= pages - 1 ? 'disabled' : ''}>Próxima</button>` : ''}</div>`;
}

/* ---------- Exportação ---------- */
const isNumeric = v => /^-?\d+([.,]\d+)?$/.test(v);
// Impede que uma célula de texto vire fórmula ao abrir o arquivo no Excel (CSV injection).
const safeCell = v => (/^[=+\-@\t\r]/.test(v) && !isNumeric(v)) ? "'" + v : v;
const safeName = n => String(n).replace(/[\\/:*?"<>|\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'planilha';
function resultGrid() { return E.toGrid(state.res); }
function baseName() { return safeName((state.src.fileName || 'planilha').replace(/\.[^.]+$/, '') + ' - limpa'); }
function toCsv(g, sep) {
  const q = v => { v = safeCell(String(v)); return /["\n\r]/.test(v) || v.includes(sep) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  return '\uFEFF' + [g.headers].concat(g.rows).map(r => r.map(q).join(sep)).join('\r\n');
}
function cleanSheetName(n, used) {
  let s = String(n).replace(/[\[\]:*?\/\\\x00-\x1f]/g, ' ').replace(/^'+|'+$/g, '').trim().slice(0, 31) || 'Aba';
  const base = s; let k = 2;
  while (used.has(s.toLowerCase())) { const suf = ' (' + (k++) + ')'; s = base.slice(0, 31 - suf.length) + suf; }
  used.add(s.toLowerCase());
  return s;
}
// Excel formatado gerado por código próprio (src/xlsx.js): a biblioteca de terceiros só é usada para ler.
const XW = PlanilhaXlsx();
function tiposDe(grid) {
  const d = E.analyze(grid, 5000);
  return d.colunas.map((c, i) => {
    if (c.tipo === 'data') return 'date';
    if (c.tipo === 'moeda') return 'currency';
    if (c.tipo !== 'numero') return 'text';
    let inteiro = true;
    for (let r = 0; r < Math.min(grid.rows.length, 5000); r++) {
      const v = String(grid.rows[r][i] == null ? '' : grid.rows[r][i]).trim();
      if (!v) continue;
      if (/^0\d/.test(v) || v.replace(/\D/g, '').length > 15) return 'text'; // códigos com zero à esquerda continuam texto
      const n = E.parseNum(v, 'auto');
      if (n != null && !Number.isInteger(n)) inteiro = false;
    }
    return inteiro ? 'integer' : 'number';
  });
}
async function buildXlsx(sheets) {
  return XW.build(sheets.map(sh => {
    const grid = { headers: sh.aoa[0] || [], rows: sh.aoa.slice(1) };
    return { name: sh.name, headers: grid.headers, rows: grid.rows, tipos: tiposDe(grid) };
  }), E);
}
let dlNs;
async function downloadsNs() {
  if (dlNs !== undefined) return dlNs;
  if (!(window.claude && typeof window.claude.use === 'function')) { dlNs = null; return null; }
  try { dlNs = await window.claude.use('downloads'); } catch (e) { dlNs = null; }
  return dlNs;
}
async function saveFile(name, data) {
  name = safeName(name);
  const ns = await downloadsNs();
  if (ns) {
    try { await ns.save({ filename: name, data }); toast('Arquivo salvo: ' + name); }
    catch (e) {
      const code = e && e.code;
      if (code === 'declined') toast('Download cancelado.');
      else if (code === 'rate_limited') toast('Já existe um pedido de download aberto. Responda a ele primeiro.');
      else toast('O download não está disponível aqui. Use “Copiar” e cole no Excel.');
    }
    return;
  }
  if (window.claude) { toast('O download não está disponível aqui. Use “Copiar” e cole no Excel.'); return; }
  const blob = data instanceof Blob ? data : new Blob([data], { type: 'application/octet-stream' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  toast('Download iniciado: ' + name);
}
async function exportResult(fmtName) {
  if (!state.res) { toast('Abra uma planilha primeiro.'); return; }
  const g = resultGrid();
  try {
    if (fmtName === 'csv') return await saveFile(baseName() + '.csv', toCsv(g, ';'));
    if (fmtName === 'json') return await saveFile(baseName() + '.json', JSON.stringify(g.rows.map(r => { const o = {}; g.headers.forEach((h, i) => { Object.defineProperty(o, h, { value: r[i], enumerable: true, writable: true, configurable: true }); }); return o; }), null, 2));
    toast('Gerando o arquivo Excel…');
    const blob = await buildXlsx([{ name: cleanSheetName(state.src.sheets[state.src.sheet].name || 'Resultado', new Set()), aoa: [g.headers].concat(g.rows) }]);
    return await saveFile(baseName() + '.xlsx', blob);
  } catch (e) { toast(e.message || 'Não foi possível gerar o arquivo.'); }
}
async function copyText(text, okMsg) {
  try { await navigator.clipboard.writeText(text); toast(okMsg); }
  catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (_) {}
    ta.remove();
    toast(ok ? okMsg : 'Não foi possível copiar. Selecione o texto e use Ctrl+C.');
  }
}

/* ---------- Lote ---------- */
async function runBatch(files) {
  files = Array.from(files || []).slice(0, LIMITS.batch);
  if (!files.length || busy) return;
  busy = true;
  const mode = $('#batchMode').value, which = $('#batchSheet').value;
  const curName = state.src ? state.src.sheets[state.src.sheet].name : '';
  const headerRow = state.src ? state.src.headerRow : 1;
  const out = $('#batchOut');
  const results = [];
  try {
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      out.innerHTML = `<p class="muted">Processando ${i + 1} de ${files.length}…</p>`;
      try {
        const sheets = await readFile(f);
        let sh = which === 'same' && curName ? sheets.find(s => s.name.toLocaleLowerCase('pt-BR') === curName.toLocaleLowerCase('pt-BR')) : null;
        if (!sh) sh = sheets.find(s => s.aoa.length) || sheets[0];
        if (sh.error) throw new Error(sh.error);
        const inp = aoaToGrid(sh.aoa, headerRow);
        const steps = clone(state.recipe.steps);
        autofill(steps, inp.headers);
        const res = E.run(inp, steps);
        const warns = [...new Set(res.report.flatMap(r => r.warn || []))];
        results.push({ file: f.name, sheet: sh.name, before: inp.rows.length, after: res.rows.length, grid: E.toGrid(res), warns });
      } catch (e) { results.push({ file: f.name, error: e.message || 'Erro ao ler.' }); }
    }
  } finally { busy = false; }
  state.batch = { results, mode };
  const okN = results.filter(r => !r.error).length;
  out.innerHTML = `<div class="batch-wrap"><table class="batch-table"><thead><tr><th>Arquivo</th><th>Aba</th><th style="text-align:right">Antes</th><th style="text-align:right">Depois</th><th>Situação</th></tr></thead><tbody>
    ${results.map(r => r.error ? `<tr><td>${esc(r.file)}</td><td colspan="3"></td><td style="color:var(--danger)">${esc(r.error)}</td></tr>` : `<tr><td>${esc(r.file)}</td><td>${esc(r.sheet)}</td><td class="n">${fmt(r.before)}</td><td class="n">${fmt(r.after)}</td><td>${r.warns.length ? `<span style="color:var(--warn)">${esc(r.warns[0])}${r.warns.length > 1 ? ' (+' + (r.warns.length - 1) + ')' : ''}</span>` : '<span style="color:var(--ok)">OK</span>'}</td></tr>`).join('')}
    </tbody></table></div>
    ${okN ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn primary" data-act="batch-save">Baixar resultado (.xlsx)</button></div>` : ''}`;
}
async function saveBatch() {
  const b = state.batch;
  if (!b) return;
  const ok = b.results.filter(r => !r.error);
  const sheets = [], used = new Set();
  if (b.mode === 'merge') {
    const headers = ['Arquivo de origem'];
    ok.forEach(r => r.grid.headers.forEach(h => { if (!headers.includes(h)) headers.push(h); }));
    const rows = [];
    ok.forEach(r => r.grid.rows.forEach(row => rows.push(headers.map((h, i) => i === 0 ? r.file : (row[r.grid.headers.indexOf(h)] ?? '')))));
    sheets.push({ name: cleanSheetName('Consolidado', used), aoa: [headers].concat(rows) });
  } else {
    ok.forEach(r => sheets.push({ name: cleanSheetName(r.file.replace(/\.[^.]+$/, ''), used), aoa: [r.grid.headers].concat(r.grid.rows) }));
  }
  const resumo = [['Arquivo', 'Aba lida', 'Linhas antes', 'Linhas depois', 'Situação']].concat(b.results.map(r => r.error ? [r.file, '', '', '', r.error] : [r.file, r.sheet, String(r.before), String(r.after), r.warns.join(' | ') || 'OK']));
  sheets.push({ name: cleanSheetName('Resumo', used), aoa: resumo });
  try {
    toast('Gerando o arquivo Excel…');
    await saveFile('Lote - ' + state.recipe.name + '.xlsx', await buildXlsx(sheets));
  } catch (e) { toast(e.message || 'Não foi possível gerar o arquivo.'); }
}

/* ---------- Apps Script ---------- */
const noComment = s => String(s).replace(/\*\//g, '* /').replace(/[\r\n\u2028\u2029]+/g, ' ');
function renderScript() {
  const freq = $('#gsFreq').value;
  $('#gsHourF').hidden = !['daily', 'weekly'].includes(freq);
  $('#gsDayF').hidden = freq !== 'weekly';
  const out = $('#gsOutput').value.trim().slice(0, 90) || 'Resultado';
  const cfg = {
    abaOrigem: $('#gsSource').value.trim().slice(0, 100) || 'Dados',
    linhaCabecalho: Math.max(1, Math.min(50, parseInt($('#gsHeader').value, 10) || 1)),
    abaResultado: out,
    abaBackup: $('#gsBackup').checked ? out + ' (anterior)' : '',
    abaHistorico: $('#gsLog').checked ? 'Planilha Segura - histórico' : '',
    protegerResultado: $('#gsProtect').checked,
    formatar: $('#gsFormat').checked,
    frequencia: freq, hora: Math.max(0, Math.min(23, parseInt($('#gsHour').value, 10) || 0)), diaSemana: $('#gsDay').value,
    limiteCelulas: 5000000,
    receita: state.recipe.steps.filter(s => s.on).map(s => ({ type: s.type, p: s.p }))
  };
  const today = new Date().toLocaleDateString('pt-BR');
  const code = `/** @OnlyCurrentDoc */
/**
 * Planilha Segura ${VERSION} — automação gerada em ${today}
 * Receita: ${noComment(state.recipe.name)} (${cfg.receita.length} etapas)
 *
 * O que faz: lê a aba "${noComment(cfg.abaOrigem)}", aplica a receita e grava o resultado na aba
 * "${noComment(cfg.abaResultado)}". A aba original nunca é alterada.
 *
 * Segurança:
 *  - @OnlyCurrentDoc: o script só consegue acessar esta planilha, nenhuma outra do seu Drive.
 *  - Não usa UrlFetch, e-mail nem serviços externos: nenhum dado sai da sua conta Google.
 *  - Uma execução por vez (LockService) e limite de ${fmt(cfg.limiteCelulas)} células por leitura.
 *  - Textos que começam com =, +, - ou @ são gravados como texto, nunca como fórmula.
 *  - A aba de resultado pode ficar protegida: só quem instalou o script consegue editá-la.
 *  - Com "formatar" ligado, o resultado sai com cabeçalho destacado e fixo, filtros, faixas
 *    alternadas, larguras ajustadas e números, moeda e datas como valores de verdade.
 *
 * Instalação: cole este código em Extensões > Apps Script, salve e execute
 * a função ativarAutomacao uma vez. Para parar, use o menu Planilha Segura.
 */
const CONFIG = ${JSON.stringify(cfg, null, 2)};

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Planilha Segura')
    .addItem('Executar agora', 'executar')
    .addItem('Ativar automação', 'ativarAutomacao')
    .addItem('Desativar automação', 'desativarAutomacao')
    .addToUi();
}

function validarConfig() {
  const texto = function (v) { return typeof v === 'string' && v.trim().length > 0 && v.length <= 100; };
  if (!texto(CONFIG.abaOrigem) || !texto(CONFIG.abaResultado)) throw new Error('Configuração inválida: nomes de aba.');
  const nomes = [CONFIG.abaOrigem, CONFIG.abaResultado, CONFIG.abaBackup, CONFIG.abaHistorico].filter(String);
  if (new Set(nomes).size !== nomes.length) throw new Error('As abas de origem, resultado, backup e histórico precisam ter nomes diferentes.');
  if (!(CONFIG.linhaCabecalho >= 1 && CONFIG.linhaCabecalho <= 50)) throw new Error('Configuração inválida: linha do cabeçalho.');
  if (['hourly', 'daily', 'weekly', 'edit', 'manual'].indexOf(CONFIG.frequencia) < 0) throw new Error('Configuração inválida: frequência.');
  if (!(CONFIG.hora >= 0 && CONFIG.hora <= 23)) throw new Error('Configuração inválida: horário.');
  if (CONFIG.frequencia === 'weekly' && !ScriptApp.WeekDay[CONFIG.diaSemana]) throw new Error('Configuração inválida: dia da semana.');
  if (!Array.isArray(CONFIG.receita)) throw new Error('Configuração inválida: receita.');
}

// Impede que um texto vindo da planilha vire fórmula.
function seguro(v) {
  v = String(v == null ? '' : v);
  return /^[=+\\-@\\t\\r]/.test(v) && !/^-?\\d+([.,]\\d+)?$/.test(v) ? "'" + v : v;
}

function executar() {
  validarConfig();
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) throw new Error('Já existe uma execução em andamento.');
  const inicio = new Date();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    const origem = ss.getSheetByName(CONFIG.abaOrigem);
    if (!origem) throw new Error('Aba de origem não encontrada: ' + CONFIG.abaOrigem);
    const celulas = origem.getLastRow() * origem.getLastColumn();
    if (celulas > CONFIG.limiteCelulas) throw new Error('A aba de origem tem ' + celulas + ' células, acima do limite de ' + CONFIG.limiteCelulas + '.');
    const valores = origem.getDataRange().getDisplayValues();
    const h = CONFIG.linhaCabecalho;
    if (valores.length < h) throw new Error('A aba de origem não tem a linha de cabeçalho ' + h + '.');
    const motor = PlanilhaEngine();
    const res = motor.run({ headers: valores[h - 1], rows: valores.slice(h) }, CONFIG.receita);
    const saida = motor.toGrid(res);
    const avisos = [];
    res.report.forEach(function (r, i) { (r.warn || []).forEach(function (w) { avisos.push('Etapa ' + (i + 1) + ': ' + w); }); });

    let destino = ss.getSheetByName(CONFIG.abaResultado);
    if (destino && CONFIG.abaBackup && destino.getLastRow() > 0) {
      const antigo = ss.getSheetByName(CONFIG.abaBackup);
      if (antigo) ss.deleteSheet(antigo);
      const copia = destino.copyTo(ss).setName(CONFIG.abaBackup);
      proteger(copia, 'cópia do resultado anterior');
    }
    if (!destino) destino = ss.insertSheet(CONFIG.abaResultado);
    proteger(destino, 'resultado gerado automaticamente');
    const tipos = CONFIG.formatar ? motor.analyze(saida, 5000).colunas.map(function (c) { return c.tipo; }) : [];
    if (CONFIG.formatar) {
      if (destino.getFilter()) destino.getFilter().remove();
      destino.getBandings().forEach(function (b) { b.remove(); });
      destino.clear();
    } else destino.clearContents();
    const matriz = [saida.headers.map(seguro)].concat(saida.rows.map(function (linha) {
      return linha.map(function (v, i) { return CONFIG.formatar ? valorTipado(v, tipos[i], motor) : seguro(v); });
    }));
    if (matriz.length && matriz[0].length) {
      const nLin = matriz.length, nCol = matriz[0].length;
      if (destino.getMaxRows() < nLin) destino.insertRowsAfter(destino.getMaxRows(), nLin - destino.getMaxRows());
      if (destino.getMaxColumns() < nCol) destino.insertColumnsAfter(destino.getMaxColumns(), nCol - destino.getMaxColumns());
      if (CONFIG.formatar && nLin > 1) {
        // Colunas de texto ficam como texto puro: CPF, CEP e códigos não perdem o zero da frente.
        tipos.forEach(function (t, i) { if (TIPOS_NUMERICOS.indexOf(t) < 0) destino.getRange(2, i + 1, nLin - 1, 1).setNumberFormat('@'); });
      }
      destino.getRange(1, 1, nLin, nCol).setValues(matriz);
      if (CONFIG.formatar) formatarAba(destino, nLin, nCol, tipos, matriz);
      else { destino.getRange(1, 1, 1, nCol).setFontWeight('bold'); destino.setFrozenRows(1); }
    }
    registrar(ss, inicio, 'OK', valores.length - h, saida.rows.length, avisos.join(' | '));
  } catch (e) {
    registrar(ss, inicio, 'ERRO', '', '', String(e && e.message || e));
    throw e; // o Google envia um e-mail avisando da falha
  } finally {
    lock.releaseLock();
  }
}

const TIPOS_NUMERICOS = ['moeda', 'numero', 'data'];

// Converte para número ou data de verdade quando a coluna é numérica; o resto vai como texto seguro.
function valorTipado(v, tipo, motor) {
  const t = String(v == null ? '' : v).trim();
  if (t && (tipo === 'moeda' || tipo === 'numero') && !/^0\d/.test(t)) {
    const n = motor.parseNum(t, 'auto');
    if (n != null && isFinite(n)) return n;
  }
  if (t && tipo === 'data') {
    const d = motor.parseDate(t);
    if (d) return new Date(d.y, d.m - 1, d.d, 12); // meio-dia evita troca de dia por fuso horário
  }
  return seguro(v);
}

function formatarAba(aba, nLin, nCol, tipos, matriz) {
  aba.getRange(1, 1, 1, nCol).setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#1A674B').setVerticalAlignment('middle');
  aba.setRowHeight(1, 28);
  aba.setFrozenRows(1);
  if (nLin > 1) {
    tipos.forEach(function (t, i) {
      const r = aba.getRange(2, i + 1, nLin - 1, 1);
      if (t === 'moeda') r.setNumberFormat('"R$" #,##0.00');
      else if (t === 'numero') r.setNumberFormat(matriz.slice(1).every(function (l) { return typeof l[i] !== 'number' || l[i] % 1 === 0; }) ? '#,##0' : '#,##0.00');
      else if (t === 'data') r.setNumberFormat('dd/mm/yyyy').setHorizontalAlignment('center');
    });
    aba.getRange(2, 1, nLin - 1, nCol).applyRowBanding(SpreadsheetApp.BandingTheme.GREEN, false, false);
    aba.getRange(1, 1, nLin, nCol).createFilter();
  }
  aba.autoResizeColumns(1, nCol);
  for (let i = 1; i <= nCol; i++) if (aba.getColumnWidth(i) > 360) aba.setColumnWidth(i, 360);
}

// Deixa só quem executa o script como editor da aba (padrão recomendado pelo Google).
function proteger(aba, descricao) {
  if (!CONFIG.protegerResultado) return;
  const p = aba.getProtections(SpreadsheetApp.ProtectionType.SHEET)[0] || aba.protect();
  p.setDescription('Planilha Segura: ' + descricao);
  p.addEditor(Session.getEffectiveUser());
  p.removeEditors(p.getEditors());
  if (p.canDomainEdit()) p.setDomainEdit(false);
}

function registrar(ss, inicio, situacao, antes, depois, obs) {
  if (!CONFIG.abaHistorico) return;
  let aba = ss.getSheetByName(CONFIG.abaHistorico);
  if (!aba) {
    aba = ss.insertSheet(CONFIG.abaHistorico);
    aba.appendRow(['Quando', 'Situação', 'Linhas lidas', 'Linhas no resultado', 'Duração (s)', 'Observações']);
    aba.setFrozenRows(1);
    proteger(aba, 'histórico de execuções');
  }
  aba.appendRow([inicio, situacao, antes, depois, ((new Date() - inicio) / 1000).toFixed(1), seguro(String(obs || '').slice(0, 500))]);
  if (aba.getLastRow() > 1001) aba.deleteRows(2, aba.getLastRow() - 1001);
}

function ativarAutomacao() {
  validarConfig();
  desativarAutomacao();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const t = ScriptApp.newTrigger('executar');
  if (CONFIG.frequencia === 'hourly') t.timeBased().everyHours(1).create();
  else if (CONFIG.frequencia === 'daily') t.timeBased().everyDays(1).atHour(CONFIG.hora).create();
  else if (CONFIG.frequencia === 'weekly') t.timeBased().onWeekDay(ScriptApp.WeekDay[CONFIG.diaSemana]).atHour(CONFIG.hora).create();
  else if (CONFIG.frequencia === 'edit') ScriptApp.newTrigger('aoEditar').forSpreadsheet(ss).onEdit().create();
  executar();
  ss.toast('Automação ativada. A primeira execução já foi feita.', 'Planilha Segura', 6);
}

// Junta edições seguidas: agenda uma única execução 30 s depois da primeira edição.
function aoEditar(e) {
  if (!e || !e.range || e.range.getSheet().getName() !== CONFIG.abaOrigem) return;
  const cache = CacheService.getDocumentCache();
  if (cache.get('planilhaSeguraPendente')) return;
  cache.put('planilhaSeguraPendente', '1', 120);
  ScriptApp.newTrigger('executarAposEdicao').timeBased().after(30 * 1000).create();
}

function executarAposEdicao() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'executarAposEdicao') ScriptApp.deleteTrigger(t);
  });
  CacheService.getDocumentCache().remove('planilhaSeguraPendente');
  executar();
}

function desativarAutomacao() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    const f = t.getHandlerFunction();
    if (f === 'executar' || f === 'aoEditar' || f === 'executarAposEdicao') ScriptApp.deleteTrigger(t);
  });
}

// ---- Motor de limpeza (o mesmo usado no site Planilha Segura) ----
${PlanilhaEngine.toString()}
`;
  $('#gsReceita').textContent = state.recipe.name + ' · ' + cfg.receita.length + (cfg.receita.length === 1 ? ' etapa' : ' etapas');
  $('#gsCode').textContent = code;
  state.script = code;
}

/* ---------- Receitas: salvar, importar ---------- */
function sanitizeRecipe(obj) {
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.steps)) throw new Error('Arquivo de receita inválido.');
  const steps = obj.steps.slice(0, LIMITS.steps).map(s => {
    if (!s || typeof s.type !== 'string' || !Object.prototype.hasOwnProperty.call(CATALOG, s.type)) throw new Error('Etapa desconhecida: ' + String(s && s.type).slice(0, 40));
    const def = CATALOG[s.type].p, p = {};
    const src = s.p && typeof s.p === 'object' ? s.p : {};
    Object.keys(def).forEach(k => {
      const v = Object.prototype.hasOwnProperty.call(src, k) ? src[k] : undefined;
      if (Array.isArray(def[k])) p[k] = Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, 200).map(x => x.slice(0, 200)) : [];
      else if (typeof def[k] === 'boolean') p[k] = typeof v === 'boolean' ? v : def[k];
      else p[k] = typeof v === 'string' ? v.slice(0, 500) : def[k];
    });
    CATALOG[s.type].f.forEach(f => { if (f.t === 'select' && !f.o.some(o => o[0] === p[f.k])) p[f.k] = def[f.k]; });
    const st = mk(s.type, p, validG(s.g) ? s.g : null);
    st.on = s.on !== false;
    return st;
  });
  return { name: String(obj.name || 'Receita importada').slice(0, 80), steps };
}
function setRecipe(r) { snap(); state.recipe = r; state.open = null; if (state.input) autofill(r.steps, state.input.headers); recompute(); renderRecipe(); }

/* ---------- Desfazer e refazer ---------- */
const fotoReceita = () => JSON.stringify({ name: state.recipe.name, steps: state.recipe.steps });
function snap() {
  state.hist.push(fotoReceita());
  if (state.hist.length > 80) state.hist.shift();
  state.fut = [];
  renderUndo();
}
function voltar(de, para) {
  if (!de.length) return;
  para.push(fotoReceita());
  const r = JSON.parse(de.pop());
  state.recipe = r; state.open = null;
  recompute(); renderRecipe(); renderUndo();
}
function renderUndo() { $('#undoBtn').disabled = !state.hist.length; $('#redoBtn').disabled = !state.fut.length; }

/* ---------- Abas ---------- */
const TABS = { inicio: 'Visão geral', limpar: 'Limpar planilha', modelos: 'Modelos de receita', automatizar: 'Automações', guia: 'Guia e boas práticas', seguranca: 'Segurança' };
function showTab(name) {
  if (!Object.prototype.hasOwnProperty.call(TABS, name)) name = 'inicio';
  Object.keys(TABS).forEach(t => { $('#view-' + t).hidden = t !== name; });
  document.querySelectorAll('.nav [data-tab]').forEach(b => { if (b.dataset.tab === name) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  $('#crumb').textContent = TABS[name];
  try { history.replaceState(null, '', '#' + name); } catch (e) {}
  window.scrollTo(0, 0);
}

/* ---------- Avisos ---------- */
let toastTimer;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 4200); }

/* ---------- Eventos ---------- */
const findStep = id => state.recipe.steps.find(s => s.id === id);
let clearArmed = null;
document.addEventListener('click', e => {
  if (!e.target.closest('#dlMenu')) $('#dlMenu').open = false;
  if (!e.target.closest('#userBox')) fecharMenuUsuario();
  const el = e.target.closest('[data-act]');
  if (!el) {
    const tab = e.target.closest('[data-tab]');
    if (tab) showTab(tab.dataset.tab);
    return;
  }
  const act = el.dataset.act, st = el.dataset.id ? findStep(el.dataset.id) : null, steps = state.recipe.steps;
  if (el.dataset.id && !st) return;
  switch (act) {
    case 'open': state.open = state.open === st.id ? null : st.id; renderRecipe(); break;
    case 'col': {
      const arr = Array.isArray(st.p[el.dataset.k]) ? st.p[el.dataset.k] : (st.p[el.dataset.k] = []);
      const name = el.dataset.col, at = arr.findIndex(x => x.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'));
      snap();
      if (at >= 0) arr.splice(at, 1); else arr.push(name);
      recompute(); renderRecipe(); break;
    }
    case 'up': case 'down': {
      const i = steps.indexOf(st), j = act === 'up' ? i - 1 : i + 1;
      if (j < 0 || j >= steps.length) break;
      snap(); [steps[i], steps[j]] = [steps[j], steps[i]]; recompute(); renderRecipe(); break;
    }
    case 'dup': {
      if (steps.length >= LIMITS.steps) { toast('Limite de ' + LIMITS.steps + ' etapas por receita.'); break; }
      snap(); const c = mk(st.type, clone(st.p), st.g); c.on = st.on; steps.splice(steps.indexOf(st) + 1, 0, c); state.open = c.id; recompute(); renderRecipe(); break;
    }
    case 'del': snap(); steps.splice(steps.indexOf(st), 1); recompute(); renderRecipe(); toast('Etapa excluída. Use Ctrl+Z para desfazer.'); break;
    case 'view': if (!state.res) break; state.view = el.dataset.view === 'original' ? 'original' : 'result'; state.page = 0; renderResults(); break;
    case 'page': state.page += Number(el.dataset.d) || 0; renderTable(); break;
    case 'pick': $('#fileInput').click(); break;
    case 'paste-open': showTab('limpar'); $('#pastePanel').hidden = false; $('#pasteText').focus(); break;
    case 'paste-close': $('#pastePanel').hidden = true; $('#pasteText').value = ''; break;
    case 'paste-load': loadPasted($('#pasteText').value); break;
    case 'export': $('#dlMenu').open = false; exportResult(el.dataset.fmt); break;
    case 'copy-table': {
      $('#dlMenu').open = false;
      if (!state.res) { toast('Abra uma planilha primeiro.'); break; }
      const g = resultGrid();
      copyText([g.headers].concat(g.rows).map(r => r.map(v => safeCell(String(v).replace(/[\t\r\n]+/g, ' '))).join('\t')).join('\n'), 'Resultado copiado. Cole no Excel ou no Google Sheets com Ctrl+V.');
      break;
    }
    case 'recipe-save': {
      const saved = store.get('ps.recipes', []);
      const list = Array.isArray(saved) ? saved : [];
      const data = recipeData();
      const at = list.findIndex(r => r && r.name === data.name);
      if (at >= 0) list[at] = data; else list.push(data);
      toast(store.set('ps.recipes', list.slice(-50)) ? 'Receita “' + data.name + '” salva neste navegador.' : 'Este navegador não permite salvar. Use “Exportar”.');
      renderRecipeList(); break;
    }
    case 'recipe-export': saveFile((state.recipe.name || 'receita') + '.json', JSON.stringify(Object.assign({ app: 'Planilha Segura', versao: 1 }, recipeData()), null, 2)); break;
    case 'recipe-import': $('#recipeFile').click(); break;
    case 'recipe-clear': {
      if (!steps.length) break;
      if (clearArmed !== el) {
        clearArmed = el; el.textContent = 'Confirmar: apagar todas?';
        setTimeout(() => { if (clearArmed === el) { clearArmed = null; el.textContent = 'Limpar etapas'; } }, 3500);
        break;
      }
      clearArmed = null; el.textContent = 'Limpar etapas';
      setRecipe({ name: state.recipe.name, steps: [] }); toast('Etapas removidas.'); break;
    }
    case 'gs-copy': copyText(state.script, 'Script copiado. Cole em Extensões → Apps Script.'); break;
    case 'gs-download': saveFile('Planilha Segura - Apps Script.txt', state.script); break;
    case 'batch-pick': $('#batchInput').click(); break;
    case 'batch-save': saveBatch(); break;
    case 'undo': voltar(state.hist, state.fut); break;
    case 'redo': voltar(state.fut, state.hist); break;
    case 'sug-ver': sugAberto = !sugAberto; renderDiag(); break;
    case 'sug-todas': aplicarSugestoes(sugestoes()); break;
    case 'sug-uma': { const x = sugestoes()[Number(el.dataset.i)]; if (x) aplicarSugestoes([x]); break; }
    case 'usar-modelo': {
      const t = TEMPLATES[el.dataset.modelo];
      if (!t) break;
      setRecipe(t.make()); showTab('limpar');
      toast(state.input ? 'Modelo “' + state.recipe.name + '” aplicado. Confira as colunas escolhidas em cada etapa.' : 'Modelo pronto. Agora abra a planilha: as colunas são escolhidas sozinhas.');
      break;
    }
    case 'tema': alternarTema(); break;
    case 'user-menu': { const pop = $('#userPop'); pop.hidden = !pop.hidden; el.setAttribute('aria-expanded', String(!pop.hidden)); break; }
    case 'conta': fecharMenuUsuario(); avisarPai({ tipo: 'ps-conta', acao: el.dataset.acao }); break;
  }
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.act === 'field') { const st = findStep(el.dataset.id); if (!st) return; snap(); st.p[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value; recompute(); renderRecipe(); return; }
  if (el.dataset.act === 'onoff') { const st = findStep(el.dataset.id); if (!st) return; snap(); st.on = el.checked; recompute(); renderRecipe(); return; }
  switch (el.id) {
    case 'fileInput': openFiles(el.files); el.value = ''; break;
    case 'batchInput': runBatch(el.files); el.value = ''; break;
    case 'recipeFile': {
      const f = el.files[0]; el.value = '';
      if (!f) break;
      if (f.size > 1024 * 1024) { toast('Arquivo de receita grande demais.'); break; }
      f.text().then(t => { setRecipe(sanitizeRecipe(JSON.parse(t))); toast('Receita importada.'); }).catch(err => toast(err instanceof SyntaxError ? 'Arquivo de receita inválido.' : (err.message || 'Arquivo de receita inválido.')));
      break;
    }
    case 'sheetSel': {
      const n = Number(el.value);
      if (!state.src || !state.src.sheets[n]) break;
      state.src.sheet = n; state.page = 0; $('#gsSource').value = state.src.sheets[n].name;
      if (state.src.sheets[n].error) toast(state.src.sheets[n].error);
      refreshInput(); renderRecipe(); break;
    }
    case 'headerRow': if (!state.src) break; state.src.headerRow = Math.max(1, Math.min(50, parseInt(el.value, 10) || 1)); $('#gsHeader').value = state.src.headerRow; state.page = 0; refreshInput(); renderRecipe(); break;
    case 'addStep':
      if (el.value && Object.prototype.hasOwnProperty.call(CATALOG, el.value)) {
        if (state.recipe.steps.length >= LIMITS.steps) toast('Limite de ' + LIMITS.steps + ' etapas por receita.');
        else { snap(); const s = mk(el.value); state.recipe.steps.push(s); state.open = s.id; recompute(); renderRecipe(); }
      }
      el.value = ''; break;
    case 'recipeLoad': {
      const v = el.value; el.value = '';
      if (v.startsWith('t:') && Object.prototype.hasOwnProperty.call(TEMPLATES, v.slice(2))) setRecipe(TEMPLATES[v.slice(2)].make());
      else if (v.startsWith('s:')) { const list = store.get('ps.recipes', []); const r = Array.isArray(list) ? list[Number(v.slice(2))] : null; if (r) try { setRecipe(sanitizeRecipe(r)); } catch (err) { toast(err.message); } }
      break;
    }
    case 'gsFreq': case 'gsHour': case 'gsDay': case 'gsBackup': case 'gsLog': case 'gsProtect': case 'gsFormat': renderScript(); break;
  }
});
let ultimoTexto = 0;
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.act === 'text') { const st = findStep(el.dataset.id); if (!st) return; if (Date.now() - ultimoTexto > 1500) snap(); ultimoTexto = Date.now(); st.p[el.dataset.k] = el.value.slice(0, 500); schedule(false); return; }
  if (el.id === 'recipeName') { state.recipe.name = el.value.slice(0, 80) || 'Minha receita'; clearTimeout(timer); timer = setTimeout(() => { renderScript(); renderOverview(); }, 300); }
  if (el.id === 'search') { state.search = el.value.slice(0, 200); state.page = 0; renderTable(); }
  if (['gsSource', 'gsHeader', 'gsOutput'].includes(el.id)) { clearTimeout(timer); timer = setTimeout(renderScript, 200); }
});

/* colar direto do Excel na página */
function loadPasted(text) {
  if (!text || !text.trim()) { toast('Nada para carregar. Cole as células primeiro.'); return; }
  if (text.length > LIMITS.paste) { toast('Texto colado grande demais (limite de 20 MB). Salve como arquivo e abra por “Abrir planilha”.'); return; }
  let aoa;
  try { aoa = checkCells(parseDelimited(text)); } catch (e) { toast(e.message); return; }
  if (!aoa.length) { toast('Não encontrei linhas no texto colado.'); return; }
  $('#pastePanel').hidden = true; $('#pasteText').value = '';
  loadSource({ fileName: 'Dados colados', sheets: [{ name: 'Dados', aoa }], sheet: 0, headerRow: 1 });
  showTab('limpar');
  toast(fmt(Math.max(0, aoa.length - 1)) + ' linhas carregadas da área de transferência.');
}
document.addEventListener('paste', e => {
  const t = e.target;
  if (t && t.closest && t.closest('input, textarea, select, [contenteditable]')) return;
  const text = e.clipboardData && e.clipboardData.getData('text/plain');
  if (text && /\t/.test(text) && /\n/.test(text.trim())) { e.preventDefault(); loadPasted(text); }
});

/* arrastar e soltar */
let dragDepth = 0;
window.addEventListener('dragenter', e => { if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) { dragDepth++; $('#dropHint').hidden = false; } });
window.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) $('#dropHint').hidden = true; });
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop', e => {
  e.preventDefault(); dragDepth = 0; $('#dropHint').hidden = true;
  const files = e.dataTransfer && e.dataTransfer.files;
  if (!files || !files.length) return;
  if (!$('#view-automatizar').hidden && files.length > 1) runBatch(files);
  else openFiles(files);
});

/* ---------- Segurança ---------- */
const SHIELD = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>';
$('#secList').innerHTML = [
  ['Seus arquivos não saem do computador', 'A leitura, a limpeza e a exportação acontecem dentro do navegador. Não existe servidor recebendo planilhas, nem conta para criar. A página não carrega nada da internet e é configurada para bloquear qualquer envio de dados.'],
  ['Arquivos do Excel abertos em ambiente isolado', 'Cada arquivo .xlsx, .xls ou .ods é lido num processo separado, sem acesso à página nem à rede, que é encerrado ao terminar ou depois de 60 segundos. Um arquivo malicioso fica preso nesse ambiente.'],
  ['O original nunca é alterado', 'A receita gera uma cópia nova. Na visão “Original” você vê cada linha removida riscada e, ao passar o mouse, em qual etapa ela saiu.'],
  ['Macros e fórmulas não são executadas', 'Arquivos .xlsm e .xls são lidos só como valores. Macros VBA são ignoradas e fórmulas entram pelo valor já calculado.'],
  ['Excel gerado por código próprio', 'O Excel formatado é montado por um gerador próprio: textos são gravados sempre como texto, nunca como fórmula, e a biblioteca de terceiros é usada só para leitura, isolada.'],
  ['Proteção contra fórmulas maliciosas', 'Células que começam com =, +, - ou @ ganham um apóstrofo no CSV, ao copiar e no Google Sheets, para não serem executadas. Números negativos como -150 continuam números.'],
  ['Nada da planilha vira código na página', 'Todo conteúdo é exibido como texto. Um HTML ou script escondido numa célula aparece como texto e não é executado. Nomes de coluna como “__proto__” são tratados como texto comum.'],
  ['Só a receita fica salva, nunca os dados', 'Ao salvar uma receita, apenas os nomes das etapas e colunas ficam neste navegador. Os dados somem quando você fecha a página.'],
  ['Agendamento restrito à sua planilha', 'O script gerado é legível, só acessa a planilha onde foi instalado, não envia dados para fora, bloqueia execuções simultâneas, guarda o resultado anterior, protege a aba de resultado e registra cada execução.']
].map(([t, d]) => `<li>${SHIELD}<div><strong>${esc(t)}</strong><p>${esc(d)}</p></div></li>`).join('');

/* ---------- Modelos e guia ---------- */
function renderModelos() {
  const icone = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14l-4-2-4 2-4-2-4 2z"/><path d="M8 8h8M8 12h5"/></svg>';
  $('#modelos').innerHTML = Object.keys(TEMPLATES).map(k => {
    const t = TEMPLATES[k], r = t.make();
    return `<div class="model"><div class="mh"><span class="ico ${['', '', 'b', 'w', 'p'][t.cor]}">${icone}</span><b>${esc(r.name)}</b></div><p>${esc(t.desc)}</p><ul>${t.faz.map(x => `<li>${esc(x)}</li>`).join('')}</ul><p style="font-size:12px">${r.steps.length} etapas</p><button class="btn primary small" data-act="usar-modelo" data-modelo="${k}">Usar este modelo</button></div>`;
  }).join('');
}
const REGRAS = [
  ['Uma linha por registro', 'Cada linha é um cliente, uma venda, um produto. Nada de totais ou títulos no meio dos dados.'],
  ['Cabeçalho único na primeira linha', 'Um nome claro e diferente para cada coluna, sem linhas de título acima.'],
  ['Uma informação por coluna', 'Nome e sobrenome, cidade e estado: se precisar filtrar separado, use colunas separadas (a etapa “Dividir coluna” ajuda).'],
  ['Nada de células mescladas', 'Mesclar quebra filtros e fórmulas. Repita o valor em cada linha (a etapa “Preencher vazios com o valor de cima” resolve).'],
  ['Datas como datas', 'Use sempre o mesmo formato (dd/mm/aaaa). Texto como “5 de março” não ordena nem calcula.'],
  ['Números sem texto junto', 'R$ e unidades atrapalham contas. Guarde só o número e formate a coluna como moeda.'],
  ['Códigos como texto', 'CPF, CEP, telefone e códigos com zero à esquerda precisam ser texto, senão o zero some.'],
  ['Sem linhas e colunas vazias', 'Elas cortam a tabela ao meio e confundem filtros, gráficos e importações.'],
  ['Padrão para nomes e e-mails', 'Nomes com iniciais maiúsculas e e-mails em minúsculas evitam duplicidade disfarçada.'],
  ['O original fica guardado', 'Trabalhe numa cópia (aqui é sempre assim) e mantenha o arquivo bruto para conferência.']
];
function renderGuia() {
  $('#regras').innerHTML = REGRAS.map((r, i) => `<div class="rule"><span class="n">${i + 1}</span><div><b>${esc(r[0])}</b><small>${esc(r[1])}</small></div></div>`).join('');
  $('#guiaEtapas').innerHTML = GROUPS.map(([g, list]) => `<p><b>${esc(g)}</b></p><ul>${list.map(t => `<li><b>${esc(CATALOG[t].label)}:</b> ${esc(CATALOG[t].desc)}</li>`).join('')}</ul>`).join('');
}

/* ---------- Tema ---------- */
function temaAtual() { const t = document.documentElement.dataset.theme; return t || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); }
function aplicarTema(t) {
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  const escuro = temaAtual() === 'dark';
  $('#themeBtn').innerHTML = escuro
    ? '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
    : '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
}
function alternarTema() {
  const novo = temaAtual() === 'dark' ? 'light' : 'dark';
  aplicarTema(novo);
  store.set('ps.tema', novo);
  avisarPai({ tipo: 'ps-tema', tema: novo });
}

/* ---------- Conta (quando aberto dentro da loja) ----------
   A loja abre este aplicativo num iframe e manda o nome e o e-mail de quem está logado.
   Só mensagens da janela-mãe são aceitas, e o aplicativo só devolve pedidos de ação (perfil, painel, sair). */
// Só conversa com a janela-mãe quando ela é a própria loja (mesma origem). Em qualquer outro site, nada é enviado.
const ORIGEM_PAI = (() => { try { return window.parent !== window && window.parent.location.origin; } catch (e) { return null; } })();
const EMBUTIDO = !!ORIGEM_PAI && ORIGEM_PAI !== 'null';
function avisarPai(msg) { if (EMBUTIDO) { try { window.parent.postMessage(msg, ORIGEM_PAI); } catch (e) {} } }
function fecharMenuUsuario() { const pop = $('#userPop'); if (pop && !pop.hidden) { pop.hidden = true; document.querySelector('[data-act="user-menu"]').setAttribute('aria-expanded', 'false'); } }
function iniciais(nome, email) {
  const base = String(nome || '').trim() || String(email || '').split('@')[0];
  const partes = base.split(/[\s._-]+/).filter(Boolean);
  return ((partes[0] || '?')[0] + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
}
window.addEventListener('message', e => {
  if (!EMBUTIDO || e.source !== window.parent) return;
  const d = e.data;
  if (!d || typeof d !== 'object') return;
  if (d.tipo === 'ps-sessao') {
    const nome = String(d.nome || '').slice(0, 80), email = String(d.email || '').slice(0, 254);
    state.sessao = { nome, email, dono: !!d.dono };
    $('#userBox').hidden = false; $('#sideNote').hidden = true;
    $('#userAvatar').textContent = iniciais(nome, email);
    $('#userName').textContent = nome || email.split('@')[0];
    $('#userEmail').textContent = email;
    $('#userPainel').hidden = !d.dono;
    const primeiro = (nome || '').split(/\s+/)[0];
    const h = new Date().getHours();
    $('#hello').textContent = (h >= 5 && h < 12 ? 'Bom dia' : h >= 12 && h < 18 ? 'Boa tarde' : 'Boa noite') + (primeiro ? ', ' + primeiro : '') + '! Vamos deixar suas planilhas impecáveis.';
  } else if (d.tipo === 'ps-tema' && (d.tema === 'light' || d.tema === 'dark')) {
    aplicarTema(d.tema);
  }
});

/* ---------- Atalhos de teclado ---------- */
document.addEventListener('keydown', e => {
  const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  const emCampo = e.target.closest && e.target.closest('input, textarea, select, [contenteditable]');
  if (e.key === 'Escape') { fecharMenuUsuario(); $('#dlMenu').open = false; return; }
  if (mod && k === 'o') { e.preventDefault(); $('#fileInput').click(); return; }
  if (mod && k === 'e') { e.preventDefault(); exportResult('xlsx'); return; }
  if (emCampo) return;
  if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); voltar(state.hist, state.fut); return; }
  if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); voltar(state.fut, state.hist); return; }
  if (e.key === '/' && !mod) { e.preventDefault(); showTab('limpar'); $('#search').focus(); }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('drop')) { e.preventDefault(); $('#fileInput').click(); }
});

/* ---------- Início ---------- */
$('#gsHour').innerHTML = Array.from({ length: 24 }, (_, h) => `<option value="${h}" ${h === 6 ? 'selected' : ''}>${String(h).padStart(2, '0')}h às ${String(h + 1).padStart(2, '0')}h</option>`).join('');
aplicarTema(store.get('ps.tema', null));
renderAddStep();
renderModelos();
renderGuia();
const prev = store.get('ps.current', null);
if (prev) { try { state.recipe = sanitizeRecipe(prev); } catch (e) {} }
renderSource();
recompute();
renderRecipe();
renderUndo();
showTab((location.hash || '').slice(1));
downloadsNs();
avisarPai({ tipo: 'ps-pronto' });
})();
