import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Fleet, Equipment, Report, Calculation, Settings } from './types';

interface AppDB extends DBSchema {
  fleets: { key: string; value: Fleet };
  equipment: { key: string; value: Equipment };
  reports: { key: string; value: Report };
  calculations: { key: string; value: Calculation };
  settings: { key: string; value: Settings };
}

let dbPromise: Promise<IDBPDatabase<AppDB>> | null = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<AppDB>('reportes-mineros', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('fleets')) db.createObjectStore('fleets', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('equipment')) db.createObjectStore('equipment', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('reports')) db.createObjectStore('reports', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('calculations')) db.createObjectStore('calculations', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
      }
    });
  }
  return dbPromise;
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// Fleets
export async function listFleets(): Promise<Fleet[]> {
  return (await getDB()).getAll('fleets');
}
export async function saveFleet(f: Fleet) { return (await getDB()).put('fleets', f); }
export async function deleteFleet(id: string) { return (await getDB()).delete('fleets', id); }

// Equipment
export async function listEquipment(): Promise<Equipment[]> {
  return (await getDB()).getAll('equipment');
}
export async function saveEquipment(e: Equipment) { return (await getDB()).put('equipment', e); }
export async function deleteEquipment(id: string) { return (await getDB()).delete('equipment', id); }

// Reports
export async function listReports(): Promise<Report[]> {
  return (await getDB()).getAll('reports');
}
export async function saveReport(r: Report) { return (await getDB()).put('reports', r); }
export async function deleteReport(id: string) { return (await getDB()).delete('reports', id); }
export async function getReport(id: string): Promise<Report | undefined> {
  return (await getDB()).get('reports', id);
}

// Calculations
export async function listCalculations(): Promise<Calculation[]> {
  return (await getDB()).getAll('calculations');
}
export async function saveCalculation(c: Calculation) { return (await getDB()).put('calculations', c); }
export async function deleteCalculation(id: string) { return (await getDB()).delete('calculations', id); }

// Settings
export async function getSettings(): Promise<Settings | undefined> {
  return (await getDB()).get('settings', 'main');
}
export async function saveSettings(s: Settings) { return (await getDB()).put('settings', s); }

// Backup / Restore
export async function exportAll() {
  const db = await getDB();
  const [fleets, equipment, reports, calculations, settings] = await Promise.all([
    db.getAll('fleets'), db.getAll('equipment'), db.getAll('reports'),
    db.getAll('calculations'), db.getAll('settings')
  ]);
  return { version: 1, exportedAt: new Date().toISOString(), fleets, equipment, reports, calculations, settings };
}

export async function importAll(data: any) {
  const db = await getDB();
  const tx = db.transaction(['fleets', 'equipment', 'reports', 'calculations', 'settings'], 'readwrite');
  await tx.objectStore('fleets').clear();
  await tx.objectStore('equipment').clear();
  await tx.objectStore('reports').clear();
  await tx.objectStore('calculations').clear();
  await tx.objectStore('settings').clear();
  for (const f of data.fleets || []) await tx.objectStore('fleets').put(f);
  for (const e of data.equipment || []) await tx.objectStore('equipment').put(e);
  for (const r of data.reports || []) await tx.objectStore('reports').put(r);
  for (const c of data.calculations || []) await tx.objectStore('calculations').put(c);
  for (const s of data.settings || []) await tx.objectStore('settings').put(s);
  await tx.done;
}
