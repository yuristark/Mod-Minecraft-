function PlanilhaEngine() {
  'use strict';
  var INVIS = /[​-‍⁠﻿­]/g;
  var EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i;
  var MESES = dict({ jan:1, fev:2, mar:3, abr:4, mai:5, jun:6, jul:7, ago:8, set:9, out:10, nov:11, dez:12 });
  var PARTICULAS = dict({ de:1, da:1, do:1, das:1, dos:1, e:1, di:1, du:1, del:1, van:1, von:1 });
  var MAX_PATTERN = 300;

  // Dicionário sem protótipo: chaves vindas da planilha (ex.: "__proto__", "constructor") não alteram objetos internos.
  function dict(src) { var o = Object.create(null); if (src) Object.keys(src).forEach(function (k) { o[k] = src[k]; }); return o; }

  function S(v) { return v == null ? '' : String(v); }
  function K(v) { return S(v).replace(INVIS, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('pt-BR'); }
  function isEmpty(v) { return S(v).replace(INVIS, '').trim() === ''; }
  function findCol(h, name) { var k = K(name); if (!k) return -1; for (var i = 0; i < h.length; i++) if (K(h[i]) === k) return i; return -1; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function escRe(s) { return S(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function pick(ctx, names, allowAll) {
    if (!names || !names.length) {
      if (allowAll) return ctx.headers.map(function (_, i) { return i; });
      ctx.rep.warn.push('Escolha pelo menos uma coluna.'); return [];
    }
    var out = [];
    names.forEach(function (n) {
      var i = findCol(ctx.headers, n);
      if (i < 0) ctx.rep.warn.push('Coluna não encontrada: ' + n);
      else if (out.indexOf(i) < 0) out.push(i);
    });
    return out;
  }
  function one(ctx, name) {
    if (!S(name).trim()) { ctx.rep.warn.push('Escolha a coluna.'); return -1; }
    var i = findCol(ctx.headers, name);
    if (i < 0) ctx.rep.warn.push('Coluna não encontrada: ' + name);
    return i;
  }
  function set(ctx, row, i, v) { if (row.v[i] !== v) { row.v[i] = v; row.ch[ctx.headers[i]] = 1; ctx.rep.changed++; } }
  function drop(ctx, test) {
    var keep = [];
    ctx.rows.forEach(function (r) { if (test(r)) { ctx.removed[r.o] = ctx.si; ctx.rep.removed++; } else keep.push(r); });
    ctx.rows = keep;
  }
  function uniqueName(h, name) { var base = S(name).trim() || 'Coluna', n = base, k = 2; while (findCol(h, n) >= 0) { n = base + ' (' + k + ')'; k++; } return n; }
  function addCol(ctx, name, after) {
    name = uniqueName(ctx.headers, name);
    var at = after == null ? ctx.headers.length : after + 1;
    ctx.headers.splice(at, 0, name);
    ctx.rows.forEach(function (r) { r.v.splice(at, 0, ''); r.ch[name] = 1; });
    ctx.rep.added++;
    return at;
  }

  function parseNum(s, from) {
    var t = S(s).replace(INVIS, '').trim();
    if (!t) return null;
    var neg = false;
    if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1, -1); }
    t = t.replace(/R\$|US\$|\$|€|%/gi, '').replace(/[\s ]/g, '');
    if (/^[-−]/.test(t)) { neg = !neg; t = t.slice(1); }
    if (/-$/.test(t)) { neg = !neg; t = t.slice(0, -1); }
    if (!/^[\d.,]+$/.test(t) || !/\d/.test(t)) return null;
    var dec;
    if (from === 'br') dec = ',';
    else if (from === 'us') dec = '.';
    else {
      var lc = t.lastIndexOf(','), ld = t.lastIndexOf('.');
      if (lc >= 0 && ld >= 0) dec = lc > ld ? ',' : '.';
      else if (lc >= 0) dec = t.split(',').length > 2 ? '.' : ',';
      else if (ld >= 0) dec = (t.split('.').length > 2 || /^\d{1,3}\.\d{3}$/.test(t)) ? ',' : '.';
      else dec = '.';
    }
    var th = dec === ',' ? '.' : ',';
    t = t.split(th).join('');
    if (dec === ',') t = t.replace(',', '.');
    if ((t.match(/\./g) || []).length > 1) return null;
    var n = Number(t);
    if (!isFinite(n)) return null;
    return neg ? -n : n;
  }
  function fmtNum(n, to, dec) {
    var d = (dec === 'auto' || dec == null || dec === '') ? null : Number(dec);
    if (to === 'plain') return d == null ? String(n) : n.toFixed(d);
    var o = { useGrouping: true };
    if (to === 'brl') { o.style = 'currency'; o.currency = 'BRL'; }
    if (d != null) { o.minimumFractionDigits = d; o.maximumFractionDigits = d; }
    else if (to !== 'brl') o.maximumFractionDigits = 10;
    return n.toLocaleString('pt-BR', o).replace(/ /g, ' ');
  }

  function ymd(y, m, d) {
    if (y < 100) y += y < 50 ? 2000 : 1900;
    var dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return { y: y, m: m, d: d };
  }
  function parseDate(s) {
    var t = S(s).replace(INVIS, '').trim(), m;
    if (!t) return null;
    if ((m = t.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?:[ T].*)?$/))) return ymd(+m[1], +m[2], +m[3]);
    if ((m = t.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2}|\d{4})(?:\s.*)?$/))) {
      var a = +m[1], b = +m[2];
      if (a <= 12 && b > 12) return ymd(+m[3], a, b);
      return ymd(+m[3], b, a);
    }
    if ((m = t.match(/^(\d{5})(?:[.,]\d+)?$/))) {
      var n = +m[1];
      if (n >= 20000 && n <= 80000) {
        var dt = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
        return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
      }
    }
    if ((m = t.toLowerCase().match(/^(\d{1,2})(?:\s+de\s+|[\s\/.\-]+)([a-zç]{3})[a-zç]*\.?(?:\s+de\s+|[\s\/.\-]+)(\d{2}|\d{4})$/))) {
      var mm = MESES[m[2]];
      if (mm) return ymd(+m[3], mm, +m[1]);
    }
    return null;
  }
  function fmtDate(o, to) { return to === 'iso' ? o.y + '-' + pad2(o.m) + '-' + pad2(o.d) : pad2(o.d) + '/' + pad2(o.m) + '/' + o.y; }

  function fmtPhone(s, ddi) {
    var d = S(s).replace(/\D/g, '');
    if (!d) return null;
    if ((d.length === 12 || d.length === 13) && d.slice(0, 2) === '55') d = d.slice(2);
    if ((d.length === 11 || d.length === 12) && d.charAt(0) === '0') d = d.slice(1);
    var out;
    if (d.length === 11) out = '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
    else if (d.length === 10) out = '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    else return null;
    return ddi ? '+55 ' + out : out;
  }

  function cpfOk(d) {
    if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
    for (var t = 9; t < 11; t++) {
      var s = 0;
      for (var i = 0; i < t; i++) s += +d.charAt(i) * (t + 1 - i);
      if ((s * 10) % 11 % 10 !== +d.charAt(t)) return false;
    }
    return true;
  }
  function cnpjOk(d) {
    if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
    var w = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    for (var t = 12; t < 14; t++) {
      var s = 0;
      for (var i = 0; i < t; i++) s += +d.charAt(i) * w[i + 13 - t];
      var r = s % 11; r = r < 2 ? 0 : 11 - r;
      if (r !== +d.charAt(t)) return false;
    }
    return true;
  }
  function fmtCpf(d) { return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4'); }
  function fmtCnpj(d) { return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5'); }

  function titleCase(s) {
    return S(s).toLocaleLowerCase('pt-BR').split(/(\s+)/).map(function (w, i) {
      if (/^\s+$/.test(w) || !w) return w;
      if (i > 0 && PARTICULAS[w]) return w;
      return w.replace(/(^|[-'’])(\p{L})/gu, function (_, p, c) { return p + c.toLocaleUpperCase('pt-BR'); });
    }).join('');
  }

  var STEPS = {
    trim: function (ctx, p) {
      var idx = pick(ctx, p.cols, true);
      ctx.rows.forEach(function (r) {
        idx.forEach(function (i) {
          var v = S(r.v[i]).replace(INVIS, '').replace(/ /g, ' ');
          if (p.collapse !== false) v = v.replace(/[ \t]{2,}/g, ' ');
          set(ctx, r, i, v.trim());
        });
      });
    },
    removeEmptyRows: function (ctx) { drop(ctx, function (r) { return r.v.every(isEmpty); }); },
    removeEmptyCols: function (ctx) {
      var gone = [];
      for (var i = ctx.headers.length - 1; i >= 0; i--) {
        var all = ctx.rows.every(function (r) { return isEmpty(r.v[i]); });
        if (all) gone.push(i);
      }
      gone.forEach(function (i) { ctx.headers.splice(i, 1); ctx.rows.forEach(function (r) { r.v.splice(i, 1); }); });
      ctx.rep.cols += gone.length;
    },
    fillDown: function (ctx, p) {
      pick(ctx, p.cols, false).forEach(function (i) {
        var last = '';
        ctx.rows.forEach(function (r) { if (isEmpty(r.v[i])) { if (last) set(ctx, r, i, last); } else last = r.v[i]; });
      });
    },
    dedupe: function (ctx, p) {
      var idx = pick(ctx, p.cols, true), seen = Object.create(null), dup = Object.create(null);
      var list = p.keep === 'last' ? ctx.rows.slice().reverse() : ctx.rows;
      list.forEach(function (r) {
        var parts = idx.map(function (i) { var v = S(r.v[i]).replace(INVIS, '').replace(/\s+/g, ' ').trim(); return p.ignoreCase === false ? v : v.toLocaleLowerCase('pt-BR'); });
        if (parts.every(function (x) { return x === ''; })) return;
        var key = parts.join('\u0001');
        if (seen[key]) dup[r.o] = 1; else seen[key] = 1;
      });
      drop(ctx, function (r) { return !!dup[r.o]; });
    },
    'case': function (ctx, p) {
      var idx = pick(ctx, p.cols, false), mode = p.mode || 'title';
      ctx.rows.forEach(function (r) {
        idx.forEach(function (i) {
          var v = S(r.v[i]), n;
          if (mode === 'upper') n = v.toLocaleUpperCase('pt-BR');
          else if (mode === 'lower') n = v.toLocaleLowerCase('pt-BR');
          else if (mode === 'sentence') { n = v.toLocaleLowerCase('pt-BR'); n = n.replace(/^(\s*)(\p{L})/u, function (_, a, c) { return a + c.toLocaleUpperCase('pt-BR'); }); }
          else n = titleCase(v);
          set(ctx, r, i, n);
        });
      });
    },
    replace: function (ctx, p) {
      if (!S(p.find)) { ctx.rep.warn.push('Informe o texto a localizar.'); return; }
      if (S(p.find).length > MAX_PATTERN) { ctx.rep.warn.push('Texto a localizar muito longo (máximo de ' + MAX_PATTERN + ' caracteres).'); return; }
      var idx = pick(ctx, p.cols, true), src = p.regex ? S(p.find) : escRe(p.find), re;
      if (p.whole) src = '^(?:' + src + ')$';
      try { re = new RegExp(src, 'g' + (p.ignoreCase === false ? '' : 'i')); }
      catch (e) { ctx.rep.warn.push('Expressão regular inválida.'); return; }
      var repl = S(p.repl);
      ctx.rows.forEach(function (r) {
        idx.forEach(function (i) {
          var v = S(r.v[i]);
          re.lastIndex = 0;
          var n = p.regex ? v.replace(re, repl) : v.replace(re, function () { return repl; });
          set(ctx, r, i, n);
        });
      });
    },
    filter: function (ctx, p) {
      var i = one(ctx, p.col);
      if (i < 0) return;
      var op = p.op || 'contains', val = S(p.value), kv = K(val);
      var needsValue = ['empty', 'not_empty'].indexOf(op) < 0;
      if (needsValue && val === '') { ctx.rep.warn.push('Informe o valor para comparar.'); return; }
      var vd = parseDate(val), vn = parseNum(val, 'auto');
      function cmp(x) {
        if (vd && /[\/\-]|de /.test(val)) { var xd = parseDate(x); if (!xd) return null; var a = xd.y * 10000 + xd.m * 100 + xd.d, b = vd.y * 10000 + vd.m * 100 + vd.d; return a - b; }
        if (vn != null) { var xn = parseNum(x, 'auto'); if (xn == null) return null; return xn - vn; }
        return K(x).localeCompare(kv, 'pt-BR', { numeric: true });
      }
      function match(r) {
        var x = r.v[i], kx = K(x), c;
        switch (op) {
          case 'contains': return kx.indexOf(kv) >= 0;
          case 'not_contains': return kx.indexOf(kv) < 0;
          case 'equals': return kx === kv;
          case 'not_equals': return kx !== kv;
          case 'starts': return kx.indexOf(kv) === 0;
          case 'ends': return kx.slice(-kv.length) === kv;
          case 'empty': return isEmpty(x);
          case 'not_empty': return !isEmpty(x);
          case 'gt': c = cmp(x); return c != null && c > 0;
          case 'gte': c = cmp(x); return c != null && c >= 0;
          case 'lt': c = cmp(x); return c != null && c < 0;
          case 'lte': c = cmp(x); return c != null && c <= 0;
        }
        return false;
      }
      drop(ctx, function (r) { var m = match(r); return p.action === 'remove' ? m : !m; });
    },
    number: function (ctx, p) {
      var bad = 0;
      pick(ctx, p.cols, false).forEach(function (i) {
        ctx.rows.forEach(function (r) {
          if (isEmpty(r.v[i])) return;
          var n = parseNum(r.v[i], p.from || 'auto');
          if (n == null) { bad++; return; }
          set(ctx, r, i, fmtNum(n, p.to || 'br', p.decimals));
        });
      });
      if (bad) ctx.rep.warn.push(bad + ' valor(es) não reconhecido(s) como número; ficaram como estavam.');
    },
    date: function (ctx, p) {
      var bad = 0;
      pick(ctx, p.cols, false).forEach(function (i) {
        ctx.rows.forEach(function (r) {
          if (isEmpty(r.v[i])) return;
          var d = parseDate(r.v[i]);
          if (!d) { bad++; return; }
          set(ctx, r, i, fmtDate(d, p.to || 'br'));
        });
      });
      if (bad) ctx.rep.warn.push(bad + ' data(s) não reconhecida(s); ficaram como estavam.');
    },
    phone: function (ctx, p) {
      var bad = 0;
      pick(ctx, p.cols, false).forEach(function (i) {
        ctx.rows.forEach(function (r) {
          if (isEmpty(r.v[i])) return;
          var f = fmtPhone(r.v[i], !!p.ddi);
          if (!f) { bad++; return; }
          set(ctx, r, i, f);
        });
      });
      if (bad) ctx.rep.warn.push(bad + ' telefone(s) sem DDD ou com dígitos a mais; ficaram como estavam.');
    },
    validate: function (ctx, p) {
      var i = one(ctx, p.col);
      if (i < 0) return;
      var kind = p.kind || 'email', action = p.action || 'mark', bad = 0;
      function check(v) {
        if (isEmpty(v)) return { empty: true };
        if (kind === 'email') return { ok: EMAIL.test(S(v).trim()), f: S(v).trim() };
        var d = S(v).replace(/\D/g, '');
        var asCpf = kind === 'cpf' || (kind === 'doc' && d.length <= 11);
        if (asCpf) {
          if (d.length >= 8 && d.length < 11) d = ('00000000000' + d).slice(-11);
          return cpfOk(d) ? { ok: true, f: fmtCpf(d) } : { ok: false };
        }
        if (d.length >= 12 && d.length < 14) d = ('00000000000000' + d).slice(-14);
        return cnpjOk(d) ? { ok: true, f: fmtCnpj(d) } : { ok: false };
      }
      if (action === 'remove') drop(ctx, function (r) { var c = check(r.v[i]); return c.empty ? !!p.dropEmpty : !c.ok; });
      var col = action === 'mark' ? addCol(ctx, ctx.headers[i] + ' válido?', i) : -1;
      ctx.rows.forEach(function (r) {
        var c = check(r.v[i]);
        if (!c.empty && !c.ok) bad++;
        if (p.format !== false && c.ok && c.f && kind !== 'email') set(ctx, r, i, c.f);
        if (col >= 0) r.v[col] = c.empty ? 'Vazio' : (c.ok ? 'Sim' : 'Não');
      });
      if (action !== 'remove' && bad) ctx.rep.info.push(bad + ' inválido(s)');
    },
    select: function (ctx, p) {
      var idx = pick(ctx, p.cols, false);
      if (!idx.length) return;
      var keep;
      if (p.mode === 'keep') keep = ctx.headers.map(function (_, i) { return i; }).filter(function (i) { return idx.indexOf(i) >= 0; });
      else keep = ctx.headers.map(function (_, i) { return i; }).filter(function (i) { return idx.indexOf(i) < 0; });
      ctx.rep.cols += ctx.headers.length - keep.length;
      ctx.headers = keep.map(function (i) { return ctx.headers[i]; });
      ctx.rows.forEach(function (r) { r.v = keep.map(function (i) { return r.v[i]; }); });
    },
    rename: function (ctx, p) {
      var i = one(ctx, p.from);
      if (i < 0) return;
      var to = S(p.to).trim();
      if (!to) { ctx.rep.warn.push('Informe o novo nome.'); return; }
      var j = findCol(ctx.headers, to);
      if (j >= 0 && j !== i) { ctx.rep.warn.push('Já existe uma coluna chamada ' + to + '.'); return; }
      var old = ctx.headers[i];
      if (old === to) return;
      ctx.headers[i] = to;
      ctx.rows.forEach(function (r) { if (r.ch[old]) { delete r.ch[old]; r.ch[to] = 1; } });
      ctx.rep.renamed = to;
    },
    sort: function (ctx, p) {
      var i = one(ctx, p.col);
      if (i < 0) return;
      var vals = ctx.rows.map(function (r) { return r.v[i]; }).filter(function (v) { return !isEmpty(v); });
      var nDate = vals.filter(function (v) { return parseDate(v); }).length;
      var nNum = vals.filter(function (v) { return parseNum(v, 'auto') != null; }).length;
      var type = vals.length && nDate >= vals.length * 0.8 && nDate >= nNum ? 'date' : (vals.length && nNum >= vals.length * 0.8 ? 'num' : 'text');
      function keyOf(v) {
        if (isEmpty(v)) return null;
        if (type === 'date') { var d = parseDate(v); return d ? d.y * 10000 + d.m * 100 + d.d : null; }
        if (type === 'num') return parseNum(v, 'auto');
        return K(v);
      }
      var dir = p.dir === 'desc' ? -1 : 1;
      var dec = ctx.rows.map(function (r, n) { return { r: r, k: keyOf(r.v[i]), n: n }; });
      dec.sort(function (a, b) {
        if (a.k == null && b.k == null) return a.n - b.n;
        if (a.k == null) return 1;
        if (b.k == null) return -1;
        var c = type === 'text' ? a.k.localeCompare(b.k, 'pt-BR', { numeric: true }) : a.k - b.k;
        return c ? c * dir : a.n - b.n;
      });
      ctx.rows = dec.map(function (x) { return x.r; });
      ctx.rep.info.push('ordenado como ' + (type === 'date' ? 'data' : type === 'num' ? 'número' : 'texto'));
    }
  };

  function run(input, steps) {
    var headers = input.headers.map(function (h) { return S(h).trim(); });
    var rows = input.rows.map(function (r, o) { return { v: headers.map(function (_, i) { return S(r[i]); }), o: o, ch: dict() }; });
    var removed = dict(), report = [], headersAt = [];
    (steps || []).forEach(function (st, si) {
      headersAt.push(headers.slice());
      if (!st || st.on === false) { report.push({ skip: true }); return; }
      var fn = STEPS[st.type];
      var rep = { changed: 0, removed: 0, added: 0, cols: 0, warn: [], info: [] };
      if (!fn) { rep.warn.push('Etapa desconhecida: ' + st.type); report.push(rep); return; }
      var ctx = { headers: headers, rows: rows, removed: removed, si: si, rep: rep };
      try { fn(ctx, st.p || {}); } catch (e) { rep.warn.push('Erro nesta etapa: ' + (e && e.message ? e.message : e)); }
      headers = ctx.headers; rows = ctx.rows;
      report.push(rep);
    });
    return { headers: headers, rows: rows, removed: removed, report: report, headersAt: headersAt };
  }
  function toGrid(res) { return { headers: res.headers.slice(), rows: res.rows.map(function (r) { return r.v.slice(); }) }; }

  return { run: run, toGrid: toGrid, parseNum: parseNum, parseDate: parseDate, fmtPhone: fmtPhone, cpfOk: cpfOk, cnpjOk: cnpjOk, titleCase: titleCase, STEP_TYPES: Object.keys(STEPS) };
}
