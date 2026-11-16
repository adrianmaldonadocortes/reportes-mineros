import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Report } from '../types';
import { listReports, deleteReport } from '../db';
import { generateReportPDF } from '../pdf';
import { formatDateTime } from '../utils';

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const nav = useNavigate();

  const load = async () => setReports((await listReports()).sort((a, b) => b.updatedAt - a.updatedAt));
  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar informe?')) return;
    await deleteReport(id); load();
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Informes técnicos</h2>
        <button className="btn orange small" onClick={() => nav('/informes/nuevo')}>+ Nuevo</button>
      </div>
      {reports.length === 0 ? (
        <div className="empty">Aún no hay informes. Toca "+ Nuevo" para crear el primero.</div>
      ) : (
        <div className="card" style={{ padding: 0, marginTop: 12 }}>
          {reports.map(r => (
            <div key={r.id} className="list-item">
              <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => nav('/informes/' + r.id)}>
                <div className="list-item-title">
                  {r.equipment.internalNumber} · {r.equipment.name || r.equipment.type}{' '}
                  {r.completed ? <span className="badge green">Completo</span> : <span className="badge yellow">Borrador</span>}
                </div>
                <div className="list-item-sub">
                  {formatDateTime(r.stopDate)} · {r.failures.length} falla(s) · {r.photos.length} foto(s)
                </div>
              </div>
              <div className="btn-row">
                <button className="btn ghost small" onClick={() => generateReportPDF(r)}>PDF</button>
                <button className="btn ghost small" onClick={() => remove(r.id)}>×</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
