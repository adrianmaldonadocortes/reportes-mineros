import { useEffect, useState } from 'react';
import { Fleet } from '../types';
import { listFleets, saveFleet, deleteFleet, uid } from '../db';

export default function FleetsPage() {
  const [fleets, setFleets] = useState<Fleet[]>([]);
  const [name, setName] = useState('');

  const load = async () => setFleets(await listFleets());
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!name.trim()) return;
    await saveFleet({ id: uid(), name: name.trim(), createdAt: Date.now() });
    setName('');
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar esta flota?')) return;
    await deleteFleet(id);
    load();
  };

  return (
    <>
      <h2 style={{ marginTop: 0 }}>Mis flotas</h2>
      <div className="card">
        <label className="label">Nueva flota</label>
        <div className="row">
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Flota Norte" />
          <button className="btn" style={{ flex: '0 0 auto', width: 'auto' }} onClick={add}>Agregar</button>
        </div>
      </div>
      {fleets.length === 0 ? (
        <div className="empty">No hay flotas registradas.</div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {fleets.map(f => (
            <div key={f.id} className="list-item">
              <div>
                <div className="list-item-title">{f.name}</div>
              </div>
              <button className="btn ghost small" onClick={() => remove(f.id)}>Eliminar</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
