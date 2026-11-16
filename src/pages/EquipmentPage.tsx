import { useEffect, useMemo, useState } from 'react';
import { Equipment, Fleet } from '../types';
import { listEquipment, listFleets, saveEquipment, deleteEquipment, uid } from '../db';

const TYPES = ['Bulldozer', 'Wheeldozer', 'Excavadora', 'Cargador frontal', 'CAEX', 'Motoniveladora', 'Camión', 'Otro'];

export default function EquipmentPage() {
  const [list, setList] = useState<Equipment[]>([]);
  const [fleets, setFleets] = useState<Fleet[]>([]);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [q, setQ] = useState('');

  const load = async () => {
    setList(await listEquipment());
    setFleets(await listFleets());
  };
  useEffect(() => { load(); }, []);

  const blank = (): Equipment => ({
    id: uid(), internalNumber: '', name: '', type: TYPES[0], brand: '', model: '',
    serialNumber: '', area: '', fleetId: '', dailyHours: 24, status: 'active',
    createdAt: Date.now()
  });

  const filtered = useMemo(() => list.filter(e => {
    const s = q.toLowerCase();
    return !s || [e.internalNumber, e.name, e.model, e.serialNumber, e.type,
      fleets.find(f => f.id === e.fleetId)?.name || ''].join(' ').toLowerCase().includes(s);
  }), [list, q, fleets]);

  const openNew = () => { setEditing(blank()); setShowForm(true); };
  const openEdit = (e: Equipment) => { setEditing({ ...e }); setShowForm(true); };

  const save = async () => {
    if (!editing) return;
    if (!editing.internalNumber.trim()) { alert('N° interno requerido'); return; }
    await saveEquipment({ ...editing });
    setShowForm(false); setEditing(null); load();
  };

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar este equipo?')) return;
    await deleteEquipment(id); load();
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Mis equipos</h2>
        <div className="btn-row">
          <button className="btn ghost small" onClick={() => window.location.hash = '#/flotas'}>Flotas</button>
          <button className="btn orange small" onClick={openNew}>+ Equipo</button>
        </div>
      </div>
      <input className="input" style={{ marginTop: 12 }} placeholder="Buscar por N°, nombre, modelo, serie..." value={q} onChange={e => setQ(e.target.value)} />

      {showForm && editing && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="card-title">{list.find(x => x.id === editing.id) ? 'Editar equipo' : 'Nuevo equipo'}</div>
          <div className="row">
            <div>
              <label className="label">N° interno</label>
              <input className="input" value={editing.internalNumber} onChange={e => setEditing({ ...editing, internalNumber: e.target.value })} />
            </div>
            <div>
              <label className="label">Nombre</label>
              <input className="input" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
            </div>
          </div>
          <div className="row">
            <div>
              <label className="label">Tipo</label>
              <select className="select" value={editing.type} onChange={e => setEditing({ ...editing, type: e.target.value })}>
                {TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Estado</label>
              <select className="select" value={editing.status} onChange={e => setEditing({ ...editing, status: e.target.value as any })}>
                <option value="active">Activo</option>
                <option value="maintenance">Mantenimiento</option>
                <option value="inactive">Inactivo</option>
              </select>
            </div>
          </div>
          <div className="row">
            <div>
              <label className="label">Marca</label>
              <input className="input" value={editing.brand} onChange={e => setEditing({ ...editing, brand: e.target.value })} />
            </div>
            <div>
              <label className="label">Modelo</label>
              <input className="input" value={editing.model} onChange={e => setEditing({ ...editing, model: e.target.value })} />
            </div>
          </div>
          <label className="label">N° serie</label>
          <input className="input" value={editing.serialNumber} onChange={e => setEditing({ ...editing, serialNumber: e.target.value })} />
          <label className="label">Área / Sector</label>
          <input className="input" value={editing.area} onChange={e => setEditing({ ...editing, area: e.target.value })} />
          <div className="row">
            <div>
              <label className="label">Flota</label>
              <select className="select" value={editing.fleetId} onChange={e => setEditing({ ...editing, fleetId: e.target.value })}>
                <option value="">(sin flota)</option>
                {fleets.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Horas/día</label>
              <input className="input" type="number" min="1" max="24" value={editing.dailyHours}
                onChange={e => setEditing({ ...editing, dailyHours: Number(e.target.value) || 24 })} />
            </div>
          </div>
          <div className="btn-row" style={{ marginTop: 14 }}>
            <button className="btn" onClick={save}>Guardar</button>
            <button className="btn ghost" onClick={() => { setShowForm(false); setEditing(null); }}>Cancelar</button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="empty">No hay equipos registrados.</div>
      ) : (
        <div className="card" style={{ padding: 0, marginTop: 12 }}>
          {filtered.map(e => {
            const fleet = fleets.find(f => f.id === e.fleetId);
            return (
              <div key={e.id} className="list-item" onClick={() => openEdit(e)}>
                <div style={{ flex: 1 }}>
                  <div className="list-item-title">{e.internalNumber} · {e.name || e.type}</div>
                  <div className="list-item-sub">
                    {[e.brand, e.model].filter(Boolean).join(' ')} · {e.dailyHours}h/día
                    {fleet && <> · <span className="badge blue">{fleet.name}</span></>}
                  </div>
                </div>
                <button className="btn ghost small" onClick={(ev) => { ev.stopPropagation(); remove(e.id); }}>×</button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
