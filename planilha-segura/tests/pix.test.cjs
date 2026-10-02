// Testa o Pix copia e cola (BR Code) e o QR Code gerado.
const assert = require('assert');
const fs = require('fs'), path = require('path');
const P = new Function(fs.readFileSync(path.join(__dirname, '..', 'loja', 'pix.js'), 'utf8') + ';return PixBRCode;')()();
const qrcode = new Function(fs.readFileSync(path.join(__dirname, '..', 'vendor', 'qrcode-generator-1.4.4.js'), 'utf8') + ';return qrcode;')();
// exemplo oficial do Manual do BR Code (Banco Central)
assert.strictEqual(P.crc16('00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304'), '1D3D');
function tlv(s) { const o = {}; let i = 0; while (i < s.length) { const id = s.slice(i, i + 2), n = +s.slice(i + 2, i + 4); o[id] = s.slice(i + 4, i + 4 + n); i += 4 + n; } return o; }
const p = P.payload({ chave: 'contato@minhaloja.com.br', nome: 'Loja do João Ltda.', cidade: 'Belo Horizonte', valorCentavos: 12345, txid: 'PS-ABC 123' });
const t = tlv(p);
assert.strictEqual(t['00'], '01'); assert.strictEqual(t['53'], '986'); assert.strictEqual(t['54'], '123.45'); assert.strictEqual(t['58'], 'BR');
assert.strictEqual(t['59'], 'LOJA DO JOAO LTDA'); assert.strictEqual(t['60'], 'BELO HORIZONTE');
assert.deepStrictEqual(tlv(t['26']), { '00': 'br.gov.bcb.pix', '01': 'contato@minhaloja.com.br' });
assert.deepStrictEqual(tlv(t['62']), { '05': 'PSABC123' });
assert.strictEqual(t['63'], P.crc16(p.slice(0, -4)));
assert.throws(() => P.payload({ chave: 'chave com espaço', nome: 'x', cidade: 'y' }));
const qr = qrcode(0, 'M'); qr.addData(p); qr.make();
assert.ok(qr.getModuleCount() >= 21 && /<svg/.test(qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true })));
console.log('pix: OK (' + p.length + ' caracteres, QR ' + qr.getModuleCount() + 'x' + qr.getModuleCount() + ')');
