import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Flame,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Sliders,
} from 'lucide-react';
import {
  getCalibrationColor,
  getSchemeGradientCss,
  getSchemeScaleLabels,
} from '../engine/colorScale';
import {
  NO_BIN_PLACEHOLDER,
  readTableMatrix,
  resolveTableAxisLabels,
} from '../engine/xdfParser';
import {
  AutoTuneConstraints,
  ConnectionMode,
  EcuProject,
  LiveTelemetryFrame,
} from '../types/ecu';

interface AutoTuneViewProps {
  project: EcuProject | null;
  telemetry: LiveTelemetryFrame | null;
  connectionMode: ConnectionMode;
  onApplyFuelCorrections: (
    fuelTableId: string,
    updates: { row: number; col: number; value: number }[]
  ) => void;
  onUpdateTargetAfrCell: (
    afrTableId: string,
    row: number,
    col: number,
    value: number
  ) => void;
  onStartBenchSim: () => void;
  onConnectWebSerial: () => void;
}

export const AutoTuneView: React.FC<AutoTuneViewProps> = ({
  project,
  telemetry,
  connectionMode,
  onApplyFuelCorrections,
  onUpdateTargetAfrCell,
  onStartBenchSim,
  onConnectWebSerial,
}) => {
  const [isRunning, setIsRunning] = useState(true);
  const [displayLayer, setDisplayLayer] = useState<'correction' | 'target' | 'measured'>(
    'correction'
  );
  const [showControllerDetail, setShowControllerDetail] = useState(false);
  const [showSafetyDetail, setShowSafetyDetail] = useState(false);
  const [constraints, setConstraints] = useState<AutoTuneConstraints>({
    minEctTemp: 60,
    minRpm: 1600,
    minTpsPercent: 2,
    minCellHits: 4,
    maxSingleStepPct: 6,
    maxTotalTrimPct: 25,
    dampingFactor: 0.45,
    autoApplyLive: true,
  });

  // Per-cell accumulators [row][col]
  const [hitCounts, setHitCounts] = useState<number[][]>([]);
  const [afrSums, setAfrSums] = useState<number[][]>([]);
  const [appliedTrimPct, setAppliedTrimPct] = useState<number[][]>([]);
  const [lastAutoAppliedCount, setLastAutoAppliedCount] = useState(0);

  const fuelTable = useMemo(() => {
    if (!project) return null;
    return (
      project.xdf.tables.find((t) => t.id === 'fuel-main-tps') ||
      project.xdf.tables.find((t) => t.category === 'fuel') ||
      project.xdf.tables[0] ||
      null
    );
  }, [project]);

  const targetAfrTable = useMemo(() => {
    if (!project) return null;
    return (
      project.xdf.tables.find((t) => t.id === 'target-afr-map') ||
      project.xdf.tables.find((t) => t.category === 'afr') ||
      null
    );
  }, [project]);

  const { fuelMatrix, stockFuelMatrix, afrMatrix, xLabels, yLabels, fuelMinVal, fuelMaxVal, fuelMidVal } =
    useMemo(() => {
      if (!project || !fuelTable) {
        return {
          fuelMatrix: [] as number[][],
          stockFuelMatrix: [] as number[][],
          afrMatrix: [] as number[][],
          xLabels: [] as number[],
          yLabels: [] as number[],
          fuelMinVal: 0,
          fuelMaxVal: 1,
          fuelMidVal: 0.5,
        };
      }
      const fm = readTableMatrix(project.workingBytes, fuelTable);
      const sm = readTableMatrix(project.originalBytes, fuelTable);
      const am = targetAfrTable
        ? readTableMatrix(project.workingBytes, targetAfrTable)
        : project.customTargetAfrMap && project.customTargetAfrMap.length === fm.length
        ? project.customTargetAfrMap
        : fm.map((row) => row.map(() => 13.5));
      const preferExplicit = project.binFileName === NO_BIN_PLACEHOLDER;
      const xl = resolveTableAxisLabels(
        project.workingBytes,
        fuelTable.xAxis,
        project.xdf.tables,
        preferExplicit
      );
      const yl = resolveTableAxisLabels(
        project.workingBytes,
        fuelTable.yAxis,
        project.xdf.tables,
        preferExplicit
      );

      let min = Infinity;
      let max = -Infinity;
      for (const row of fm) {
        for (const v of row) {
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
      if (!Number.isFinite(min)) min = 0;
      if (!Number.isFinite(max) || max === min) max = min + 1;

      return {
        fuelMatrix: fm,
        stockFuelMatrix: sm,
        afrMatrix: am,
        xLabels: xl,
        yLabels: yl,
        fuelMinVal: min,
        fuelMaxVal: max,
        fuelMidVal: (min + max) / 2,
      };
    }, [project, fuelTable, targetAfrTable]);

  // Reset grids when project or table dimensions change
  const rows = fuelMatrix.length;
  const cols = fuelMatrix[0]?.length || 0;

  const resetSession = () => {
    setHitCounts(Array.from({ length: rows }, () => Array(cols).fill(0)));
    setAfrSums(Array.from({ length: rows }, () => Array(cols).fill(0)));
    setAppliedTrimPct(Array.from({ length: rows }, () => Array(cols).fill(0)));
    setLastAutoAppliedCount(0);
  };

  useEffect(() => {
    if (rows > 0 && cols > 0) {
      resetSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, rows, cols]);

  // Active cell index from live telemetry
  const activeTrace = useMemo(() => {
    if (!telemetry || !fuelTable || xLabels.length === 0 || yLabels.length === 0) return null;
    const getAxisVal = (units: string) => {
      const u = units.toLowerCase();
      if (u.includes('rpm')) return telemetry.rpm;
      if (u.includes('kpa') || u.includes('map')) return telemetry.mapKpa;
      return telemetry.tpsPercent;
    };
    const liveX = getAxisVal(fuelTable.xAxis.units);
    const liveY = getAxisVal(fuelTable.yAxis.units);

    let bestC = 0;
    let minCDiff = Infinity;
    xLabels.forEach((v, idx) => {
      const d = Math.abs(v - liveX);
      if (d < minCDiff) {
        minCDiff = d;
        bestC = idx;
      }
    });
    let bestR = 0;
    let minRDiff = Infinity;
    yLabels.forEach((v, idx) => {
      const d = Math.abs(v - liveY);
      if (d < minRDiff) {
        minRDiff = d;
        bestR = idx;
      }
    });
    return { row: bestR, col: bestC };
  }, [telemetry, fuelTable, xLabels, yLabels]);

  const latestTelemetryTimestampRef = useRef<number>(0);

  // Accumulate AFR samples and auto-apply fuel trim when enabled
  useEffect(() => {
    if (
      !isRunning ||
      !telemetry ||
      !activeTrace ||
      !fuelTable ||
      rows === 0 ||
      cols === 0
    ) {
      return;
    }
    if (telemetry.timestamp === latestTelemetryTimestampRef.current) return;
    latestTelemetryTimestampRef.current = telemetry.timestamp;

    // Safety filter checks
    if (
      telemetry.ectTemp < constraints.minEctTemp ||
      telemetry.rpm < constraints.minRpm ||
      telemetry.tpsPercent < constraints.minTpsPercent
    ) {
      return;
    }

    const { row, col } = activeTrace;
    if (row < 0 || row >= rows || col < 0 || col >= cols) return;

    const prevHits = hitCounts[row]?.[col] ?? 0;
    const prevSum = afrSums[row]?.[col] ?? 0;
    const nextHits = prevHits + 1;
    const nextSum = prevSum + telemetry.afr;

    setHitCounts((prev) => {
      const copy = prev.map((r) => [...r]);
      if (copy[row]) copy[row][col] = nextHits;
      return copy;
    });
    setAfrSums((prev) => {
      const copy = prev.map((r) => [...r]);
      if (copy[row]) copy[row][col] = nextSum;
      return copy;
    });

    // Auto-apply fuel correction when cell hits threshold every N hits
    if (
      constraints.autoApplyLive &&
      nextHits >= constraints.minCellHits &&
      nextHits % constraints.minCellHits === 0
    ) {
      const avgMeasured = nextSum / nextHits;
      const targetAfr = afrMatrix[row]?.[col] ?? 13.5;
      // If measured AFR is higher (leaner) than target, we need POSITIVE fuel trim
      const rawPct = ((avgMeasured - targetAfr) / Math.max(8, targetAfr)) * 100;
      const dampedPct = rawPct * constraints.dampingFactor;
      const stepClamped = Math.max(
        -constraints.maxSingleStepPct,
        Math.min(constraints.maxSingleStepPct, dampedPct)
      );

      const curTotalApplied = appliedTrimPct[row]?.[col] ?? 0;
      const allowedNewTotal = Math.max(
        -constraints.maxTotalTrimPct,
        Math.min(constraints.maxTotalTrimPct, curTotalApplied + stepClamped)
      );
      const effectiveStep = allowedNewTotal - curTotalApplied;

      if (Math.abs(effectiveStep) >= 0.25) {
        const curFuel = fuelMatrix[row]?.[col] ?? 0;
        const nextFuel = Number(
          (curFuel * (1 + effectiveStep / 100)).toFixed(fuelTable.decimalPlaces)
        );
        onApplyFuelCorrections(fuelTable.id, [{ row, col, value: nextFuel }]);
        setAppliedTrimPct((prev) => {
          const copy = prev.map((r) => [...r]);
          if (copy[row]) copy[row][col] = Number(allowedNewTotal.toFixed(1));
          return copy;
        });
        setLastAutoAppliedCount((c) => c + 1);
      }
    }
  }, [
    telemetry,
    isRunning,
    activeTrace,
    fuelTable,
    rows,
    cols,
    constraints,
    hitCounts,
    afrSums,
    afrMatrix,
    appliedTrimPct,
    fuelMatrix,
    onApplyFuelCorrections,
  ]);

  // Manual batch commit of all pending suggested corrections
  const handleManualCommitAll = () => {
    if (!fuelTable) return;
    const updates: { row: number; col: number; value: number }[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const hits = hitCounts[r]?.[c] ?? 0;
        if (hits < constraints.minCellHits) continue;
        const avgAfr = (afrSums[r]?.[c] ?? 0) / hits;
        const target = afrMatrix[r]?.[c] ?? 13.5;
        const pct = ((avgAfr - target) / Math.max(8, target)) * 100 * constraints.dampingFactor;
        const clamped = Math.max(
          -constraints.maxSingleStepPct,
          Math.min(constraints.maxSingleStepPct, pct)
        );
        if (Math.abs(clamped) >= 0.2) {
          const curFuel = fuelMatrix[r]?.[c] ?? 0;
          updates.push({
            row: r,
            col: c,
            value: Number(
              (curFuel * (1 + clamped / 100)).toFixed(fuelTable.decimalPlaces)
            ),
          });
        }
      }
    }
    if (updates.length > 0) {
      onApplyFuelCorrections(fuelTable.id, updates);
      setLastAutoAppliedCount((c) => c + updates.length);
    }
  };

  if (!project || !fuelTable) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-slate-400">
        กรุณาโหลดรุ่นรถหรือไฟล์ .bin/.xdf ที่มีตารางจ่ายน้ำมันก่อนใช้งาน Auto-Tune
      </div>
    );
  }

  const curTargetAfr =
    activeTrace && afrMatrix[activeTrace.row]?.[activeTrace.col] !== undefined
      ? afrMatrix[activeTrace.row][activeTrace.col]
      : 13.5;
  const curMeasuredAfr = telemetry?.afr ?? null;
  const afrDiff = curMeasuredAfr !== null ? curMeasuredAfr - curTargetAfr : null;
  const fuelScaleLabels = getSchemeScaleLabels(fuelTable.colorScheme);
  const isDenseGrid = xLabels.length > 14 || yLabels.length > 14;
  const xIsTps =
    fuelTable.xAxis.units.toLowerCase().includes('tps') ||
    fuelTable.xAxis.units.includes('%');
  const yIsTps =
    fuelTable.yAxis.units.toLowerCase().includes('tps') ||
    fuelTable.yAxis.units.includes('%');

  return (
    <div className="h-full w-full flex flex-col gap-2 p-2.5 overflow-hidden">
      {/* Compact Collapsible Top Aside Strip (Controller + Safety Constraints) */}
      <aside className="grid grid-cols-2 gap-2 shrink-0">
        {/* Panel 1: Compact / Collapsible AFR Auto-Tune Controller */}
        <div className="bg-[#11151E] border border-[#242B3B] rounded-lg px-3 py-2 flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Flame className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <h1 className="text-xs font-bold text-white whitespace-nowrap">
                AFR Auto-Tune
              </h1>
              <span className="text-[11px] font-mono-tabular text-cyan-400 whitespace-nowrap">
                · ปรับแล้ว {lastAutoAppliedCount}
              </span>
              {connectionMode !== 'disconnected' ? (
                <span className="text-[11px] font-mono-tabular text-slate-200 whitespace-nowrap">
                  · รถ <strong className="text-white">{curMeasuredAfr !== null ? curMeasuredAfr.toFixed(2) : '--'}</strong>{' '}
                  / เป้า <strong className="text-emerald-400">{curTargetAfr.toFixed(1)}</strong>{' '}
                  {afrDiff !== null && (
                    <span
                      className={
                        Math.abs(afrDiff) < 0.3
                          ? 'text-emerald-400'
                          : afrDiff > 0
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }
                    >
                      ({afrDiff > 0 ? '+' : ''}
                      {afrDiff.toFixed(2)})
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-[11px] text-slate-400 truncate">· ยังไม่เชื่อมต่อ ECU</span>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {connectionMode === 'disconnected' && (
                <>
                  <button
                    type="button"
                    onClick={onConnectWebSerial}
                    className="h-7 px-2 rounded bg-rose-600 hover:bg-rose-500 text-[11px] font-semibold text-white cursor-pointer whitespace-nowrap"
                  >
                    ต่อ K-Line
                  </button>
                  <button
                    type="button"
                    onClick={onStartBenchSim}
                    className="h-7 px-2 rounded bg-[#182030] hover:bg-[#232E45] text-[11px] text-slate-200 cursor-pointer whitespace-nowrap"
                  >
                    Bench Test
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setIsRunning((r) => !r)}
                className={`h-7 px-2 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                  isRunning
                    ? 'bg-amber-600/20 border border-amber-500/50 text-amber-300'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {isRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                <span>{isRunning ? 'พัก' : 'เริ่ม'}</span>
              </button>
              <button
                type="button"
                onClick={handleManualCommitAll}
                className="h-7 px-2.5 rounded bg-rose-600 hover:bg-rose-500 text-[11px] font-semibold text-white flex items-center gap-1 cursor-pointer whitespace-nowrap"
                title="นำค่าชดเชยที่คำนวณได้ทั้งหมดเขียนลงตารางน้ำมันทันที"
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>ปรับเข้าตาราง</span>
              </button>
              <button
                type="button"
                onClick={resetSession}
                className="h-7 px-2 rounded bg-[#171C28] hover:bg-[#22293B] text-slate-300 cursor-pointer"
                title="ล้างข้อมูล Cell Hits"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => setShowControllerDetail((v) => !v)}
                className="h-7 px-1.5 rounded bg-[#171C28] hover:bg-[#22293B] text-slate-300 cursor-pointer"
                title={showControllerDetail ? 'พับเก็บแผงตัวเลขใหญ่' : 'ขยายดูตัวเลข AFR ขนาดใหญ่'}
              >
                {showControllerDetail ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {showControllerDetail && (
            <div className="grid grid-cols-3 gap-2 pt-1.5 border-t border-[#1E2535]">
              <div className="p-2 rounded bg-[#0B0E15] border border-[#232A3B]">
                <div className="text-[10px] text-slate-400">AFR จากรถ</div>
                <div className="text-xl font-bold font-mono-tabular text-white mt-0.5">
                  {curMeasuredAfr !== null ? curMeasuredAfr.toFixed(2) : '--'}
                </div>
              </div>
              <div className="p-2 rounded bg-[#0B0E15] border border-[#232A3B]">
                <div className="text-[10px] text-slate-400">Target AFR</div>
                <div className="text-xl font-bold font-mono-tabular text-emerald-400 mt-0.5">
                  {curTargetAfr.toFixed(1)}
                </div>
              </div>
              <div className="p-2 rounded bg-[#0B0E15] border border-[#232A3B]">
                <div className="text-[10px] text-slate-400">ส่วนต่าง</div>
                <div
                  className={`text-xl font-bold font-mono-tabular mt-0.5 ${
                    afrDiff === null
                      ? 'text-slate-400'
                      : Math.abs(afrDiff) < 0.3
                      ? 'text-emerald-400'
                      : afrDiff > 0
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                >
                  {afrDiff !== null ? `${afrDiff > 0 ? '+' : ''}${afrDiff.toFixed(2)}` : '--'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Panel 2: Compact / Collapsible Safety Constraints */}
        <div className="bg-[#11151E] border border-[#242B3B] rounded-lg px-3 py-2 flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <h2 className="text-xs font-bold text-white whitespace-nowrap">
                เงื่อนไขความปลอดภัย
              </h2>
              <span className="text-[11px] font-mono-tabular text-slate-400 truncate">
                · ECT≥{constraints.minEctTemp}°C · RPM≥{constraints.minRpm} · Hit≥
                {constraints.minCellHits} · ±{constraints.maxTotalTrimPct}%
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <label className="flex items-center gap-1.5 text-[11px] cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={constraints.autoApplyLive}
                  onChange={(e) =>
                    setConstraints((prev) => ({
                      ...prev,
                      autoApplyLive: e.target.checked,
                    }))
                  }
                  className="accent-rose-500"
                />
                <span className="text-slate-200 font-medium">ปรับอัตโนมัติ</span>
              </label>

              <button
                type="button"
                onClick={() => setShowSafetyDetail((v) => !v)}
                className="h-7 px-2 rounded bg-[#171C28] hover:bg-[#22293B] text-[11px] text-slate-300 flex items-center gap-1 cursor-pointer whitespace-nowrap"
                title={showSafetyDetail ? 'พับเก็บตั้งค่าเงื่อนไข' : 'กางตั้งค่าเงื่อนไข'}
              >
                <Sliders className="w-3 h-3 text-cyan-400" />
                <span>{showSafetyDetail ? 'พับเก็บ' : 'ตั้งค่า'}</span>
                {showSafetyDetail ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {showSafetyDetail && (
            <div className="grid grid-cols-4 gap-2 pt-1.5 border-t border-[#1E2535] text-xs">
              <label className="flex flex-col gap-0.5">
                <span className="text-[10px] text-slate-400">ECT ขั้นต่ำ (°C)</span>
                <input
                  type="number"
                  value={constraints.minEctTemp}
                  onChange={(e) =>
                    setConstraints((p) => ({
                      ...p,
                      minEctTemp: Number(e.target.value) || 0,
                    }))
                  }
                  className="h-7 px-2 bg-[#090B10] border border-[#2A3347] rounded font-mono-tabular text-white text-xs"
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-[10px] text-slate-400">RPM ขั้นต่ำ</span>
                <input
                  type="number"
                  step={100}
                  value={constraints.minRpm}
                  onChange={(e) =>
                    setConstraints((p) => ({
                      ...p,
                      minRpm: Number(e.target.value) || 0,
                    }))
                  }
                  className="h-7 px-2 bg-[#090B10] border border-[#2A3347] rounded font-mono-tabular text-white text-xs"
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-[10px] text-slate-400">Hit ขั้นต่ำ/ช่อง</span>
                <input
                  type="number"
                  min={1}
                  value={constraints.minCellHits}
                  onChange={(e) =>
                    setConstraints((p) => ({
                      ...p,
                      minCellHits: Math.max(1, Number(e.target.value) || 1),
                    }))
                  }
                  className="h-7 px-2 bg-[#090B10] border border-[#2A3347] rounded font-mono-tabular text-white text-xs"
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-[10px] text-slate-400">จำกัดสูงสุด (±%)</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={constraints.maxTotalTrimPct}
                  onChange={(e) =>
                    setConstraints((p) => ({
                      ...p,
                      maxTotalTrimPct: Math.max(1, Number(e.target.value) || 15),
                    }))
                  }
                  className="h-7 px-2 bg-[#090B10] border border-[#2A3347] rounded font-mono-tabular text-white text-xs"
                />
              </label>
            </div>
          )}
        </div>
      </aside>

      {/* Main Primary Full-Width Auto-Tune AFR Matrix with Stock Fuel & Fuel Heatmap Colors */}
      <section className="flex-1 min-h-0 bg-[#11151E] border border-[#242B3B] rounded-lg flex flex-col overflow-hidden">
        <div className="px-3 py-2 border-b border-[#242B3B] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div>
            <h2 className="text-xs font-bold text-white">
              ตารางปรับน้ำมันอัตโนมัติ AFR — {fuelTable.title}
            </h2>
            <p className="text-[11px] text-slate-400">
              แสดงค่าน้ำมันใหม่เทียบ <span className="text-slate-200">ค่าเดิมโรงงาน</span> พร้อมไล่เฉดสีระดับการจ่ายน้ำมันแบบตารางน้ำมันหลัก · กรอบฟ้า = ตำแหน่งทำงานจริง
            </p>
          </div>

          <div className="flex items-center gap-1 bg-[#090B10] p-0.5 rounded border border-[#242B3B]">
            <button
              type="button"
              onClick={() => setDisplayLayer('correction')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer whitespace-nowrap ${
                displayLayer === 'correction'
                  ? 'bg-rose-600 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              ค่าน้ำมัน + % ชดเชย
            </button>
            <button
              type="button"
              onClick={() => setDisplayLayer('measured')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer whitespace-nowrap ${
                displayLayer === 'measured'
                  ? 'bg-rose-600 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              AFR ที่วัดได้ + ค่าเดิม
            </button>
            <button
              type="button"
              onClick={() => setDisplayLayer('target')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer whitespace-nowrap ${
                displayLayer === 'target'
                  ? 'bg-rose-600 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              ตั้งค่า Target AFR
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-2.5">
          <table
            className={`w-max min-w-full border-collapse font-mono-tabular ${
              isDenseGrid ? 'text-[10.5px]' : 'text-xs h-full'
            }`}
          >
            <thead>
              <tr>
                <th
                  className={`sticky top-0 left-0 z-20 bg-[#0D1018] border border-[#242B3B] text-slate-400 text-left whitespace-nowrap ${
                    isDenseGrid ? 'px-1.5 py-1 text-[9.5px]' : 'px-2 py-1.5 text-[10px]'
                  }`}
                >
                  {fuelTable.yAxis.units} \ {fuelTable.xAxis.units}
                </th>
                {xLabels.map((xVal, c) => (
                  <th
                    key={c}
                    className={`sticky top-0 z-10 border whitespace-nowrap ${
                      isDenseGrid
                        ? 'px-1 py-1 text-[10px] min-w-[46px]'
                        : 'px-1.5 py-1.5 text-[11px]'
                    } ${
                      activeTrace?.col === c && connectionMode !== 'disconnected'
                        ? 'bg-cyan-950/75 border-cyan-400/70 text-cyan-200'
                        : 'bg-[#141925] border-[#242B3B] text-slate-200'
                    }`}
                  >
                    {xVal}
                    {xIsTps ? '%' : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fuelMatrix.map((rowVals, r) => (
                <tr key={r}>
                  <th
                    className={`sticky left-0 z-10 border text-right whitespace-nowrap ${
                      isDenseGrid
                        ? 'px-1.5 py-0.5 text-[10px] min-w-[42px]'
                        : 'px-2 py-1 text-[11px]'
                    } ${
                      activeTrace?.row === r && connectionMode !== 'disconnected'
                        ? 'bg-cyan-950/75 border-cyan-400/70 text-cyan-200'
                        : 'bg-[#141925] border-[#242B3B] text-slate-200'
                    }`}
                  >
                    {yLabels[r]}
                    {yIsTps ? '%' : ''}
                  </th>
                  {rowVals.map((curFuel, c) => {
                    const stockFuel = stockFuelMatrix[r]?.[c] ?? curFuel;
                    const fuelDelta = curFuel - stockFuel;
                    const hits = hitCounts[r]?.[c] ?? 0;
                    const avgAfr = hits > 0 ? (afrSums[r]?.[c] ?? 0) / hits : null;
                    const target = afrMatrix[r]?.[c] ?? 13.5;
                    const trim = appliedTrimPct[r]?.[c] ?? 0;
                    const isLive =
                      activeTrace?.row === r &&
                      activeTrace?.col === c &&
                      connectionMode !== 'disconnected';

                    // Apply main Fuel Table color gradient to cells; in Target AFR view use AFR scale
                    const cellBg =
                      displayLayer === 'target'
                        ? getCalibrationColor(target, 11.5, 15.2, 'afr', 0.36)
                        : getCalibrationColor(
                            curFuel,
                            fuelMinVal,
                            fuelMaxVal,
                            fuelTable.colorScheme,
                            0.36
                          );

                    return (
                      <td
                        key={c}
                        style={{ backgroundColor: cellBg }}
                        className={`border text-center transition-colors ${
                          isDenseGrid ? 'px-1 py-0.5 min-w-[46px]' : 'px-1.5 py-1.5'
                        } ${
                          isLive
                            ? 'border-cyan-300 ring-2 ring-inset ring-cyan-300 shadow-[inset_0_0_12px_rgba(6,182,212,0.5)] z-10'
                            : 'border-[#222938]'
                        }`}
                      >
                        {displayLayer === 'target' ? (
                          <div className="flex flex-col items-center">
                            <input
                              type="number"
                              step="0.1"
                              min="9.5"
                              max="16.5"
                              value={target}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                if (!Number.isNaN(v)) {
                                  onUpdateTargetAfrCell(
                                    targetAfrTable?.id || 'custom-target-afr',
                                    r,
                                    c,
                                    v
                                  );
                                }
                              }}
                              className="w-12 bg-transparent text-center text-white font-semibold focus:bg-[#090B10] focus:outline-none rounded"
                            />
                            <span className="text-[9px] text-slate-300/80 leading-none">
                              เดิม {stockFuel.toFixed(fuelTable.decimalPlaces)}
                            </span>
                          </div>
                        ) : displayLayer === 'measured' ? (
                          <div>
                            <div className="text-white font-semibold leading-tight">
                              {avgAfr !== null ? avgAfr.toFixed(1) : curFuel.toFixed(fuelTable.decimalPlaces)}
                            </div>
                            <div className="text-[9px] text-slate-300 leading-tight">
                              เดิม {stockFuel.toFixed(fuelTable.decimalPlaces)}
                            </div>
                            <div className="text-[8.5px] text-cyan-300 leading-none mt-0.5">
                              {hits > 0 ? `AFR (${hits})` : `${fuelTable.units}`}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-baseline justify-center gap-1 leading-tight">
                              <span className="text-white font-bold">
                                {curFuel.toFixed(fuelTable.decimalPlaces)}
                              </span>
                              {(trim !== 0 || Math.abs(fuelDelta) > 0.001) && (
                                <span
                                  className={`text-[9px] font-semibold ${
                                    trim > 0 || fuelDelta > 0
                                      ? 'text-emerald-300'
                                      : 'text-rose-300'
                                  }`}
                                >
                                  {trim !== 0
                                    ? `${trim > 0 ? '+' : ''}${trim.toFixed(1)}%`
                                    : `${fuelDelta > 0 ? '+' : ''}${fuelDelta.toFixed(fuelTable.decimalPlaces)}`}
                                </span>
                              )}
                            </div>
                            <div className="text-[9px] text-slate-200/85 leading-tight">
                              เดิม {stockFuel.toFixed(fuelTable.decimalPlaces)}
                            </div>
                            {hits > 0 && (
                              <div className="text-[8.5px] text-cyan-300 leading-none mt-0.5">
                                {avgAfr?.toFixed(1)} ({hits})
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Main Fuel Table Color Scale Legend */}
        <div className="px-3 py-1.5 bg-[#0E121B] border-t border-[#242B3B] shrink-0">
          <div className="flex items-center justify-between text-[11px] font-mono-tabular mb-1">
            <span className="text-sky-300">
              ต่ำสุด: {fuelMinVal.toFixed(fuelTable.decimalPlaces)} {fuelTable.units} ·{' '}
              {fuelScaleLabels.lowLabel}
            </span>
            <span className="text-emerald-300">
              กลาง: {fuelMidVal.toFixed(fuelTable.decimalPlaces)} {fuelTable.units}
            </span>
            <span className="text-rose-400">
              สูงสุด: {fuelMaxVal.toFixed(fuelTable.decimalPlaces)} {fuelTable.units} ·{' '}
              {fuelScaleLabels.highLabel}
            </span>
          </div>
          <div
            className="h-2 w-full rounded-sm border border-[#2A3347]"
            style={{
              background: getSchemeGradientCss(fuelTable.colorScheme),
            }}
          />
        </div>
      </section>
    </div>
  );
};
