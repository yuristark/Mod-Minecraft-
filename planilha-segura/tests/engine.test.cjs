const fs=require('fs');
const src=fs.readFileSync(require('path').join(__dirname, '..', 'src', 'engine.js'),'utf8');
const PlanilhaEngine=new Function(src+'\nreturn PlanilhaEngine;')();
const E=PlanilhaEngine(); const assert=require('assert');
const inp={headers:['__proto__','constructor','Nome','Valor'],rows:[[' a ','x','joão de souza','R$ 1.234,5'],[' a ','x','joão de souza','R$ 1.234,5'],['','', '', ''],['b','y','CONSTRUCTOR toString','10']]};
const r=E.run(inp,[{type:'trim',on:true,p:{cols:[],collapse:true}},{type:'removeEmptyRows',on:true,p:{}},{type:'dedupe',on:true,p:{cols:[],keep:'first',ignoreCase:true}},{type:'case',on:true,p:{cols:['Nome'],mode:'title'}},{type:'number',on:true,p:{cols:['Valor'],from:'auto',to:'br',decimals:'2'}},{type:'sort',on:true,p:{col:'__proto__',dir:'desc'}}]);
assert.strictEqual(r.rows.length,2); assert.strictEqual(({}).polluted,undefined);
assert.strictEqual(E.titleCase('joão de souza'),'João de Souza');
assert.strictEqual(typeof E.titleCase('constructor'),'string');
assert.ok(E.cpfOk('52998224725')); assert.ok(!E.cpfOk('11111111111'));
assert.strictEqual(Object.prototype.x,undefined);
console.log('engine OK', r.report.map(x=>x.warn).flat());

// ---- novas etapas
const run = (headers, rows, steps) => E.toGrid(E.run({ headers, rows }, steps.map(([type, p]) => ({ type, on: true, p }))));
let g = run(['Nome completo'], [['Maria da Silva Souza'], ['João']], [['split', { col: 'Nome completo', sep: 'space_first', keepOriginal: false }]]);
assert.deepStrictEqual(g.headers, ['Primeiro nome', 'Sobrenome']); assert.deepStrictEqual(g.rows, [['Maria', 'da Silva Souza'], ['João', '']]);
g = run(['End'], [['Rua A, 10, Centro, SP']], [['split', { col: 'End', sep: 'comma', parts: '3', names: 'Rua,Número,Resto' }]]);
assert.deepStrictEqual(g.headers, ['End', 'Rua', 'Número', 'Resto']); assert.strictEqual(g.rows[0][3], 'Centro, SP');
g = run(['Rua', 'Num', 'Cidade'], [['Rua A', '10', ''], ['Rua B', '', 'SP']], [['merge', { cols: ['Rua', 'Num', 'Cidade'], sep: 'comma', name: 'Endereço', removeOriginals: true }]]);
assert.deepStrictEqual(g, { headers: ['Endereço'], rows: [['Rua A, 10'], ['Rua B, SP']] });
g = run(['Qtd', 'Preço'], [['3', 'R$ 10,50'], ['x', '2']], [['calc', { a: 'Qtd', op: 'mul', b: 'Preço', name: 'Total', to: 'br', decimals: '2' }]]);
assert.strictEqual(g.rows[0][2], '31,50'); assert.strictEqual(g.rows[1][2], '');
g = run(['Valor'], [['200']], [['calc', { a: 'Valor', op: 'pct', b: '', bConst: '10', name: 'Desconto' }]]);
assert.strictEqual(g.rows[0][1], '20,00');
g = run(['Fim', 'Início'], [['10/03/2025', '01/03/2025']], [['calc', { a: 'Fim', op: 'diffdays', b: 'Início', name: 'Prazo' }]]);
assert.strictEqual(g.rows[0][2], '9');
g = run(['Nome'], [['José Ação!! 12']], [['clean', { cols: [], accents: true, keep: 'letters' }]]);
assert.strictEqual(g.rows[0][0], 'Jose Acao');
g = run(['CEP'], [['1310100'], ['01310-100'], ['123']], [['cep', { cols: ['CEP'] }]]);
assert.deepStrictEqual(g.rows.map(r => r[0]), ['01310-100', '01310-100', '123']);
const rg = E.run({ headers: ['Vendedor', 'Valor'], rows: [['Ana', '10'], ['Bia', '5'], ['ana ', '2,5']] }, [{ type: 'group', on: true, p: { by: ['Vendedor'], agg: 'sum', value: 'Valor' } }]);
assert.deepStrictEqual(E.toGrid(rg), { headers: ['Vendedor', 'Quantidade', 'Soma de Valor'], rows: [['Ana', '2', '12,50'], ['Bia', '1', '5,00']] });
assert.strictEqual(rg.report[0].removed, 1);

// ---- diagnóstico
const d = E.analyze({ headers: ['Nome', 'E-mail', 'Telefone', 'Data', 'Valor', 'CPF', 'Vazia'], rows: [
  ['MARIA SOUZA ', 'Maria@X.com', '11987654321', '2025-03-05', 'R$ 1.234,5', '52998224725', ''],
  ['MARIA SOUZA ', 'Maria@X.com', '11987654321', '2025-03-05', 'R$ 1.234,5', '52998224725', ''],
  ['', '', '', '', '', '', ''],
  ['joão lima', 'joao@', '(21) 3344-5566', '06/03/2025', '10', '11111111111', '']] });
const tipos = Object.fromEntries(d.colunas.map(c => [c.nome, c.tipo]));
assert.deepStrictEqual(tipos, { Nome: 'nome', 'E-mail': 'email', Telefone: 'telefone', Data: 'data', Valor: 'moeda', CPF: 'documento', Vazia: 'vazia' });
const tiposSug = d.sugestoes.map(s => s.type);
for (const t of ['trim', 'removeEmptyRows', 'removeEmptyCols', 'dedupe', 'validate', 'case', 'phone', 'date', 'number']) assert.ok(tiposSug.includes(t), 'sugestão ' + t);
assert.ok(d.nota < 70, 'nota baixa para planilha bagunçada: ' + d.nota);
const limpa = E.analyze({ headers: ['Nome', 'Valor'], rows: [['Ana Lima', '10,00'], ['Bia Reis', '5,00']] });
assert.strictEqual(limpa.nota, 100); assert.strictEqual(limpa.sugestoes.length, 0);
// aplicar as sugestões melhora a nota
const steps = d.sugestoes.map(s => ({ type: s.type, on: true, p: s.p }));
const depois = E.analyze(E.toGrid(E.run({ headers: ['Nome', 'E-mail', 'Telefone', 'Data', 'Valor', 'CPF', 'Vazia'], rows: [
  ['MARIA SOUZA ', 'Maria@X.com', '11987654321', '2025-03-05', 'R$ 1.234,5', '52998224725', ''],
  ['joão lima', 'joao@x.com', '(21) 3344-5566', '06/03/2025', '10', '52998224725', '']] }, steps)));
assert.ok(depois.nota > 85, 'nota depois ' + depois.nota);
console.log('novas etapas e diagnóstico OK (nota antes ' + d.nota + ')');
