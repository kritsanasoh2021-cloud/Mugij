import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Download,
  Gauge,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { lookupDtcDefinition } from '../engine/hondaDtcCodes';
import { ConnectionMode, EcuProject, LiveTelemetryFrame } from '../types/ecu';

interface SmartGaugeDtcViewProps {
  project: EcuProject | null;
  telemetry: LiveTelemetryFrame | null;
  history: LiveTelemetryFrame[];
  connectionMode: ConnectionMode;
  dtcCodes: string[];
  onReadDtc: () => void;
  onClearDtc: () => void;
  onConnectWebSerial: () => void;
  onStartBenchSim: () => void;
}

type SmartGaugePanelMode = 'gauge' | 'telemetry';

export const SmartGaugeDtcView: React.FC<SmartGaugeDtcViewProps> = ({
  project,
  telemetry,
  history,
  connectionMode,
  dtcCodes,
  onReadDtc,
  onClearDtc,
  onConnectWebSerial,
  onStartBenchSim,
}) => {
  const [panelMode, setPanelMode] = useState<SmartGaugePanelMode>('gauge');
  const [isRecording, setIsRecording] = useState(false);
  const [dtcDrawerOpen, setDtcDrawerOpen] = useState(false);
  const dtcMenuRef = useRef<HTMLDivElement>(null);

  const maxRpm = useMemo(() => {
    const axis = project?.xdf.tables[0]?.xAxis.labels;
    if (axis && axis.length > 0) return Math.max(10000, axis[axis.length - 1]);
    return 11000;
  }, [project]);

  const [shiftLightRpm, setShiftLightRpm] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('honda_shift_light_rpm');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (Number.isFinite(parsed) && parsed >= 3000) return parsed;
      }
    } catch {
      // ignore storage failure
    }
    return 8500;
  });

  const updateShiftLightRpm = (next: number) => {
    const clamped = Math.max(3000, Math.min(maxRpm, Math.round(next / 100) * 100));
    setShiftLightRpm(clamped);
    try {
      localStorage.setItem('honda_shift_light_rpm', String(clamped));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (dtcMenuRef.current && !dtcMenuRef.current.contains(e.target as Node)) {
        setDtcDrawerOpen(false);
      }
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, []);

  const exportCsvDatalog = () => {
    if (history.length === 0) return;
    const headers = [
      'Timestamp',
      'RPM',
      'TPS_%',
      'TPS_V',
      'MAP_kPa',
      'ECT_C',
      'IAT_C',
      'IgnAdv_Deg',
      'InjPulse_ms',
      'AFR',
      'O2_V',
      'Batt_V',
      'Speed_kmh',
      'ISC_Duty_%',
    ];
    const rows = history.map((f) =>
      [
        new Date(f.timestamp).toISOString(),
        f.rpm,
        f.tpsPercent,
        f.tpsVolt,
        f.mapKpa,
        f.ectTemp,
        f.iatTemp,
        f.ignAdvance,
        f.injPulseMs,
        f.afr,
        f.o2Volt,
        f.battVolt,
        f.speedKmh,
        f.iscDuty,
      ].join(',')
    );
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `honda_datalog_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const rpm = telemetry?.rpm ?? 0;

  return (
    <div className="h-full w-full flex flex-col gap-2.5 p-3 overflow-hidden">
      {/* Top Bar: View Switcher (Smart Gauge vs Live Waveform) + Elevated DTC Scanner Bar */}
      <header className="bg-[#11151E] border border-[#242B3B] rounded-lg px-3 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0 relative z-30">
        {/* Left: Switch between Full-Screen Smart Gauge (Tachometer + All Data) and Live Signal Waveform */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-[#090B10] p-0.5 rounded border border-[#242B3B]">
            <button
              type="button"
              onClick={() => setPanelMode('gauge')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                panelMode === 'gauge'
                  ? 'bg-cyan-600 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Gauge className="w-3.5 h-3.5" />
              <span>วัดรอบ & ดาต้าทั้งหมด</span>
            </button>
            <button
              type="button"
              onClick={() => setPanelMode('telemetry')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                panelMode === 'telemetry'
                  ? 'bg-cyan-600 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>สัญญาณเรียลไทม์ (Live Graph)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsRecording((v) => !v)}
            className={`h-7 px-2.5 rounded text-[11px] font-medium cursor-pointer whitespace-nowrap ${
              isRecording
                ? 'bg-rose-600 text-white'
                : 'bg-[#171C28] hover:bg-[#22293B] text-slate-200'
            }`}
          >
            {isRecording ? 'กำลังบันทึก Log...' : 'บันทึก Log'}
          </button>

          <button
            type="button"
            onClick={exportCsvDatalog}
            disabled={history.length === 0}
            className="h-7 px-2.5 rounded bg-[#171C28] hover:bg-[#22293B] disabled:opacity-40 text-[11px] text-slate-200 flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3 h-3" />
            <span>CSV ({history.length})</span>
          </button>
        </div>

        {/* Right: Elevated Honda PGM-FI DTC Scanner Top Bar */}
        <aside className="flex flex-wrap items-center gap-2" ref={dtcMenuRef}>
          {connectionMode === 'disconnected' && (
            <div className="flex items-center gap-1.5 mr-1">
              <button
                type="button"
                onClick={onConnectWebSerial}
                className="h-7 px-2.5 rounded bg-rose-600 hover:bg-rose-500 text-[11px] font-semibold text-white cursor-pointer whitespace-nowrap"
              >
                ต่อสาย K-Line
              </button>
              <button
                type="button"
                onClick={onStartBenchSim}
                className="h-7 px-2.5 rounded bg-[#1A2130] hover:bg-[#232D42] text-[11px] text-slate-200 cursor-pointer whitespace-nowrap"
              >
                ทดสอบจำลอง
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onReadDtc}
            disabled={connectionMode === 'disconnected'}
            className="h-7 px-2.5 rounded bg-[#182030] hover:bg-[#222D44] disabled:opacity-40 text-[11px] font-semibold text-cyan-300 flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
          >
            <RefreshCw className="w-3 h-3" />
            <span>สแกนโค้ด DTC</span>
          </button>

          <button
            type="button"
            onClick={onClearDtc}
            disabled={connectionMode === 'disconnected'}
            className="h-7 px-2.5 rounded bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-[11px] font-semibold text-white flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
          >
            <Trash2 className="w-3 h-3" />
            <span>ลบโค้ด</span>
          </button>

          <button
            type="button"
            onClick={() => setDtcDrawerOpen((v) => !v)}
            className={`h-7 px-2.5 rounded border text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              dtcCodes.length > 0
                ? 'bg-amber-950/50 border-amber-500/60 text-amber-300'
                : 'bg-[#171C28] border-[#2C364C] text-emerald-300 hover:bg-[#22293B]'
            }`}
            title="ดูรายละเอียดรหัสความผิดปกติ DTC"
          >
            {dtcCodes.length > 0 ? (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span className="font-mono-tabular">
              {dtcCodes.length > 0 ? `DTC: ${dtcCodes.length} โค้ด` : 'DTC: 0 (ปกติ)'}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${
                dtcDrawerOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* DTC Details Popover Drawer anchored under Top Bar */}
          {dtcDrawerOpen && (
            <div className="absolute top-11 right-3 w-[420px] max-w-[92vw] max-h-[75vh] bg-[#11151E] border border-[#2C364C] rounded-lg shadow-2xl flex flex-col overflow-hidden z-50">
              <div className="p-2.5 border-b border-[#242B3B] bg-[#0D1018] flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">
                    ตรวจสอบ & ลบโค้ดผิดปกติ (Honda PGM-FI DTC)
                  </div>
                  <div className="text-[10px] text-slate-400">
                    อ่านรหัสไฟเครื่องยนต์ผ่านสาย K-Line
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDtcDrawerOpen(false)}
                  className="text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-[#171C28] cursor-pointer"
                >
                  ปิด
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
                {connectionMode === 'disconnected' ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    เชื่อมต่อสาย K-Line หรือเปิดโหมดจำลองเพื่อสแกนและลบโค้ด DTC ของกล่อง ECU
                  </div>
                ) : dtcCodes.length === 0 ? (
                  <div className="p-4 rounded-lg bg-emerald-950/20 border border-emerald-700/40 text-center">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-1.5" />
                    <div className="text-xs font-bold text-emerald-300">
                      ไม่พบรหัสความผิดปกติ (0 DTC)
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      ระบบเซ็นเซอร์และหัวฉีด Honda PGM-FI ทำงานปกติ
                    </p>
                  </div>
                ) : (
                  dtcCodes.map((code) => {
                    const info = lookupDtcDefinition(code);
                    return (
                      <div
                        key={code}
                        className="p-3 rounded-lg bg-[#141925] border border-amber-500/40"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>
                              DTC {info.code} ({info.obdCode})
                            </span>
                          </div>
                          <span className="text-[10px] font-mono-tabular text-slate-400">
                            {info.milBlink}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-white mt-1.5">
                          {info.titleTh}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{info.titleEn}</div>
                        <p className="text-[11px] text-slate-300 mt-1.5 leading-snug">
                          <strong className="text-slate-200">สาเหตุ:</strong> {info.causeTh}
                        </p>
                        <p className="text-[11px] text-cyan-300/90 mt-1 leading-snug">
                          <strong>แนวทางแก้ไข:</strong> {info.fixHintTh}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </aside>
      </header>

      {/* Main Full-Screen Workspace: Wide Horizontal Ramp Tachometer HUD OR Live Signal Graph */}
      <section className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {panelMode === 'gauge' ? (
          <div className="flex-1 min-h-0 bg-[#05070C] border-2 border-cyan-400/70 shadow-[0_0_28px_rgba(6,182,212,0.16)] rounded-2xl p-3 flex flex-col gap-2.5 overflow-hidden relative">
            {/* Top Racing Shift-Light LED Strip + Configurable Shift Light RPM */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-2 border-b border-blue-900/50 shrink-0">
              <div className="text-[11px] font-mono-tabular text-cyan-300 font-semibold whitespace-nowrap">
                {project?.modelName || 'HONDA PGM-FI'} · {project?.ecmPartNumber || 'K-LINE'}
              </div>

              {/* 14-LED Dynamic Shift Light Strip */}
              <div className="flex items-center gap-1.5">
                {Array.from({ length: 14 }).map((_, idx) => {
                  const shiftRatio = rpm / Math.max(3000, shiftLightRpm);
                  const shiftTriggered = rpm >= shiftLightRpm && rpm > 0;
                  const threshold = (idx + 1) / 14;
                  const lit = shiftTriggered || shiftRatio >= threshold;
                  const ledColor = shiftTriggered
                    ? 'bg-rose-500 shadow-[0_0_12px_#E11D48] animate-pulse'
                    : idx < 6
                    ? lit
                      ? 'bg-lime-400 shadow-[0_0_8px_#A3E635]'
                      : 'bg-[#192132]'
                    : idx < 10
                    ? lit
                      ? 'bg-amber-400 shadow-[0_0_8px_#F59E0B]'
                      : 'bg-[#192132]'
                    : lit
                    ? 'bg-rose-500 shadow-[0_0_10px_#E11D48]'
                    : 'bg-[#261A22]';
                  return (
                    <span
                      key={idx}
                      className={`w-3.5 h-2.5 rounded-full transition-colors ${ledColor}`}
                    />
                  );
                })}
                {rpm >= shiftLightRpm && rpm > 0 && (
                  <span className="ml-2 text-[11px] font-mono-tabular font-extrabold text-rose-400 animate-pulse whitespace-nowrap">
                    SHIFT UP!
                  </span>
                )}
              </div>

              {/* Shift Light RPM Config Control + ECM Status */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1 bg-[#090E1A] border border-blue-900/60 rounded px-2 py-0.5 text-[11px] font-mono-tabular">
                  <span className="text-slate-400 whitespace-nowrap">Shift Light:</span>
                  <button
                    type="button"
                    onClick={() => updateShiftLightRpm(shiftLightRpm - 200)}
                    className="w-5 h-5 rounded bg-[#141D2F] hover:bg-[#1E2B45] text-cyan-300 font-bold cursor-pointer"
                    title="ลดรอบเตือน Shift Light"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    step={100}
                    min={3000}
                    max={maxRpm}
                    value={shiftLightRpm}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (Number.isFinite(v)) updateShiftLightRpm(v);
                    }}
                    className="w-14 bg-transparent text-center font-bold text-amber-300 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => updateShiftLightRpm(shiftLightRpm + 200)}
                    className="w-5 h-5 rounded bg-[#141D2F] hover:bg-[#1E2B45] text-cyan-300 font-bold cursor-pointer"
                    title="เพิ่มรอบเตือน Shift Light"
                  >
                    +
                  </button>
                  <span className="text-slate-400">RPM</span>
                </div>

                <span
                  className={`text-[11px] font-mono-tabular font-bold whitespace-nowrap ${
                    telemetry?.milOn || dtcCodes.length > 0
                      ? 'text-rose-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {telemetry?.milOn || dtcCodes.length > 0 ? 'MIL ON' : 'ECM OK'}
                </span>
              </div>
            </div>

            {/* Horizontal Full-Width Ramp Bar Tachometer + Complete Sensor Readouts */}
            <div className="flex-1 min-h-0 flex flex-col gap-2.5 overflow-hidden">
              {/* Div 1: Wide Horizontal Ramp Bar-Graph Tachometer (F1D Racing Style) */}
              <div className="flex-[1.25] min-h-0 bg-[#060912] border border-blue-900/60 rounded-xl px-3 py-2 flex items-center justify-center relative overflow-hidden">
                <LinearRampTachometer
                  rpm={rpm}
                  maxRpm={maxRpm}
                  shiftLightRpm={shiftLightRpm}
                  tpsPercent={telemetry?.tpsPercent ?? null}
                  speedKmh={telemetry?.speedKmh ?? null}
                  ectTemp={telemetry?.ectTemp ?? null}
                  gear={telemetry?.gear ?? null}
                  overTemp={Boolean(telemetry && telemetry.ectTemp > 105)}
                />
              </div>

              {/* Div 2: Full-Width 12 Honda PGM-FI ECU Sensors Grid */}
              <div className="flex-1 min-h-0 flex flex-col gap-2 justify-between">
                <div className="flex-1 min-h-0 grid grid-cols-6 grid-rows-2 gap-2">
                  <GaugeMetricCard
                    label="ส่วนผสม AFR / O2"
                    value={telemetry ? telemetry.afr.toFixed(2) : '--'}
                    unit="AFR"
                    sub={`O2: ${telemetry ? telemetry.o2Volt.toFixed(2) : '--'} V`}
                    accent="text-emerald-400"
                  />
                  <GaugeMetricCard
                    label="เวลาฉีดน้ำมัน (Inj)"
                    value={telemetry ? telemetry.injPulseMs.toFixed(2) : '--'}
                    unit="ms"
                    sub="Injector Pulse"
                    accent="text-rose-400"
                  />
                  <GaugeMetricCard
                    label="องศาไฟจุดระเบิด"
                    value={telemetry ? telemetry.ignAdvance.toFixed(1) : '--'}
                    unit="° BTDC"
                    sub="Ignition Advance"
                    accent="text-amber-400"
                  />
                  <GaugeMetricCard
                    label="ลิ้นเร่ง (TPS)"
                    value={telemetry ? telemetry.tpsPercent.toFixed(1) : '--'}
                    unit="%"
                    sub={`Volt: ${telemetry ? telemetry.tpsVolt.toFixed(2) : '--'} V`}
                    accent="text-cyan-400"
                  />
                  <GaugeMetricCard
                    label="แรงดันท่อไอดี (MAP)"
                    value={telemetry ? telemetry.mapKpa.toFixed(0) : '--'}
                    unit="kPa"
                    sub="Manifold Pressure"
                    accent="text-cyan-300"
                  />
                  <GaugeMetricCard
                    label="แบตเตอรี่ (Batt)"
                    value={telemetry ? telemetry.battVolt.toFixed(1) : '--'}
                    unit="V"
                    sub={telemetry && telemetry.battVolt < 12.2 ? 'ไฟต่ำ!' : 'ชาร์จปกติ'}
                    accent={
                      telemetry && telemetry.battVolt < 12.2
                        ? 'text-amber-400'
                        : 'text-emerald-300'
                    }
                  />
                  <GaugeMetricCard
                    label="อุณหภูมิน้ำ (ECT)"
                    value={telemetry ? telemetry.ectTemp.toFixed(0) : '--'}
                    unit="°C"
                    sub={telemetry && telemetry.ectTemp > 105 ? 'เตือนความร้อน!' : 'Coolant Temp'}
                    accent={
                      telemetry && telemetry.ectTemp > 105
                        ? 'text-rose-400'
                        : 'text-emerald-400'
                    }
                  />
                  <GaugeMetricCard
                    label="อุณหภูมิไอดี (IAT)"
                    value={telemetry ? telemetry.iatTemp.toFixed(0) : '--'}
                    unit="°C"
                    sub="Intake Air Temp"
                    accent="text-slate-100"
                  />
                  <GaugeMetricCard
                    label="วาล์วเดินเบา (ISC)"
                    value={telemetry ? telemetry.iscDuty.toFixed(0) : '--'}
                    unit="%"
                    sub="IACV Duty"
                    accent="text-slate-200"
                  />
                  <GaugeMetricCard
                    label="ความเร็วรถ (VSS)"
                    value={telemetry ? telemetry.speedKmh.toFixed(0) : '--'}
                    unit="km/h"
                    sub={`GEAR ${telemetry?.gear === 0 ? 'N' : telemetry?.gear ?? 'N'}`}
                    accent="text-cyan-300"
                  />
                  <GaugeMetricCard
                    label="รหัสกล่อง ECM"
                    value={project?.ecmPartNumber || '--'}
                    unit=""
                    sub={project?.protocolLabel.split(' ')[1] || 'K-Line'}
                    accent="text-slate-200"
                    smallValue
                  />
                  <GaugeMetricCard
                    label="Log Buffer / λ"
                    value={
                      telemetry
                        ? (telemetry.afr / (project?.stoichAfr || 14.7)).toFixed(3)
                        : '--'
                    }
                    unit="λ"
                    sub={`${history.length} pts recorded`}
                    accent="text-amber-300"
                  />
                </div>

                {/* Bottom HUD Status Strip */}
                <div className="px-3 py-1 rounded bg-[#080D18] border border-blue-900/50 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono-tabular text-slate-400 shrink-0">
                  <span>
                    PROTOCOL:{' '}
                    <strong className="text-cyan-300">
                      {project?.protocolLabel || 'Honda K-Line 10,400 bps'}
                    </strong>
                  </span>
                  <span>
                    SHIFT LIGHT:{' '}
                    <strong className="text-amber-300">
                      {shiftLightRpm.toLocaleString()} RPM
                    </strong>
                    {' · '}
                    STATUS:{' '}
                    <strong
                      className={
                        connectionMode === 'disconnected'
                          ? 'text-amber-300'
                          : 'text-emerald-400'
                      }
                    >
                      {connectionMode === 'disconnected'
                        ? 'OFFLINE'
                        : connectionMode === 'bench-sim'
                        ? 'BENCH SIM'
                        : 'LIVE K-LINE'}
                    </strong>
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Full-Screen Real-Time Multi-Channel Telemetry Waveform */
          <div className="flex-1 bg-[#11151E] border border-[#242B3B] rounded-lg p-3 flex flex-col min-h-0 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5 shrink-0">
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <span className="font-bold text-white">
                  กราฟสัญญาณเรียลไทม์เต็มหน้า (Live Multi-Channel Telemetry)
                </span>
                <span className="text-[11px] font-mono-tabular text-cyan-400">
                  ● RPM: {telemetry ? telemetry.rpm.toLocaleString() : '--'}
                </span>
                <span className="text-[11px] font-mono-tabular text-amber-400">
                  ● TPS: {telemetry ? telemetry.tpsPercent.toFixed(1) : '--'}%
                </span>
                <span className="text-[11px] font-mono-tabular text-emerald-400">
                  ● AFR: {telemetry ? telemetry.afr.toFixed(2) : '--'}
                </span>
                <span className="text-[11px] font-mono-tabular text-rose-400">
                  ● องศาไฟ: {telemetry ? telemetry.ignAdvance.toFixed(1) : '--'}°
                </span>
                <span className="text-[11px] font-mono-tabular text-slate-300">
                  ● Inj: {telemetry ? telemetry.injPulseMs.toFixed(2) : '--'} ms · ECT:{' '}
                  {telemetry ? telemetry.ectTemp.toFixed(0) : '--'}°C
                </span>
              </div>
            </div>

            <div className="flex-1 min-h-0 bg-[#090C12] border border-[#1E2535] rounded p-2">
              <LiveWaveformSvg history={history} maxRpm={maxRpm} />
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

interface LinearRampTachometerProps {
  rpm: number;
  maxRpm: number;
  shiftLightRpm: number;
  tpsPercent: number | null;
  speedKmh: number | null;
  ectTemp: number | null;
  gear: number | null;
  overTemp: boolean;
}

const LinearRampTachometer: React.FC<LinearRampTachometerProps> = ({
  rpm,
  maxRpm,
  shiftLightRpm,
  tpsPercent,
  speedKmh,
  ectTemp,
  gear,
  overTemp,
}) => {
  const totalSegs = 40;
  const rampEndIdx = 10; // First 10 bars ramp upward at angle, remaining 30 sweep horizontally
  const rpmPct = Math.max(0, Math.min(1, rpm / Math.max(1000, maxRpm)));
  const activeCount = Math.round(rpmPct * totalSegs);
  const shiftIdx = Math.round(
    (Math.max(3000, Math.min(maxRpm, shiftLightRpm)) / Math.max(1000, maxRpm)) * totalSegs
  );
  const isShiftActive = rpm >= shiftLightRpm && rpm > 0;
  const maxStepK = Math.round(maxRpm / 1000);

  // Path helper for ramp bar geometry (viewBox 960 x 250)
  const getBarCenter = (i: number) => {
    const startX = 48;
    const endX = 918;
    const x = startX + (i / (totalSegs - 1)) * (endX - startX);
    if (i < rampEndIdx) {
      const t = i / rampEndIdx; // 0..1
      const y = 200 - t * 76; // rises from y=200 up to y=124
      return { x, y, isRamp: true };
    }
    return { x, y: 124, isRamp: false };
  };

  const shiftPos = getBarCenter(Math.max(0, Math.min(totalSegs - 1, shiftIdx)));

  return (
    <svg
      viewBox="0 0 960 250"
      className="w-full h-full select-none"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="hudBlueStroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#06B6D4" />
          <stop offset="50%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>
      </defs>

      {/* Top Angled Blue HUD Bracket: LOAD / TPS % */}
      <polygon
        points="20,10 210,10 185,46 42,46"
        fill="#081024"
        stroke="#2563EB"
        strokeWidth="1.8"
      />
      <text
        x="114"
        y="33"
        textAnchor="middle"
        fill="#67E8F9"
        fontSize="16"
        fontWeight="700"
        fontStyle="italic"
        fontFamily="JetBrains Mono, monospace"
      >
        LOAD
      </text>

      <polygon
        points="222,10 530,10 555,46 196,46"
        fill="#081024"
        stroke="#2563EB"
        strokeWidth="1.8"
      />
      <text
        x="380"
        y="35"
        textAnchor="middle"
        fill="#E0F2FE"
        fontSize="24"
        fontWeight="800"
        fontStyle="italic"
        fontFamily="JetBrains Mono, monospace"
      >
        {tpsPercent !== null ? `${tpsPercent.toFixed(0)} %` : '-- %'}
      </text>

      {/* Top Right HUD Status: Shift Target + Coolant ECT */}
      <polygon
        points="544,10 940,10 918,46 568,46"
        fill="#081024"
        stroke={isShiftActive ? '#E11D48' : '#2563EB'}
        strokeWidth="1.8"
      />
      <text
        x="742"
        y="33"
        textAnchor="middle"
        fill={isShiftActive ? '#FB7185' : '#FCD34D'}
        fontSize="14"
        fontWeight="700"
        fontFamily="JetBrains Mono, monospace"
      >
        SHIFT LIGHT: {shiftLightRpm.toLocaleString()} RPM
      </text>

      {/* TECHO RPM Label + Giant Digital RPM Readout */}
      <text
        x="48"
        y="80"
        fill="#38BDF8"
        fontSize="17"
        fontWeight="800"
        fontStyle="italic"
        fontFamily="JetBrains Mono, monospace"
      >
        TECHO
      </text>
      <text
        x="52"
        y="102"
        fill="#94A3B8"
        fontSize="14"
        fontWeight="700"
        fontStyle="italic"
        fontFamily="JetBrains Mono, monospace"
      >
        RPM
      </text>

      <text
        x="445"
        y="104"
        textAnchor="middle"
        fill={isShiftActive ? '#EF4444' : '#F8FAFC'}
        fontSize="60"
        fontWeight="900"
        fontStyle="italic"
        fontFamily="JetBrains Mono, monospace"
      >
        {rpm.toLocaleString()}
      </text>

      {/* Coolant Temp Right Side (like 141°C in reference) */}
      <text
        x="855"
        y="98"
        textAnchor="end"
        fill={overTemp ? '#F43F5E' : '#38BDF8'}
        fontSize="28"
        fontWeight="800"
        fontStyle="italic"
        fontFamily="JetBrains Mono, monospace"
      >
        {ectTemp !== null ? `${ectTemp.toFixed(0)}°C` : '--°C'}
      </text>
      <text
        x="865"
        y="96"
        fill="#64748B"
        fontSize="12"
        fontWeight="700"
        fontFamily="JetBrains Mono, monospace"
      >
        ECT
      </text>

      {/* Shift Light Trigger Marker Triangle */}
      <polygon
        points={`${shiftPos.x - 6},${shiftPos.y - 24} ${shiftPos.x + 6},${shiftPos.y - 24} ${shiftPos.x},${shiftPos.y - 15}`}
        fill="#EF4444"
      />

      {/* 40-Segment Horizontal Ramp Bar Graph */}
      {Array.from({ length: totalSegs }).map((_, i) => {
        const { x, y, isRamp } = getBarCenter(i);
        const active = i < activeCount;
        const ratio = i / (totalSegs - 1);

        let barColor = '#84CC16'; // Iconic F1D bright lime-green
        if (i >= shiftIdx) {
          barColor = '#EF4444'; // Crimson redline / Shift Light zone
        } else if (ratio >= shiftIdx / totalSegs - 0.14) {
          barColor = '#F59E0B'; // Pre-shift amber warning
        } else if (i < 6) {
          barColor = '#22C55E'; // Early ramp green
        }

        const w = 15;
        const h = 23;
        const skew = isRamp ? -16 : -6;
        return (
          <g key={i} transform={`translate(${x}, ${y}) skewX(${skew})`}>
            <rect
              x={-w / 2}
              y={-h / 2}
              width={w}
              height={h}
              rx={2}
              fill={barColor}
              opacity={active ? 0.98 : 0.15}
            />
          </g>
        );
      })}

      {/* Angled Blue Contour Under Ramp Bar */}
      <polyline
        points="42,222 250,148 924,148"
        fill="none"
        stroke="url(#hudBlueStroke)"
        strokeWidth="2.2"
      />

      {/* x1000 RPM Scale Numbers Along the Ramp + Horizontal Track */}
      {Array.from({ length: maxStepK + 1 }).map((_, k) => {
        if (maxStepK > 11 && k % 2 !== 0 && k !== maxStepK) return null;
        const idx = Math.min(totalSegs - 1, Math.round((k / maxStepK) * (totalSegs - 1)));
        const pos = getBarCenter(idx);
        return (
          <text
            key={k}
            x={pos.x}
            y={pos.y + 42}
            textAnchor="middle"
            fill={k * 1000 >= shiftLightRpm ? '#F87171' : '#FACC15'}
            fontSize="17"
            fontWeight="800"
            fontStyle="italic"
            fontFamily="JetBrains Mono, monospace"
          >
            {k}
          </text>
        );
      })}

      {/* Bottom Speed Cutout Trapezoid (like 198 SPEED KM/H) */}
      <polygon
        points="310,244 355,180 605,180 650,244"
        fill="#080F20"
        stroke="#2563EB"
        strokeWidth="2"
      />
      <text
        x="480"
        y="218"
        textAnchor="middle"
        fill="#EF4444"
        fontSize="34"
        fontWeight="900"
        fontStyle="italic"
        fontFamily="JetBrains Mono, monospace"
      >
        {speedKmh !== null ? speedKmh.toFixed(0) : '--'}
      </text>
      <text
        x="415"
        y="238"
        textAnchor="end"
        fill="#38BDF8"
        fontSize="12"
        fontWeight="700"
        fontFamily="JetBrains Mono, monospace"
      >
        SPEED
      </text>
      <text
        x="535"
        y="238"
        textAnchor="start"
        fill="#94A3B8"
        fontSize="12"
        fontWeight="700"
        fontFamily="JetBrains Mono, monospace"
      >
        KM/H · GEAR {gear === 0 ? 'N' : gear ?? 'N'}
      </text>

      {/* Bottom Right x1000 RPM Legend */}
      <text
        x="915"
        y="198"
        textAnchor="end"
        fill="#38BDF8"
        fontSize="14"
        fontWeight="700"
        fontStyle="italic"
        fontFamily="JetBrains Mono, monospace"
      >
        x1000 RPM
      </text>
      <text
        x="915"
        y="222"
        textAnchor="end"
        fill="#60A5FA"
        fontSize="18"
        fontWeight="800"
        fontStyle="italic"
        fontFamily="JetBrains Mono, monospace"
      >
        TECHO
      </text>
    </svg>
  );
};

interface GaugeMetricCardProps {
  label: string;
  value: string;
  unit: string;
  sub: string;
  accent: string;
  smallValue?: boolean;
}

const GaugeMetricCard: React.FC<GaugeMetricCardProps> = ({
  label,
  value,
  unit,
  sub,
  accent,
  smallValue,
}) => (
  <div className="p-2.5 rounded-lg bg-[#070B14] border border-blue-900/50 hover:border-cyan-500/50 transition-colors flex flex-col justify-between min-h-0">
    <div className="text-[11px] text-slate-400 truncate">{label}</div>
    <div className="flex items-baseline gap-1.5 my-0.5 min-w-0">
      <span
        className={`${
          smallValue ? 'text-sm' : 'text-[26px]'
        } font-bold font-mono-tabular truncate leading-none ${accent}`}
      >
        {value}
      </span>
      {unit && <span className="text-[11px] font-mono-tabular text-slate-400">{unit}</span>}
    </div>
    <div className="text-[10px] text-slate-500 truncate">{sub}</div>
  </div>
);

const LiveWaveformSvg: React.FC<{
  history: LiveTelemetryFrame[];
  maxRpm: number;
}> = ({ history, maxRpm }) => {
  const width = 960;
  const height = 340;
  const pointsCount = 100;
  const slice = history.slice(-pointsCount);

  if (slice.length < 2) {
    return (
      <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
        รอรับสตรีมข้อมูลจากกล่อง ECU...
      </div>
    );
  }

  const makePath = (extractor: (f: LiveTelemetryFrame) => number, min: number, max: number) => {
    const range = Math.max(1e-6, max - min);
    return slice
      .map((f, i) => {
        const x = (i / (pointsCount - 1)) * width;
        const norm = Math.max(0, Math.min(1, (extractor(f) - min) / range));
        const y = height - 14 - norm * (height - 28);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
      <line x1="0" y1={height * 0.25} x2={width} y2={height * 0.25} stroke="#171D2B" />
      <line x1="0" y1={height * 0.5} x2={width} y2={height * 0.5} stroke="#171D2B" />
      <line x1="0" y1={height * 0.75} x2={width} y2={height * 0.75} stroke="#171D2B" />

      <polyline fill="none" stroke="#06B6D4" strokeWidth="2.2" points={makePath((f) => f.rpm, 0, maxRpm)} />
      <polyline fill="none" stroke="#F59E0B" strokeWidth="2.0" points={makePath((f) => f.tpsPercent, 0, 100)} />
      <polyline fill="none" stroke="#10B981" strokeWidth="2.0" points={makePath((f) => f.afr, 10, 17)} />
      <polyline fill="none" stroke="#E11D48" strokeWidth="1.8" points={makePath((f) => f.ignAdvance, 0, 50)} />
    </svg>
  );
};
