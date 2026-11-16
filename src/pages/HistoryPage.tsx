import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Report, Calculation } from '../types';
import { listReports, listCalculations } from '../db';
import { generateReportPDF } from '../pdf';
import { formatDateTime, formatDate } from '../utils';

export default function HistoryPage() {
  const [tab, setTab] = useState<'reports' | 'calcs'>('reports');
  const [reports, setReports] = useState<Report[]>([]);
  const [calcs, setCalcs] = useState<Calculation[]>([]);
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const nav = useNavigate();

  useEffect(() => {
    (async () => {
      setReports((await listReports()).sort((a, b) => b.updatedAt - a.updatedAt));
      setCalcs((await listCalculations()).sort((a, b) => b.createdAt - a.createdAt));
    })();
  }, []);

  const filteredReports = reports.filter(r => {
    if (q && !r.equipment.internalNumber.toLowerCase().includes(q.toLowerCase())
      && !(r.equipment.name || '').toLowerCase().includes(q.toLowerCase())) return false;
    const d = new Date(r.stopDate).getTime();
    if (from && d < new Date(from).getTime()) return false;
    if (to && d > new Date(to).getTime() + 86400000) return false;
    return true;
  });

  const filteredCalcs = calcs.filter(c => {
    if (q) {
      const names = c.rows.map(r => r.internalNumber + ' ' + r.name).join(' ').toLowerCase();
      if (!names.includes(q.toLowerCase()) && !(c.fleetName || '').toLowerCase().includes(q.toLowerCase())) return false;
    }
    const d = new Date(c.startDate).getTime();
    if (from && d < new Date(from).getTime()) return false;
    if (to && d > new Date(to).getTime() + 86400000) return false;
    return true;
  });

  return (
    <>
      <h2 style={{ marginTop: 0 }}>Historial</h2>
      <div className="tabs">
        <button className={'tab ' + (tab === 'reports' ? 'active' : '')} onClick={() => setTab('reports')}>Informes</button>
        <button className={'tab ' + (tab === 'calcs' ? 'active' : '')} onClick={() => setTab('calcs')}>Cálculos</button>
      </div>
      <div className="row" style={{ marginBottom: 10 }}>
        <input className="input" placeholder="Buscar (N°, nombre, flota)" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <div className="row" style={{ marginBottom: 12 }}>
        <input className="input" type="date" value={from} onChange={e => setFrom(e.target.value)} />
        <input className="input" type="date" value={to} onChange={e => setTo(e.target.value)} />
      </div>

      {tab === 'reports' && (
        filteredReports.length === 0 ? <div className="empty">Sin informes.</div> : (
          <div className="card" style={{ padding: 0 }}>
            {filteredReports.map(r => (
              <div key={r.id} className="list-item">
                <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => nav('/informes/' + r.id)}>
                  <div className="list-item-title">
                    {r.equipment.internalNumber} · {r.equipment.name || r.equipment.type}{' '}
                    {r.completed ? <span className="badge green">OK</span> : <span className="badge yellow">Borrador</span>}
                  </div>
                  <div className="list-item-sub">{formatDateTime(r.stopDate)}</div>
                </div>
                <button className="btn ghost small" onClick={() => generateReportPDF(r)}>PDF</button>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'calcs' && (
        filteredCalcs.length === 0 ? <div className="empty">Sin cálculos.</div> : (
          <div className="card" style={{ padding: 0 }}>
            {filteredCalcs.map(c => (
              <div key={c.id} className="list-item">
                <div style={{ flex: 1 }}>
                  <div className="list-item-title">
                    {c.type === 'individual' ? c.rows[0]?.internalNumber : (c.fleetName || 'Flota')}
                    {' '}<span className="badge blue">{c.type === 'individual' ? 'Individual' : 'Flota'}</span>
                  </div>
                  <div className="list-item-sub">
                    {formatDate(c.startDate)} → {formatDate(c.endDate)} ({c.days}d) · Ind: <strong>{c.unavailability.toFixed(2)}%</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </>
  );
}
