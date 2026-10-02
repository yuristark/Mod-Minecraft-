// Gera um .xlsx com o gerador próprio, confere o XML e lê de volta com a SheetJS.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { inflateRawSync } from 'node:zlib';
const require = createRequire(import.meta.url);
const carregar = (arq, nome) => new Function(readFileSync(new URL('../' + arq, import.meta.url), 'utf8') + '\nreturn ' + nome + ';')()();
const E = carregar('src/engine.js', 'PlanilhaEngine');
const X = carregar('src/xlsx.js', 'PlanilhaXlsx');

const blob = await X.build([
  { name: 'Vendas & Cia', headers: ['Nome', 'Valor', 'Data', 'Qtd', 'CPF', 'Obs'], tipos: ['text', 'currency', 'date', 'integer', 'text', 'text'],
    rows: [['Ana <b>', '1.234,50', '05/03/2025', '3', '012.345.678-90', '=HYPERLINK("x")'], ['Bia', '', 'não é data', '2', '', ' espaço ']] },
  { name: 'Resumo', headers: ['A'], rows: [['1']] }
], E);
const buf = new Uint8Array(await blob.arrayBuffer());

// lê o zip manualmente e confere cada XML
const dv = new DataView(buf.buffer);
let p = 0; const arquivos = {};
while (dv.getUint32(p, true) === 0x04034b50) {
  const metodo = dv.getUint16(p + 8, true), tam = dv.getUint32(p + 18, true), nlen = dv.getUint16(p + 26, true);
  const nome = new TextDecoder().decode(buf.slice(p + 30, p + 30 + nlen));
  const dados = buf.slice(p + 30 + nlen, p + 30 + nlen + tam);
  arquivos[nome] = new TextDecoder().decode(metodo === 8 ? inflateRawSync(dados) : dados);
  p += 30 + nlen + tam;
}
assert.deepEqual(Object.keys(arquivos).sort(), ['[Content_Types].xml', '_rels/.rels', 'docProps/app.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml'].sort());
const s1 = arquivos['xl/worksheets/sheet1.xml'];
assert.match(s1, /<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"\/>/);
assert.match(s1, /<autoFilter ref="A1:F3"\/>/);
assert.match(s1, /<c r="B2" s="3"><v>1234.5<\/v><\/c>/);
assert.match(s1, /<c r="C2" s="4"><v>45721<\/v><\/c>/);
assert.match(s1, /<c r="D2" s="5"><v>3<\/v><\/c>/);
assert.match(s1, /Ana &lt;b&gt;/);
assert.ok(!/<f>/.test(s1), 'nenhuma fórmula');
assert.match(arquivos['xl/workbook.xml'], /name="Vendas &amp; Cia"/);
assert.match(arquivos['xl/workbook.xml'], /'Vendas &amp; Cia'!\$A\$1:\$F\$3/);
console.log('  ✓ estrutura do arquivo, cabeçalho fixo, filtros, tipos e escape');

const XLSX = require('xlsx');
const wb = XLSX.read(buf, { type: 'array', cellNF: true, cellStyles: true });
assert.deepEqual(wb.SheetNames, ['Vendas & Cia', 'Resumo']);
const ws = wb.Sheets['Vendas & Cia'];
assert.equal(ws.B2.t, 'n'); assert.equal(ws.B2.v, 1234.5); assert.match(ws.B2.z, /R\$/);
assert.equal(ws.C2.t, 'n'); assert.equal(ws.C2.z, 'dd/mm/yyyy'); assert.equal(ws.C2.w, '05/03/2025');
assert.equal(ws.C3.t, 's'); assert.equal(ws.C3.v, 'não é data');
assert.equal(ws.E2.t, 's'); assert.equal(ws.E2.v, '012.345.678-90');
assert.equal(ws.F2.t, 's'); assert.equal(ws.F2.v, '=HYPERLINK("x")'); assert.equal(ws.F2.f, undefined);
assert.equal(ws.F3.v, ' espaço ');
assert.ok(ws['!cols'] && ws['!cols'].length === 6);
console.log('  ✓ lido de volta pela SheetJS com números, moeda e datas de verdade');
console.log('xlsx: OK');
