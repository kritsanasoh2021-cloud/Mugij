import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AutoTuneView } from './components/AutoTuneView';
import { EcuLibraryView } from './components/EcuLibraryView';
import { FlasherChecksumView } from './components/FlasherChecksumView';
import { OfflineIndicator } from './components/OfflineIndicator';
import { SmartGaugeDtcView } from './components/SmartGaugeDtcView';
import { TopBar } from './components/TopBar';
import { TuningWorkbenchView } from './components/TuningWorkbenchView';
import { createProjectFromPreset, HONDA_MODEL_PRESETS } from './data/hondaPresets';
import { fixAllChecksums } from './engine/checksumEngine';
import {
  deleteProjectFromDb,
  getActiveProjectIdFromDb,
  loadAllProjectsFromDb,
  saveProjectToDb,
  setActiveProjectIdInDb,
} from './engine/indexedDb';
import { HondaKlineEngine } from './engine/klineSerial';
import {
  NO_BIN_PLACEHOLDER,
  parseXdfXml,
  readTableMatrix,
  resolveTableAxisLabels,
  writeConstantValue,
  writeFlagState,
  writeTableCell,
} from './engine/xdfParser';
import {
  ChecksumAlgorithm,
  ConnectionMode,
  EcuProject,
  HondaModelPresetSpec,
  LiveTelemetryFrame,
  SerialPacketLog,
  WorkspaceTab,
} from './types/ecu';

function upgradeBuiltInPresetIfNeeded(proj: EcuProject): EcuProject | null {
  if (!proj.isBuiltInPreset) return null;
  const spec = HONDA_MODEL_PRESETS.find((s) => s.ecmPartNumber === proj.ecmPartNumber);
  if (!spec) return null;
  const fuelTbl = proj.xdf.tables.find((t) => t.id === 'fuel-main-tps');
  const needsAxisLinkUpgrade =
    !fuelTbl ||
    fuelTbl.xAxis.units !== 'RPM' ||
    !fuelTbl.yAxis.units.toLowerCase().includes('tps') ||
    fuelTbl.xAxis.address === undefined ||
    fuelTbl.yAxis.address === undefined;
  const needsK58ShapeUpgrade =
    spec.id === 'wave-110i-k58-t81' &&
    (!fuelTbl || fuelTbl.rows !== 25 || fuelTbl.cols !== 29);
  const needsTreeUpgrade = proj.xdf.tables.length < 14;
  if (!needsAxisLinkUpgrade && !needsK58ShapeUpgrade && !needsTreeUpgrade) return null;
  const fresh = createProjectFromPreset(spec);
  return {
    ...fresh,
    id: proj.id,
    updatedAt: Date.now(),
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('tuning');
  const [projects, setProjects] = useState<EcuProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isBooting, setIsBooting] = useState(true);

  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('disconnected');
  const [telemetry, setTelemetry] = useState<LiveTelemetryFrame | null>(null);
  const [telemetryHistory, setTelemetryHistory] = useState<LiveTelemetryFrame[]>([]);
  const [sessionTelemetryLog, setSessionTelemetryLog] = useState<LiveTelemetryFrame[]>([]);
  const [ecuIdHex, setEcuIdHex] = useState<string | null>(null);
  const [connectedPortName, setConnectedPortName] = useState<string | null>(null);
  const [dtcCodes, setDtcCodes] = useState<string[]>([]);
  const [logs, setLogs] = useState<SerialPacketLog[]>([]);

  // Undo buffer per session
  const [undoStack, setUndoStack] = useState<Uint8Array[]>([]);
  const klineRef = useRef<HondaKlineEngine | null>(null);

  // Mobile/tablet orientation preference: open in landscape by default with toggle to portrait
  const [preferredOrientation, setPreferredOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [stageMode, setStageMode] = useState<
    'normal' | 'landscape-rotated' | 'portrait-rotated'
  >('normal');

  useEffect(() => {
    const updateViewportStage = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const ua = navigator.userAgent.toLowerCase();
      const isTouchDevice =
        /android|iphone|ipad|ipod|mobile/.test(ua) ||
        (navigator.maxTouchPoints > 1 && Math.min(w, h) < 1024);
      const compact = isTouchDevice || w < 1280 || h < 700;
      setIsCompactViewport(compact);

      let nextStage: 'normal' | 'landscape-rotated' | 'portrait-rotated' = 'normal';
      let availW = w;
      let availH = h;

      if (isTouchDevice && preferredOrientation === 'landscape' && h > w) {
        nextStage = 'landscape-rotated';
        availW = h;
        availH = w;
      } else if (isTouchDevice && preferredOrientation === 'portrait' && w > h) {
        nextStage = 'portrait-rotated';
        availW = h;
        availH = w;
      }
      setStageMode(nextStage);

      if (availW >= 1280 && availH >= 700) {
        document.documentElement.style.setProperty('--app-zoom', '1');
        document.documentElement.style.setProperty('--shell-w', `${availW}px`);
        document.documentElement.style.setProperty('--shell-h', `${availH}px`);
      } else {
        const zoom = Math.max(0.28, Math.min(availW / 1280, availH / 700));
        document.documentElement.style.setProperty('--app-zoom', zoom.toFixed(4));
        document.documentElement.style.setProperty('--shell-w', `${(availW / zoom).toFixed(2)}px`);
        document.documentElement.style.setProperty('--shell-h', `${(availH / zoom).toFixed(2)}px`);
      }
    };

    updateViewportStage();
    window.addEventListener('resize', updateViewportStage);
    window.addEventListener('orientationchange', updateViewportStage);
    return () => {
      window.removeEventListener('resize', updateViewportStage);
      window.removeEventListener('orientationchange', updateViewportStage);
      document.documentElement.style.removeProperty('--app-zoom');
      document.documentElement.style.removeProperty('--shell-w');
      document.documentElement.style.removeProperty('--shell-h');
    };
  }, [preferredOrientation]);

  useEffect(() => {
    const ori = screen.orientation as ScreenOrientation & {
      lock?: (orientation: string) => Promise<void>;
    };
    if (isCompactViewport && ori?.lock) {
      ori.lock(preferredOrientation).catch(() => {
        // Browsers outside fullscreen/standalone reject lock(); CSS stage handles rotation seamlessly
      });
    }
  }, [isCompactViewport, preferredOrientation]);

  const handleToggleOrientation = () => {
    const next = preferredOrientation === 'landscape' ? 'portrait' : 'landscape';
    setPreferredOrientation(next);
    const ori = screen.orientation as ScreenOrientation & {
      lock?: (orientation: string) => Promise<void>;
      unlock?: () => void;
    };
    if (ori?.lock) {
      ori.lock(next).catch(() => {
        if (next === 'portrait' && ori.unlock) {
          try {
            ori.unlock();
          } catch {
            // Ignore unlock error
          }
        }
      });
    }
  };

  // Boot from IndexedDB or seed Forza 350 + popular presets
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stored = await loadAllProjectsFromDb();
        if (!mounted) return;
        if (stored.length > 0) {
          const upgradedList = await Promise.all(
            stored.map(async (proj) => {
              const upgraded = upgradeBuiltInPresetIfNeeded(proj);
              if (upgraded) {
                await saveProjectToDb(upgraded);
                return upgraded;
              }
              return proj;
            })
          );
          if (!mounted) return;
          setProjects(upgradedList);
          const savedActive = await getActiveProjectIdFromDb();
          const chosen =
            upgradedList.find((p) => p.id === savedActive)?.id || upgradedList[0].id;
          setActiveProjectId(chosen);
        } else {
          // Seed Forza 350, PCX 160, and Wave 110i on first launch
          const seedSpecs = [
            HONDA_MODEL_PRESETS[0], // Forza 350
            HONDA_MODEL_PRESETS[2], // PCX 160
            HONDA_MODEL_PRESETS[8], // Wave 110i
          ];
          const seeded = seedSpecs.map((s) => createProjectFromPreset(s));
          for (const proj of seeded) {
            await saveProjectToDb(proj);
          }
          await setActiveProjectIdInDb(seeded[0].id);
          if (!mounted) return;
          setProjects(seeded);
          setActiveProjectId(seeded[0].id);
        }
      } finally {
        if (mounted) setIsBooting(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Initialize Web Serial K-Line Engine
  useEffect(() => {
    const engine = new HondaKlineEngine({
      onLog: (entry) => {
        setLogs((prev) => [entry, ...prev].slice(0, 180));
      },
      onTelemetry: (frame) => {
        setTelemetry(frame);
        setDtcCodes(frame.activeDtcCodes);
        setTelemetryHistory((prev) => [...prev.slice(-119), frame]);
        setSessionTelemetryLog((prev) =>
          prev.length >= 5000 ? [...prev.slice(-4999), frame] : [...prev, frame]
        );
      },
      onEcuId: (idHex) => {
        setEcuIdHex(idHex);
      },
      onPortInfo: (label) => {
        setConnectedPortName(label);
      },
      onDisconnect: () => {
        setConnectionMode('disconnected');
        setEcuIdHex(null);
        setConnectedPortName(null);
      },
    });
    klineRef.current = engine;
    return () => {
      engine.disconnect();
    };
  }, []);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) || null,
    [projects, activeProjectId]
  );

  const hasUnsavedChanges = useMemo(() => {
    if (!activeProject) return false;
    const a = activeProject.originalBytes;
    const b = activeProject.workingBytes;
    if (a.length !== b.length) return true;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return true;
    }
    return false;
  }, [activeProject]);

  const commitWorkingBytes = useCallback(
    (nextBytes: Uint8Array, pushUndo = true) => {
      if (!activeProject) return;
      if (pushUndo) {
        setUndoStack((prev) => [new Uint8Array(activeProject.workingBytes), ...prev].slice(0, 30));
      }
      const updated: EcuProject = {
        ...activeProject,
        workingBytes: nextBytes,
        updatedAt: Date.now(),
      };
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      void saveProjectToDb(updated);
    },
    [activeProject]
  );

  const handleUndo = () => {
    if (!activeProject || undoStack.length === 0) return;
    const [latest, ...rest] = undoStack;
    setUndoStack(rest);
    commitWorkingBytes(latest, false);
  };

  const handleUpdateTableCells = useCallback(
    (tableId: string, updates: { row: number; col: number; value: number }[]) => {
      if (!activeProject) return;
      const tbl = activeProject.xdf.tables.find((t) => t.id === tableId);
      if (!tbl) return;
      const nextBytes = new Uint8Array(activeProject.workingBytes);
      for (const u of updates) {
        writeTableCell(nextBytes, tbl, u.row, u.col, u.value);
      }
      commitWorkingBytes(nextBytes, true);
    },
    [activeProject, commitWorkingBytes]
  );

  const handleUpdateTargetAfrCell = useCallback(
    (afrTableId: string, row: number, col: number, value: number) => {
      if (!activeProject) return;
      const hasTable = activeProject.xdf.tables.some((t) => t.id === afrTableId);
      if (hasTable) {
        handleUpdateTableCells(afrTableId, [{ row, col, value }]);
        return;
      }
      // Update customTargetAfrMap if project uses a custom XDF without a ROM AFR table
      const fuelTable =
        activeProject.xdf.tables.find((t) => t.id === 'fuel-main-tps') ||
        activeProject.xdf.tables.find((t) => t.category === 'fuel') ||
        activeProject.xdf.tables[0];
      const rows = fuelTable?.rows || 9;
      const cols = fuelTable?.cols || 10;
      const base =
        activeProject.customTargetAfrMap && activeProject.customTargetAfrMap.length === rows
          ? activeProject.customTargetAfrMap.map((r) => [...r])
          : Array.from({ length: rows }, () => Array(cols).fill(13.5));
      if (base[row]) base[row][col] = value;
      const updated: EcuProject = {
        ...activeProject,
        customTargetAfrMap: base,
        updatedAt: Date.now(),
      };
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      void saveProjectToDb(updated);
    },
    [activeProject, handleUpdateTableCells]
  );

  const handleUpdateStoichAfr = useCallback(
    (stoichAfr: number) => {
      if (!activeProject) return;
      const updated: EcuProject = {
        ...activeProject,
        stoichAfr,
        updatedAt: Date.now(),
      };
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      void saveProjectToDb(updated);
    },
    [activeProject]
  );

  const handleUpdateTargetAfrMap = useCallback(
    (
      updates: { row: number; col: number; targetAfr: number }[],
      correlateFuel: boolean
    ) => {
      if (!activeProject || updates.length === 0) return;

      const fuelTable =
        activeProject.xdf.tables.find((t) => t.id === 'fuel-main-tps') ||
        activeProject.xdf.tables.find((t) => t.category === 'fuel') ||
        null;
      const afrTable =
        activeProject.xdf.tables.find((t) => t.id === 'target-afr-map') ||
        activeProject.xdf.tables.find((t) => t.category === 'afr') ||
        null;

      const nextBytes = new Uint8Array(activeProject.workingBytes);
      let nextCustomAfr = activeProject.customTargetAfrMap
        ? activeProject.customTargetAfrMap.map((r) => [...r])
        : undefined;

      // Read previous Target AFR matrix to compute proportional fuel correlation
      const fuelMatrix = fuelTable ? readTableMatrix(activeProject.workingBytes, fuelTable) : [];
      const prevAfrMatrix = afrTable
        ? readTableMatrix(activeProject.workingBytes, afrTable)
        : nextCustomAfr && nextCustomAfr.length > 0
        ? nextCustomAfr
        : fuelMatrix.map((row) => row.map(() => 13.5));

      if (!afrTable) {
        const rows = fuelMatrix.length || 9;
        const cols = fuelMatrix[0]?.length || 10;
        if (!nextCustomAfr || nextCustomAfr.length !== rows) {
          nextCustomAfr = Array.from({ length: rows }, (_, r) =>
            Array.from({ length: cols }, (_, c) => prevAfrMatrix[r]?.[c] ?? 13.5)
          );
        }
      }

      // Helper to map Target AFR (r, c) onto Fuel Table (fr, fc) even if custom XDF axes differ
      const preferExplicit = activeProject.binFileName === NO_BIN_PLACEHOLDER;
      const afrX = afrTable
        ? resolveTableAxisLabels(
            activeProject.workingBytes,
            afrTable.xAxis,
            activeProject.xdf.tables,
            preferExplicit
          )
        : fuelTable
        ? resolveTableAxisLabels(
            activeProject.workingBytes,
            fuelTable.xAxis,
            activeProject.xdf.tables,
            preferExplicit
          )
        : [];
      const afrY = afrTable
        ? resolveTableAxisLabels(
            activeProject.workingBytes,
            afrTable.yAxis,
            activeProject.xdf.tables,
            preferExplicit
          )
        : fuelTable
        ? resolveTableAxisLabels(
            activeProject.workingBytes,
            fuelTable.yAxis,
            activeProject.xdf.tables,
            preferExplicit
          )
        : [];
      const fuelX = fuelTable
        ? resolveTableAxisLabels(
            activeProject.workingBytes,
            fuelTable.xAxis,
            activeProject.xdf.tables,
            preferExplicit
          )
        : [];
      const fuelY = fuelTable
        ? resolveTableAxisLabels(
            activeProject.workingBytes,
            fuelTable.yAxis,
            activeProject.xdf.tables,
            preferExplicit
          )
        : [];

      const findNearest = (labels: number[], val: number, fallbackIdx: number, maxLen: number) => {
        if (labels.length === 0) return Math.min(fallbackIdx, Math.max(0, maxLen - 1));
        let best = 0;
        let bestDiff = Infinity;
        for (let i = 0; i < labels.length; i++) {
          const d = Math.abs(labels[i] - val);
          if (d < bestDiff) {
            bestDiff = d;
            best = i;
          }
        }
        return best;
      };

      const fuelUpdatesDone = new Set<string>();

      for (const u of updates) {
        const clampedAfr = Math.max(9.0, Math.min(18.0, Number(u.targetAfr.toFixed(2))));
        const prevAfr = prevAfrMatrix[u.row]?.[u.col] ?? 13.5;

        if (afrTable) {
          writeTableCell(nextBytes, afrTable, u.row, u.col, clampedAfr);
        } else if (nextCustomAfr && nextCustomAfr[u.row]) {
          nextCustomAfr[u.row][u.col] = clampedAfr;
        }

        if (correlateFuel && fuelTable && fuelMatrix.length > 0) {
          const sameShape =
            fuelMatrix.length === prevAfrMatrix.length &&
            (fuelMatrix[0]?.length || 0) === (prevAfrMatrix[0]?.length || 0);
          const fRow = sameShape
            ? u.row
            : findNearest(fuelY, afrY[u.row] ?? 0, u.row, fuelMatrix.length);
          const fCol = sameShape
            ? u.col
            : findNearest(fuelX, afrX[u.col] ?? 0, u.col, fuelMatrix[0]?.length || 0);

          const key = `${fRow}:${fCol}`;
          if (!fuelUpdatesDone.has(key)) {
            fuelUpdatesDone.add(key);
            const curFuel = fuelMatrix[fRow]?.[fCol];
            if (curFuel !== undefined && prevAfr > 0 && clampedAfr > 0) {
              // Richer target (lower AFR) => higher fuel pulse width proportionally
              const scaledFuel = Number(
                (curFuel * (prevAfr / clampedAfr)).toFixed(fuelTable.decimalPlaces)
              );
              writeTableCell(nextBytes, fuelTable, fRow, fCol, scaledFuel);
            }
          }
        }
      }

      setUndoStack((prev) =>
        [new Uint8Array(activeProject.workingBytes), ...prev].slice(0, 30)
      );
      const updated: EcuProject = {
        ...activeProject,
        workingBytes: nextBytes,
        customTargetAfrMap: nextCustomAfr,
        updatedAt: Date.now(),
      };
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      void saveProjectToDb(updated);
    },
    [activeProject]
  );

  const handleUpdateConstant = useCallback(
    (constantId: string, value: number) => {
      if (!activeProject) return;
      const c = activeProject.xdf.constants.find((item) => item.id === constantId);
      if (!c) return;
      const nextBytes = new Uint8Array(activeProject.workingBytes);
      writeConstantValue(nextBytes, c, value);
      commitWorkingBytes(nextBytes, true);
    },
    [activeProject, commitWorkingBytes]
  );

  const handleToggleFlag = useCallback(
    (flagId: string, enabled: boolean) => {
      if (!activeProject) return;
      const f = activeProject.xdf.flags.find((item) => item.id === flagId);
      if (!f) return;
      const nextBytes = new Uint8Array(activeProject.workingBytes);
      writeFlagState(nextBytes, f, enabled);
      commitWorkingBytes(nextBytes, true);
    },
    [activeProject, commitWorkingBytes]
  );

  const handleSelectProject = (projectId: string) => {
    setActiveProjectId(projectId);
    setUndoStack([]);
    void setActiveProjectIdInDb(projectId);
  };

  const handleLoadPreset = (spec: HondaModelPresetSpec) => {
    const existing = projects.find(
      (p) => p.isBuiltInPreset && p.ecmPartNumber === spec.ecmPartNumber
    );
    if (existing) {
      const upgraded = upgradeBuiltInPresetIfNeeded(existing);
      if (upgraded) {
        setProjects((prev) => prev.map((p) => (p.id === upgraded.id ? upgraded : p)));
        setActiveProjectId(upgraded.id);
        setUndoStack([]);
        void saveProjectToDb(upgraded);
        void setActiveProjectIdInDb(upgraded.id);
        return;
      }
      handleSelectProject(existing.id);
      return;
    }
    const created = createProjectFromPreset(spec);
    setProjects((prev) => [created, ...prev]);
    setActiveProjectId(created.id);
    setUndoStack([]);
    void saveProjectToDb(created);
    void setActiveProjectIdInDb(created.id);
  };

  const handleCreateCustomProject = (proj: EcuProject) => {
    setProjects((prev) => [proj, ...prev]);
    setActiveProjectId(proj.id);
    setUndoStack([]);
    void saveProjectToDb(proj);
    void setActiveProjectIdInDb(proj.id);
  };

  const handleAttachXdfToActive = (xdfFileName: string, xmlText: string) => {
    if (!activeProject) return;
    const xdf = parseXdfXml(xmlText);
    const updated: EcuProject = {
      ...activeProject,
      xdfFileName,
      xdf,
      isBuiltInPreset: false,
      updatedAt: Date.now(),
    };
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    void saveProjectToDb(updated);
  };

  const handleAttachBinToActive = (binFileName: string, bytes: Uint8Array) => {
    if (!activeProject) return;
    const updated: EcuProject = {
      ...activeProject,
      binFileName,
      flashSizeBytes: bytes.length,
      isBuiltInPreset: false,
      originalBytes: new Uint8Array(bytes),
      workingBytes: new Uint8Array(bytes),
      updatedAt: Date.now(),
    };
    setUndoStack([]);
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    void saveProjectToDb(updated);
  };

  const handleDeleteProject = (projectId: string) => {
    setProjects((prev) => {
      const next = prev.filter((p) => p.id !== projectId);
      if (activeProjectId === projectId && next.length > 0) {
        setActiveProjectId(next[0].id);
        void setActiveProjectIdInDb(next[0].id);
      }
      return next;
    });
    void deleteProjectFromDb(projectId);
  };

  const handleResetProjectToStock = (projectId: string) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        const resetProj: EcuProject = {
          ...p,
          workingBytes: new Uint8Array(p.originalBytes),
          updatedAt: Date.now(),
        };
        void saveProjectToDb(resetProj);
        return resetProj;
      })
    );
    setUndoStack([]);
  };

  const handleFixChecksums = (algorithmOverride?: ChecksumAlgorithm): number => {
    if (!activeProject) return 0;
    const algo = algorithmOverride || activeProject.checksumAlgorithm;
    const regions = activeProject.xdf.checksums.map((r) => ({
      ...r,
      algorithm: algo,
    }));
    const { updatedBytes, patchedCount } = fixAllChecksums(
      activeProject.workingBytes,
      regions,
      algo
    );
    if (patchedCount > 0 || algo !== activeProject.checksumAlgorithm) {
      const updated: EcuProject = {
        ...activeProject,
        checksumAlgorithm: algo,
        workingBytes: updatedBytes,
        updatedAt: Date.now(),
      };
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      void saveProjectToDb(updated);
    }
    return patchedCount;
  };

  const handleExportBin = (proj: EcuProject | null = activeProject) => {
    if (!proj) return;
    // Automatically fix checksum before downloading .BIN
    const { updatedBytes } = fixAllChecksums(
      proj.workingBytes,
      proj.xdf.checksums,
      proj.checksumAlgorithm
    );
    const bufferCopy = new Uint8Array(updatedBytes.byteLength);
    bufferCopy.set(updatedBytes);
    const blob = new Blob([bufferCopy.buffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = proj.binFileName.replace(/\.bin$/i, '') + '_TUNED_CSOK.bin';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportXdf = (proj: EcuProject | null = activeProject) => {
    if (!proj || proj.xdf.isReadOnly) return;
    const blob = new Blob([proj.xdf.rawXml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = proj.xdfFileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleConnectWebSerial = async (
    mode: 'webserial-direct' | 'webserial-bridge' = 'webserial-direct'
  ) => {
    if (!klineRef.current) return;
    setSessionTelemetryLog([]);
    const ok = await klineRef.current.connectWebSerial(
      mode,
      activeProject?.baudRate || 10400,
      activeProject?.klineTableId || 0x17
    );
    if (ok) setConnectionMode(mode);
  };

  const handleStartBenchSim = () => {
    if (!klineRef.current) return;
    setSessionTelemetryLog([]);
    const calIdMatch =
      activeProject?.ecuFamily.match(/\b0[0-9A-F]{9}\b/i) ||
      activeProject?.name.match(/\b0[0-9A-F]{9}\b/i);
    const simEcuId = calIdMatch ? calIdMatch[0].toUpperCase() : '0103010D01';
    klineRef.current.startBenchSimulator(9500, simEcuId);
    setConnectionMode('bench-sim');
  };

  const handleDisconnect = async () => {
    if (!klineRef.current) return;
    await klineRef.current.disconnect();
    setConnectionMode('disconnected');
    setEcuIdHex(null);
    setConnectedPortName(null);
  };

  const handleReadDtc = async () => {
    if (!klineRef.current) return;
    const codes = await klineRef.current.readDtc();
    setDtcCodes(codes);
  };

  const handleClearDtc = async () => {
    if (!klineRef.current) return;
    const ok = await klineRef.current.clearDtc();
    if (ok) setDtcCodes([]);
  };

  const handleReadEcuBin = async (
    onProgress: (pct: number, addrHex: string) => void
  ) => {
    if (!klineRef.current) return;
    const size = activeProject?.flashSizeBytes || 65536;
    const dump = await klineRef.current.readEcuFlash(size, onProgress);
    if (!dump) return;

    const baseSpec =
      HONDA_MODEL_PRESETS.find((s) => s.ecmPartNumber === activeProject?.ecmPartNumber) ||
      HONDA_MODEL_PRESETS[0];
    const template = createProjectFromPreset(baseSpec);
    const readProj: EcuProject = {
      ...template,
      id: `ecu-read-${Date.now()}`,
      name: `${baseSpec.modelName} (Read ECU)`,
      modelName: `${baseSpec.modelName} (ดูดจาก ECU)`,
      binFileName: `${baseSpec.ecmPartNumber}_READ_${new Date()
        .toISOString()
        .slice(11, 19)
        .replace(/:/g, '')}.bin`,
      isBuiltInPreset: false,
      originalBytes: new Uint8Array(dump),
      workingBytes: new Uint8Array(dump),
      updatedAt: Date.now(),
    };
    handleCreateCustomProject(readProj);
  };

  const handleWriteEcuBin = async (
    onProgress: (pct: number, stage: string) => void
  ): Promise<boolean> => {
    if (!klineRef.current || !activeProject) return false;
    return klineRef.current.writeEcuFlash(activeProject.workingBytes, onProgress);
  };

  const stageClass =
    stageMode === 'landscape-rotated'
      ? 'mobile-orientation-stage--landscape-rotated'
      : stageMode === 'portrait-rotated'
      ? 'mobile-orientation-stage--portrait-rotated'
      : 'mobile-orientation-stage';

  if (isBooting) {
    return (
      <div className={stageClass}>
        <div className="app-desktop-shell bg-[#090B10] flex items-center justify-center text-xs text-slate-400">
          กำลังโหลดฐานข้อมูลรถ Honda และคลังไฟล์ BIN/XDF...
        </div>
      </div>
    );
  }

  return (
    <div className={stageClass}>
      <div className="app-desktop-shell bg-[#090B10] text-slate-100 flex flex-col overflow-hidden">
        <TopBar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          activeProject={activeProject}
          connectionMode={connectionMode}
          ecuIdHex={ecuIdHex}
          onConnectWebSerial={handleConnectWebSerial}
          onStartBenchSim={handleStartBenchSim}
          onDisconnect={handleDisconnect}
          hasUnsavedChanges={hasUnsavedChanges}
          isCompactViewport={isCompactViewport}
          preferredOrientation={preferredOrientation}
          onToggleOrientation={handleToggleOrientation}
        />

      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'library' && (
          <EcuLibraryView
            projects={projects}
            activeProjectId={activeProjectId}
            onSelectProject={handleSelectProject}
            onLoadPreset={handleLoadPreset}
            onCreateCustomProject={handleCreateCustomProject}
            onAttachXdfToActive={handleAttachXdfToActive}
            onAttachBinToActive={handleAttachBinToActive}
            onDeleteProject={handleDeleteProject}
            onResetProjectToStock={handleResetProjectToStock}
            onExportBin={handleExportBin}
            onExportXdf={handleExportXdf}
            onGoToTuning={() => setActiveTab('tuning')}
          />
        )}

        {activeTab === 'tuning' && (
          <TuningWorkbenchView
            project={activeProject}
            telemetry={telemetry}
            sessionTelemetryLog={sessionTelemetryLog}
            onClearSessionTelemetry={() => setSessionTelemetryLog([])}
            onUpdateTableCells={handleUpdateTableCells}
            onUpdateTargetAfrMap={handleUpdateTargetAfrMap}
            onUpdateStoichAfr={handleUpdateStoichAfr}
            onUpdateConstant={handleUpdateConstant}
            onToggleFlag={handleToggleFlag}
            onUndo={handleUndo}
            canUndo={undoStack.length > 0}
            onExportBin={() => handleExportBin(activeProject)}
            onGoToLibrary={() => setActiveTab('library')}
          />
        )}

        {activeTab === 'autotune' && (
          <AutoTuneView
            project={activeProject}
            telemetry={telemetry}
            connectionMode={connectionMode}
            onApplyFuelCorrections={handleUpdateTableCells}
            onUpdateTargetAfrCell={handleUpdateTargetAfrCell}
            onStartBenchSim={handleStartBenchSim}
            onConnectWebSerial={() => handleConnectWebSerial('webserial-direct')}
          />
        )}

        {activeTab === 'gauge' && (
          <SmartGaugeDtcView
            project={activeProject}
            telemetry={telemetry}
            history={telemetryHistory}
            connectionMode={connectionMode}
            dtcCodes={dtcCodes}
            onReadDtc={handleReadDtc}
            onClearDtc={handleClearDtc}
            onConnectWebSerial={() => handleConnectWebSerial('webserial-direct')}
            onStartBenchSim={handleStartBenchSim}
          />
        )}

        {activeTab === 'flasher' && (
          <FlasherChecksumView
            project={activeProject}
            connectionMode={connectionMode}
            connectedPortName={connectedPortName}
            telemetry={telemetry}
            ecuIdHex={ecuIdHex}
            logs={logs}
            onFixChecksums={handleFixChecksums}
            onReadEcuBin={handleReadEcuBin}
            onWriteEcuBin={handleWriteEcuBin}
            onAttachBinToActive={handleAttachBinToActive}
            onExportBin={() => handleExportBin(activeProject)}
            onClearLogs={() => setLogs([])}
            onConnectWebSerial={() => handleConnectWebSerial('webserial-direct')}
            onConnectBridge={() => handleConnectWebSerial('webserial-bridge')}
            onStartBenchSim={handleStartBenchSim}
            onDisconnect={handleDisconnect}
          />
        )}
        </div>
        <OfflineIndicator />
      </div>
    </div>
  );
}
