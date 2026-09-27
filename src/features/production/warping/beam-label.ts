/**
 * Beam QR / thermal label (rebuilt from the old Beam Store "Print Thermal Label").
 * The QR is generated in the browser; the label prints in its own small window sized for
 * a thermal label (50 × 75 mm). Label size / printer model: PENDING CONFIRMATION.
 */
import qrcode from "qrcode-generator";
import type { BeamRow } from "@/features/production/warping/warping-types";
import { formatDate, formatNumber } from "@/lib/erp/formatting";

/** Scalable SVG markup for a QR code (library output: paths only, no user text). */
export function qrSvg(payload: string): string {
  const qr = qrcode(0, "M");
  qr.addData(payload);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}

const esc = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Text lines printed under the QR code. */
export function beamLabelLines(beam: BeamRow): [string, string][] {
  return [
    ["Set", beam.setNo],
    ["Type", beam.beamType],
    ["Yarn", `${beam.warpYarnName} ${beam.countDenier}`.trim()],
    ["Ends", String(beam.totalEnds)],
    ["Length", `${formatNumber(beam.lengthMetre, "metres")} m`],
    ["Made", formatDate(beam.date)],
  ];
}

export function printBeamLabel(beam: BeamRow): boolean {
  const win = window.open("", "_blank", "noopener=no,width=420,height=640");
  if (!win) return false;
  const rows = beamLabelLines(beam)
    .map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`)
    .join("");
  win.document.write(`<!doctype html><html><head><meta charset="utf-8">
<title>Beam label ${esc(beam.beamNo)}</title>
<style>
@page{size:50mm 75mm;margin:2mm}
body{margin:0;font-family:system-ui,sans-serif;color:#000}
.label{width:46mm;margin:0 auto;text-align:center}
.qr svg{width:34mm;height:34mm}
h1{font:700 15pt/1.1 ui-monospace,monospace;margin:1mm 0}
table{width:100%;border-collapse:collapse;font-size:7.5pt;text-align:left}
th{font-weight:600;padding:0 1mm 0 0;width:12mm;vertical-align:top}td{padding:0}
</style></head><body><div class="label">
<div class="qr">${qrSvg(beam.qrCode)}</div>
<h1>${esc(beam.beamNo)}</h1><table>${rows}</table></div></body></html>`);
  win.document.close();
  win.focus();
  win.print();
  return true;
}
