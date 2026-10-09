// Persistence layer.
// - With DATABASE_URL set (Vercel + Neon/Postgres): stores rows in a `changes` table.
// - Without it (local dev): stores everything in data/changes.json.
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const TYPES = ['planned', 'emergency'];
const RESULTS = ['successful', 'unsuccessful', 'rollback', 'open'];

export class ValidationError extends Error {}

export function validate(input) {
  const d = {
    chg: String(input?.chg ?? '').trim(),
    project: String(input?.project ?? '').trim(),
    team: String(input?.team ?? '').trim() || 'CX',
    date: String(input?.date ?? '').trim(),
    type: String(input?.type ?? ''),
    result: String(input?.result ?? ''),
    notes: String(input?.notes ?? '').trim(),
  };
  if (!d.chg) throw new ValidationError('Falta el número de CHG.');
  if (!d.project) throw new ValidationError('Falta el proyecto.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) throw new ValidationError('La fecha debe tener formato AAAA-MM-DD.');
  if (!TYPES.includes(d.type)) throw new ValidationError('Tipo inválido.');
  if (!RESULTS.includes(d.result)) throw new ValidationError('Cierre inválido.');
  if (d.chg.length > 60 || d.project.length > 200 || d.team.length > 60 || d.notes.length > 500) {
    throw new ValidationError('Algún campo es demasiado largo.');
  }
  return d;
}

/* ---------- Postgres ---------- */
let sqlClient;
let tableReady;

async function sql() {
  if (!sqlClient) {
    const { default: postgres } = await import('postgres');
    sqlClient = postgres(process.env.DATABASE_URL, { max: 1 });
  }
  if (!tableReady) {
    tableReady = sqlClient`
      create table if not exists changes (
        id text primary key,
        chg text not null,
        project text not null,
        team text not null default 'CX',
        date text not null,
        type text not null,
        result text not null,
        notes text not null default '',
        created_at bigint not null,
        updated_at bigint
      )`;
  }
  await tableReady;
  return sqlClient;
}

const fromRow = (r) => ({
  id: r.id, chg: r.chg, project: r.project, team: r.team, date: r.date,
  type: r.type, result: r.result, notes: r.notes,
  createdAt: Number(r.created_at), updatedAt: r.updated_at ? Number(r.updated_at) : null,
});

const pg = {
  async list() {
    const s = await sql();
    const rows = await s`select * from changes order by date desc, chg desc`;
    return rows.map(fromRow);
  },
  async create(d) {
    const s = await sql();
    const [row] = await s`
      insert into changes (id, chg, project, team, date, type, result, notes, created_at)
      values (${randomUUID()}, ${d.chg}, ${d.project}, ${d.team}, ${d.date}, ${d.type}, ${d.result}, ${d.notes}, ${Date.now()})
      returning *`;
    return fromRow(row);
  },
  async update(id, d) {
    const s = await sql();
    const [row] = await s`
      update changes set chg=${d.chg}, project=${d.project}, team=${d.team}, date=${d.date},
        type=${d.type}, result=${d.result}, notes=${d.notes}, updated_at=${Date.now()}
      where id=${id} returning *`;
    return row ? fromRow(row) : null;
  },
  async remove(id) {
    const s = await sql();
    const res = await s`delete from changes where id=${id}`;
    return res.count > 0;
  },
};

/* ---------- JSON file (local) ---------- */
const FILE = path.join(process.cwd(), 'data', 'changes.json');

async function readFile() {
  try {
    return JSON.parse(await fs.readFile(FILE, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}
async function writeFile(rows) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(rows, null, 2));
}

const file = {
  async list() {
    const rows = await readFile();
    return rows.sort((a, b) => b.date.localeCompare(a.date) || b.chg.localeCompare(a.chg));
  },
  async create(d) {
    const rows = await readFile();
    const row = { id: randomUUID(), ...d, createdAt: Date.now(), updatedAt: null };
    rows.push(row);
    await writeFile(rows);
    return row;
  },
  async update(id, d) {
    const rows = await readFile();
    const i = rows.findIndex((r) => r.id === id);
    if (i < 0) return null;
    rows[i] = { ...rows[i], ...d, updatedAt: Date.now() };
    await writeFile(rows);
    return rows[i];
  },
  async remove(id) {
    const rows = await readFile();
    const next = rows.filter((r) => r.id !== id);
    if (next.length === rows.length) return false;
    await writeFile(next);
    return true;
  },
};

export const store = process.env.DATABASE_URL ? pg : file;
export const storageKind = process.env.DATABASE_URL ? 'postgres' : 'file';
