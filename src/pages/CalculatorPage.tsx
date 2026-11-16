import { useEffect, useMemo, useState } from 'react';
import type { Calculation, CalculationRow, Equipment, Fleet, PeriodType } from '../types';
import { listEquipment, listFleets, saveCalculation, uid } from '../db';

type Period = Exclude<PeriodType, 'daily'>;

const pad = (value: number) => String(value).padStart(2, '0');
const dateInput = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

function currentPeriod(period: Period) {
  const now = new Date();
  if (period === 'monthly') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { startDate: dateInput(start), endDate: dateInput(end), days: end.getDate() };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { startDate: dateInput(start), endDate: dateInput(end), days: 7 };
}

export default function CalculatorPage() {
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [fleets, setFleets] = useState<Fleet[]>([]);
  const [period, setPeriod] = useState<Period>('weekly');
  const [source, setSource] = useState<'registered' | 'manual'>('registered');
  const [selectedEquipment, setSelectedEquipment] = useState('');
  const [manualFleet, setManualFleet] = useState({ name: '', count: 10, dailyHours: 16 });
  const [stoppedHours, setStoppedHours] = useState(8);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [equipmentList, fleetList] = await Promise.all([listEquipment(), listFleets()]);
      setEquipments(equipmentList.filter(e => e.status === 'active'));
      setFleets(fleetList);
      if (equipmentList.some(e => e.status === 'active')) setSelectedEquipment(equipmentList.find(e => e.status === 'active')!.id);
      else setSource('manual');
    })();
  }, []);

  const equipment = equipments.find(e => e.id === selectedEquipment);
  const equipmentFleet = equipment?.fleetId
    ? equipments.filter(e => e.fleetId === equipment.fleetId)
    : equipment ? [equipment] : [];
  const fleetCount = source === 'manual' ? manualFleet.count : equipmentFleet.length;
  const fleetDailyHours = source === 'manual'
    ? manualFleet.count * manualFleet.dailyHours
    : equipmentFleet.reduce((sum, e) => sum + e.dailyHours, 0);
  const fleetName = source === 'manual'
    ? manualFleet.name.trim() || 'Flota ingresada manualmente'
    : (fleets.find(f => f.id === equipment?.fleetId)?.name || equipment?.name || 'Flota');
  const { startDate, endDate, days } = useMemo(() => currentPeriod(period), [period]);
  const totalProgrammed = fleetDailyHours * days;
  const unavailability = totalProgrammed > 0 ? (stoppedHours / totalProgrammed) * 100 : 0;
  const availability = 100 - unavailability;
  const canCalculate = fleetCount > 0 && fleetDailyHours > 0 && stoppedHours >= 0;

  const rows: CalculationRow[] = canCalculate ? [{
    equipmentId: source === 'manual' ? 'manual-fleet' : equipment?.id || '',
    internalNumber: `${fleetCount} equipos`,
    name: source === 'manual' ? manualFleet.name.trim() || 'Flota manual' : fleetName,
    dailyHours: fleetDailyHours,
    stoppedHours
  }] : [];

  const save = async () => {
    if (!canCalculate) return;
    const calculation: Calculation = {
      id: uid(), type: 'fleet', period, startDate, endDate, days,
      fleetId: source === 'registered' ? equipment?.fleetId : undefined,
      fleetName, rows, totalProgrammed, totalStopped: stoppedHours,
      unavailability, availability, createdAt: Date.now()
    };
    await saveCalculation(calculation);
    setSaved('Cálculo guardado en el historial.');
    setTimeout(() => setSaved(null), 2500);
  };

  return (
    <>
      <h2 style={{ marginTop: 0 }}>Calculadora de indisponibilidad</h2>

      <div className="card">
        <div className="card-title">Período</div>
        <div className="tabs period-tabs">
          <button className={'tab ' + (period === 'weekly' ? 'active' : '')} onClick={() => setPeriod('weekly')}>Semanal · 7 días</button>
          <button className={'tab ' + (period === 'monthly' ? 'active' : '')} onClick={() => setPeriod('monthly')}>Mensual</button>
        </div>
        <div className="helper">{period === 'weekly' ? 'Semana actual: lunes a domingo (7 días).' : `Mes calendario actual (${days} días).`}</div>
        <div className="helper">Se usa la semana actual (lunes a domingo) o el mes calendario actual.</div>
      </div>

      <div className="card">
        <div className="card-title">Flota y equipo detenido</div>
        <label className="label" htmlFor="fleet-source">Datos de la flota</label>
        <select id="fleet-source" className="select" value={source}
          onChange={e => setSource(e.target.value as 'registered' | 'manual')}>
          <option value="registered">Elegir un equipo guardado</option>
          <option value="manual">Ingresar flota manualmente</option>
        </select>

        {source === 'registered' ? <>
          <label className="label" htmlFor="equipment-select">Equipo detenido</label>
          <select id="equipment-select" className="select" value={selectedEquipment} onChange={e => setSelectedEquipment(e.target.value)}>
            <option value="">Seleccionar equipo</option>
            {equipments.map(e => {
              const fleet = fleets.find(f => f.id === e.fleetId);
              return <option key={e.id} value={e.id}>
                {e.internalNumber} · {e.name || e.type}{fleet ? ` · Flota: ${fleet.name}` : ' · Sin flota'}
              </option>;
            })}
          </select>
          {equipment && <div className="helper">
            {equipment.fleetId
              ? `${equipmentFleet.length} equipo(s) en la flota · ${fleetDailyHours} horas programadas por día en total.`
              : 'Este equipo no está asociado a una flota guardada; se calculará como un equipo.'}
          </div>}
        </> : <>
          <label className="label" htmlFor="manual-fleet-name">Nombre o tipo de flota (opcional)</label>
          <input id="manual-fleet-name" className="input" placeholder="Ej.: Bulldozer" value={manualFleet.name}
            onChange={e => setManualFleet(v => ({ ...v, name: e.target.value }))} />
          <div className="row">
            <div>
              <label className="label" htmlFor="manual-fleet-count">Cantidad de equipos</label>
              <input id="manual-fleet-count" className="input" type="number" min="1" step="1" value={manualFleet.count}
                onChange={e => setManualFleet(v => ({ ...v, count: Number(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className="label" htmlFor="manual-fleet-hours">Horas de trabajo por equipo al día</label>
              <input id="manual-fleet-hours" className="input" type="number" min="0.5" step="0.5" value={manualFleet.dailyHours}
                onChange={e => setManualFleet(v => ({ ...v, dailyHours: Number(e.target.value) || 0 }))} />
            </div>
          </div>
          <div className="helper">Ejemplo: 10 equipos × 16 h/día.</div>
        </>}
      </div>

      <div className="card">
        <div className="card-title">Detención</div>
        <label className="label" htmlFor="stopped-hours">Horas detenido un equipo</label>
        <input id="stopped-hours" className="input" type="number" min="0" step="0.5" value={stoppedHours}
          onChange={e => setStoppedHours(Number(e.target.value) || 0)} />
        <div className="helper">Ingresa el total de horas detenido para un equipo durante el período.</div>
      </div>

      {canCalculate && <>
        <div className="result-box">
          <div className="row">
            <div>
              <div className="result-label">Indisponibilidad de la flota</div>
              <div className="result-value bad">{unavailability.toFixed(2)}%</div>
            </div>
            <div>
              <div className="result-label">Disponibilidad</div>
              <div className="result-value good">{availability.toFixed(2)}%</div>
            </div>
          </div>
          <div className="helper" style={{ marginTop: 8 }}>
            {fleetCount} equipos × {source === 'manual' ? manualFleet.dailyHours : equipmentFleet.length ? (fleetDailyHours / fleetCount).toFixed(1) : 0} h/día × {days} días = <strong>{totalProgrammed.toFixed(1)} h programadas</strong>.
            {' '}{stoppedHours} h detenido ÷ {totalProgrammed.toFixed(1)} h = <strong>{unavailability.toFixed(2)}%</strong> de indisponibilidad.
          </div>
        </div>
        <button className="btn" onClick={save}>💾 Guardar cálculo</button>
        {saved && <div className="toast">{saved}</div>}
      </>}
    </>
  );
}
