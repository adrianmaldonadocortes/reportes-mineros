export interface Fleet {
  id: string;
  name: string;
  createdAt: number;
}

export type EquipmentStatus = 'active' | 'maintenance' | 'inactive' | 'out_of_service' | 'retired';

export interface Equipment {
  id: string;
  internalNumber: string;
  name: string;
  type: string;
  brand: string;
  model: string;
  serialNumber: string;
  area: string;
  fleetId: string;
  dailyHours: number;
  status: EquipmentStatus;
  createdAt: number;
}

export interface Failure {
  id: string;
  description: string;
  diagnosis: string;
  work: string;
  parts: string;
}

export interface Photo {
  id: string;
  dataUrl: string;
  description: string;
}

export interface TechnicianInfo {
  name: string;
  position: string;
  company: string;
  area: string;
  shift: string;
}

export interface Report {
  id: string;
  equipmentId: string | null;
  equipment: {
    internalNumber: string;
    name: string;
    type: string;
    brand: string;
    model: string;
    serialNumber: string;
    area: string;
    fleetId: string;
  };
  stopDate: string;
  endDate: string;
  motive: string;
  generalDescription: string;
  failures: Failure[];
  photos: Photo[];
  technician: TechnicianInfo;
  completed: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CalculationRow {
  equipmentId: string;
  internalNumber: string;
  name: string;
  dailyHours: number;
  stoppedHours: number;
}

export type PeriodType = 'daily' | 'weekly' | 'monthly' | 'custom';
export type CalcType = 'individual' | 'fleet';

export interface Calculation {
  id: string;
  type: CalcType;
  period: PeriodType;
  startDate: string;
  endDate: string;
  days: number;
  fleetId?: string;
  fleetName?: string;
  rows: CalculationRow[];
  totalProgrammed: number;
  totalStopped: number;
  unavailability: number;
  availability: number;
  createdAt: number;
}

export interface FieldServiceRecord {
  id: string;
  serviceDate: string;
  equipmentId: string;
  equipment: {
    internalNumber: string;
    name: string;
    type: string;
    brand: string;
    model: string;
    serialNumber: string;
    fleetName: string;
  };
  reportedAt: string;
  failure: string;
  status: 'open' | 'completed';
  deliveredAt?: string;
  workDone?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Settings {
  key: string;
  technician: TechnicianInfo;
}
