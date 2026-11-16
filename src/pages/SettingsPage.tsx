import { useEffect, useRef, useState } from 'react';
import { TechnicianInfo, Settings, ShiftSchedule } from '../types';
import { getSettings, saveSettings, exportAll, importAll } from '../db';
import { downloadBlob } from '../utils';

export default function SettingsPage() {
  const [tech, setTech] = useState<TechnicianInfo>({ name: '', position: '', company: '', area: '', shift: '' });
  const [schedule, setSchedule] = useState<ShiftSchedule>({ dayStart: '08:00', dayEnd: '20:00', nightStart: '20:00', nightEnd: '08:00' });
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const s = await getSettings();
      if (s?.technician) setTech(s.technician);
      if (s?.shiftSchedule) setSchedule(s.shiftSchedule);
    })();
  }, []);

  const save = async () => {
    await saveSettings({ key: 'main', technician: tech, shiftSchedule: schedule });
    setMsg('Datos guardados');
    setTimeout(() => setMsg(''), 2000);
  };

  const doExport = async () => {
    const data = await exportAll();
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      `respaldo-reportes-mineros-${new Date().toISOString().slice(0, 10)}.json`);
  };

  const doImport = async (file: File) => {
    if (!confirm('Esto reemplazará TODOS tus datos actuales. ¿Continuar?')) return;
    const text = await file.text();
    const data = JSON.parse(text);
    await importAll(data);
    setMsg('Respaldo restaurado. Recargando…');
    setTimeout(() => location.reload(), 1200);
  };

  return (
    <>
      <h2 style={{ marginTop: 0 }}>Configuración</h2>
      <div className="card">
        <div className="card-title">Datos del técnico</div>
        <div className="helper">Se usan por defecto en todos los informes.</div>
        <label className="label">Nombre</label>
        <input className="input" value={tech.name} onChange={e => setTech({ ...tech, name: e.target.value })} />
        <div className="row">
          <div><label className="label">Cargo</label>
            <input className="input" value={tech.position} onChange={e => setTech({ ...tech, position: e.target.value })} /></div>
          <div><label className="label">Turno</label>
            <input className="input" value={tech.shift} onChange={e => setTech({ ...tech, shift: e.target.value })} /></div>
        </div>
        <div className="row">
          <div><label className="label">Empresa</label>
            <input className="input" value={tech.company} onChange={e => setTech({ ...tech, company: e.target.value })} /></div>
          <div><label className="label">Área</label>
            <input className="input" value={tech.area} onChange={e => setTech({ ...tech, area: e.target.value })} /></div>
        </div>
        <button className="btn" style={{ marginTop: 12 }} onClick={save}>Guardar datos</button>
      </div>

      <div className="card">
        <div className="card-title">Horario de turnos</div>
        <div className="helper">Define el inicio y término de cada turno. Se usa al iniciar una jornada en Atenciones en terreno.</div>
        <div className="row">
          <div><label className="label">Turno A · Día · Inicio</label><input className="input" type="time" value={schedule.dayStart} onChange={e => setSchedule({ ...schedule, dayStart: e.target.value })} /></div>
          <div><label className="label">Término</label><input className="input" type="time" value={schedule.dayEnd} onChange={e => setSchedule({ ...schedule, dayEnd: e.target.value })} /></div>
        </div>
        <div className="row">
          <div><label className="label">Turno B · Noche · Inicio</label><input className="input" type="time" value={schedule.nightStart} onChange={e => setSchedule({ ...schedule, nightStart: e.target.value })} /></div>
          <div><label className="label">Término</label><input className="input" type="time" value={schedule.nightEnd} onChange={e => setSchedule({ ...schedule, nightEnd: e.target.value })} /></div>
        </div>
        <div className="helper">Horario inicial: día 08:00–20:00 · noche 20:00–08:00. Si termina antes de la hora de inicio, se considera el día siguiente.</div>
        <button className="btn" style={{ marginTop: 12 }} onClick={save}>Guardar horarios</button>
      </div>

      <div className="card">
        <div className="card-title">Respaldos</div>
        <div className="helper">Incluye equipos, flotas, informes, fotos, cálculos y configuración.</div>
        <div className="btn-row" style={{ marginTop: 10 }}>
          <button className="btn" onClick={doExport}>⬇ Exportar respaldo</button>
          <button className="btn ghost" onClick={() => fileRef.current?.click()}>⬆ Restaurar respaldo</button>
        </div>
        <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) doImport(f); if (fileRef.current) fileRef.current.value = ''; }} />
      </div>

      {msg && <div className="toast">{msg}</div>}
    </>
  );
}
