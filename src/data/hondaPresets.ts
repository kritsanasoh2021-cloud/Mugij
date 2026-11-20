import { fixAllChecksums } from '../engine/checksumEngine';
import { parseXdfXml, writeConstantValue, writeFlagState, writeTableCell } from '../engine/xdfParser';
import { EcuProject, HondaModelPresetSpec } from '../types/ecu';

export const HONDA_MODEL_PRESETS: HondaModelPresetSpec[] = [
  // ===================== SCOOTER / AUTOMATIC =====================
  {
    id: 'forza-350-k1b-t02',
    modelName: 'Honda Forza 350 (NSS350 Gen 1–2)',
    displacementCc: 330,
    yearRange: '2020–2023',
    category: 'scooter',
    ecuFamily: 'Keihin SH7253x (eSP+ 4V)',
    ecmPartNumber: '38770-K1B-T02',
    protocolLabel: 'Honda K-Line (ISO 9141-2 · 10,400 bps)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9300,
    defaultIdleRpm: 1500,
    maxRpmAxis: [1500, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 10500],
    tpsAxis: [0, 5, 10, 20, 35, 50, 70, 85, 100],
    fuelBaseMultiplier: 1.35,
    ignBaseOffset: 2,
    hasVvaOrVtec: false,
    hasTcs: true,
    notes: 'กล่อง Forza 350 เบอร์หลัก K1B-T02 (ใช้แทน T01/T03 ได้) รองรับ HSTC ปลดลิมิตรอบ 9,300+ RPM',
  },
  {
    id: 'forza-350-k1b-t81',
    modelName: 'Honda Forza 350 RoadSync / TFT (New)',
    displacementCc: 330,
    yearRange: '2024–2026',
    category: 'scooter',
    ecuFamily: 'Keihin SH7253x (eSP+ 4V)',
    ecmPartNumber: '38770-K1B-T81',
    protocolLabel: 'Honda K-Line / Euro5 (10,400 bps)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9300,
    defaultIdleRpm: 1500,
    maxRpmAxis: [1500, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 10500],
    tpsAxis: [0, 5, 10, 20, 35, 50, 70, 85, 100],
    fuelBaseMultiplier: 1.36,
    ignBaseOffset: 2,
    hasVvaOrVtec: false,
    hasTcs: true,
    notes: 'Forza 350 โฉมเรือนไมล์ TFT / RoadSync เบอร์กล่อง K1B-T81 จูนน้ำมันชดเชยท่อ-ชามและปลดรอบปลาย',
  },
  {
    id: 'forza-300-k0b',
    modelName: 'Honda Forza 300 (NSS300 Gen 2)',
    displacementCc: 279,
    yearRange: '2018–2020',
    category: 'scooter',
    ecuFamily: 'Keihin K0B (SH705x)',
    ecmPartNumber: '38770-K0B-T01',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 17)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9000,
    defaultIdleRpm: 1500,
    maxRpmAxis: [1500, 2400, 3300, 4200, 5200, 6200, 7200, 8200, 9200, 10000],
    tpsAxis: [0, 5, 10, 20, 35, 50, 70, 85, 100],
    fuelBaseMultiplier: 1.28,
    ignBaseOffset: 1.5,
    hasVvaOrVtec: false,
    hasTcs: true,
    notes: 'Forza 300 โฉมกระจกไฟฟ้า Gen 2 กล่อง K0B รองรับระบบ HSTC และจูนไฟจุดระเบิดเต็มตาราง',
  },
  {
    id: 'forza-300-k04',
    modelName: 'Honda Forza 300 (โฉมแรก Gen 1)',
    displacementCc: 279,
    yearRange: '2013–2017',
    category: 'scooter',
    ecuFamily: 'Keihin K04',
    ecmPartNumber: '38770-K04-971',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 8800,
    defaultIdleRpm: 1500,
    maxRpmAxis: [1500, 2400, 3300, 4200, 5200, 6200, 7200, 8200, 9000, 9800],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 1.25,
    ignBaseOffset: 1,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Forza 300 โฉมแรก กล่อง K04-971 ปลดรอบ แก้ตื้อกลาง-ปลาย และตั้งอุณหภูมิพัดลมหม้อน้ำ',
  },
  {
    id: 'adv-350-k2l',
    modelName: 'Honda ADV 350',
    displacementCc: 330,
    yearRange: '2022–2026',
    category: 'scooter',
    ecuFamily: 'Keihin SH7253x (eSP+ 4V)',
    ecmPartNumber: '38770-K2L-T01',
    protocolLabel: 'Honda K-Line (ISO 9141-2 · 10,400 bps)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9300,
    defaultIdleRpm: 1500,
    maxRpmAxis: [1500, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 10500],
    tpsAxis: [0, 5, 10, 20, 35, 50, 70, 85, 100],
    fuelBaseMultiplier: 1.34,
    ignBaseOffset: 2,
    hasVvaOrVtec: false,
    hasTcs: true,
    notes: 'ADV 350 เบอร์กล่อง K2L-T01 ตระกูลเดียวกับ Forza 350 ปรับจูนปลดรอบและเปิด/ปิด HSTC ได้',
  },
  {
    id: 'adv-160-k0w-t01',
    modelName: 'Honda ADV 160 (eSP+ 4V)',
    displacementCc: 157,
    yearRange: '2022–2026',
    category: 'scooter',
    ecuFamily: 'Keihin K0W (eSP+ 4V)',
    ecmPartNumber: '38770-K0W-T01',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 17)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9800,
    defaultIdleRpm: 1700,
    maxRpmAxis: [1700, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 11000],
    tpsAxis: [0, 5, 12, 22, 35, 50, 70, 85, 100],
    fuelBaseMultiplier: 0.96,
    ignBaseOffset: 1.5,
    hasVvaOrVtec: false,
    hasTcs: true,
    notes: 'ADV 160 เครื่อง eSP+ 4 วาล์ว รองรับ HSTC ปลดลิมิตรอบ และจูนน้ำมัน-ไฟจุดระเบิดเต็มระบบ',
  },
  {
    id: 'adv-150-k0w-n01',
    modelName: 'Honda ADV 150 (2V)',
    displacementCc: 149,
    yearRange: '2019–2022',
    category: 'scooter',
    ecuFamily: 'Keihin K0W (2V eSP)',
    ecmPartNumber: '38770-K0W-N01',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 32768,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9500,
    defaultIdleRpm: 1700,
    maxRpmAxis: [1700, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 10800],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.9,
    ignBaseOffset: 0.5,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'ADV 150 รุ่นแรก กล่อง K0W-N01 ตระกูลเดียวกับ PCX 150 K97 จูนไล่ข้างและปลดรอบได้',
  },
  {
    id: 'adv-160-30400-k0wl-t01',
    modelName: 'Honda ADV 160 (Shindengen / eSP+ 4V · K0WL)',
    displacementCc: 157,
    yearRange: '2022–2026',
    category: 'scooter',
    ecuFamily: 'Honda ACG ECM K0WL (eSP+ 4V)',
    ecmPartNumber: '30400-K0WL-T01',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 17)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9800,
    defaultIdleRpm: 1700,
    maxRpmAxis: [1700, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 11000],
    tpsAxis: [0, 5, 12, 22, 35, 50, 70, 85, 100],
    fuelBaseMultiplier: 0.96,
    ignBaseOffset: 1.5,
    hasVvaOrVtec: false,
    hasTcs: true,
    notes: 'ADV 160 รหัสกล่องรวมชุด ACG 30400-K0WL-T01 จูนชดเชยน้ำมัน องศาไฟ และปลดรอบปลาย',
  },
  {
    id: 'adv-150-30400-k0wf-t01',
    modelName: 'Honda ADV 150 (ACG ECM · K0WF)',
    displacementCc: 149,
    yearRange: '2017–2019',
    category: 'scooter',
    ecuFamily: 'Honda ACG ECM K0WF · Cal ID 01037C0D01',
    ecmPartNumber: '30400-K0WF-T01',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9500,
    defaultIdleRpm: 1700,
    maxRpmAxis: [1700, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 10800],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.9,
    ignBaseOffset: 0.5,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'ADV 150 (2017–2019) กล่อง 30400-K0WF-T01 · Cal ID: 01037C0D01 รองรับจูนเดินหอบและปลดลิมิตรอบ',
  },
  {
    id: 'pcx-160-k1z-t12',
    modelName: 'Honda PCX 160 (eSP+ 4V ABS/CBS)',
    displacementCc: 157,
    yearRange: '2021–2026',
    category: 'scooter',
    ecuFamily: 'Keihin K1Z (eSP+ 4V)',
    ecmPartNumber: '38770-K1Z-T12',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 17)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9800,
    defaultIdleRpm: 1700,
    maxRpmAxis: [1700, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 11000],
    tpsAxis: [0, 5, 12, 22, 35, 50, 70, 85, 100],
    fuelBaseMultiplier: 0.96,
    ignBaseOffset: 1,
    hasVvaOrVtec: false,
    hasTcs: true,
    notes: 'PCX 160 เบอร์ยอดนิยม K1Z-T12 (ใช้ร่วมกับ T01/T11 ได้) จูนลูก/แคม/ลิ้นเร่ง และปลดรอบ 11,000+ RPM',
  },
  {
    id: 'pcx-160-k1z-t21',
    modelName: 'Honda PCX 160 RoadSync / New 2025',
    displacementCc: 157,
    yearRange: '2024–2026',
    category: 'scooter',
    ecuFamily: 'Keihin K1Z (eSP+ 4V)',
    ecmPartNumber: '38770-K1Z-T21',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 17)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9800,
    defaultIdleRpm: 1700,
    maxRpmAxis: [1700, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 11000],
    tpsAxis: [0, 5, 12, 22, 35, 50, 70, 85, 100],
    fuelBaseMultiplier: 0.97,
    ignBaseOffset: 1.5,
    hasVvaOrVtec: false,
    hasTcs: true,
    notes: 'PCX 160 ตัวใหม่ไมล์ TFT / RoadSync เบอร์ K1Z-T21 รองรับจูนหัวฉีดแต่งและเปิด/ปิด HSTC',
  },
  {
    id: 'pcx-150-k97',
    modelName: 'Honda PCX 150 (LED Smart Key)',
    displacementCc: 149,
    yearRange: '2018–2020',
    category: 'scooter',
    ecuFamily: 'Keihin K97 (Digital)',
    ecmPartNumber: '38770-K97-T01',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 32768,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9500,
    defaultIdleRpm: 1700,
    maxRpmAxis: [1700, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 10800],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.9,
    ignBaseOffset: 0,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'กล่อง K97 ยอดนิยมสายไล่ข้าง-ทำลูกสูบ 60–63 มิล จูนหัวฉีดและไฟจุดระเบิดละเอียดมาก',
  },
  {
    id: 'pcx-150-k36',
    modelName: 'Honda PCX 150 (LED โฉมแรก)',
    displacementCc: 149,
    yearRange: '2014–2017',
    category: 'scooter',
    ecuFamily: 'Keihin K36 / K35',
    ecmPartNumber: '38770-K36-T01',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 32768,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9400,
    defaultIdleRpm: 1700,
    maxRpmAxis: [1700, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 10600],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.89,
    ignBaseOffset: 0,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'PCX 150 LED ตัวแรก (K36 / K35) ปลั๊ก DLC แดง จูนเดินหอบ ปลดรอบ และชดเชย E85 ได้',
  },
  {
    id: 'pcx-150-kzy',
    modelName: 'Honda PCX 125 / 150 (โฉมแรก KZY/KWN)',
    displacementCc: 149,
    yearRange: '2010–2013',
    category: 'scooter',
    ecuFamily: 'Keihin KZY / KWN',
    ecmPartNumber: '38770-KZY-701',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 32768,
    checksumAlgorithm: 'keihin-8bit-twos',
    defaultRevLimit: 9200,
    defaultIdleRpm: 1700,
    maxRpmAxis: [1700, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 10400],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.87,
    ignBaseOffset: 0,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'PCX 125 (KWN) / 150 (KZY) ตัวแรก รีแมพปรับน้ำมันและองศาไฟแก้ตื้อรอบปลาย',
  },
  {
    id: 'pcx-160-30400-k1zf-t01',
    modelName: 'Honda PCX 160 (eSP+ 4V · K1ZF-T01)',
    displacementCc: 157,
    yearRange: '2020–2022',
    category: 'scooter',
    ecuFamily: 'Honda ACG ECM K1ZF · Cal ID 0103D00D01',
    ecmPartNumber: '30400-K1ZF-T01',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 17)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9900,
    defaultIdleRpm: 1700,
    maxRpmAxis: [1700, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 11200],
    tpsAxis: [0, 5, 12, 22, 35, 50, 70, 85, 100],
    fuelBaseMultiplier: 0.96,
    ignBaseOffset: 1.5,
    hasVvaOrVtec: false,
    hasTcs: true,
    notes: 'PCX 160 (2020–2022) กล่อง 30400-K1ZF-T01 · Cal ID: 0103D00D01 รองรับไฟล์จูนเปิดหอบ ปลดรอบ และเปิด/ปิด HSTC',
  },
  {
    id: 'pcx-160-30400-k1zf-t11',
    modelName: 'Honda PCX 160 (eSP+ 4V · K1ZF-T11)',
    displacementCc: 157,
    yearRange: '2020–2021',
    category: 'scooter',
    ecuFamily: 'Honda ACG ECM K1ZF · Cal ID 0103CF0D01',
    ecmPartNumber: '30400-K1ZF-T11',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 17)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9800,
    defaultIdleRpm: 1700,
    maxRpmAxis: [1700, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 11000],
    tpsAxis: [0, 5, 12, 22, 35, 50, 70, 85, 100],
    fuelBaseMultiplier: 0.96,
    ignBaseOffset: 1,
    hasVvaOrVtec: false,
    hasTcs: true,
    notes: 'PCX 160 (2020–2021) กล่อง 30400-K1ZF-T11 · Cal ID: 0103CF0D01 จูนชดเชยหัวฉีดและไฟจุดระเบิดเต็มตาราง',
  },
  {
    id: 'pcx-160-30400-k1zp-t51',
    modelName: 'Honda PCX 160 (2023 Standard · K1ZP-T51)',
    displacementCc: 157,
    yearRange: '2023–2024',
    category: 'scooter',
    ecuFamily: 'Honda ACG ECM K1ZP · Cal ID 0105050D01',
    ecmPartNumber: '30400-K1ZP-T51',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 17)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9800,
    defaultIdleRpm: 1700,
    maxRpmAxis: [1700, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 11000],
    tpsAxis: [0, 5, 12, 22, 35, 50, 70, 85, 100],
    fuelBaseMultiplier: 0.97,
    ignBaseOffset: 1.5,
    hasVvaOrVtec: false,
    hasTcs: true,
    notes: 'PCX 160 ปี 2023 รุ่น Standard กล่อง K1ZP-T51-TH01 · Cal ID: 0105050D01 จูนน้ำมัน ไฟ และปลดรอบ',
  },
  {
    id: 'pcx-160-abs-30400-k1zp-t71',
    modelName: 'Honda PCX 160 ABS (2023 · K1ZP-T71)',
    displacementCc: 157,
    yearRange: '2023–2024',
    category: 'scooter',
    ecuFamily: 'Honda ACG ECM K1ZP ABS · Cal ID 0105040D01 / 05040D01',
    ecmPartNumber: '30400-K1ZP-T71',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 17)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9800,
    defaultIdleRpm: 1700,
    maxRpmAxis: [1700, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 11000],
    tpsAxis: [0, 5, 12, 22, 35, 50, 70, 85, 100],
    fuelBaseMultiplier: 0.97,
    ignBaseOffset: 1.5,
    hasVvaOrVtec: false,
    hasTcs: true,
    notes: 'PCX 160 ABS ปี 2023 กล่อง K1ZP-T71 · Cal ID: 05040D01 (0105040D01) รองรับ ABS + HSTC และปลดรอบปลาย',
  },
  {
    id: 'pcx-150-30400-k97f-t01',
    modelName: 'Honda PCX 150 (2017–2020 · K97F-T01)',
    displacementCc: 149,
    yearRange: '2017–2020',
    category: 'scooter',
    ecuFamily: 'Honda ACG ECM K97F · Cal ID 0102990D01',
    ecmPartNumber: '30400-K97F-T01',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9600,
    defaultIdleRpm: 1700,
    maxRpmAxis: [1700, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 10800],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.91,
    ignBaseOffset: 0.5,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'PCX 150 (2017–2020) กล่อง 30400-K97F-T01 · Cal ID: 0102990D01 นิยมจูนเดินหอบ ทำชาม-ลูก และปลดรอบ',
  },
  {
    id: 'pcx-150-30400-k36s-t31',
    modelName: 'Honda PCX 150 (2016–2017 · K36S-T31)',
    displacementCc: 149,
    yearRange: '2016–2017',
    category: 'scooter',
    ecuFamily: 'Honda ACG ECM K36S · Cal ID 0102180D01',
    ecmPartNumber: '30400-K36S-T31',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 32768,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9500,
    defaultIdleRpm: 1700,
    maxRpmAxis: [1700, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 10600],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.9,
    ignBaseOffset: 0,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'PCX 150 (2016–2017) กล่อง 30400-K36S-T31 · Cal ID: 0102180D01 ปรับน้ำมัน-ไฟ และปลดลิมิตรอบ',
  },
  {
    id: 'pcx-150-30400-k36f-t01',
    modelName: 'Honda PCX 150 (2014–2015 · K36F-T01)',
    displacementCc: 149,
    yearRange: '2014–2015',
    category: 'scooter',
    ecuFamily: 'Honda ACG ECM K36F · Cal ID 0101990D01',
    ecmPartNumber: '30400-K36F-T01',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 32768,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9400,
    defaultIdleRpm: 1700,
    maxRpmAxis: [1700, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 10600],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.89,
    ignBaseOffset: 0,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'PCX 150 (2014–2015) กล่อง 30400-K36F-T01 · Cal ID: 0101990D01 จูนชดเชย E20/E85 และเดินหอบได้',
  },
  {
    id: 'click-160-k2s',
    modelName: 'Honda Click 160 (eSP+ 4V)',
    displacementCc: 157,
    yearRange: '2022–2026',
    category: 'scooter',
    ecuFamily: 'Keihin K2S (eSP+ 4V)',
    ecmPartNumber: '38770-K2S-T01',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 17)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9800,
    defaultIdleRpm: 1700,
    maxRpmAxis: [1700, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 11200],
    tpsAxis: [0, 5, 12, 22, 35, 50, 70, 85, 100],
    fuelBaseMultiplier: 0.95,
    ignBaseOffset: 1.5,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Click 160 เบอร์กล่อง K2S-T01 ตอบสนองไว เหมาะจูนเดินหอบ ปลดรอบ และจ่ายน้ำมันรอบปลาย',
  },
  {
    id: 'click-150i-k59-t11',
    modelName: 'Honda Click 150i (LED Smart Key)',
    displacementCc: 149,
    yearRange: '2018–2021',
    category: 'scooter',
    ecuFamily: 'Keihin K59 / K60 SmartKey',
    ecmPartNumber: '38770-K59-T11',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 32768,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9600,
    defaultIdleRpm: 1700,
    maxRpmAxis: [1700, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 10800],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.9,
    ignBaseOffset: 0.5,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Click 150i กล่อง K59-T11 (SCU Smart Key) จูนแรงบิดต้น-ปลายและปลดลิมิตรอบ',
  },
  {
    id: 'click-125i-k59-a71',
    modelName: 'Honda Click 125i LED (K59 / K60)',
    displacementCc: 125,
    yearRange: '2015–2025',
    category: 'scooter',
    ecuFamily: 'Keihin K59 / K60',
    ecmPartNumber: '38770-K59-A71',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 32768,
    checksumAlgorithm: 'keihin-8bit-twos',
    defaultRevLimit: 9400,
    defaultIdleRpm: 1700,
    maxRpmAxis: [1700, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 10500],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.82,
    ignBaseOffset: 0,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Click 125i LED เบอร์ยอดนิยม K59-A71 / K60-T01 ปลั๊ก DLC 4P แดง จูนไฟ/น้ำมันครบ',
  },
  {
    id: 'click-125i-2020-k59-t61',
    modelName: 'Honda Click 125i (LED ปี 2020 · K59-T61)',
    displacementCc: 125,
    yearRange: '2019–2021',
    category: 'scooter',
    ecuFamily: 'Keihin K59 / K60 (2020)',
    ecmPartNumber: '38770-K59-T61',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 32768,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9500,
    defaultIdleRpm: 1700,
    maxRpmAxis: [1700, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 10600],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.83,
    ignBaseOffset: 0.5,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Click 125i 2020 เบอร์กล่อง K59-T61 / K60-T61 จูนไล่ข้าง ชดเชยน้ำมัน และปลดลิมิตรอบ',
  },
  {
    id: 'click-125i-kzr',
    modelName: 'Honda Click 125i (โฉมแรก KZR)',
    displacementCc: 125,
    yearRange: '2012–2014',
    category: 'scooter',
    ecuFamily: 'Keihin KZR',
    ecmPartNumber: '38770-KZR-601',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 32768,
    checksumAlgorithm: 'keihin-8bit-twos',
    defaultRevLimit: 9200,
    defaultIdleRpm: 1700,
    maxRpmAxis: [1700, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 10400],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.8,
    ignBaseOffset: 0,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Click 125i ตัวแรก กล่อง KZR-601 รองรับจูนชดเชยหัวฉีดและปลดลิมิตรอบ',
  },
  {
    id: 'click-110i-kvb',
    modelName: 'Honda Click 110i / Icon (KVB)',
    displacementCc: 108,
    yearRange: '2008–2012',
    category: 'scooter',
    ecuFamily: 'Keihin KVB (Gen 1 PGM-FI)',
    ecmPartNumber: '38770-KVB-901',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 32768,
    checksumAlgorithm: 'keihin-8bit-twos',
    defaultRevLimit: 9000,
    defaultIdleRpm: 1650,
    maxRpmAxis: [1650, 2400, 3200, 4200, 5200, 6200, 7200, 8200, 9000, 10000],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.75,
    ignBaseOffset: 0,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Click 110i หัวฉีดรุ่นบุกเบิก กล่อง KVB อ่านค่าเซนเซอร์ สแกนโค้ด และปรับจูนน้ำมันได้',
  },
  {
    id: 'click-160-30400-k2sf-t01',
    modelName: 'Honda Click 160 (ACG ECM · K2SF-T01)',
    displacementCc: 157,
    yearRange: '2022–2026',
    category: 'scooter',
    ecuFamily: 'Honda ACG ECM K2SF (eSP+ 4V)',
    ecmPartNumber: '30400-K2SF-T01',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 17)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9800,
    defaultIdleRpm: 1700,
    maxRpmAxis: [1700, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 11200],
    tpsAxis: [0, 5, 12, 22, 35, 50, 70, 85, 100],
    fuelBaseMultiplier: 0.95,
    ignBaseOffset: 1.5,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Click 160 รหัสกล่องชุด ACG 30400-K2SF-T01 (K2SF-T01-CLICK160) จูนน้ำมัน ไฟจุดระเบิด และปลดรอบ',
  },
  {
    id: 'click-150i-30400-k59k-t11',
    modelName: 'Honda Click 150i (2018–2020 · K59K-T11)',
    displacementCc: 149,
    yearRange: '2018–2020',
    category: 'scooter',
    ecuFamily: 'Honda ACG ECM K59K · Cal ID 0103070D01',
    ecmPartNumber: '30400-K59K-T11',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 32768,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9600,
    defaultIdleRpm: 1700,
    maxRpmAxis: [1700, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 10800],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.9,
    ignBaseOffset: 0.5,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Click 150i (2018–2020) กล่อง 30400-K59K-T11 · Cal ID: 0103070D01 จูนแรงบิดต้น-ปลายและปลดรอบ',
  },
  {
    id: 'click-125i-30400-k60s-t71',
    modelName: 'Honda Click 125i (2020 · K60S-T71)',
    displacementCc: 125,
    yearRange: '2020–2022',
    category: 'scooter',
    ecuFamily: 'Honda ACG ECM K60S · Cal ID 01030A0D01',
    ecmPartNumber: '30400-K60S-T71',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9500,
    defaultIdleRpm: 1700,
    maxRpmAxis: [1700, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 10600],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.83,
    ignBaseOffset: 0.5,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Click 125i ปี 2020 กล่อง 30400-K60S-T71 · Cal ID: 01030A0D01 จูนไล่ข้าง เพิ่มน้ำมัน และปลดลิมิตรอบ',
  },
  {
    id: 'click-125i-30400-k60f-t01',
    modelName: 'Honda Click 125i (2014–2015 · K60F-T01)',
    displacementCc: 125,
    yearRange: '2014–2015',
    category: 'scooter',
    ecuFamily: 'Honda ACG ECM K60F · Cal ID 0101D00D01',
    ecmPartNumber: '30400-K60F-T01',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 32768,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9400,
    defaultIdleRpm: 1700,
    maxRpmAxis: [1700, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 10500],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.82,
    ignBaseOffset: 0,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Click 125i (2014–2015) กล่อง 30400-K60F-T01 · Cal ID: 0101D00D01 จูนเดินหอบและชดเชยหัวฉีด',
  },
  {
    id: 'giorno-125-k3m',
    modelName: 'Honda Giorno+ 125 (4V eSP+)',
    displacementCc: 125,
    yearRange: '2023–2026',
    category: 'scooter',
    ecuFamily: 'Keihin K3M (eSP+ 4V)',
    ecmPartNumber: '38770-K3M-T01',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 17)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9700,
    defaultIdleRpm: 1700,
    maxRpmAxis: [1700, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 10800],
    tpsAxis: [0, 5, 12, 22, 35, 50, 70, 85, 100],
    fuelBaseMultiplier: 0.85,
    ignBaseOffset: 1,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Giorno+ 125 เครื่อง 4 วาล์ว เบอร์กล่อง K3M-T01 ปรับน้ำมัน E20/E85 และปลดลิมิตรอบ',
  },
  {
    id: 'giorno-125-gen2-k3mh-t71',
    modelName: 'Honda Giorno+ 125 Gen 2 (2026 · K3MH-T71)',
    displacementCc: 125,
    yearRange: '2025–2026',
    category: 'scooter',
    ecuFamily: 'Honda ACG ECM K3MH (eSP+ 4V) · Cal ID 0106A70D01',
    ecmPartNumber: '30400-K3MH-T71',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 17)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9800,
    defaultIdleRpm: 1700,
    maxRpmAxis: [1700, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 11000],
    tpsAxis: [0, 5, 12, 22, 35, 50, 70, 85, 100],
    fuelBaseMultiplier: 0.86,
    ignBaseOffset: 1,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Giorno+ 125 Gen 2 (2026) กล่อง 30400-K3MH-T71 · Cal ID: 0106A70D01 จูนน้ำมัน-ไฟ และปลดรอบ',
  },
  {
    id: 'giorno-125-gen1-kfmf-t01',
    modelName: 'Honda Giorno+ 125 Gen 1 (KFMF-T01)',
    displacementCc: 125,
    yearRange: '2023–2024',
    category: 'scooter',
    ecuFamily: 'Honda ACG ECM KFMF / K3MF Gen 1',
    ecmPartNumber: '30400-KFMF-T01',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 17)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9700,
    defaultIdleRpm: 1700,
    maxRpmAxis: [1700, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 10800],
    tpsAxis: [0, 5, 12, 22, 35, 50, 70, 85, 100],
    fuelBaseMultiplier: 0.85,
    ignBaseOffset: 1,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Giorno+ 125 เจน 1 กล่อง KFMF-T01 (KFMF-TO1 / K3MF-T01) รองรับจูนเดินหอบและเพิ่มรอบปลาย',
  },
  {
    id: 'lead-125-k2t',
    modelName: 'Honda Lead 125 (4V eSP+)',
    displacementCc: 125,
    yearRange: '2022–2026',
    category: 'scooter',
    ecuFamily: 'Keihin K2T (eSP+ 4V)',
    ecmPartNumber: '38770-K2T-T01',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 17)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9600,
    defaultIdleRpm: 1700,
    maxRpmAxis: [1700, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 10800],
    tpsAxis: [0, 5, 12, 22, 35, 50, 70, 85, 100],
    fuelBaseMultiplier: 0.84,
    ignBaseOffset: 1,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Lead 125 เครื่อง 4 วาล์ว เบอร์ K2T-T01 ยอดนิยมสายซิ่ง-เดลิเวอรี จูนประหยัดหรือไล่รอบปลาย',
  },
  {
    id: 'lead-125-2025-k2tg-t21',
    modelName: 'Honda Lead 125 (2025–2026 · K2TG-T21)',
    displacementCc: 125,
    yearRange: '2025–2026',
    category: 'scooter',
    ecuFamily: 'Honda ACG ECM K2TG (eSP+ 4V) · Cal ID 0105950D01',
    ecmPartNumber: '30400-K2TG-T21',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 17)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9800,
    defaultIdleRpm: 1700,
    maxRpmAxis: [1700, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 10800],
    tpsAxis: [0, 5, 12, 22, 35, 50, 70, 85, 100],
    fuelBaseMultiplier: 0.85,
    ignBaseOffset: 1,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'หลีด 125 ปี 2025–2026 กล่อง 30400-K2TG-T21 · Cal ID: 0105950D01 จูนจ่ายน้ำมัน องศาไฟ และปลดรอบ',
  },
  {
    id: 'lead-125-k2ta-t02',
    modelName: 'Honda Lead 125 (eSP+ 4V · K2TA-T02)',
    displacementCc: 125,
    yearRange: '2022–2026',
    category: 'scooter',
    ecuFamily: 'Keihin K2TA (eSP+ 4V)',
    ecmPartNumber: '38770-K2TA-T02',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 17)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9700,
    defaultIdleRpm: 1700,
    maxRpmAxis: [1700, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 10800],
    tpsAxis: [0, 5, 12, 22, 35, 50, 70, 85, 100],
    fuelBaseMultiplier: 0.85,
    ignBaseOffset: 1,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Lead 125 กล่อง K2TA-T02 (และ 30400-K2T-T02) จูนเพิ่มน้ำมันรอบกลาง-ปลาย และปลดรอบ',
  },
  {
    id: 'lead-125-4v-34000-k2ta-t02',
    modelName: 'Honda Lead 125 4V (ACG ECM · 34000-K2TA-T02)',
    displacementCc: 125,
    yearRange: '2022–2026',
    category: 'scooter',
    ecuFamily: 'Honda ACG ECM K2TA (4V)',
    ecmPartNumber: '34000-K2TA-T02',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 17)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9700,
    defaultIdleRpm: 1700,
    maxRpmAxis: [1700, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 10800],
    tpsAxis: [0, 5, 12, 22, 35, 50, 70, 85, 100],
    fuelBaseMultiplier: 0.85,
    ignBaseOffset: 1,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Lead 125 4V รหัสไฟล์ 34000-K2TA-T02-LEAD125_4V รองรับจูนเดินหอบ ปลดรอบ และชดเชยหัวฉีด',
  },
  {
    id: 'lead-125-k12',
    modelName: 'Honda Lead 125 (โฉมแรก 2V K12)',
    displacementCc: 125,
    yearRange: '2021–2022',
    category: 'scooter',
    ecuFamily: 'Keihin K12',
    ecmPartNumber: '38770-K12-V01',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 32768,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9300,
    defaultIdleRpm: 1700,
    maxRpmAxis: [1700, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 10500],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.81,
    ignBaseOffset: 0.5,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Lead 125 ตัว 2 วาล์ว กล่อง K12 แก้อืดช่วงออกตัวและปรับปลดรอบปลาย',
  },
  {
    id: 'lead-125-2v-k12m-j61',
    modelName: 'Honda Lead 125 2V (K12M-J61 / J01)',
    displacementCc: 125,
    yearRange: '2020–2022',
    category: 'scooter',
    ecuFamily: 'Honda ACG ECM K12M-J61-J01 (2V)',
    ecmPartNumber: '30400-K12M-J61',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 32768,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9300,
    defaultIdleRpm: 1700,
    maxRpmAxis: [1700, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 10500],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.81,
    ignBaseOffset: 0.5,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Lead 125 2V รหัสกล่อง K12M-J61-J01 (K12M-J61-J01-LEAD125-2V) จูนเปิดรอบต้นและปลดรอบปลาย',
  },
  {
    id: 'scoopy-i-k2f',
    modelName: 'Honda Scoopy i (LED / Smart Key K2F)',
    displacementCc: 110,
    yearRange: '2021–2026',
    category: 'scooter',
    ecuFamily: 'Keihin K2F (eSP)',
    ecmPartNumber: '38770-K2F-T01',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 17)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9300,
    defaultIdleRpm: 1700,
    maxRpmAxis: [1700, 2400, 3300, 4200, 5200, 6200, 7200, 8200, 9200, 10400],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.74,
    ignBaseOffset: 0.5,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Scoopy i โฉมล่าสุด เฟรม eSAF เบอร์กล่อง K2F-T01 (และ K0J) จูนรอบต้น-กลางให้บิดติดมือ',
  },
  {
    id: 'scoopy-i-k93',
    modelName: 'Honda Scoopy i (S12 / ล้อ 12 นิ้ว K93)',
    displacementCc: 108,
    yearRange: '2017–2020',
    category: 'scooter',
    ecuFamily: 'Keihin K93 / K16',
    ecmPartNumber: '38770-K93-T01',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 32768,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9200,
    defaultIdleRpm: 1700,
    maxRpmAxis: [1700, 2400, 3300, 4200, 5200, 6200, 7200, 8200, 9200, 10200],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.73,
    ignBaseOffset: 0,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Scoopy i ไฟหน้า LED โฉมปี 2017–2020 กล่อง K93-T01 ปลั๊ก DLC 4P',
  },
  {
    id: 'scoopy-i-k16',
    modelName: 'Honda Scoopy i (ไฟเลี้ยวแยก K16 / KYT)',
    displacementCc: 108,
    yearRange: '2010–2016',
    category: 'scooter',
    ecuFamily: 'Keihin K16 / KYT',
    ecmPartNumber: '38770-K16-901',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 32768,
    checksumAlgorithm: 'keihin-8bit-twos',
    defaultRevLimit: 9000,
    defaultIdleRpm: 1700,
    maxRpmAxis: [1700, 2400, 3200, 4200, 5200, 6200, 7200, 8200, 9000, 10000],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.72,
    ignBaseOffset: 0,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Scoopy i ตัวเก่า K16 / KYT รองรับจูนชดเชยน้ำมันและสแกนโค้ดเซ็นเซอร์',
  },
  {
    id: 'zoomer-x-k20',
    modelName: 'Honda Zoomer-X (ไมล์ดิจิตอล K20)',
    displacementCc: 108,
    yearRange: '2012–2021',
    category: 'scooter',
    ecuFamily: 'Keihin K20 / K16',
    ecmPartNumber: '38770-K20-T01',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 32768,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9200,
    defaultIdleRpm: 1700,
    maxRpmAxis: [1700, 2400, 3300, 4200, 5200, 6200, 7200, 8200, 9200, 10300],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.73,
    ignBaseOffset: 0,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Zoomer-X กล่อง K20-T01 ระบบ eSP Idling Stop ปรับจูนไฟและน้ำมันแก้สะดุด',
  },
  {
    id: 'zoomer-x-30400-k20j-t21',
    modelName: 'Honda Zoomer-X (2015–2017 · K20J-T21)',
    displacementCc: 108,
    yearRange: '2015–2017',
    category: 'scooter',
    ecuFamily: 'Honda ACG ECM K20J · Cal ID 0101FF0D01',
    ecmPartNumber: '30400-K20J-T21',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 32768,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9300,
    defaultIdleRpm: 1700,
    maxRpmAxis: [1700, 2400, 3300, 4200, 5200, 6200, 7200, 8200, 9200, 10300],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.74,
    ignBaseOffset: 0,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Zoomer-X (2015–2017) กล่อง 30400-K20J-T21 · Cal ID: 0101FF0D01 จูนชดเชยน้ำมันและปลดรอบ',
  },
  {
    id: 'moove-spacy-k44',
    modelName: 'Honda Moove / Spacy i (K44 / KZL)',
    displacementCc: 108,
    yearRange: '2012–2018',
    category: 'scooter',
    ecuFamily: 'Keihin K44 / KZL',
    ecmPartNumber: '38770-K44-V01',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 32768,
    checksumAlgorithm: 'keihin-8bit-twos',
    defaultRevLimit: 9100,
    defaultIdleRpm: 1700,
    maxRpmAxis: [1700, 2400, 3300, 4200, 5200, 6200, 7200, 8200, 9100, 10000],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.72,
    ignBaseOffset: 0,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Moove / Spacy i กล่อง K44 / KZL รองรับจูนประหยัดน้ำมันและไล่ชามเม็ด',
  },

  // ===================== UNDERBONE / FAMILY / MINI BIKE =====================
  {
    id: 'wave-110i-k1m-t02',
    modelName: 'Honda Wave 110i (LED 2021–2026 · K1M)',
    displacementCc: 110,
    yearRange: '2021–2026',
    category: 'underbone',
    ecuFamily: 'Keihin K1M (Smart Engine)',
    ecmPartNumber: '38770-K1M-T02',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 32768,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9200,
    defaultIdleRpm: 1400,
    maxRpmAxis: [1400, 2200, 3200, 4200, 5200, 6200, 7200, 8200, 9200, 10500],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.72,
    ignBaseOffset: 0,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Wave 110i โฉมไมล์ดิจิตอล กล่อง K1M-T02 (และ K1M-T51) จูนลูก 53-54 เดินหอบ ปลดรอบ',
  },
  {
    id: 'wave-110i-k1m-t01',
    modelName: 'Honda Wave 110i (LED 2021–2024 · K1M-T01)',
    displacementCc: 110,
    yearRange: '2021–2024',
    category: 'underbone',
    ecuFamily: 'Keihin K1M-T01 (Smart Engine)',
    ecmPartNumber: '38770-K1M-T01',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 32768,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9200,
    defaultIdleRpm: 1400,
    maxRpmAxis: [1400, 2200, 3200, 4200, 5200, 6200, 7200, 8200, 9200, 10500],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.72,
    ignBaseOffset: 0,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Wave 110i LED กล่อง K1M-T01 รีแมพจูนหัวฉีด เดินหอบ ปลดรอบ และชดเชย E20/E85',
  },
  {
    id: 'wave-110i-k2j-t01',
    modelName: 'Honda Wave 110i (กล่องตลับเกม · K2J-T01)',
    displacementCc: 110,
    yearRange: '2021–2025',
    category: 'underbone',
    ecuFamily: 'Keihin K2J (กล่องตลับเกม)',
    ecmPartNumber: '38770-K2J-T01',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 17)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9300,
    defaultIdleRpm: 1400,
    maxRpmAxis: [1400, 2200, 3200, 4200, 5200, 6200, 7200, 8200, 9200, 10600],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.73,
    ignBaseOffset: 0.5,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Wave 110i LED กล่องตลับเกม เบอร์ K2J-T01 จูนปลดรอบ ตัดยิง-เดินหอบ และจ่ายน้ำมันรอบปลาย',
  },
  {
    id: 'wave-110i-k2j-th1',
    modelName: 'Honda Wave 110i (กล่องตลับเกม · K2J-TH1)',
    displacementCc: 110,
    yearRange: '2022–2026',
    category: 'underbone',
    ecuFamily: 'Keihin K2J (กล่องตลับเกม TH)',
    ecmPartNumber: '38770-K2J-TH1',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 17)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9300,
    defaultIdleRpm: 1400,
    maxRpmAxis: [1400, 2200, 3200, 4200, 5200, 6200, 7200, 8200, 9200, 10600],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.73,
    ignBaseOffset: 0.5,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Wave 110i LED กล่องตลับเกมรหัสไทย K2J-TH1 ปรับน้ำมัน องศาไฟ และปลดลิมิตรอบ',
  },
  {
    id: 'wave-110i-k58-t81',
    modelName: 'Honda Wave 110i (LED 2019–2020 · K58-T81)',
    displacementCc: 109,
    yearRange: '2019–2020',
    category: 'underbone',
    ecuFamily: 'Keihin K58-T81 (LED)',
    ecmPartNumber: '38770-K58-T81',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 32768,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9800,
    defaultIdleRpm: 1400,
    maxRpmAxis: [
      840, 1100, 1200, 1300, 1400, 1500, 1600, 1800, 2000, 2250, 2500, 2750, 3000, 3250, 3500,
      4000, 4500, 5000, 5500, 6000, 6500, 7000, 7500, 7750, 8000, 8500, 9000, 9500, 9800,
    ],
    tpsAxis: [
      0.0, 0.4, 0.8, 1.2, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0, 8.0, 10.0, 12.0, 14.0, 16.0, 18.0, 20.0,
      25.0, 30.0, 34.9, 39.8, 50.0, 59.9, 65.0, 72.5,
    ],
    fuelBaseMultiplier: 0.73,
    ignBaseOffset: 0.5,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'กล่องฮิต Wave 110i LED เบอร์ 38770-K58-T81 (k58t81) ตาราง 25 TPS × 29 RPM ครบ 14 หัวข้อ XDF จูนเดินหอบ/E85',
  },
  {
    id: 'wave-110i-k58-tc2',
    modelName: 'Honda Wave 110i (LED 2019–2020 · K58-TC2)',
    displacementCc: 109,
    yearRange: '2019–2020',
    category: 'underbone',
    ecuFamily: 'Keihin K58-TC2 (LED)',
    ecmPartNumber: '38770-K58-TC2',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 32768,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9300,
    defaultIdleRpm: 1400,
    maxRpmAxis: [1400, 2200, 3200, 4200, 5200, 6200, 7200, 8200, 9200, 10800],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.73,
    ignBaseOffset: 0.5,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Wave 110i LED เบอร์กล่อง K58-TC2 (ตระกูลเดียวกับ K58-T81) รีแมพจูนน้ำมันและเดินหอบ',
  },
  {
    id: 'wave-110i-k58-tc1',
    modelName: 'Honda Wave 110i (S4 ไมล์ส้ม · K58-TC1)',
    displacementCc: 109,
    yearRange: '2014–2018',
    category: 'underbone',
    ecuFamily: 'Keihin K58-TC1 / T01 / T51',
    ecmPartNumber: '38770-K58-TC1',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 32768,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9200,
    defaultIdleRpm: 1400,
    maxRpmAxis: [1400, 2200, 3200, 4200, 5200, 6200, 7200, 8200, 9200, 10800],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.72,
    ignBaseOffset: 0,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Wave 110i S4 เบอร์ K58-TC1 / K58-T01 รหัสกล่องยอดนิยมอันดับ 1 สำหรับรีแมพ 110i',
  },
  {
    id: 'wave-110i-k03-h01',
    modelName: 'Honda Wave 110i (K03-H01 · 64KB)',
    displacementCc: 109,
    yearRange: '2014–2018',
    category: 'underbone',
    ecuFamily: 'Keihin K03 (64KB ROM)',
    ecmPartNumber: '38770-K03-H01',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9200,
    defaultIdleRpm: 1400,
    maxRpmAxis: [1400, 2200, 3200, 4200, 5200, 6200, 7200, 8200, 9200, 10600],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.72,
    ignBaseOffset: 0,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Wave 110i กล่อง 64KB เบอร์ K03-H01 จูนชดเชยแคม-ท่อ-หัวฉีด และปลดรอบ',
  },
  {
    id: 'wave-110i-k03-t61',
    modelName: 'Honda Wave 110i (K03-T61 · 64KB)',
    displacementCc: 109,
    yearRange: '2013–2017',
    category: 'underbone',
    ecuFamily: 'Keihin K03-T61 (64KB ROM)',
    ecmPartNumber: '38770-K03-T61',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9200,
    defaultIdleRpm: 1400,
    maxRpmAxis: [1400, 2200, 3200, 4200, 5200, 6200, 7200, 8200, 9200, 10600],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.72,
    ignBaseOffset: 0,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Wave 110i เบอร์กล่อง K03-T61 (64KB) ปรับตารางจ่ายน้ำมันและองศาไฟจุดระเบิดครบ',
  },
  {
    id: 'wave-110i-kww-641',
    modelName: 'Honda Wave 110i (S3 ไมล์ฟ้า · KWW-641)',
    displacementCc: 109,
    yearRange: '2011–2013',
    category: 'underbone',
    ecuFamily: 'Keihin KWW-641 / KWW-621',
    ecmPartNumber: '38770-KWW-641',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 32768,
    checksumAlgorithm: 'keihin-8bit-twos',
    defaultRevLimit: 9000,
    defaultIdleRpm: 1400,
    maxRpmAxis: [1400, 2200, 3200, 4200, 5200, 6200, 7200, 8200, 9200, 10400],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.71,
    ignBaseOffset: 0,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Wave 110i S3 ไมล์ฟ้า กล่อง KWW-641 / 621 รีแมพจูนน้ำมัน องศาไฟ และปลดรอบ',
  },
  {
    id: 'wave-110i-kww-643',
    modelName: 'Honda Wave 110i (สตาร์ทเท้า S3 · KWW-643)',
    displacementCc: 109,
    yearRange: '2011–2013',
    category: 'underbone',
    ecuFamily: 'Keihin KWW-643 (R8C)',
    ecmPartNumber: '38770-KWW-643',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 32768,
    checksumAlgorithm: 'keihin-8bit-twos',
    defaultRevLimit: 9000,
    defaultIdleRpm: 1400,
    maxRpmAxis: [1400, 2200, 3200, 4200, 5200, 6200, 7200, 8200, 9200, 10400],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.71,
    ignBaseOffset: 0,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Wave 110i รุ่นสตาร์ทเท้า ไมล์ฟ้า เบอร์ KWW-643 บอร์ด Keihin R8C รีแมพจูนไฟ/น้ำมัน',
  },
  {
    id: 'wave-110i-kwb',
    modelName: 'Honda Wave 110i (ตัวแรก KWB)',
    displacementCc: 109,
    yearRange: '2009–2010',
    category: 'underbone',
    ecuFamily: 'Keihin KWB-601 / 901',
    ecmPartNumber: '38770-KWB-601',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 32768,
    checksumAlgorithm: 'keihin-8bit-twos',
    defaultRevLimit: 8900,
    defaultIdleRpm: 1400,
    maxRpmAxis: [1400, 2200, 3200, 4200, 5200, 6200, 7200, 8200, 9000, 10200],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.7,
    ignBaseOffset: 0,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Wave 110i รุ่นแรก กล่อง KWB-601 สแกนโค้ดและจูนหัวฉีดผ่านสาย K-Line',
  },
  {
    id: 'wave-125i-k2p',
    modelName: 'Honda Wave 125i (LED 2023–2026 · K2P)',
    displacementCc: 124,
    yearRange: '2023–2026',
    category: 'underbone',
    ecuFamily: 'Keihin K2P (Smart Engine)',
    ecmPartNumber: '38770-K2P-T01',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 17)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9500,
    defaultIdleRpm: 1400,
    maxRpmAxis: [1400, 2400, 3400, 4400, 5400, 6400, 7400, 8400, 9400, 10800],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.81,
    ignBaseOffset: 1,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Wave 125i โฉมล่าสุดเครื่อง Smart Engine เบอร์ K2P-T01 จูนลูก 56–59 มิล และปลดรอบ',
  },
  {
    id: 'wave-125i-k73-t61',
    modelName: 'Honda Wave 125i (LED 2018–2022 · K73-T61)',
    displacementCc: 125,
    yearRange: '2018–2022',
    category: 'underbone',
    ecuFamily: 'Keihin K73-T61 (LED)',
    ecmPartNumber: '38770-K73-T61',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 32768,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9400,
    defaultIdleRpm: 1400,
    maxRpmAxis: [1400, 2400, 3400, 4400, 5400, 6400, 7400, 8400, 9400, 10800],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.8,
    ignBaseOffset: 1,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Wave 125i ไฟหน้า LED เบอร์ยอดฮิต K73-T61 (ใช้ร่วมกับ K73-T01) รีแมพปรับเดินหอบ/ยิงไฟ',
  },
  {
    id: 'wave-125i-k73-t31',
    modelName: 'Honda Wave 125i (ปลาวาฬ · K73-T31 / KYZ)',
    displacementCc: 125,
    yearRange: '2012–2017',
    category: 'underbone',
    ecuFamily: 'Keihin K73-T31 / KYZ',
    ecmPartNumber: '38770-K73-T31',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 32768,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9300,
    defaultIdleRpm: 1400,
    maxRpmAxis: [1400, 2400, 3400, 4400, 5400, 6400, 7400, 8400, 9400, 10600],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.79,
    ignBaseOffset: 0.5,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Wave 125i ปลาวาฬ กล่อง K73-T31 / KYZ-T01 ยอดนิยมสายทัวร์ริ่งและสายซิ่ง 125',
  },
  {
    id: 'wave-125i-kyz-t41',
    modelName: 'Honda Wave 125i (ปลาวาฬ ไมล์แดง · KYZ-T41)',
    displacementCc: 125,
    yearRange: '2014–2019',
    category: 'underbone',
    ecuFamily: 'Keihin KYZ-T41 (64KB)',
    ecmPartNumber: '38770-KYZ-T41',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9300,
    defaultIdleRpm: 1400,
    maxRpmAxis: [1400, 2400, 3400, 4400, 5400, 6400, 7400, 8400, 9400, 10600],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.79,
    ignBaseOffset: 0.5,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Wave 125i ปลาวาฬ / ไมล์แดง กล่อง 64KB เบอร์ KYZ-T41 จูนเดินหอบ ปลดรอบ และชดเชยหัวฉีด',
  },
  {
    id: 'wave-125i-kph',
    modelName: 'Honda Wave 125i (บังลม · KPH)',
    displacementCc: 125,
    yearRange: '2005–2011',
    category: 'underbone',
    ecuFamily: 'Keihin KPH (PGM-FI Gen 1)',
    ecmPartNumber: '38770-KPH-701',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 32768,
    checksumAlgorithm: 'keihin-8bit-twos',
    defaultRevLimit: 9100,
    defaultIdleRpm: 1400,
    maxRpmAxis: [1400, 2400, 3400, 4400, 5400, 6400, 7400, 8400, 9200, 10200],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.78,
    ignBaseOffset: 0,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Wave 125i บังลม กล่อง KPH-701 / 901 อ่านค่าเซนเซอร์และลบโค้ดไฟโชว์',
  },
  {
    id: 'supercub-kzv',
    modelName: 'Honda Super Cub / Dream 110i (ไฟกลม KZV)',
    displacementCc: 109,
    yearRange: '2018–2026',
    category: 'underbone',
    ecuFamily: 'Keihin KZV / K89',
    ecmPartNumber: '38770-KZV-T01',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 32768,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9200,
    defaultIdleRpm: 1400,
    maxRpmAxis: [1400, 2200, 3200, 4200, 5200, 6200, 7200, 8200, 9200, 10500],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.72,
    ignBaseOffset: 0,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Super Cub ไฟกลม / ดรีมซุปเปอร์คัพ กล่อง KZV-T01 จูนชดเชยแคม-ท่อ-E85',
  },
  {
    id: 'dream-supercub-kzv-a61',
    modelName: 'Honda Dream 110i / Super Cub (KZV-A61 · 64KB)',
    displacementCc: 109,
    yearRange: '2014–2018',
    category: 'underbone',
    ecuFamily: 'Keihin KZV-A61 (64KB)',
    ecmPartNumber: '38770-KZV-A61',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9200,
    defaultIdleRpm: 1400,
    maxRpmAxis: [1400, 2200, 3200, 4200, 5200, 6200, 7200, 8200, 9200, 10500],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.72,
    ignBaseOffset: 0,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Dream 110i / Super Cub กล่อง 64KB เบอร์ KZV-A61 จูนลูก 53-54 ปลดรอบ และเดินหอบ',
  },
  {
    id: 'dream-supercub-kzv-t03',
    modelName: 'Honda Dream 110i / Super Cub (KZV-T03 · 48KB)',
    displacementCc: 109,
    yearRange: '2011–2014',
    category: 'underbone',
    ecuFamily: 'Keihin KZV-T03 (48KB)',
    ecmPartNumber: '38770-KZV-T03',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 49152,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9100,
    defaultIdleRpm: 1400,
    maxRpmAxis: [1400, 2200, 3200, 4200, 5200, 6200, 7200, 8200, 9200, 10400],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.71,
    ignBaseOffset: 0,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Dream 110i / Super Cub รุ่นแรก กล่อง 48KB เบอร์ KZV-T03 จูนไฟและน้ำมันแก้สะดุด',
  },
  {
    id: 'supercub-kww-b21',
    modelName: 'Honda Super Cub 110i (ไฟเหลี่ยม KWW-B21)',
    displacementCc: 109,
    yearRange: '2013–2017',
    category: 'underbone',
    ecuFamily: 'Keihin KWW-B21 / K03',
    ecmPartNumber: '38770-KWW-B21',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 32768,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9100,
    defaultIdleRpm: 1400,
    maxRpmAxis: [1400, 2200, 3200, 4200, 5200, 6200, 7200, 8200, 9200, 10400],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.72,
    ignBaseOffset: 0,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Super Cub ไฟเหลี่ยม / Dream 110i (K03) รองรับรีแมพปลดรอบและจูนหัวฉีด',
  },
  {
    id: 'ct125-k2e',
    modelName: 'Honda CT125 (Hunter Cub · K2E)',
    displacementCc: 124,
    yearRange: '2020–2026',
    category: 'underbone',
    ecuFamily: 'Keihin K2E (5-Speed / Smart)',
    ecmPartNumber: '38770-K2E-T01',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 17)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9400,
    defaultIdleRpm: 1400,
    maxRpmAxis: [1400, 2400, 3400, 4400, 5400, 6400, 7400, 8400, 9400, 10600],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.81,
    ignBaseOffset: 1,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'CT125 เบอร์กล่อง K2E-T01 ปรับเพิ่มแรงบิดรอบต่ำสำหรับไต่ทางชันและจูนกรอง/ท่อแต่ง',
  },
  {
    id: 'c125-k0g',
    modelName: 'Honda Super Cub C125 (K0G)',
    displacementCc: 124,
    yearRange: '2019–2026',
    category: 'underbone',
    ecuFamily: 'Keihin K0G (Smart Key)',
    ecmPartNumber: '38770-K0G-T01',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 32768,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9300,
    defaultIdleRpm: 1400,
    maxRpmAxis: [1400, 2400, 3400, 4400, 5400, 6400, 7400, 8400, 9400, 10500],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.8,
    ignBaseOffset: 1,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Super Cub C125 เบอร์กล่อง K0G-T01 จูนไฟ-น้ำมันให้เดินเรียบและเพิ่มความเร็วปลาย',
  },
  {
    id: 'dax-125-k2w',
    modelName: 'Honda Dax 125 (ST125 · K2W)',
    displacementCc: 124,
    yearRange: '2022–2026',
    category: 'underbone',
    ecuFamily: 'Keihin K2W (Smart Engine)',
    ecmPartNumber: '38770-K2W-T01',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 17)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9500,
    defaultIdleRpm: 1450,
    maxRpmAxis: [1450, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 10800],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.82,
    ignBaseOffset: 1,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Dax 125 กล่อง K2W-T01 ปรับตารางน้ำมัน/องศาไฟ และ Auto-Tune AFR ผ่าน K-Line',
  },
  {
    id: 'msx-grom-k26-g01',
    modelName: 'Honda MSX 125SF / Grom 125 (5-Speed)',
    displacementCc: 125,
    yearRange: '2016–2026',
    category: 'underbone',
    ecuFamily: 'Keihin K26G / K26-B01',
    ecmPartNumber: '38770-K26-G01',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 32768,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9500,
    defaultIdleRpm: 1450,
    maxRpmAxis: [1450, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 11000],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.82,
    ignBaseOffset: 1.5,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'MSX 125SF / Grom 5 เกียร์ กล่อง K26-G01 เหมาะจูนแคม-ท่อ-ลิ้นโต และเดินหอบ',
  },
  {
    id: 'msx-125sf-k26-b02',
    modelName: 'Honda MSX 125SF (ไฟ 2 ตา LED · K26-B02)',
    displacementCc: 125,
    yearRange: '2016–2020',
    category: 'underbone',
    ecuFamily: 'Keihin K26-B02 (LED Double-Eye)',
    ecmPartNumber: '38770-K26-B02',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 32768,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9500,
    defaultIdleRpm: 1450,
    maxRpmAxis: [1450, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 11000],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.82,
    ignBaseOffset: 1.5,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'MSX 125SF ไฟหน้า LED 2 ชั้น กล่อง K26-B02 จูนเดินหอบ ปลดรอบ และชดเชยหัวฉีดแต่ง',
  },
  {
    id: 'msx-125-k26-901',
    modelName: 'Honda MSX 125 (ตัวแรกไฟตาเดียว K26)',
    displacementCc: 125,
    yearRange: '2013–2015',
    category: 'underbone',
    ecuFamily: 'Keihin K26-901',
    ecmPartNumber: '38770-K26-901',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 32768,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9400,
    defaultIdleRpm: 1450,
    maxRpmAxis: [1450, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 10800],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.81,
    ignBaseOffset: 1,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'MSX 125 ตัวเก่าไฟตาเดียว กล่อง K26-901 จูนน้ำมันและปลดรอบตัด 10,800 RPM',
  },
  {
    id: 'monkey-125-k0f',
    modelName: 'Honda Monkey 125 (Z125M · K0F)',
    displacementCc: 125,
    yearRange: '2018–2026',
    category: 'underbone',
    ecuFamily: 'Keihin K0F (4/5-Speed)',
    ecmPartNumber: '38770-K0F-T01',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 17)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 9500,
    defaultIdleRpm: 1450,
    maxRpmAxis: [1450, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 11000],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.82,
    ignBaseOffset: 1.5,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Monkey 125 กล่อง K0F-T01 ปรับตารางจ่ายน้ำมันและองศาไฟจุดระเบิดสำหรับชุดคิทแต่ง',
  },
  {
    id: 'sonic-rs150r-k56',
    modelName: 'Honda Sonic 150R / Winner 150 (K56)',
    displacementCc: 149,
    yearRange: '2016–2025',
    category: 'underbone',
    ecuFamily: 'Keihin K56 (DOHC 6-Speed)',
    ecmPartNumber: '38770-K56-N01',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 17)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 11000,
    defaultIdleRpm: 1500,
    maxRpmAxis: [1500, 2800, 4000, 5200, 6500, 7800, 9000, 10200, 11200, 12200],
    tpsAxis: [0, 5, 12, 22, 35, 50, 70, 85, 100],
    fuelBaseMultiplier: 0.96,
    ignBaseOffset: 2,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'กระเทย 150cc DOHC 6 เกียร์ กล่อง K56-N01 จูนปลดรอบ 12,000+ RPM',
  },

  // ===================== TRAIL / DUAL-SPORT / ADVENTURE =====================
  {
    id: 'crf-300l-k1t',
    modelName: 'Honda CRF300L / CRF300 Rally (2020–2026)',
    displacementCc: 286,
    yearRange: '2020–2026',
    category: 'trail',
    ecuFamily: 'Keihin SH705x (K1T)',
    ecmPartNumber: '38770-K1T-T01',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 17)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'honda-sh705x-32bit',
    defaultRevLimit: 10200,
    defaultIdleRpm: 1500,
    maxRpmAxis: [1500, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 10800],
    tpsAxis: [0, 5, 12, 22, 35, 50, 70, 85, 100],
    fuelBaseMultiplier: 1.25,
    ignBaseOffset: 2,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'CRF300L / Rally กล่อง K1T-T01 ปลดกำลังรอบกลาง-ปลาย ปิด O2 Sensor และแก้สะดุดรอบต่ำ',
  },
  {
    id: 'crf-250l-kzz-901',
    modelName: 'Honda CRF250L / CRF250M (Gen 1)',
    displacementCc: 250,
    yearRange: '2013–2016',
    category: 'trail',
    ecuFamily: 'Keihin KZZ-901 (SH7055)',
    ecmPartNumber: '38770-KZZ-901',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'honda-sh705x-32bit',
    defaultRevLimit: 10500,
    defaultIdleRpm: 1500,
    maxRpmAxis: [1500, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 11000],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 1.18,
    ignBaseOffset: 2,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'CRF250L / M ตัวแรก กล่อง KZZ-901 (SH7055 Checksum 32-bit) ยอดนิยมสายลุยไทย',
  },
  {
    id: 'crf-250-rally-kzz-j01',
    modelName: 'Honda CRF250L / Rally (เรือนไมล์ดิจิตอล)',
    displacementCc: 250,
    yearRange: '2017–2020',
    category: 'trail',
    ecuFamily: 'Keihin KZZ-J01 (SH7058)',
    ecmPartNumber: '38770-KZZ-J01',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 17)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'honda-sh705x-32bit',
    defaultRevLimit: 10500,
    defaultIdleRpm: 1500,
    maxRpmAxis: [1500, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 11000],
    tpsAxis: [0, 5, 12, 22, 35, 50, 70, 85, 100],
    fuelBaseMultiplier: 1.2,
    ignBaseOffset: 2,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'CRF250L / Rally โฉมปี 2017–2020 เบอร์ KZZ-J01 จูนรับท่อฟูลและกรองแต่ง',
  },
  {
    id: 'xadv-750-mkt',
    modelName: 'Honda X-ADV 750 / NC750X (DCT)',
    displacementCc: 745,
    yearRange: '2017–2026',
    category: 'trail',
    ecuFamily: 'Keihin SH72543 (MKT / MKH)',
    ecmPartNumber: '38770-MKT-D01',
    protocolLabel: 'Honda K-Line / CAN (10,400 bps)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'honda-sh725xx-crc16',
    defaultRevLimit: 7500,
    defaultIdleRpm: 1200,
    maxRpmAxis: [1200, 1800, 2500, 3200, 4000, 4800, 5600, 6400, 7200, 8000],
    tpsAxis: [0, 5, 10, 20, 35, 50, 70, 85, 100],
    fuelBaseMultiplier: 1.55,
    ignBaseOffset: 2,
    hasVvaOrVtec: false,
    hasTcs: true,
    notes: 'X-ADV 750 / NC750X กล่อง MKT-D01 จูนแรงบิดช่วงกลาง ปลดความเร็วปลาย และ HSTC',
  },
  {
    id: 'transalp-750-mlc',
    modelName: 'Honda XL750 Transalp',
    displacementCc: 755,
    yearRange: '2023–2026',
    category: 'trail',
    ecuFamily: 'Keihin SH72543 (MLC)',
    ecmPartNumber: '38770-MLC-D01',
    protocolLabel: 'Honda K-Line / CAN (10,400 bps)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'honda-sh725xx-crc16',
    defaultRevLimit: 10200,
    defaultIdleRpm: 1300,
    maxRpmAxis: [1300, 2200, 3200, 4200, 5200, 6200, 7200, 8200, 9200, 10500],
    tpsAxis: [0, 5, 10, 20, 35, 50, 70, 85, 100],
    fuelBaseMultiplier: 1.62,
    ignBaseOffset: 2.5,
    hasVvaOrVtec: false,
    hasTcs: true,
    notes: 'XL750 Transalp 2 สูบ 270° จูนปลดทอร์คเกียร์ 1–3 และจูนคันเร่งไฟฟ้า',
  },

  // ===================== SPORT / NAKED / CRUISER / BIGBIKE =====================
  {
    id: 'cbr-150r-k45-n01',
    modelName: 'Honda CBR150R / CB150R (DOHC K45)',
    displacementCc: 149,
    yearRange: '2017–2021',
    category: 'sport',
    ecuFamily: 'Keihin K45 / K94',
    ecmPartNumber: '38770-K45-N01',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 17)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 11200,
    defaultIdleRpm: 1500,
    maxRpmAxis: [1500, 2800, 4000, 5200, 6500, 7800, 9000, 10200, 11200, 12200],
    tpsAxis: [0, 5, 12, 22, 35, 50, 70, 85, 100],
    fuelBaseMultiplier: 0.98,
    ignBaseOffset: 2.5,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'CBR150R / CB150R ExMotion กล่อง K45-N01 ปลดรอบได้ถึง 12,200 RPM จูนไฟรอบปลาย',
  },
  {
    id: 'cbr-150r-k45-n41',
    modelName: 'Honda All-New CBR150R (USD 2021–2026)',
    displacementCc: 149,
    yearRange: '2021–2026',
    category: 'sport',
    ecuFamily: 'Keihin K45R (Assist/Slipper)',
    ecmPartNumber: '38770-K45-N41',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 17)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 11400,
    defaultIdleRpm: 1500,
    maxRpmAxis: [1500, 2800, 4000, 5200, 6500, 7800, 9000, 10200, 11400, 12500],
    tpsAxis: [0, 5, 12, 22, 35, 50, 70, 85, 100],
    fuelBaseMultiplier: 0.99,
    ignBaseOffset: 2.5,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'CBR150R โฉมโช้คหัวกลับ USD เบอร์กล่อง K45-N41 ปรับจูนน้ำมันและปลดรอบ 12,500 RPM',
  },
  {
    id: 'cb150r-k94',
    modelName: 'Honda CB150R ExMotion / Streetster (K94)',
    displacementCc: 149,
    yearRange: '2017–2025',
    category: 'sport',
    ecuFamily: 'Keihin K94 (Neo Sports Café)',
    ecmPartNumber: '38770-K94-T01',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 17)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 11200,
    defaultIdleRpm: 1500,
    maxRpmAxis: [1500, 2800, 4000, 5200, 6500, 7800, 9000, 10200, 11200, 12200],
    tpsAxis: [0, 5, 12, 22, 35, 50, 70, 85, 100],
    fuelBaseMultiplier: 0.97,
    ignBaseOffset: 2.5,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'CB150R ExMotion กล่อง K94-T01 รีแมพจูนรอบต้น-กลาง และปรับ Backfire ตอนถอนคันเร่ง',
  },
  {
    id: 'cb150r-k94-t02',
    modelName: 'Honda CB150R / CBR150R (K94-T02 หอบ·ปลดรอบ)',
    displacementCc: 149,
    yearRange: '2017–2020',
    category: 'sport',
    ecuFamily: 'Keihin K94-T02 (DOHC)',
    ecmPartNumber: '38770-K94-T02',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 17)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 11500,
    defaultIdleRpm: 1500,
    maxRpmAxis: [1500, 2800, 4000, 5200, 6500, 7800, 9000, 10200, 11400, 12500],
    tpsAxis: [0, 5, 12, 22, 35, 50, 70, 85, 100],
    fuelBaseMultiplier: 0.98,
    ignBaseOffset: 2.5,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'CB150R / CBR150R เบอร์กล่อง K94-T02 พร้อมฐานข้อมูลจูนเดินหอบ ปลดรอบ 12,500 และยิงถอนคันเร่ง',
  },
  {
    id: 'cbr-150r-kpp',
    modelName: 'Honda CBR150R (โฉมหัวฉีดรุ่นแรก KPP)',
    displacementCc: 149,
    yearRange: '2010–2016',
    category: 'sport',
    ecuFamily: 'Keihin KPP (PGM-FI)',
    ecmPartNumber: '38770-KPP-T01',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 32768,
    checksumAlgorithm: 'keihin-16bit-sum',
    defaultRevLimit: 11000,
    defaultIdleRpm: 1500,
    maxRpmAxis: [1500, 2800, 4000, 5200, 6500, 7800, 9000, 10200, 11000, 12000],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 0.95,
    ignBaseOffset: 2,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'CBR150R หัวฉีดโฉมแรก กล่อง KPP-T01 จูนเพิ่มน้ำมันหัวฉีดแต่งและปลดลิมิตรอบ',
  },
  {
    id: 'cbr-250r-kyj',
    modelName: 'Honda CBR250R (1 สูบ 2011–2014 · KYJ)',
    displacementCc: 249,
    yearRange: '2011–2014',
    category: 'sport',
    ecuFamily: 'Keihin KYJ (SH7055)',
    ecmPartNumber: '38770-KYJ-901',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'honda-sh705x-32bit',
    defaultRevLimit: 10500,
    defaultIdleRpm: 1500,
    maxRpmAxis: [1500, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 11000],
    tpsAxis: [0, 5, 12, 25, 40, 55, 70, 85, 100],
    fuelBaseMultiplier: 1.16,
    ignBaseOffset: 2,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'CBR250R (2011–2014) สูบเดียว กล่อง KYJ-901 จูนชดเชยท่อแต่งและลดอุณหภูมิเปิดพัดลมหม้อน้ำ',
  },
  {
    id: 'cbr-300r-k33',
    modelName: 'Honda CBR300R / CB300F (1 สูบ K33)',
    displacementCc: 286,
    yearRange: '2014–2018',
    category: 'sport',
    ecuFamily: 'Keihin K33 (SH705x)',
    ecmPartNumber: '38770-K33-D01',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'honda-sh705x-32bit',
    defaultRevLimit: 10500,
    defaultIdleRpm: 1500,
    maxRpmAxis: [1500, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 11000],
    tpsAxis: [0, 5, 12, 22, 35, 50, 70, 85, 100],
    fuelBaseMultiplier: 1.24,
    ignBaseOffset: 2,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'CBR300R / CB300F กล่อง K33-D01 ปลดรอบ 11,000 RPM และจูนไฟจุดระเบิดเพิ่มทอร์ค',
  },
  {
    id: 'cb300r-k0a',
    modelName: 'Honda CB300R (Neo Sports Café K0A)',
    displacementCc: 286,
    yearRange: '2018–2025',
    category: 'sport',
    ecuFamily: 'Keihin K0A (SH7253x)',
    ecmPartNumber: '38770-K0A-T01',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 17)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'honda-sh705x-32bit',
    defaultRevLimit: 10500,
    defaultIdleRpm: 1500,
    maxRpmAxis: [1500, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 9500, 11000],
    tpsAxis: [0, 5, 12, 22, 35, 50, 70, 85, 100],
    fuelBaseMultiplier: 1.25,
    ignBaseOffset: 2,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'CB300R ไฟกลม K0A-T01 ปรับตารางน้ำมัน/ไฟ แก้อาการยิงเบาตอนถอนคันเร่ง',
  },
  {
    id: 'cbr-250rr-k64',
    modelName: 'Honda CBR250RR (2 สูบ Ride-by-Wire)',
    displacementCc: 249,
    yearRange: '2017–2026',
    category: 'sport',
    ecuFamily: 'Keihin SH72531 (K64)',
    ecmPartNumber: '38770-K64-N02',
    protocolLabel: 'Honda K-Line / CAN (10,400 bps)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'honda-sh725xx-crc16',
    defaultRevLimit: 14200,
    defaultIdleRpm: 1600,
    maxRpmAxis: [1600, 3000, 4500, 6000, 7500, 9000, 10500, 12000, 13500, 15000],
    tpsAxis: [0, 5, 10, 20, 35, 50, 70, 85, 100],
    fuelBaseMultiplier: 1.15,
    ignBaseOffset: 3,
    hasVvaOrVtec: false,
    hasTcs: true,
    notes: '2 สูบเรียง 14,200+ RPM รองรับ Quickshifter, Fan Temp และ Checksum CRC-16',
  },
  {
    id: 'rebel-300-k87',
    modelName: 'Honda Rebel 300 (CMX300 · K87)',
    displacementCc: 286,
    yearRange: '2017–2025',
    category: 'sport',
    ecuFamily: 'Keihin K87 (SH705x)',
    ecmPartNumber: '38770-K87-T01',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 17)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'honda-sh705x-32bit',
    defaultRevLimit: 10000,
    defaultIdleRpm: 1450,
    maxRpmAxis: [1450, 2400, 3400, 4400, 5400, 6400, 7400, 8400, 9400, 10500],
    tpsAxis: [0, 5, 12, 22, 35, 50, 70, 85, 100],
    fuelBaseMultiplier: 1.24,
    ignBaseOffset: 1.5,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Rebel 300 กล่อง K87-T01 จูนชดเชยท่อแต่งและลดความร้อนเครื่องยนต์',
  },
  {
    id: 'rebel-500-k87-a31',
    modelName: 'Honda Rebel 500 (CMX500) / CL500',
    displacementCc: 471,
    yearRange: '2017–2026',
    category: 'sport',
    ecuFamily: 'Keihin SH72531 (K87 / K3S)',
    ecmPartNumber: '38770-K87-A31',
    protocolLabel: 'Honda K-Line / Euro5 (10,400 bps)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'honda-sh705x-32bit',
    defaultRevLimit: 8800,
    defaultIdleRpm: 1250,
    maxRpmAxis: [1250, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 9800],
    tpsAxis: [0, 5, 10, 20, 35, 50, 70, 85, 100],
    fuelBaseMultiplier: 1.46,
    ignBaseOffset: 2,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'Rebel 500 / CL500 Scrambler กล่องตระกูล 471cc จูนเพิ่มแรงบิดรอบต่ำและปลดท็อปสปีด',
  },
  {
    id: 'cbr-500r-mkp',
    modelName: 'Honda CBR500R / CB500F / CB500X / NX500',
    displacementCc: 471,
    yearRange: '2019–2026',
    category: 'sport',
    ecuFamily: 'Keihin SH72531 (MKP)',
    ecmPartNumber: '38770-MKP-T01',
    protocolLabel: 'Honda K-Line / Euro5 (10,400 bps)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'honda-sh705x-32bit',
    defaultRevLimit: 8800,
    defaultIdleRpm: 1250,
    maxRpmAxis: [1250, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 9800],
    tpsAxis: [0, 5, 10, 20, 35, 50, 70, 85, 100],
    fuelBaseMultiplier: 1.48,
    ignBaseOffset: 2,
    hasVvaOrVtec: false,
    hasTcs: true,
    notes: 'ตระกูล 500cc 2 สูบ (MKP-T01 / MLJ) จูนแก้กระตุกรอบต่ำ ปลดรอบ และตั้งพัดลมหม้อน้ำทำงานเร็วขึ้น',
  },
  {
    id: 'cb500x-mgz',
    modelName: 'Honda CB500X / CBR500R / CB500F (Gen 1–2)',
    displacementCc: 471,
    yearRange: '2013–2018',
    category: 'sport',
    ecuFamily: 'Keihin MGZ (SH7058)',
    ecmPartNumber: '38770-MGZ-D01',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 11)',
    baudRate: 10400,
    klineTableId: 0x11,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'honda-sh705x-32bit',
    defaultRevLimit: 8600,
    defaultIdleRpm: 1250,
    maxRpmAxis: [1250, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 8800, 9500],
    tpsAxis: [0, 5, 12, 22, 35, 50, 70, 85, 100],
    fuelBaseMultiplier: 1.45,
    ignBaseOffset: 1.5,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'ตระกูล 500cc โฉมแรก-โฉม 2 กล่อง MGZ-D01 จูนท่อฟูล ปลดความเร็วปลาย และจูน Auto-Tune',
  },
  {
    id: 'cb-650r-mkn',
    modelName: 'Honda CB650R / CBR650R (4 สูบเรียง · E-Clutch)',
    displacementCc: 649,
    yearRange: '2019–2026',
    category: 'sport',
    ecuFamily: 'Keihin SH72543 (MKN)',
    ecmPartNumber: '38770-MKN-D51',
    protocolLabel: 'Honda K-Line / CAN (10,400 bps)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'honda-sh725xx-crc16',
    defaultRevLimit: 12500,
    defaultIdleRpm: 1300,
    maxRpmAxis: [1300, 2500, 3800, 5200, 6500, 8000, 9500, 11000, 12200, 13500],
    tpsAxis: [0, 5, 10, 20, 35, 50, 70, 85, 100],
    fuelBaseMultiplier: 1.65,
    ignBaseOffset: 3,
    hasVvaOrVtec: false,
    hasTcs: true,
    notes: '4 สูบเรียง 650cc กล่อง MKN-D51 ปลดม้าเต็ม 95HP+ จูน Quickshifter และ Decel Fuel Cut',
  },
  {
    id: 'cbr-650r-mky-t11',
    modelName: 'Honda CBR650R / CB650R (MKY-T11 · 0–7FFF8)',
    displacementCc: 649,
    yearRange: '2021–2023',
    category: 'sport',
    ecuFamily: 'Keihin SH72543 (MKY-T11 · 512KB)',
    ecmPartNumber: '38770-MKY-T11',
    protocolLabel: 'Honda K-Line / CAN (10,400 bps)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 524288,
    checksumAlgorithm: 'honda-sh725xx-crc16',
    defaultRevLimit: 12600,
    defaultIdleRpm: 1300,
    maxRpmAxis: [1300, 2500, 3800, 5200, 6500, 8000, 9500, 11000, 12200, 13500],
    tpsAxis: [0, 5, 10, 20, 35, 50, 70, 85, 100],
    fuelBaseMultiplier: 1.66,
    ignBaseOffset: 3,
    hasVvaOrVtec: false,
    hasTcs: true,
    notes: 'CBR650R / CB650R เบอร์กล่อง MKY-T11 (ช่วง ROM 0x00000–0x7FFF8 · 512 KB) ปลดม้าเต็มและตั้ง Quickshifter',
  },
  {
    id: 'cb-650f-mje',
    modelName: 'Honda CB650F / CBR650F (4 สูบเรียง MJE)',
    displacementCc: 649,
    yearRange: '2014–2018',
    category: 'sport',
    ecuFamily: 'Keihin SH7058 (MJE)',
    ecmPartNumber: '38770-MJE-D01',
    protocolLabel: 'Honda K-Line (10,400 bps · Table 17)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'honda-sh705x-32bit',
    defaultRevLimit: 12000,
    defaultIdleRpm: 1300,
    maxRpmAxis: [1300, 2500, 3800, 5000, 6500, 8000, 9500, 10800, 12000, 13000],
    tpsAxis: [0, 5, 12, 22, 35, 50, 70, 85, 100],
    fuelBaseMultiplier: 1.62,
    ignBaseOffset: 2.5,
    hasVvaOrVtec: false,
    hasTcs: false,
    notes: 'CB650F / CBR650F กล่อง MJE-D01 ปลดรอบ ปลดความเร็วปลาย และเปิดเสียงปุ้งปั้งตอนถอนคันเร่ง',
  },
  {
    id: 'cb-750-hornet-mlb',
    modelName: 'Honda CB750 Hornet',
    displacementCc: 755,
    yearRange: '2023–2026',
    category: 'sport',
    ecuFamily: 'Keihin SH72543 (MLB)',
    ecmPartNumber: '38770-MLB-D01',
    protocolLabel: 'Honda K-Line / CAN (10,400 bps)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'honda-sh725xx-crc16',
    defaultRevLimit: 10500,
    defaultIdleRpm: 1300,
    maxRpmAxis: [1300, 2200, 3200, 4200, 5200, 6400, 7600, 8800, 9800, 11000],
    tpsAxis: [0, 5, 10, 20, 35, 50, 70, 85, 100],
    fuelBaseMultiplier: 1.64,
    ignBaseOffset: 2.5,
    hasVvaOrVtec: false,
    hasTcs: true,
    notes: 'CB750 Hornet 2 สูบ 91HP ปลดล็อกลิ้นคันเร่งไฟฟ้าช่วงรอบปลายและจูน Quickshifter',
  },
  {
    id: 'cbr-1000rr-mkr',
    modelName: 'Honda CBR1000RR / CBR1000RR-R Fireblade',
    displacementCc: 999,
    yearRange: '2017–2026',
    category: 'sport',
    ecuFamily: 'Keihin SH72543 (MKF / MKR)',
    ecmPartNumber: '38770-MKR-D11',
    protocolLabel: 'Honda K-Line / CAN (10,400 bps)',
    baudRate: 10400,
    klineTableId: 0x17,
    flashSizeBytes: 65536,
    checksumAlgorithm: 'honda-sh725xx-crc16',
    defaultRevLimit: 14500,
    defaultIdleRpm: 1300,
    maxRpmAxis: [1300, 2800, 4200, 5800, 7400, 9000, 10500, 12000, 13500, 15000],
    tpsAxis: [0, 5, 10, 20, 35, 50, 70, 85, 100],
    fuelBaseMultiplier: 1.85,
    ignBaseOffset: 3,
    hasVvaOrVtec: false,
    hasTcs: true,
    notes: 'Superbike 1000cc (MKR / MKF) ปลดล็อกม้าเต็ม 215+ HP ปิด Pair Valve และจูนพัดลมหม้อน้ำ',
  },
];

// Authentic 29 RPM x 25 TPS Fuel 1 map for Wave 110i K58-T81 (ms, 3 decimals)
const K58_T81_FUEL1_MATRIX: number[][] = [
  [3.220, 3.378, 3.535, 3.648, 3.858, 3.999, 4.130, 4.454, 4.804, 5.091, 5.686, 6.111, 6.479, 6.748, 7.003, 7.113, 7.203, 7.222, 7.316, 7.395, 7.450, 7.489, 7.544, 7.587, 8.413],
  [2.891, 3.107, 3.291, 3.440, 3.711, 3.926, 4.114, 4.454, 4.788, 5.091, 5.686, 6.110, 6.479, 6.732, 7.003, 7.113, 7.203, 7.222, 7.316, 7.395, 7.450, 7.489, 7.544, 7.587, 8.413],
  [2.751, 2.955, 3.143, 3.285, 3.581, 3.810, 3.989, 4.353, 4.693, 5.036, 5.661, 6.086, 6.479, 6.738, 7.003, 7.113, 7.203, 7.222, 7.316, 7.395, 7.450, 7.489, 7.544, 7.587, 8.413],
  [2.610, 2.815, 3.020, 3.203, 3.435, 3.626, 3.787, 4.195, 4.543, 4.902, 5.613, 6.035, 6.440, 6.738, 7.003, 7.113, 7.203, 7.222, 7.316, 7.395, 7.450, 7.489, 7.544, 7.587, 8.413],
  [2.449, 2.691, 2.933, 3.125, 3.330, 3.506, 3.653, 3.973, 4.320, 4.668, 5.420, 5.925, 6.371, 6.714, 7.003, 7.113, 7.203, 7.222, 7.316, 7.395, 7.450, 7.489, 7.544, 7.587, 8.413],
  [2.356, 2.595, 2.835, 3.018, 3.230, 3.395, 3.535, 3.816, 4.146, 4.473, 5.171, 5.720, 6.227, 6.611, 6.916, 7.056, 7.190, 7.222, 7.316, 7.395, 7.450, 7.489, 7.544, 7.587, 8.413],
  [2.276, 2.495, 2.747, 2.941, 3.161, 3.315, 3.450, 3.717, 4.007, 4.295, 4.944, 5.500, 6.051, 6.478, 6.795, 6.974, 7.129, 7.178, 7.288, 7.380, 7.444, 7.481, 7.544, 7.587, 8.373],
  [2.099, 2.329, 2.560, 2.817, 3.036, 3.190, 3.312, 3.556, 3.798, 4.035, 4.628, 5.167, 5.783, 6.250, 6.612, 6.799, 6.991, 7.062, 7.179, 7.268, 7.352, 7.388, 7.451, 7.503, 8.215],
  [1.918, 2.161, 2.380, 2.659, 2.896, 3.062, 3.174, 3.391, 3.598, 3.823, 4.383, 4.933, 5.477, 6.009, 6.374, 6.592, 6.800, 6.937, 7.089, 7.164, 7.239, 7.285, 7.346, 7.385, 7.987],
  [1.790, 2.004, 2.207, 2.463, 2.715, 2.879, 3.010, 3.267, 3.506, 3.716, 4.266, 4.827, 5.308, 5.798, 6.119, 6.381, 6.669, 6.980, 7.112, 7.186, 7.253, 7.312, 7.395, 7.461, 8.213],
  [1.651, 1.816, 2.014, 2.292, 2.623, 2.795, 2.954, 3.183, 3.447, 3.671, 4.179, 4.659, 5.168, 5.639, 6.029, 6.321, 6.657, 7.208, 7.406, 7.515, 7.637, 7.697, 7.797, 7.854, 8.612],
  [1.514, 1.681, 1.853, 2.139, 2.524, 2.736, 2.906, 3.130, 3.384, 3.611, 4.093, 4.514, 5.006, 5.479, 5.908, 6.262, 6.666, 7.357, 7.686, 7.821, 7.941, 8.034, 8.097, 8.165, 8.932],
  [1.428, 1.553, 1.717, 1.974, 2.383, 2.642, 2.840, 3.073, 3.348, 3.548, 3.985, 4.368, 4.857, 5.293, 5.728, 6.143, 6.604, 7.369, 7.810, 7.951, 8.036, 8.111, 8.193, 8.253, 9.063],
  [1.348, 1.463, 1.588, 1.815, 2.228, 2.517, 2.746, 3.015, 3.259, 3.460, 3.861, 4.201, 4.652, 5.111, 5.520, 5.929, 6.394, 7.253, 7.880, 8.033, 8.098, 8.191, 8.271, 8.318, 9.145],
  [1.280, 1.388, 1.479, 1.735, 2.097, 2.374, 2.578, 2.927, 3.149, 3.343, 3.726, 4.058, 4.476, 4.902, 5.311, 5.713, 6.196, 7.124, 7.825, 8.054, 8.155, 8.205, 8.284, 8.346, 9.200],
  [1.152, 1.259, 1.348, 1.543, 1.870, 2.158, 2.324, 2.687, 2.960, 3.166, 3.533, 3.813, 4.156, 4.534, 4.912, 5.278, 5.719, 6.807, 7.475, 7.888, 8.081, 8.128, 8.194, 8.231, 9.028],
  [1.038, 1.138, 1.246, 1.358, 1.660, 1.888, 2.065, 2.391, 2.710, 2.932, 3.290, 3.517, 3.849, 4.182, 4.537, 4.849, 5.242, 6.328, 7.151, 7.440, 7.743, 8.005, 8.061, 8.112, 9.052],
  [0.934, 1.033, 1.140, 1.276, 1.492, 1.649, 1.820, 2.151, 2.488, 2.738, 3.058, 3.306, 3.615, 3.918, 4.263, 4.541, 4.858, 5.899, 6.833, 7.222, 7.660, 8.043, 8.177, 8.222, 9.250],
  [0.866, 0.945, 1.048, 1.183, 1.398, 1.550, 1.708, 2.012, 2.311, 2.605, 2.971, 3.229, 3.517, 3.841, 4.131, 4.422, 4.741, 5.709, 6.524, 7.100, 7.642, 8.168, 8.357, 8.420, 9.490],
  [0.821, 0.890, 0.982, 1.086, 1.292, 1.444, 1.584, 1.890, 2.219, 2.533, 2.958, 3.202, 3.535, 3.817, 4.055, 4.333, 4.674, 5.563, 6.335, 6.949, 7.571, 8.154, 8.419, 8.510, 9.700],
  [0.794, 0.837, 0.920, 1.022, 1.208, 1.337, 1.459, 1.758, 2.083, 2.388, 2.876, 3.142, 3.441, 3.730, 3.960, 4.183, 4.456, 5.381, 6.064, 6.673, 7.341, 8.034, 8.390, 8.533, 9.830],
  [0.739, 0.798, 0.886, 0.989, 1.146, 1.257, 1.365, 1.615, 1.879, 2.199, 2.758, 3.009, 3.323, 3.571, 3.802, 4.021, 4.270, 5.096, 5.741, 6.383, 7.070, 7.872, 8.307, 8.453, 9.840],
  [0.721, 0.780, 0.837, 0.952, 1.091, 1.197, 1.286, 1.495, 1.729, 2.034, 2.600, 2.911, 3.170, 3.402, 3.611, 3.853, 4.101, 4.920, 5.516, 6.145, 6.816, 7.629, 8.179, 8.278, 9.860],
  [0.719, 0.771, 0.819, 0.928, 1.065, 1.165, 1.248, 1.443, 1.681, 1.953, 2.532, 2.848, 3.119, 3.345, 3.542, 3.752, 4.030, 4.818, 5.413, 6.015, 6.687, 7.527, 8.066, 8.152, 9.750],
  [0.703, 0.756, 0.807, 0.887, 1.037, 1.137, 1.210, 1.398, 1.627, 1.861, 2.463, 2.796, 3.060, 3.267, 3.467, 3.667, 3.944, 4.719, 5.328, 5.914, 6.538, 7.412, 7.952, 8.037, 9.640],
  [0.684, 0.733, 0.773, 0.853, 0.971, 1.076, 1.148, 1.317, 1.507, 1.744, 2.331, 2.670, 2.955, 3.166, 3.346, 3.535, 3.834, 4.487, 5.165, 5.759, 6.347, 7.212, 7.719, 7.788, 9.440],
  [0.639, 0.691, 0.733, 0.799, 0.931, 1.034, 1.103, 1.257, 1.425, 1.642, 2.212, 2.501, 2.794, 3.008, 3.203, 3.406, 3.672, 4.278, 4.955, 5.579, 6.125, 6.955, 7.440, 7.508, 9.040],
  [0.634, 0.671, 0.713, 0.792, 0.922, 1.014, 1.080, 1.231, 1.383, 1.588, 2.120, 2.420, 2.738, 2.965, 3.120, 3.285, 3.546, 4.120, 4.763, 5.426, 5.962, 6.731, 7.247, 7.323, 8.587],
  [0.607, 0.649, 0.682, 0.778, 0.895, 0.992, 1.072, 1.221, 1.370, 1.570, 2.084, 2.390, 2.708, 2.943, 3.108, 3.255, 3.496, 4.072, 4.692, 5.391, 5.886, 6.632, 7.179, 7.263, 8.345],
];

const EOT_TEMP_POINTS = [-20, 0, 20, 40, 60, 80, 100, 115, 130, 145];
const IAT_TEMP_POINTS = [-10, 0, 15, 25, 35, 45, 55, 65, 75, 85];

function buildXdfXmlForPreset(spec: HondaModelPresetSpec): string {
  const isTpsColsRpmRows = spec.axisOrientation === 'tps-x-rpm-y';
  const rows = isTpsColsRpmRows ? spec.maxRpmAxis.length : spec.tpsAxis.length;
  const cols = isTpsColsRpmRows ? spec.tpsAxis.length : spec.maxRpmAxis.length;

  const rpmLabels = spec.maxRpmAxis
    .map((rpm, i) => `        <LABEL index="${i}" value="${rpm}" />`)
    .join('\n');
  const tpsLabels = spec.tpsAxis
    .map((tps, i) => `        <LABEL index="${i}" value="${tps}" />`)
    .join('\n');

  const xAxisXml = isTpsColsRpmRows
    ? `    <XDFAXIS id="x" uniqueid="0x0">
      <units>TPS %</units>
      <decimalpl>1</decimalpl>
      <EMBEDDEDDATA mmedaddress="0x3800" mmedelementsizebits="16" mmedtypeflags="0x00" />
      <MATH equation="X*0.1" />
${tpsLabels}
    </XDFAXIS>`
    : `    <XDFAXIS id="x" uniqueid="0x0">
      <units>RPM</units>
      <decimalpl>0</decimalpl>
      <EMBEDDEDDATA mmedaddress="0x3880" mmedelementsizebits="16" mmedtypeflags="0x00" />
      <MATH equation="X" />
${rpmLabels}
    </XDFAXIS>`;

  const yAxisXml = isTpsColsRpmRows
    ? `    <XDFAXIS id="y" uniqueid="0x0">
      <units>RPM</units>
      <decimalpl>0</decimalpl>
      <EMBEDDEDDATA mmedaddress="0x3880" mmedelementsizebits="16" mmedtypeflags="0x00" />
      <MATH equation="X" />
${rpmLabels}
    </XDFAXIS>`
    : `    <XDFAXIS id="y" uniqueid="0x0">
      <units>TPS %</units>
      <decimalpl>1</decimalpl>
      <EMBEDDEDDATA mmedaddress="0x3800" mmedelementsizebits="16" mmedtypeflags="0x00" />
      <MATH equation="X*0.1" />
${tpsLabels}
    </XDFAXIS>`;

  const tpsAxisCols = spec.tpsAxis.length;
  const rpmAxisRows = spec.maxRpmAxis.length;
  const tpsPointIndices = spec.tpsAxis
    .map((_, i) => `        <LABEL index="${i}" value="${i + 1}" />`)
    .join('\n');
  const rpmPointIndices = spec.maxRpmAxis
    .map((_, i) => `        <LABEL index="${i}" value="${i + 1}" />`)
    .join('\n');
  const eotLabels = EOT_TEMP_POINTS
    .map((t, i) => `        <LABEL index="${i}" value="${t}" />`)
    .join('\n');
  const iatLabels = IAT_TEMP_POINTS
    .map((t, i) => `        <LABEL index="${i}" value="${t}" />`)
    .join('\n');

  const fuelDecimals = spec.id === 'wave-110i-k58-t81' ? 3 : 2;
  const fuelEq = fuelDecimals === 3 ? 'X*0.001' : 'X*0.01';

  const csBits =
    spec.checksumAlgorithm === 'honda-sh705x-32bit'
      ? 32
      : spec.checksumAlgorithm === 'keihin-8bit-twos'
      ? 8
      : 16;
  const storeAddr = spec.flashSizeBytes - csBits / 8;

  return `<?xml version="1.0" encoding="UTF-8"?>
<XDFFORMAT version="1.70">
  <XDFHEADER>
    <deftitle>${spec.modelName} — ${spec.ecmPartNumber}</deftitle>
    <author>Honda PGM-FI ECU Studio</author>
    <BASEOFFSET offset="0x0000" />
  </XDFHEADER>

  <XDFTABLE uniqueid="tps-axis-table">
    <title>TPS (ตารางเปอร์เซ็นคันเร่ง)</title>
    <description>จุดอ้างอิงเปอร์เซ็นต์เปิดลิ้นเร่ง (${tpsAxisCols} จุด) สำหรับแกนแนวตั้งของตารางจูน</description>
    <XDFAXIS id="x" uniqueid="0x0">
      <units>TPS %</units>
      <decimalpl>0</decimalpl>
      <LABEL index="0" value="1" />
    </XDFAXIS>
    <XDFAXIS id="y" uniqueid="0x0">
      <units>จุดที่</units>
      <decimalpl>0</decimalpl>
${tpsPointIndices}
    </XDFAXIS>
    <XDFAXIS id="z">
      <units>%</units>
      <decimalpl>1</decimalpl>
      <min>0.0</min>
      <max>100.0</max>
      <EMBEDDEDDATA mmedaddress="0x3800" mmedelementsizebits="16" mmedrowcount="${tpsAxisCols}" mmedcolcount="1" mmedtypeflags="0x00" />
      <MATH equation="X*0.1" />
    </XDFAXIS>
  </XDFTABLE>

  <XDFTABLE uniqueid="rpm-axis-table">
    <title>RPM (ตารางรอบเครื่องยนต์)</title>
    <description>จุดอ้างอิงรอบเครื่องยนต์ (${rpmAxisRows} จุด) สำหรับแกนแนวนอนของตารางน้ำมันและไฟจุดระเบิด</description>
    <XDFAXIS id="x" uniqueid="0x0">
      <units>จุดที่</units>
      <decimalpl>0</decimalpl>
${rpmPointIndices}
    </XDFAXIS>
    <XDFAXIS id="y" uniqueid="0x0">
      <units>RPM</units>
      <decimalpl>0</decimalpl>
      <LABEL index="0" value="1" />
    </XDFAXIS>
    <XDFAXIS id="z">
      <units>RPM</units>
      <decimalpl>0</decimalpl>
      <min>500</min>
      <max>16000</max>
      <EMBEDDEDDATA mmedaddress="0x3880" mmedelementsizebits="16" mmedrowcount="1" mmedcolcount="${rpmAxisRows}" mmedtypeflags="0x00" />
      <MATH equation="X" />
    </XDFAXIS>
  </XDFTABLE>

  <XDFTABLE uniqueid="fuel-main-tps">
    <title>Fuel 1 : ตารางน้ำมันหน้าที่ 1</title>
    <description>ตารางจ่ายน้ำมันหลัก (Injector Pulse Width) สำหรับ ${spec.modelName}</description>
${xAxisXml}
${yAxisXml}
    <XDFAXIS id="z">
      <units>ms</units>
      <decimalpl>${fuelDecimals}</decimalpl>
      <min>0.200</min>
      <max>18.500</max>
      <EMBEDDEDDATA mmedaddress="0x1000" mmedelementsizebits="16" mmedrowcount="${rows}" mmedcolcount="${cols}" mmedtypeflags="0x00" />
      <MATH equation="${fuelEq}" />
    </XDFAXIS>
  </XDFTABLE>

  <XDFTABLE uniqueid="fuel-2-tps">
    <title>Fuel 2 : ตารางน้ำมันหน้าที่ 2</title>
    <description>ตารางจ่ายน้ำมันชุดที่ 2 (Secondary / Warm & Load Map) สำหรับ ${spec.modelName}</description>
${xAxisXml}
${yAxisXml}
    <XDFAXIS id="z">
      <units>ms</units>
      <decimalpl>${fuelDecimals}</decimalpl>
      <min>0.200</min>
      <max>18.500</max>
      <EMBEDDEDDATA mmedaddress="0x1600" mmedelementsizebits="16" mmedrowcount="${rows}" mmedcolcount="${cols}" mmedtypeflags="0x00" />
      <MATH equation="${fuelEq}" />
    </XDFAXIS>
  </XDFTABLE>

  <XDFTABLE uniqueid="ign-main-adv">
    <title>Ignition 1-4 (องศาไฟเกียร์ 1-4)</title>
    <description>องศาไฟจุดระเบิดก่อนศูนย์ตายบน (BTDC Degrees) เกียร์ 1–4</description>
${xAxisXml}
${yAxisXml}
    <XDFAXIS id="z">
      <units>° BTDC</units>
      <decimalpl>1</decimalpl>
      <min>-5.0</min>
      <max>52.0</max>
      <EMBEDDEDDATA mmedaddress="0x2000" mmedelementsizebits="8" mmedrowcount="${rows}" mmedcolcount="${cols}" mmedtypeflags="0x01" />
      <MATH equation="X*0.5" />
    </XDFAXIS>
  </XDFTABLE>

  <XDFTABLE uniqueid="ign-neutral-adv">
    <title>Ignition N (องศาไฟเกียร์ว่าง)</title>
    <description>องศาไฟจุดระเบิดเกียร์ว่าง (Neutral) และช่วงเดินเบาออกตัว</description>
${xAxisXml}
${yAxisXml}
    <XDFAXIS id="z">
      <units>° BTDC</units>
      <decimalpl>1</decimalpl>
      <min>-5.0</min>
      <max>52.0</max>
      <EMBEDDEDDATA mmedaddress="0x2400" mmedelementsizebits="8" mmedrowcount="${rows}" mmedcolcount="${cols}" mmedtypeflags="0x01" />
      <MATH equation="X*0.5" />
    </XDFAXIS>
  </XDFTABLE>

  <XDFTABLE uniqueid="soi-high-temp">
    <title>SOI : องศาการทำงานของหัวฉีด (อุณหภูมิสูง)</title>
    <description>องศาการเริ่มฉีดน้ำมันเชื้อเพลิง (Start of Injection) ขณะเครื่องยนต์ร้อน</description>
${xAxisXml}
${yAxisXml}
    <XDFAXIS id="z">
      <units>° BTDC</units>
      <decimalpl>1</decimalpl>
      <min>0.0</min>
      <max>120.0</max>
      <EMBEDDEDDATA mmedaddress="0x3000" mmedelementsizebits="8" mmedrowcount="${rows}" mmedcolcount="${cols}" mmedtypeflags="0x00" />
      <MATH equation="X*0.5" />
    </XDFAXIS>
  </XDFTABLE>

  <XDFTABLE uniqueid="soi-low-temp">
    <title>SOI : องศาการทำงานของหัวฉีด (อุณหภูมิต่ำ)</title>
    <description>องศาการเริ่มฉีดน้ำมันเชื้อเพลิง (Start of Injection) ขณะเครื่องเย็น</description>
${xAxisXml}
${yAxisXml}
    <XDFAXIS id="z">
      <units>° BTDC</units>
      <decimalpl>1</decimalpl>
      <min>0.0</min>
      <max>120.0</max>
      <EMBEDDEDDATA mmedaddress="0x3400" mmedelementsizebits="8" mmedrowcount="${rows}" mmedcolcount="${cols}" mmedtypeflags="0x00" />
      <MATH equation="X*0.5" />
    </XDFAXIS>
  </XDFTABLE>

  <XDFTABLE uniqueid="eot-comp-table">
    <title>EOT (อุณหภูมิน้ำมันเครื่อง)</title>
    <description>ตารางชดเชยการจ่ายน้ำมันตามอุณหภูมิน้ำมันเครื่อง / น้ำหล่อเย็น (°C → %)</description>
    <XDFAXIS id="x" uniqueid="0x0">
      <units>°C</units>
      <decimalpl>0</decimalpl>
${eotLabels}
    </XDFAXIS>
    <XDFAXIS id="y" uniqueid="0x0">
      <units>EOT</units>
      <decimalpl>0</decimalpl>
      <LABEL index="0" value="1" />
    </XDFAXIS>
    <XDFAXIS id="z">
      <units>%</units>
      <decimalpl>1</decimalpl>
      <min>-30.0</min>
      <max>80.0</max>
      <EMBEDDEDDATA mmedaddress="0x3900" mmedelementsizebits="16" mmedrowcount="1" mmedcolcount="10" mmedtypeflags="0x01" />
      <MATH equation="X*0.1" />
    </XDFAXIS>
  </XDFTABLE>

  <XDFTABLE uniqueid="iat-comp-table">
    <title>IAT (อุณหภูมิอากาศในท่อไอดี)</title>
    <description>ตารางชดเชยการจ่ายน้ำมันตามอุณหภูมิอากาศเข้าไอดี (°C → %)</description>
    <XDFAXIS id="x" uniqueid="0x0">
      <units>°C</units>
      <decimalpl>0</decimalpl>
${iatLabels}
    </XDFAXIS>
    <XDFAXIS id="y" uniqueid="0x0">
      <units>IAT</units>
      <decimalpl>0</decimalpl>
      <LABEL index="0" value="1" />
    </XDFAXIS>
    <XDFAXIS id="z">
      <units>%</units>
      <decimalpl>1</decimalpl>
      <min>-25.0</min>
      <max>25.0</max>
      <EMBEDDEDDATA mmedaddress="0x3940" mmedelementsizebits="16" mmedrowcount="1" mmedcolcount="10" mmedtypeflags="0x01" />
      <MATH equation="X*0.1" />
    </XDFAXIS>
  </XDFTABLE>

  <XDFTABLE uniqueid="o2-control-map">
    <title>ตารางควบคุมค่า O2</title>
    <description>ตารางควบคุมการทำงานของเซ็นเซอร์ O2 Closed-Loop (Target Lambda / O2 Control)</description>
${xAxisXml}
${yAxisXml}
    <XDFAXIS id="z">
      <units>λ</units>
      <decimalpl>2</decimalpl>
      <min>0.70</min>
      <max>1.20</max>
      <EMBEDDEDDATA mmedaddress="0x2C00" mmedelementsizebits="8" mmedrowcount="${rows}" mmedcolcount="${cols}" mmedtypeflags="0x00" />
      <MATH equation="X*0.01" />
    </XDFAXIS>
  </XDFTABLE>

  <XDFTABLE uniqueid="fuel-cut-table">
    <title>Fuel Cut (รอบตัดน้ำมัน)</title>
    <description>ระดับรอบเครื่องยนต์ตัดน้ำมัน (1=Soft Cut, 2=Hard Cut, 3=Recovery)</description>
    <XDFAXIS id="x" uniqueid="0x0">
      <units>ขั้น</units>
      <decimalpl>0</decimalpl>
      <LABEL index="0" value="1" />
      <LABEL index="1" value="2" />
      <LABEL index="2" value="3" />
    </XDFAXIS>
    <XDFAXIS id="y" uniqueid="0x0">
      <units>Cut</units>
      <decimalpl>0</decimalpl>
      <LABEL index="0" value="1" />
    </XDFAXIS>
    <XDFAXIS id="z">
      <units>RPM</units>
      <decimalpl>0</decimalpl>
      <min>4000</min>
      <max>16000</max>
      <EMBEDDEDDATA mmedaddress="0x3980" mmedelementsizebits="16" mmedrowcount="1" mmedcolcount="3" mmedtypeflags="0x00" />
      <MATH equation="X" />
    </XDFAXIS>
  </XDFTABLE>

  <XDFTABLE uniqueid="ign-cut-table">
    <title>Ignition Cut (รอบตัดไฟจุดระเบิด)</title>
    <description>ระดับรอบเครื่องยนต์ตัดไฟจุดระเบิด (1=Soft Retard, 2=Hard Cut, 3=Recovery)</description>
    <XDFAXIS id="x" uniqueid="0x0">
      <units>ขั้น</units>
      <decimalpl>0</decimalpl>
      <LABEL index="0" value="1" />
      <LABEL index="1" value="2" />
      <LABEL index="2" value="3" />
    </XDFAXIS>
    <XDFAXIS id="y" uniqueid="0x0">
      <units>Cut</units>
      <decimalpl>0</decimalpl>
      <LABEL index="0" value="1" />
    </XDFAXIS>
    <XDFAXIS id="z">
      <units>RPM</units>
      <decimalpl>0</decimalpl>
      <min>4000</min>
      <max>16000</max>
      <EMBEDDEDDATA mmedaddress="0x39A0" mmedelementsizebits="16" mmedrowcount="1" mmedcolcount="3" mmedtypeflags="0x00" />
      <MATH equation="X" />
    </XDFAXIS>
  </XDFTABLE>

  <XDFTABLE uniqueid="model-code-table">
    <title>Model Code (รหัสกล่อง)</title>
    <description>ไบต์รหัสประจำตัวกล่อง ECU (Model / Calibration Code Bytes)</description>
    <XDFAXIS id="x" uniqueid="0x0">
      <units>Byte</units>
      <decimalpl>0</decimalpl>
      <LABEL index="0" value="0" />
      <LABEL index="1" value="1" />
      <LABEL index="2" value="2" />
      <LABEL index="3" value="3" />
      <LABEL index="4" value="4" />
      <LABEL index="5" value="5" />
      <LABEL index="6" value="6" />
      <LABEL index="7" value="7" />
    </XDFAXIS>
    <XDFAXIS id="y" uniqueid="0x0">
      <units>ID</units>
      <decimalpl>0</decimalpl>
      <LABEL index="0" value="1" />
    </XDFAXIS>
    <XDFAXIS id="z">
      <units>Byte</units>
      <decimalpl>0</decimalpl>
      <min>0</min>
      <max>255</max>
      <EMBEDDEDDATA mmedaddress="0x39C0" mmedelementsizebits="8" mmedrowcount="1" mmedcolcount="8" mmedtypeflags="0x00" />
      <MATH equation="X" />
    </XDFAXIS>
  </XDFTABLE>

  <XDFTABLE uniqueid="fuel-trim-map">
    <title>Fuel Trim / Correction — ชดเชยน้ำมัน (%)</title>
    <description>ตารางชดเชยปริมาณน้ำมัน ±% สำหรับการปรับจูนละเอียดและ Auto-Tune</description>
${xAxisXml}
${yAxisXml}
    <XDFAXIS id="z">
      <units>%</units>
      <decimalpl>1</decimalpl>
      <min>-40.0</min>
      <max>60.0</max>
      <EMBEDDEDDATA mmedaddress="0x1C00" mmedelementsizebits="8" mmedrowcount="${rows}" mmedcolcount="${cols}" mmedtypeflags="0x01" />
      <MATH equation="X*0.5" />
    </XDFAXIS>
  </XDFTABLE>

  <XDFTABLE uniqueid="target-afr-map">
    <title>Target AFR Map — ค่าส่วนผสมน้ำมันเป้าหมาย</title>
    <description>ตาราง Target Air-Fuel Ratio ที่ใช้คำนวณการปรับค่าน้ำมันอัตโนมัติในโหมด Auto-Tune</description>
${xAxisXml}
${yAxisXml}
    <XDFAXIS id="z">
      <units>AFR</units>
      <decimalpl>1</decimalpl>
      <min>10.5</min>
      <max>16.0</max>
      <EMBEDDEDDATA mmedaddress="0x2800" mmedelementsizebits="8" mmedrowcount="${rows}" mmedcolcount="${cols}" mmedtypeflags="0x00" />
      <MATH equation="X*0.1" />
    </XDFAXIS>
  </XDFTABLE>

  <XDFCONSTANT uniqueid="const-rev-hard">
    <title>Hard Rev Limiter — ลิมิตรอบเครื่องสูงสุด (Fuel Cut)</title>
    <description>รอบเครื่องยนต์สูงสุดที่กล่องสั่งตัดการจ่ายน้ำมัน</description>
    <units>RPM</units>
    <decimalpl>0</decimalpl>
    <EMBEDDEDDATA mmedaddress="0x3A00" mmedelementsizebits="16" mmedtypeflags="0x00" />
    <MATH equation="X" />
  </XDFCONSTANT>

  <XDFCONSTANT uniqueid="const-rev-soft">
    <title>Soft Rev Limiter — รอบเริ่มเตือนก่อนตัด</title>
    <description>รอบเครื่องที่เริ่มหน่วงไฟจุดระเบิดก่อนเข้าลิมิต</description>
    <units>RPM</units>
    <decimalpl>0</decimalpl>
    <EMBEDDEDDATA mmedaddress="0x3A04" mmedelementsizebits="16" mmedtypeflags="0x00" />
    <MATH equation="X" />
  </XDFCONSTANT>

  <XDFCONSTANT uniqueid="const-idle-rpm">
    <title>Target Idle Speed — รอบเดินเบาเป้าหมาย</title>
    <description>ความเร็วรอบเดินเบาเมื่อเครื่องยนต์ถึงอุณหภูมิทำงาน</description>
    <units>RPM</units>
    <decimalpl>0</decimalpl>
    <EMBEDDEDDATA mmedaddress="0x3A08" mmedelementsizebits="16" mmedtypeflags="0x00" />
    <MATH equation="X" />
  </XDFCONSTANT>

  <XDFCONSTANT uniqueid="const-inj-size">
    <title>Injector Flow Scaling — ขนาดหัวฉีด</title>
    <description>อัตราการฉีดน้ำมันเชื้อเพลิงของหัวฉีด (cc/min) สำหรับคำนวณชดเชยหัวฉีดแต่ง</description>
    <units>cc/min</units>
    <decimalpl>0</decimalpl>
    <EMBEDDEDDATA mmedaddress="0x3A0C" mmedelementsizebits="16" mmedtypeflags="0x00" />
    <MATH equation="X" />
  </XDFCONSTANT>

  <XDFCONSTANT uniqueid="const-fan-on">
    <title>Radiator Fan ON Temp — อุณหภูมิเปิดพัดลมหม้อน้ำ</title>
    <description>อุณหภูมิน้ำหล่อเย็น (ECT) ที่สั่งให้พัดลมระบายความร้อนเริ่มทำงาน</description>
    <units>°C</units>
    <decimalpl>0</decimalpl>
    <EMBEDDEDDATA mmedaddress="0x3A10" mmedelementsizebits="8" mmedtypeflags="0x00" />
    <MATH equation="X" />
  </XDFCONSTANT>

  <XDFCONSTANT uniqueid="const-decel-cut">
    <title>Decel Fuel Cut RPM — รอบตัดน้ำมันตอนยกคันเร่ง</title>
    <description>ระดับรอบเครื่องที่ตัดการจ่ายน้ำมันเมื่อ TPS = 0% (ตั้งต่ำเพื่อเปิดเสียงปุ้งปั้ง Backfire)</description>
    <units>RPM</units>
    <decimalpl>0</decimalpl>
    <EMBEDDEDDATA mmedaddress="0x3A14" mmedelementsizebits="16" mmedtypeflags="0x00" />
    <MATH equation="X" />
  </XDFCONSTANT>

  <XDFFLAG uniqueid="flag-o2-loop">
    <title>O2 Closed-Loop Feedback — เปิดใช้งานเซ็นเซอร์ O2 เดิม</title>
    <description>ปิดเพื่อให้กล่องไม่ดึงส่วนผสมกลับไป 14.7 ในช่วงเดินเบา/ครูซ หรือเมื่อถอดเซ็นเซอร์ O2</description>
    <EMBEDDEDDATA mmedaddress="0x3A20" mmedelementsizebits="8" />
    <mask>0x01</mask>
  </XDFFLAG>

  <XDFFLAG uniqueid="flag-speed-cut">
    <title>Top Speed Limiter — ล็อกความเร็วปลาย</title>
    <description>เปิด/ปิด การล็อกความเร็วสูงสุดจากเซ็นเซอร์ความเร็ว VSS</description>
    <EMBEDDEDDATA mmedaddress="0x3A20" mmedelementsizebits="8" />
    <mask>0x02</mask>
  </XDFFLAG>

  <XDFFLAG uniqueid="flag-decel-pop">
    <title>Decel Fuel Cut Active — ตัดน้ำมันเมื่อผ่อนคันเร่ง</title>
    <description>เปิด/ปิดระบบตัดการฉีดน้ำมันขณะผ่อนคันเร่ง</description>
    <EMBEDDEDDATA mmedaddress="0x3A20" mmedelementsizebits="8" />
    <mask>0x04</mask>
  </XDFFLAG>

  <XDFFLAG uniqueid="flag-tcs-hstc">
    <title>HSTC / Traction Control Default — ระบบป้องกันล้อหมุนฟรี</title>
    <description>กำหนดสถานะเริ่มต้นของระบบแทร็คชั่นคอนโทรล (Forza 350 / ADV / PCX 160 / BigBike)</description>
    <EMBEDDEDDATA mmedaddress="0x3A20" mmedelementsizebits="8" />
    <mask>0x08</mask>
  </XDFFLAG>

  <XDFCHECKSUM uniqueid="cs-main-rom">
    <title>${spec.ecuFamily} Main Flash Checksum</title>
    <REGION algorithm="${spec.checksumAlgorithm}" startaddress="0x0000" endaddress="0x${(spec.flashSizeBytes - 1).toString(16).toUpperCase()}" storeaddress="0x${storeAddr.toString(16).toUpperCase()}" datasizebits="${csBits}" calculationmethod="0x00" />
  </XDFCHECKSUM>
</XDFFORMAT>`;
}

export function createProjectFromPreset(spec: HondaModelPresetSpec): EcuProject {
  const xml = buildXdfXmlForPreset(spec);
  const xdf = parseXdfXml(xml);
  const bytes = new Uint8Array(spec.flashSizeBytes);

  // Fill deterministic realistic Honda ROM header & padding
  bytes.fill(0xff);
  const headerStr = `HONDA-PGMFI|${spec.ecmPartNumber}|${spec.ecuFamily}|${spec.modelName}`;
  for (let i = 0; i < headerStr.length && i < 128; i++) {
    bytes[i] = headerStr.charCodeAt(i);
  }
  // Fill calibration shadow region with realistic baseline bytes
  for (let i = 0x200; i < 0x1000; i++) {
    bytes[i] = (i * 37 + spec.displacementCc) & 0xff;
  }

  const isTpsColsRpmRows = spec.axisOrientation === 'tps-x-rpm-y';
  const rows = isTpsColsRpmRows ? spec.maxRpmAxis.length : spec.tpsAxis.length;
  const cols = isTpsColsRpmRows ? spec.tpsAxis.length : spec.maxRpmAxis.length;

  const tpsAxisTable = xdf.tables.find((t) => t.id === 'tps-axis-table');
  const rpmAxisTable = xdf.tables.find((t) => t.id === 'rpm-axis-table');
  const fuelTable = xdf.tables.find((t) => t.id === 'fuel-main-tps');
  const fuel2Table = xdf.tables.find((t) => t.id === 'fuel-2-tps');
  const trimTable = xdf.tables.find((t) => t.id === 'fuel-trim-map');
  const ignTable = xdf.tables.find((t) => t.id === 'ign-main-adv');
  const ignNTable = xdf.tables.find((t) => t.id === 'ign-neutral-adv');
  const soiHighTable = xdf.tables.find((t) => t.id === 'soi-high-temp');
  const soiLowTable = xdf.tables.find((t) => t.id === 'soi-low-temp');
  const eotTable = xdf.tables.find((t) => t.id === 'eot-comp-table');
  const iatTable = xdf.tables.find((t) => t.id === 'iat-comp-table');
  const o2Table = xdf.tables.find((t) => t.id === 'o2-control-map');
  const fuelCutTable = xdf.tables.find((t) => t.id === 'fuel-cut-table');
  const ignCutTable = xdf.tables.find((t) => t.id === 'ign-cut-table');
  const modelCodeTable = xdf.tables.find((t) => t.id === 'model-code-table');
  const afrTable = xdf.tables.find((t) => t.id === 'target-afr-map');

  if (tpsAxisTable) {
    spec.tpsAxis.forEach((tps, r) => writeTableCell(bytes, tpsAxisTable, r, 0, tps));
  }
  if (rpmAxisTable) {
    spec.maxRpmAxis.forEach((rpm, c) => writeTableCell(bytes, rpmAxisTable, 0, c, rpm));
  }
  if (eotTable) {
    const eotVals = [42.0, 28.0, 14.0, 5.0, 1.5, 0.0, 0.0, 2.5, 6.0, 10.0];
    eotVals.forEach((v, c) => writeTableCell(bytes, eotTable, 0, c, v));
  }
  if (iatTable) {
    const iatVals = [8.5, 5.5, 2.5, 0.0, -1.5, -3.0, -4.5, -5.5, -6.5, -7.5];
    iatVals.forEach((v, c) => writeTableCell(bytes, iatTable, 0, c, v));
  }
  if (fuelCutTable) {
    [spec.defaultRevLimit - 200, spec.defaultRevLimit, spec.defaultRevLimit - 350].forEach(
      (v, c) => writeTableCell(bytes, fuelCutTable, 0, c, v)
    );
  }
  if (ignCutTable) {
    [spec.defaultRevLimit - 150, spec.defaultRevLimit + 50, spec.defaultRevLimit - 300].forEach(
      (v, c) => writeTableCell(bytes, ignCutTable, 0, c, v)
    );
  }
  if (modelCodeTable) {
    const codeStr = spec.ecmPartNumber.replace(/[^A-Z0-9]/gi, '').slice(0, 8).padEnd(8, '0');
    for (let c = 0; c < 8; c++) {
      writeTableCell(bytes, modelCodeTable, 0, c, codeStr.charCodeAt(c));
    }
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tpsVal = isTpsColsRpmRows ? spec.tpsAxis[c] : spec.tpsAxis[r];
      const maxTps = spec.tpsAxis[spec.tpsAxis.length - 1] || 100;
      const tpsNorm = Math.min(1, Math.max(0, tpsVal / maxTps));
      const rpmNorm = isTpsColsRpmRows
        ? r / Math.max(1, spec.maxRpmAxis.length - 1)
        : c / Math.max(1, spec.maxRpmAxis.length - 1);

      if (fuelTable) {
        let pulseMs: number;
        const k58RpmIdx = isTpsColsRpmRows ? r : c;
        const k58TpsIdx = isTpsColsRpmRows ? c : r;
        if (
          spec.id === 'wave-110i-k58-t81' &&
          K58_T81_FUEL1_MATRIX[k58RpmIdx]?.[k58TpsIdx] !== undefined
        ) {
          pulseMs = K58_T81_FUEL1_MATRIX[k58RpmIdx][k58TpsIdx];
        } else {
          const veCurve = 0.8 + 0.32 * Math.sin(rpmNorm * Math.PI * 0.85);
          pulseMs = (1.45 + Math.pow(tpsNorm, 0.82) * 6.4 * veCurve) * spec.fuelBaseMultiplier;
        }
        writeTableCell(bytes, fuelTable, r, c, Number(pulseMs.toFixed(fuelTable.decimalPlaces)));

        if (fuel2Table) {
          const f2 = pulseMs * 1.03;
          writeTableCell(bytes, fuel2Table, r, c, Number(f2.toFixed(fuel2Table.decimalPlaces)));
        }
      }

      if (trimTable) {
        writeTableCell(bytes, trimTable, r, c, 0);
      }

      if (ignTable) {
        const baseAdv = 11 + rpmNorm * 22;
        const loadRetard = Math.pow(tpsNorm, 1.3) * 11;
        const cruiseBump = (1 - tpsNorm) * rpmNorm * 8;
        const deg = Math.max(8, Math.min(44, baseAdv - loadRetard + cruiseBump + spec.ignBaseOffset));
        writeTableCell(bytes, ignTable, r, c, Number(deg.toFixed(1)));
        if (ignNTable) {
          const degN = Math.max(6, Math.min(38, deg - 2.5));
          writeTableCell(bytes, ignNTable, r, c, Number(degN.toFixed(1)));
        }
      }

      if (soiHighTable) {
        const soiH = Math.min(110, Math.max(15, 32 + rpmNorm * 44 + tpsNorm * 14));
        writeTableCell(bytes, soiHighTable, r, c, Number(soiH.toFixed(1)));
      }
      if (soiLowTable) {
        const soiL = Math.min(110, Math.max(15, 28 + rpmNorm * 40 + tpsNorm * 12));
        writeTableCell(bytes, soiLowTable, r, c, Number(soiL.toFixed(1)));
      }

      const afrVal =
        tpsNorm < 0.25
          ? 14.5 - rpmNorm * 0.4
          : tpsNorm < 0.65
          ? 13.8 - rpmNorm * 0.6
          : 13.0 - rpmNorm * 0.4;

      if (afrTable) {
        writeTableCell(bytes, afrTable, r, c, Number(afrVal.toFixed(1)));
      }
      if (o2Table) {
        const lambdaVal = Math.min(1.15, Math.max(0.75, afrVal / 14.7));
        writeTableCell(bytes, o2Table, r, c, Number(lambdaVal.toFixed(2)));
      }
    }
  }

  // Populate Constants
  const cHard = xdf.constants.find((c) => c.id === 'const-rev-hard');
  const cSoft = xdf.constants.find((c) => c.id === 'const-rev-soft');
  const cIdle = xdf.constants.find((c) => c.id === 'const-idle-rpm');
  const cInj = xdf.constants.find((c) => c.id === 'const-inj-size');
  const cFan = xdf.constants.find((c) => c.id === 'const-fan-on');
  const cDecel = xdf.constants.find((c) => c.id === 'const-decel-cut');

  if (cHard) writeConstantValue(bytes, cHard, spec.defaultRevLimit);
  if (cSoft) writeConstantValue(bytes, cSoft, spec.defaultRevLimit - 250);
  if (cIdle) writeConstantValue(bytes, cIdle, spec.defaultIdleRpm);
  if (cInj) writeConstantValue(bytes, cInj, Math.round(90 + spec.displacementCc * 0.45));
  if (cFan) writeConstantValue(bytes, cFan, 102);
  if (cDecel) writeConstantValue(bytes, cDecel, spec.defaultIdleRpm + 1200);

  // Populate Flags
  const fO2 = xdf.flags.find((f) => f.id === 'flag-o2-loop');
  const fSpeed = xdf.flags.find((f) => f.id === 'flag-speed-cut');
  const fDecel = xdf.flags.find((f) => f.id === 'flag-decel-pop');
  const fTcs = xdf.flags.find((f) => f.id === 'flag-tcs-hstc');

  if (fO2) writeFlagState(bytes, fO2, true);
  if (fSpeed) writeFlagState(bytes, fSpeed, true);
  if (fDecel) writeFlagState(bytes, fDecel, true);
  if (fTcs) writeFlagState(bytes, fTcs, spec.hasTcs);

  // Patch checksum so factory preset starts 100% valid
  const { updatedBytes } = fixAllChecksums(bytes, xdf.checksums, spec.checksumAlgorithm);

  return {
    id: `proj-${spec.id}-${Date.now()}`,
    name: spec.modelName,
    modelName: spec.modelName,
    yearRange: spec.yearRange,
    category: spec.category,
    ecuFamily: spec.ecuFamily,
    ecmPartNumber: spec.ecmPartNumber,
    protocolLabel: spec.protocolLabel,
    baudRate: spec.baudRate,
    klineTableId: spec.klineTableId,
    flashSizeBytes: spec.flashSizeBytes,
    checksumAlgorithm: spec.checksumAlgorithm,
    binFileName: `${spec.ecmPartNumber}_STOCK.bin`,
    xdfFileName: `${spec.ecmPartNumber}.xdf`,
    isBuiltInPreset: true,
    originalBytes: new Uint8Array(updatedBytes),
    workingBytes: new Uint8Array(updatedBytes),
    xdf,
    updatedAt: Date.now(),
  };
}
