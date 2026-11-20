import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Chrome,
  Compass,
  Copy,
  Download,
  ExternalLink,
  Share,
  Smartphone,
  X,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallHelpOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PWAInstallHelpOverlay: React.FC<PWAInstallHelpOverlayProps> = ({
  isOpen,
  onClose,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [copied, setCopied] = useState(false);

  const isInIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

  const handleCopyUrl = async () => {
    if (!currentUrl) return;
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback copy unavailable in restricted context
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-help-title"
    >
      <div
        className="w-full max-w-2xl max-h-[90%] overflow-y-auto rounded-xl bg-[#11151E] border border-[#2A3347] shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#242B3B] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center shrink-0">
              <Smartphone className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <h2 id="pwa-help-title" className="text-sm font-bold text-white truncate">
                คู่มือติดตั้งแอปลงหน้าจอหลัก (Install PWA / Add to Home Screen)
              </h2>
              <p className="text-[11px] text-slate-400 truncate">
                ใช้งาน Honda PGM-FI ECU Studio แบบเต็มจอแนวนอนและทำงานออฟไลน์ได้ทันที
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#1A202E] text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
            aria-label="ปิดหน้าต่างคู่มือติดตั้ง PWA"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4">
          {/* Iframe / Sandbox Explanation Banner */}
          <div
            className={`rounded-lg border p-3.5 flex items-start gap-3 ${
              isInIframe
                ? 'bg-amber-500/10 border-amber-500/35'
                : 'bg-[#151B27] border-[#263044]'
            }`}
          >
            <AlertTriangle
              className={`w-4 h-4 mt-0.5 shrink-0 ${
                isInIframe ? 'text-amber-400' : 'text-cyan-400'
              }`}
            />
            <div className="flex-1 min-w-0 text-xs leading-relaxed">
              <div className="font-bold text-white flex flex-wrap items-center gap-2">
                <span>
                  {isInIframe
                    ? 'ตรวจพบการเปิดผ่านกรอบ Iframe / หน้า Preview'
                    : 'ข้อควรรู้เรื่อง Iframe & Browser Security Sandbox'}
                </span>
                {isInstalled && (
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-semibold">
                    กำลังใช้งานในโหมดแอปแล้ว
                  </span>
                )}
              </div>
              <p className="text-slate-300 mt-1">
                เบราว์เซอร์สมัยใหม่จะบล็อก Web App Manifest และซ่อนปุ่มติดตั้งแอปอัตโนมัติ
                เมื่อหน้าเว็บถูกเปิดอยู่ใน <strong>กรอบ iframe / หน้า Preview</strong> หรือ
                <strong>เบราว์เซอร์ในแอปอื่น (เช่น LINE / Facebook)</strong>{' '}
                หากไม่เห็นปุ่มติดตั้งหรือขึ้นแค่ "ทางลัด" ให้คัดลอก URL ไปเปิดโดยตรงใน{' '}
                <strong>Chrome (Android/PC)</strong> หรือ <strong>Safari (iOS)</strong> โหมดปกติ
              </p>

              {/* URL Copy + Direct Install Row */}
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <div className="flex-1 min-w-[220px] h-8 px-2.5 rounded bg-[#090B10] border border-[#2A3347] flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono-tabular text-slate-300 truncate">
                    {currentUrl}
                  </span>
                  <ExternalLink className="w-3 h-3 text-slate-500 shrink-0" />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void handleCopyUrl();
                  }}
                  className="h-8 px-3 rounded bg-[#1B2333] hover:bg-[#242F44] border border-[#32405B] text-xs font-semibold text-cyan-300 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-300">คัดลอกลิงก์แล้ว</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>คัดลอก URL แอป</span>
                    </>
                  )}
                </button>
                {isInstallable && (
                  <button
                    type="button"
                    onClick={() => {
                      void install().then((ok) => {
                        if (ok) onClose();
                      });
                    }}
                    className="h-8 px-3 rounded bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>ติดตั้งแอปทันที</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Chrome & iOS Safari Two-Column Guide */}
          <div className="grid grid-cols-2 gap-3">
            {/* Chrome (Android & Desktop) */}
            <div
              className={`rounded-lg border p-3.5 bg-[#0D1018] flex flex-col gap-2.5 ${
                !isIOS ? 'border-cyan-500/45' : 'border-[#242B3B]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Chrome className="w-4 h-4 text-cyan-400 shrink-0" />
                  <h3 className="text-xs font-bold text-white">
                    Google Chrome (Android / PC)
                  </h3>
                </div>
                <span className="text-[10px] font-mono-tabular text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 px-1.5 py-0.5 rounded">
                  WebAPK
                </span>
              </div>

              <ol className="text-xs text-slate-300 space-y-2 leading-relaxed list-decimal list-inside">
                <li>
                  เปิดลิงก์แอปโดยตรงใน <strong>Google Chrome โหมดปกติ</strong> (ไม่ใช้แท็บไม่ระบุตัวตน)
                </li>
                <li>
                  แตะปุ่มเมนู <strong>⋮</strong> มุมขวาบนบนมือถือ (หรือไอคอน{' '}
                  <strong>ติดตั้ง (Install)</strong> บนแถบ URL ของ PC)
                </li>
                <li>
                  เลือก <strong>เพิ่มลงในหน้าจอหลัก (Add to Home screen)</strong> →{' '}
                  <strong>ติดตั้งแอป (Install app)</strong>
                </li>
              </ol>

              <div className="mt-auto pt-2 border-t border-[#1D2434] text-[11px] text-slate-400 leading-relaxed space-y-1">
                <div>
                  <strong className="text-slate-300">หากขึ้นไอคอน [R] หรือ "ติดตั้งแอปนี้ไม่ได้":</strong>{' '}
                  ลิงก์ <code className="text-amber-300">ais-dev-...</code> มีการล็อกอินบัญชี Google กั้นอยู่ ทำให้ตัวสร้างแพ็กเกจแอป (WebAPK) ของ Google ดึงไอคอนไม่ผ่าน แนะนำให้กด <strong>Share / Publish</strong> แอปใน AI Studio เพื่อติดตั้งผ่านลิงก์สาธารณะ <code className="text-emerald-300">ais-pre-...</code> แทนครับ
                </div>
                <div>
                  <strong className="text-slate-300">หากขึ้นแค่ "ทางลัด" ในรอบที่ 2:</strong>{' '}
                  เช็กใน <em>Settings → Apps</em> ว่าลบแอปเดิมออกแล้ว จากนั้นแตะไอคอนข้าง URL →{' '}
                  <em>Site settings → Clear &amp; reset</em> แล้วรีเฟรชหน้าเว็บ 1 ครั้ง
                </div>
              </div>
            </div>

            {/* iOS Safari */}
            <div
              className={`rounded-lg border p-3.5 bg-[#0D1018] flex flex-col gap-2.5 ${
                isIOS ? 'border-cyan-500/45' : 'border-[#242B3B]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-rose-400 shrink-0" />
                  <h3 className="text-xs font-bold text-white">
                    Safari (iPhone / iPad — iOS)
                  </h3>
                </div>
                <span className="text-[10px] font-mono-tabular text-rose-300 bg-rose-500/10 border border-rose-500/30 px-1.5 py-0.5 rounded">
                  iOS PWA
                </span>
              </div>

              <ol className="text-xs text-slate-300 space-y-2 leading-relaxed list-decimal list-inside">
                <li>
                  เปิดลิงก์แอปโดยตรงในแอป <strong>Safari</strong> (บน iOS หากเปิดจาก iframe หรือเบราว์เซอร์อื่นจะไม่สามารถติดตั้งได้)
                </li>
                <li>
                  แตะปุ่ม{' '}
                  <span className="inline-flex items-center gap-1 text-white font-semibold">
                    <Share className="w-3 h-3 text-cyan-400" /> แชร์ (Share)
                  </span>{' '}
                  ที่แถบเครื่องมือด้านล่าง (หรือมุมขวาบนบน iPad)
                </li>
                <li>
                  เลื่อนรายการลงมาแล้วเลือก{' '}
                  <strong>เพิ่มไปยังหน้าจอโฮม (Add to Home Screen)</strong> จากนั้นกด{' '}
                  <strong>เพิ่ม (Add)</strong>
                </li>
              </ol>

              <div className="mt-auto pt-2 border-t border-[#1D2434] text-[11px] text-slate-400 leading-relaxed">
                <strong className="text-slate-300">หมายเหตุ iOS:</strong>{' '}
                แอปที่ติดตั้งจากหน้าจอโฮมจะเปิดแบบเต็มจอไม่มีแถบ URL และสามารถกดปุ่มหมุนแนวตั้ง/แนวนอนในแถบด้านบนได้ทันที
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#242B3B] bg-[#0D1018] flex items-center justify-between gap-3 shrink-0 rounded-b-xl">
          <span className="text-[11px] text-slate-400">
            หมายเหตุ: การเชื่อมต่อสายจูน K-Line ผ่าน USB Web Serial รองรับบน Android / PC ผ่าน Chrome
          </span>
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-4 rounded-md bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            เข้าใจแล้ว / ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
