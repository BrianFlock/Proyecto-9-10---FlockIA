'use client';

import { useEffect, useMemo, useState } from 'react';
import { MONTHS_ES, LIGHT, RESULT_LABEL, activeSeries, chartSVG, kpis, lastMonth } from '@/lib/report';

const EMPTY_FORM = { chg: '', project: '', team: 'CX', date: '', type: 'planned', result: 'successful', notes: '' };
const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

async function api(url, opts) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (res.status === 204) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Error inesperado.');
  return body;
}

export default function Page() {
  const [all, setAll] = useState([]);
  const [storage, setStorage] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [team, setTeam] = useState('');
  const [month, setMonth] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState({ text: '', err: false });
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);

  async function load() {
    try {
      const data = await api('/api/changes');
      setAll(data.changes);
      setStorage(data.storage);
      setLoadError('');
    } catch (e) {
      setLoadError(e.message);
    }
  }

  useEffect(() => {
    setForm((f) => ({ ...f, date: f.date || today() }));
    load();
  }, []);

  const rows = useMemo(
    () => all.filter((r) => Number(r.date.slice(0, 4)) === year && (!team || r.team === team)),
    [all, year, team],
  );
  const years = useMemo(() => {
    const s = new Set([new Date().getFullYear(), year, ...all.map((r) => Number(r.date.slice(0, 4)))]);
    return [...s].sort((a, b) => b - a);
  }, [all, year]);
  const teams = useMemo(() => [...new Set(all.map((r) => r.team).filter(Boolean))].sort(), [all]);
  const svg = useMemo(() => chartSVG(rows, year), [rows, year]);
  const series = activeSeries(rows);
  const lastM = lastMonth(rows, year);
  const list = rows
    .filter((r) => month === '' || Number(r.date.slice(5, 7)) - 1 === Number(month))
    .sort((a, b) => b.date.localeCompare(a.date) || String(b.chg).localeCompare(String(a.chg)));

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function resetForm() {
    setEditing(null);
    setForm((f) => ({ ...EMPTY_FORM, team: f.team || 'CX', date: f.date || today() }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api(`/api/changes/${editing}`, { method: 'PUT', body: JSON.stringify(form) });
        setMsg({ text: 'Cambio actualizado.', err: false });
      } else {
        await api('/api/changes', { method: 'POST', body: JSON.stringify(form) });
        setMsg({ text: `${form.chg} agregado.`, err: false });
      }
      const y = Number(form.date.slice(0, 4));
      if (y && y !== year) { setYear(y); setMonth(''); }
      resetForm();
      await load();
    } catch (err) {
      setMsg({ text: err.message, err: true });
    } finally {
      setSaving(false);
    }
  }

  function startEdit(r) {
    setEditing(r.id);
    setForm({ chg: r.chg, project: r.project, team: r.team || 'CX', date: r.date, type: r.type, result: r.result, notes: r.notes || '' });
    setMsg({ text: '', err: false });
    document.getElementById('f-chg')?.focus();
  }

  async function onDelete(id) {
    if (confirmDel !== id) {
      setConfirmDel(id);
      setTimeout(() => setConfirmDel((c) => (c === id ? null : c)), 3000);
      return;
    }
    setConfirmDel(null);
    try {
      await api(`/api/changes/${id}`, { method: 'DELETE' });
      if (editing === id) resetForm();
      await load();
    } catch (err) {
      setMsg({ text: err.message, err: true });
    }
  }

  function downloadPng() {
    const url = URL.createObjectURL(new Blob([chartSVG(rows, year, LIGHT)], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width * 2;
      c.height = img.height * 2;
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = `changes-per-month-${year}${team ? '-' + team : ''}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }, 'image/png');
    };
    img.src = url;
  }

  return (
    <div className="wrap">
      <header>
        <div>
          <h1>Implemented Changes Tracker</h1>
          <p className="sub">Cargá cada CHG con su proyecto. El gráfico mensual y los totales se actualizan solos.</p>
        </div>
        <div className="tools">
          <label className="lbl" htmlFor="year">Año</label>
          <select id="year" value={year} onChange={(e) => { setYear(Number(e.target.value)); setMonth(''); }}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <label className="lbl" htmlFor="team-filter">Equipo</label>
          <select id="team-filter" value={team} onChange={(e) => setTeam(e.target.value)}>
            <option value="">Todos</option>
            {teams.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button className="ghost" type="button" onClick={downloadPng}>Descargar gráfico (PNG)</button>
        </div>
      </header>

      {storage === 'missing-db' && (
        <p className="banner">
          La app está en Vercel pero no tiene base de datos conectada, así que no puede guardar cambios.
          Conectá una base Postgres (Neon) desde Storage en el proyecto de Vercel y volvé a desplegar.
        </p>
      )}
      {loadError && <p className="banner">{loadError}</p>}

      <section className="panel report" aria-label="Reporte anual">
        <h2>{year} Implemented changes per month</h2>
        <div>
          <p className="intro">Implementation changes done by our team during this year:</p>
          <ul className="kpis">
            {kpis(rows).map(([l, v]) => (
              <li key={l} className={v ? '' : 'zero'}><span>{l}:</span><b>{v}</b></li>
            ))}
          </ul>
        </div>
        <div>
          <div className="chart" dangerouslySetInnerHTML={{ __html: svg }} />
          <div className="legend">
            {series.map((s) => (
              <span key={s.key}><i style={{ background: `var(${s.c})` }} />{s.label}</span>
            ))}
          </div>
        </div>
      </section>

      <div className="cols">
        <section className="panel">
          <h3>{editing ? `Editar ${form.chg}` : 'Nuevo cambio'}</h3>
          <form onSubmit={onSubmit} autoComplete="off">
            <div className="row2">
              <div className="field">
                <label className="lbl" htmlFor="f-chg">N° CHG</label>
                <input id="f-chg" placeholder="CHG0034567" required value={form.chg} onChange={set('chg')} />
              </div>
              <div className="field">
                <label className="lbl" htmlFor="f-team">Equipo</label>
                <input id="f-team" list="teams" required value={form.team} onChange={set('team')} />
                <datalist id="teams">{teams.map((t) => <option key={t} value={t} />)}</datalist>
              </div>
            </div>
            <div className="field">
              <label className="lbl" htmlFor="f-project">Proyecto</label>
              <input id="f-project" placeholder="Nombre del proyecto" required value={form.project} onChange={set('project')} />
            </div>
            <div className="field">
              <label className="lbl" htmlFor="f-date">Fecha de implementación</label>
              <input id="f-date" type="date" required value={form.date} onChange={set('date')} />
            </div>
            <div className="field">
              <span className="lbl">Tipo</span>
              <div className="seg">
                {[['planned', 'Planned'], ['emergency', 'Emergency']].map(([v, l]) => (
                  <span key={v}>
                    <input type="radio" name="type" id={`t-${v}`} value={v} checked={form.type === v} onChange={set('type')} />
                    <label htmlFor={`t-${v}`}>{l}</label>
                  </span>
                ))}
              </div>
            </div>
            <div className="field">
              <span className="lbl">Cierre</span>
              <div className="seg">
                {Object.entries(RESULT_LABEL).map(([v, [l]]) => (
                  <span key={v}>
                    <input type="radio" name="result" id={`r-${v}`} value={v} checked={form.result === v} onChange={set('result')} />
                    <label htmlFor={`r-${v}`}>{l}</label>
                  </span>
                ))}
              </div>
            </div>
            <div className="field">
              <label className="lbl" htmlFor="f-notes">Notas</label>
              <input id="f-notes" placeholder="Opcional" value={form.notes} onChange={set('notes')} />
            </div>
            <div className="formfoot">
              <button type="submit" disabled={saving}>{editing ? 'Guardar cambios' : 'Agregar'}</button>
              {editing && <button type="button" className="ghost" onClick={() => { resetForm(); setMsg({ text: '', err: false }); }}>Cancelar</button>}
              <span className={`msg${msg.err ? ' err' : ''}`}>{msg.text}</span>
            </div>
          </form>
        </section>

        <section className="panel">
          <div className="listhead">
            <h3>Cambios {year} ({list.length})</h3>
            <div className="tools">
              <label className="lbl" htmlFor="month-filter">Mes</label>
              <select id="month-filter" value={month} onChange={(e) => setMonth(e.target.value)}>
                <option value="">Todos</option>
                {MONTHS_ES.slice(0, lastM + 1).map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
            </div>
          </div>
          <div className="tablewrap">
            <table>
              <thead>
                <tr><th>Fecha</th><th>CHG</th><th>Proyecto</th><th>Equipo</th><th>Tipo</th><th>Cierre</th><th></th></tr>
              </thead>
              <tbody>
                {list.map((r) => {
                  const [rl, rc] = RESULT_LABEL[r.result] || ['—', 'p-open'];
                  return (
                    <tr key={r.id}>
                      <td className="mono">{r.date}</td>
                      <td className="mono">{r.chg}</td>
                      <td>{r.project}{r.notes && <div className="status">{r.notes}</div>}</td>
                      <td>{r.team}</td>
                      <td><span className={`pill ${r.type === 'emergency' ? 'p-em' : 'p-open'}`}>{r.type === 'emergency' ? 'Emergency' : 'Planned'}</span></td>
                      <td><span className={`pill ${rc}`}>{rl}</span></td>
                      <td className="actions">
                        <button className="link" onClick={() => startEdit(r)}>Editar</button>
                        <button className={`link del${confirmDel === r.id ? ' confirm' : ''}`} onClick={() => onDelete(r.id)}>
                          {confirmDel === r.id ? '¿Confirmar?' : 'Borrar'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {list.length === 0 && (
            <p className="empty">Todavía no hay cambios cargados para este período. Agregá el primero con el formulario y aparecerá la barra de su mes.</p>
          )}
          <p className="status">
            {storage === 'file' && `${all.length} cambios guardados en data/changes.json (modo local)`}
            {storage === 'postgres' && `${all.length} cambios guardados en la base de datos`}
            {storage === null && !loadError && 'Cargando…'}
          </p>
        </section>
      </div>
    </div>
  );
}
