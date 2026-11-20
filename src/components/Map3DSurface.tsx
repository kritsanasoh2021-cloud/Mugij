import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Grid3X3, Maximize2, Minimize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import {
  getCalibrationColor,
  getSchemeGradientCss,
  getSchemeScaleLabels,
} from '../engine/colorScale';
import { MapColorScheme } from '../types/ecu';

export interface Visited3DAfrCell {
  row: number;
  col: number;
  avgAfr: number;
  hits: number;
  status: 'rich' | 'optimal' | 'lean';
}

interface Map3DSurfaceProps {
  matrix: number[][];
  xLabels: number[];
  yLabels: number[];
  xUnit: string;
  yUnit: string;
  zUnit: string;
  decimalPlaces: number;
  colorScheme: MapColorScheme;
  selectedCell: { row: number; col: number } | null;
  onSelectCell: (row: number, col: number) => void;
  liveTrace?: { row: number; col: number } | null;
  visitedAfrCells?: Visited3DAfrCell[];
  onSwitchToTable?: () => void;
}

interface ProjectedVertex {
  sx: number;
  sy: number;
  depth: number;
  row: number;
  col: number;
  value: number;
}

export const Map3DSurface: React.FC<Map3DSurfaceProps> = ({
  matrix,
  xLabels,
  yLabels,
  xUnit,
  yUnit,
  zUnit,
  decimalPlaces,
  colorScheme,
  selectedCell,
  onSelectCell,
  liveTrace,
  visitedAfrCells,
  onSwitchToTable,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [yaw, setYaw] = useState(-0.68); // horizontal angle (rad)
  const [pitch, setPitch] = useState(0.56); // vertical tilt (rad)
  const [zoom, setZoom] = useState(1.0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hoverVertex, setHoverVertex] = useState<{ row: number; col: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 560, height: 360 });

  useEffect(() => {
    if (!isExpanded) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsExpanded(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isExpanded]);

  const draggingRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    startYaw: number;
    startPitch: number;
    moved: boolean;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    startYaw: 0,
    startPitch: 0,
    moved: false,
  });

  const projectedRef = useRef<ProjectedVertex[]>([]);

  const { minVal, maxVal, midVal } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const row of matrix) {
      for (const v of row) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    if (!Number.isFinite(min)) min = 0;
    if (!Number.isFinite(max) || max === min) max = min + 1;
    return {
      minVal: min,
      maxVal: max,
      midVal: (min + max) / 2,
    };
  }, [matrix]);

  // ResizeObserver so 3D canvas always fits horizontal landscape viewport crisply
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(240, Math.floor(entry.contentRect.width));
        const h = Math.max(180, Math.floor(entry.contentRect.height));
        setCanvasSize({ width: w, height: h });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const projectPoint = useCallback(
    (nx: number, ny: number, nz: number, width: number, height: number) => {
      // Center around origin: nx, ny in [-1, 1], nz in [0, 1] -> [-0.5, 0.5]
      const x = nx;
      const y = ny;
      const z = nz - 0.45;

      // Rotate around Z (yaw)
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const x1 = x * cosY - y * sinY;
      const y1 = x * sinY + y * cosY;

      // Tilt around X (pitch)
      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);
      const y2 = y1 * cosP - z * sinP;
      const z2 = y1 * sinP + z * cosP;

      const scale = Math.min(width, height) * 0.34 * zoom;
      const perspective = 3.6 / (3.6 + y2 * 0.65);

      return {
        sx: width * 0.5 + x1 * scale * perspective,
        sy: height * 0.56 - z2 * scale * perspective,
        depth: y2,
      };
    },
    [yaw, pitch, zoom]
  );

  // Draw 3D surface mesh
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const { width, height } = canvasSize;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Background
    ctx.fillStyle = '#090C12';
    ctx.fillRect(0, 0, width, height);

    const rows = matrix.length;
    const cols = matrix[0]?.length || 0;
    if (rows === 0 || cols === 0) return;

    const range = Math.max(1e-6, maxVal - minVal);

    // Draw base reference floor grid (z = 0)
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
    ctx.lineWidth = 1;
    for (let r = 0; r < rows; r++) {
      const ny = rows > 1 ? (r / (rows - 1)) * 2 - 1 : 0;
      const p0 = projectPoint(-1, ny, 0, width, height);
      const p1 = projectPoint(1, ny, 0, width, height);
      ctx.beginPath();
      ctx.moveTo(p0.sx, p0.sy);
      ctx.lineTo(p1.sx, p1.sy);
      ctx.stroke();
    }
    for (let c = 0; c < cols; c++) {
      const nx = cols > 1 ? (c / (cols - 1)) * 2 - 1 : 0;
      const p0 = projectPoint(nx, -1, 0, width, height);
      const p1 = projectPoint(nx, 1, 0, width, height);
      ctx.beginPath();
      ctx.moveTo(p0.sx, p0.sy);
      ctx.lineTo(p1.sx, p1.sy);
      ctx.stroke();
    }

    // Project all surface vertices
    const grid: ProjectedVertex[][] = [];
    const flatList: ProjectedVertex[] = [];

    for (let r = 0; r < rows; r++) {
      const rowVerts: ProjectedVertex[] = [];
      const ny = rows > 1 ? (r / (rows - 1)) * 2 - 1 : 0;
      for (let c = 0; c < cols; c++) {
        const nx = cols > 1 ? (c / (cols - 1)) * 2 - 1 : 0;
        const val = matrix[r][c];
        const nz = ((val - minVal) / range) * 1.1;
        const proj = projectPoint(nx, ny, nz, width, height);
        const v: ProjectedVertex = {
          sx: proj.sx,
          sy: proj.sy,
          depth: proj.depth,
          row: r,
          col: c,
          value: val,
        };
        rowVerts.push(v);
        flatList.push(v);
      }
      grid.push(rowVerts);
    }
    projectedRef.current = flatList;

    // Build quads and sort back-to-front (Painter's algorithm)
    interface Quad {
      p00: ProjectedVertex;
      p10: ProjectedVertex;
      p11: ProjectedVertex;
      p01: ProjectedVertex;
      avgDepth: number;
      avgVal: number;
    }

    const quads: Quad[] = [];
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const p00 = grid[r][c];
        const p10 = grid[r][c + 1];
        const p11 = grid[r + 1][c + 1];
        const p01 = grid[r + 1][c];
        const avgDepth = (p00.depth + p10.depth + p11.depth + p01.depth) / 4;
        const avgVal = (p00.value + p10.value + p11.value + p01.value) / 4;
        quads.push({ p00, p10, p11, p01, avgDepth, avgVal });
      }
    }

    // Larger depth = further away in our projection, draw furthest first
    quads.sort((a, b) => b.avgDepth - a.avgDepth);

    for (const q of quads) {
      ctx.beginPath();
      ctx.moveTo(q.p00.sx, q.p00.sy);
      ctx.lineTo(q.p10.sx, q.p10.sy);
      ctx.lineTo(q.p11.sx, q.p11.sy);
      ctx.lineTo(q.p01.sx, q.p01.sy);
      ctx.closePath();

      ctx.fillStyle = getCalibrationColor(q.avgVal, minVal, maxVal, colorScheme, 0.84);
      ctx.fill();

      ctx.strokeStyle = 'rgba(15, 23, 42, 0.72)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Draw axis labels on base edges
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#94A3B8';
    ctx.textAlign = 'center';
    for (let c = 0; c < cols; c += Math.max(1, Math.floor(cols / 5))) {
      const nx = cols > 1 ? (c / (cols - 1)) * 2 - 1 : 0;
      const pt = projectPoint(nx, -1.16, 0, width, height);
      ctx.fillText(`${xLabels[c] ?? c}`, pt.sx, pt.sy);
    }
    for (let r = 0; r < rows; r += Math.max(1, Math.floor(rows / 4))) {
      const ny = rows > 1 ? (r / (rows - 1)) * 2 - 1 : 0;
      const pt = projectPoint(-1.18, ny, 0, width, height);
      ctx.fillText(`${yLabels[r] ?? r}`, pt.sx, pt.sy);
    }

    // Axis Title Labels
    const xTitlePt = projectPoint(0, -1.36, 0, width, height);
    ctx.fillStyle = '#CBD5E1';
    ctx.fillText(xUnit, xTitlePt.sx, xTitlePt.sy);

    const yTitlePt = projectPoint(-1.38, 0, 0, width, height);
    ctx.fillText(yUnit, yTitlePt.sx, yTitlePt.sy);

    // Selected cell highlight pin
    if (
      selectedCell &&
      grid[selectedCell.row] &&
      grid[selectedCell.row][selectedCell.col]
    ) {
      const sv = grid[selectedCell.row][selectedCell.col];
      const basePt = projectPoint(
        cols > 1 ? (sv.col / (cols - 1)) * 2 - 1 : 0,
        rows > 1 ? (sv.row / (rows - 1)) * 2 - 1 : 0,
        0,
        width,
        height
      );

      ctx.beginPath();
      ctx.setLineDash([3, 3]);
      ctx.moveTo(basePt.sx, basePt.sy);
      ctx.lineTo(sv.sx, sv.sy);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.arc(sv.sx, sv.sy, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#E11D48';
      ctx.stroke();
    }

    // Hovered vertex preview
    if (hoverVertex && grid[hoverVertex.row]?.[hoverVertex.col]) {
      const hv = grid[hoverVertex.row][hoverVertex.col];
      ctx.beginPath();
      ctx.arc(hv.sx, hv.sy, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#F59E0B';
      ctx.fill();
    }

    // Historical AFR operated cells overlay markers on 3D surface
    if (visitedAfrCells && visitedAfrCells.length > 0) {
      for (const vc of visitedAfrCells) {
        const vert = grid[vc.row]?.[vc.col];
        if (!vert) continue;
        const color =
          vc.status === 'optimal'
            ? '#10B981'
            : vc.status === 'lean'
            ? '#F59E0B'
            : '#E11D48';

        ctx.beginPath();
        ctx.arc(vert.sx, vert.sy, 4.2, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = '#090C12';
        ctx.stroke();
      }
    }

    // Real-time ECU trace dot on 3D surface
    if (liveTrace && grid[liveTrace.row]?.[liveTrace.col]) {
      const lv = grid[liveTrace.row][liveTrace.col];
      ctx.beginPath();
      ctx.arc(lv.sx, lv.sy, 7, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(6, 182, 212, 0.35)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(lv.sx, lv.sy, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#06B6D4';
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }, [
    canvasSize,
    matrix,
    minVal,
    maxVal,
    colorScheme,
    projectPoint,
    xLabels,
    yLabels,
    xUnit,
    yUnit,
    selectedCell,
    hoverVertex,
    liveTrace,
    visitedAfrCells,
  ]);

  const findNearestVertex = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;

    let best: ProjectedVertex | null = null;
    let bestDist = 18 * 18;
    for (const v of projectedRef.current) {
      const dx = v.sx - px;
      const dy = v.sy - py;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDist) {
        bestDist = d2;
        best = v;
      }
    }
    return best;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    draggingRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startYaw: yaw,
      startPitch: pitch,
      moved: false,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (draggingRef.current.active) {
      const dx = e.clientX - draggingRef.current.startX;
      const dy = e.clientY - draggingRef.current.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        draggingRef.current.moved = true;
      }
      setYaw(draggingRef.current.startYaw + dx * 0.008);
      setPitch(Math.max(0.12, Math.min(1.42, draggingRef.current.startPitch + dy * 0.007)));
      return;
    }
    const nearest = findNearestVertex(e.clientX, e.clientY);
    setHoverVertex(nearest ? { row: nearest.row, col: nearest.col } : null);
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (draggingRef.current.active && !draggingRef.current.moved) {
      const nearest = findNearestVertex(e.clientX, e.clientY);
      if (nearest) {
        onSelectCell(nearest.row, nearest.col);
      }
    }
    draggingRef.current.active = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.65, Math.min(2.1, z - e.deltaY * 0.001)));
  };

  const scaleLabels = getSchemeScaleLabels(colorScheme);
  const activeInspect = hoverVertex || selectedCell;
  const activeInspectVal =
    activeInspect && matrix[activeInspect.row]?.[activeInspect.col] !== undefined
      ? matrix[activeInspect.row][activeInspect.col]
      : null;

  return (
    <div
      className={
        isExpanded
          ? 'fixed inset-0 z-50 flex flex-col bg-[#090C12]'
          : 'flex flex-col h-full bg-[#090C12] border border-[#242B3B] rounded-lg overflow-hidden'
      }
    >
      {/* Compact 3D Toolbar */}
      <div className="h-9 px-3 bg-[#11151E] border-b border-[#242B3B] flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 text-xs min-w-0">
          <span className="font-semibold text-slate-100 whitespace-nowrap">แผนที่พื้นผิว 3D Surface</span>
          {activeInspect && activeInspectVal !== null && (
            <span className="font-mono-tabular text-[11px] text-cyan-300 truncate">
              · {xLabels[activeInspect.col]} {xUnit} / {yLabels[activeInspect.row]} {yUnit} ={' '}
              <strong className="text-white">
                {activeInspectVal.toFixed(decimalPlaces)} {zUnit}
              </strong>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              setYaw(-0.68);
              setPitch(0.56);
              setZoom(1.0);
            }}
            className="px-2 py-1 text-[11px] rounded bg-[#171C28] hover:bg-[#222A3C] text-slate-300 cursor-pointer whitespace-nowrap"
            title="มุมมอง 3 มิติมาตรฐาน"
          >
            ISO
          </button>
          <button
            type="button"
            onClick={() => {
              setYaw(0);
              setPitch(0.22);
              setZoom(1.05);
            }}
            className="px-2 py-1 text-[11px] rounded bg-[#171C28] hover:bg-[#222A3C] text-slate-300 cursor-pointer whitespace-nowrap"
            title="มุมมองด้านข้าง RPM"
          >
            RPM
          </button>
          <button
            type="button"
            onClick={() => {
              setYaw(-Math.PI / 2);
              setPitch(0.22);
              setZoom(1.05);
            }}
            className="px-2 py-1 text-[11px] rounded bg-[#171C28] hover:bg-[#222A3C] text-slate-300 cursor-pointer whitespace-nowrap"
            title="มุมมองด้านข้าง TPS"
          >
            TPS
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2.1, z + 0.15))}
            className="p-1 rounded bg-[#171C28] hover:bg-[#222A3C] text-slate-300 cursor-pointer"
            title="ซูมเข้า"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.65, z - 0.15))}
            className="p-1 rounded bg-[#171C28] hover:bg-[#222A3C] text-slate-300 cursor-pointer"
            title="ซูมออก"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setYaw(-0.68);
              setPitch(0.56);
              setZoom(1.0);
            }}
            className="p-1 rounded bg-[#171C28] hover:bg-[#222A3C] text-slate-300 cursor-pointer"
            title="รีเซ็ตมุมกล้อง"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            className={`px-2 py-1 text-[11px] rounded flex items-center gap-1 cursor-pointer whitespace-nowrap ${
              isExpanded
                ? 'bg-cyan-600 text-white'
                : 'bg-[#171C28] hover:bg-[#222A3C] text-cyan-300'
            }`}
            title={isExpanded ? 'ย่อกลับขนาดปกติ (Esc)' : 'ขยาย 3D เต็มหน้าจอ'}
          >
            {isExpanded ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
            <span>{isExpanded ? 'ย่อลง' : 'เต็มจอ'}</span>
          </button>
          {onSwitchToTable && !isExpanded && (
            <button
              type="button"
              onClick={onSwitchToTable}
              className="px-2 py-1 text-[11px] rounded bg-[#171C28] hover:bg-[#222A3C] text-slate-200 flex items-center gap-1 cursor-pointer whitespace-nowrap"
              title="สลับกลับไปหน้าตาราง 2D"
            >
              <Grid3X3 className="w-3.5 h-3.5 text-slate-300" />
              <span>ตาราง 2D</span>
            </button>
          )}
        </div>
      </div>

      {/* 3D Canvas Viewport */}
      <div ref={containerRef} className="flex-1 min-h-0 relative select-none">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            draggingRef.current.active = false;
            setHoverVertex(null);
          }}
          onWheel={handleWheel}
          className="w-full h-full block cursor-grab active:cursor-grabbing"
        />
        <div className="absolute bottom-2 left-3 text-[10px] text-slate-400 pointer-events-none">
          ลากเมาส์เพื่อหมุน 3D · เลื่อนลูกกลิ้งเพื่อซูม · คลิกจุดตัดเพื่อเลือกเซลล์ในตาราง
        </div>
      </div>

      {/* Explicit Color Scale Intensity Legend */}
      <div className="px-3 py-2 bg-[#11151E] border-t border-[#242B3B] shrink-0">
        <div className="flex items-center justify-between text-[11px] font-mono-tabular mb-1">
          <span className="text-sky-300">
            {minVal.toFixed(decimalPlaces)} {zUnit} · {scaleLabels.lowLabel}
          </span>
          <span className="text-emerald-300">
            {midVal.toFixed(decimalPlaces)} {zUnit} · {scaleLabels.midLabel}
          </span>
          <span className="text-rose-400">
            {maxVal.toFixed(decimalPlaces)} {zUnit} · {scaleLabels.highLabel}
          </span>
        </div>
        <div
          className="h-2.5 w-full rounded-sm border border-[#2A3347]"
          style={{ background: getSchemeGradientCss(colorScheme) }}
        />
      </div>
    </div>
  );
};
