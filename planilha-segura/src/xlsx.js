// Gerador de Excel (.xlsx) formatado: cabeçalho destacado e fixo, filtros, larguras de coluna,
// números, moeda e datas como valores de verdade. Textos são sempre gravados como texto, nunca como fórmula.
function PlanilhaXlsx() {
  'use strict';
  var TIPOS = { text: 0, number: 2, currency: 3, date: 4, integer: 5 };
  var NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  var NSR = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  var HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

  function xml(s) {
    return String(s)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
      .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function colName(i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  function serial(d) { return Date.UTC(d.y, d.m - 1, d.d) / 86400000 + 25569; }

  var STYLES = HEAD + '<styleSheet xmlns="' + NS + '">' +
    '<numFmts count="3"><numFmt numFmtId="164" formatCode="#,##0.00"/><numFmt numFmtId="165" formatCode="&quot;R$&quot;\\ #,##0.00;[Red]\\-&quot;R$&quot;\\ #,##0.00"/><numFmt numFmtId="166" formatCode="dd/mm/yyyy"/></numFmts>' +
    '<fonts count="2"><font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>' +
    '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font></fonts>' +
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF1A674B"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
    '<border><left/><right/><top/><bottom style="thin"><color rgb="FFD9E2DE"/></bottom><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="6">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>' +
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center"/></xf>' +
    '<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '<dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/></styleSheet>';

  // Cada coluna: { tipo: 'text' | 'number' | 'integer' | 'currency' | 'date' }. parseNum/parseDate vêm do motor.
  function sheetXml(sh, E) {
    var headers = sh.headers, rows = sh.rows, tipos = sh.tipos || [];
    var ncol = Math.max(1, headers.length), nrow = rows.length + 1;
    var ref = 'A1:' + colName(ncol - 1) + nrow;
    var largura = headers.map(function (h) { return Math.min(60, String(h).length * 1.15 + 4); });
    var out = [];
    out.push(HEAD + '<worksheet xmlns="' + NS + '" xmlns:r="' + NSR + '">');
    out.push('<dimension ref="' + ref + '"/>');
    out.push('<sheetViews><sheetView workbookViewId="0"' + (sh.tabSelected ? ' tabSelected="1"' : '') + '><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>');
    out.push('<sheetFormatPr defaultRowHeight="15"/>');
    var dados = [];
    dados.push('<row r="1" ht="24" customHeight="1">' + headers.map(function (h, i) {
      return '<c r="' + colName(i) + '1" t="inlineStr" s="1"><is><t xml:space="preserve">' + xml(h) + '</t></is></c>';
    }).join('') + '</row>');
    for (var r = 0; r < rows.length; r++) {
      var linha = rows[r], cells = '', rn = r + 2;
      for (var c = 0; c < ncol; c++) {
        var v = linha[c] == null ? '' : String(linha[c]);
        if (v === '') continue;
        var t = tipos[c] || 'text', ref2 = colName(c) + rn, feito = false;
        if (t === 'date') {
          var d = E.parseDate(v);
          if (d) { cells += '<c r="' + ref2 + '" s="4"><v>' + serial(d) + '</v></c>'; feito = true; if (largura[c] < 12) largura[c] = 12; }
        } else if (t !== 'text') {
          var n = E.parseNum(v, 'auto');
          if (n != null && isFinite(n)) { cells += '<c r="' + ref2 + '" s="' + TIPOS[t] + '"><v>' + n + '</v></c>'; feito = true; }
        }
        if (!feito) {
          if (v.length > 32767) v = v.slice(0, 32767);
          cells += '<c r="' + ref2 + '" t="inlineStr"><is><t xml:space="preserve">' + xml(v) + '</t></is></c>';
        }
        if (r < 3000) { var w = Math.min(60, v.length * 1.1 + 3); if (w > largura[c]) largura[c] = w; }
      }
      dados.push('<row r="' + rn + '">' + cells + '</row>');
    }
    out.push('<cols>' + largura.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + Math.max(8, Math.round(w * 10) / 10) + '" customWidth="1"/>'; }).join('') + '</cols>');
    out.push('<sheetData>' + dados.join('') + '</sheetData>');
    if (headers.length) out.push('<autoFilter ref="' + ref + '"/>');
    out.push('<pageMargins left="0.5" right="0.5" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>');
    out.push('<pageSetup orientation="landscape"/>');
    out.push('</worksheet>');
    return { xml: out.join(''), ref: ref };
  }

  // ---------------- zip
  var CRC = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { var c = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  async function deflate(u8) {
    if (typeof CompressionStream === 'undefined') return null;
    try {
      var stream = new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate-raw'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    } catch (e) { return null; }
  }
  async function zip(files) {
    var enc = new TextEncoder(), partes = [], central = [], offset = 0;
    var agora = new Date();
    var dosTime = (agora.getHours() << 11) | (agora.getMinutes() << 5) | (agora.getSeconds() >> 1);
    var dosDate = ((agora.getFullYear() - 1980) << 9) | ((agora.getMonth() + 1) << 5) | agora.getDate();
    for (var i = 0; i < files.length; i++) {
      var nome = enc.encode(files[i].name), dados = enc.encode(files[i].data);
      var crc = crc32(dados), comp = await deflate(dados), metodo = comp ? 8 : 0;
      if (!comp) comp = dados;
      var h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, metodo, true);
      h.setUint16(10, dosTime, true); h.setUint16(12, dosDate, true); h.setUint32(14, crc, true);
      h.setUint32(18, comp.length, true); h.setUint32(22, dados.length, true); h.setUint16(26, nome.length, true); h.setUint16(28, 0, true);
      partes.push(new Uint8Array(h.buffer), nome, comp);
      var cd = new DataView(new ArrayBuffer(46));
      cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true);
      cd.setUint16(10, metodo, true); cd.setUint16(12, dosTime, true); cd.setUint16(14, dosDate, true); cd.setUint32(16, crc, true);
      cd.setUint32(20, comp.length, true); cd.setUint32(24, dados.length, true); cd.setUint16(28, nome.length, true);
      cd.setUint32(42, offset, true);
      central.push(new Uint8Array(cd.buffer), nome);
      offset += 30 + nome.length + comp.length;
    }
    var tamCentral = central.reduce(function (s, p) { return s + p.length; }, 0);
    var fim = new DataView(new ArrayBuffer(22));
    fim.setUint32(0, 0x06054b50, true); fim.setUint16(8, files.length, true); fim.setUint16(10, files.length, true);
    fim.setUint32(12, tamCentral, true); fim.setUint32(16, offset, true);
    return new Blob(partes.concat(central, [new Uint8Array(fim.buffer)]), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  // sheets: [{ name, headers, rows, tipos }]; E: motor (PlanilhaEngine) para ler números e datas.
  async function build(sheets, E) {
    if (!sheets.length) throw new Error('Nada para exportar.');
    var files = [], defs = [], rels = [], over = [];
    sheets.forEach(function (sh, i) {
      sh.tabSelected = i === 0;
      var s = sheetXml(sh, E), n = i + 1;
      files.push({ name: 'xl/worksheets/sheet' + n + '.xml', data: s.xml });
      rels.push('<Relationship Id="rId' + n + '" Type="' + NSR + '/worksheet" Target="worksheets/sheet' + n + '.xml"/>');
      over.push('<Override PartName="/xl/worksheets/sheet' + n + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>');
      if (sh.headers.length) defs.push('<definedName name="_xlnm._FilterDatabase" localSheetId="' + i + '" hidden="1">\'' + xml(sh.name.replace(/'/g, "''")) + '\'!$' + s.ref.replace(/(\d+)/g, '$$$1').replace(':', ':$') + '</definedName>');
    });
    var n = sheets.length;
    rels.push('<Relationship Id="rId' + (n + 1) + '" Type="' + NSR + '/styles" Target="styles.xml"/>');
    files.unshift(
      { name: '[Content_Types].xml', data: HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' + over.join('') + '</Types>' },
      { name: '_rels/.rels', data: HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="' + NSR + '/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="' + NSR + '/extended-properties" Target="docProps/app.xml"/></Relationships>' },
      { name: 'docProps/app.xml', data: HEAD + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Planilha Segura</Application></Properties>' },
      { name: 'xl/workbook.xml', data: HEAD + '<workbook xmlns="' + NS + '" xmlns:r="' + NSR + '"><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="28800" windowHeight="16000"/></bookViews><sheets>' +
        sheets.map(function (sh, i) { return '<sheet name="' + xml(sh.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') +
        '</sheets>' + (defs.length ? '<definedNames>' + defs.join('') + '</definedNames>' : '') + '</workbook>' },
      { name: 'xl/_rels/workbook.xml.rels', data: HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rels.join('') + '</Relationships>' },
      { name: 'xl/styles.xml', data: STYLES }
    );
    return zip(files);
  }

  return { build: build, colName: colName };
}
