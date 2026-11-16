import { useEffect, useMemo, useState } from 'react';
import type { Equipment, FieldServiceRecord, ShiftSchedule } from '../types';
import { deleteFieldServiceRecord, deleteFieldServiceRecordsInRange, getSettings, listEquipment, listFieldServiceRecords, listFleets, saveEquipment, saveFieldServiceRecord, uid } from '../db';
import { generateFieldServiceDailyPDF } from '../fieldServicePdf';

type ShiftType = 'A' | 'B';
interface ActiveShift { id: string; type: ShiftType; startDate: string; startTime: string; endAt: string; }
const SHIFT_KEY = 'reportes-mineros-active-shift';
const dateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const timeKey = (date = new Date()) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
const dateTime = (date: string, time: string) => `${date} ${time}`;
const niceDate = (date: string) => { const [y, m, d] = date.split('-'); return `${d}-${m}-${y}`; };
const defaultSchedule: ShiftSchedule = { dayStart: '08:00', dayEnd: '20:00', nightStart: '20:00', nightEnd: '08:00' };
const readShift = (): ActiveShift | null => { try { return JSON.parse(localStorage.getItem(SHIFT_KEY) || 'null'); } catch { return null; } };
function endForShift(startDate: string, startTime: string, endTime: string) {
  const [year, month, day] = startDate.split('-').map(Number);
  const [hours, minutes] = startTime.split(':').map(Number);
  const start = new Date(year, month - 1, day, hours, minutes);
  const [endHours, endMinutes] = endTime.split(':').map(Number);
  const end = new Date(year, month - 1, day, endHours, endMinutes);
  if (end <= start) end.setDate(end.getDate() + 1);
  return `${dateKey(end)} ${timeKey(end)}`;
}
function periodBounds(anchor: string, period: 'weekly' | 'monthly') {
  const date = new Date(`${anchor}T12:00:00`);
  if (period === 'monthly') return [dateKey(new Date(date.getFullYear(), date.getMonth(), 1)), dateKey(new Date(date.getFullYear(), date.getMonth() + 1, 0))];
  const monday = new Date(date); monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  return [dateKey(monday), dateKey(sunday)];
}

export default function FieldServicePage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [records, setRecords] = useState<FieldServiceRecord[]>([]);
  const [schedule, setSchedule] = useState<ShiftSchedule>(defaultSchedule);
  const [shiftType, setShiftType] = useState<ShiftType>('A');
  const [shiftDate, setShiftDate] = useState(dateKey());
  const [shiftStartTime, setShiftStartTime] = useState(defaultSchedule.dayStart);
  const [activeShift, setActiveShift] = useState<ActiveShift | null>(readShift);
  const [viewShiftId, setViewShiftId] = useState('');
  const [equipmentId, setEquipmentId] = useState('');
  const [failure, setFailure] = useState('');
  const [reportedTime, setReportedTime] = useState(timeKey());
  const [closing, setClosing] = useState<string | null>(null);
  const [workDone, setWorkDone] = useState('');
  const [reportAnchor, setReportAnchor] = useState(dateKey());
  const [deletePeriod, setDeletePeriod] = useState('daily');
  const [rangeStart, setRangeStart] = useState(dateKey());
  const [rangeEnd, setRangeEnd] = useState(dateKey());

  const load = async () => {
    const [eq, history, settings] = await Promise.all([listEquipment(), listFieldServiceRecords(), getSettings()]);
    setEquipment(eq);
    setRecords(history.sort((a, b) => b.createdAt - a.createdAt));
    setSchedule(settings?.shiftSchedule || defaultSchedule);
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => { setShiftStartTime(shiftType === 'A' ? schedule.dayStart : schedule.nightStart); }, [shiftType, schedule]);
  useEffect(() => { if (activeShift && !viewShiftId) setViewShiftId(activeShift.id); }, [activeShift, viewShiftId]);

  const shifts = useMemo(() => {
    const map = new Map<string, ActiveShift>();
    for (const record of records) if (record.shiftId && record.shiftType && record.shiftStartDate && record.shiftStartTime && record.shiftEndAt) {
      map.set(record.shiftId, { id: record.shiftId, type: record.shiftType, startDate: record.shiftStartDate, startTime: record.shiftStartTime, endAt: record.shiftEndAt });
    }
    if (activeShift) map.set(activeShift.id, activeShift);
    return [...map.values()].sort((a, b) => b.startDate.localeCompare(a.startDate) || b.startTime.localeCompare(a.startTime));
  }, [records, activeShift]);
  const viewedShift = shifts.find(shift => shift.id === viewShiftId) || activeShift;
  const shiftRecords = viewedShift ? records.filter(record => record.shiftId === viewedShift.id) : [];
  const openEquipment = useMemo(() => new Set(records.filter(record => record.status === 'open').map(record => record.equipmentId)), [records]);
  const available = equipment.filter(item => item.status !== 'retired' && !openEquipment.has(item.id));

  const beginShift = () => {
    const endTime = shiftType === 'A' ? schedule.dayEnd : schedule.nightEnd;
    if (!shiftDate || !shiftStartTime || shiftStartTime === endTime) { alert('Revisa el horario configurado del turno.'); return; }
    const shift = { id: uid(), type: shiftType, startDate: shiftDate, startTime: shiftStartTime, endAt: endForShift(shiftDate, shiftStartTime, endTime) } as ActiveShift;
    localStorage.setItem(SHIFT_KEY, JSON.stringify(shift));
    setActiveShift(shift); setViewShiftId(shift.id);
  };

  const createAttention = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeShift) { alert('Primero inicia el turno A o B.'); return; }
    const eq = equipment.find(item => item.id === equipmentId);
    if (!eq || !failure.trim()) return;
    const fleets = await listFleets();
    const now = new Date();
    const actualDate = dateKey(now);
    const record: FieldServiceRecord = {
      id: uid(), serviceDate: activeShift.startDate, shiftId: activeShift.id, shiftType: activeShift.type,
      shiftStartDate: activeShift.startDate, shiftStartTime: activeShift.startTime, shiftEndAt: activeShift.endAt,
      equipmentId: eq.id,
      equipment: { internalNumber: eq.internalNumber, name: eq.name, type: eq.type, brand: eq.brand, model: eq.model, serialNumber: eq.serialNumber, fleetName: fleets.find(fleet => fleet.id === eq.fleetId)?.name || '' },
      reportedAt: dateTime(actualDate, reportedTime), failure: failure.trim(), status: 'open', createdAt: Date.now(), updatedAt: Date.now()
    };
    await saveFieldServiceRecord(record);
    await saveEquipment({ ...eq, status: 'out_of_service' });
    setFailure(''); setEquipmentId(''); setReportedTime(timeKey()); await load();
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
      const stillOpen = (await listFieldServiceRecords()).some(item => item.equipmentId === record.equipmentId && item.status === 'open');
      const eq = equipment.find(item => item.id === record.equipmentId);
      if (!stillOpen && eq?.status === 'out_of_service') await saveEquipment({ ...eq, status: 'active' });
    }
    await load();
  };

  const downloadShift = () => {
    if (!viewedShift) { alert('Inicia un turno para descargar su registro.'); return; }
    generateFieldServiceDailyPDF(shiftRecords, viewedShift.startDate, `Turno_${viewedShift.type}_${viewedShift.startTime.replace(':', '')}`);
  };
  const downloadRange = (period: 'weekly' | 'monthly') => {
    const [start, end] = periodBounds(reportAnchor, period);
    const matching = records.filter(record => {
      const startDate = record.shiftStartDate || record.serviceDate;
      return startDate >= start && startDate <= end;
    });
    const label = period === 'weekly' ? `Semana_${niceDate(start)}_a_${niceDate(end)}` : `Mes_${reportAnchor.slice(0, 7)}`;
    generateFieldServiceDailyPDF(matching, start, label);
  };

  const deletionRange = () => {
    if (deletePeriod === 'custom') return [rangeStart, rangeEnd];
    if (deletePeriod === 'daily') return [reportAnchor, reportAnchor];
    return periodBounds(reportAnchor, deletePeriod as 'weekly' | 'monthly');
  };
  const deleteHistory = async () => {
    const [start, end] = deletionRange();
    if (!start || !end || start > end) { alert('Revisa las fechas del período.'); return; }
    const matching = records.filter(record => {
      const date = record.shiftStartDate || record.serviceDate;
      return date >= start && date <= end;
    });
    if (!matching.length) { alert('No hay registros en ese período.'); return; }
    if (!confirm(`Se eliminarán ${matching.length} registro(s) desde ${niceDate(start)} hasta ${niceDate(end)}. Esta acción no se puede deshacer. ¿Continuar?`)) return;
    const deleted = await deleteFieldServiceRecordsInRange(start, end);
    const remaining = await listFieldServiceRecords();
    for (const id of new Set(deleted.filter(record => record.status === 'open').map(record => record.equipmentId))) {
      const eq = equipment.find(item => item.id === id);
      if (eq?.status === 'out_of_service' && !remaining.some(record => record.equipmentId === id && record.status === 'open')) await saveEquipment({ ...eq, status: 'active' });
    }
    await load();
  };

  return <>
    <div className="equipment-heading"><div><h2 style={{ margin: 0 }}>Atenciones en terreno</h2><div className="helper">Control de detenciones dentro de turnos de 12 horas.</div></div></div>
    <section className="card">
      <div className="card-title">Inicio de turno</div>
      <div className="row">
        <div><label className="label">Turno</label><select className="select" value={shiftType} onChange={event => setShiftType(event.target.value as ShiftType)}><option value="A">Turno A · Día</option><option value="B">Turno B · Noche</option></select></div>
        <div><label className="label">Fecha de inicio</label><input className="input" type="date" value={shiftDate} onChange={event => setShiftDate(event.target.value)} /></div>
      </div>
      <div className="row"><div><label className="label">Hora de inicio configurada</label><input className="input" type="time" value={shiftStartTime} onChange={event => setShiftStartTime(event.target.value)} /></div>
        <div className="helper shift-schedule-hint">A: {schedule.dayStart}–{schedule.dayEnd} · B: {schedule.nightStart}–{schedule.nightEnd}</div></div>
      <button type="button" className="btn" style={{ marginTop: 12 }} onClick={beginShift}>Iniciar turno</button>
      {activeShift && <div className="active-shift-banner"><strong>Turno {activeShift.type} {activeShift.type === 'A' ? '· Día' : '· Noche'}</strong><span>Inicio {niceDate(activeShift.startDate)} {activeShift.startTime}</span><span>Término {activeShift.endAt}</span></div>}
      <div className="helper">El turno y sus atenciones permanecen juntos aunque cambie la fecha al pasar las 00:00. Configura el horario en Configuración.</div>
    </section>

    <form className="card" onSubmit={createAttention}>
      <div className="card-title">Registrar detención</div>
      <label className="label">Equipo</label><select className="select" value={equipmentId} onChange={event => setEquipmentId(event.target.value)} required>
        <option value="">Seleccionar equipo</option>{available.map(item => <option key={item.id} value={item.id}>{item.internalNumber} · {item.type} · {item.fleetId ? 'En flota' : 'Sin flota'}</option>)}
      </select>
      <label className="label">Hora del aviso</label><input className="input" type="time" value={reportedTime} onChange={event => setReportedTime(event.target.value)} required />
      <label className="label">Falla informada</label><textarea className="textarea" placeholder="Ej.: fuga de enfriamiento de frenos" value={failure} onChange={event => setFailure(event.target.value)} required />
      <div className="helper">La atención se asocia al turno activo, aunque el aviso ocurra después de medianoche. El equipo queda fuera de servicio.</div>
      <button className="btn" style={{ marginTop: 12 }} disabled={!activeShift || !available.length}>Registrar detención</button>
      {!activeShift && <div className="helper">Inicia el turno antes de registrar atenciones.</div>}
      {activeShift && !available.length && <div className="helper">No hay equipos disponibles para registrar.</div>}
    </form>

    <section className="card">
      <div className="service-day-heading"><div><div className="card-title">Atenciones del turno</div><div className="helper">{viewedShift ? `Turno ${viewedShift.type} · Inicio ${niceDate(viewedShift.startDate)} ${viewedShift.startTime} · ${shiftRecords.length} atención(es)` : 'Inicia un turno o selecciona uno con registros.'}</div></div>
        <button type="button" className="btn ghost small" onClick={downloadShift}>PDF del turno</button>
      </div>
      <label className="label">Consultar turno</label><select className="select" value={viewedShift?.id || ''} onChange={event => setViewShiftId(event.target.value)}>
        {!shifts.length && <option value="">Sin turnos registrados</option>}
        {shifts.map(shift => <option key={shift.id} value={shift.id}>Turno {shift.type} · {niceDate(shift.startDate)} · {shift.startTime}</option>)}
      </select>
      {!shiftRecords.length ? <div className="empty">Este turno aún no tiene atenciones registradas.</div> : <div className="service-record-list">{shiftRecords.map(record => <article className="service-record" key={record.id}>
        <div className="service-record-heading"><div><strong>{record.equipment.internalNumber} · {record.equipment.type}</strong><div className="helper">Turno {record.shiftType} · Aviso {record.reportedAt}</div></div>
          <span className={`badge ${record.status === 'open' ? 'red' : 'green'}`}>{record.status === 'open' ? 'Detenido' : 'Entregado'}</span></div>
        <p className="service-failure">{record.failure}</p>
        {record.status === 'completed' ? <div className="service-work"><strong>Entrega {record.deliveredAt}</strong><div>{record.workDone || 'Sin comentario de trabajo.'}</div></div> : closing === record.id ? <div>
          <label className="label">Trabajo realizado / comentario de entrega</label><textarea className="textarea" value={workDone} onChange={event => setWorkDone(event.target.value)} placeholder="Describe brevemente lo realizado" />
          <div className="btn-row" style={{ marginTop: 8 }}><button type="button" className="btn small" onClick={() => void deliver(record)}>Registrar entrega</button><button type="button" className="btn ghost small" onClick={() => setClosing(null)}>Cancelar</button></div>
        </div> : <button type="button" className="btn small" onClick={() => { setClosing(record.id); setWorkDone(''); }}>Entregar equipo</button>}
        <button type="button" className="service-delete" onClick={() => void removeRecord(record)}>Eliminar registro</button>
      </article>)}</div>}
    </section>

    <section className="card">
      <div className="card-title">Descargar historial</div><div className="helper">Los informes semanales y mensuales incluyen las atenciones según la fecha de inicio del turno.</div>
      <label className="label">Fecha de referencia</label><input className="input" type="date" value={reportAnchor} onChange={event => setReportAnchor(event.target.value)} />
      <div className="btn-row" style={{ marginTop: 10 }}><button type="button" className="btn ghost" onClick={() => downloadRange('weekly')}>PDF semanal</button><button type="button" className="btn ghost" onClick={() => downloadRange('monthly')}>PDF mensual</button></div>
    </section>

    <section className="card">
      <div className="card-title">Borrar historial de atenciones</div><div className="helper">El borrado es local a este dispositivo y requiere confirmación.</div>
      <label className="label">Período</label><select className="select" value={deletePeriod} onChange={event => setDeletePeriod(event.target.value)}>
        <option value="daily">Día seleccionado</option><option value="weekly">Semana de la fecha de referencia</option><option value="monthly">Mes de la fecha de referencia</option><option value="custom">Personalizado</option>
      </select>
      {deletePeriod === 'custom' && <div className="row"><div><label className="label">Desde</label><input className="input" type="date" value={rangeStart} onChange={event => setRangeStart(event.target.value)} /></div><div><label className="label">Hasta</label><input className="input" type="date" value={rangeEnd} onChange={event => setRangeEnd(event.target.value)} /></div></div>}
      <button type="button" className="btn danger" style={{ marginTop: 12 }} onClick={() => void deleteHistory()}>Borrar registros del período</button>
    </section>
  </>;
}
