import { EcuProject } from '../types/ecu';
import { parseXdfXml } from './xdfParser';

const DB_NAME = 'HondaPgmFiStudioDB';
const DB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const STORE_META = 'meta';

interface StoredProjectRecord {
  id: string;
  name: string;
  modelName: string;
  yearRange: string;
  category: EcuProject['category'];
  ecuFamily: string;
  ecmPartNumber: string;
  protocolLabel: string;
  baudRate: number;
  klineTableId: number;
  flashSizeBytes: number;
  checksumAlgorithm: EcuProject['checksumAlgorithm'];
  binFileName: string;
  xdfFileName: string;
  isBuiltInPreset: boolean;
  originalBytes: ArrayBuffer;
  workingBytes: ArrayBuffer;
  xdfXml: string;
  updatedAt: number;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export async function saveProjectToDb(project: EcuProject): Promise<void> {
  const db = await openDatabase();
  const record: StoredProjectRecord = {
    id: project.id,
    name: project.name,
    modelName: project.modelName,
    yearRange: project.yearRange,
    category: project.category,
    ecuFamily: project.ecuFamily,
    ecmPartNumber: project.ecmPartNumber,
    protocolLabel: project.protocolLabel,
    baudRate: project.baudRate,
    klineTableId: project.klineTableId,
    flashSizeBytes: project.flashSizeBytes,
    checksumAlgorithm: project.checksumAlgorithm,
    binFileName: project.binFileName,
    xdfFileName: project.xdfFileName,
    isBuiltInPreset: project.isBuiltInPreset,
    originalBytes: toArrayBuffer(project.originalBytes),
    workingBytes: toArrayBuffer(project.workingBytes),
    xdfXml: project.xdf.rawXml,
    updatedAt: project.updatedAt,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROJECTS, 'readwrite');
    tx.objectStore(STORE_PROJECTS).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadAllProjectsFromDb(): Promise<EcuProject[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROJECTS, 'readonly');
    const req = tx.objectStore(STORE_PROJECTS).getAll();
    req.onsuccess = () => {
      const records = (req.result || []) as StoredProjectRecord[];
      const projects: EcuProject[] = [];
      for (const rec of records) {
        try {
          const xdf = parseXdfXml(rec.xdfXml);
          projects.push({
            id: rec.id,
            name: rec.name,
            modelName: rec.modelName,
            yearRange: rec.yearRange,
            category: rec.category,
            ecuFamily: rec.ecuFamily,
            ecmPartNumber: rec.ecmPartNumber,
            protocolLabel: rec.protocolLabel,
            baudRate: rec.baudRate,
            klineTableId: rec.klineTableId,
            flashSizeBytes: rec.flashSizeBytes,
            checksumAlgorithm: rec.checksumAlgorithm,
            binFileName: rec.binFileName,
            xdfFileName: rec.xdfFileName,
            isBuiltInPreset: rec.isBuiltInPreset,
            originalBytes: new Uint8Array(rec.originalBytes),
            workingBytes: new Uint8Array(rec.workingBytes),
            xdf,
            updatedAt: rec.updatedAt,
          });
        } catch {
          // Skip malformed stored record safely
        }
      }
      projects.sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(projects);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteProjectFromDb(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROJECTS, 'readwrite');
    tx.objectStore(STORE_PROJECTS).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function setActiveProjectIdInDb(projectId: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).put({ key: 'activeProjectId', value: projectId });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getActiveProjectIdFromDb(): Promise<string | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readonly');
    const req = tx.objectStore(STORE_META).get('activeProjectId');
    req.onsuccess = () => resolve(req.result?.value ?? null);
    req.onerror = () => reject(req.error);
  });
}
