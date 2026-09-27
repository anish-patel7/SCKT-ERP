/** Browser-side CSV export and printable view. No server PDF generation. */

export type ExportColumn = { header: string; align?: "left" | "right" };
export type ExportTable = { columns: ExportColumn[]; rows: string[][] };

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv({ columns, rows }: ExportTable): string {
  return [columns.map((c) => csvCell(c.header)), ...rows.map((r) => r.map(csvCell))]
    .map((line) => line.join(","))
    .join("\r\n");
}

export function downloadCsv(filename: string, table: ExportTable): void {
  // BOM so Excel opens UTF-8 (₹, names) correctly.
  const blob = new Blob(["﻿" + toCsv(table)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type PrintSection = {
  heading: string;
  /** Label / value pairs shown as a two-column list. */
  fields?: [string, string][];
  table?: ExportTable;
  note?: string;
};

function tableHtml(table: ExportTable): string {
  const head = table.columns
    .map((c) => `<th style="text-align:${c.align ?? "left"}">${escapeHtml(c.header)}</th>`)
    .join("");
  const body = table.rows
    .map(
      (r) =>
        `<tr>${r
          .map(
            (cell, i) =>
              `<td style="text-align:${table.columns[i]?.align ?? "left"}">${escapeHtml(cell)}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

/** Printable single-record document (header fields, sections and line tables). */
export function printSections(title: string, subtitle: string, sections: PrintSection[]): boolean {
  const win = window.open("", "_blank", "noopener=no,width=1100,height=800");
  if (!win) return false;
  const html = sections
    .map((s) => {
      const fields = s.fields?.length
        ? `<dl>${s.fields
            .map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v || "—")}</dd></div>`)
            .join("")}</dl>`
        : "";
      const table = s.table && s.table.rows.length ? tableHtml(s.table) : "";
      const note = s.note ? `<p class="note">${escapeHtml(s.note)}</p>` : "";
      return `<section><h2>${escapeHtml(s.heading)}</h2>${fields}${table}${note}</section>`;
    })
    .join("");
  win.document
    .write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
body{font-family:system-ui,sans-serif;font-size:11px;margin:16px;color:#111}
h1{font-size:15px;margin:0 0 2px}p{margin:0 0 10px;color:#555}
h2{font-size:12px;margin:14px 0 4px;border-bottom:1px solid #999;padding-bottom:2px}
dl{display:grid;grid-template-columns:repeat(3,1fr);gap:2px 16px;margin:0 0 6px}
dl div{display:flex;gap:6px}dt{color:#555;min-width:110px}dd{margin:0;font-weight:600}
table{border-collapse:collapse;width:100%;margin-top:4px}th,td{border:1px solid #bbb;padding:3px 5px;white-space:nowrap}
th{background:#eee}.note{font-style:italic;margin-top:4px}section{break-inside:avoid}
@page{size:landscape;margin:10mm}
</style></head><body><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p>${html}</body></html>`);
  win.document.close();
  win.focus();
  win.print();
  return true;
}

/** Open a minimal printable document in a new window and invoke the print dialog. */
export function printTable(title: string, subtitle: string, table: ExportTable): boolean {
  const win = window.open("", "_blank", "noopener=no,width=1100,height=800");
  if (!win) return false;
  const head = table.columns
    .map((c) => `<th style="text-align:${c.align ?? "left"}">${escapeHtml(c.header)}</th>`)
    .join("");
  const body = table.rows
    .map(
      (r) =>
        `<tr>${r
          .map(
            (cell, i) =>
              `<td style="text-align:${table.columns[i]?.align ?? "left"}">${escapeHtml(cell)}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");
  win.document
    .write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
body{font-family:system-ui,sans-serif;font-size:11px;margin:16px;color:#111}
h1{font-size:15px;margin:0 0 2px}p{margin:0 0 10px;color:#555}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:3px 5px;white-space:nowrap}
th{background:#eee}@page{size:landscape;margin:10mm}
</style></head><body><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`);
  win.document.close();
  win.focus();
  win.print();
  return true;
}
