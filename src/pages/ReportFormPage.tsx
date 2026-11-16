import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Equipment, Fleet, Failure, Photo, Report, TechnicianInfo } from '../types';
import { listEquipment, listFleets, saveEquipment, saveReport, getReport, getSettings, uid } from '../db';
import { compressImage, toLocalInput } from '../utils';
import { generateReportPDF } from '../pdf';

const blankFailure = (): Failure => ({ id: uid(), description: '', diagnosis: '', work: '', parts: '' });

export default function ReportFormPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const isNew = !id || id === 'nuevo';
  const fileRef = useRef<HTMLInputElement>(null);

  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [fleets, setFleets] = useState<Fleet[]>([]);
  const [showEquipmentSearch, setShowEquipmentSearch] = useState(false);
  const [eqSearch, setEqSearch] = useState('');
  const [manualEquipment, setManualEquipment] = useState(false);

  const [report, setReport] = useState<Report>({
    id: uid(),
    equipmentId: null,
    equipment: { internalNumber: '', name: '', type: '', brand: '', model: '', serialNumber: '', area: '', fleetId: '' },
    stopDate: new Date().toISOString(),
    endDate: new Date().toISOString(),
    motive: '',
    generalDescription: '',
    failures: [blankFailure()],
    photos: [],
    technician: { name: '', position: '', company: '', area: '', shift: '' },
    completed: false,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });

  useEffect(() => {
    (async () => {
      setEquipments(await listEquipment());
      setFleets(await listFleets());
      const s = await getSettings();
      if (s?.technician) setReport(r => ({ ...r, technician: s.technician }));
      if (!isNew && id) {
        const r = await getReport(id);
        if (r) setReport(r);
      }
    })();
  }, [id, isNew]);

  const filteredEquip = useMemo(() => {
    const s = eqSearch.toLowerCase();
    return equipments.filter(e => !s || [e.internalNumber, e.name, e.model, e.serialNumber, e.type].join(' ').toLowerCase().includes(s));
  }, [equipments, eqSearch]);

  const selectEquipment = (e: Equipment) => {
    setReport(r => ({
      ...r, equipmentId: e.id,
      equipment: {
        internalNumber: e.internalNumber, name: e.name, type: e.type, brand: e.brand,
        model: e.model, serialNumber: e.serialNumber, area: e.area, fleetId: e.fleetId
      }
    }));
    setShowEquipmentSearch(false);
    setManualEquipment(false);
  };

  const addFailure = () => setReport(r => ({ ...r, failures: [...r.failures, blankFailure()] }));
  const updateFailure = (i: number, patch: Partial<Failure>) => setReport(r => ({
    ...r, failures: r.failures.map((f, idx) => idx === i ? { ...f, ...patch } : f)
  }));
  const removeFailure = (i: number) => setReport(r => ({ ...r, failures: r.failures.filter((_, idx) => idx !== i) }));

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    const newPhotos: Photo[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      const dataUrl = await compressImage(file);
      newPhotos.push({ id: uid(), dataUrl, description: '' });
    }
    setReport(r => ({ ...r, photos: [...r.photos, ...newPhotos] }));
  };
  const updatePhoto = (i: number, description: string) => setReport(r => ({
    ...r, photos: r.photos.map((p, idx) => idx === i ? { ...p, description } : p)
  }));
  const removePhoto = (i: number) => setReport(r => ({ ...r, photos: r.photos.filter((_, idx) => idx !== i) }));

  const save = async (completed: boolean) => {
    if (!report.equipment.internalNumber.trim()) {
      alert('Falta N° interno del equipo. Selecciona o ingresa datos manualmente.');
      return;
    }
    const saved: Report = { ...report, completed, updatedAt: Date.now() };
    await saveReport(saved);
    // También actualizar/crear el equipo si fue ingresado manual
    if (manualEquipment && !report.equipmentId) {
      const newEq: Equipment = {
        id: uid(),
        internalNumber: report.equipment.internalNumber,
        name: report.equipment.name,
        type: report.equipment.type,
        brand: report.equipment.brand,
        model: report.equipment.model,
        serialNumber: report.equipment.serialNumber,
        area: report.equipment.area,
        fleetId: report.equipment.fleetId,
        dailyHours: 24,
        status: 'active',
        createdAt: Date.now()
      };
      await saveEquipment(newEq);
    }
    setReport(saved);
    if (completed) nav('/informes');
  };

  const tech = report.technician;

  return (
    <>
      <h2 style={{ marginTop: 0 }}>{isNew ? 'Nuevo informe' : 'Editar informe'}</h2>

      {/* EQUIPO */}
      <div className="card">
        <div className="card-title">Equipo</div>
        {!manualEquipment ? (
          <>
            {report.equipmentId ? (
              <div>
                <div style={{ marginBottom: 8 }}>
                  <strong>{report.equipment.internalNumber}</strong> · {report.equipment.name || report.equipment.type}
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {[report.equipment.brand, report.equipment.model].filter(Boolean).join(' ')} · {report.equipment.area}
                  </div>
                </div>
                <button className="btn ghost small" onClick={() => { setReport(r => ({ ...r, equipmentId: null })); setShowEquipmentSearch(true); }}>
                  Cambiar equipo
                </button>
              </div>
            ) : (
              <div className="btn-row">
                <button className="btn" onClick={() => setShowEquipmentSearch(true)}>Seleccionar equipo</button>
                <button className="btn ghost" onClick={() => setManualEquipment(true)}>Ingresar manualmente</button>
              </div>
            )}
            {showEquipmentSearch && (
              <div style={{ marginTop: 12 }}>
                <input className="input" placeholder="Buscar..." value={eqSearch} onChange={e => setEqSearch(e.target.value)} />
                <div style={{ maxHeight: 240, overflowY: 'auto', marginTop: 8 }}>
                  {filteredEquip.map(e => (
                    <div key={e.id} className="list-item" style={{ cursor: 'pointer' }} onClick={() => selectEquipment(e)}>
                      <div>
                        <div className="list-item-title">{e.internalNumber} · {e.name || e.type}</div>
                        <div className="list-item-sub">{[e.brand, e.model].filter(Boolean).join(' ')}</div>
                      </div>
                    </div>
                  ))}
                  {filteredEquip.length === 0 && <div className="empty">Sin resultados</div>}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="row">
              <div>
                <label className="label">N° interno</label>
                <input className="input" value={report.equipment.internalNumber} onChange={e => setReport(r => ({ ...r, equipment: { ...r.equipment, internalNumber: e.target.value } }))} />
              </div>
              <div>
                <label className="label">Nombre</label>
                <input className="input" value={report.equipment.name} onChange={e => setReport(r => ({ ...r, equipment: { ...r.equipment, name: e.target.value } }))} />
              </div>
            </div>
            <div className="row">
              <div><label className="label">Tipo</label>
                <input className="input" value={report.equipment.type} onChange={e => setReport(r => ({ ...r, equipment: { ...r.equipment, type: e.target.value } }))} /></div>
              <div><label className="label">Marca</label>
                <input className="input" value={report.equipment.brand} onChange={e => setReport(r => ({ ...r, equipment: { ...r.equipment, brand: e.target.value } }))} /></div>
            </div>
            <div className="row">
              <div><label className="label">Modelo</label>
                <input className="input" value={report.equipment.model} onChange={e => setReport(r => ({ ...r, equipment: { ...r.equipment, model: e.target.value } }))} /></div>
              <div><label className="label">N° serie</label>
                <input className="input" value={report.equipment.serialNumber} onChange={e => setReport(r => ({ ...r, equipment: { ...r.equipment, serialNumber: e.target.value } }))} /></div>
            </div>
            <label className="label">Área</label>
            <input className="input" value={report.equipment.area} onChange={e => setReport(r => ({ ...r, equipment: { ...r.equipment, area: e.target.value } }))} />
            <label className="label">Flota</label>
            <select className="select" value={report.equipment.fleetId} onChange={e => setReport(r => ({ ...r, equipment: { ...r.equipment, fleetId: e.target.value } }))}>
              <option value="">(sin flota)</option>
              {fleets.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <button className="btn ghost small" style={{ marginTop: 10 }} onClick={() => setManualEquipment(false)}>Volver a buscar registrado</button>
          </>
        )}
      </div>

      {/* DETENCIÓN */}
      <div className="card">
        <div className="card-title">Detención</div>
        <div className="row">
          <div><label className="label">Fecha/hora inicio</label>
            <input className="input" type="datetime-local" value={toLocalInput(report.stopDate)} onChange={e => setReport(r => ({ ...r, stopDate: new Date(e.target.value).toISOString() }))} /></div>
          <div><label className="label">Fecha/hora término</label>
            <input className="input" type="datetime-local" value={toLocalInput(report.endDate)} onChange={e => setReport(r => ({ ...r, endDate: new Date(e.target.value).toISOString() }))} /></div>
        </div>
        <label className="label">Motivo del llamado</label>
        <input className="input" value={report.motive} onChange={e => setReport(r => ({ ...r, motive: e.target.value }))} />
        <label className="label">Descripción general</label>
        <textarea className="textarea" value={report.generalDescription} onChange={e => setReport(r => ({ ...r, generalDescription: e.target.value }))} />
      </div>

      {/* FALLAS */}
      {report.failures.map((f, i) => (
        <div className="card" key={f.id}>
          <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
            Falla {i + 1}
            {report.failures.length > 1 && <button className="btn ghost small" onClick={() => removeFailure(i)}>Quitar</button>}
          </div>
          <label className="label">Descripción de la falla</label>
          <textarea className="textarea" value={f.description} onChange={e => updateFailure(i, { description: e.target.value })} />
          <label className="label">Diagnóstico técnico</label>
          <textarea className="textarea" value={f.diagnosis} onChange={e => updateFailure(i, { diagnosis: e.target.value })} />
          <label className="label">Trabajo realizado</label>
          <textarea className="textarea" value={f.work} onChange={e => updateFailure(i, { work: e.target.value })} />
          <label className="label">Repuestos utilizados (opcional)</label>
          <textarea className="textarea" value={f.parts} onChange={e => updateFailure(i, { parts: e.target.value })} />
        </div>
      ))}
      <button className="btn ghost" onClick={addFailure}>+ Agregar otra falla</button>

      {/* FOTOS */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-title">Fotografías</div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={e => { addPhotos(e.target.files); if (fileRef.current) fileRef.current.value = ''; }}
        />
        <button className="btn ghost" onClick={() => fileRef.current?.click()}>📷 Agregar fotos</button>
        {report.photos.length > 0 && (
          <div className="photo-grid">
            {report.photos.map((p, i) => (
              <div key={p.id} className="photo-item">
                <img src={p.dataUrl} alt="" />
                <input placeholder="Descripción" value={p.description} onChange={e => updatePhoto(i, e.target.value)} />
                <button className="photo-remove" onClick={() => removePhoto(i)}>Quitar</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* TÉCNICO */}
      <div className="card">
        <div className="card-title">Técnico</div>
        <div className="row">
          <div><label className="label">Nombre</label>
            <input className="input" value={tech.name} onChange={e => setReport(r => ({ ...r, technician: { ...r.technician, name: e.target.value } }))} /></div>
          <div><label className="label">Cargo</label>
            <input className="input" value={tech.position} onChange={e => setReport(r => ({ ...r, technician: { ...r.technician, position: e.target.value } }))} /></div>
        </div>
        <div className="row">
          <div><label className="label">Empresa</label>
            <input className="input" value={tech.company} onChange={e => setReport(r => ({ ...r, technician: { ...r.technician, company: e.target.value } }))} /></div>
          <div><label className="label">Área</label>
            <input className="input" value={tech.area} onChange={e => setReport(r => ({ ...r, technician: { ...r.technician, area: e.target.value } }))} /></div>
        </div>
        <label className="label">Turno</label>
        <input className="input" value={tech.shift} onChange={e => setReport(r => ({ ...r, technician: { ...r.technician, shift: e.target.value } }))} />
      </div>

      <div className="btn-row" style={{ marginTop: 12, marginBottom: 30 }}>
        <button className="btn ghost" onClick={() => save(false)}>Guardar borrador</button>
        <button className="btn" onClick={() => save(true)}>Guardar completo</button>
        <button className="btn orange" onClick={() => { save(true); generateReportPDF({ ...report, completed: true, updatedAt: Date.now() }); }}>Guardar + PDF</button>
      </div>
    </>
  );
}
