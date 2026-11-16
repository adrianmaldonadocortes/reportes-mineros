import { useEffect, useMemo, useState } from 'react';
import type { Equipment, FieldServiceRecord } from '../types';
import { deleteFieldServiceRecord, deleteFieldServiceRecordsInRange, listEquipment, listFieldServiceRecords, listFleets, saveEquipment, saveFieldServiceRecord, uid } from '../db';
import { generateFieldServiceDailyPDF } from '../fieldServicePdf';

const dateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const timeKey = (date = new Date()) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
const dateTime = (date: string, time: string) => `${date} ${time}`;
const niceDate = (date: string) => { const [y, m, d] = date.split('-'); return `${d}-${m}-${y}`; };

export default function FieldServicePage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [records, setRecords] = useState<FieldServiceRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState(dateKey());
  const [equipmentId, setEquipmentId] = useState('');
  const [failure, setFailure] = useState('');
  const [reportedTime, setReportedTime] = useState(timeKey());
  const [closing, setClosing] = useState<string | null>(null);
  const [workDone, setWorkDone] = useState('');
  const [deletePeriod, setDeletePeriod] = useState('daily');
  const [rangeStart, setRangeStart] = useState(dateKey());
  const [rangeEnd, setRangeEnd] = useState(dateKey());

  const load = async () => {
    const [eq, history] = await Promise.all([listEquipment(), listFieldServiceRecords()]);
    setEquipment(eq);
    setRecords(history.sort((a, b) => b.createdAt - a.createdAt));
  };
  useEffect(() => { void load(); }, []);
  const openEquipment = useMemo(() => new Set(records.filter(r => r.status === 'open').map(r => r.equipmentId)), [records]);
  const dayRecords = records.filter(record => record.serviceDate === selectedDate);
  const available = equipment.filter(e => e.status !== 'retired' && !openEquipment.has(e.id));

  const createAttention = async (event: React.FormEvent) => {
    event.preventDefault();
    const eq = equipment.find(item => item.id === equipmentId);
    if (!eq || !failure.trim()) return;
    const fleets = await listFleets();
    const now = Date.now();
    const record: FieldServiceRecord = {
      id: uid(), serviceDate: selectedDate, equipmentId: eq.id,
      equipment: { internalNumber: eq.internalNumber, name: eq.name, type: eq.type, brand: eq.brand, model: eq.model, serialNumber: eq.serialNumber, fleetName: fleets.find(f => f.id === eq.fleetId)?.name || '' },
      reportedAt: dateTime(selectedDate, reportedTime), failure: failure.trim(), status: 'open', createdAt: now, updatedAt: now
    };
    await saveFieldServiceRecord(record);
    await saveEquipment({ ...eq, status: 'out_of_service' });
    setFailure(''); setEquipmentId(''); setReportedTime(timeKey());
    await load();
  };

  const deliver = async (record: FieldServiceRecord) => {
    const eq = equipment.find(item => item.id === record.equipmentId);
    const updated = { ...record, status: 'completed' as const, deliveredAt: dateTime(dateKey(), timeKey()), workDone: workDone.trim(), updatedAt: Date.now() };
    await saveFieldServiceRecord(updated);
    if (eq) await saveEquipment({ ...eq, status: 'active' });
    setClosing(null); setWorkDone(''); await load();
  };

  const removeRecord = async (record: FieldServiceRecord) => {
    if (!confirm(`¿Eliminar el registro de ${record.equipment.internalNumber} del ${niceDate(record.serviceDate)}?`)) return;
    await deleteFieldServiceRecord(record.id);
    if (record.status === 'open') {
      const remaining = (await listFieldServiceRecords()).some(r => r.equipmentId === record.equipmentId && r.status === 'open');
      const eq = equipment.find(item => item.id === record.equipmentId);
      if (!remaining && eq?.status === 'out_of_service') await saveEquipment({ ...eq, status: 'active' });
    }
    await load();
  };

  const deletionRange = () => {
    if (deletePeriod === 'custom') return [rangeStart, rangeEnd];
    const date = new Date(`${selectedDate}T12:00:00`);
    if (deletePeriod === 'daily') return [selectedDate, selectedDate];
    if (deletePeriod === 'weekly') {
      const mondayOffset = (date.getDay() + 6) % 7;
      const monday = new Date(date); monday.setDate(date.getDate() - mondayOffset);
      const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
      return [dateKey(monday), dateKey(sunday)];
    }
    return [dateKey(new Date(date.getFullYear(), date.getMonth(), 1)), dateKey(new Date(date.getFullYear(), date.getMonth() + 1, 0))];
  };
  const deleteHistory = async () => {
    const [start, end] = deletionRange();
    if (!start || !end || start > end) { alert('Revisa las fechas del período.'); return; }
    const matching = records.filter(r => r.serviceDate >= start && r.serviceDate <= end);
    if (!matching.length) { alert('No hay registros en ese período.'); return; }
    if (!confirm(`Se eliminarán ${matching.length} registro(s) desde ${niceDate(start)} hasta ${niceDate(end)}. Esta acción no se puede deshacer. ¿Continuar?`)) return;
    const deleted = await deleteFieldServiceRecordsInRange(start, end);
    const remaining = await listFieldServiceRecords();
    for (const id of new Set(deleted.filter(r => r.status === 'open').map(r => r.equipmentId))) {
      const eq = equipment.find(item => item.id === id);
      if (eq?.status === 'out_of_service' && !remaining.some(r => r.equipmentId === id && r.status === 'open')) await saveEquipment({ ...eq, status: 'active' });
    }
    await load();
  };

  return <>
    <div className="equipment-heading"><div><h2 style={{ margin: 0 }}>Atenciones en terreno</h2><div className="helper">Control diario de detenciones, entregas y trabajos realizados.</div></div></div>
    <form className="card" onSubmit={createAttention}>
      <div className="card-title">Registrar detención</div>
      <label className="label">Día de atención</label><input className="input" type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} required />
      <label className="label">Equipo</label><select className="select" value={equipmentId} onChange={e => setEquipmentId(e.target.value)} required>
        <option value="">Seleccionar equipo</option>{available.map(e => <option key={e.id} value={e.id}>{e.internalNumber} · {e.type}{e.fleetId ? ` · ${e.fleetId}` : ''}</option>)}
      </select>
      <label className="label">Hora del aviso</label><input className="input" type="time" value={reportedTime} onChange={e => setReportedTime(e.target.value)} required />
      <label className="label">Falla informada</label><textarea className="textarea" placeholder="Ej.: fuga de enfriamiento de frenos" value={failure} onChange={e => setFailure(e.target.value)} required />
      <div className="helper">Al registrar la atención, el equipo queda como fuera de servicio. Solo puede existir una detención abierta por equipo.</div>
      <button className="btn" style={{ marginTop: 12 }} disabled={!available.length}>Registrar detención</button>
      {!available.length && <div className="helper">No hay equipos disponibles para registrar.</div>}
    </form>

    <section className="card">
      <div className="service-day-heading"><div><div className="card-title">Registro del día</div><div className="helper">{niceDate(selectedDate)} · {dayRecords.length} atención(es)</div></div>
        <button type="button" className="btn ghost small" onClick={() => generateFieldServiceDailyPDF(dayRecords, selectedDate)}>Descargar PDF</button>
      </div>
      <label className="label">Consultar otro día</label><input className="input" type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
      {!dayRecords.length ? <div className="empty">No hay detenciones registradas para este día.</div> : <div className="service-record-list">{dayRecords.map(record => <article className="service-record" key={record.id}>
        <div className="service-record-heading"><div><strong>{record.equipment.internalNumber} · {record.equipment.type}</strong><div className="helper">{record.equipment.fleetName || 'Sin flota'} · Aviso {record.reportedAt.split(' ').slice(-1)[0]}</div></div>
          <span className={`badge ${record.status === 'open' ? 'red' : 'green'}`}>{record.status === 'open' ? 'Detenido' : 'Entregado'}</span></div>
        <p className="service-failure">{record.failure}</p>
        {record.status === 'completed' ? <div className="service-work"><strong>Entrega {record.deliveredAt?.split(' ').slice(-1)[0]}</strong><div>{record.workDone || 'Sin comentario de trabajo.'}</div></div> : closing === record.id ? <div>
          <label className="label">Trabajo realizado / comentario de entrega</label><textarea className="textarea" value={workDone} onChange={e => setWorkDone(e.target.value)} placeholder="Describe brevemente lo realizado" />
          <div className="btn-row" style={{ marginTop: 8 }}><button className="btn small" onClick={() => void deliver(record)}>Registrar entrega</button><button className="btn ghost small" onClick={() => setClosing(null)}>Cancelar</button></div>
        </div> : <button className="btn small" onClick={() => { setClosing(record.id); setWorkDone(''); }}>Entregar equipo</button>}
        <button className="service-delete" onClick={() => void removeRecord(record)}>Eliminar registro</button>
      </article>)}</div>}
    </section>

    <section className="card">
      <div className="card-title">Borrar historial de atenciones</div><div className="helper">El borrado es local a este dispositivo y requiere confirmación.</div>
      <label className="label">Período</label><select className="select" value={deletePeriod} onChange={e => setDeletePeriod(e.target.value)}>
        <option value="daily">Día seleccionado</option><option value="weekly">Semana del día seleccionado</option><option value="monthly">Mes del día seleccionado</option><option value="custom">Personalizado</option>
      </select>
      {deletePeriod === 'custom' && <div className="row"><div><label className="label">Desde</label><input className="input" type="date" value={rangeStart} onChange={e => setRangeStart(e.target.value)} /></div><div><label className="label">Hasta</label><input className="input" type="date" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} /></div></div>}
      <button className="btn danger" style={{ marginTop: 12 }} onClick={() => void deleteHistory()}>Borrar registros del período</button>
    </section>
  </>;
}
