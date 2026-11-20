import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowLeftRight,
  Box,
  ChevronDown,
  ChevronRight,
  Download,
  Equal,
  Flame,
  Folder,
  FolderOpen,
  Grid3X3,
  Layers,
  LineChart,
  Lock,
  Maximize2,
  Minus,
  PanelLeftClose,
  PanelLeftOpen,
  Percent,
  Plus,
  RotateCcw,
  Sliders,
  Sparkles,
  Table2,
  Target,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Undo2,
  Zap,
} from 'lucide-react';
import {
  getCalibrationColor,
  getSchemeGradientCss,
  getSchemeScaleLabels,
} from '../engine/colorScale';
import {
  NO_BIN_PLACEHOLDER,
  readConstantValue,
  readFlagState,
  readTableMatrix,
  resolveTableAxisLabels,
} from '../engine/xdfParser';
import {
  EcuProject,
  LiveTelemetryFrame,
  XdfConstant,
  XdfFlag,
  XdfTable,
} from '../types/ecu';
import { Map3DSurface, Visited3DAfrCell } from './Map3DSurface';
import { TargetAfrWorkbenchPanel } from './TargetAfrWorkbenchPanel';

interface TuningWorkbenchViewProps {
  project: EcuProject | null;
  telemetry: LiveTelemetryFrame | null;
  sessionTelemetryLog: LiveTelemetryFrame[];
  onClearSessionTelemetry: () => void;
  onUpdateTableCells: (
    tableId: string,
    updates: { row: number; col: number; value: number }[]
  ) => void;
  onUpdateTargetAfrMap: (
    updates: { row: number; col: number; targetAfr: number }[],
    correlateFuel: boolean
  ) => void;
  onUpdateStoichAfr: (stoichAfr: number) => void;
  onUpdateConstant: (constantId: string, value: number) => void;
  onToggleFlag: (flagId: string, enabled: boolean) => void;
  onUndo: () => void;
  canUndo: boolean;
  onExportBin: () => void;
  onGoToLibrary: () => void;
}

type TreeSelection =
  | { kind: 'table'; id: string }
  | { kind: 'target-afr' }
  | { kind: 'constants' }
  | { kind: 'flags' };

type ViewMode = 'table' | '3d' | '2d';

interface CellCoord {
  row: number;
  col: number;
}

const getAxisTelemetryValue = (
  axisUnits: string,
  frame: LiveTelemetryFrame
): number | null => {
  const u = axisUnits.toLowerCase();
  if (u.includes('rpm')) return frame.rpm;
  if (u.includes('kpa') || u.includes('map')) return frame.mapKpa;
  if (u.includes('tps') || u.includes('%')) return frame.tpsPercent;
  if (u.includes('eot') || u.includes('ect') || u.includes('°c')) return frame.ectTemp;
  if (u.includes('iat')) return frame.iatTemp;
  return null;
};

const isEngineSpeedOrLoadAxis = (axisUnits: string): boolean => {
  const u = axisUnits.toLowerCase();
  return (
    u.includes('rpm') ||
    u.includes('tps') ||
    u.includes('%') ||
    u.includes('kpa') ||
    u.includes('map')
  );
};

export const TuningWorkbenchView: React.FC<TuningWorkbenchViewProps> = ({
  project,
  telemetry,
  sessionTelemetryLog,
  onClearSessionTelemetry,
  onUpdateTableCells,
  onUpdateTargetAfrMap,
  onUpdateStoichAfr,
  onUpdateConstant,
  onToggleFlag,
  onUndo,
  canUndo,
  onExportBin,
  onGoToLibrary,
}) => {
  const getDefaultTableId = (proj: EcuProject | null) =>
    proj?.xdf.tables.find((t) => t.id === 'fuel-main-tps')?.id ||
    proj?.xdf.tables.find((t) => t.category === 'fuel')?.id ||
    proj?.xdf.tables[0]?.id ||
    '';

  const [selection, setSelection] = useState<TreeSelection>({
    kind: 'table',
    id: getDefaultTableId(project),
  });
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [showDiff, setShowDiff] = useState(false);
  const [showAfrOverlay, setShowAfrOverlay] = useState(true);
  const [visitHeatEmphasis, setVisitHeatEmphasis] = useState<'overlay' | 'pure-heat'>('overlay');
  const [showParamTree, setShowParamTree] = useState(true);
  const [treeFlagsOpen, setTreeFlagsOpen] = useState(true);
  const [treeTablesOpen, setTreeTablesOpen] = useState(true);
  const [treeScalarsOpen, setTreeScalarsOpen] = useState(false);
  const [paramMenuOpen, setParamMenuOpen] = useState(false);
  const paramMenuRef = useRef<HTMLDivElement>(null);
  const [selectedCells, setSelectedCells] = useState<CellCoord[]>([{ row: 0, col: 0 }]);
  const [anchorCell, setAnchorCell] = useState<CellCoord | null>({ row: 0, col: 0 });
  const [isDraggingCells, setIsDraggingCells] = useState(false);
  const [batchInput, setBatchInput] = useState('5');
  const [editingCell, setEditingCell] = useState<CellCoord | null>(null);
  const [editDraft, setEditDraft] = useState('');

  // Keep valid selection when switching project and default to Fuel 1
  useEffect(() => {
    if (!project) return;
    if (
      selection.kind === 'table' &&
      !project.xdf.tables.some((t) => t.id === selection.id)
    ) {
      setSelection({
        kind: 'table',
        id: getDefaultTableId(project),
      });
    }
  }, [project, selection]);

  const selectTreeItem = (next: TreeSelection) => {
    setSelection(next);
    setSelectedCells([{ row: 0, col: 0 }]);
    setAnchorCell({ row: 0, col: 0 });
    setEditingCell(null);
    setParamMenuOpen(false);
  };

  useEffect(() => {
    const onUp = () => setIsDraggingCells(false);
    const onDown = (e: MouseEvent) => {
      if (paramMenuRef.current && !paramMenuRef.current.contains(e.target as Node)) {
        setParamMenuOpen(false);
      }
    };
    window.addEventListener('mouseup', onUp);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('mousedown', onDown);
    };
  }, []);

  const activeTable: XdfTable | null = useMemo(() => {
    if (!project || selection.kind !== 'table') return null;
    return project.xdf.tables.find((t) => t.id === selection.id) || project.xdf.tables[0] || null;
  }, [project, selection]);

  const { workingMatrix, stockMatrix, xLabels, yLabels, minVal, maxVal, midVal } =
    useMemo(() => {
      if (!project || !activeTable) {
        return {
          workingMatrix: [] as number[][],
          stockMatrix: [] as number[][],
          xLabels: [] as number[],
          yLabels: [] as number[],
          minVal: 0,
          maxVal: 1,
          midVal: 0.5,
        };
      }
      const isPlaceholderNoBin = project.binFileName === NO_BIN_PLACEHOLDER;
      const wm = readTableMatrix(project.workingBytes, activeTable);
      const sm = readTableMatrix(project.originalBytes, activeTable);
      const xl = resolveTableAxisLabels(
        project.workingBytes,
        activeTable.xAxis,
        project.xdf.tables,
        isPlaceholderNoBin
      );
      const yl = resolveTableAxisLabels(
        project.workingBytes,
        activeTable.yAxis,
        project.xdf.tables,
        isPlaceholderNoBin
      );

      let min = Infinity;
      let max = -Infinity;
      for (const row of wm) {
        for (const v of row) {
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
      if (!Number.isFinite(min)) min = 0;
      if (!Number.isFinite(max) || max === min) max = min + 1;

      return {
        workingMatrix: wm,
        stockMatrix: sm,
        xLabels: xl,
        yLabels: yl,
        minVal: min,
        maxVal: max,
        midVal: (min + max) / 2,
      };
    }, [project, activeTable]);

  // Compute real-time live trace coordinates on active table using live RPM & TPS/MAP/Temp
  const liveTrace: CellCoord | null = useMemo(() => {
    if (!telemetry || !activeTable || xLabels.length === 0 || yLabels.length === 0) return null;
    const liveX = getAxisTelemetryValue(activeTable.xAxis.units, telemetry);
    const liveY = getAxisTelemetryValue(activeTable.yAxis.units, telemetry);
    if (liveX === null && liveY === null) return null;

    let bestCol = 0;
    if (liveX !== null && xLabels.length > 1) {
      let bestColDiff = Infinity;
      xLabels.forEach((axisVal, c) => {
        const diff = Math.abs(axisVal - liveX);
        if (diff < bestColDiff) {
          bestColDiff = diff;
          bestCol = c;
        }
      });
    }

    let bestRow = 0;
    if (liveY !== null && yLabels.length > 1) {
      let bestRowDiff = Infinity;
      yLabels.forEach((axisVal, r) => {
        const diff = Math.abs(axisVal - liveY);
        if (diff < bestRowDiff) {
          bestRowDiff = diff;
          bestRow = r;
        }
      });
    }
    return { row: bestRow, col: bestCol };
  }, [telemetry, activeTable, xLabels, yLabels]);

  const supportsAfrOverlay = Boolean(
    activeTable &&
      activeTable.rows > 1 &&
      activeTable.cols > 1 &&
      isEngineSpeedOrLoadAxis(activeTable.xAxis.units) &&
      isEngineSpeedOrLoadAxis(activeTable.yAxis.units)
  );

  // Aggregate historical AFR telemetry & visit counts onto active RPM/TPS load cells
  const afrHistoryOverlay = useMemo(() => {
    const rows = workingMatrix.length;
    const cols = workingMatrix[0]?.length || 0;
    type CellAgg = {
      hits: number;
      visitIntensity: number; // 0..1 normalized against maxHits
      sumAfr: number;
      avgAfr: number;
      minAfr: number;
      maxAfr: number;
      targetAfr: number;
      deltaAfr: number;
      status: 'rich' | 'optimal' | 'lean';
    };

    const grid: (CellAgg | null)[][] = Array.from({ length: rows }, () =>
      Array(cols).fill(null)
    );
    const visitedList: Visited3DAfrCell[] = [];

    if (
      !project ||
      !activeTable ||
      !supportsAfrOverlay ||
      rows === 0 ||
      cols === 0 ||
      sessionTelemetryLog.length === 0
    ) {
      return {
        grid,
        visitedList,
        visitedCount: 0,
        maxHits: 0,
        mostTunedCell: null as { row: number; col: number; hits: number } | null,
        totalSamples: supportsAfrOverlay ? sessionTelemetryLog.length : 0,
      };
    }

    const targetTable =
      project.xdf.tables.find((t) => t.id === 'target-afr-map') ||
      project.xdf.tables.find((t) => t.category === 'afr');
    const targetMatrix = targetTable ? readTableMatrix(project.workingBytes, targetTable) : null;
    const sameShapeTarget = Boolean(
      targetMatrix &&
        targetMatrix.length === rows &&
        (targetMatrix[0]?.length || 0) === cols
    );

    const findNearestIdx = (axisLabels: number[], val: number) => {
      let best = 0;
      let bestDiff = Infinity;
      for (let i = 0; i < axisLabels.length; i++) {
        const d = Math.abs(axisLabels[i] - val);
        if (d < bestDiff) {
          bestDiff = d;
          best = i;
        }
      }
      return best;
    };

    for (const frame of sessionTelemetryLog) {
      const xVal = getAxisTelemetryValue(activeTable.xAxis.units, frame) ?? frame.rpm;
      const yVal = getAxisTelemetryValue(activeTable.yAxis.units, frame) ?? frame.tpsPercent;
      const c = findNearestIdx(xLabels, xVal);
      const r = findNearestIdx(yLabels, yVal);

      if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
      let cell = grid[r][c];
      if (!cell) {
        const tAfr = sameShapeTarget ? targetMatrix?.[r]?.[c] ?? 13.5 : 13.5;
        cell = {
          hits: 0,
          visitIntensity: 0,
          sumAfr: 0,
          avgAfr: 0,
          minAfr: Infinity,
          maxAfr: -Infinity,
          targetAfr: tAfr,
          deltaAfr: 0,
          status: 'optimal',
        };
        grid[r][c] = cell;
      }
      cell.hits += 1;
      cell.sumAfr += frame.afr;
      if (frame.afr < cell.minAfr) cell.minAfr = frame.afr;
      if (frame.afr > cell.maxAfr) cell.maxAfr = frame.afr;
    }

    let maxHits = 0;
    let mostTunedCell: { row: number; col: number; hits: number } | null = null;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[r][c];
        if (cell && cell.hits > maxHits) {
          maxHits = cell.hits;
          mostTunedCell = { row: r, col: c, hits: cell.hits };
        }
      }
    }

    let visitedCount = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[r][c];
        if (!cell) continue;
        visitedCount += 1;
        // Perceptual sqrt intensity gradient for highlighting most-tuned operating regions
        cell.visitIntensity =
          maxHits > 0 ? Math.min(1, Math.sqrt(cell.hits / maxHits)) : 0;
        cell.avgAfr = cell.sumAfr / cell.hits;
        cell.deltaAfr = cell.avgAfr - cell.targetAfr;
        if (Math.abs(cell.deltaAfr) <= 0.4) cell.status = 'optimal';
        else if (cell.deltaAfr > 0.4) cell.status = 'lean';
        else cell.status = 'rich';

        visitedList.push({
          row: r,
          col: c,
          avgAfr: cell.avgAfr,
          hits: cell.hits,
          status: cell.status,
        });
      }
    }

    return {
      grid,
      visitedList,
      visitedCount,
      maxHits,
      mostTunedCell,
      totalSamples: sessionTelemetryLog.length,
    };
  }, [project, activeTable, supportsAfrOverlay, workingMatrix, xLabels, yLabels, sessionTelemetryLog]);

  if (!project) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <p className="text-sm text-slate-300 mb-3">ยังไม่ได้เลือกไฟล์จูนหรือรุ่นรถ Honda</p>
        <button
          type="button"
          onClick={onGoToLibrary}
          className="px-4 py-2 rounded bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white cursor-pointer"
        >
          ไปที่คลังรถ Honda & ไฟล์ BIN/XDF
        </button>
      </div>
    );
  }

  const isCellSelected = (r: number, c: number) =>
    selectedCells.some((cell) => cell.row === r && cell.col === c);

  const selectRange = (a: CellCoord, b: CellCoord) => {
    const rMin = Math.min(a.row, b.row);
    const rMax = Math.max(a.row, b.row);
    const cMin = Math.min(a.col, b.col);
    const cMax = Math.max(a.col, b.col);
    const list: CellCoord[] = [];
    for (let r = rMin; r <= rMax; r++) {
      for (let c = cMin; c <= cMax; c++) {
        list.push({ row: r, col: c });
      }
    }
    setSelectedCells(list);
  };

  const applyBatchMath = (mode: 'add' | 'sub' | 'pctUp' | 'pctDown' | 'set') => {
    if (!activeTable || selectedCells.length === 0) return;
    const param = parseFloat(batchInput);
    if (Number.isNaN(param)) return;

    const updates = selectedCells.map(({ row, col }) => {
      const cur = workingMatrix[row]?.[col] ?? 0;
      let next = cur;
      if (mode === 'add') next = cur + param;
      else if (mode === 'sub') next = cur - param;
      else if (mode === 'pctUp') next = cur * (1 + param / 100);
      else if (mode === 'pctDown') next = cur * (1 - param / 100);
      else if (mode === 'set') next = param;
      return {
        row,
        col,
        value: Number(next.toFixed(activeTable.decimalPlaces)),
      };
    });
    onUpdateTableCells(activeTable.id, updates);
  };

  const applyInterpolate = () => {
    if (!activeTable || selectedCells.length < 2) return;
    const rows = selectedCells.map((c) => c.row);
    const cols = selectedCells.map((c) => c.col);
    const rMin = Math.min(...rows);
    const rMax = Math.max(...rows);
    const cMin = Math.min(...cols);
    const cMax = Math.max(...cols);

    const v00 = workingMatrix[rMin]?.[cMin] ?? 0;
    const v01 = workingMatrix[rMin]?.[cMax] ?? 0;
    const v10 = workingMatrix[rMax]?.[cMin] ?? 0;
    const v11 = workingMatrix[rMax]?.[cMax] ?? 0;

    const updates: { row: number; col: number; value: number }[] = [];
    for (let r = rMin; r <= rMax; r++) {
      const ty = rMax === rMin ? 0 : (r - rMin) / (rMax - rMin);
      for (let c = cMin; c <= cMax; c++) {
        const tx = cMax === cMin ? 0 : (c - cMin) / (cMax - cMin);
        const top = v00 + (v01 - v00) * tx;
        const bot = v10 + (v11 - v10) * tx;
        const val = top + (bot - top) * ty;
        updates.push({
          row: r,
          col: c,
          value: Number(val.toFixed(activeTable.decimalPlaces)),
        });
      }
    }
    onUpdateTableCells(activeTable.id, updates);
  };

  const revertSelectedToStock = () => {
    if (!activeTable || selectedCells.length === 0) return;
    const updates = selectedCells.map(({ row, col }) => ({
      row,
      col,
      value: stockMatrix[row]?.[col] ?? 0,
    }));
    onUpdateTableCells(activeTable.id, updates);
  };

  const commitInlineEdit = () => {
    if (!activeTable || !editingCell) return;
    const val = parseFloat(editDraft);
    if (!Number.isNaN(val)) {
      onUpdateTableCells(activeTable.id, [
        { row: editingCell.row, col: editingCell.col, value: val },
      ]);
    }
    setEditingCell(null);
  };

  const scaleLabels = activeTable ? getSchemeScaleLabels(activeTable.colorScheme) : null;
  const primarySelected = selectedCells[0] || { row: 0, col: 0 };

  const currentSelectionLabel =
    selection.kind === 'target-afr'
      ? 'Target Lambda / AFR Map (เชื่อมตารางน้ำมัน)'
      : selection.kind === 'constants'
      ? 'ลิมิตรอบ / เดินเบา / หัวฉีด (Scalars)'
      : selection.kind === 'flags'
      ? 'สวิตช์เปิด-ปิดระบบ (Flags)'
      : activeTable?.title || 'เลือกตารางจูน';

  const isDenseGrid = Boolean(
    activeTable && (activeTable.cols > 14 || activeTable.rows > 14)
  );

  return (
    <div className="h-full w-full flex flex-col gap-2.5 p-3 overflow-hidden">
      {/* Unified Top-Corner Parameter Selector + Batch & View Toolbar */}
      <div className="bg-[#11151E] border border-[#242B3B] rounded-lg px-3 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0 relative z-30">
        {/* Top-Left Corner Parameter Tree Toggle & Quick Menu */}
        <div className="flex items-center gap-2 min-w-0" ref={paramMenuRef}>
          <button
            type="button"
            onClick={() => setShowParamTree((v) => !v)}
            className={`h-7 px-2 rounded border text-xs font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
              showParamTree
                ? 'bg-cyan-600/20 border-cyan-500/60 text-cyan-200'
                : 'bg-[#171C28] hover:bg-[#22293B] border-[#2C364C] text-slate-300'
            }`}
            title={showParamTree ? 'ซ่อนแถบหัวข้อ Parameter Tree' : 'แสดงแถบหัวข้อ Parameter Tree'}
          >
            {showParamTree ? (
              <PanelLeftClose className="w-3.5 h-3.5" />
            ) : (
              <PanelLeftOpen className="w-3.5 h-3.5" />
            )}
            <span>หัวข้อจูน</span>
          </button>

          <button
            type="button"
            onClick={() => setParamMenuOpen((v) => !v)}
            className="h-7 px-2.5 rounded bg-[#171C28] hover:bg-[#22293B] border border-[#2C364C] text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            aria-expanded={paramMenuOpen}
            title="เลือกตารางจูน ลิมิตรอบ หรือสวิตช์ Flag"
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>ตาราง & ค่าจูน ({project.xdf.tables.length})</span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                paramMenuOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          <button
            type="button"
            onClick={() => selectTreeItem({ kind: 'target-afr' })}
            className={`h-7 px-2.5 rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 border transition-colors ${
              selection.kind === 'target-afr'
                ? 'bg-emerald-600/25 border-emerald-500 text-emerald-200'
                : 'bg-[#171C28] hover:bg-[#22293B] border-[#2C364C] text-emerald-300'
            }`}
            title="เปิดหน้าปรับ Target Lambda / AFR ที่เชื่อมโยงกับตารางน้ำมันอัตโนมัติ"
          >
            <Target className="w-3.5 h-3.5" />
            <span>Target λ/AFR</span>
          </button>

          <h1 className="text-xs font-bold text-white truncate">
            {currentSelectionLabel}
          </h1>

          {selection.kind === 'table' && activeTable && (
            <span className="text-[11px] font-mono-tabular text-slate-400 shrink-0">
              ({activeTable.rows}×{activeTable.cols} · {activeTable.units}) · เลือก{' '}
              {selectedCells.length} เซลล์
            </span>
          )}

          {/* Hidden-in-Top-Corner Parameter Tree Popover */}
          {paramMenuOpen && (
            <div className="absolute top-11 left-0 w-80 max-h-[75vh] bg-[#11151E] border border-[#2C364C] rounded-lg shadow-2xl flex flex-col overflow-hidden z-50">
              <div className="p-2.5 border-b border-[#242B3B] shrink-0 bg-[#0D1018]">
                <div className="text-xs font-bold text-white truncate">{project.modelName}</div>
                <div className="text-[11px] font-mono-tabular text-slate-400 truncate">
                  {project.ecmPartNumber} · {project.xdfFileName}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-3">
                {/* Correlated Target Lambda / AFR Map */}
                <div>
                  <div className="px-2 py-1 text-[11px] font-semibold text-emerald-400">
                    เป้าหมายส่วนผสม (Target λ/AFR)
                  </div>
                  <button
                    type="button"
                    onClick={() => selectTreeItem({ kind: 'target-afr' })}
                    className={`w-full text-left px-2.5 py-2 rounded text-xs flex items-start gap-2 mt-1 transition-colors cursor-pointer ${
                      selection.kind === 'target-afr'
                        ? 'bg-emerald-950/60 text-white border border-emerald-500/60'
                        : 'text-slate-200 hover:bg-[#171C28] border border-transparent'
                    }`}
                  >
                    <Target className="w-3.5 h-3.5 mt-0.5 text-emerald-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-semibold truncate">
                        Target Lambda / AFR Map
                      </div>
                      <div className="text-[10px] text-slate-400">
                        กำหนดเป้า AFR/λ ตามโซน RPM/TPS · เชื่อมตารางน้ำมันอัตโนมัติ
                      </div>
                    </div>
                  </button>
                </div>

                {/* Maps / Tables Group */}
                <div>
                  <div className="px-2 py-1 text-[11px] font-semibold text-slate-400">
                    ตารางแผนที่ (2D / 3D Maps)
                  </div>
                  <div className="flex flex-col gap-1 mt-1">
                    {project.xdf.tables.map((tbl) => {
                      const isActive =
                        selection.kind === 'table' && selection.id === tbl.id;
                      const Icon =
                        tbl.colorScheme === 'ignition'
                          ? Zap
                          : tbl.colorScheme === 'afr'
                          ? Sparkles
                          : Flame;
                      const iconColor =
                        tbl.colorScheme === 'ignition'
                          ? 'text-amber-400'
                          : tbl.colorScheme === 'afr'
                          ? 'text-emerald-400'
                          : 'text-rose-400';

                      return (
                        <button
                          key={tbl.id}
                          type="button"
                          onClick={() => selectTreeItem({ kind: 'table', id: tbl.id })}
                          className={`w-full text-left px-2.5 py-2 rounded text-xs flex items-start gap-2 transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-[#1D2538] text-white border border-cyan-500/50'
                              : 'text-slate-300 hover:bg-[#171C28] border border-transparent'
                          }`}
                        >
                          <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${iconColor}`} />
                          <div className="min-w-0">
                            <div className="font-medium leading-snug truncate">{tbl.title}</div>
                            <div className="text-[10px] font-mono-tabular text-slate-400">
                              {tbl.rows}×{tbl.cols} · {tbl.units || 'val'} · 0x
                              {tbl.address.toString(16).toUpperCase()}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Scalars / Constants & Limiters */}
                <div>
                  <div className="px-2 py-1 text-[11px] font-semibold text-slate-400">
                    ลิมิตรอบ & ค่าคงที่ (Scalars)
                  </div>
                  <button
                    type="button"
                    onClick={() => selectTreeItem({ kind: 'constants' })}
                    className={`w-full text-left px-2.5 py-2 rounded text-xs flex items-center gap-2 mt-1 transition-colors cursor-pointer ${
                      selection.kind === 'constants'
                        ? 'bg-[#1D2538] text-white border border-cyan-500/50'
                        : 'text-slate-300 hover:bg-[#171C28] border border-transparent'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium truncate">ลิมิตรอบ / เดินเบา / หัวฉีด</div>
                      <div className="text-[10px] text-slate-400">
                        {project.xdf.constants.length} พารามิเตอร์
                      </div>
                    </div>
                  </button>
                </div>

                {/* Flags / Switches */}
                <div>
                  <div className="px-2 py-1 text-[11px] font-semibold text-slate-400">
                    สวิตช์เปิด-ปิดระบบ (Flags)
                  </div>
                  <button
                    type="button"
                    onClick={() => selectTreeItem({ kind: 'flags' })}
                    className={`w-full text-left px-2.5 py-2 rounded text-xs flex items-center gap-2 mt-1 transition-colors cursor-pointer ${
                      selection.kind === 'flags'
                        ? 'bg-[#1D2538] text-white border border-cyan-500/50'
                        : 'text-slate-300 hover:bg-[#171C28] border border-transparent'
                    }`}
                  >
                    <ToggleRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium truncate">O2 Loop / Speed Cut / HSTC</div>
                      <div className="text-[10px] text-slate-400">
                        {project.xdf.flags.length} สวิตช์
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* View Mode Switcher & Actions */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {selection.kind === 'table' && activeTable && (
            <>
              {/* Single-Page Full-Screen Mode Switcher: 2D Table | 3D Full Page | 2D Curve */}
              <div className="flex items-center gap-1 bg-[#090B10] p-0.5 rounded border border-[#242B3B] shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                    viewMode === 'table'
                      ? 'bg-cyan-600 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                  title="เปิดตาราง 2D เต็มหน้า"
                >
                  <Grid3X3 className="w-3 h-3" />
                  <span>ตาราง 2D</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('3d')}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                    viewMode === '3d'
                      ? 'bg-cyan-600 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                  title="เปิดหน้า 3D เต็มหน้า"
                >
                  <Box className="w-3 h-3" />
                  <span>หน้า 3D เต็มหน้า</span>
                  <Maximize2 className="w-2.5 h-2.5 opacity-80" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('2d')}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                    viewMode === '2d'
                      ? 'bg-cyan-600 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                  title="เปิดกราฟเส้น 2D เต็มหน้า"
                >
                  <LineChart className="w-3 h-3" />
                  <span>กราฟเส้น 2D</span>
                </button>
              </div>

              {/* Batch Math Controls */}
              <div className="flex items-center gap-1 shrink-0">
                <input
                  type="number"
                  step="any"
                  value={batchInput}
                  onChange={(e) => setBatchInput(e.target.value)}
                  className="w-14 h-7 px-1.5 bg-[#090B10] border border-[#2A3347] rounded text-xs font-mono-tabular text-white text-center focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => applyBatchMath('add')}
                  className="h-7 px-2 rounded bg-[#171C28] hover:bg-[#232B3D] text-xs text-slate-200 flex items-center cursor-pointer"
                  title="บวกเพิ่มค่าที่กรอก"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                </button>
                <button
                  type="button"
                  onClick={() => applyBatchMath('sub')}
                  className="h-7 px-2 rounded bg-[#171C28] hover:bg-[#232B3D] text-xs text-slate-200 flex items-center cursor-pointer"
                  title="ลดลงตามค่าที่กรอก"
                >
                  <Minus className="w-3.5 h-3.5 text-rose-400" />
                </button>
                <button
                  type="button"
                  onClick={() => applyBatchMath('pctUp')}
                  className="h-7 px-2 rounded bg-[#171C28] hover:bg-[#232B3D] text-[11px] font-mono-tabular text-emerald-300 flex items-center gap-0.5 cursor-pointer"
                  title="เพิ่มเป็น %"
                >
                  +<Percent className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => applyBatchMath('pctDown')}
                  className="h-7 px-2 rounded bg-[#171C28] hover:bg-[#232B3D] text-[11px] font-mono-tabular text-rose-300 flex items-center gap-0.5 cursor-pointer"
                  title="ลดลงเป็น %"
                >
                  -<Percent className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => applyBatchMath('set')}
                  className="h-7 px-2 rounded bg-[#171C28] hover:bg-[#232B3D] text-xs text-amber-300 flex items-center cursor-pointer"
                  title="กำหนดค่าเท่ากับที่กรอก"
                >
                  <Equal className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={applyInterpolate}
                  className="h-7 px-2 rounded bg-[#171C28] hover:bg-[#232B3D] text-[11px] text-cyan-300 flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  title="เฉลี่ยค่าไล่ระดับแบบเส้นตรงระหว่างมุมที่เลือก"
                >
                  <ArrowLeftRight className="w-3 h-3" />
                  <span>ไล่ค่า</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowDiff((v) => !v)}
                  className={`h-7 px-2 rounded text-[11px] font-medium cursor-pointer whitespace-nowrap ${
                    showDiff
                      ? 'bg-amber-600/30 border border-amber-500/60 text-amber-200'
                      : 'bg-[#171C28] hover:bg-[#232B3D] text-slate-300'
                  }`}
                  title="แสดงส่วนต่างเทียบกับไฟล์เดิมจากโรงงาน"
                >
                  เทียบเดิม
                </button>
                <button
                  type="button"
                  onClick={() => setShowAfrOverlay((v) => !v)}
                  className={`h-7 px-2 rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                    showAfrOverlay
                      ? 'bg-emerald-600/25 border border-emerald-500/60 text-emerald-200'
                      : 'bg-[#171C28] hover:bg-[#232B3D] text-slate-300'
                  }`}
                  title="ซ้อนข้อมูลประวัติ AFR จากการวิ่งจริงลงบนเซลล์ RPM/TPS"
                >
                  <Activity className="w-3 h-3" />
                  <span>
                    AFR ประวัติวิ่ง
                    {afrHistoryOverlay.visitedCount > 0
                      ? ` (${afrHistoryOverlay.visitedCount})`
                      : ''}
                  </span>
                </button>
                {afrHistoryOverlay.totalSamples > 0 && (
                  <button
                    type="button"
                    onClick={onClearSessionTelemetry}
                    className="h-7 px-1.5 rounded bg-[#171C28] hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 cursor-pointer"
                    title="ล้างประวัติการวิ่ง AFR รอบล่าสุด"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={revertSelectedToStock}
                  className="h-7 px-2 rounded bg-[#171C28] hover:bg-[#232B3D] text-[11px] text-slate-300 flex items-center gap-1 cursor-pointer"
                  title="คืนค่าเซลล์ที่เลือกกลับเป็นค่าเดิม"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              </div>
            </>
          )}

          {/* Global Undo & Export BIN always reachable in top-right */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              className="h-7 px-2 rounded bg-[#171C28] hover:bg-[#22293B] disabled:opacity-40 text-[11px] text-slate-200 flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
              title="ย้อนกลับ 1 ขั้น"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>
            <button
              type="button"
              onClick={onExportBin}
              className="h-7 px-2.5 rounded bg-rose-600 hover:bg-rose-500 text-[11px] font-semibold text-white flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>ส่งออก .BIN</span>
            </button>
          </div>
        </div>
      </div>

      {/* Full-Width Horizontal Tuning Content with TunerPro Parameter Tree */}
      <main className="flex-1 min-h-0 flex flex-row gap-2.5 overflow-hidden">
        {showParamTree && (
          <aside className="w-64 shrink-0 bg-[#11151E] border border-[#242B3B] rounded-lg flex flex-col overflow-hidden">
            <div className="px-2.5 py-2 border-b border-[#242B3B] bg-[#0D1018] flex items-center justify-between gap-2 shrink-0">
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-white tracking-wide truncate flex items-center gap-1.5">
                  <span>Parameter Tree</span>
                  {project.xdf.isReadOnly && (
                    <span
                      className="inline-flex items-center gap-0.5 text-[9.5px] font-medium text-amber-300"
                      title={project.xdf.lockNote || 'XDF ล็อกแก้ไขโครงสร้าง (อ่านและจูน .BIN ได้ปกติ)'}
                    >
                      <Lock className="w-2.5 h-2.5" />
                      Read-Only
                    </span>
                  )}
                </div>
                <div className="text-[10px] font-mono-tabular text-cyan-400 truncate">
                  {project.ecmPartNumber} · {project.xdfFileName}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowParamTree(false)}
                className="p-1 rounded hover:bg-[#1A202E] text-slate-400 hover:text-white cursor-pointer shrink-0"
                title="พับเก็บ Parameter Tree"
              >
                <PanelLeftClose className="w-3.5 h-3.5" />
              </button>
            </div>
            {project.xdf.isReadOnly && (
              <div className="px-2.5 py-1.5 bg-amber-950/35 border-b border-amber-500/30 text-[10px] text-amber-200 leading-snug">
                ไฟล์ XDF ติดล็อกแก้ไขโครงสร้าง — สามารถเปิดดูตารางและจูนไฟล์ .BIN ได้ปกติ
              </div>
            )}
            {project.binFileName === NO_BIN_PLACEHOLDER && (
              <div className="px-2.5 py-1.5 bg-cyan-950/35 border-b border-cyan-500/30 text-[10px] text-cyan-200 leading-snug flex items-center justify-between gap-1.5">
                <span>ยังไม่ได้นำเข้าไฟล์ .BIN</span>
                <button
                  type="button"
                  onClick={onGoToLibrary}
                  className="px-1.5 py-0.5 rounded bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-100 font-semibold shrink-0 cursor-pointer"
                >
                  ใส่ .BIN
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-1.5 text-[11px] select-none space-y-1">
              {/* Flags Folder */}
              <div>
                <button
                  type="button"
                  onClick={() => setTreeFlagsOpen((v) => !v)}
                  className="w-full flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-[#171C28] text-slate-200 font-semibold cursor-pointer text-left"
                >
                  {treeFlagsOpen ? (
                    <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                  )}
                  {treeFlagsOpen ? (
                    <FolderOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  ) : (
                    <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  )}
                  <span>Flags ({project.xdf.flags.length})</span>
                </button>
                {treeFlagsOpen && (
                  <div className="ml-4 pl-1.5 border-l border-[#242B3B] mt-0.5 space-y-0.5">
                    <button
                      type="button"
                      onClick={() => selectTreeItem({ kind: 'flags' })}
                      className={`w-full text-left px-2 py-1 rounded flex items-center gap-1.5 cursor-pointer transition-colors ${
                        selection.kind === 'flags'
                          ? 'bg-[#1D2538] text-white border border-cyan-500/50'
                          : 'text-slate-300 hover:bg-[#171C28] border border-transparent'
                      }`}
                    >
                      <ToggleRight className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span className="truncate">สวิตช์เปิด-ปิดระบบ (Flags)</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Tables Folder (matching TunerPro XDF tree) */}
              <div>
                <button
                  type="button"
                  onClick={() => setTreeTablesOpen((v) => !v)}
                  className="w-full flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-[#171C28] text-slate-200 font-semibold cursor-pointer text-left"
                >
                  {treeTablesOpen ? (
                    <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                  )}
                  {treeTablesOpen ? (
                    <FolderOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  ) : (
                    <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  )}
                  <span>Tables ({project.xdf.tables.length})</span>
                </button>
                {treeTablesOpen && (
                  <div className="ml-3 pl-1.5 border-l border-[#242B3B] mt-0.5 space-y-0.5">
                    {project.xdf.tables.map((tbl) => {
                      const isActive =
                        selection.kind === 'table' && selection.id === tbl.id;
                      const iconColor =
                        tbl.colorScheme === 'ignition'
                          ? 'text-amber-400'
                          : tbl.colorScheme === 'afr'
                          ? 'text-emerald-400'
                          : 'text-sky-400';

                      return (
                        <button
                          key={tbl.id}
                          type="button"
                          onClick={() => selectTreeItem({ kind: 'table', id: tbl.id })}
                          className={`w-full text-left px-1.5 py-1 rounded flex items-center gap-1.5 cursor-pointer transition-colors ${
                            isActive
                              ? 'bg-[#1D2538] text-white border border-cyan-500/60 font-semibold'
                              : 'text-slate-300 hover:bg-[#171C28] border border-transparent'
                          }`}
                          title={`${tbl.title} (${tbl.rows}×${tbl.cols} · 0x${tbl.address.toString(16).toUpperCase()})`}
                        >
                          <Table2 className={`w-3.5 h-3.5 shrink-0 ${iconColor}`} />
                          <span className="truncate flex-1">{tbl.title}</span>
                          <span className="text-[9.5px] font-mono-tabular text-slate-500 shrink-0">
                            {tbl.rows}×{tbl.cols}
                          </span>
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => selectTreeItem({ kind: 'target-afr' })}
                      className={`w-full text-left px-1.5 py-1 rounded flex items-center gap-1.5 cursor-pointer transition-colors ${
                        selection.kind === 'target-afr'
                          ? 'bg-emerald-950/70 text-emerald-200 border border-emerald-500/60 font-semibold'
                          : 'text-emerald-300/90 hover:bg-[#171C28] border border-transparent'
                      }`}
                    >
                      <Target className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate flex-1">Target λ/AFR Map</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Scalars / Constants Folder */}
              <div>
                <button
                  type="button"
                  onClick={() => setTreeScalarsOpen((v) => !v)}
                  className="w-full flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-[#171C28] text-slate-200 font-semibold cursor-pointer text-left"
                >
                  {treeScalarsOpen ? (
                    <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                  )}
                  {treeScalarsOpen ? (
                    <FolderOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  ) : (
                    <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  )}
                  <span>Scalars ({project.xdf.constants.length})</span>
                </button>
                {treeScalarsOpen && (
                  <div className="ml-4 pl-1.5 border-l border-[#242B3B] mt-0.5 space-y-0.5">
                    <button
                      type="button"
                      onClick={() => selectTreeItem({ kind: 'constants' })}
                      className={`w-full text-left px-2 py-1 rounded flex items-center gap-1.5 cursor-pointer transition-colors ${
                        selection.kind === 'constants'
                          ? 'bg-[#1D2538] text-white border border-cyan-500/50'
                          : 'text-slate-300 hover:bg-[#171C28] border border-transparent'
                      }`}
                    >
                      <Sliders className="w-3 h-3 text-cyan-400 shrink-0" />
                      <span className="truncate">ลิมิตรอบ / เดินเบา / หัวฉีด</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </aside>
        )}

        {selection.kind === 'target-afr' && (
          <TargetAfrWorkbenchPanel
            project={project}
            telemetry={telemetry}
            sessionTelemetryLog={sessionTelemetryLog}
            onUpdateTargetAfrMap={onUpdateTargetAfrMap}
            onUpdateStoichAfr={onUpdateStoichAfr}
            onJumpToFuelTable={(fuelTableId) =>
              selectTreeItem({ kind: 'table', id: fuelTableId })
            }
          />
        )}

        {selection.kind === 'table' && activeTable && (
          <>
            {/* Main Horizontal Content Area: One Full-Page View at a Time */}
            <div className="flex-1 min-w-0 min-h-0 flex overflow-hidden">
              {/* Full-Page 2D Table Heatmap */}
              {viewMode === 'table' && (
                <div className="w-full bg-[#11151E] border border-[#242B3B] rounded-lg flex flex-col min-w-0 overflow-hidden">
                  <div className="flex-1 overflow-auto p-2">
                    <table
                      className={`w-max min-w-full border-collapse font-mono-tabular select-none ${
                        isDenseGrid ? 'text-[10.5px]' : 'text-xs'
                      }`}
                    >
                      <thead>
                        <tr>
                          <th
                            className={`sticky top-0 left-0 z-20 bg-[#0D1018] border border-[#242B3B] text-slate-300 text-left whitespace-nowrap ${
                              isDenseGrid ? 'px-1.5 py-1 text-[9.5px]' : 'px-2 py-1.5 text-[10px]'
                            }`}
                            title={`แนวตั้ง (Y): ${activeTable.yAxis.units} · แนวนอน (X): ${activeTable.xAxis.units}`}
                          >
                            {activeTable.yAxis.units} \ {activeTable.xAxis.units}
                          </th>
                          {xLabels.map((xVal, c) => {
                            const isLiveCol = liveTrace?.col === c;
                            const formattedX =
                              activeTable.xAxis.decimalPlaces > 0 && Number.isFinite(xVal)
                                ? xVal.toFixed(activeTable.xAxis.decimalPlaces)
                                : xVal;
                            return (
                              <th
                                key={c}
                                className={`sticky top-0 z-10 border font-semibold text-center transition-colors whitespace-nowrap ${
                                  isDenseGrid
                                    ? 'px-1 py-1 text-[10px] min-w-[42px]'
                                    : 'px-1.5 py-1.5 text-[11px]'
                                } ${
                                  isLiveCol
                                    ? 'bg-cyan-950/75 border-cyan-400/70 text-cyan-200'
                                    : 'bg-[#141925] border-[#242B3B] text-slate-200'
                                }`}
                              >
                                {formattedX}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {workingMatrix.map((rowVals, r) => {
                          const isLiveRow = liveTrace?.row === r;
                          const rawYVal = yLabels[r];
                          const formattedY =
                            rawYVal !== undefined &&
                            activeTable.yAxis.decimalPlaces > 0 &&
                            Number.isFinite(rawYVal)
                              ? rawYVal.toFixed(activeTable.yAxis.decimalPlaces)
                              : rawYVal;
                          return (
                          <tr key={r}>
                            <th
                              className={`sticky left-0 z-10 border font-semibold text-right transition-colors whitespace-nowrap ${
                                isDenseGrid
                                  ? 'px-1.5 py-[3px] text-[10px] min-w-[42px]'
                                  : 'px-2 py-1 text-[11px]'
                              } ${
                                isLiveRow
                                  ? 'bg-cyan-950/75 border-cyan-400/70 text-cyan-200'
                                  : 'bg-[#141925] border-[#242B3B] text-slate-200'
                              }`}
                            >
                              {formattedY}
                            </th>
                            {rowVals.map((val, c) => {
                              const stockVal = stockMatrix[r]?.[c] ?? val;
                              const diff = val - stockVal;
                              const selected = isCellSelected(r, c);
                              const isLive =
                                liveTrace?.row === r && liveTrace?.col === c;
                              const isEditing =
                                editingCell?.row === r && editingCell?.col === c;
                              const afrHist = showAfrOverlay
                                ? afrHistoryOverlay.grid[r]?.[c] ?? null
                                : null;
                              const hasVisitedAfr = afrHist !== null && afrHist.hits > 0;
                              const visitIntensity = afrHist?.visitIntensity ?? 0;
                              const dimUnvisited =
                                showAfrOverlay &&
                                afrHistoryOverlay.totalSamples > 0 &&
                                !hasVisitedAfr &&
                                !selected &&
                                !isLive;

                              // Compute visit-count heatmap gradient color for most-tuned operating regions
                              const visitHeatColor =
                                visitIntensity > 0
                                  ? visitIntensity < 0.45
                                    ? `rgba(6, 182, 212, ${(0.12 + visitIntensity * 0.35).toFixed(2)})`
                                    : visitIntensity < 0.78
                                    ? `rgba(245, 158, 11, ${(0.18 + visitIntensity * 0.32).toFixed(2)})`
                                    : `rgba(225, 29, 72, ${(0.24 + visitIntensity * 0.36).toFixed(2)})`
                                  : 'transparent';

                              const baseMapColor = getCalibrationColor(
                                val,
                                minVal,
                                maxVal,
                                activeTable.colorScheme,
                                dimUnvisited ? 0.12 : 0.36
                              );

                              const bgColor =
                                showAfrOverlay &&
                                visitHeatEmphasis === 'pure-heat' &&
                                afrHistoryOverlay.totalSamples > 0
                                  ? hasVisitedAfr
                                    ? visitHeatColor
                                    : 'rgba(15, 23, 42, 0.25)'
                                  : baseMapColor;

                              const afrBadgeColor =
                                afrHist?.status === 'optimal'
                                  ? 'text-emerald-300'
                                  : afrHist?.status === 'lean'
                                  ? 'text-amber-300'
                                  : 'text-rose-300';

                              const afrDotBg =
                                afrHist?.status === 'optimal'
                                  ? 'bg-emerald-400'
                                  : afrHist?.status === 'lean'
                                  ? 'bg-amber-400'
                                  : 'bg-rose-400';

                              return (
                                <td
                                  key={c}
                                  onMouseDown={(e) => {
                                    if (e.shiftKey && anchorCell) {
                                      selectRange(anchorCell, { row: r, col: c });
                                    } else {
                                      setAnchorCell({ row: r, col: c });
                                      setSelectedCells([{ row: r, col: c }]);
                                      setIsDraggingCells(true);
                                    }
                                  }}
                                  onMouseEnter={() => {
                                    if (isDraggingCells && anchorCell) {
                                      selectRange(anchorCell, { row: r, col: c });
                                    }
                                  }}
                                  onDoubleClick={() => {
                                    setEditingCell({ row: r, col: c });
                                    setEditDraft(val.toFixed(activeTable.decimalPlaces));
                                  }}
                                  style={{ backgroundColor: bgColor }}
                                  className={`border text-center cursor-cell relative overflow-hidden transition-shadow ${
                                    isDenseGrid ? 'px-1 py-[3px] min-w-[42px]' : 'px-1.5 py-1.5'
                                  } ${
                                    isLive
                                      ? 'border-cyan-300 ring-2 ring-inset ring-cyan-300 shadow-[inset_0_0_14px_rgba(6,182,212,0.55)] z-20 font-bold text-white'
                                      : selected
                                      ? 'border-white ring-1 ring-inset ring-white z-10 font-bold text-white'
                                      : hasVisitedAfr
                                      ? 'border-cyan-500/60 text-white'
                                      : dimUnvisited
                                      ? 'border-[#1C2230] text-slate-500'
                                      : 'border-[#222938] text-slate-100'
                                  }`}
                                >
                                  {/* Subtle Visit-Count Heatmap Overlay Layer */}
                                  {showAfrOverlay &&
                                    visitHeatEmphasis === 'overlay' &&
                                    hasVisitedAfr && (
                                      <div
                                        aria-hidden="true"
                                        className="absolute inset-0 pointer-events-none"
                                        style={{
                                          background: `radial-gradient(circle at center, ${visitHeatColor} 0%, transparent 92%)`,
                                        }}
                                      />
                                    )}

                                  {/* Subtle Visit Intensity Bottom Micro-Bar */}
                                  {showAfrOverlay && hasVisitedAfr && !isEditing && (
                                    <div
                                      aria-hidden="true"
                                      className="absolute bottom-0 left-0 h-[2px] pointer-events-none"
                                      style={{
                                        width: `${Math.max(12, Math.round(visitIntensity * 100))}%`,
                                        backgroundColor:
                                          visitIntensity >= 0.78
                                            ? '#F43F5E'
                                            : visitIntensity >= 0.45
                                            ? '#F59E0B'
                                            : '#06B6D4',
                                      }}
                                    />
                                  )}

                                  {isLive && !isEditing && (
                                    <span
                                      className="absolute top-0.5 left-0.5 w-1.5 h-1.5 rounded-full bg-cyan-300 animate-ping"
                                      title="ตำแหน่งทำงานจริงปัจจุบัน (Live RPM/TPS)"
                                    />
                                  )}

                                  {hasVisitedAfr && !isEditing && (
                                    <span
                                      className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${afrDotBg}`}
                                      title={`AFR เฉลี่ย ${afrHist.avgAfr.toFixed(2)} (${afrHist.hits} visits)`}
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
                                      className="w-12 bg-[#090B10] text-white text-center text-xs rounded border border-cyan-400 focus:outline-none relative z-10"
                                    />
                                  ) : (
                                    <div className="relative z-10">
                                      <span>
                                        {showDiff
                                          ? `${diff >= 0 ? '+' : ''}${diff.toFixed(
                                              activeTable.decimalPlaces
                                            )}`
                                          : val.toFixed(activeTable.decimalPlaces)}
                                      </span>
                                      {!showDiff && Math.abs(diff) > 0.001 && (
                                        <span
                                          className={`block text-[9px] leading-none ${
                                            diff > 0 ? 'text-emerald-300' : 'text-rose-300'
                                          }`}
                                        >
                                          {diff > 0 ? '+' : ''}
                                          {diff.toFixed(activeTable.decimalPlaces)}
                                        </span>
                                      )}
                                      {hasVisitedAfr && (
                                        <span
                                          className={`block text-[9px] leading-tight mt-0.5 font-semibold ${afrBadgeColor}`}
                                        >
                                          {afrHist.avgAfr.toFixed(1)} ({afrHist.hits})
                                        </span>
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

                  {/* Session AFR & Visit-Density Heatmap Inspector Bar */}
                  {showAfrOverlay && (
                    <div className="px-3 py-1.5 bg-[#0B0E16] border-t border-[#1E2535] flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono-tabular shrink-0">
                      {afrHistoryOverlay.totalSamples === 0 ? (
                        <span className="text-slate-400">
                          Heatmap ความถี่ & AFR: ยังไม่มีข้อมูล Log — เชื่อมต่อสาย K-Line หรือเปิด Bench Test เพื่อดูเซลล์ที่เครื่องยนต์ทำงานบ่อยที่สุดแบบ Real-Time
                        </span>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-center gap-2.5 text-slate-300">
                            <span className="text-cyan-300 font-semibold">
                              ใช้งาน {afrHistoryOverlay.visitedCount}/
                              {activeTable.rows * activeTable.cols} เซลล์ ({afrHistoryOverlay.totalSamples} pts)
                            </span>
                            {afrHistoryOverlay.mostTunedCell && (
                              <span className="text-amber-300">
                                · ใช้งานสูงสุด {xLabels[afrHistoryOverlay.mostTunedCell.col]}{' '}
                                {activeTable.xAxis.units} /{' '}
                                {yLabels[afrHistoryOverlay.mostTunedCell.row]}{' '}
                                {activeTable.yAxis.units} ({afrHistoryOverlay.maxHits} visits)
                              </span>
                            )}
                            <div className="flex items-center gap-1 bg-[#11151E] border border-[#242B3B] rounded p-0.5">
                              <button
                                type="button"
                                onClick={() => setVisitHeatEmphasis('overlay')}
                                className={`px-1.5 py-0.5 rounded text-[10px] cursor-pointer ${
                                  visitHeatEmphasis === 'overlay'
                                    ? 'bg-cyan-600/30 text-cyan-200'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                ซ้อนบนตาราง
                              </button>
                              <button
                                type="button"
                                onClick={() => setVisitHeatEmphasis('pure-heat')}
                                className={`px-1.5 py-0.5 rounded text-[10px] cursor-pointer ${
                                  visitHeatEmphasis === 'pure-heat'
                                    ? 'bg-rose-600/35 text-rose-200'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                เน้นความถี่ล้วน
                              </button>
                            </div>
                          </div>
                          {(() => {
                            const sel =
                              afrHistoryOverlay.grid[primarySelected.row]?.[
                                primarySelected.col
                              ];
                            if (!sel) {
                              return (
                                <span className="text-slate-500">
                                  เซลล์ {xLabels[primarySelected.col]} {activeTable.xAxis.units} /{' '}
                                  {yLabels[primarySelected.row]} {activeTable.yAxis.units}: ยังไม่เคยวิ่งผ่าน
                                </span>
                              );
                            }
                            return (
                              <span className="text-slate-200">
                                AFR เฉลี่ย{' '}
                                <strong className="text-white">{sel.avgAfr.toFixed(2)}</strong>{' '}
                                (เป้า {sel.targetAfr.toFixed(1)}, {sel.hits} visits ·{' '}
                                {Math.round(sel.visitIntensity * 100)}% density)
                              </span>
                            );
                          })()}
                        </>
                      )}
                    </div>
                  )}

                  {/* Color Scale Legend Bar at Bottom of Table */}
                  {scaleLabels && (
                    <div className="px-3 py-2 bg-[#0E121B] border-t border-[#242B3B] shrink-0">
                      <div className="flex items-center justify-between text-[11px] font-mono-tabular mb-1">
                        <span className="text-sky-300">
                          ต่ำสุด: {minVal.toFixed(activeTable.decimalPlaces)} {activeTable.units} ·{' '}
                          {scaleLabels.lowLabel}
                        </span>
                        <span className="text-emerald-300">
                          กลาง: {midVal.toFixed(activeTable.decimalPlaces)} {activeTable.units}
                        </span>
                        <span className="text-rose-400">
                          สูงสุด: {maxVal.toFixed(activeTable.decimalPlaces)} {activeTable.units} ·{' '}
                          {scaleLabels.highLabel}
                        </span>
                      </div>
                      <div
                        className="h-2 w-full rounded-sm border border-[#2A3347]"
                        style={{
                          background: getSchemeGradientCss(activeTable.colorScheme),
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Full-Page 3D Surface Map */}
              {viewMode === '3d' && (
                <div className="w-full min-w-0 h-full">
                  <Map3DSurface
                    matrix={workingMatrix}
                    xLabels={xLabels}
                    yLabels={yLabels}
                    xUnit={activeTable.xAxis.units}
                    yUnit={activeTable.yAxis.units}
                    zUnit={activeTable.units}
                    decimalPlaces={activeTable.decimalPlaces}
                    colorScheme={activeTable.colorScheme}
                    selectedCell={primarySelected}
                    onSelectCell={(r, c) => {
                      setAnchorCell({ row: r, col: c });
                      setSelectedCells([{ row: r, col: c }]);
                    }}
                    liveTrace={liveTrace}
                    visitedAfrCells={showAfrOverlay ? afrHistoryOverlay.visitedList : undefined}
                    onSwitchToTable={() => setViewMode('table')}
                  />
                </div>
              )}

              {/* 2D Curve Slice View */}
              {viewMode === '2d' && (
                <div className="w-full bg-[#11151E] border border-[#242B3B] rounded-lg p-4 flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h2 className="text-xs font-bold text-white">
                        กราฟเส้น 2D (เทียบแต่ละระดับ {activeTable.yAxis.units})
                      </h2>
                      <p className="text-[11px] text-slate-400">
                        แสดงเส้นโค้งตามรอบเครื่อง ({activeTable.xAxis.units}) ตั้งแต่คันเร่งน้อยสุดถึงเปิดสุด 100%
                      </p>
                    </div>
                  </div>
                  <div className="flex-1 min-h-0">
                    <Curve2DSvg
                      matrix={workingMatrix}
                      xLabels={xLabels}
                      yLabels={yLabels}
                      yUnit={activeTable.yAxis.units}
                      zUnit={activeTable.units}
                      minVal={minVal}
                      maxVal={maxVal}
                      colorScheme={activeTable.colorScheme}
                    />
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Constants & Limiters Editor */}
        {selection.kind === 'constants' && (
          <div className="flex-1 bg-[#11151E] border border-[#242B3B] rounded-lg p-4 overflow-y-auto">
            <div className="mb-4">
              <h1 className="text-sm font-bold text-white">
                ลิมิตรอบเครื่อง รอบเดินเบา และค่าคงที่ (ECU Constants)
              </h1>
              <p className="text-[11px] text-slate-400">
                ปรับค่าคงที่โดยตรงลงหน่วยความจำ .bin ตามตำแหน่ง Offset ในไฟล์ .xdf
              </p>
            </div>

            {project.xdf.constants.length === 0 ? (
              <div className="p-6 rounded-lg bg-[#141925] border border-[#242B3B] text-xs text-slate-400">
                ไฟล์ XDF นี้ไม่มีรายการค่าคงที่ (XDFCONSTANT / Scalars)
              </div>
            ) : (
            <div className="grid grid-cols-3 gap-3">
              {project.xdf.constants.map((c: XdfConstant) => {
                const curVal = readConstantValue(project.workingBytes, c);
                const stockVal = readConstantValue(project.originalBytes, c);
                const changed = Math.abs(curVal - stockVal) > 0.001;

                return (
                  <div
                    key={c.id}
                    className="p-3.5 rounded-lg bg-[#141925] border border-[#242B3B] flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="text-xs font-bold text-white">{c.title}</h2>
                        <span className="text-[10px] font-mono-tabular text-slate-400 shrink-0">
                          0x{c.address.toString(16).toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                        {c.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-[#1E2535]">
                      <input
                        type="number"
                        step={c.decimalPlaces > 0 ? 0.1 : 50}
                        value={curVal}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (!Number.isNaN(v)) onUpdateConstant(c.id, v);
                        }}
                        className="w-28 h-8 px-2 bg-[#090B10] border border-[#2E384D] rounded text-sm font-mono-tabular font-bold text-white focus:outline-none focus:border-cyan-500"
                      />
                      <span className="text-xs font-mono-tabular text-slate-300">
                        {c.units}
                      </span>
                      {changed && (
                        <button
                          type="button"
                          onClick={() => onUpdateConstant(c.id, stockVal)}
                          className="ml-auto text-[11px] text-amber-400 hover:text-amber-300 cursor-pointer"
                        >
                          เดิม: {stockVal}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </div>
        )}

        {/* Flags / Switches Editor */}
        {selection.kind === 'flags' && (
          <div className="flex-1 bg-[#11151E] border border-[#242B3B] rounded-lg p-4 overflow-y-auto">
            <div className="mb-4">
              <h1 className="text-sm font-bold text-white">
                สวิตช์เปิด-ปิดฟังก์ชันกล่อง ECU (Flags & Bitmasks)
              </h1>
              <p className="text-[11px] text-slate-400">
                ปรับเปลี่ยนบิตควบคุมระบบ เช่น ปิด O2 Sensor, ปลดล็อกความเร็ว, เปิด-ปิด HSTC / Decel Cut
              </p>
            </div>

            {project.xdf.flags.length === 0 ? (
              <div className="p-6 rounded-lg bg-[#141925] border border-[#242B3B] text-xs text-slate-400">
                ไฟล์ XDF นี้ไม่มีรายการสวิตช์ / แฟลก (XDFFLAG)
              </div>
            ) : (
            <div className="grid grid-cols-2 gap-3">
              {project.xdf.flags.map((flag: XdfFlag) => {
                const enabled = readFlagState(project.workingBytes, flag);
                return (
                  <div
                    key={flag.id}
                    className="p-3.5 rounded-lg bg-[#141925] border border-[#242B3B] flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white">{flag.title}</div>
                      <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                        {flag.description}
                      </p>
                      <div className="text-[10px] font-mono-tabular text-slate-500 mt-1">
                        Address 0x{flag.address.toString(16).toUpperCase()} · Bit {flag.bitIndex}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onToggleFlag(flag.id, !enabled)}
                      className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors ${
                        enabled
                          ? 'bg-emerald-600/20 border border-emerald-500/50 text-emerald-300'
                          : 'bg-[#1A202E] border border-[#2F394E] text-slate-400'
                      }`}
                    >
                      {enabled ? (
                        <>
                          <ToggleRight className="w-4 h-4" />
                          <span>เปิด (ON)</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="w-4 h-4" />
                          <span>ปิด (OFF)</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

interface Curve2DSvgProps {
  matrix: number[][];
  xLabels: number[];
  yLabels: number[];
  yUnit: string;
  zUnit: string;
  minVal: number;
  maxVal: number;
  colorScheme: XdfTable['colorScheme'];
}

const Curve2DSvg: React.FC<Curve2DSvgProps> = ({
  matrix,
  xLabels,
  yLabels,
  yUnit,
  zUnit,
  minVal,
  maxVal,
  colorScheme,
}) => {
  const width = 900;
  const height = 420;
  const padL = 56;
  const padR = 24;
  const padT = 20;
  const padB = 42;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const range = Math.max(1e-6, maxVal - minVal);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
      {/* Horizontal grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((t, idx) => {
        const y = padT + plotH * (1 - t);
        const val = minVal + range * t;
        return (
          <g key={idx}>
            <line
              x1={padL}
              y1={y}
              x2={width - padR}
              y2={y}
              stroke="#1E2636"
              strokeWidth="1"
            />
            <text
              x={padL - 8}
              y={y + 4}
              textAnchor="end"
              fill="#94A3B8"
              fontSize="11"
              fontFamily="JetBrains Mono, monospace"
            >
              {val.toFixed(1)}
            </text>
          </g>
        );
      })}

      {/* X axis ticks */}
      {xLabels.map((xTick, c) => {
        const xStep = xLabels.length > 14 ? Math.ceil(xLabels.length / 12) : 1;
        const showLabel = c % xStep === 0 || c === xLabels.length - 1;
        const x =
          padL + (xLabels.length > 1 ? (c / (xLabels.length - 1)) * plotW : 0);
        return (
          <g key={c}>
            <line
              x1={x}
              y1={padT}
              x2={x}
              y2={height - padB}
              stroke="#192030"
              strokeWidth="1"
            />
            {showLabel && (
              <text
                x={x}
                y={height - padB + 18}
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

      {/* Lines per Y row */}
      {matrix.map((rowVals, r) => {
        const tColor = matrix.length > 1 ? r / (matrix.length - 1) : 0.5;
        const stroke = getCalibrationColor(
          minVal + tColor * range,
          minVal,
          maxVal,
          colorScheme
        );
        const points = rowVals
          .map((v, c) => {
            const x =
              padL + (rowVals.length > 1 ? (c / (rowVals.length - 1)) * plotW : 0);
            const y = padT + plotH * (1 - (v - minVal) / range);
            return `${x},${y}`;
          })
          .join(' ');
        const lastX = padL + plotW;
        const lastY =
          padT + plotH * (1 - ((rowVals[rowVals.length - 1] ?? minVal) - minVal) / range);
        const yStep = matrix.length > 12 ? Math.ceil(matrix.length / 10) : 1;
        const showRowLabel = r % yStep === 0 || r === matrix.length - 1;

        return (
          <g key={r}>
            <polyline
              fill="none"
              stroke={stroke}
              strokeWidth={matrix.length > 14 ? '1.6' : '2.2'}
              points={points}
            />
            {showRowLabel && (
              <text
                x={lastX - 6}
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

      <text
        x={padL}
        y={padT - 5}
        fill="#CBD5E1"
        fontSize="11"
        fontFamily="JetBrains Mono, monospace"
      >
        {zUnit}
      </text>
    </svg>
  );
};
