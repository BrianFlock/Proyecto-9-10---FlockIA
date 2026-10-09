// Client-side exports: chart as PNG, and an Excel workbook with the report (KPIs, monthly table, chart) and the change list.
import { LIGHT, MONTHS, RESULT_LABEL, activeSeries, chartSVG, kpis, lastMonth } from '@/lib/report';

// Renders the light-theme chart SVG to a 2x PNG.
export function chartPng(rows, year) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([chartSVG(rows, year, LIGHT)], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width * 2;
      c.height = img.height * 2;
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve({ blob: b, width: img.width, height: img.height }) : reject(new Error('No se pudo generar la imagen.'))), 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo generar la imagen.')); };
    img.src = url;
  });
}

export function saveBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3C88' } };
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' } };

function styleHeader(row) {
  row.eachCell((cell) => { cell.fill = HEADER_FILL; cell.font = HEADER_FONT; });
}

// rows: changes of the selected year/team (drive the report); list: rows currently shown in the table.
export async function exportExcel({ rows, list, year, team, monthLabel }) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();

  /* ---- Sheet 1: report ---- */
  const rep = wb.addWorksheet('Reporte', { views: [{ showGridLines: false }] });
  rep.getColumn(1).width = 38;
  rep.getColumn(2).width = 12;

  rep.getCell('A1').value = `${year} Implemented changes per month`;
  rep.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF1F3C88' } };
  rep.getCell('A2').value = `Equipo: ${team || 'Todos'} · Generado: ${new Date().toLocaleString('es-AR')}`;
  rep.getCell('A2').font = { color: { argb: 'FF5B6782' } };

  rep.getCell('A4').value = 'Implementation changes done by our team during this year:';
  rep.getCell('A4').font = { italic: true };
  let r = 5;
  kpis(rows).forEach(([label, value]) => {
    rep.getCell(`A${r}`).value = label;
    rep.getCell(`B${r}`).value = value;
    rep.getCell(`B${r}`).font = { bold: true };
    r += 1;
  });

  // Monthly table: one row per month, one column per active series.
  r += 1;
  const series = activeSeries(rows);
  const nm = lastMonth(rows, year) + 1;
  const head = rep.getRow(r);
  head.values = ['Mes', ...series.map((s) => s.label), 'Total'];
  styleHeader(head);
  series.forEach((_, i) => { rep.getColumn(i + 2).width = Math.max(rep.getColumn(i + 2).width || 0, 16); });
  for (let m = 0; m < nm; m += 1) {
    r += 1;
    const inMonth = rows.filter((x) => Number(x.date.slice(5, 7)) - 1 === m);
    const counts = series.map((s) => inMonth.filter((x) => `${x.result}|${x.type}` === s.key).length);
    rep.getRow(r).values = [MONTHS[m], ...counts, counts.reduce((a, b) => a + b, 0)];
  }

  // Chart image under the tables.
  const png = await chartPng(rows, year);
  const imageId = wb.addImage({ buffer: await png.blob.arrayBuffer(), extension: 'png' });
  rep.addImage(imageId, { tl: { col: 0, row: r + 1 }, ext: { width: png.width, height: png.height } });

  /* ---- Sheet 2: change list ---- */
  const ws = wb.addWorksheet('Cambios', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'Fecha', key: 'date', width: 12 },
    { header: 'CHG', key: 'chg', width: 16 },
    { header: 'Proyecto', key: 'project', width: 40 },
    { header: 'Equipo', key: 'team', width: 10 },
    { header: 'Tipo', key: 'type', width: 12 },
    { header: 'Cierre', key: 'result', width: 16 },
    { header: 'Notas', key: 'notes', width: 40 },
  ];
  styleHeader(ws.getRow(1));
  list.forEach((x) => ws.addRow({
    date: x.date,
    chg: x.chg,
    project: x.project,
    team: x.team,
    type: x.type === 'emergency' ? 'Emergency' : 'Planned',
    result: (RESULT_LABEL[x.result] || [x.result])[0],
    notes: x.notes || '',
  }));
  ws.autoFilter = { from: 'A1', to: { row: 1, column: 7 } };

  const buf = await wb.xlsx.writeBuffer();
  const suffix = [year, team, monthLabel].filter(Boolean).join('-');
  saveBlob(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `changes-report-${suffix}.xlsx`,
  );
}
