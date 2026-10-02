// Pix "copia e cola" (BR Code, padrão do Banco Central): funciona no aplicativo de qualquer banco
// (Nubank, Inter, Itaú, Bradesco, Caixa, Banco do Brasil, Santander, C6, PicPay, Mercado Pago...).
function PixBRCode() {
  'use strict';
  function crc16(texto) {
    var crc = 0xFFFF;
    for (var i = 0; i < texto.length; i++) {
      crc ^= texto.charCodeAt(i) << 8;
      for (var b = 0; b < 8; b++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
    return ('0000' + crc.toString(16).toUpperCase()).slice(-4);
  }
  function campo(id, valor) {
    var v = String(valor);
    if (v.length > 99) throw new Error('Campo Pix grande demais');
    return id + ('0' + v.length).slice(-2) + v;
  }
  function limpar(s, max) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase().slice(0, max);
  }
  // chave: CPF/CNPJ (só números), e-mail, telefone +55..., ou chave aleatória
  function payload(o) {
    var chave = String(o.chave || '').trim();
    if (!/^[\x21-\x7E]{5,77}$/.test(chave)) throw new Error('Chave Pix inválida');
    var conta = campo('00', 'br.gov.bcb.pix') + campo('01', chave);
    var txid = String(o.txid || '***').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';
    var p = campo('00', '01')
      + campo('26', conta)
      + campo('52', '0000')
      + campo('53', '986')
      + (o.valorCentavos ? campo('54', (o.valorCentavos / 100).toFixed(2)) : '')
      + campo('58', 'BR')
      + campo('59', limpar(o.nome, 25) || 'RECEBEDOR')
      + campo('60', limpar(o.cidade, 15) || 'BRASIL')
      + campo('62', campo('05', txid))
      + '6304';
    return p + crc16(p);
  }
  return { payload: payload, crc16: crc16 };
}
