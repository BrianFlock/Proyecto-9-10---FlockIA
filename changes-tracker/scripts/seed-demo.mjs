// Loads demo data through the API (works locally and against a deployed URL).
//   node scripts/seed-demo.mjs                      → loads demo data into http://localhost:3000
//   node scripts/seed-demo.mjs https://mi-app.vercel.app
//   node scripts/seed-demo.mjs --clear [url]        → deletes only the demo records
// Demo records are tagged with DEMO_TAG in their notes, so real records are never touched.

const DEMO_TAG = '[demo]';
const args = process.argv.slice(2);
const clear = args.includes('--clear');
const base = (args.find((a) => a.startsWith('http')) || 'http://localhost:3000').replace(/\/$/, '');
const YEAR = 2026;

// Deterministic pseudo-random generator so every run produces the same dataset.
let seed = 20260101;
const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const PROJECTS = {
  CX: [
    'Portal de autogestión clientes', 'Chatbot de atención WhatsApp', 'Encuesta NPS post-contacto',
    'Integración CRM - Contact Center', 'Rediseño app mobile', 'Notificaciones push de reclamos',
    'Tablero de SLA de atención', 'Migración IVR a la nube', 'Login con biometría',
    'Formulario de alta online', 'Historial de casos unificado', 'Asistente virtual web',
  ],
  Data: ['Data lake de interacciones', 'Modelo de churn', 'Pipeline de facturación', 'Reportes de ventas diarios'],
  Infra: ['Upgrade cluster Kubernetes', 'Rotación de certificados', 'Parcheo de servidores', 'Backup de bases críticas'],
};
const NOTES = ['', '', '', '', 'Ventana nocturna', 'Requiere validación de negocio', 'Coordinado con proveedor', 'Sin impacto en usuarios'];

// [month (1-12), team, type, result, count]
// Jan–Mar CX matches the original slide: Jan 12, Feb 11, Mar 14 + 1 emergency + 1 rollback.
const PLAN = [
  [1, 'CX', 'planned', 'successful', 12],
  [2, 'CX', 'planned', 'successful', 11],
  [3, 'CX', 'planned', 'successful', 14],
  [3, 'CX', 'emergency', 'successful', 1],
  [3, 'CX', 'planned', 'rollback', 1],
  [4, 'CX', 'planned', 'successful', 9],
  [4, 'CX', 'emergency', 'successful', 2],
  [5, 'CX', 'planned', 'successful', 13],
  [5, 'CX', 'planned', 'unsuccessful', 1],
  [6, 'CX', 'planned', 'successful', 10],
  [6, 'CX', 'emergency', 'successful', 1],
  [6, 'CX', 'emergency', 'rollback', 1],
  [7, 'CX', 'planned', 'successful', 8],
  [8, 'CX', 'planned', 'successful', 15],
  [8, 'CX', 'planned', 'rollback', 1],
  [9, 'CX', 'planned', 'successful', 12],
  [9, 'CX', 'emergency', 'successful', 1],
  [10, 'CX', 'planned', 'successful', 4],
  [10, 'CX', 'planned', 'open', 3],
  [10, 'CX', 'emergency', 'open', 1],
  // A few changes from other teams, to show the team filter.
  [2, 'Data', 'planned', 'successful', 3],
  [4, 'Data', 'planned', 'successful', 2],
  [7, 'Data', 'planned', 'rollback', 1],
  [9, 'Data', 'planned', 'successful', 3],
  [1, 'Infra', 'planned', 'successful', 2],
  [5, 'Infra', 'emergency', 'successful', 2],
  [8, 'Infra', 'planned', 'successful', 3],
  [10, 'Infra', 'planned', 'open', 1],
];

function workday(month) {
  // A weekday in the month; October stays on or before the 9th (today in the demo).
  const maxDay = month === 10 ? 9 : new Date(YEAR, month, 0).getDate();
  for (;;) {
    const day = 1 + Math.floor(rand() * maxDay);
    const dow = new Date(YEAR, month - 1, day).getDay();
    if (dow !== 0 && dow !== 6) return `${YEAR}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
}

function buildDataset() {
  let chg = 31000;
  const rows = [];
  for (const [month, team, type, result, count] of PLAN) {
    for (let i = 0; i < count; i += 1) {
      const note = pick(NOTES);
      rows.push({
        chg: `CHG00${(chg += 7 + Math.floor(rand() * 40))}`,
        project: pick(PROJECTS[team]),
        team,
        date: workday(month),
        type,
        result,
        notes: `${DEMO_TAG}${note ? ' ' + note : ''}`,
      });
    }
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

async function api(path, opts = {}) {
  const res = await fetch(base + path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok && res.status !== 204) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`${opts.method || 'GET'} ${path} → ${res.status} ${body.error || ''}`);
  }
  return res.status === 204 ? null : res.json();
}

async function main() {
  const { changes } = await api('/api/changes').catch((e) => {
    throw new Error(`No pude conectar con ${base}. ¿Está la app corriendo? (${e.message})`);
  });
  const existingDemo = changes.filter((c) => (c.notes || '').startsWith(DEMO_TAG));

  if (clear || existingDemo.length) {
    for (const c of existingDemo) await api(`/api/changes/${c.id}`, { method: 'DELETE' });
    console.log(`Borrados ${existingDemo.length} registros de demo.`);
    if (clear) return;
  }

  const rows = buildDataset();
  for (const r of rows) await api('/api/changes', { method: 'POST', body: JSON.stringify(r) });
  console.log(`Cargados ${rows.length} registros de demo en ${base}.`);
  console.log(`Registros reales sin tocar: ${changes.length - existingDemo.length}.`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
