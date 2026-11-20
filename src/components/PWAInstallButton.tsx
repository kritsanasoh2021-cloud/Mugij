import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => {
          void install();
        }}
        className="h-8 px-2.5 rounded-md bg-emerald-600/20 hover:bg-emerald-600/35 border border-emerald-500/50 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        title="ติดตั้ง Honda PGM-FI ECU Studio ลงหน้าจอมือถือ / พีซี"
      >
        <Download className="w-3.5 h-3.5" />
        <span>ติดตั้งแอป</span>
      </button>
    );
  }

  if (isIOS || isAndroid) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className="h-8 px-2.5 rounded-md bg-[#171C28] hover:bg-[#1F2636] border border-[#2B3346] text-emerald-300 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          title="วิธีติดตั้งแอปลงหน้าจอมือถือ"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>ติดตั้งลงมือถือ</span>
        </button>

        {showGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-sm rounded-xl bg-[#11151E] border border-[#2A3347] p-5 shadow-2xl">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="text-sm font-bold text-white">
                  {isIOS ? 'ติดตั้งลง iPhone / iPad' : 'ติดตั้งลงมือถือ Android'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  className="p-1 rounded hover:bg-[#1A202E] text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {isIOS ? (
                <p className="text-xs text-slate-300 leading-relaxed">
                  1. เปิดหน้านี้ใน <strong>Safari</strong> (หากอยู่ในหน้า Preview ให้เปิด URL แอปโดยตรง)
                  <br />
                  2. กดปุ่ม <strong>แชร์ (Share)</strong> ด้านล่างหรือด้านบน
                  <br />
                  3. เลือก <strong>เพิ่มไปยังหน้าจอโฮม (Add to Home Screen)</strong>
                </p>
              ) : (
                <p className="text-xs text-slate-300 leading-relaxed">
                  1. เปิด Shared App URL ใน <strong>Google Chrome</strong> บน Android
                  <br />
                  2. กดปุ่มเมนู <strong>⋮</strong> มุมขวาบน
                  <br />
                  3. เลือก <strong>ติดตั้งแอป (Install app)</strong> หรือ <strong>เพิ่มลงหน้าจอหลัก</strong> เพื่อเปิดเต็มจอและใช้งานออฟไลน์ได้ทันที
                </p>
              )}
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="mt-4 w-full h-8 rounded-md bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
