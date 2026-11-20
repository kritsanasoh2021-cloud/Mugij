import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Cable,
  CheckCircle2,
  Download,
  FolderOpen,
  ShieldCheck,
  Terminal,
  Upload,
} from 'lucide-react';
import {
  formatAddress,
  formatHexValue,
  verifyAllChecksums,
} from '../engine/checksumEngine';
import {
  ChecksumAlgorithm,
  ConnectionMode,
  EcuProject,
  LiveTelemetryFrame,
  SerialPacketLog,
} from '../types/ecu';

interface FlasherChecksumViewProps {
  project: EcuProject | null;
  connectionMode: ConnectionMode;
  connectedPortName: string | null;
  telemetry: LiveTelemetryFrame | null;
  ecuIdHex: string | null;
  logs: SerialPacketLog[];
  onFixChecksums: (algorithmOverride?: ChecksumAlgorithm) => number;
  onReadEcuBin: (
    onProgress: (pct: number, addrHex: string) => void
  ) => Promise<void>;
  onWriteEcuBin: (
    onProgress: (pct: number, stage: string) => void
  ) => Promise<boolean>;
  onAttachBinToActive: (binFileName: string, bytes: Uint8Array) => void;
  onExportBin: () => void;
  onClearLogs: () => void;
  onConnectWebSerial: () => void;
  onConnectBridge: () => void;
  onStartBenchSim: () => void;
  onDisconnect: () => void;
}

type FlashMode = 'write-flash' | 'write-eeprom' | 'read-flash' | 'read-eeprom';
type InterfaceFamily = 'ftdi' | 'j2534';

const ALGO_OPTIONS: { id: ChecksumAlgorithm; label: string }[] = [
  { id: 'keihin-16bit-sum', label: 'Keihin 16-bit Sum (Forza / PCX / Wave / Click)' },
  { id: 'keihin-8bit-twos', label: 'Keihin 8-bit Two’s Complement (Click 125i / K59)' },
  { id: 'honda-sh705x-32bit', label: 'Honda SH705x 32-bit Block Sum (CRF / CBR500)' },
  { id: 'honda-sh725xx-crc16', label: 'Honda SH725xx CRC-16 (CBR250RR / CB650R)' },
];

function computeAutoOffsets(
  fileSizeBytes: number,
  is32Bit: boolean,
  xdfChecksumStoreAddr?: number
): { startHex: string; checksumHex: string } {
  const safeSize = fileSizeBytes > 0 ? fileSizeBytes : 65536;
  const padWidth = safeSize > 0xfffff ? 6 : 5;
  const startHex = '0'.padStart(padWidth, '0');

  let csAddr: number;
  if (
    xdfChecksumStoreAddr !== undefined &&
    xdfChecksumStoreAddr >= 0 &&
    xdfChecksumStoreAddr < safeSize
  ) {
    csAddr = xdfChecksumStoreAddr;
  } else {
    csAddr = Math.max(0, safeSize - (is32Bit ? 4 : 2));
  }
  const checksumHex = csAddr.toString(16).toUpperCase().padStart(padWidth, '0');
  return { startHex, checksumHex };
}

export const FlasherChecksumView: React.FC<FlasherChecksumViewProps> = ({
  project,
  connectionMode,
  connectedPortName,
  telemetry,
  ecuIdHex,
  logs,
  onFixChecksums,
  onReadEcuBin,
  onWriteEcuBin,
  onAttachBinToActive,
  onExportBin,
  onClearLogs,
  onConnectWebSerial,
  onConnectBridge,
  onStartBenchSim,
  onDisconnect,
}) => {
  const [interfaceFamily, setInterfaceFamily] = useState<InterfaceFamily>('ftdi');
  const [ftdiAdapterOption, setFtdiAdapterOption] = useState<string>('ftdi-kline');
  const [j2534AdapterOption, setJ2534AdapterOption] = useState<string>('esp32-bridge');
  const [flashMode, setFlashMode] = useState<FlashMode>('write-flash');

  const [selectedAlgo, setSelectedAlgo] = useState<ChecksumAlgorithm>(
    project?.checksumAlgorithm || 'keihin-16bit-sum'
  );
  const [is32BitChecksum, setIs32BitChecksum] = useState<boolean>(
    project?.checksumAlgorithm === 'honda-sh705x-32bit'
  );
  const [fixChecksumEnabled, setFixChecksumEnabled] = useState(true);

  const [selectedFileLabel, setSelectedFileLabel] = useState<string>(
    project?.binFileName || 'ยังไม่ได้เลือกไฟล์ .BIN'
  );
  const [selectedFileBytesLen, setSelectedFileBytesLen] = useState<number>(
    project?.workingBytes.length || 65536
  );

  const initialOffsets = useMemo(
    () =>
      computeAutoOffsets(
        project?.workingBytes.length || 65536,
        project?.checksumAlgorithm === 'honda-sh705x-32bit',
        project?.xdf.checksums[0]?.storeAddress
      ),
    [project]
  );

  const [startOffsetHex, setStartOffsetHex] = useState<string>(initialOffsets.startHex);
  const [checksumOffsetHex, setChecksumOffsetHex] = useState<string>(initialOffsets.checksumHex);

  const [flashBusy, setFlashBusy] = useState<'idle' | 'reading' | 'writing'>('idle');
  const [progressPct, setProgressPct] = useState(0);
  const [progressNote, setProgressNote] = useState('พร้อมทำงาน (0%)');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const binFileInputRef = useRef<HTMLInputElement>(null);

  // Sync filename, algo, and auto offsets whenever active project changes
  useEffect(() => {
    if (!project) return;
    const is32 = project.checksumAlgorithm === 'honda-sh705x-32bit';
    setSelectedAlgo(project.checksumAlgorithm);
    setIs32BitChecksum(is32);
    setSelectedFileLabel(project.binFileName);
    setSelectedFileBytesLen(project.workingBytes.length);
    const auto = computeAutoOffsets(
      project.workingBytes.length,
      is32,
      project.xdf.checksums[0]?.storeAddress
    );
    setStartOffsetHex(auto.startHex);
    setChecksumOffsetHex(auto.checksumHex);
  }, [project?.id, project?.binFileName, project?.workingBytes.length, project?.checksumAlgorithm]);

  const checksumBlocks = useMemo(() => {
    if (!project) return [];
    const regions = project.xdf.checksums.map((r) => ({
      ...r,
      algorithm: selectedAlgo,
    }));
    return verifyAllChecksums(project.workingBytes, regions, selectedAlgo);
  }, [project, selectedAlgo]);

  const allChecksumsValid =
    checksumBlocks.length > 0 && checksumBlocks.every((b) => b.isValid);

  const handleToggle32Bit = (checked: boolean) => {
    setIs32BitChecksum(checked);
    const nextAlgo: ChecksumAlgorithm = checked ? 'honda-sh705x-32bit' : 'keihin-16bit-sum';
    setSelectedAlgo(nextAlgo);
    const auto = computeAutoOffsets(
      selectedFileBytesLen,
      checked,
      project?.xdf.checksums[0]?.storeAddress
    );
    setChecksumOffsetHex(auto.checksumHex);
  };

  const handleSelectLocalBinFile = async (file: File) => {
    setStatusMessage(null);
    const buf = new Uint8Array(await file.arrayBuffer());
    if (buf.length < 256) {
      setStatusMessage('ไฟล์ที่เลือกมีขนาดเล็กเกินไป กรุณาเลือกไฟล์ .BIN ของกล่อง ECU');
      return;
    }
    const is32 = buf.length >= 262144 ? true : is32BitChecksum;
    if (buf.length >= 262144 && !is32BitChecksum) {
      setIs32BitChecksum(true);
      setSelectedAlgo('honda-sh705x-32bit');
    }
    const auto = computeAutoOffsets(buf.length, is32, project?.xdf.checksums[0]?.storeAddress);
    setSelectedFileLabel(file.name);
    setSelectedFileBytesLen(buf.length);
    setStartOffsetHex(auto.startHex);
    setChecksumOffsetHex(auto.checksumHex);
    onAttachBinToActive(file.name, buf);
    setStatusMessage(
      `เลือกไฟล์ ${file.name} (${(buf.length / 1024).toFixed(0)} KB) และตั้ง Start 0x${auto.startHex} / Checksum 0x${auto.checksumHex} อัตโนมัติแล้ว`
    );
  };

  const handleConnectInterface = () => {
    if (connectionMode !== 'disconnected') {
      onDisconnect();
      return;
    }
    if (interfaceFamily === 'ftdi') {
      if (ftdiAdapterOption === 'bench') {
        onStartBenchSim();
      } else {
        onConnectWebSerial();
      }
    } else {
      onConnectBridge();
    }
  };

  const handleExecuteModeAction = async () => {
    if (flashBusy !== 'idle') return;
    setStatusMessage(null);

    if (connectionMode === 'disconnected') {
      if (interfaceFamily === 'ftdi' && ftdiAdapterOption === 'bench') {
        onStartBenchSim();
      } else if (interfaceFamily === 'j2534') {
        onConnectBridge();
        return;
      } else {
        onConnectWebSerial();
        return;
      }
    }

    const isRead = flashMode === 'read-flash' || flashMode === 'read-eeprom';
    const isEeprom = flashMode === 'read-eeprom' || flashMode === 'write-eeprom';

    if (isRead) {
      setFlashBusy('reading');
      setProgressPct(0);
      setProgressNote(
        isEeprom
          ? 'กำลังเริ่มต้นอ่าน EEPROM จากกล่อง ECU...'
          : `กำลังดูดไฟล์ Flash เริ่มที่ 0x${startOffsetHex}...`
      );
      await onReadEcuBin((pct, addr) => {
        setProgressPct(pct);
        setProgressNote(
          `${isEeprom ? 'กำลังอ่าน EEPROM' : 'กำลังดูดไฟล์ Flash'} @ ${addr} (${pct}%)`
        );
      });
      setFlashBusy('idle');
      setProgressPct(100);
      setProgressNote(
        `${isEeprom ? 'อ่าน EEPROM' : 'ดูดไฟล์ .BIN'} สำเร็จ (100%)`
      );
      setStatusMessage(
        `${isEeprom ? 'อ่านข้อมูล EEPROM' : 'ดูดไฟล์ .BIN'} จากกล่อง ECU เสร็จสมบูรณ์และบันทึกลงคลังแล้ว`
      );
      return;
    }

    if (!project) {
      setStatusMessage('กรุณาเลือกไฟล์ .BIN ก่อนสั่งอัดไฟล์');
      return;
    }

    if (!allChecksumsValid) {
      if (fixChecksumEnabled) {
        onFixChecksums(selectedAlgo);
      } else {
        setStatusMessage('Checksum ยังไม่ถูกต้อง กรุณาติ๊ก Fix Checksum หรือแก้ Checksum ก่อนอัดไฟล์');
        return;
      }
    }

    setFlashBusy('writing');
    setProgressPct(0);
    setProgressNote(
      `${isEeprom ? 'กำลังเขียน EEPROM' : 'กำลังเตรียมอัดไฟล์ Flash'} (Start 0x${startOffsetHex} · CS 0x${checksumOffsetHex})...`
    );
    const ok = await onWriteEcuBin((pct, stage) => {
      setProgressPct(pct);
      setProgressNote(`${stage} (${pct}%)`);
    });
    setFlashBusy('idle');
    if (ok) {
      setProgressPct(100);
      setProgressNote(`${isEeprom ? 'เขียน EEPROM' : 'อัดไฟล์ .BIN'} สำเร็จ 100%`);
      setStatusMessage(
        `${isEeprom ? 'เขียน EEPROM' : 'อัดไฟล์ .BIN'} ลงกล่อง ECU และตรวจสอบ Checksum สำเร็จ`
      );
    } else {
      setProgressNote('การเขียนไฟล์ถูกยกเลิกหรือล้มเหลว');
      setStatusMessage('การเขียนไฟล์ล้มเหลว กรุณาตรวจเช็กสายเชื่อมต่อและไฟแบตเตอรี่');
    }
  };

  const actionLabel =
    flashBusy === 'reading'
      ? `กำลังดูดไฟล์ ${progressPct}%`
      : flashBusy === 'writing'
      ? `กำลังอัดไฟล์ ${progressPct}%`
      : flashMode === 'write-flash'
      ? 'Write FLASH'
      : flashMode === 'read-flash'
      ? 'Read FLASH'
      : flashMode === 'write-eeprom'
      ? 'Write EEPROM'
      : 'Read EEPROM';

  const battVolt = telemetry?.battVolt ?? null;
  const ftdiDisplayOptions = [
    ...(connectedPortName && connectionMode === 'webserial-direct'
      ? [{ value: 'connected-ftdi', label: `${connectedPortName} [เชื่อมต่ออยู่]` }]
      : []),
    { value: 'ftdi-kline', label: 'FTDI FT232R USB K-Line (10,400 bps)' },
    { value: 'ch340-kline', label: 'WCH CH340 / CP2102 USB-K-Line (10,400 bps)' },
    { value: 'bench', label: 'Bench Dyno Simulator (โหมดทดสอบไม่มีสาย)' },
  ];

  const j2534DisplayOptions = [
    ...(connectedPortName && connectionMode === 'webserial-bridge'
      ? [{ value: 'connected-bridge', label: `${connectedPortName} [เชื่อมต่ออยู่]` }]
      : []),
    { value: 'esp32-bridge', label: 'ESP32 / Arduino K-Line Bridge (115,200 bps)' },
    { value: 'j2534-honda', label: 'J2534 PassThru ISO-9141 Honda PGM-FI' },
  ];

  return (
    <div className="h-full w-full grid grid-cols-12 gap-3 p-3 overflow-hidden">
      {/* Left 6 Columns: Flasher Interface + Checksum Analyzer */}
      <section className="col-span-6 flex flex-col gap-3 min-h-0 overflow-y-auto">
        {/* Card 1 (Focused Element): ECU Flasher Interface / Mode / File / Offsets / Progress */}
        <div className="bg-[#11151E] border border-[#242B3B] rounded-lg p-3 shrink-0 flex flex-col gap-2.5">
          {/* Top Row: Interface (Left) & Mode (Right) */}
          <div className="grid grid-cols-12 gap-2.5 items-stretch">
            {/* Interface Group Box */}
            <fieldset className="col-span-7 min-w-0 w-full overflow-hidden [min-inline-size:0] border border-[#2A3347] rounded-md px-2.5 pb-2.5 pt-1 bg-[#0C1018]">
              <legend className="px-1.5 text-[11px] font-semibold text-cyan-300 flex items-center gap-1.5 max-w-full truncate">
                <Cable className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Interface (สายที่เชื่อมต่อ)</span>
              </legend>

              <div className="flex flex-col gap-1.5 mt-0.5 min-w-0">
                {/* FTDI / USB Serial Row */}
                <div className="flex items-center gap-2 min-w-0">
                  <label className="flex items-center gap-1.5 w-14 shrink-0 text-xs text-slate-200 cursor-pointer">
                    <input
                      type="radio"
                      name="flasher-interface"
                      checked={interfaceFamily === 'ftdi'}
                      onChange={() => setInterfaceFamily('ftdi')}
                      className="accent-cyan-400"
                    />
                    <span className="font-medium">FTDI</span>
                  </label>
                  <select
                    value={
                      connectedPortName && connectionMode === 'webserial-direct'
                        ? 'connected-ftdi'
                        : ftdiAdapterOption
                    }
                    onChange={(e) => {
                      setInterfaceFamily('ftdi');
                      setFtdiAdapterOption(e.target.value);
                    }}
                    className="w-0 flex-1 min-w-0 h-7 px-2 bg-[#080A10] border border-[#2A3347] rounded text-[11px] font-mono-tabular text-slate-100 focus:outline-none focus:border-cyan-500 truncate"
                  >
                    {ftdiDisplayOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* J2534 / Bridge Row */}
                <div className="flex items-center gap-2 min-w-0">
                  <label className="flex items-center gap-1.5 w-14 shrink-0 text-xs text-slate-200 cursor-pointer">
                    <input
                      type="radio"
                      name="flasher-interface"
                      checked={interfaceFamily === 'j2534'}
                      onChange={() => setInterfaceFamily('j2534')}
                      className="accent-cyan-400"
                    />
                    <span className="font-medium">J2534</span>
                  </label>
                  <select
                    value={
                      connectedPortName && connectionMode === 'webserial-bridge'
                        ? 'connected-bridge'
                        : j2534AdapterOption
                    }
                    onChange={(e) => {
                      setInterfaceFamily('j2534');
                      setJ2534AdapterOption(e.target.value);
                    }}
                    className="w-0 flex-1 min-w-0 h-7 px-2 bg-[#080A10] border border-[#2A3347] rounded text-[11px] font-mono-tabular text-slate-100 focus:outline-none focus:border-cyan-500 truncate"
                  >
                    {j2534DisplayOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Connection Status & Connect Trigger */}
                <div className="flex items-center justify-between gap-2 pt-1 text-[10px] font-mono-tabular">
                  <span
                    className={`truncate ${
                      connectionMode === 'disconnected' ? 'text-slate-400' : 'text-emerald-400'
                    }`}
                  >
                    {connectionMode === 'disconnected'
                      ? 'สถานะ: ยังไม่เชื่อมต่อสาย'
                      : `เชื่อมต่อ: ${connectedPortName || connectionMode}${
                          ecuIdHex ? ` · ID ${ecuIdHex}` : ''
                        }`}
                  </span>
                  <button
                    type="button"
                    onClick={handleConnectInterface}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 cursor-pointer transition-colors ${
                      connectionMode === 'disconnected'
                        ? 'bg-cyan-600/20 hover:bg-cyan-600/35 border border-cyan-500/50 text-cyan-300'
                        : 'bg-rose-950/50 hover:bg-rose-900/60 border border-rose-500/40 text-rose-300'
                    }`}
                  >
                    {connectionMode === 'disconnected' ? 'เชื่อมต่อสาย' : 'ตัดการเชื่อมต่อ'}
                  </button>
                </div>
              </div>
            </fieldset>

            {/* Mode Group Box */}
            <fieldset className="col-span-5 min-w-0 w-full overflow-hidden [min-inline-size:0] border border-[#2A3347] rounded-md px-2.5 pb-2.5 pt-1 bg-[#0C1018]">
              <legend className="px-1.5 text-[11px] font-semibold text-amber-300 truncate max-w-full">
                Mode (ดูด / อัดไฟล์)
              </legend>

              <div className="grid grid-cols-2 gap-x-1.5 gap-y-2 mt-1.5 text-[11px]">
                <label className="flex items-center gap-1 cursor-pointer text-slate-100 min-w-0 whitespace-nowrap">
                  <input
                    type="radio"
                    name="flasher-mode"
                    checked={flashMode === 'write-flash'}
                    onChange={() => setFlashMode('write-flash')}
                    className="accent-rose-500 shrink-0"
                  />
                  <span className="truncate">Write Flash</span>
                </label>

                <label className="flex items-center gap-1 cursor-pointer text-slate-200 min-w-0 whitespace-nowrap">
                  <input
                    type="radio"
                    name="flasher-mode"
                    checked={flashMode === 'write-eeprom'}
                    onChange={() => setFlashMode('write-eeprom')}
                    className="accent-rose-500 shrink-0"
                  />
                  <span className="truncate">Write EEPROM</span>
                </label>

                <label className="flex items-center gap-1 cursor-pointer text-slate-100 min-w-0 whitespace-nowrap">
                  <input
                    type="radio"
                    name="flasher-mode"
                    checked={flashMode === 'read-flash'}
                    onChange={() => setFlashMode('read-flash')}
                    className="accent-cyan-400 shrink-0"
                  />
                  <span className="truncate">Read Flash</span>
                </label>

                <label className="flex items-center gap-1 cursor-pointer text-slate-200 min-w-0 whitespace-nowrap">
                  <input
                    type="radio"
                    name="flasher-mode"
                    checked={flashMode === 'read-eeprom'}
                    onChange={() => setFlashMode('read-eeprom')}
                    className="accent-cyan-400 shrink-0"
                  />
                  <span className="truncate">Read EEPROM</span>
                </label>
              </div>

              <div className="mt-2 pt-1 border-t border-[#1C2333] flex items-center justify-between text-[10px] font-mono-tabular text-slate-400">
                <span>แบตเตอรี่:</span>
                <span
                  className={
                    battVolt !== null && battVolt < 12.0
                      ? 'text-rose-400 font-semibold'
                      : 'text-emerald-300 font-semibold'
                  }
                >
                  {battVolt !== null ? `${battVolt.toFixed(1)} V` : 'แนะนำ ≥ 12.2 V'}
                </span>
              </div>
            </fieldset>
          </div>

          {/* Middle Box: File Picker, Filename Status, Auto & Editable Offsets, Checkboxes & Primary Action */}
          <fieldset className="border border-[#2A3347] rounded-md px-2.5 pb-2.5 pt-1 bg-[#0C1018] flex flex-col gap-2">
            <legend className="px-1.5 text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
              <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
              <span>File (เลือกไฟล์ .BIN และตำแหน่ง Offset)</span>
            </legend>

            {/* File Status Path Bar + Browse [...] Button */}
            <div className="flex items-center gap-1.5">
              <input
                ref={binFileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleSelectLocalBinFile(f);
                  e.target.value = '';
                }}
              />
              <div className="flex-1 h-8 px-2.5 bg-[#080A10] border border-[#2A3347] rounded flex items-center justify-between gap-2 min-w-0">
                <span className="text-xs font-mono-tabular text-amber-300 truncate">
                  {selectedFileLabel}
                </span>
                <span className="text-[10px] font-mono-tabular text-cyan-400 shrink-0">
                  {(selectedFileBytesLen / 1024).toFixed(0)} KB (0x
                  {selectedFileBytesLen.toString(16).toUpperCase()})
                </span>
              </div>
              <button
                type="button"
                onClick={() => binFileInputRef.current?.click()}
                title="เพิ่ม/เลือกไฟล์ .BIN จากเครื่อง"
                className="h-8 px-3 rounded bg-[#1A2233] hover:bg-[#253048] border border-[#34425E] text-xs font-semibold text-slate-100 cursor-pointer shrink-0"
              >
                ... เพิ่มไฟล์
              </button>
            </div>

            {/* Start Offset, Checksum Offset, 32bit Checksum, Fix Checksum & Execute Button */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
              <div className="flex flex-wrap items-center gap-2.5 text-[11px]">
                <label className="flex items-center gap-1 text-slate-300">
                  <span>Start Offset:</span>
                  <span className="font-mono-tabular text-slate-400">0x</span>
                  <input
                    type="text"
                    value={startOffsetHex}
                    onChange={(e) =>
                      setStartOffsetHex(e.target.value.replace(/[^0-9a-fA-F]/g, '').toUpperCase())
                    }
                    className="w-16 h-7 px-1.5 bg-[#080A10] border border-[#2A3347] rounded font-mono-tabular text-xs text-cyan-300 focus:outline-none focus:border-cyan-500"
                  />
                </label>

                <label className="flex items-center gap-1 text-slate-300">
                  <span>Checksum Offset:</span>
                  <span className="font-mono-tabular text-slate-400">0x</span>
                  <input
                    type="text"
                    value={checksumOffsetHex}
                    onChange={(e) =>
                      setChecksumOffsetHex(
                        e.target.value.replace(/[^0-9a-fA-F]/g, '').toUpperCase()
                      )
                    }
                    className="w-16 h-7 px-1.5 bg-[#080A10] border border-[#2A3347] rounded font-mono-tabular text-xs text-amber-300 focus:outline-none focus:border-cyan-500"
                  />
                </label>

                <label className="flex items-center gap-1.5 text-slate-200 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={is32BitChecksum}
                    onChange={(e) => handleToggle32Bit(e.target.checked)}
                    className="accent-cyan-400"
                  />
                  <span>32bit Checksum</span>
                </label>

                <label className="flex items-center gap-1.5 text-slate-200 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={fixChecksumEnabled}
                    onChange={(e) => setFixChecksumEnabled(e.target.checked)}
                    className="accent-emerald-500"
                  />
                  <span>Fix Checksum</span>
                </label>
              </div>

              <button
                type="button"
                disabled={flashBusy !== 'idle'}
                onClick={() => void handleExecuteModeAction()}
                className={`h-8 px-3.5 rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0 transition-colors ${
                  flashMode === 'read-flash' || flashMode === 'read-eeprom'
                    ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                    : 'bg-rose-600 hover:bg-rose-500 text-white'
                }`}
              >
                {flashMode === 'read-flash' || flashMode === 'read-eeprom' ? (
                  <Download className="w-3.5 h-3.5" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                <span>{actionLabel}</span>
              </button>
            </div>
          </fieldset>

          {/* Bottom Progress Bar (Always visible, showing % progress of Read or Write) */}
          <div className="bg-[#080A10] border border-[#242B3B] rounded-md px-2.5 py-2 flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300 truncate">{statusMessage || progressNote}</span>
              <span className="font-mono-tabular font-bold text-cyan-300 shrink-0 ml-2">
                {progressPct}%
              </span>
            </div>
            <div className="h-3 w-full bg-[#161C29] border border-[#242D40] rounded overflow-hidden">
              <div
                className={`h-full transition-all duration-150 ${
                  flashBusy === 'writing'
                    ? 'bg-rose-500'
                    : flashBusy === 'reading'
                    ? 'bg-cyan-500'
                    : progressPct === 100
                    ? 'bg-emerald-500'
                    : 'bg-cyan-600/60'
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 2: Checksum Analyzer & Verification Table */}
        <div className="bg-[#11151E] border border-[#242B3B] rounded-lg p-3 flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div>
              <h2 className="text-xs font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                ตรวจสอบและคำนวณ Checksum อัตโนมัติ
              </h2>
              <p className="text-[11px] text-slate-400">
                ปรับแก้ค่า Checksum ในไฟล์ .bin อัตโนมัติทุกครั้งก่อนส่งออกหรืออัดลงกล่อง ECU
              </p>
            </div>
            {allChecksumsValid ? (
              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1 shrink-0">
                <CheckCircle2 className="w-4 h-4" />
                Checksum ถูกต้อง
              </span>
            ) : (
              <span className="text-xs font-semibold text-amber-400 flex items-center gap-1 shrink-0">
                <AlertCircle className="w-4 h-4" />
                ต้องคำนวณใหม่
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-2.5">
            <select
              value={selectedAlgo}
              onChange={(e) => {
                const next = e.target.value as ChecksumAlgorithm;
                setSelectedAlgo(next);
                setIs32BitChecksum(next === 'honda-sh705x-32bit');
              }}
              className="flex-1 h-8 px-2 bg-[#090B10] border border-[#2A3347] rounded text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
            >
              {ALGO_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                const patched = onFixChecksums(selectedAlgo);
                setStatusMessage(
                  patched > 0
                    ? `คำนวณและอัปเดต Checksum ใหม่จำนวน ${patched} บล็อกเรียบร้อยแล้ว`
                    : 'Checksum ทุกบล็อกถูกต้องตรงตามมาตรฐานอยู่แล้ว'
                );
              }}
              disabled={!project}
              className="h-8 px-3 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
            >
              แก้ Checksum
            </button>

            <button
              type="button"
              disabled={!project}
              onClick={onExportBin}
              className="h-8 px-3 rounded bg-[#171C28] hover:bg-[#222A3C] border border-[#2B344A] disabled:opacity-40 text-xs text-slate-200 cursor-pointer whitespace-nowrap"
              title="ดาวน์โหลดไฟล์ .bin ที่แก้ Checksum แล้ว"
            >
              บันทึก .BIN
            </button>
          </div>

          {project && (
            <div className="flex-1 overflow-auto border border-[#202737] rounded bg-[#0B0E15]">
              <table className="w-full text-[11px] font-mono-tabular border-collapse">
                <thead>
                  <tr className="bg-[#131824] text-slate-400 border-b border-[#202737]">
                    <th className="text-left px-2.5 py-1.5">บล็อกข้อมูล</th>
                    <th className="text-left px-2 py-1.5">ช่วง Address</th>
                    <th className="text-right px-2 py-1.5">ค่าในไฟล์</th>
                    <th className="text-right px-2 py-1.5">ค่าที่คำนวณได้</th>
                    <th className="text-right px-2.5 py-1.5">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {checksumBlocks.map((b) => {
                    const bits =
                      b.algorithm === 'honda-sh705x-32bit'
                        ? 32
                        : b.algorithm === 'keihin-8bit-twos'
                        ? 8
                        : 16;
                    return (
                      <tr key={b.id} className="border-b border-[#19202E] last:border-none">
                        <td className="px-2.5 py-1.5 text-slate-200">{b.title}</td>
                        <td className="px-2 py-1.5 text-slate-400">
                          {formatAddress(b.startAddress)}–{formatAddress(b.endAddress)}
                        </td>
                        <td className="px-2 py-1.5 text-right text-slate-300">
                          {formatHexValue(b.storedValue, bits)}
                        </td>
                        <td className="px-2 py-1.5 text-right text-cyan-300">
                          {formatHexValue(b.computedValue, bits)}
                        </td>
                        <td
                          className={`px-2.5 py-1.5 text-right font-semibold ${
                            b.isValid ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          {b.isValid ? '✓ OK' : '▲ แก้ไข'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Right 6 Columns: Raw K-Line Packet & Hex Frame Terminal */}
      <section className="col-span-6 bg-[#11151E] border border-[#242B3B] rounded-lg flex flex-col min-h-0 overflow-hidden">
        <div className="px-3 py-2 border-b border-[#242B3B] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-amber-400" />
            <h2 className="text-xs font-bold text-white">
              K-Line Protocol Frame Log (10,400 bps ISO 9141-2)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClearLogs}
            className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
          >
            ล้าง Log
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2.5 bg-[#080A0F] font-mono-tabular text-[11px] flex flex-col gap-1">
          {logs.length === 0 ? (
            <div className="text-slate-500 p-4 text-center">
              ยังไม่มีแพ็กเก็ตสื่อสาร K-Line · เมื่อเชื่อมต่อสายหรืออ่าน/เขียนกล่อง เฟรม Hex จะแสดงที่นี่แบบ Real-Time
            </div>
          ) : (
            logs.map((entry) => {
              const timeStr = new Date(entry.timestamp).toLocaleTimeString('th-TH', {
                hour12: false,
              });
              const dirColor =
                entry.direction === 'TX'
                  ? 'text-amber-400'
                  : entry.direction === 'RX'
                  ? 'text-cyan-400'
                  : entry.direction === 'ERR'
                  ? 'text-rose-400'
                  : 'text-emerald-400';

              return (
                <div
                  key={entry.id}
                  className="px-2 py-1 rounded bg-[#0E121B] border border-[#19202F] flex items-start gap-2"
                >
                  <span className="text-slate-500 shrink-0">{timeStr}</span>
                  <span className={`font-bold shrink-0 w-7 ${dirColor}`}>
                    {entry.direction}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-slate-100 break-all">{entry.hex}</div>
                    <div className="text-slate-400 text-[10px]">
                      {entry.note}
                      {entry.checksumOk !== undefined && (
                        <span
                          className={`ml-2 ${
                            entry.checksumOk ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          [{entry.checksumOk ? 'CS OK' : 'CS ERR'}]
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
};
