import { useEffect, useMemo, useState } from 'react';
import type { Equipment, EquipmentStatus, Fleet } from '../types';
import { listEquipment, listFleets, saveEquipment, deleteEquipment, uid } from '../db';

const TYPES = ['Bulldozer', 'Wheeldozer', 'Excavadora', 'Cargador frontal', 'CAEX', 'Motoniveladora', 'Camión', 'Otro'];
const numericOrder = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

function statusLabel(status: EquipmentStatus) {
  if (status === 'active') return 'Operativo';
  if (status === 'maintenance') return 'Mantenimiento';
  if (status === 'retired') return 'Dado de baja';
  return 'Fuera de servicio';
}

function statusClass(status: EquipmentStatus) {
  if (status === 'active') return 'equipment-status-active';
  if (status === 'maintenance') return 'equipment-status-maintenance';
  if (status === 'retired') return 'equipment-status-retired';
  return 'equipment-status-out';
}

export default function EquipmentPage() {
  const [list, setList] = useState<Equipment[]>([]);
  const [fleets, setFleets] = useState<Fleet[]>([]);
  const [selected, setSelected] = useState<Equipment | null>(null);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [q, setQ] = useState('');
  const [fleetFilter, setFleetFilter] = useState('all');

  const load = async () => {
    const [equipment, fleetList] = await Promise.all([listEquipment(), listFleets()]);
    setList(equipment);
    setFleets(fleetList);
    return equipment;
  };
  useEffect(() => { load(); }, []);

  const blank = (): Equipment => ({
    id: uid(), internalNumber: '', name: '', type: TYPES[0], brand: '', model: '',
    serialNumber: '', area: '', fleetId: '', dailyHours: 24, status: 'active', createdAt: Date.now()
  });

  const filtered = useMemo(() => list
    .filter(e => fleetFilter === 'all' || e.fleetId === fleetFilter)
    .filter(e => {
      const search = q.trim().toLocaleLowerCase('es');
      const fleetName = fleets.find(f => f.id === e.fleetId)?.name || '';
      return !search || [e.internalNumber, e.name, e.model, e.serialNumber, e.type, e.brand, fleetName]
        .join(' ').toLocaleLowerCase('es').includes(search);
    })
    .sort((a, b) => numericOrder.compare(a.type, b.type)
      || numericOrder.compare(a.internalNumber, b.internalNumber)
      || a.createdAt - b.createdAt),
  [list, fleets, q, fleetFilter]);

  const openNew = () => { setSelected(null); setEditing(blank()); setShowForm(true); };
  const openEdit = () => {
    if (!selected) return;
    setEditing({ ...selected, status: selected.status === 'inactive' ? 'out_of_service' : selected.status });
    setShowForm(true);
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.internalNumber.trim()) { alert('N° interno requerido'); return; }
    const updated = { ...editing, internalNumber: editing.internalNumber.trim() };
    await saveEquipment(updated);
    await load();
    setSelected(updated);
    setShowForm(false);
    setEditing(null);
  };

  const remove = async (equipment: Equipment) => {
    if (!confirm(`¿Eliminar el equipo ${equipment.internalNumber}?`)) return;
    await deleteEquipment(equipment.id);
    if (selected?.id === equipment.id) setSelected(null);
    setShowForm(false);
    await load();
  };

  return (
    <>
      <div className="equipment-heading">
        <h2 style={{ margin: 0 }}>Mis equipos</h2>
        <div className="btn-row">
          <button className="btn ghost small" onClick={() => { window.location.hash = '#/flotas'; }}>Flotas</button>
          <button className="btn orange small" onClick={openNew}>+ Equipo</button>
        </div>
      </div>

      <div className="equipment-filters">
        <input className="input" placeholder="Buscar N°, serie, tipo, marca..." value={q} onChange={e => setQ(e.target.value)} />
        <select className="select" aria-label="Filtrar por flota" value={fleetFilter} onChange={e => setFleetFilter(e.target.value)}>
          <option value="all">Todas las flotas</option>
          <option value="">Sin flota</option>
          {fleets.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>

      {selected && !showForm && <div className="card equipment-details">
        <div className="equipment-details-heading">
          <div>
            <div className="card-title">Ficha del equipo</div>
            <h3>{selected.internalNumber}{selected.name ? ` · ${selected.name}` : ''}</h3>
          </div>
          <span className={`equipment-status ${statusClass(selected.status)}`}>{statusLabel(selected.status)}</span>
        </div>
        <div className="equipment-detail-grid">
          {[
            ['Tipo', selected.type], ['Marca', selected.brand], ['Modelo', selected.model],
            ['N° de serie', selected.serialNumber], ['Flota', fleets.find(f => f.id === selected.fleetId)?.name || 'Sin flota'],
            ['Área / sector', selected.area], ['Horas programadas al día', selected.dailyHours ? `${selected.dailyHours} h` : '']
          ].filter(([, value]) => Boolean(value)).map(([label, value]) => (
            <div key={label}><div className="equipment-detail-label">{label}</div><div>{value}</div></div>
          ))}
        </div>
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="btn" onClick={openEdit}>Editar datos / estado</button>
          <button className="btn ghost" onClick={() => setSelected(null)}>Cerrar ficha</button>
        </div>
      </div>}

      {showForm && editing && <div className="card" style={{ marginTop: 12 }}>
        <div className="card-title">{list.some(x => x.id === editing.id) ? 'Editar equipo' : 'Nuevo equipo'}</div>
        <div className="row">
          <div><label className="label">N° interno</label><input className="input" value={editing.internalNumber} onChange={e => setEditing({ ...editing, internalNumber: e.target.value })} /></div>
          <div><label className="label">Nombre</label><input className="input" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></div>
        </div>
        <div className="row">
          <div><label className="label">Tipo</label><select className="select" value={editing.type} onChange={e => setEditing({ ...editing, type: e.target.value })}>{TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
          <div><label className="label">Estado</label><select className="select" value={editing.status} onChange={e => setEditing({ ...editing, status: e.target.value as EquipmentStatus })}>
            <option value="active">Operativo</option><option value="maintenance">Mantenimiento</option>
            <option value="out_of_service">Fuera de servicio</option><option value="retired">Dado de baja</option>
          </select></div>
        </div>
        <div className="row">
          <div><label className="label">Marca</label><input className="input" value={editing.brand} onChange={e => setEditing({ ...editing, brand: e.target.value })} /></div>
          <div><label className="label">Modelo</label><input className="input" value={editing.model} onChange={e => setEditing({ ...editing, model: e.target.value })} /></div>
        </div>
        <label className="label">N° de serie</label><input className="input" value={editing.serialNumber} onChange={e => setEditing({ ...editing, serialNumber: e.target.value })} />
        <label className="label">Área / sector</label><input className="input" value={editing.area} onChange={e => setEditing({ ...editing, area: e.target.value })} />
        <div className="row">
          <div><label className="label">Flota</label><select className="select" value={editing.fleetId} onChange={e => setEditing({ ...editing, fleetId: e.target.value })}>
            <option value="">Sin flota</option>{fleets.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select></div>
          <div><label className="label">Horas programadas al día</label><input className="input" type="number" min="1" max="24" value={editing.dailyHours}
            onChange={e => setEditing({ ...editing, dailyHours: Number(e.target.value) || 24 })} /></div>
        </div>
        <div className="btn-row" style={{ marginTop: 14 }}>
          <button className="btn" onClick={save}>Guardar</button>
          {list.some(x => x.id === editing.id) && <button className="btn danger" onClick={() => remove(editing)}>Eliminar equipo</button>}
          <button className="btn ghost" onClick={() => { setShowForm(false); setEditing(null); }}>Cancelar</button>
        </div>
      </div>}

      {filtered.length === 0 ? <div className="empty">{list.length ? 'No hay equipos que coincidan con los filtros.' : 'No hay equipos registrados.'}</div> :
        <div className="equipment-list">
          <div className="equipment-list-heading">{filtered.length} equipo(s) · Ordenados por tipo y número interno</div>
          {filtered.map(e => {
            const fleet = fleets.find(f => f.id === e.fleetId);
            return <button key={e.id} className="equipment-item" onClick={() => { setSelected(e); setEditing(null); setShowForm(false); }}>
              <div className="equipment-item-main">
                <div className="equipment-item-title"><strong>{e.internalNumber}</strong><span>{e.type}</span></div>
                <div className="equipment-item-specs">
                  {[e.brand, e.model, fleet?.name].filter(Boolean).join(' · ')}
                  {e.serialNumber && <span className="equipment-serial">Serie: {e.serialNumber}</span>}
                </div>
              </div>
              <span className={`equipment-status ${statusClass(e.status)}`}>{statusLabel(e.status)}</span>
            </button>;
          })}
        </div>}
    </>
  );
}
