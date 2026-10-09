// Shared report logic: series, KPIs and the monthly bar chart (as an SVG string).
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export const SERIES = [
  { key: 'successful|planned', label: 'Closure - Successful - Planned', c: '--s1' },
  { key: 'successful|emergency', label: 'Closure - Successful - Emergency', c: '--s2' },
  { key: 'rollback|planned', label: 'Closure - Rollback - Planned', c: '--s3' },
  { key: 'rollback|emergency', label: 'Closure - Rollback - Emergency', c: '--s4' },
  { key: 'unsuccessful|planned', label: 'Closure - Not successful - Planned', c: '--s5' },
  { key: 'unsuccessful|emergency', label: 'Closure - Not successful - Emergency', c: '--s6' },
];

// Fixed light palette for the exported PNG (always white background).
export const LIGHT = {
  '--s1': '#2f4f99', '--s2': '#1f7fc9', '--s3': '#a9bde3', '--s4': '#7cc4c0', '--s5': '#c46b7c', '--s6': '#e3a7b2',
  '--grid': '#e4e8f0', '--muted': '#5b6782', '--fg': '#14213d', '--line': '#dde2ec',
};

export const RESULT_LABEL = {
  successful: ['Successful', 'p-ok'],
  unsuccessful: ['Not successful', 'p-ko'],
  rollback: ['Rollback', 'p-rb'],
  open: ['Abierto', 'p-open'],
};

const monthOf = (r) => Number(r.date.slice(5, 7)) - 1;
const seriesKey = (r) => `${r.result}|${r.type}`;

export function activeSeries(rows) {
  const a = SERIES.filter((s) => rows.some((r) => seriesKey(r) === s.key));
  return a.length ? a : [SERIES[0]];
}

// Index of the last month to draw: the latest month with data, or the current month when the year is empty.
export function lastMonth(rows, year, now = new Date()) {
  let m = -1;
  rows.forEach((r) => { m = Math.max(m, monthOf(r)); });
  if (m >= 0) return m;
  if (year === now.getFullYear()) return now.getMonth();
  return year < now.getFullYear() ? 11 : 0;
}

export function kpis(rows) {
  const n = (f) => rows.filter(f).length;
  const list = [
    ['CHGs open as Planned', n((r) => r.type === 'planned')],
    ['CHGs open as Emergency', n((r) => r.type === 'emergency')],
    ['Implemented closed as Successful', n((r) => r.result === 'successful')],
    ['Implemented closed as not Successful', n((r) => r.result === 'unsuccessful')],
    ['Rollback', n((r) => r.result === 'rollback')],
  ];
  const open = n((r) => r.result === 'open');
  if (open) list.push(['Pendientes de cierre', open]);
  return list;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// pal = null → colors come from CSS variables (follows the theme); pal = LIGHT → standalone image for export.
export function chartSVG(rows, year, pal = null) {
  const col = (n) => (pal ? pal[n] : `var(${n})`);
  const series = activeSeries(rows);
  const nm = lastMonth(rows, year) + 1;
  const counts = MONTHS.slice(0, nm).map((_, i) =>
    series.map((s) => rows.filter((r) => monthOf(r) === i && seriesKey(r) === s.key).length));
  const max = Math.max(1, ...counts.flat());
  const step = max <= 5 ? 1 : max <= 14 ? 2 : max <= 30 ? 5 : Math.ceil(max / 6 / 5) * 5;
  const rounded = Math.ceil(max / step) * step;
  const top = rounded === max ? rounded + step : rounded;

  const W = 640, H = pal ? 300 : 280, L = 38, R = 12, T = 14, B = pal ? 76 : 56;
  const cw = (W - L - R) / nm, ph = H - T - B;
  const y = (v) => T + ph - (v / top) * ph;

  let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Changes per month" font-family="IBM Plex Sans, Segoe UI, sans-serif">`;
  if (pal) s += `<rect width="${W}" height="${H}" fill="#ffffff"/>`;
  for (let v = 0; v <= top; v += step) {
    s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${col('--grid')}" stroke-width="1"/>`;
    s += `<text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="${col('--muted')}">${v}</text>`;
  }
  const gw = Math.min(cw * 0.62, 26 * series.length + 8), bw = gw / series.length;
  counts.forEach((vals, i) => {
    const x0 = L + i * cw + (cw - gw) / 2;
    vals.forEach((v, j) => {
      if (!v) return;
      const x = x0 + j * bw + 1, h = (v / top) * ph;
      s += `<rect x="${x}" y="${y(v)}" width="${bw - 2}" height="${h}" fill="${col(series[j].c)}"><title>${MONTHS[i]} · ${esc(series[j].label)}: ${v}</title></rect>`;
      s += `<text x="${x + (bw - 2) / 2}" y="${y(v) - 4}" text-anchor="middle" font-size="10.5" fill="${col('--fg')}">${v}</text>`;
    });
    s += `<text x="${L + i * cw + cw / 2}" y="${H - B + 18}" text-anchor="middle" font-size="12" fill="${col('--fg')}">${MONTHS[i]}</text>`;
    if (i > 0) s += `<line x1="${L + i * cw}" x2="${L + i * cw}" y1="${H - B}" y2="${H - B + 26}" stroke="${col('--line')}"/>`;
  });
  s += `<line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" stroke="${col('--muted')}" stroke-width="1"/>`;

  if (pal) {
    // Legend inside the exported image, wrapping to a second line if needed.
    let lx = L, ly = H - 30;
    series.forEach((se) => {
      const w = se.label.length * 5.6 + 34;
      if (lx + w > W - R) { lx = L; ly += 18; }
      s += `<rect x="${lx}" y="${ly - 9}" width="10" height="10" fill="${pal[se.c]}"/>`;
      s += `<text x="${lx + 14}" y="${ly}" font-size="11" fill="${pal['--muted']}">${esc(se.label)}</text>`;
      lx += w;
    });
  }
  return s + '</svg>';
}
