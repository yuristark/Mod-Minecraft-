/**
 * Gera CSV seguro contra "CSV/Formula Injection": células que começam com
 * = + - @ TAB ou CR são prefixadas com apóstrofo, para o Excel/Sheets não
 * executarem fórmulas digitadas por visitantes no formulário de orçamento.
 */
export function csvCell(value) {
  if (value === null || value === undefined) return '';
  let s = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[";\n\r,]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(headers, rows) {
  const lines = [headers.map((h) => csvCell(h.label)).join(';')];
  for (const row of rows) {
    lines.push(headers.map((h) => csvCell(typeof h.get === 'function' ? h.get(row) : row[h.key])).join(';'));
  }
  // BOM para o Excel reconhecer UTF-8 (acentos)
  return '﻿' + lines.join('\r\n');
}
