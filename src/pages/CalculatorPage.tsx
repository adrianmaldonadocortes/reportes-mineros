import { useEffect, useMemo, useState } from 'react';
import { CalculationRow, Calculation, Equipment, Fleet, PeriodType, CalcType } from '../types';
import { listEquipment, listFleets, saveCalculation, uid } from '../db';
import { daysBetween, toDateInput, formatDate } from '../utils';

export default function CalculatorPage() {
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [fleets, setFleets] = useState<Fleet[]>([]);
  const [type, setType] = useState<CalcType>('individual');
  const [period, setPeriod] = useState<PeriodType>('daily');
  const [startDate, setStartDate] = useState(toDateInput(new Date().toISOString()));
  const [endDate, setEndDate] = useState(toDateInput(new Date().toISOString()));
  const [selectedFleet, setSelectedFleet] = useState<string>('');
  const [selectedEquipment, setSelectedEquipment] = useState<string>('');
  const [individualSource, setIndividualSource] = useState<'registered' | 'fleet' | 'manual'>('registered');
  const [manualEquipment, setManualEquipment] = useState({ internalNumber: '', name: '', dailyHours: 24 });
  const [individualHours, setIndividualHours] = useState<number>(0);
  const [fleetHours, setFleetHours] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setEquipments(await listEquipment());
      setFleets(await listFleets());
    })();
  }, []);

  const applyPeriod = (p: PeriodType) => {
    setPeriod(p);
    const start = new Date(startDate);
    if (p === 'daily') setEndDate(toDateInput(start.toISOString()));
    if (p === 'weekly') { const e = new Date(start); e.setDate(e.getDate() + 6); setEndDate(toDateInput(e.toISOString())); }
    if (p === 'monthly') { const e = new Date(start); e.setDate(e.getDate() + 29); setEndDate(toDateInput(e.toISOString())); }
  };

  const days = useMemo(() => daysBetween(startDate, endDate), [startDate, endDate]);

  const fleetEquipments = useMemo(
    () => equipments.filter(e => e.status === 'active' && e.fleetId === selectedFleet),
    [equipments, selectedFleet]
  );

  const rows: CalculationRow[] = useMemo(() => {
    if (type === 'individual') {
      if (individualSource === 'manual') {
        const internalNumber = manualEquipment.internalNumber.trim() || manualEquipment.name.trim();
        if (!internalNumber || manualEquipment.dailyHours <= 0) return [];
        return [{
          equipmentId: 'manual', internalNumber, name: manualEquipment.name.trim() || 'Equipo manual',
          dailyHours: manualEquipment.dailyHours, stoppedHours: individualHours
        }];
      }
      const eq = equipments.find(e => e.id === selectedEquipment);
      if (!eq) return [];
      return [{
        equipmentId: eq.id, internalNumber: eq.internalNumber, name: eq.name || eq.type,
        dailyHours: eq.dailyHours, stoppedHours: individualHours
      }];
    } else {
      return fleetEquipments.map(e => ({
        equipmentId: e.id, internalNumber: e.internalNumber, name: e.name || e.type,
        dailyHours: e.dailyHours, stoppedHours: fleetHours[e.id] || 0
      }));
    }
  }, [type, individualSource, manualEquipment, selectedEquipment, equipments, individualHours, fleetEquipments, fleetHours]);

  const totalProgrammed = rows.reduce((s, r) => s + r.dailyHours * days, 0);
  const totalStopped = rows.reduce((s, r) => s + r.stoppedHours, 0);
  const unavailability = totalProgrammed > 0 ? (totalStopped / totalProgrammed) * 100 : 0;
  const availability = 100 - unavailability;

  const save = async () => {
    if (!rows.length) { alert('Sin datos para guardar.'); return; }
    const c: Calculation = {
      id: uid(), type, period, startDate, endDate, days,
      fleetId: type === 'fleet' ? selectedFleet : undefined,
      fleetName: type === 'fleet' ? fleets.find(f => f.id === selectedFleet)?.name : undefined,
      rows, totalProgrammed, totalStopped, unavailability, availability,
      createdAt: Date.now()
    };
    await saveCalculation(c);
    setSaved('Cálculo guardado en el historial.');
    setTimeout(() => setSaved(null), 2500);
  };

  return (
    <>
      <h2 style={{ marginTop: 0 }}>Calculadora de indisponibilidad</h2>

      <div className="tabs">
        <button className={'tab ' + (type === 'individual' ? 'active' : '')} onClick={() => setType('individual')}>Individual</button>
        <button className={'tab ' + (type === 'fleet' ? 'active' : '')} onClick={() => setType('fleet')}>Flota</button>
      </div>

      <div className="card">
        <div className="card-title">Período</div>
        <div className="tabs" style={{ marginBottom: 10 }}>
          <button className={'tab ' + (period === 'daily' ? 'active' : '')} onClick={() => applyPeriod('daily')}>Diario</button>
          <button className={'tab ' + (period === 'weekly' ? 'active' : '')} onClick={() => applyPeriod('weekly')}>Semanal</button>
          <button className={'tab ' + (period === 'monthly' ? 'active' : '')} onClick={() => applyPeriod('monthly')}>Mensual</button>
          <button className={'tab ' + (period === 'custom' ? 'active' : '')} onClick={() => applyPeriod('custom')}>Personal.</button>
        </div>
        <div className="row date-row">
          <div><label className="label">Desde</label><input className="input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
          <div><label className="label">Hasta</label><input className="input" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
        </div>
        <div className="helper">Días del período: {days}</div>
      </div>

      {type === 'individual' && (
        <div className="card">
          <div className="card-title">Equipo</div>
          <label className="label" htmlFor="equipment-source">Origen del equipo</label>
          <select id="equipment-source" className="select" value={individualSource}
            onChange={e => { setIndividualSource(e.target.value as typeof individualSource); setSelectedEquipment(''); }}>
            <option value="registered">Equipo guardado</option>
            <option value="fleet">Elegir desde mi flota</option>
            <option value="manual">Ingresar equipo manualmente</option>
          </select>
          {individualSource === 'registered' && (
            <select className="select" style={{ marginTop: 8 }} value={selectedEquipment} onChange={e => setSelectedEquipment(e.target.value)}>
              <option value="">Seleccionar equipo</option>
              {equipments.map(e => <option key={e.id} value={e.id}>{e.internalNumber} · {e.name || e.type} ({e.dailyHours}h/día)</option>)}
            </select>
          )}
          {individualSource === 'fleet' && <>
            <label className="label" htmlFor="individual-fleet">Flota</label>
            <select id="individual-fleet" className="select" value={selectedFleet}
              onChange={e => { setSelectedFleet(e.target.value); setSelectedEquipment(''); }}>
              <option value="">Seleccionar flota</option>
              {fleets.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <label className="label" htmlFor="fleet-equipment">Equipo de la flota</label>
            <select id="fleet-equipment" className="select" value={selectedEquipment} onChange={e => setSelectedEquipment(e.target.value)}>
              <option value="">Seleccionar equipo</option>
              {fleetEquipments.map(e => <option key={e.id} value={e.id}>{e.internalNumber} · {e.name || e.type} ({e.dailyHours}h/día)</option>)}
            </select>
          </>}
          {individualSource === 'manual' && <>
            <label className="label">N° interno (o nombre del equipo)</label>
            <input className="input" value={manualEquipment.internalNumber}
              onChange={e => setManualEquipment(v => ({ ...v, internalNumber: e.target.value }))} />
            <label className="label">Nombre / descripción</label>
            <input className="input" value={manualEquipment.name}
              onChange={e => setManualEquipment(v => ({ ...v, name: e.target.value }))} />
            <label className="label">Horas programadas por día</label>
            <input className="input" type="number" min="0.5" step="0.5" value={manualEquipment.dailyHours}
              onChange={e => setManualEquipment(v => ({ ...v, dailyHours: Number(e.target.value) || 0 }))} />
            {!manualEquipment.internalNumber.trim() && !manualEquipment.name.trim() &&
              <div className="helper">Ingresa un número interno o el nombre del equipo para calcular.</div>}
          </>}
          {(individualSource === 'manual' ? rows.length > 0 : selectedEquipment !== '') && (
            <>
              <label className="label">Horas detenidas (total del período)</label>
              <input className="input" type="number" min="0" step="0.5" value={individualHours}
                onChange={e => setIndividualHours(Number(e.target.value) || 0)} />
              <div className="helper">Ingresa el total UNA vez. No se multiplica por los días.</div>
            </>
          )}
        </div>
      )}

      {type === 'fleet' && (
        <div className="card">
          <div className="card-title">Flota</div>
          <select className="select" value={selectedFleet} onChange={e => { setSelectedFleet(e.target.value); setFleetHours({}); }}>
            <option value="">Seleccionar flota</option>
            {fleets.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          {fleetEquipments.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {fleetEquipments.map(e => (
                <div key={e.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ flex: 1, fontSize: 13 }}>
                    <strong>{e.internalNumber}</strong> {e.name || e.type}
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{e.dailyHours}h/día</div>
                  </div>
                  <input className="input" type="number" min="0" step="0.5" style={{ width: 100 }}
                    placeholder="0 h"
                    value={fleetHours[e.id] || 0}
                    onChange={ev => setFleetHours(h => ({ ...h, [e.id]: Number(ev.target.value) || 0 }))} />
                </div>
              ))}
              <div className="helper">Ingresa el TOTAL de horas detenidas por equipo en todo el período. No multipliques por días.</div>
            </div>
          )}
          {selectedFleet && fleetEquipments.length === 0 && (
            <div className="empty">Esta flota no tiene equipos activos.</div>
          )}
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="result-box">
            <div className="row">
              <div>
                <div className="result-label">Indisponibilidad</div>
                <div className="result-value bad">{unavailability.toFixed(2)}%</div>
              </div>
              <div>
                <div className="result-label">Disponibilidad</div>
                <div className="result-value good">{availability.toFixed(2)}%</div>
              </div>
            </div>
            <div className="helper" style={{ marginTop: 8 }}>
              Programado: <strong>{totalProgrammed.toFixed(1)} h</strong> · Detenido: <strong>{totalStopped.toFixed(1)} h</strong> · {days} día(s)
            </div>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr><th>Equipo</th><th>Prog.</th><th>Det.</th><th>Indiv.</th><th>Aporte</th></tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const prog = r.dailyHours * days;
                  const indiv = prog > 0 ? (r.stoppedHours / prog) * 100 : 0;
                  const aport = totalProgrammed > 0 ? (r.stoppedHours / totalProgrammed) * 100 : 0;
                  return (
                    <tr key={r.equipmentId}>
                      <td><strong>{r.internalNumber}</strong><div style={{ fontSize: 10, color: 'var(--muted)' }}>{r.name}</div></td>
                      <td>{prog.toFixed(0)}h</td>
                      <td>{r.stoppedHours}h</td>
                      <td>{indiv.toFixed(1)}%</td>
                      <td>{aport.toFixed(2)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button className="btn" onClick={save}>💾 Guardar cálculo</button>
          {saved && <div className="toast">{saved}</div>}
        </>
      )}
    </>
  );
}
