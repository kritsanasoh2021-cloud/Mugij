import React, { useMemo, useRef, useState } from 'react';
import {
  Check,
  Download,
  FileCode2,
  FolderPlus,
  HardDrive,
  Lock,
  RotateCcw,
  Search,
  Smartphone,
  Trash2,
  Upload,
} from 'lucide-react';
import { HONDA_MODEL_PRESETS } from '../data/hondaPresets';
import { PWAInstallHelpOverlay } from './PWAInstallHelpOverlay';
import {
  decodeXdfBufferAsync,
  NO_BIN_PLACEHOLDER,
  parseXdfXml,
} from '../engine/xdfParser';
import {
  EcuProject,
  HondaModelPresetSpec,
  MotorcycleCategory,
} from '../types/ecu';

interface EcuLibraryViewProps {
  projects: EcuProject[];
  activeProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  onLoadPreset: (spec: HondaModelPresetSpec) => void;
  onCreateCustomProject: (project: EcuProject) => void;
  onAttachXdfToActive: (xdfFileName: string, xmlText: string) => void;
  onAttachBinToActive: (binFileName: string, bytes: Uint8Array) => void;
  onDeleteProject: (projectId: string) => void;
  onResetProjectToStock: (projectId: string) => void;
  onExportBin: (project: EcuProject) => void;
  onExportXdf: (project: EcuProject) => void;
  onGoToTuning: () => void;
}

const CATEGORY_LABELS: { id: 'all' | MotorcycleCategory; label: string }[] = [
  { id: 'all', label: 'ทุกรุ่น Honda' },
  { id: 'scooter', label: 'ออโตเมติก (Forza / PCX / Click)' },
  { id: 'underbone', label: 'รถครอบครัว / มินิไบค์ (Wave / MSX)' },
  { id: 'trail', label: 'วิบาก (CRF250L / CRF300L)' },
  { id: 'sport', label: 'สปอร์ต / บิ๊กไบค์ (CBR / CB)' },
];

export const EcuLibraryView: React.FC<EcuLibraryViewProps> = ({
  projects,
  activeProjectId,
  onSelectProject,
  onLoadPreset,
  onCreateCustomProject,
  onAttachXdfToActive,
  onAttachBinToActive,
  onDeleteProject,
  onResetProjectToStock,
  onExportBin,
  onExportXdf,
  onGoToTuning,
}) => {
  const [category, setCategory] = useState<'all' | MotorcycleCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingBin, setPendingBin] = useState<{ name: string; bytes: Uint8Array } | null>(null);
  const [pendingXdf, setPendingXdf] = useState<{ name: string; xml: string } | null>(null);
  const [customModelName, setCustomModelName] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [showPwaHelp, setShowPwaHelp] = useState(false);

  const binInputRef = useRef<HTMLInputElement>(null);
  const xdfInputRef = useRef<HTMLInputElement>(null);

  const filteredPresets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const qNorm = q.replace(/[-\s_]/g, '');
    return HONDA_MODEL_PRESETS.filter((p) => {
      if (category !== 'all' && p.category !== category) return false;
      if (!q) return true;
      const partNorm = p.ecmPartNumber.toLowerCase().replace(/[-\s_]/g, '');
      const famNorm = p.ecuFamily.toLowerCase().replace(/[-\s_]/g, '');
      const notesNorm = p.notes.toLowerCase().replace(/[-\s_]/g, '');
      return (
        p.modelName.toLowerCase().includes(q) ||
        p.ecmPartNumber.toLowerCase().includes(q) ||
        partNorm.includes(qNorm) ||
        p.ecuFamily.toLowerCase().includes(q) ||
        famNorm.includes(qNorm) ||
        p.notes.toLowerCase().includes(q) ||
        notesNorm.includes(qNorm)
      );
    });
  }, [category, searchQuery]);

  const handleBinFileSelected = async (file: File) => {
    setUploadError(null);
    setUploadNotice(null);
    const buf = new Uint8Array(await file.arrayBuffer());
    if (buf.length < 256) {
      setUploadError('ไฟล์ .bin มีขนาดเล็กเกินไป กรุณาตรวจสอบไฟล์ ROM');
      return;
    }
    setPendingBin({ name: file.name, bytes: buf });
    if (!customModelName) {
      setCustomModelName(file.name.replace(/\.bin$/i, ''));
    }
    setUploadNotice(`เตรียมไฟล์ BIN: ${file.name} (${(buf.length / 1024).toFixed(1)} KB)`);
  };

  const handleXdfFileSelected = async (file: File) => {
    setUploadError(null);
    setUploadNotice(null);
    try {
      const rawBytes = new Uint8Array(await file.arrayBuffer());
      const text = await decodeXdfBufferAsync(rawBytes);
      const parsed = parseXdfXml(text);
      if (
        parsed.tables.length === 0 &&
        parsed.constants.length === 0 &&
        parsed.flags.length === 0
      ) {
        setUploadError('ไม่พบตาราง (XDFTABLE), ค่าคงที่ (XDFCONSTANT) หรือสวิตช์ (XDFFLAG) ในไฟล์ .xdf นี้');
        return;
      }
      setPendingXdf({ name: file.name, xml: text });
      if (!customModelName) {
        const cleanTitle =
          parsed.title && parsed.title !== 'Custom Honda XDF Definition'
            ? parsed.title
            : file.name.replace(/\.(xdf|xml)$/i, '');
        setCustomModelName(cleanTitle);
      }
      setUploadNotice(
        parsed.isReadOnly
          ? `อ่านไฟล์ XDF สำเร็จ (โหมดติดล็อกแก้ไข XDF — จูน .BIN ได้ปกติ): ${parsed.tables.length} ตาราง · ${parsed.constants.length} ค่าคงที่ · ${parsed.flags.length} แฟลก`
          : `อ่านไฟล์ XDF สำเร็จ: ${parsed.tables.length} ตาราง · ${parsed.constants.length} ค่าคงที่ · ${parsed.flags.length} แฟลก`
      );
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'ไม่สามารถอ่านไฟล์ .xdf ได้');
    }
  };

  const handleCreateCustom = () => {
    setUploadError(null);
    const activeProj = projects.find((p) => p.id === activeProjectId) || null;
    if (!pendingBin && !pendingXdf) {
      setUploadError('กรุณาเลือกไฟล์ .XDF หรือไฟล์ .BIN อย่างน้อย 1 ไฟล์ก่อน');
      return;
    }

    const parsedXdf = pendingXdf
      ? parseXdfXml(pendingXdf.xml)
      : activeProj?.xdf;
    if (!parsedXdf) {
      setUploadError('กรุณาเลือกไฟล์ .XDF เพื่อกำหนดตำแหน่งตารางจูน');
      return;
    }

    let romBytes: Uint8Array;
    if (pendingBin) {
      romBytes = new Uint8Array(pendingBin.bytes);
    } else {
      // Compute required flash size from all XDF addresses so XDF-only uploads use a clean blank buffer
      let maxAddr = 32768;
      for (const t of parsedXdf.tables) {
        const end = t.address + t.rows * t.cols * (t.elementSizeBits / 8);
        if (end > maxAddr) maxAddr = end;
        if (t.xAxis.address !== undefined) {
          const xEnd = t.xAxis.address + t.xAxis.count * (t.xAxis.elementSizeBits / 8);
          if (xEnd > maxAddr) maxAddr = xEnd;
        }
        if (t.yAxis.address !== undefined) {
          const yEnd = t.yAxis.address + t.yAxis.count * (t.yAxis.elementSizeBits / 8);
          if (yEnd > maxAddr) maxAddr = yEnd;
        }
      }
      for (const c of parsedXdf.constants) {
        const end = c.address + c.elementSizeBits / 8;
        if (end > maxAddr) maxAddr = end;
      }
      for (const f of parsedXdf.flags) {
        if (f.address + 1 > maxAddr) maxAddr = f.address + 1;
      }
      const paddedSize =
        maxAddr <= 32768 ? 32768 : maxAddr <= 65536 ? 65536 : Math.ceil(maxAddr / 32768) * 32768;
      romBytes = new Uint8Array(paddedSize);
      romBytes.fill(0xff);
    }

    const xdfName = pendingXdf?.name || activeProj?.xdfFileName || 'custom.xdf';
    const binName = pendingBin?.name || NO_BIN_PLACEHOLDER;

    const newProj: EcuProject = {
      id: `custom-${Date.now()}`,
      name: customModelName.trim() || parsedXdf.title || xdfName,
      modelName: customModelName.trim() || parsedXdf.title || xdfName,
      yearRange: 'Custom Upload',
      category: 'scooter',
      ecuFamily: parsedXdf.author || 'Honda Custom ECU',
      ecmPartNumber: (pendingBin?.name || xdfName).replace(/\.(bin|rom|ori|xdf|xml)$/i, '').slice(0, 22),
      protocolLabel: 'Honda K-Line (10,400 bps)',
      baudRate: 10400,
      klineTableId: 0x17,
      flashSizeBytes: romBytes.length,
      checksumAlgorithm: parsedXdf.checksums[0]?.algorithm || 'keihin-16bit-sum',
      binFileName: binName,
      xdfFileName: xdfName,
      isBuiltInPreset: false,
      originalBytes: new Uint8Array(romBytes),
      workingBytes: new Uint8Array(romBytes),
      xdf: parsedXdf,
      updatedAt: Date.now(),
    };
    onCreateCustomProject(newProj);
    setPendingBin(null);
    setPendingXdf(null);
    setCustomModelName('');
    setUploadNotice(
      pendingBin
        ? 'เพิ่มไฟล์ BIN + XDF ใหม่ลงคลังและเปิดใช้งานเรียบร้อยแล้ว'
        : 'เพิ่มไฟล์ XDF ใหม่ลงคลังและเปิดใช้งานเรียบร้อยแล้ว (สามารถนำไฟล์ .BIN มาใส่เพิ่มเติมภายหลังได้)'
    );
  };

  return (
    <div className="h-full w-full grid grid-cols-12 gap-3 p-3 overflow-hidden">
      {/* Left 7 Columns: Built-in Honda Model Catalog */}
      <section className="col-span-7 bg-[#11151E] border border-[#242B3B] rounded-lg flex flex-col min-h-0 overflow-hidden">
        <div className="p-3 border-b border-[#242B3B] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div>
            <h1 className="text-sm font-bold text-white">
              ฐานข้อมูลรถจักรยานยนต์ Honda ทุกรุ่นในไทย ({filteredPresets.length}/{HONDA_MODEL_PRESETS.length} เบอร์กล่อง)
            </h1>
            <p className="text-[11px] text-slate-400">
              ค้นหาตามชื่อรุ่น เบอร์กล่อง หรือ Cal ID (เช่น k58t81, 30400-K1ZF-T01, 0105050D01) แล้วโหลดเข้าจูนทันที
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowPwaHelp(true)}
              className="h-8 px-2.5 rounded bg-[#171C28] hover:bg-[#1F2739] border border-[#2B354B] hover:border-emerald-500/50 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="ดูวิธีติดตั้งเป็นแอป (Add to Home Screen) บน Chrome และ iOS Safari"
            >
              <Smartphone className="w-3.5 h-3.5 shrink-0" />
              <span>Install PWA</span>
            </button>

            <div className="relative w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหารุ่น, เบอร์กล่อง, Cal ID..."
                className="w-full h-8 pl-8 pr-2.5 bg-[#090B10] border border-[#2A3347] rounded text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        </div>

        {/* Category Segmented Filter */}
        <div className="px-3 py-2 border-b border-[#1E2535] flex items-center gap-1.5 overflow-x-auto shrink-0">
          {CATEGORY_LABELS.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                category === cat.id
                  ? 'bg-rose-600 text-white'
                  : 'bg-[#171C28] text-slate-300 hover:bg-[#1E2536]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Horizontal Dense Model Grid */}
        <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-2.5 content-start">
          {filteredPresets.map((spec) => {
            const isLoaded = projects.some(
              (p) => p.ecmPartNumber === spec.ecmPartNumber && p.id === activeProjectId
            );
            return (
              <div
                key={spec.id}
                className={`p-3 rounded-lg border transition-colors flex flex-col justify-between gap-2 ${
                  isLoaded
                    ? 'bg-[#171E2E] border-cyan-500/60'
                    : 'bg-[#141925] border-[#242B3B] hover:border-[#37425B]'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-xs font-bold text-white leading-snug">{spec.modelName}</h2>
                    <span className="text-[11px] font-mono-tabular text-cyan-400 shrink-0">
                      {spec.displacementCc} cc
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono-tabular mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="text-amber-300 font-semibold">{spec.ecmPartNumber}</span>
                    <span aria-hidden="true">·</span>
                    <span>{spec.yearRange}</span>
                    <span aria-hidden="true">·</span>
                    <span>{(spec.flashSizeBytes / 1024).toFixed(0)} KB</span>
                  </div>
                  <div className="text-[10px] font-mono-tabular text-cyan-300/80 mt-0.5 truncate">
                    {spec.ecuFamily}
                  </div>
                  <p className="text-[11px] text-slate-300 mt-1.5 leading-relaxed">
                    {spec.notes}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#1F2636] gap-2">
                  <span className="text-[10px] font-mono-tabular text-slate-400 truncate">
                    {spec.protocolLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onLoadPreset(spec);
                      onGoToTuning();
                    }}
                    className="px-2.5 py-1 rounded bg-[#1E2638] hover:bg-rose-600 text-slate-100 text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {isLoaded ? 'เปิดหน้าจูน' : 'โหลดเข้าจูน'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Right 5 Columns: Custom BIN/XDF Importer & Saved IndexedDB Workspace */}
      <section className="col-span-5 flex flex-col gap-3 min-h-0 overflow-hidden">
        {/* Upload Custom BIN + XDF Box */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingFile(true);
          }}
          onDragLeave={() => setIsDraggingFile(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDraggingFile(false);
            const droppedFiles = Array.from(e.dataTransfer.files || []);
            for (const f of droppedFiles) {
              const lower = f.name.toLowerCase();
              if (lower.endsWith('.xdf') || lower.endsWith('.xml')) {
                void handleXdfFileSelected(f);
              } else if (lower.endsWith('.bin') || lower.endsWith('.rom') || lower.endsWith('.ori')) {
                void handleBinFileSelected(f);
              } else {
                void handleXdfFileSelected(f);
              }
            }
          }}
          className={`bg-[#11151E] border rounded-lg p-3 shrink-0 transition-colors ${
            isDraggingFile ? 'border-amber-400 bg-[#171D2B]' : 'border-[#242B3B]'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-bold text-white flex items-center gap-1.5">
              <FolderPlus className="w-4 h-4 text-amber-400" />
              เพิ่มไฟล์ .BIN และ .XDF ของคุณเอง
            </h2>
            <span className="text-[11px] text-slate-400">ลากวางไฟล์ได้ · บันทึกลงเครื่อง</span>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-2.5">
            <div>
              <input
                ref={binInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleBinFileSelected(f);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => binInputRef.current?.click()}
                className="w-full p-2.5 rounded border border-dashed border-[#34405A] hover:border-cyan-400 bg-[#0D1018] text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400">
                  <Upload className="w-3.5 h-3.5" />
                  เลือกไฟล์ .BIN
                </div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5">
                  {pendingBin ? pendingBin.name : 'ไฟล์รอมรถ (32KB–2MB)'}
                </div>
              </button>
            </div>

            <div>
              <input
                ref={xdfInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleXdfFileSelected(f);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => xdfInputRef.current?.click()}
                className="w-full p-2.5 rounded border border-dashed border-[#34405A] hover:border-amber-400 bg-[#0D1018] text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                  <FileCode2 className="w-3.5 h-3.5" />
                  เลือกไฟล์ .XDF
                </div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5">
                  {pendingXdf ? pendingXdf.name : 'ไฟล์นิยาม TunerPro XDF'}
                </div>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={customModelName}
              onChange={(e) => setCustomModelName(e.target.value)}
              placeholder="ตั้งชื่อโปรไฟล์รถ / ไฟล์จูน..."
              className="flex-1 h-8 px-2.5 bg-[#090B10] border border-[#2A3347] rounded text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="button"
              onClick={handleCreateCustom}
              className="h-8 px-3 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
            >
              สร้างโปรเจกต์
            </button>
          </div>

          {(pendingBin || pendingXdf) && activeProjectId && (
            <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-[#1E2535]">
              {pendingBin && (
                <button
                  type="button"
                  onClick={() => {
                    onAttachBinToActive(pendingBin.name, pendingBin.bytes);
                    setPendingBin(null);
                    setUploadNotice('สลับไฟล์ .BIN เข้าโปรเจกต์ที่กำลังเปิดอยู่เรียบร้อย');
                  }}
                  className="px-2.5 py-1 rounded bg-[#182030] hover:bg-[#222D42] text-[11px] text-cyan-300 cursor-pointer"
                >
                  นำ .BIN ใส่โปรเจกต์ปัจจุบัน
                </button>
              )}
              {pendingXdf && (
                <button
                  type="button"
                  onClick={() => {
                    onAttachXdfToActive(pendingXdf.name, pendingXdf.xml);
                    setPendingXdf(null);
                    setUploadNotice('อัปเดต .XDF เข้าโปรเจกต์ที่กำลังเปิดอยู่เรียบร้อย');
                  }}
                  className="px-2.5 py-1 rounded bg-[#182030] hover:bg-[#222D42] text-[11px] text-amber-300 cursor-pointer"
                >
                  นำ .XDF ใส่โปรเจกต์ปัจจุบัน
                </button>
              )}
            </div>
          )}

          {uploadError && (
            <p className="mt-2 text-[11px] text-rose-400">{uploadError}</p>
          )}
          {uploadNotice && (
            <p className="mt-2 text-[11px] text-emerald-400">{uploadNotice}</p>
          )}
        </div>

        {/* Saved Projects List (IndexedDB) */}
        <div className="flex-1 bg-[#11151E] border border-[#242B3B] rounded-lg flex flex-col min-h-0 overflow-hidden">
          <div className="p-3 border-b border-[#242B3B] flex items-center justify-between shrink-0">
            <h2 className="text-xs font-bold text-white flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-cyan-400" />
              โปรเจกต์ที่บันทึกในเครื่อง ({projects.length})
            </h2>
            <span className="text-[11px] text-slate-400">คลิกเพื่อสลับไฟล์จูน</span>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-2">
            {projects.map((proj) => {
              const isActive = proj.id === activeProjectId;
              return (
                <div
                  key={proj.id}
                  onClick={() => onSelectProject(proj.id)}
                  className={`p-2.5 rounded-lg border transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#171E2E] border-cyan-500/60'
                      : 'bg-[#141925] border-[#232B3B] hover:border-[#34405A]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {isActive && <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                        <span className="text-xs font-bold text-white truncate">
                          {proj.modelName}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono-tabular text-slate-400 mt-0.5 truncate">
                        {proj.binFileName} · {proj.xdfFileName} ·{' '}
                        {(proj.workingBytes.length / 1024).toFixed(0)} KB
                      </div>
                    </div>
                  </div>

                  <div
                    className="flex items-center justify-end gap-1.5 mt-2 pt-2 border-t border-[#1E2535]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => onExportBin(proj)}
                      className="px-2 py-1 rounded bg-[#1A2233] hover:bg-[#232D44] text-[11px] text-slate-200 flex items-center gap-1 cursor-pointer"
                      title="ส่งออกไฟล์ .bin พร้อม Checksum อัตโนมัติ"
                    >
                      <Download className="w-3 h-3 text-emerald-400" />
                      .BIN
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(proj.xdf.isReadOnly)}
                      onClick={() => onExportXdf(proj)}
                      className="px-2 py-1 rounded bg-[#1A2233] hover:bg-[#232D44] disabled:opacity-45 disabled:cursor-not-allowed text-[11px] text-slate-200 flex items-center gap-1 cursor-pointer"
                      title={
                        proj.xdf.isReadOnly
                          ? 'ไฟล์ XDF นี้ล็อกแก้ไขโครงสร้าง (Read-Only)'
                          : 'ส่งออกไฟล์นิยาม .xdf'
                      }
                    >
                      {proj.xdf.isReadOnly ? (
                        <Lock className="w-3 h-3 text-amber-400" />
                      ) : (
                        <Download className="w-3 h-3 text-amber-400" />
                      )}
                      .XDF
                    </button>
                    <button
                      type="button"
                      onClick={() => onResetProjectToStock(proj.id)}
                      className="px-2 py-1 rounded bg-[#1A2233] hover:bg-[#232D44] text-[11px] text-slate-300 flex items-center gap-1 cursor-pointer"
                      title="รีเซ็ตค่าทั้งหมดกลับเป็นไฟล์เดิม"
                    >
                      <RotateCcw className="w-3 h-3" />
                      เดิม
                    </button>
                    {projects.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onDeleteProject(proj.id)}
                        className="p-1 rounded bg-[#1A2233] hover:bg-rose-950/70 text-slate-400 hover:text-rose-400 cursor-pointer"
                        title="ลบโปรเจกต์"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <PWAInstallHelpOverlay
        isOpen={showPwaHelp}
        onClose={() => setShowPwaHelp(false)}
      />
    </div>
  );
};
