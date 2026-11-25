// Table export helpers with no extra dependencies:
//  - downloadXlsx: builds a real .xlsx (Office Open XML in an uncompressed zip) and downloads it.
//  - printTablePdf: renders a clean A4 landscape report in a hidden frame and opens the print
//    dialog, where the user can print or choose "Save as PDF".

const enc = new TextEncoder();
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------- zip (store only) ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
const crc32 = (buf) => { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

function zip(files) {
  const parts = [], central = [];
  let offset = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  files.forEach(({ name, data }) => {
    const nameBytes = enc.encode(name);
    const bytes = typeof data === 'string' ? enc.encode(data) : data;
    const crc = crc32(bytes);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true);
    local.setUint16(8, 0, true); local.setUint16(10, dosTime, true); local.setUint16(12, dosDate, true);
    local.setUint32(14, crc, true); local.setUint32(18, bytes.length, true); local.setUint32(22, bytes.length, true);
    local.setUint16(26, nameBytes.length, true); local.setUint16(28, 0, true);
    parts.push(new Uint8Array(local.buffer), nameBytes, bytes);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, 0, true); cd.setUint16(12, dosTime, true); cd.setUint16(14, dosDate, true);
    cd.setUint32(16, crc, true); cd.setUint32(20, bytes.length, true); cd.setUint32(24, bytes.length, true);
    cd.setUint16(28, nameBytes.length, true); cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), nameBytes);
    offset += 30 + nameBytes.length + bytes.length;
  });
  const cdSize = central.reduce((s, p) => s + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// ---------- xlsx ----------
const colName = (i) => { let s = ''; i += 1; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };

/**
 * @param {string} filename  e.g. 'expiry.xlsx'
 * @param {{ title?: string, subtitle?: string, sheet?: string, headers: string[], rows: (string|number)[][] }} opts
 */
export function downloadXlsx(filename, { title, subtitle, sheet = 'Sheet1', headers, rows }) {
  const xmlRows = [];
  let r = 1;
  const cell = (c, v, s) => {
    const ref = colName(c) + r;
    if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}" s="${s}"><v>${v}</v></c>`;
    return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
  };
  const merges = [];
  if (title) { xmlRows.push(`<row r="${r}" ht="22" customHeight="1">${cell(0, title, 3)}</row>`); merges.push(`A${r}:${colName(headers.length - 1)}${r}`); r++; }
  if (subtitle) { xmlRows.push(`<row r="${r}">${cell(0, subtitle, 4)}</row>`); merges.push(`A${r}:${colName(headers.length - 1)}${r}`); r++; }
  if (title || subtitle) r++;
  const headerRow = r;
  xmlRows.push(`<row r="${r}">${headers.map((h, i) => cell(i, h, 1)).join('')}</row>`); r++;
  rows.forEach((row) => { xmlRows.push(`<row r="${r}">${row.map((v, i) => cell(i, v, 2)).join('')}</row>`); r++; });

  const widths = headers.map((h, i) => Math.min(60, Math.max(String(h).length, ...rows.map((row) => String(row[i] ?? '').length)) + 3));
  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="${headerRow}" topLeftCell="A${headerRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>
<sheetData>${xmlRows.join('')}</sheetData>
${rows.length ? `<autoFilter ref="A${headerRow}:${colName(headers.length - 1)}${headerRow + rows.length}"/>` : ''}
${merges.length ? `<mergeCells count="${merges.length}">${merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : ''}
<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>
<pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/>
</worksheet>`;
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font><font><i/><sz val="10"/><color rgb="FF555555"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F5132"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFBBBBBB"/></left><right style="thin"><color rgb="FFBBBBBB"/></right><top style="thin"><color rgb="FFBBBBBB"/></top><bottom style="thin"><color rgb="FFBBBBBB"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
  const safeSheet = esc(sheet.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));
  const blob = zip([
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
    { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${safeSheet}" sheetId="1" r:id="rId1"/></sheets>${rows.length ? `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${safeSheet}'!$A$${headerRow}:$${colName(headers.length - 1)}$${headerRow + rows.length}</definedName></definedNames>` : ''}</workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: 'xl/worksheets/sheet1.xml', data: sheetXml },
    { name: 'xl/styles.xml', data: stylesXml },
  ]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const fileStamp = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const WIN_LABEL = { 0: 'Expired', 30: 'Expired or expiring within 30 days', 60: 'Expired or expiring within 60 days', 90: 'Expired or expiring within 90 days', 180: 'Expired or expiring within 6 months' };
export const REPORT_COMPANY = 'Adroit Building Material Trading Enterprises';
// Colours the status column in the PDF according to its text.
export const statusHighlight = (col) => (row) => {
  const s = String(row[col] || '');
  const cls = s.startsWith('Expired') ? 'expired' : s.startsWith('Urgent') ? 'critical' : s.startsWith('Renewal due') || /no scan|not recorded/i.test(s) ? 'due' : '';
  return cls ? { [col]: cls } : undefined;
};

/** One call that wires both buttons: returns { excel(), pdf() } for a given report. */
export const reportExporter = ({ name, title, subtitle, sheet, headers, rows, statusCol, by }) => ({
  excel: () => downloadXlsx(`${name}-${fileStamp()}.xlsx`, { title, subtitle, sheet, headers, rows }),
  pdf: () => printTablePdf({ docTitle: `${name}-${fileStamp()}`, company: REPORT_COMPANY, title, subtitle, headers, rows,
    highlight: statusCol != null ? statusHighlight(statusCol) : undefined, footer: by ? `Printed by ${by} on ${new Date().toLocaleDateString('en-GB')}` : '' }),
});

// ---------- PDF (via print dialog) ----------
/**
 * @param {{ docTitle: string, company?: string, title: string, subtitle?: string, headers: string[], rows: (string|number)[][], highlight?: (row) => string|undefined, footer?: string }} opts
 */
export function printTablePdf({ docTitle, company, title, subtitle, headers, rows, highlight, footer }) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(docTitle)}</title>
<style>
  @page { size: A4 landscape; margin: 12mm 10mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; margin: 0; font-size: 10.5px; }
  .head { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 10px; }
  .head h1 { margin: 0 0 2px; font-size: 16px; text-transform: uppercase; letter-spacing: .02em; }
  .head h2 { margin: 6px 0 2px; font-size: 13px; text-transform: uppercase; text-decoration: underline; }
  .head p { margin: 2px 0; font-size: 11px; color: #333; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  th, td { border: 1px solid #999; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { background: #e8efe9; font-size: 10px; text-transform: uppercase; }
  td.n { text-align: center; width: 26px; }
  tr:nth-child(even) td { background: #fafafa; }
  .expired { color: #b91c1c; font-weight: bold; }
  .critical { color: #c2410c; font-weight: bold; }
  .due { color: #a16207; font-weight: bold; }
  .foot { margin-top: 10px; font-size: 10.5px; display: flex; justify-content: space-between; }
  .sign { display: flex; justify-content: space-between; margin-top: 50px; }
  .sign div { width: 30%; text-align: center; border-top: 1px solid #000; padding-top: 4px; font-weight: bold; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
</style></head><body>
<div class="head">${company ? `<h1>${esc(company)}</h1>` : ''}<h2>${esc(title)}</h2>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div>
<table><thead><tr><th>#</th>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
<tbody>${rows.length ? rows.map((row, i) => { const hl = highlight?.(row); return `<tr><td class="n">${i + 1}</td>${row.map((v, j) => `<td${hl && hl[j] ? ` class="${hl[j]}"` : ''}>${esc(v)}</td>`).join('')}</tr>`; }).join('') : `<tr><td colspan="${headers.length + 1}" style="text-align:center;padding:20px">No records.</td></tr>`}</tbody></table>
<div class="foot"><span>${esc(footer || '')}</span><span>Total records: ${rows.length}</span></div>
<div class="sign"><div>Prepared By</div><div>Verified By</div><div>Approved By</div></div>
</body></html>`;
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(frame);
  const doc = frame.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  // The parent page title becomes the default PDF file name in some browsers; the frame title is used in others.
  const prevTitle = document.title;
  document.title = docTitle;
  setTimeout(() => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => { document.title = prevTitle; frame.remove(); }, 1000);
  }, 250);
}
