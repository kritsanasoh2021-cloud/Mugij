import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  ChevronDown,
  Cpu,
  Database,
  Flame,
  Gauge,
  Maximize2,
  Menu,
  Minimize2,
  PlugZap,
  RotateCw,
  SlidersHorizontal,
  Unplug,
  Upload,
  X,
} from 'lucide-react';
import { ConnectionMode, EcuProject, WorkspaceTab } from '../types/ecu';
import { isWebSerialSupported } from '../engine/klineSerial';
import { PWAInstallButton } from './PWAInstallButton';

interface TopBarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  activeProject: EcuProject | null;
  connectionMode: ConnectionMode;
  ecuIdHex: string | null;
  onConnectWebSerial: (mode: 'webserial-direct' | 'webserial-bridge') => void;
  onStartBenchSim: () => void;
  onDisconnect: () => void;
  hasUnsavedChanges: boolean;
  isCompactViewport?: boolean;
  preferredOrientation?: 'landscape' | 'portrait';
  onToggleOrientation?: () => void;
  isFullscreen?: boolean;
  isFullscreenSupported?: boolean;
  onToggleFullscreen?: () => void;
}

const NAV_ITEMS: {
  id: WorkspaceTab;
  label: string;
  subLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: 'library',
    label: 'คลังรถ Honda & ไฟล์ BIN/XDF',
    subLabel: 'เลือกรุ่นรถ Forza 350 / PCX / Wave หรืออัปโหลดไฟล์เพิ่ม',
    icon: Database,
  },
  {
    id: 'tuning',
    label: 'ตารางจูน 2D / 3D Map',
    subLabel: 'จูนน้ำมัน องศาไฟ ลิมิตรอบ และแสดงพื้นผิว 3 มิติพร้อมระดับสี',
    icon: SlidersHorizontal,
  },
  {
    id: 'autotune',
    label: 'Auto-Tune AFR อัตโนมัติ',
    subLabel: 'เก็บค่า AFR จริงเทียบ Target และปรับจูนน้ำมันอัตโนมัติ',
    icon: Flame,
  },
  {
    id: 'gauge',
    label: 'Smart Gauge & สแกนโค้ด DTC',
    subLabel: 'เกจวัดค่าเซนเซอร์รถครบชุด พร้อมอ่านและลบโค้ดผิดปกติ',
    icon: Gauge,
  },
  {
    id: 'flasher',
    label: 'ดูด-อัดไฟล์ ECU & Checksum',
    subLabel: 'อ่าน/เขียนไฟล์ ROM และคำนวณ Checksum อัตโนมัติ',
    icon: Upload,
  },
];

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onSelectTab,
  activeProject,
  connectionMode,
  ecuIdHex,
  onConnectWebSerial,
  onStartBenchSim,
  onDisconnect,
  hasUnsavedChanges,
  isCompactViewport = false,
  preferredOrientation = 'landscape',
  onToggleOrientation,
  isFullscreen = false,
  isFullscreenSupported = false,
  onToggleFullscreen,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [connectMenuOpen, setConnectMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const connectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (connectRef.current && !connectRef.current.contains(e.target as Node)) {
        setConnectMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentNav = NAV_ITEMS.find((n) => n.id === activeTab) || NAV_ITEMS[0];
  const serialSupported = isWebSerialSupported();

  return (
    <header className="h-11 shrink-0 bg-[#0D1018] border-b border-[#242B3B] px-3 flex items-center justify-between gap-4 relative z-40">
      {/* Zone 1: Top-Left Hidden Navigation Drawer Trigger + Brand Wordmark */}
      <div className="flex items-center gap-3 min-w-0" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="h-8 px-2.5 rounded-md bg-[#171C28] hover:bg-[#1F2636] border border-[#2B3346] text-slate-100 flex items-center gap-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          aria-expanded={menuOpen}
          title="เปิดเมนูหัวข้อทั้งหมด"
        >
          {menuOpen ? <X className="w-4 h-4 text-rose-400" /> : <Menu className="w-4 h-4 text-rose-400" />}
          <span>หัวข้อ</span>
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
        </button>

        <span className="text-sm font-bold tracking-tight text-white whitespace-nowrap shrink-0">
          Honda PGM-FI Studio
        </span>

        <span className="text-slate-600 select-none shrink-0" aria-hidden="true">
          ·
        </span>

        <span className="text-xs font-medium text-cyan-400 whitespace-nowrap truncate max-w-[165px]">
          {currentNav.label}
        </span>

        {activeProject && (
          <div className="flex items-center gap-1.5 min-w-0">
            <div
              className="flex items-center gap-1 bg-[#121723] border border-[#263044] rounded px-2 py-0.5 text-[11px] font-mono-tabular whitespace-nowrap shrink-0"
              title={
                connectionMode !== 'disconnected'
                  ? `ID กล่อง ECU ขณะเชื่อมต่อ: ${ecuIdHex || 'กำลังอ่าน...'} (พาร์ท ${activeProject.ecmPartNumber})`
                  : `หมายเลขกล่อง ECU: ${activeProject.ecmPartNumber} (${activeProject.modelName})`
              }
            >
              <span className="text-slate-400">กล่อง:</span>
              <span className="text-cyan-300 font-semibold">
                {connectionMode !== 'disconnected'
                  ? ecuIdHex || 'กำลังอ่าน...'
                  : activeProject.ecmPartNumber}
              </span>
            </div>

            <div
              className="flex items-center gap-1 bg-[#121723] border border-[#263044] rounded px-2 py-0.5 text-[11px] font-mono-tabular min-w-0 max-w-[175px]"
              title={`ไฟล์ XDF: ${activeProject.xdfFileName}`}
            >
              <span className="text-slate-400 shrink-0">XDF:</span>
              <span className="text-emerald-300 font-medium truncate">{activeProject.xdfFileName}</span>
            </div>

            <div
              className="flex items-center gap-1 bg-[#121723] border border-amber-500/40 rounded px-2 py-0.5 text-[11px] font-mono-tabular min-w-0 max-w-[190px]"
              title={`ไฟล์ที่โหลดใช้งาน: ${activeProject.binFileName}`}
            >
              <span className="text-slate-400 shrink-0">ไฟล์:</span>
              <span className="text-amber-300 font-semibold truncate">{activeProject.binFileName}</span>
            </div>

            {hasUnsavedChanges && (
              <span className="inline text-[11px] text-amber-400 font-medium whitespace-nowrap shrink-0">
                (แก้ไขแล้ว)
              </span>
            )}
          </div>
        )}

        {/* Tucked Top-Corner Navigation Menu */}
        {menuOpen && (
          <div className="absolute top-11 left-3 w-[340px] bg-[#11151E] border border-[#2A3347] rounded-lg shadow-2xl p-1.5 z-50">
            <div className="px-2.5 py-1.5 text-[11px] font-medium text-slate-400 border-b border-[#1E2535] mb-1">
              เลือกหน้าการทำงาน (Workspace Modules)
            </div>
            <div className="flex flex-col gap-0.5">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelectTab(item.id);
                      setMenuOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-md flex items-start gap-2.5 transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-rose-600/15 text-white border border-rose-500/40'
                        : 'text-slate-300 hover:bg-[#1A202E] border border-transparent'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 mt-0.5 shrink-0 ${
                        isActive ? 'text-rose-400' : 'text-slate-400'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold leading-tight">{item.label}</div>
                      <div className="text-[11px] text-slate-400 leading-snug mt-0.5">
                        {item.subLabel}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Zone 3: Primary Web Serial / K-Line Connection Control */}
      <div className="flex items-center gap-2 shrink-0 relative" ref={connectRef}>
        {isFullscreenSupported && onToggleFullscreen && (
          <button
            type="button"
            onClick={onToggleFullscreen}
            className={`h-8 px-2.5 rounded-md border text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              isFullscreen
                ? 'bg-[#171C28] hover:bg-[#1F2636] border-[#2B3346] text-slate-300'
                : 'bg-cyan-600/20 hover:bg-cyan-600/35 border-cyan-500/50 text-cyan-200'
            }`}
            title={
              isFullscreen
                ? 'ออกจากโหมดเต็มจอ'
                : 'ขยายเต็มจอ (ซ่อนแถบ URL และปุ่มนำทาง Android)'
            }
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span>ออกเต็มจอ</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span>เต็มจอ</span>
              </>
            )}
          </button>
        )}
        {isCompactViewport && onToggleOrientation && (
          <button
            type="button"
            onClick={onToggleOrientation}
            className="h-8 px-2.5 rounded-md bg-[#171C28] hover:bg-[#1F2636] border border-[#2B3346] text-cyan-300 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title={
              preferredOrientation === 'landscape'
                ? 'สลับหน้าจอเป็นแนวตั้ง'
                : 'สลับหน้าจอกลับเป็นแนวนอนเต็มจอแบบ PC'
            }
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>{preferredOrientation === 'landscape' ? 'หมุนแนวตั้ง' : 'แนวนอน'}</span>
          </button>
        )}
        <PWAInstallButton />
        {connectionMode !== 'disconnected' && (
          <div className="flex items-center gap-2 shrink-0">
            <div
              className="flex items-center gap-1.5 bg-[#0F1B29] border border-cyan-500/40 rounded px-2 py-0.5 text-[11px] font-mono-tabular whitespace-nowrap"
              title="หมายเลข ID กล่อง ECU ที่อ่านได้ขณะเชื่อมต่อ"
            >
              <span className="text-slate-400">ID กล่อง:</span>
              <span className="text-amber-300 font-bold tracking-wide">
                {ecuIdHex || 'กำลังอ่าน...'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-mono-tabular text-cyan-300 whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>
                {connectionMode === 'bench-sim'
                  ? 'Bench Test'
                  : connectionMode === 'webserial-bridge'
                  ? 'K-Line Bridge'
                  : 'K-Line 10,400 bps'}
              </span>
            </div>
          </div>
        )}

        {connectionMode === 'disconnected' ? (
          <button
            type="button"
            onClick={() => setConnectMenuOpen((v) => !v)}
            className="h-8 px-3 rounded-md bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
          >
            <PlugZap className="w-3.5 h-3.5" />
            <span>เชื่อมต่อ K-Line</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onDisconnect}
            className="h-8 px-3 rounded-md bg-[#1B2230] hover:bg-rose-950/60 border border-[#323C52] hover:border-rose-500/50 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Unplug className="w-3.5 h-3.5 text-rose-400" />
            <span>ตัดการเชื่อมต่อ</span>
          </button>
        )}

        {connectMenuOpen && connectionMode === 'disconnected' && (
          <div className="absolute top-10 right-0 w-[330px] bg-[#11151E] border border-[#2A3347] rounded-lg shadow-2xl p-2 z-50">
            <div className="px-2 py-1 text-[11px] font-medium text-slate-400 border-b border-[#1E2535] mb-1.5">
              เลือกวิธีเชื่อมต่อกล่อง ECU Honda
            </div>

            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                disabled={!serialSupported}
                onClick={() => {
                  setConnectMenuOpen(false);
                  onConnectWebSerial('webserial-direct');
                }}
                className="w-full text-left p-2.5 rounded-md bg-[#171C28] hover:bg-[#1E2536] border border-[#293246] disabled:opacity-45 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                    สาย K-Line ตรง (Web Serial 10,400 bps)
                  </span>
                  <span className="text-[10px] font-mono-tabular text-cyan-400">หลัก</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  ใช้สาย USB FTDI / CH340 + ชิป K-Line L9637D เสียบปลั๊ก DLC 4P/6P ของรถ Honda (Wake-Up 70/120ms)
                </p>
              </button>

              <button
                type="button"
                disabled={!serialSupported}
                onClick={() => {
                  setConnectMenuOpen(false);
                  onConnectWebSerial('webserial-bridge');
                }}
                className="w-full text-left p-2.5 rounded-md bg-[#171C28] hover:bg-[#1E2536] border border-[#293246] disabled:opacity-45 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-emerald-400" />
                    K-Line Bridge Adapter (115,200 bps)
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  สำหรับบอร์ด Arduino / ESP32 K-Line Bridge ที่จัดการไทม์มิ่ง Wake-Up ฮาร์ดแวร์ให้โดยตรง
                </p>
              </button>

              {!serialSupported && (
                <div className="px-2 py-1.5 text-[11px] text-amber-400 bg-amber-950/30 border border-amber-800/40 rounded">
                  เบราว์เซอร์นี้ไม่รองรับ Web Serial API (แนะนำ Chrome / Edge)
                </div>
              )}

              <div className="border-t border-[#1E2535] pt-1.5 mt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setConnectMenuOpen(false);
                    onStartBenchSim();
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-md hover:bg-[#1A202E] text-xs text-slate-300 flex items-center justify-between cursor-pointer"
                >
                  <span>เปิดโหมดทดสอบ Bench Dyno (ไม่มีสายเสียบ)</span>
                  <span className="text-[10px] font-mono-tabular text-amber-400">TEST</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
