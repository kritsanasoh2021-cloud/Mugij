import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowLeftRight,
  Box,
  Equal,
  Flame,
  Grid3X3,
  LineChart,
  Link2,
  Link2Off,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  Sparkles,
  Target,
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
import { EcuProject, LiveTelemetryFrame } from '../types/ecu';
import { Map3DSurface, Visited3DAfrCell } from './Map3DSurface';

interface CellCoord {
  row: number;
  col: number;
}

interface TargetAfrWorkbenchPanelProps {
  project: EcuProject;
  telemetry: LiveTelemetryFrame | null;
  sessionTelemetryLog: LiveTelemetryFrame[];
  onUpdateTargetAfrMap: (
    updates: { row: number; col: number; targetAfr: number }[],
    correlateFuel: boolean
  ) => void;
  onUpdateStoichAfr: (stoichAfr: number) => void;
  onJumpToFuelTable: (fuelTableId: string) => void;
}

type AfrSubView = 'table' | '3d' | '2d';
type DisplayUnit = 'afr' | 'lambda';

const STOICH_PRESETS = [
  { label: 'เบนซิน 95 (14.7)', value: 14.7 },
  { label: 'E10 (14.1)', value: 14.1 },
  { label: 'E20 (13.8)', value: 13.8 },
  { label: 'E85 (9.8)', value: 9.8 },
];

export const TargetAfrWorkbenchPanel: React.FC<TargetAfrWorkbenchPanelProps> = ({
  project,
  telemetry,
  sessionTelemetryLog,
  onUpdateTargetAfrMap,
  onUpdateStoichAfr,
  onJumpToFuelTable,
}) => {
  const [unit, setUnit] = useState<DisplayUnit>('afr');
  const [autoCorrelateFuel, setAutoCorrelateFuel] = useState(true);
  const [subView, setSubView] = useState<AfrSubView>('table');
  const [selectedCells, setSelectedCells] = useState<CellCoord[]>([{ row: 0, col: 0 }]);
  const [anchorCell, setAnchorCell] = useState<CellCoord | null>({ row: 0, col: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [touchMode, setTouchMode] = useState<'select' | 'scroll'>('select');
  const [rangeTapMode, setRangeTapMode] = useState(false);
  const lastTapRef = useRef<{ row: number; col: number; time: number } | null>(null);
  const [batchInput, setBatchInput] = useState('13.0');
  const [editingCell, setEditingCell] = useState<CellCoord | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [activeRegionTag, setActiveRegionTag] = useState<string | null>(null);

  const stoich = project.stoichAfr || 14.7;

  useEffect(() => {
    const onUp = () => setIsDragging(false);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  // Keep batch input sensible when toggling AFR <-> Lambda
  const handleToggleUnit = (nextUnit: DisplayUnit) => {
    if (nextUnit === unit) return;
    const num = parseFloat(batchInput);
    if (!Number.isNaN(num)) {
      if (nextUnit === 'lambda') {
        setBatchInput((num / stoich).toFixed(3));
      } else {
        setBatchInput((num * stoich).toFixed(1));
      }
    } else {
      setBatchInput(nextUnit === 'lambda' ? '0.880' : '13.0');
    }
    setUnit(nextUnit);
  };

  const fuelTable = useMemo(() => {
    return (
      project.xdf.tables.find((t) => t.id === 'fuel-main-tps') ||
      project.xdf.tables.find((t) => t.category === 'fuel') ||
      project.xdf.tables[0] ||
      null
    );
  }, [project]);

  const afrTable = useMemo(() => {
    return (
      project.xdf.tables.find((t) => t.id === 'target-afr-map') ||
      project.xdf.tables.find((t) => t.category === 'afr') ||
      null
    );
  }, [project]);

  const getAxisTelemetryVal = (unitStr: string, frame: LiveTelemetryFrame) => {
    const u = unitStr.toLowerCase();
    if (u.includes('rpm')) return frame.rpm;
    if (u.includes('kpa') || u.includes('map')) return frame.mapKpa;
    return frame.tpsPercent;
  };

  const {
    afrMatrix,
    stockAfrMatrix,
    fuelWorkingMatrix,
    fuelStockMatrix,
    xLabels,
    yLabels,
    xUnit,
    yUnit,
    xIsTps,
  } = useMemo(() => {
    const fWork = fuelTable ? readTableMatrix(project.workingBytes, fuelTable) : [];
    const fStock = fuelTable ? readTableMatrix(project.originalBytes, fuelTable) : [];
    const resolvedXUnit = afrTable?.xAxis.units || fuelTable?.xAxis.units || 'RPM';
    const resolvedYUnit = afrTable?.yAxis.units || fuelTable?.yAxis.units || 'TPS %';
    const resolvedXIsTps =
      resolvedXUnit.toLowerCase().includes('tps') || resolvedXUnit.includes('%');

    const computeFallbackAfr = () =>
      fWork.map((row, r) =>
        row.map((_, c) => {
          const rowNorm = fWork.length > 1 ? r / (fWork.length - 1) : 0;
          const colNorm = row.length > 1 ? c / (row.length - 1) : 0;
          const tpsNorm = resolvedXIsTps ? colNorm : rowNorm;
          const rpmNorm = resolvedXIsTps ? rowNorm : colNorm;
          const base =
            tpsNorm < 0.25
              ? 14.5 - rpmNorm * 0.4
              : tpsNorm < 0.65
              ? 13.8 - rpmNorm * 0.6
              : 13.0 - rpmNorm * 0.4;
          return Number(base.toFixed(1));
        })
      );

    const aWork = afrTable
      ? readTableMatrix(project.workingBytes, afrTable)
      : project.customTargetAfrMap && project.customTargetAfrMap.length === fWork.length
      ? project.customTargetAfrMap
      : computeFallbackAfr();

    const aStock = afrTable
      ? readTableMatrix(project.originalBytes, afrTable)
      : computeFallbackAfr();

    const preferExplicit = project.binFileName === NO_BIN_PLACEHOLDER;
    const xl = afrTable
      ? resolveTableAxisLabels(
          project.workingBytes,
          afrTable.xAxis,
          project.xdf.tables,
          preferExplicit
        )
      : fuelTable
      ? resolveTableAxisLabels(
          project.workingBytes,
          fuelTable.xAxis,
          project.xdf.tables,
          preferExplicit
        )
      : [];
    const yl = afrTable
      ? resolveTableAxisLabels(
          project.workingBytes,
          afrTable.yAxis,
          project.xdf.tables,
          preferExplicit
        )
      : fuelTable
      ? resolveTableAxisLabels(
          project.workingBytes,
          fuelTable.yAxis,
          project.xdf.tables,
          preferExplicit
        )
      : [];

    return {
      afrMatrix: aWork,
      stockAfrMatrix: aStock,
      fuelWorkingMatrix: fWork,
      fuelStockMatrix: fStock,
      xLabels: xl,
      yLabels: yl,
      xUnit: resolvedXUnit,
      yUnit: resolvedYUnit,
      xIsTps: resolvedXIsTps,
    };
  }, [project, fuelTable, afrTable]);

  // Display matrix in active unit (AFR or Lambda)
  const displayMatrix = useMemo(() => {
    if (unit === 'afr') return afrMatrix;
    return afrMatrix.map((row) =>
      row.map((afr) => Number((afr / stoich).toFixed(3)))
    );
  }, [afrMatrix, unit, stoich]);

  // Correlate each Target AFR cell (r, c) to nearest Fuel Table cell
  const preferExplicit = project.binFileName === NO_BIN_PLACEHOLDER;
  const fuelXLabels = useMemo(
    () =>
      fuelTable
        ? resolveTableAxisLabels(
            project.workingBytes,
            fuelTable.xAxis,
            project.xdf.tables,
            preferExplicit
          )
        : [],
    [project.workingBytes, project.xdf.tables, fuelTable, preferExplicit]
  );
  const fuelYLabels = useMemo(
    () =>
      fuelTable
        ? resolveTableAxisLabels(
            project.workingBytes,
            fuelTable.yAxis,
            project.xdf.tables,
            preferExplicit
          )
        : [],
    [project.workingBytes, project.xdf.tables, fuelTable, preferExplicit]
  );

  const getCorrelatedFuel = (r: number, c: number) => {
    if (!fuelTable || fuelWorkingMatrix.length === 0) return null;
    const sameShape =
      fuelWorkingMatrix.length === afrMatrix.length &&
      (fuelWorkingMatrix[0]?.length || 0) === (afrMatrix[0]?.length || 0);
    let fr = r;
    let fc = c;
    if (!sameShape) {
      const targetY = yLabels[r] ?? 0;
      const targetX = xLabels[c] ?? 0;
      let bestYDiff = Infinity;
      fuelYLabels.forEach((yv, idx) => {
        const d = Math.abs(yv - targetY);
        if (d < bestYDiff) {
          bestYDiff = d;
          fr = idx;
        }
      });
      let bestXDiff = Infinity;
      fuelXLabels.forEach((xv, idx) => {
        const d = Math.abs(xv - targetX);
        if (d < bestXDiff) {
          bestXDiff = d;
          fc = idx;
        }
      });
    }
    const workVal = fuelWorkingMatrix[fr]?.[fc] ?? 0;
    const stockVal = fuelStockMatrix[fr]?.[fc] ?? workVal;
    const pctDelta = stockVal > 0 ? ((workVal - stockVal) / stockVal) * 100 : 0;
    return {
      row: fr,
      col: fc,
      workVal,
      stockVal,
      pctDelta,
      decimalPlaces: fuelTable.decimalPlaces,
      units: fuelTable.units,
    };
  };

  // Live trace coordinate on Target AFR map
  const liveTrace = useMemo(() => {
    if (!telemetry || xLabels.length === 0 || yLabels.length === 0) return null;
    const liveX = getAxisTelemetryVal(xUnit, telemetry);
    const liveY = getAxisTelemetryVal(yUnit, telemetry);

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
  }, [telemetry, xLabels, yLabels, xUnit, yUnit]);

  // Historical AFR overlay against user-defined Target AFR
  const historyStats = useMemo(() => {
    const rows = afrMatrix.length;
    const cols = afrMatrix[0]?.length || 0;
    const grid: ({ avgAfr: number; hits: number; status: 'rich' | 'optimal' | 'lean' } | null)[][] =
      Array.from({ length: rows }, () => Array(cols).fill(null));
    const visitedList: Visited3DAfrCell[] = [];
    if (rows === 0 || cols === 0 || sessionTelemetryLog.length === 0) {
      return { grid, visitedList };
    }

    const sums = Array.from({ length: rows }, () => Array(cols).fill(0));
    const counts = Array.from({ length: rows }, () => Array(cols).fill(0));

    const findNearest = (labels: number[], val: number) => {
      let best = 0;
      let diff = Infinity;
      labels.forEach((l, idx) => {
        const d = Math.abs(l - val);
        if (d < diff) {
          diff = d;
          best = idx;
        }
      });
      return best;
    };

    for (const f of sessionTelemetryLog) {
      const c = findNearest(xLabels, getAxisTelemetryVal(xUnit, f));
      const r = findNearest(yLabels, getAxisTelemetryVal(yUnit, f));
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        sums[r][c] += f.afr;
        counts[r][c] += 1;
      }
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const hits = counts[r][c];
        if (hits === 0) continue;
        const avgAfr = sums[r][c] / hits;
        const target = afrMatrix[r][c] ?? 13.5;
        const delta = avgAfr - target;
        const status: 'rich' | 'optimal' | 'lean' =
          Math.abs(delta) <= 0.35 ? 'optimal' : delta > 0.35 ? 'lean' : 'rich';
        grid[r][c] = { avgAfr, hits, status };
        visitedList.push({ row: r, col: c, avgAfr, hits, status });
      }
    }
    return { grid, visitedList };
  }, [afrMatrix, xLabels, yLabels, xUnit, yUnit, sessionTelemetryLog]);

  const { minVal, maxVal, midVal } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const row of displayMatrix) {
      for (const v of row) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    if (!Number.isFinite(min)) min = unit === 'afr' ? 11.5 : 0.78;
    if (!Number.isFinite(max) || max === min) max = min + (unit === 'afr' ? 3 : 0.2);
    return { minVal: min, maxVal: max, midVal: (min + max) / 2 };
  }, [displayMatrix, unit]);

  const isCellSelected = (r: number, c: number) =>
    selectedCells.some((cell) => cell.row === r && cell.col === c);

  const selectRange = (a: CellCoord, b: CellCoord) => {
    const rMin = Math.min(a.row, b.row);
    const rMax = Math.max(a.row, b.row);
    const cMin = Math.min(a.col, b.col);
    const cMax = Math.max(a.col, b.col);
    const next: CellCoord[] = [];
    for (let r = rMin; r <= rMax; r++) {
      for (let c = cMin; c <= cMax; c++) {
        next.push({ row: r, col: c });
      }
    }
    setActiveRegionTag(null);
    setSelectedCells(next);
  };

  // Quick RPM / TPS Region Selection & Target Preset
  const selectRegion = (
    regionId: 'idle' | 'cruise' | 'mid' | 'wot',
    suggestedAfr?: number
  ) => {
    const rows = afrMatrix.length;
    const cols = afrMatrix[0]?.length || 0;
    const tpsLabels = xIsTps ? xLabels : yLabels;
    const maxTpsLabel = tpsLabels.length > 0 ? Math.max(...tpsLabels) : 100;
    const tpsScale = maxTpsLabel > 0 ? 100 / maxTpsLabel : 1;

    const coords: CellCoord[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const rawTps = xIsTps
          ? xLabels[c] ?? (c / Math.max(1, cols - 1)) * maxTpsLabel
          : yLabels[r] ?? (r / Math.max(1, rows - 1)) * maxTpsLabel;
        const tpsPct = rawTps * tpsScale;
        const rpm = xIsTps
          ? yLabels[r] ?? 1500 + r * 300
          : xLabels[c] ?? 1500 + c * 1000;
        const match =
          regionId === 'idle'
            ? tpsPct <= 12 && rpm <= 3500
            : regionId === 'cruise'
            ? tpsPct > 5 && tpsPct <= 45 && rpm > 2500
            : regionId === 'mid'
            ? tpsPct > 40 && tpsPct <= 75
            : tpsPct > 75;
        if (match) coords.push({ row: r, col: c });
      }
    }
    if (coords.length > 0) {
      setSelectedCells(coords);
      setAnchorCell(coords[0]);
      setActiveRegionTag(regionId);
      if (suggestedAfr !== undefined) {
        setBatchInput(
          unit === 'afr' ? suggestedAfr.toFixed(1) : (suggestedAfr / stoich).toFixed(3)
        );
      }
    }
  };

  const applyBatchToSelected = (mode: 'add' | 'sub' | 'set') => {
    if (selectedCells.length === 0) return;
    const rawParam = parseFloat(batchInput);
    if (Number.isNaN(rawParam)) return;

    const updates = selectedCells.map(({ row, col }) => {
      const curAfr = afrMatrix[row]?.[col] ?? 13.5;
      const stepAfr = unit === 'afr' ? rawParam : rawParam * stoich;
      let nextAfr = curAfr;
      if (mode === 'add') nextAfr = curAfr + stepAfr;
      else if (mode === 'sub') nextAfr = curAfr - stepAfr;
      else nextAfr = stepAfr;
      return {
        row,
        col,
        targetAfr: Math.max(9.0, Math.min(18.0, Number(nextAfr.toFixed(2)))),
      };
    });

    onUpdateTargetAfrMap(updates, autoCorrelateFuel);
  };

  const applyInterpolate = () => {
    if (selectedCells.length < 2) return;
    const rows = selectedCells.map((c) => c.row);
    const cols = selectedCells.map((c) => c.col);
    const rMin = Math.min(...rows);
    const rMax = Math.max(...rows);
    const cMin = Math.min(...cols);
    const cMax = Math.max(...cols);

    const v00 = afrMatrix[rMin]?.[cMin] ?? 13.5;
    const v01 = afrMatrix[rMin]?.[cMax] ?? 13.5;
    const v10 = afrMatrix[rMax]?.[cMin] ?? 13.5;
    const v11 = afrMatrix[rMax]?.[cMax] ?? 13.5;

    const updates: { row: number; col: number; targetAfr: number }[] = [];
    for (let r = rMin; r <= rMax; r++) {
      const ty = rMax === rMin ? 0 : (r - rMin) / (rMax - rMin);
      for (let c = cMin; c <= cMax; c++) {
        const tx = cMax === cMin ? 0 : (c - cMin) / (cMax - cMin);
        const top = v00 + (v01 - v00) * tx;
        const bot = v10 + (v11 - v10) * tx;
        const val = top + (bot - top) * ty;
        updates.push({ row: r, col: c, targetAfr: Number(val.toFixed(2)) });
      }
    }
    onUpdateTargetAfrMap(updates, autoCorrelateFuel);
  };

  const applyFullMapPreset = (profile: 'eco' | 'sport' | 'race') => {
    const rows = afrMatrix.length;
    const cols = afrMatrix[0]?.length || 0;
    const tpsLabels = xIsTps ? xLabels : yLabels;
    const maxTpsLabel = tpsLabels.length > 0 ? Math.max(...tpsLabels) : 100;
    const updates: { row: number; col: number; targetAfr: number }[] = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const rawTps = xIsTps
          ? xLabels[c] ?? (c / Math.max(1, cols - 1)) * maxTpsLabel
          : yLabels[r] ?? (r / Math.max(1, rows - 1)) * maxTpsLabel;
        const tpsNorm = Math.min(1, Math.max(0, rawTps / Math.max(1, maxTpsLabel)));
        const rpmNorm = xIsTps
          ? rows > 1
            ? r / (rows - 1)
            : 0
          : cols > 1
          ? c / (cols - 1)
          : 0;
        let afr = 14.0;
        if (profile === 'eco') {
          afr =
            tpsNorm < 0.35
              ? 14.7 - rpmNorm * 0.2
              : tpsNorm < 0.75
              ? 14.1 - rpmNorm * 0.4
              : 13.2 - rpmNorm * 0.3;
        } else if (profile === 'sport') {
          afr =
            tpsNorm < 0.2
              ? 14.3 - rpmNorm * 0.3
              : tpsNorm < 0.65
              ? 13.5 - rpmNorm * 0.4
              : 12.8 - rpmNorm * 0.3;
        } else {
          // Race / Heavy Load WOT cooling
          afr =
            tpsNorm < 0.15
              ? 13.8 - rpmNorm * 0.2
              : tpsNorm < 0.55
              ? 13.1 - rpmNorm * 0.3
              : 12.5 - rpmNorm * 0.3;
        }
        // Adjust cleanly if running E20/E85 stoich
        const stoichScaled = afr * (stoich / 14.7);
        updates.push({
          row: r,
          col: c,
          targetAfr: Number(stoichScaled.toFixed(2)),
        });
      }
    }
    onUpdateTargetAfrMap(updates, autoCorrelateFuel);
  };

  const revertSelectedToStock = () => {
    if (selectedCells.length === 0) return;
    const updates = selectedCells.map(({ row, col }) => ({
      row,
      col,
      targetAfr: stockAfrMatrix[row]?.[col] ?? 13.5,
    }));
    onUpdateTargetAfrMap(updates, autoCorrelateFuel);
  };

  const commitInlineEdit = () => {
    if (!editingCell) return;
    const raw = parseFloat(editDraft);
    if (!Number.isNaN(raw) && raw > 0) {
      const targetAfr = unit === 'afr' ? raw : raw * stoich;
      onUpdateTargetAfrMap(
        [{ row: editingCell.row, col: editingCell.col, targetAfr }],
        autoCorrelateFuel
      );
    }
    setEditingCell(null);
  };

  const primarySelected = selectedCells[0] || { row: 0, col: 0 };
  const primaryAfr = afrMatrix[primarySelected.row]?.[primarySelected.col] ?? 13.5;
  const primaryLambda = primaryAfr / stoich;
  const primaryFuel = getCorrelatedFuel(primarySelected.row, primarySelected.col);
  const scaleLabels = getSchemeScaleLabels('afr');
  const decimals = unit === 'afr' ? 1 : 3;
  const isDenseGrid = xLabels.length > 14 || yLabels.length > 14;

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2.5 overflow-hidden">
      {/* Target Lambda/AFR Control & Correlation Strip */}
      <div className="bg-[#11151E] border border-[#242B3B] rounded-lg px-3 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
        {/* Left: Unit Toggle (AFR / Lambda), Fuel Stoich Ref, Auto-Correlate Fuel Link */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-[#090B10] p-0.5 rounded border border-[#242B3B]">
            <button
              type="button"
              onClick={() => handleToggleUnit('afr')}
              className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                unit === 'afr' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              AFR
            </button>
            <button
              type="button"
              onClick={() => handleToggleUnit('lambda')}
              className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                unit === 'lambda'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Lambda (λ)
            </button>
          </div>

          <select
            value={stoich}
            onChange={(e) => onUpdateStoichAfr(parseFloat(e.target.value))}
            className="h-7 px-2 bg-[#090B10] border border-[#2A3347] rounded text-[11px] font-mono-tabular text-slate-200 focus:outline-none focus:border-cyan-500"
            title="เลือกค่า Stoich ของเชื้อเพลิงสำหรับคำนวณ Lambda ↔ AFR"
          >
            {STOICH_PRESETS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setAutoCorrelateFuel((v) => !v)}
            className={`h-7 px-2.5 rounded text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer border transition-colors ${
              autoCorrelateFuel
                ? 'bg-emerald-600/20 border-emerald-500/60 text-emerald-300'
                : 'bg-[#171C28] border-[#2C364C] text-slate-400 hover:text-white'
            }`}
            title="เมื่อปรับค่า Target AFR/Lambda ระบบจะปรับสัดส่วนตารางน้ำมันหลักให้อัตโนมัติ"
          >
            {autoCorrelateFuel ? (
              <Link2 className="w-3.5 h-3.5" />
            ) : (
              <Link2Off className="w-3.5 h-3.5" />
            )}
            <span>
              {autoCorrelateFuel
                ? 'เชื่อมตารางน้ำมันอัตโนมัติ (ON)'
                : 'เชื่อมตารางน้ำมันอัตโนมัติ (OFF)'}
            </span>
          </button>

          {fuelTable && (
            <button
              type="button"
              onClick={() => onJumpToFuelTable(fuelTable.id)}
              className="h-7 px-2 rounded bg-[#171C28] hover:bg-[#232B3D] text-[11px] text-rose-300 flex items-center gap-1 cursor-pointer whitespace-nowrap"
              title="เปิดดูตารางจ่ายน้ำมันหลัก (Fuel Table) ที่เชื่อมโยงอยู่"
            >
              <Flame className="w-3 h-3" />
              <span>เปิดตารางน้ำมัน ({fuelTable.rows}×{fuelTable.cols})</span>
            </button>
          )}
        </div>

        {/* Right: RPM/TPS Quick Regions + Batch Edit + View Switcher */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Batch Math */}
          <div className="flex items-center gap-1">
            <input
              type="number"
              step={unit === 'afr' ? '0.1' : '0.01'}
              value={batchInput}
              onChange={(e) => setBatchInput(e.target.value)}
              className="w-16 h-7 px-1.5 bg-[#090B10] border border-[#2A3347] rounded text-xs font-mono-tabular text-white text-center focus:outline-none focus:border-cyan-500"
            />
            <button
              type="button"
              onClick={() => applyBatchToSelected('add')}
              className="h-7 px-2 rounded bg-[#171C28] hover:bg-[#232B3D] text-xs text-slate-200 flex items-center cursor-pointer"
              title="เพิ่มค่า AFR/λ (บางลง)"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" />
            </button>
            <button
              type="button"
              onClick={() => applyBatchToSelected('sub')}
              className="h-7 px-2 rounded bg-[#171C28] hover:bg-[#232B3D] text-xs text-slate-200 flex items-center cursor-pointer"
              title="ลดค่า AFR/λ (หนาขึ้น)"
            >
              <Minus className="w-3.5 h-3.5 text-rose-400" />
            </button>
            <button
              type="button"
              onClick={() => applyBatchToSelected('set')}
              className="h-7 px-2 rounded bg-emerald-600 hover:bg-emerald-500 text-[11px] font-semibold text-white flex items-center gap-1 cursor-pointer"
              title="ตั้งค่าเป้าหมายให้เซลล์/โซนที่เลือก"
            >
              <Equal className="w-3 h-3" />
              <span>ตั้งเป้า</span>
            </button>
            <button
              type="button"
              onClick={applyInterpolate}
              className="h-7 px-2 rounded bg-[#171C28] hover:bg-[#232B3D] text-[11px] text-cyan-300 flex items-center gap-1 cursor-pointer"
              title="ไล่ค่า Target AFR/λ แบบเส้นตรงระหว่างมุมที่เลือก"
            >
              <ArrowLeftRight className="w-3 h-3" />
              <span>ไล่ค่า</span>
            </button>
            <button
              type="button"
              onClick={revertSelectedToStock}
              className="h-7 px-2 rounded bg-[#171C28] hover:bg-[#232B3D] text-[11px] text-slate-300 flex items-center cursor-pointer"
              title="คืนค่า Target เดิมโรงงาน"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          {/* Single-Page View Switcher */}
          <div className="flex items-center gap-1 bg-[#090B10] p-0.5 rounded border border-[#242B3B]">
            <button
              type="button"
              onClick={() => setSubView('table')}
              className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer ${
                subView === 'table'
                  ? 'bg-cyan-600 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Grid3X3 className="w-3 h-3" />
              <span>ตาราง 2D</span>
            </button>
            <button
              type="button"
              onClick={() => setSubView('3d')}
              className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer ${
                subView === '3d'
                  ? 'bg-cyan-600 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Box className="w-3 h-3" />
              <span>หน้า 3D เต็มหน้า</span>
              <Maximize2 className="w-2.5 h-2.5 opacity-80" />
            </button>
            <button
              type="button"
              onClick={() => setSubView('2d')}
              className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer ${
                subView === '2d'
                  ? 'bg-cyan-600 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <LineChart className="w-3 h-3" />
              <span>กราฟเส้น</span>
            </button>
          </div>
        </div>
      </div>

      {/* RPM / TPS Region Selector & Curve Presets Bar */}
      <div className="bg-[#0D1018] border border-[#202737] rounded-lg px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 shrink-0 text-[11px]">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-slate-400 font-semibold flex items-center gap-1 mr-1">
            <Target className="w-3.5 h-3.5 text-emerald-400" />
            เลือกโซน RPM/TPS:
          </span>
          <button
            type="button"
            onClick={() => selectRegion('idle', 14.2)}
            className={`px-2 py-0.5 rounded border cursor-pointer ${
              activeRegionTag === 'idle'
                ? 'bg-cyan-600/25 border-cyan-500 text-cyan-200'
                : 'bg-[#141925] border-[#263044] text-slate-300 hover:text-white'
            }`}
          >
            เดินเบา/รอบต่ำ (14.2)
          </button>
          <button
            type="button"
            onClick={() => selectRegion('cruise', 14.5)}
            className={`px-2 py-0.5 rounded border cursor-pointer ${
              activeRegionTag === 'cruise'
                ? 'bg-cyan-600/25 border-cyan-500 text-cyan-200'
                : 'bg-[#141925] border-[#263044] text-slate-300 hover:text-white'
            }`}
          >
            ครูซประหยัด (14.5)
          </button>
          <button
            type="button"
            onClick={() => selectRegion('mid', 13.4)}
            className={`px-2 py-0.5 rounded border cursor-pointer ${
              activeRegionTag === 'mid'
                ? 'bg-cyan-600/25 border-cyan-500 text-cyan-200'
                : 'bg-[#141925] border-[#263044] text-slate-300 hover:text-white'
            }`}
          >
            กลางคันเร่ง (13.4)
          </button>
          <button
            type="button"
            onClick={() => selectRegion('wot', 12.6)}
            className={`px-2 py-0.5 rounded border cursor-pointer ${
              activeRegionTag === 'wot'
                ? 'bg-rose-600/25 border-rose-500 text-rose-200'
                : 'bg-[#141925] border-[#263044] text-slate-300 hover:text-white'
            }`}
          >
            WOT ซัดเต็ม (12.6)
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-slate-400">สูตรทั้งตาราง:</span>
          <button
            type="button"
            onClick={() => applyFullMapPreset('eco')}
            className="px-2 py-0.5 rounded bg-[#141925] hover:bg-[#1E2538] border border-[#263044] text-emerald-300 cursor-pointer"
          >
            Street Eco
          </button>
          <button
            type="button"
            onClick={() => applyFullMapPreset('sport')}
            className="px-2 py-0.5 rounded bg-[#141925] hover:bg-[#1E2538] border border-[#263044] text-amber-300 cursor-pointer"
          >
            Street Sport
          </button>
          <button
            type="button"
            onClick={() => applyFullMapPreset('race')}
            className="px-2 py-0.5 rounded bg-[#141925] hover:bg-[#1E2538] border border-[#263044] text-rose-300 cursor-pointer"
          >
            Race / ท่อ-แคม
          </button>
        </div>
      </div>

      {/* Main Content Area: Full Page 2D Table | 3D Surface | 2D Curve */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {subView === 'table' && (
          <div className="w-full bg-[#11151E] border border-[#242B3B] rounded-lg flex flex-col min-w-0 overflow-hidden">
            {/* Touch & Range Selection Helper Strip */}
            <div className="px-2.5 py-1.5 bg-[#0D1018] border-b border-[#1E2535] flex flex-wrap items-center justify-between gap-2 shrink-0 text-[11px]">
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="flex items-center gap-0.5 bg-[#090B10] p-0.5 rounded border border-[#242B3B]">
                  <button
                    type="button"
                    onClick={() => setTouchMode('select')}
                    className={`px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
                      touchMode === 'select'
                        ? 'bg-cyan-600 text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                    title="แตะลากบนตารางเพื่อครอบเลือกหลายเซลล์"
                  >
                    ลากครอบเซลล์
                  </button>
                  <button
                    type="button"
                    onClick={() => setTouchMode('scroll')}
                    className={`px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
                      touchMode === 'scroll'
                        ? 'bg-cyan-600 text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                    title="ใช้นิ้วเลื่อนดูตารางซ้าย-ขวา/ขึ้น-ลง"
                  >
                    เลื่อนดูตาราง
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setRangeTapMode((v) => !v)}
                  className={`px-2 py-0.5 rounded border font-medium transition-colors cursor-pointer ${
                    rangeTapMode
                      ? 'bg-amber-600/25 border-amber-500 text-amber-200'
                      : 'bg-[#171C28] hover:bg-[#22293B] border-[#2C364C] text-slate-300'
                  }`}
                  title="แตะเซลล์เริ่มต้น แล้วแตะอีกเซลล์เพื่อครอบสี่เหลี่ยมข้ามหน้าได้"
                >
                  {rangeTapMode ? 'แตะเซลล์ปลายทาง...' : 'แตะเลือกช่วง (2 จุด)'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const rCount = afrMatrix.length;
                    const cCount = afrMatrix[0]?.length || 0;
                    if (rCount > 0 && cCount > 0) {
                      setAnchorCell({ row: 0, col: 0 });
                      selectRange({ row: 0, col: 0 }, { row: rCount - 1, col: cCount - 1 });
                    }
                  }}
                  className="px-2 py-0.5 rounded bg-[#171C28] hover:bg-[#22293B] border border-[#2C364C] text-slate-300 font-medium cursor-pointer"
                  title="ครอบเลือกทุกเซลล์ในตาราง"
                >
                  ครอบทั้งหมด
                </button>

                {selectedCells.length === 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const cell = selectedCells[0];
                      const cur = displayMatrix[cell.row]?.[cell.col] ?? 13.5;
                      setEditingCell(cell);
                      setEditDraft(cur.toFixed(decimals));
                    }}
                    className="px-2 py-0.5 rounded bg-emerald-600/20 hover:bg-emerald-600/35 border border-emerald-500/50 text-emerald-300 font-semibold cursor-pointer"
                  >
                    แก้ค่าช่องนี้
                  </button>
                )}
              </div>

              <div className="text-[10.5px] font-mono-tabular text-slate-400">
                แตะหัวแถว/คอลัมน์เพื่อครอบทั้งแถว · ดับเบิลแตะเซลล์เพื่อพิมพ์ค่า · เลือก {selectedCells.length} เซลล์
              </div>
            </div>

            <div className="flex-1 overflow-auto p-2">
              <table
                className={`w-max min-w-full border-collapse font-mono-tabular select-none ${
                  isDenseGrid ? 'text-[10.5px]' : 'text-xs'
                }`}
              >
                <thead>
                  <tr>
                    <th
                      onClick={() => {
                        const rCount = afrMatrix.length;
                        const cCount = afrMatrix[0]?.length || 0;
                        if (rCount > 0 && cCount > 0) {
                          setAnchorCell({ row: 0, col: 0 });
                          selectRange({ row: 0, col: 0 }, { row: rCount - 1, col: cCount - 1 });
                        }
                      }}
                      title="คลิก/แตะเพื่อครอบทั้งตาราง"
                      className={`sticky top-0 left-0 z-20 bg-[#0D1018] hover:bg-[#171E2E] border border-[#242B3B] text-slate-400 text-left whitespace-nowrap cursor-pointer ${
                        isDenseGrid ? 'px-1.5 py-1 text-[9.5px]' : 'px-2 py-1.5 text-[10px]'
                      }`}
                    >
                      {yUnit} \ {xUnit}
                    </th>
                    {xLabels.map((xVal, c) => {
                      const isLiveCol = liveTrace?.col === c;
                      return (
                        <th
                          key={c}
                          onClick={() => {
                            const rCount = afrMatrix.length;
                            if (rCount > 0) {
                              setAnchorCell({ row: 0, col: c });
                              selectRange({ row: 0, col: c }, { row: rCount - 1, col: c });
                            }
                          }}
                          title={`แตะเพื่อครอบทั้งคอลัมน์ ${xVal}`}
                          className={`sticky top-0 z-10 border font-semibold text-center whitespace-nowrap cursor-pointer ${
                            isDenseGrid
                              ? 'px-1 py-1 text-[10px] min-w-[48px]'
                              : 'px-1.5 py-1.5 text-[11px]'
                          } ${
                            isLiveCol
                              ? 'bg-cyan-950/75 border-cyan-400/70 text-cyan-200'
                              : 'bg-[#141925] hover:bg-[#1C2333] border-[#242B3B] text-slate-200'
                          }`}
                        >
                          {xVal}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody
                  className={touchMode === 'select' ? 'touch-none' : 'touch-auto'}
                  onPointerMove={(e) => {
                    if (!isDragging || !anchorCell) return;
                    const hit = document
                      .elementFromPoint(e.clientX, e.clientY)
                      ?.closest('[data-cell-row]') as HTMLElement | null;
                    if (!hit) return;
                    const r = Number(hit.dataset.cellRow);
                    const c = Number(hit.dataset.cellCol);
                    if (!Number.isNaN(r) && !Number.isNaN(c)) {
                      selectRange(anchorCell, { row: r, col: c });
                    }
                  }}
                  onPointerUp={() => setIsDragging(false)}
                  onPointerCancel={() => setIsDragging(false)}
                >
                  {afrMatrix.map((rowVals, r) => {
                    const isLiveRow = liveTrace?.row === r;
                    return (
                      <tr key={r}>
                        <th
                          onClick={() => {
                            const cCount = rowVals.length;
                            if (cCount > 0) {
                              setAnchorCell({ row: r, col: 0 });
                              selectRange({ row: r, col: 0 }, { row: r, col: cCount - 1 });
                            }
                          }}
                          title={`แตะเพื่อครอบทั้งแถว ${yLabels[r]}`}
                          className={`sticky left-0 z-10 border font-semibold text-right whitespace-nowrap cursor-pointer ${
                            isDenseGrid
                              ? 'px-1.5 py-0.5 text-[10px] min-w-[42px]'
                              : 'px-2 py-1 text-[11px]'
                          } ${
                            isLiveRow
                              ? 'bg-cyan-950/75 border-cyan-400/70 text-cyan-200'
                              : 'bg-[#141925] hover:bg-[#1C2333] border-[#242B3B] text-slate-200'
                          }`}
                        >
                          {yLabels[r]}
                        </th>
                        {rowVals.map((afrVal, c) => {
                          const dispVal = displayMatrix[r]?.[c] ?? afrVal;
                          const lambdaVal = afrVal / stoich;
                          const corrFuel = getCorrelatedFuel(r, c);
                          const selected = isCellSelected(r, c);
                          const isLive = liveTrace?.row === r && liveTrace?.col === c;
                          const isEditing =
                            editingCell?.row === r && editingCell?.col === c;
                          const hist = historyStats.grid[r]?.[c] ?? null;

                          const bgColor = getCalibrationColor(
                            dispVal,
                            minVal,
                            maxVal,
                            'afr',
                            0.36
                          );

                          return (
                            <td
                              key={c}
                              data-cell-row={r}
                              data-cell-col={c}
                              onPointerDown={(e) => {
                                if ((e.target as HTMLElement).tagName === 'INPUT') return;
                                if (rangeTapMode && anchorCell) {
                                  selectRange(anchorCell, { row: r, col: c });
                                  return;
                                }
                                if (e.pointerType === 'mouse') {
                                  if (e.shiftKey && anchorCell) {
                                    selectRange(anchorCell, { row: r, col: c });
                                  } else {
                                    setAnchorCell({ row: r, col: c });
                                    setSelectedCells([{ row: r, col: c }]);
                                    setActiveRegionTag(null);
                                    setIsDragging(true);
                                  }
                                  return;
                                }
                                // Touch / Pen handling
                                const now = Date.now();
                                if (
                                  lastTapRef.current &&
                                  lastTapRef.current.row === r &&
                                  lastTapRef.current.col === c &&
                                  now - lastTapRef.current.time < 360
                                ) {
                                  lastTapRef.current = null;
                                  setEditingCell({ row: r, col: c });
                                  setEditDraft(dispVal.toFixed(decimals));
                                  return;
                                }
                                lastTapRef.current = { row: r, col: c, time: now };

                                if (touchMode === 'select') {
                                  setAnchorCell({ row: r, col: c });
                                  setSelectedCells([{ row: r, col: c }]);
                                  setActiveRegionTag(null);
                                  setIsDragging(true);
                                  try {
                                    e.currentTarget
                                      .closest('tbody')
                                      ?.setPointerCapture?.(e.pointerId);
                                  } catch {
                                    // Ignore capture failure
                                  }
                                }
                              }}
                              onClick={(e) => {
                                if (
                                  e.nativeEvent instanceof PointerEvent &&
                                  e.nativeEvent.pointerType === 'mouse'
                                ) {
                                  return;
                                }
                                if (touchMode === 'scroll' && !rangeTapMode) {
                                  setAnchorCell({ row: r, col: c });
                                  setSelectedCells([{ row: r, col: c }]);
                                  setActiveRegionTag(null);
                                }
                              }}
                              onDoubleClick={() => {
                                setEditingCell({ row: r, col: c });
                                setEditDraft(dispVal.toFixed(decimals));
                              }}
                              style={{ backgroundColor: bgColor }}
                              className={`border text-center cursor-cell relative transition-shadow ${
                                isDenseGrid ? 'px-1 py-0.5 min-w-[48px]' : 'px-1.5 py-1.5'
                              } ${
                                isLive
                                  ? 'border-cyan-300 ring-2 ring-inset ring-cyan-300 z-20 font-bold text-white'
                                  : selected
                                  ? 'border-white ring-1 ring-inset ring-white z-10 font-bold text-white'
                                  : 'border-[#222938] text-slate-100'
                              }`}
                            >
                              {hist && !isEditing && (
                                <span
                                  className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${
                                    hist.status === 'optimal'
                                      ? 'bg-emerald-400'
                                      : hist.status === 'lean'
                                      ? 'bg-amber-400'
                                      : 'bg-rose-400'
                                  }`}
                                  title={`AFR วิ่งจริงเฉลี่ย ${hist.avgAfr.toFixed(2)} (${hist.hits} pts)`}
                                />
                              )}
                              {isEditing ? (
                                <input
                                  type="number"
                                  step="any"
                                  autoFocus
                                  value={editDraft}
                                  onChange={(e) => setEditDraft(e.target.value)}
                                  onBlur={commitInlineEdit}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') commitInlineEdit();
                                    if (e.key === 'Escape') setEditingCell(null);
                                  }}
                                  className="w-14 bg-[#090B10] text-white text-center text-xs rounded border border-cyan-400 focus:outline-none"
                                />
                              ) : (
                                <div>
                                  <div className="leading-tight font-semibold">
                                    {dispVal.toFixed(decimals)}
                                  </div>
                                  <div className="text-[9px] text-slate-300/90 leading-tight">
                                    {unit === 'afr'
                                      ? `λ${lambdaVal.toFixed(2)}`
                                      : `${afrVal.toFixed(1)}`}
                                    {corrFuel && (
                                      <span
                                        className={`ml-1 ${
                                          Math.abs(corrFuel.pctDelta) > 0.2
                                            ? corrFuel.pctDelta > 0
                                              ? 'text-emerald-300'
                                              : 'text-rose-300'
                                            : 'text-slate-400'
                                        }`}
                                      >
                                        · {corrFuel.workVal.toFixed(corrFuel.decimalPlaces)}ms
                                      </span>
                                    )}
                                  </div>
                                  {hist && (
                                    <div
                                      className={`text-[8.5px] leading-tight ${
                                        hist.status === 'optimal'
                                          ? 'text-emerald-300'
                                          : hist.status === 'lean'
                                          ? 'text-amber-300'
                                          : 'text-rose-300'
                                      }`}
                                    >
                                      จริง {hist.avgAfr.toFixed(1)}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Selected Cell Correlation Inspector + Legend */}
            <div className="px-3 py-2 bg-[#0E121B] border-t border-[#242B3B] shrink-0 flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono-tabular">
              <div className="flex flex-wrap items-center gap-3 text-slate-200">
                <span className="flex items-center gap-1 text-emerald-300 font-semibold">
                  <Sparkles className="w-3.5 h-3.5" />
                  เซลล์ {xLabels[primarySelected.col]} {xUnit} / {yLabels[primarySelected.row]}{' '}
                  {yUnit}:
                </span>
                <span>
                  Target AFR <strong className="text-white">{primaryAfr.toFixed(2)}</strong> · λ{' '}
                  <strong className="text-cyan-300">{primaryLambda.toFixed(3)}</strong>
                </span>
                {primaryFuel && (
                  <span>
                    · Fuel Map:{' '}
                    <strong className="text-rose-300">
                      {primaryFuel.workVal.toFixed(primaryFuel.decimalPlaces)}{' '}
                      {primaryFuel.units}
                    </strong>{' '}
                    {Math.abs(primaryFuel.pctDelta) > 0.05 && (
                      <span
                        className={
                          primaryFuel.pctDelta > 0 ? 'text-emerald-300' : 'text-rose-400'
                        }
                      >
                        ({primaryFuel.pctDelta > 0 ? '+' : ''}
                        {primaryFuel.pctDelta.toFixed(1)}% vs Stock)
                      </span>
                    )}
                  </span>
                )}
                {telemetry && (
                  <span className="flex items-center gap-1 text-cyan-300">
                    <Activity className="w-3 h-3" />
                    Live AFR: {telemetry.afr.toFixed(1)} (λ{' '}
                    {(telemetry.afr / stoich).toFixed(2)})
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 min-w-[240px]">
                <span className="text-sky-300">
                  {minVal.toFixed(decimals)} ({scaleLabels.lowLabel})
                </span>
                <div
                  className="h-2 w-24 rounded-sm border border-[#2A3347]"
                  style={{ background: getSchemeGradientCss('afr') }}
                />
                <span className="text-rose-400">
                  {maxVal.toFixed(decimals)} ({scaleLabels.highLabel})
                </span>
              </div>
            </div>
          </div>
        )}

        {subView === '3d' && (
          <div className="w-full min-w-0 h-full">
            <Map3DSurface
              matrix={displayMatrix}
              xLabels={xLabels}
              yLabels={yLabels}
              xUnit={xUnit}
              yUnit={yUnit}
              zUnit={unit === 'afr' ? 'AFR' : 'λ'}
              decimalPlaces={decimals}
              colorScheme="afr"
              selectedCell={primarySelected}
              onSelectCell={(r, c) => {
                setAnchorCell({ row: r, col: c });
                setSelectedCells([{ row: r, col: c }]);
              }}
              liveTrace={liveTrace}
              visitedAfrCells={historyStats.visitedList}
              onSwitchToTable={() => setSubView('table')}
            />
          </div>
        )}

        {subView === '2d' && (
          <div className="w-full bg-[#11151E] border border-[#242B3B] rounded-lg p-4 flex flex-col overflow-hidden">
            <div className="mb-2">
              <h2 className="text-xs font-bold text-white">
                กราฟเส้น Target {unit === 'afr' ? 'AFR' : 'Lambda (λ)'} ตามรอบเครื่อง ({xUnit})
              </h2>
              <p className="text-[11px] text-slate-400">
                แสดงเป้าหมายส่วนผสมเชื้อเพลิงตั้งแต่รอบเดินเบาจนถึงเปิดคันเร่งสุด ({yUnit}) · Stoich ={' '}
                {stoich}
              </p>
            </div>
            <div className="flex-1 min-h-0">
              <svg viewBox="0 0 900 420" className="w-full h-full">
                {[0, 0.25, 0.5, 0.75, 1].map((t, idx) => {
                  const y = 20 + 358 * (1 - t);
                  const val = minVal + Math.max(1e-6, maxVal - minVal) * t;
                  return (
                    <g key={idx}>
                      <line x1={56} y1={y} x2={876} y2={y} stroke="#1E2636" strokeWidth="1" />
                      <text
                        x={48}
                        y={y + 4}
                        textAnchor="end"
                        fill="#94A3B8"
                        fontSize="11"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {val.toFixed(decimals)}
                      </text>
                    </g>
                  );
                })}
                {xLabels.map((xTick, c) => {
                  const xStep = xLabels.length > 14 ? Math.ceil(xLabels.length / 12) : 1;
                  const showTick = c % xStep === 0 || c === xLabels.length - 1;
                  const x = 56 + (xLabels.length > 1 ? (c / (xLabels.length - 1)) * 820 : 0);
                  return (
                    <g key={c}>
                      <line x1={x} y1={20} x2={x} y2={378} stroke="#192030" strokeWidth="1" />
                      {showTick && (
                        <text
                          x={x}
                          y={396}
                          textAnchor="middle"
                          fill="#94A3B8"
                          fontSize={xLabels.length > 14 ? '9.5' : '11'}
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {xTick}
                        </text>
                      )}
                    </g>
                  );
                })}
                {displayMatrix.map((rowVals, r) => {
                  const range = Math.max(1e-6, maxVal - minVal);
                  const tColor = displayMatrix.length > 1 ? r / (displayMatrix.length - 1) : 0.5;
                  const stroke = getCalibrationColor(
                    minVal + tColor * range,
                    minVal,
                    maxVal,
                    'afr'
                  );
                  const pts = rowVals
                    .map((v, c) => {
                      const x = 56 + (rowVals.length > 1 ? (c / (rowVals.length - 1)) * 820 : 0);
                      const y = 20 + 358 * (1 - (v - minVal) / range);
                      return `${x},${y}`;
                    })
                    .join(' ');
                  const lastY =
                    20 + 358 * (1 - ((rowVals[rowVals.length - 1] ?? minVal) - minVal) / range);
                  const yStep = displayMatrix.length > 12 ? Math.ceil(displayMatrix.length / 10) : 1;
                  const showYLabel = r % yStep === 0 || r === displayMatrix.length - 1;
                  return (
                    <g key={r}>
                      <polyline
                        fill="none"
                        stroke={stroke}
                        strokeWidth={displayMatrix.length > 14 ? '1.6' : '2.2'}
                        points={pts}
                      />
                      {showYLabel && (
                        <text
                          x={870}
                          y={lastY - 5}
                          textAnchor="end"
                          fill={stroke}
                          fontSize="10"
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {yLabels[r]} {yUnit}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
