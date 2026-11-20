import { MapColorScheme } from '../types/ecu';

interface ColorStop {
  t: number;
  r: number;
  g: number;
  b: number;
}

const FUEL_STOPS: ColorStop[] = [
  { t: 0.0, r: 29, g: 78, b: 216 },   // Deep Blue (Low Fuel / Lean)
  { t: 0.25, r: 6, g: 182, b: 212 },  // Cyan
  { t: 0.5, r: 16, g: 185, b: 129 },  // Emerald
  { t: 0.72, r: 234, g: 179, b: 8 },  // Yellow
  { t: 0.88, r: 249, g: 115, b: 22 }, // Orange
  { t: 1.0, r: 225, g: 29, b: 72 },   // Crimson (Max Fuel / Rich)
];

const IGNITION_STOPS: ColorStop[] = [
  { t: 0.0, r: 30, g: 58, b: 138 },   // Retard Navy
  { t: 0.28, r: 14, g: 165, b: 233 }, // Sky
  { t: 0.55, r: 16, g: 185, b: 129 }, // Emerald
  { t: 0.8, r: 245, g: 158, b: 11 },  // Amber
  { t: 1.0, r: 239, g: 68, b: 68 },   // High Advance Red
];

const AFR_STOPS: ColorStop[] = [
  { t: 0.0, r: 225, g: 29, b: 72 },   // Rich (10.5 - 11.8)
  { t: 0.35, r: 245, g: 158, b: 11 }, // Power Rich (12.5)
  { t: 0.6, r: 16, g: 185, b: 129 },  // Optimal (13.2 - 14.2)
  { t: 0.85, r: 6, g: 182, b: 212 },  // Stoich / Cruise (14.7)
  { t: 1.0, r: 59, g: 130, b: 246 },  // Lean (15.5+)
];

function interpolateStops(stops: ColorStop[], t: number): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (clamped >= a.t && clamped <= b.t) {
      const localT = (clamped - a.t) / Math.max(1e-6, b.t - a.t);
      return [
        Math.round(a.r + (b.r - a.r) * localT),
        Math.round(a.g + (b.g - a.g) * localT),
        Math.round(a.b + (b.b - a.b) * localT),
      ];
    }
  }
  const last = stops[stops.length - 1];
  return [last.r, last.g, last.b];
}

export function getCalibrationColor(
  value: number,
  minVal: number,
  maxVal: number,
  scheme: MapColorScheme,
  alpha = 1
): string {
  const range = Math.max(1e-6, maxVal - minVal);
  const t = (value - minVal) / range;
  const stops =
    scheme === 'ignition'
      ? IGNITION_STOPS
      : scheme === 'afr'
      ? AFR_STOPS
      : FUEL_STOPS;
  const [r, g, b] = interpolateStops(stops, t);
  return alpha < 1 ? `rgba(${r}, ${g}, ${b}, ${alpha})` : `rgb(${r}, ${g}, ${b})`;
}

export function getSchemeGradientCss(scheme: MapColorScheme): string {
  const stops =
    scheme === 'ignition'
      ? IGNITION_STOPS
      : scheme === 'afr'
      ? AFR_STOPS
      : FUEL_STOPS;
  const cssStops = stops
    .map((s) => `rgb(${s.r}, ${s.g}, ${s.b}) ${Math.round(s.t * 100)}%`)
    .join(', ');
  return `linear-gradient(90deg, ${cssStops})`;
}

export function getSchemeScaleLabels(scheme: MapColorScheme): {
  lowLabel: string;
  midLabel: string;
  highLabel: string;
} {
  if (scheme === 'ignition') {
    return {
      lowLabel: 'ไฟอ่อน (Retard)',
      midLabel: 'องศาไฟปานกลาง',
      highLabel: 'ไฟแก่ (Advance)',
    };
  }
  if (scheme === 'afr') {
    return {
      lowLabel: 'หนา (Rich)',
      midLabel: 'กำลังพอดี (13.0–14.2)',
      highLabel: 'บาง (Lean)',
    };
  }
  return {
    lowLabel: 'จ่ายน้อย / บาง',
    midLabel: 'จ่ายปานกลาง',
    highLabel: 'จ่ายมาก / หนา',
  };
}
