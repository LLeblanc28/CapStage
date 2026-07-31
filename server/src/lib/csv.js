/** Serialise des lignes en CSV (separateur ';' pour une ouverture directe dans Excel/LibreOffice). */
export function toCsv(rows, columns, separator = ';') {
  const escape = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value).replace(/\r?\n/g, ' ');
    return /[";,]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const header = columns.map((c) => escape(c.label ?? c.key)).join(separator);
  const body = rows.map((row) => columns.map((c) => escape(row[c.key])).join(separator));
  return `﻿${[header, ...body].join('\r\n')}\r\n`;
}

/** Analyse un CSV simple (separateur ; ou ,) avec en-tete sur la premiere ligne. */
export function parseCsv(text) {
  const clean = String(text).replace(/^﻿/, '').trim();
  if (!clean) return [];
  const lines = clean.split(/\r?\n/);
  const separator = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ',';

  const splitLine = (line) => {
    const out = [];
    let current = '';
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (quoted) {
        if (char === '"' && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else if (char === '"') {
          quoted = false;
        } else {
          current += char;
        }
      } else if (char === '"') {
        quoted = true;
      } else if (char === separator) {
        out.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    out.push(current.trim());
    return out;
  };

  const header = splitLine(lines[0]).map((h) =>
    h
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, ''),
  );

  return lines.slice(1).filter((l) => l.trim()).map((line) => {
    const cells = splitLine(line);
    return Object.fromEntries(header.map((key, i) => [key, cells[i] ?? '']));
  });
}
