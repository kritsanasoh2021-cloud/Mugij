export type WorkspaceTab = 'library' | 'tuning' | 'autotune' | 'gauge' | 'flasher';

export type MotorcycleCategory = 'scooter' | 'underbone' | 'sport' | 'trail';

export type ChecksumAlgorithm =
  | 'keihin-16bit-sum'
  | 'keihin-8bit-twos'
  | 'honda-sh705x-32bit'
  | 'honda-sh725xx-crc16';

export type MapColorScheme = 'fuel' | 'ignition' | 'afr' | 'generic';

export interface XdfAxis {
  id: 'x' | 'y' | 'z';
  units: string;
  count: number;
  decimalPlaces: number;
  address?: number;
  elementSizeBits: number; // 8 | 16 | 32
  signed: boolean;
  lsbFirst: boolean;
  isFloat?: boolean;
  majorStrideBits?: number;
  minorStrideBits?: number;
  equation: string; // e.g., "X*0.5", "X/100"
  labels: number[];
  hasExplicitLabels?: boolean;
  linkedTableId?: string;
  min?: number;
  max?: number;
}

export interface XdfTable {
  id: string;
  title: string;
  description: string;
  category: 'fuel' | 'ignition' | 'afr' | 'limiter' | 'other';
  colorScheme: MapColorScheme;
  address: number;
  rows: number;
  cols: number;
  elementSizeBits: 8 | 16 | 32;
  signed: boolean;
  lsbFirst: boolean;
  isFloat?: boolean;
  majorStrideBits?: number;
  minorStrideBits?: number;
  rowMajor: boolean;
  decimalPlaces: number;
  equation: string;
  units: string;
  xAxis: XdfAxis;
  yAxis: XdfAxis;
  minLimit?: number;
  maxLimit?: number;
}

export interface XdfConstant {
  id: string;
  title: string;
  description: string;
  category: 'limiter' | 'fuel' | 'ignition' | 'idle' | 'other';
  address: number;
  elementSizeBits: 8 | 16 | 32;
  signed: boolean;
  lsbFirst: boolean;
  isFloat?: boolean;
  decimalPlaces: number;
  equation: string;
  units: string;
  minLimit?: number;
  maxLimit?: number;
}

export interface XdfFlag {
  id: string;
  title: string;
  description: string;
  category: string;
  address: number;
  bitIndex: number; // 0..7
  invert?: boolean;
}

export interface XdfChecksumRegion {
  id: string;
  title: string;
  algorithm: ChecksumAlgorithm;
  startAddress: number;
  endAddress: number;
  storeAddress: number;
  storeSizeBits: 8 | 16 | 32;
  lsbFirst: boolean;
  targetSum?: number; // e.g., 0x0000 for two's complement
}

export interface XdfDefinition {
  title: string;
  author: string;
  version: string;
  baseOffset: number;
  rawXml: string;
  isReadOnly?: boolean;
  lockNote?: string;
  tables: XdfTable[];
  constants: XdfConstant[];
  flags: XdfFlag[];
  checksums: XdfChecksumRegion[];
}

export interface ChecksumBlockResult {
  id: string;
  title: string;
  algorithm: ChecksumAlgorithm;
  startAddress: number;
  endAddress: number;
  storeAddress: number;
  storedValue: number;
  computedValue: number;
  isValid: boolean;
}

export interface EcuProject {
  id: string;
  name: string;
  modelName: string;
  yearRange: string;
  category: MotorcycleCategory;
  ecuFamily: string;
  ecmPartNumber: string;
  protocolLabel: string;
  baudRate: number;
  klineTableId: number;
  flashSizeBytes: number;
  checksumAlgorithm: ChecksumAlgorithm;
  binFileName: string;
  xdfFileName: string;
  isBuiltInPreset: boolean;
  originalBytes: Uint8Array;
  workingBytes: Uint8Array;
  xdf: XdfDefinition;
  customTargetAfrMap?: number[][];
  stoichAfr?: number;
  updatedAt: number;
}

export interface HondaModelPresetSpec {
  id: string;
  modelName: string;
  displacementCc: number;
  yearRange: string;
  category: MotorcycleCategory;
  ecuFamily: string;
  ecmPartNumber: string;
  protocolLabel: string;
  baudRate: number;
  klineTableId: number;
  flashSizeBytes: number;
  checksumAlgorithm: ChecksumAlgorithm;
  defaultRevLimit: number;
  defaultIdleRpm: number;
  maxRpmAxis: number[];
  tpsAxis: number[];
  fuelBaseMultiplier: number;
  ignBaseOffset: number;
  hasVvaOrVtec: boolean;
  hasTcs: boolean;
  axisOrientation?: 'rpm-x-tps-y' | 'tps-x-rpm-y';
  notes: string;
}

export interface LiveTelemetryFrame {
  timestamp: number;
  rpm: number;
  tpsPercent: number;
  tpsVolt: number;
  ectTemp: number;
  iatTemp: number;
  mapKpa: number;
  battVolt: number;
  ignAdvance: number;
  injPulseMs: number;
  afr: number;
  o2Volt: number;
  speedKmh: number;
  iscDuty: number;
  gear: number;
  milOn: boolean;
  activeDtcCodes: string[];
}

export interface DtcFaultDefinition {
  code: string; // e.g., "7-1" or "P0115"
  milBlink: string;
  obdCode: string;
  titleTh: string;
  titleEn: string;
  causeTh: string;
  fixHintTh: string;
  severity: 'critical' | 'warning' | 'info';
}

export interface SerialPacketLog {
  id: string;
  timestamp: number;
  direction: 'TX' | 'RX' | 'SYS' | 'ERR';
  hex: string;
  note: string;
  checksumOk?: boolean;
}

export type ConnectionMode = 'disconnected' | 'webserial-direct' | 'webserial-bridge' | 'bench-sim';

export interface AutoTuneConstraints {
  minEctTemp: number;
  minRpm: number;
  minTpsPercent: number;
  minCellHits: number;
  maxSingleStepPct: number;
  maxTotalTrimPct: number;
  dampingFactor: number; // 0.1 - 1.0
  autoApplyLive: boolean;
}
