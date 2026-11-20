import {
  ChecksumAlgorithm,
  MapColorScheme,
  XdfAxis,
  XdfChecksumRegion,
  XdfConstant,
  XdfDefinition,
  XdfFlag,
  XdfTable,
} from '../types/ecu';
import { readUintFromBuffer, writeUintToBuffer } from './checksumEngine';

function normalizeEquationVar(equation: string, varId?: string | null): string {
  let eq = (equation || 'X').trim();
  if (!eq) return 'X';
  if (varId && varId.trim() && varId.trim().toUpperCase() !== 'X') {
    const escaped = varId.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    eq = eq.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), 'X');
  }
  return eq;
}

function evaluateXdfEquationInternal(equation: string, rawX: number): number {
  const expr = (equation || 'X').trim().replace(/\s+/g, '');
  if (!expr || expr.toUpperCase() === 'X') return rawX;

  let pos = 0;

  function parseExpression(): number {
    let val = parseTerm();
    while (pos < expr.length && (expr[pos] === '+' || expr[pos] === '-')) {
      const op = expr[pos++];
      const rhs = parseTerm();
      val = op === '+' ? val + rhs : val - rhs;
    }
    return val;
  }

  function parseTerm(): number {
    let val = parsePower();
    while (pos < expr.length && (expr[pos] === '*' || expr[pos] === '/')) {
      const op = expr[pos++];
      const rhs = parsePower();
      if (op === '*') {
        val *= rhs;
      } else {
        if (rhs === 0) return Number.NaN;
        val = val / rhs;
      }
    }
    return val;
  }

  function parsePower(): number {
    let val = parseFactor();
    if (pos < expr.length && expr[pos] === '^') {
      pos++;
      const exp = parseFactor();
      val = Math.pow(val, exp);
    }
    return val;
  }

  function parseFactor(): number {
    if (pos < expr.length && expr[pos] === '-') {
      pos++;
      return -parseFactor();
    }
    if (pos < expr.length && expr[pos] === '+') {
      pos++;
      return parseFactor();
    }
    if (pos < expr.length && expr[pos] === '(') {
      pos++;
      const val = parseExpression();
      if (expr[pos] === ')') pos++;
      return val;
    }
    if (pos < expr.length && (expr[pos] === 'X' || expr[pos] === 'x')) {
      pos++;
      return rawX;
    }
    // Hex literals e.g. 0xFF
    if (expr.slice(pos, pos + 2).toLowerCase() === '0x') {
      const start = pos;
      pos += 2;
      while (pos < expr.length && /[0-9a-fA-F]/.test(expr[pos])) {
        pos++;
      }
      const hexVal = parseInt(expr.slice(start, pos), 16);
      return Number.isNaN(hexVal) ? 0 : hexVal;
    }
    const start = pos;
    while (pos < expr.length && /[0-9.]/.test(expr[pos])) {
      pos++;
    }
    // Optional scientific notation exponent e.g. 1.5e-3 or 2E+4
    if (
      pos > start &&
      pos < expr.length &&
      (expr[pos] === 'e' || expr[pos] === 'E') &&
      /[0-9+-]/.test(expr[pos + 1] || '')
    ) {
      pos++;
      if (expr[pos] === '+' || expr[pos] === '-') pos++;
      while (pos < expr.length && /[0-9]/.test(expr[pos])) {
        pos++;
      }
    }
    if (start === pos) return 0;
    const num = parseFloat(expr.slice(start, pos));
    return Number.isNaN(num) ? 0 : num;
  }

  try {
    return parseExpression();
  } catch {
    return rawX;
  }
}

// Safe recursive-descent math expression evaluator for TunerPro <MATH equation="...">
export function evaluateXdfEquation(equation: string, rawX: number): number {
  const result = evaluateXdfEquationInternal(equation, rawX);
  return Number.isFinite(result) ? result : 0;
}

// Inverse solver: given target engineered value, compute closest raw value
export function solveInverseXdfEquation(
  equation: string,
  targetVal: number,
  bits: 8 | 16 | 32,
  signed: boolean,
  isFloat = false
): number {
  if (isFloat) {
    const y0 = evaluateXdfEquationInternal(equation, 0);
    const y1 = evaluateXdfEquationInternal(equation, 1000);
    if (Number.isFinite(y0) && Number.isFinite(y1) && Math.abs(y1 - y0) > 1e-12) {
      const slope = (y1 - y0) / 1000;
      return (targetVal - y0) / slope;
    }
    return targetVal;
  }

  const maxUnsigned = bits === 8 ? 0xff : bits === 16 ? 0xffff : 0xffffffff;
  const minBound = signed ? -(1 << (bits - 1)) : 0;
  const maxBound = signed ? (1 << (bits - 1)) - 1 : maxUnsigned;
  const clampRaw = (v: number) => Math.max(minBound, Math.min(maxBound, Math.round(v)));

  // Pick safe sample points (avoid division-by-zero singularity at x = 0)
  const y0 = evaluateXdfEquationInternal(equation, 0);
  const s1 = Number.isFinite(y0) ? 0 : 1;
  const s2 = s1 + 1000;
  const ys1 = evaluateXdfEquationInternal(equation, s1);
  const ys2 = evaluateXdfEquationInternal(equation, s2);
  const slope =
    Number.isFinite(ys1) && Number.isFinite(ys2) ? (ys2 - ys1) / (s2 - s1) : Number.NaN;

  let bestRaw = clampRaw(
    Number.isFinite(slope) && Math.abs(slope) > 1e-12
      ? s1 + (targetVal - ys1) / slope
      : targetVal
  );
  let bestErr = Math.abs(evaluateXdfEquationInternal(equation, bestRaw) - targetVal);
  if (!Number.isFinite(bestErr)) bestErr = Infinity;

  // Handle non-linear / inverse equations like 15000000/X via monotonic search
  if (bestErr > 1e-3) {
    const scanRange = (loStart: number, hiEnd: number) => {
      let lo = loStart;
      let hi = hiEnd;
      const fLo = evaluateXdfEquationInternal(equation, lo);
      const fHi = evaluateXdfEquationInternal(equation, hi);
      if (!Number.isFinite(fLo) || !Number.isFinite(fHi)) return;
      const inc = fHi >= fLo;
      for (let iter = 0; iter < 40 && lo <= hi; iter++) {
        const mid = Math.floor((lo + hi) / 2);
        const fMid = evaluateXdfEquationInternal(equation, mid);
        if (!Number.isFinite(fMid)) break;
        const err = Math.abs(fMid - targetVal);
        if (err < bestErr) {
          bestErr = err;
          bestRaw = mid;
        }
        if ((inc && fMid < targetVal) || (!inc && fMid > targetVal)) {
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
    };

    if (signed && minBound < 0) {
      scanRange(minBound, -1);
      scanRange(1, maxBound);
    } else {
      scanRange(Math.max(1, minBound), maxBound);
    }
  }

  // Refine local neighborhood around best candidate
  const center = bestRaw;
  for (let delta = -4; delta <= 4; delta++) {
    const candidate = clampRaw(center + delta);
    const val = evaluateXdfEquationInternal(equation, candidate);
    if (!Number.isFinite(val)) continue;
    const err = Math.abs(val - targetVal);
    if (err < bestErr) {
      bestErr = err;
      bestRaw = candidate;
    }
  }

  return clampRaw(bestRaw);
}

function toSigned(val: number, bits: 8 | 16 | 32): number {
  if (bits === 8) return val & 0x80 ? val - 0x100 : val;
  if (bits === 16) return val & 0x8000 ? val - 0x10000 : val;
  return val | 0;
}

function fromSigned(val: number, bits: 8 | 16 | 32): number {
  if (bits === 8) return val & 0xff;
  if (bits === 16) return val & 0xffff;
  return val >>> 0;
}

function readFloat32FromBuffer(bytes: Uint8Array, address: number, lsbFirst: boolean): number {
  if (address < 0 || address + 4 > bytes.length) return 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset + address, 4);
  const val = view.getFloat32(0, lsbFirst);
  return Number.isFinite(val) ? val : 0;
}

function writeFloat32ToBuffer(
  bytes: Uint8Array,
  address: number,
  val: number,
  lsbFirst: boolean
): void {
  if (address < 0 || address + 4 > bytes.length) return;
  const view = new DataView(bytes.buffer, bytes.byteOffset + address, 4);
  view.setFloat32(0, val, lsbFirst);
}

function parseDecimalInt(str: string | null | undefined, fallback = 0): number {
  if (!str) return fallback;
  const trimmed = str.trim();
  if (!trimmed) return fallback;
  if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
    const v = parseInt(trimmed, 16);
    return Number.isNaN(v) ? fallback : v;
  }
  const v = parseInt(trimmed, 10);
  return Number.isNaN(v) ? fallback : v;
}

function parseHexOrInt(str: string | null | undefined, fallback = 0): number {
  if (!str) return fallback;
  const trimmed = str.trim();
  if (!trimmed) return fallback;
  if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
    const v = parseInt(trimmed, 16);
    return Number.isNaN(v) ? fallback : v;
  }
  if (/^-?[0-9]*[a-fA-F][0-9a-fA-F]*$/.test(trimmed)) {
    const v = parseInt(trimmed, 16);
    return Number.isNaN(v) ? fallback : v;
  }
  const v = parseInt(trimmed, 10);
  return Number.isNaN(v) ? fallback : v;
}

function buildUniqueIdKeys(rawUid: string): string[] {
  const clean = rawUid.trim().toLowerCase();
  if (!clean) return [];
  const keys = [clean];
  if (/^(?:0x)?[0-9a-f]+$/.test(clean)) {
    const parsed = parseInt(clean.replace(/^0x/, ''), 16);
    if (!Number.isNaN(parsed)) {
      keys.push(`hex:${parsed.toString(16)}`);
    }
  }
  return keys;
}

function inferTableCategoryAndColor(title: string): {
  category: XdfTable['category'];
  colorScheme: MapColorScheme;
} {
  const lower = title.toLowerCase();
  if (lower.includes('limit') || lower.includes('rev') || lower.includes('cut') || lower.includes('ตัด')) {
    return { category: 'limiter', colorScheme: 'generic' };
  }
  if (lower.includes('tps (') || lower.includes('rpm (') || lower.includes('model code')) {
    return { category: 'other', colorScheme: 'generic' };
  }
  if (lower.includes('afr') || lower.includes('lambda')) {
    return { category: 'afr', colorScheme: 'afr' };
  }
  if (lower.includes('o2')) {
    return { category: 'other', colorScheme: 'afr' };
  }
  if (
    lower.includes('ign') ||
    lower.includes('timing') ||
    lower.includes('spark') ||
    lower.includes('advance') ||
    lower.includes('soi') ||
    lower.includes('ไฟ')
  ) {
    return { category: 'ignition', colorScheme: 'ignition' };
  }
  if (
    lower.includes('fuel') ||
    lower.includes('inj') ||
    lower.includes('ve ') ||
    lower.includes('น้ำมัน')
  ) {
    return { category: 'fuel', colorScheme: 'fuel' };
  }
  return { category: 'other', colorScheme: 'generic' };
}

export function decodeXdfBuffer(bytes: Uint8Array): string {
  if (bytes.length >= 4) {
    if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
      throw new Error('ไฟล์นี้ถูกบีบอัดแบบ ZIP (PK) กรุณาแตกไฟล์ให้เป็นไฟล์ .xdf ก่อนนำเข้า');
    }
    if (bytes[0] === 0x52 && bytes[1] === 0x61 && bytes[2] === 0x72 && bytes[3] === 0x21) {
      throw new Error('ไฟล์นี้ถูกบีบอัดแบบ RAR กรุณาแตกไฟล์ให้เป็นไฟล์ .xdf ก่อนนำเข้า');
    }
  }

  if (bytes.length >= 2) {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) {
      return new TextDecoder('utf-16le').decode(bytes).replace(/^\uFEFF/, '');
    }
    if (bytes[0] === 0xfe && bytes[1] === 0xff) {
      return new TextDecoder('utf-16be').decode(bytes).replace(/^\uFEFF/, '');
    }
  }
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
  }

  // Detect UTF-16LE / UTF-16BE without BOM (common when exported from Windows tools)
  const sampleLen = Math.min(bytes.length, 256);
  if (sampleLen >= 8) {
    let oddZeros = 0;
    let evenZeros = 0;
    const pairs = Math.floor(sampleLen / 2);
    for (let i = 0; i < pairs * 2; i += 2) {
      if (bytes[i] === 0) evenZeros++;
      if (bytes[i + 1] === 0) oddZeros++;
    }
    if (oddZeros / pairs > 0.35 && evenZeros / pairs < 0.1) {
      return new TextDecoder('utf-16le').decode(bytes).replace(/^\uFEFF/, '');
    }
    if (evenZeros / pairs > 0.35 && oddZeros / pairs < 0.1) {
      return new TextDecoder('utf-16be').decode(bytes).replace(/^\uFEFF/, '');
    }
  }

  // Peek ASCII header for explicit encoding declaration
  const headAscii = Array.from(bytes.slice(0, 512))
    .map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : ' '))
    .join('')
    .toLowerCase();
  const encMatch = headAscii.match(/encoding=["']([a-z0-9_-]+)["']/i);
  if (encMatch) {
    const declared = encMatch[1].toLowerCase();
    const mapped =
      declared === 'tis-620' || declared === 'iso-8859-11' ? 'windows-874' : declared;
    // Only trust explicit non-Latin1/non-UTF8 encoding directly; Latin-1 headers on Thai Windows-874 files would corrupt Thai chars
    if (
      mapped !== 'utf-8' &&
      mapped !== 'utf8' &&
      mapped !== 'iso-8859-1' &&
      mapped !== 'windows-1252'
    ) {
      try {
        return new TextDecoder(mapped).decode(bytes);
      } catch {
        // Continue to standard probing
      }
    }
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    for (const enc of ['windows-874', 'iso-8859-11', 'windows-1252', 'shift_jis']) {
      try {
        return new TextDecoder(enc).decode(bytes);
      } catch {
        continue;
      }
    }
    return new TextDecoder('utf-8').decode(bytes);
  }
}

async function tryDecompressStream(
  bytes: Uint8Array,
  format: 'gzip' | 'deflate' | 'deflate-raw'
): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === 'undefined') return null;
  try {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const ds = new DecompressionStream(format);
    const stream = new Blob([copy.buffer]).stream().pipeThrough(ds);
    const buf = await new Response(stream).arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

export async function decodeXdfBufferAsync(bytes: Uint8Array): Promise<string> {
  // Handle gzip (1F 8B) or zlib/deflate (78 9C / 78 DA / 78 01) wrapped XDF files (at offset 0 or after a short binary header)
  const scanLimit = Math.min(bytes.length - 2, 64);
  for (let off = 0; off <= scanLimit; off++) {
    if (bytes[off] === 0x1f && bytes[off + 1] === 0x8b && bytes[off + 2] === 0x08) {
      const unpacked = await tryDecompressStream(bytes.subarray(off), 'gzip');
      if (unpacked && unpacked.length > 0) return decodeXdfBuffer(unpacked);
    }
    if (
      bytes[off] === 0x78 &&
      (bytes[off + 1] === 0x9c || bytes[off + 1] === 0xda || bytes[off + 1] === 0x01)
    ) {
      const slice = bytes.subarray(off);
      const unpacked =
        (await tryDecompressStream(slice, 'deflate')) ||
        (await tryDecompressStream(slice, 'deflate-raw'));
      if (unpacked && unpacked.length > 0) return decodeXdfBuffer(unpacked);
    }
  }

  let decoded = decodeXdfBuffer(bytes);

  // Support Base64-wrapped XDF payloads if encountered
  const trimmed = decoded.trim();
  if (
    trimmed.length > 40 &&
    !trimmed.includes('<') &&
    !/^XDF\r?\n/i.test(trimmed) &&
    /^[A-Za-z0-9+/=\r\n]+$/.test(trimmed)
  ) {
    try {
      const binStr = atob(trimmed.replace(/\s+/g, ''));
      const raw = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) raw[i] = binStr.charCodeAt(i);
      const inner = await decodeXdfBufferAsync(raw);
      if (inner.includes('<') || /%%HEADER%%|%%TABLE%%/i.test(inner)) {
        decoded = inner;
      }
    } catch {
      // Not valid Base64 XML
    }
  }

  return decoded;
}

function escapeXmlText(text: string): string {
  return text
    .replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/gi, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const KNOWN_XDF_TAGS_UPPER = new Set([
  'XDFFORMAT',
  'XDFHEADER',
  'DEFAULTS',
  'BASEOFFSET',
  'REGION',
  'CATEGORY',
  'CATEGORYMEM',
  'XDFTABLE',
  'XDFAXIS',
  'XDFFUNCTION',
  'XDFCONSTANT',
  'XDFFLAG',
  'XDFSWITCH',
  'XDFPATCH',
  'XDFPATCHENTRY',
  'XDFCHECKSUM',
  'EMBEDDEDDATA',
  'MATH',
  'VAR',
  'LABEL',
  'DALINK',
]);

const KNOWN_XDF_TAGS_LOWER = new Set([
  'flags',
  'fileversion',
  'deftitle',
  'description',
  'author',
  'baseoffset',
  'password',
  'editpassword',
  'passhash',
  'readonly',
  'title',
  'units',
  'decimalpl',
  'min',
  'max',
  'indexcount',
  'outputtype',
  'datatype',
  'unittype',
  'rangehigh',
  'rangelow',
  'mask',
  'embedinfo',
]);

function sanitizeXdfXmlString(rawText: string): string {
  let cleaned = rawText
    .replace(/^\uFEFF/, '')
    // Strip invalid XML control characters (keep tab, LF, CR)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '');

  // Trim any preamble junk before <?xml or <XDFFORMAT / <XDFHEADER / <XDFTABLE / <XDFCONSTANT
  const startMatch = cleaned.match(
    /(<\?xml\b|<XDFFORMAT\b|<XDFHEADER\b|<XDFTABLE\b|<XDFCONSTANT\b|<XDFFLAG\b|<XDFFUNCTION\b)/i
  );
  if (startMatch && startMatch.index !== undefined && startMatch.index > 0) {
    cleaned = cleaned.slice(startMatch.index);
  }

  // Trim trailing junk after closing </XDFFORMAT> if present
  const endMatch = cleaned.match(/<\/XDFFORMAT\s*>/i);
  if (endMatch && endMatch.index !== undefined) {
    cleaned = cleaned.slice(0, endMatch.index + endMatch[0].length);
  }

  // Normalize declared encoding to UTF-8 since string is already decoded
  cleaned = cleaned.replace(/(<\?xml[^>]*\bencoding=["'])[^"']+(["'])/i, '$1UTF-8$2');

  // Protect <![CDATA[...]]> sections before XML repair by unwrapping into safely escaped text
  cleaned = cleaned.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, body: string) =>
    escapeXmlText(body)
  );

  // Fix invalid '--' inside XML comments <!-- ... -->
  cleaned = cleaned.replace(/<!--([\s\S]*?)-->/g, (_, body: string) => {
    const safeBody = body.replace(/--+/g, '-').replace(/^-+|-+$/g, '');
    return `<!-- ${safeBody} -->`;
  });

  // Escape bare '&' not belonging to a valid XML entity reference
  cleaned = cleaned.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/gi, '&amp;');

  // Escape unescaped '<' or '>' inside double- or single-quoted XML attributes
  cleaned = cleaned.replace(/(\b[a-zA-Z0-9_:-]+\s*=\s*")([^"]*)(")/g, (_, pre, val, post) => {
    const safeVal = String(val).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `${pre}${safeVal}${post}`;
  });
  cleaned = cleaned.replace(/(\b[a-zA-Z0-9_:-]+\s*=\s*')([^']*)(')/g, (_, pre, val, post) => {
    const safeVal = String(val).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `${pre}${safeVal}${post}`;
  });

  // Escape unescaped '<' inside leaf text nodes like <title>, <description>, <deftitle>, <author>, <units>, <password>
  cleaned = cleaned.replace(
    /<(title|description|deftitle|author|units|password|editpassword|passhash)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi,
    (_, tag: string, attrs: string, inner: string) => {
      const lowerTag = tag.toLowerCase();
      const safeInner = inner.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<${lowerTag}${attrs}>${safeInner}</${lowerTag}>`;
    }
  );

  // Normalize case of known XDF tags so mismatched open/close casing (<XdfTable>...</XDFTABLE>) parses in XML
  cleaned = cleaned.replace(/<(\/?)([A-Za-z][A-Za-z0-9_-]*)([\s>/])/g, (full, slash, name, tail) => {
    const upper = name.toUpperCase();
    if (KNOWN_XDF_TAGS_UPPER.has(upper)) {
      return `<${slash}${upper}${tail}`;
    }
    const lower = name.toLowerCase();
    if (KNOWN_XDF_TAGS_LOWER.has(lower)) {
      return `<${slash}${lower}${tail}`;
    }
    return full;
  });

  // Wrap rootless XML snippets in <XDFFORMAT>
  if (!/<XDFFORMAT\b/i.test(cleaned) && /<(?:XDFHEADER|XDFTABLE|XDFCONSTANT|XDFFLAG|XDFFUNCTION)\b/i.test(cleaned)) {
    const xmlDeclMatch = cleaned.match(/^<\?xml[^>]*\?>\s*/i);
    if (xmlDeclMatch) {
      cleaned =
        xmlDeclMatch[0] +
        `<XDFFORMAT version="1.70">\n` +
        cleaned.slice(xmlDeclMatch[0].length) +
        `\n</XDFFORMAT>`;
    } else {
      cleaned = `<XDFFORMAT version="1.70">\n${cleaned}\n</XDFFORMAT>`;
    }
  }

  return cleaned;
}

// Expand XML self-closing tags before HTML5 fallback parsing (HTML5 ignores '/>' on custom tags)
function expandSelfClosingTagsForHtml(xml: string): string {
  return xml
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<([A-Za-z][A-Za-z0-9:_-]*)(\s[^>]*?)?\s*\/>/g, '<$1$2></$1>');
}

function getDirectChildByTag(parent: Element | null | undefined, tagName: string): Element | undefined {
  if (!parent) return undefined;
  const target = tagName.toLowerCase();
  return Array.from(parent.children).find((el) => el.tagName.toLowerCase() === target);
}

function getDirectChildrenByTag(parent: Element | null | undefined, tagName: string): Element[] {
  if (!parent) return [];
  const target = tagName.toLowerCase();
  return Array.from(parent.children).filter((el) => el.tagName.toLowerCase() === target);
}

function cleanLegacyEquation(rawEq: string): string {
  if (!rawEq) return 'X';
  const beforeMeta = rawEq.split(',')[0].trim();
  return beforeMeta || 'X';
}

function isLegacyTextXdf(text: string): boolean {
  const trimmed = text.replace(/^\uFEFF/, '').trimStart();
  return (
    /^XDF\r?\n/i.test(trimmed) ||
    /%%HEADER%%/i.test(trimmed) ||
    /%%TABLE%%/i.test(trimmed) ||
    /%%CONSTANT%%/i.test(trimmed)
  );
}

function parseLegacyTextXdf(rawText: string): XdfDefinition {
  const lines = rawText.replace(/\r\n/g, '\n').split('\n');
  let title = 'Custom Honda Legacy XDF';
  let author = 'TunerPro User';
  let baseOffset = 0;

  const tables: XdfTable[] = [];
  const constants: XdfConstant[] = [];
  const flags: XdfFlag[] = [];
  const checksums: XdfChecksumRegion[] = [];

  type BlockType = 'HEADER' | 'TABLE' | 'CONSTANT' | 'FLAG' | 'PATCH' | 'CHECKSUM' | null;
  let currentBlock: BlockType = null;
  let props: Record<string, string> = {};

  const stripQuotes = (v: string) => v.trim().replace(/^"(.*)"$/, '$1');

  const flushBlock = (blockType: BlockType, p: Record<string, string>) => {
    if (blockType === 'HEADER') {
      if (p.deftitle) title = stripQuotes(p.deftitle);
      if (p.author) author = stripQuotes(p.author);
      if (p.baseoffset) baseOffset = parseHexOrInt(p.baseoffset, 0);
      return;
    }

    if (blockType === 'TABLE') {
      const tTitle = stripQuotes(p.title || '') || `Table ${tables.length + 1}`;
      const tDesc = stripQuotes(p.desc || p.description || '');
      const { category, colorScheme } = inferTableCategoryAndColor(tTitle);
      const addr = parseHexOrInt(p.address, 0) + baseOffset;
      const bitsRaw = parseHexOrInt(p.sizeinbits, 8);
      const bits: 8 | 16 | 32 = bitsRaw === 32 ? 32 : bitsRaw === 16 ? 16 : 8;
      const tFlags = parseHexOrInt(p.flags, 0);
      const signed = (tFlags & 0x01) !== 0;
      const lsbFirst = (tFlags & 0x02) !== 0;
      const popByCol = parseHexOrInt(p.popbycol, 0) !== 0;
      const rows = Math.max(1, parseHexOrInt(p.rows, 1));
      const cols = Math.max(1, parseHexOrInt(p.cols, 1));
      const dp = parseHexOrInt(p.decimalpl, 1);
      const eq = cleanLegacyEquation(p.equation || p.zeq || 'X');
      const zUnits = stripQuotes(p.zunits || '');
      const xUnits = stripQuotes(p.xunits || 'RPM');
      const yUnits = stripQuotes(p.yunits || 'TPS %');

      const parseLabels = (rawLbl: string | undefined, count: number, step: number): number[] => {
        const list: number[] = [];
        if (rawLbl) {
          rawLbl.split(/[,;\s]+/).forEach((tok) => {
            const num = parseFloat(stripQuotes(tok));
            if (!Number.isNaN(num)) list.push(num);
          });
        }
        while (list.length < count) {
          list.push((list.length + 1) * step);
        }
        return list.slice(0, count);
      };

      const xAxis: XdfAxis = {
        id: 'x',
        units: xUnits,
        count: cols,
        decimalPlaces: parseHexOrInt(p.xdecimalpl, 0),
        address: p.xaddress ? parseHexOrInt(p.xaddress, 0) + baseOffset : undefined,
        elementSizeBits: p.xsizeinbits ? (parseHexOrInt(p.xsizeinbits, 16) === 8 ? 8 : 16) : 16,
        signed: false,
        lsbFirst,
        equation: cleanLegacyEquation(p.xeq || 'X'),
        labels: parseLabels(p.xlabels, cols, 500),
      };

      const yAxis: XdfAxis = {
        id: 'y',
        units: yUnits,
        count: rows,
        decimalPlaces: parseHexOrInt(p.ydecimalpl, 0),
        address: p.yaddress ? parseHexOrInt(p.yaddress, 0) + baseOffset : undefined,
        elementSizeBits: p.ysizeinbits ? (parseHexOrInt(p.ysizeinbits, 8) === 16 ? 16 : 8) : 8,
        signed: false,
        lsbFirst,
        equation: cleanLegacyEquation(p.yeq || 'X'),
        labels: parseLabels(p.ylabels, rows, 10),
      };

      tables.push({
        id: stripQuotes(p.uniqueid || '') || `legacy-tbl-${tables.length}`,
        title: tTitle,
        description: tDesc,
        category,
        colorScheme,
        address: addr,
        rows,
        cols,
        elementSizeBits: bits,
        signed,
        lsbFirst,
        rowMajor: !popByCol,
        decimalPlaces: dp,
        equation: eq,
        units: zUnits,
        xAxis,
        yAxis,
        minLimit: p.rangelow ? parseFloat(p.rangelow) : undefined,
        maxLimit: p.rangehigh ? parseFloat(p.rangehigh) : undefined,
      });
      return;
    }

    if (blockType === 'CONSTANT') {
      const cTitle = stripQuotes(p.title || '') || `Constant ${constants.length + 1}`;
      const cDesc = stripQuotes(p.desc || p.description || '');
      const addr = parseHexOrInt(p.address, 0) + baseOffset;
      const bitsRaw = parseHexOrInt(p.sizeinbits, 16);
      const bits: 8 | 16 | 32 = bitsRaw === 32 ? 32 : bitsRaw === 16 ? 16 : 8;
      const cFlags = parseHexOrInt(p.flags, 0);
      const lower = cTitle.toLowerCase();
      const cat: XdfConstant['category'] =
        lower.includes('rev') || lower.includes('limit') || lower.includes('cut')
          ? 'limiter'
          : lower.includes('idle') || lower.includes('เดินเบา')
          ? 'idle'
          : lower.includes('inj') || lower.includes('fuel')
          ? 'fuel'
          : lower.includes('ign') || lower.includes('spark')
          ? 'ignition'
          : 'other';

      constants.push({
        id: stripQuotes(p.uniqueid || '') || `legacy-const-${constants.length}`,
        title: cTitle,
        description: cDesc,
        category: cat,
        address: addr,
        elementSizeBits: bits,
        signed: (cFlags & 0x01) !== 0,
        lsbFirst: (cFlags & 0x02) !== 0,
        decimalPlaces: parseHexOrInt(p.decimalpl, 0),
        equation: cleanLegacyEquation(p.equation || 'X'),
        units: stripQuotes(p.units || p.zunits || ''),
      });
      return;
    }

    if (blockType === 'FLAG') {
      const fTitle = stripQuotes(p.title || '') || `Flag ${flags.length + 1}`;
      const fDesc = stripQuotes(p.desc || p.description || '');
      const addr = parseHexOrInt(p.address, 0) + baseOffset;
      const mask = parseHexOrInt(p.mask, 1);
      let bitIndex = 0;
      for (let b = 0; b < 8; b++) {
        if ((mask & (1 << b)) !== 0) {
          bitIndex = b;
          break;
        }
      }
      flags.push({
        id: stripQuotes(p.uniqueid || '') || `legacy-flag-${flags.length}`,
        title: fTitle,
        description: fDesc,
        category: 'สวิตช์และแฟลก (Flags)',
        address: addr,
        bitIndex,
      });
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const upper = line.toUpperCase();
    if (upper === '%%HEADER%%') {
      currentBlock = 'HEADER';
      props = {};
      continue;
    }
    if (upper === '%%TABLE%%' || upper === '%%FUNCTION%%') {
      currentBlock = 'TABLE';
      props = {};
      continue;
    }
    if (upper === '%%CONSTANT%%' || upper === '%%SCALAR%%') {
      currentBlock = 'CONSTANT';
      props = {};
      continue;
    }
    if (upper === '%%FLAG%%' || upper === '%%BIT%%') {
      currentBlock = 'FLAG';
      props = {};
      continue;
    }
    if (upper === '%%PATCH%%') {
      currentBlock = 'PATCH';
      props = {};
      continue;
    }
    if (upper === '%%CHECKSUM%%') {
      currentBlock = 'CHECKSUM';
      props = {};
      continue;
    }
    if (upper === '%%END%%') {
      flushBlock(currentBlock, props);
      currentBlock = null;
      props = {};
      continue;
    }
    if (!currentBlock) continue;

    // Lines typically look like: "040005 Title ="Fuel 1"" or "Title = Fuel 1"
    const match = line.match(/^(?:[0-9A-Fa-f]{4,8}\s+)?([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (match) {
      props[match[1].toLowerCase()] = match[2];
    }
  }
  if (currentBlock) {
    flushBlock(currentBlock, props);
  }

  // Build normalized XML representation so IndexedDB storage & .XDF export stay consistent
  const synthesizedXml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<XDFFORMAT version="1.70">',
    '  <XDFHEADER>',
    `    <deftitle>${escapeXmlText(title)}</deftitle>`,
    `    <author>${escapeXmlText(author)}</author>`,
    `    <BASEOFFSET offset="${baseOffset}" subtract="0" />`,
    '  </XDFHEADER>',
    ...tables.map(
      (t) =>
        `  <XDFTABLE uniqueid="${escapeXmlText(t.id)}">\n` +
        `    <title>${escapeXmlText(t.title)}</title>\n` +
        `    <description>${escapeXmlText(t.description)}</description>\n` +
        `    <XDFAXIS id="x">\n` +
        `      <units>${escapeXmlText(t.xAxis.units)}</units>\n` +
        `      <indexcount>${t.cols}</indexcount>\n` +
        `      <decimalpl>${t.xAxis.decimalPlaces}</decimalpl>\n` +
        t.xAxis.labels.map((v, i) => `      <LABEL index="${i}" value="${v}" />`).join('\n') +
        `\n    </XDFAXIS>\n` +
        `    <XDFAXIS id="y">\n` +
        `      <units>${escapeXmlText(t.yAxis.units)}</units>\n` +
        `      <indexcount>${t.rows}</indexcount>\n` +
        `      <decimalpl>${t.yAxis.decimalPlaces}</decimalpl>\n` +
        t.yAxis.labels.map((v, i) => `      <LABEL index="${i}" value="${v}" />`).join('\n') +
        `\n    </XDFAXIS>\n` +
        `    <XDFAXIS id="z">\n` +
        `      <EMBEDDEDDATA mmedtypeflags="0x${((t.signed ? 1 : 0) | (t.lsbFirst ? 2 : 0) | (t.rowMajor ? 0 : 4)).toString(16).padStart(2, '0')}" mmedaddress="0x${t.address.toString(16)}" mmedelementsizebits="${t.elementSizeBits}" mmedrowcount="${t.rows}" mmedcolcount="${t.cols}" />\n` +
        `      <units>${escapeXmlText(t.units)}</units>\n` +
        `      <decimalpl>${t.decimalPlaces}</decimalpl>\n` +
        `      <MATH equation="${escapeXmlText(t.equation)}"><VAR id="X" /></MATH>\n` +
        `    </XDFAXIS>\n` +
        `  </XDFTABLE>`
    ),
    ...constants.map(
      (c) =>
        `  <XDFCONSTANT uniqueid="${escapeXmlText(c.id)}">\n` +
        `    <title>${escapeXmlText(c.title)}</title>\n` +
        `    <description>${escapeXmlText(c.description)}</description>\n` +
        `    <EMBEDDEDDATA mmedtypeflags="0x${((c.signed ? 1 : 0) | (c.lsbFirst ? 2 : 0)).toString(16).padStart(2, '0')}" mmedaddress="0x${c.address.toString(16)}" mmedelementsizebits="${c.elementSizeBits}" />\n` +
        `    <units>${escapeXmlText(c.units)}</units>\n` +
        `    <decimalpl>${c.decimalPlaces}</decimalpl>\n` +
        `    <MATH equation="${escapeXmlText(c.equation)}"><VAR id="X" /></MATH>\n` +
        `  </XDFCONSTANT>`
    ),
    ...flags.map(
      (f) =>
        `  <XDFFLAG uniqueid="${escapeXmlText(f.id)}">\n` +
        `    <title>${escapeXmlText(f.title)}</title>\n` +
        `    <description>${escapeXmlText(f.description)}</description>\n` +
        `    <EMBEDDEDDATA mmedaddress="0x${f.address.toString(16)}" mmedelementsizebits="8" />\n` +
        `    <mask>0x${(1 << f.bitIndex).toString(16).padStart(2, '0')}</mask>\n` +
        `  </XDFFLAG>`
    ),
    '</XDFFORMAT>',
  ].join('\n');

  return {
    title,
    author,
    version: '1.11',
    baseOffset,
    rawXml: synthesizedXml,
    tables,
    constants,
    flags,
    checksums,
  };
}

export function parseXdfXml(xmlText: string): XdfDefinition {
  // Support TunerPro v1.11–v3.x plain-text %%HEADER%% / %%TABLE%% format seamlessly
  if (isLegacyTextXdf(xmlText)) {
    return parseLegacyTextXdf(xmlText);
  }

  // Detect encrypted/binary XDF before XML parsing so user receives an accurate message
  const nonEmptyTrimmed = xmlText.trim();
  const hasAnyXmlTag = /<(?:XDFFORMAT|XDFHEADER|XDFTABLE|XDFCONSTANT|XDFFLAG|XDFFUNCTION|XDFPATCH)\b/i.test(
    nonEmptyTrimmed
  );
  if (!hasAnyXmlTag) {
    const sample = nonEmptyTrimmed.slice(0, 300);
    const badChars = (sample.match(/[\uFFFD\u0000-\u0008\u000E-\u001F]/g) || []).length;
    if (badChars > 4 || !nonEmptyTrimmed.includes('<')) {
      throw new Error(
        'ไฟล์ .xdf นี้ถูกเข้ารหัสแบบไบนารี (Encrypted / Binary Protected XDF) ของ TunerPro จึงไม่สามารถถอดข้อความ XML จากภายนอกได้ — หากไฟล์ติดเฉพาะ Edit Password ให้เปิดใน TunerPro แล้ว Save/Export เป็น XML แบบไม่ใส่รหัสผ่าน หรือปลดล็อกก่อนนำเข้า'
      );
    }
  }

  const sanitized = sanitizeXdfXmlString(xmlText);
  const parser = new DOMParser();
  let doc = parser.parseFromString(sanitized, 'application/xml');
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    // Expand XML self-closing tags before lenient HTML5 parsing so <EMBEDDEDDATA ... /> doesn't swallow siblings
    const htmlSafe = expandSelfClosingTagsForHtml(sanitized);
    const htmlDoc = parser.parseFromString(htmlSafe, 'text/html');
    const hasXdfNodes = Boolean(
      htmlDoc.querySelector('xdftable, xdfconstant, xdfflag, xdfswitch, xdffunction, xdfpatch, xdfformat')
    );
    if (!hasXdfNodes) {
      // Last-resort block recovery: isolate individual XDFTABLE/XDFCONSTANT/XDFFLAG blocks even if wrapper is broken
      const blocks = sanitized.match(
        /<(?:XDFTABLE|XDFCONSTANT|XDFFLAG|XDFSWITCH|XDFFUNCTION|XDFPATCH)\b[\s\S]*?<\/(?:XDFTABLE|XDFCONSTANT|XDFFLAG|XDFSWITCH|XDFFUNCTION|XDFPATCH)\s*>/gi
      );
      if (blocks && blocks.length > 0) {
        const recovered = `<XDFFORMAT version="1.70">\n${blocks.join('\n')}\n</XDFFORMAT>`;
        doc = parser.parseFromString(expandSelfClosingTagsForHtml(recovered), 'text/html');
      } else {
        throw new Error('ไม่สามารถอ่านโครงสร้าง XML ของไฟล์ .xdf ได้ กรุณาตรวจสอบว่าไฟล์ไม่เสียหายหรือไม่ได้เข้ารหัสล็อกไว้');
      }
    } else {
      doc = htmlDoc;
    }
  }

  const headerEl = doc.querySelector('XDFHEADER, xdfheader');
  const title =
    getDirectChildByTag(headerEl, 'deftitle')?.textContent?.trim() ||
    headerEl?.querySelector('deftitle')?.textContent?.trim() ||
    'Custom Honda XDF Definition';
  const author =
    getDirectChildByTag(headerEl, 'author')?.textContent?.trim() ||
    headerEl?.querySelector('author')?.textContent?.trim() ||
    'TunerPro User';
  const formatEl = doc.querySelector('XDFFORMAT, xdfformat');
  const version = formatEl?.getAttribute('version') || '1.70';

  // Detect Read-Only / Edit-Password XML XDF metadata while allowing full BIN tuning
  const pwEl = headerEl?.querySelector('password, editpassword, passhash');
  const hasPasswordTag = Boolean(
    pwEl?.textContent?.trim() || pwEl?.getAttribute('hash')?.trim()
  );
  const hasReadOnlyAttr =
    formatEl?.getAttribute('readonly') === '1' ||
    headerEl?.querySelector('readonly')?.textContent?.trim() === '1';
  const isReadOnly = hasPasswordTag || hasReadOnlyAttr;
  const lockNote = isReadOnly
    ? 'ไฟล์ XDF นี้ติดสถานะล็อกแก้ไขโครงสร้าง XDF (Read-Only / Edit Lock) — สามารถเปิดดูตารางและจูนไฟล์ .BIN ได้ตามปกติ'
    : undefined;

  const baseOffsetEl = headerEl?.querySelector('BASEOFFSET, baseoffset');
  const rawBaseOffset = parseHexOrInt(
    baseOffsetEl?.getAttribute('offset') ?? baseOffsetEl?.textContent,
    0
  );
  const subtractBase = baseOffsetEl?.getAttribute('subtract') === '1';
  const baseOffset = subtractBase ? -rawBaseOffset : rawBaseOffset;

  // Global <DEFAULTS> inherited by items that omit size/flags/decimalpl
  const defaultsEl = headerEl?.querySelector('DEFAULTS, defaults');
  const defaultBitsRaw = parseDecimalInt(defaultsEl?.getAttribute('datasizeinbits'), 8);
  const defaultBits: 8 | 16 | 32 = defaultBitsRaw === 32 ? 32 : defaultBitsRaw === 16 ? 16 : 8;
  const defaultSigned = defaultsEl?.getAttribute('signed') === '1';
  const defaultLsb = defaultsEl?.getAttribute('lsbfirst') === '1';
  const defaultFloat = defaultsEl?.getAttribute('float') === '1';
  const defaultDecimalPl = parseDecimalInt(defaultsEl?.getAttribute('sigdigits'), 1);

  const tables: XdfTable[] = [];
  const constants: XdfConstant[] = [];
  const flags: XdfFlag[] = [];
  const checksums: XdfChecksumRegion[] = [];

  const tableElements = Array.from(doc.querySelectorAll('XDFTABLE, xdftable'));
  const functionElements = Array.from(doc.querySelectorAll('XDFFUNCTION, xdffunction'));
  const constantElements = Array.from(doc.querySelectorAll('XDFCONSTANT, xdfconstant'));

  const readMathMeta = (parentEl: Element | undefined) => {
    const mathEl = parentEl?.querySelector('MATH, math');
    const rawEq = mathEl?.getAttribute('equation') || 'X';
    const varId = mathEl?.querySelector('VAR, var')?.getAttribute('id');
    return {
      rawEq,
      equation: normalizeEquationVar(rawEq, varId),
    };
  };

  interface LinkedTargetInfo {
    tableId: string;
    address: number;
    bits: 8 | 16 | 32;
    signed: boolean;
    lsbFirst: boolean;
    isFloat: boolean;
    majorStrideBits: number;
    minorStrideBits: number;
    equation: string;
    decimalPlaces: number;
    units: string;
  }

  // Index table, function, and constant definitions by uniqueid + canonical hex key
  // so linked breakpoint axes (<embedinfo type="2|3" linkobjid="...">) always resolve
  const linkedByUniqueId = new Map<string, LinkedTargetInfo>();
  const registerLinkedTarget = (rawUid: string | null | undefined, info: LinkedTargetInfo) => {
    if (!rawUid) return;
    for (const k of buildUniqueIdKeys(rawUid)) {
      if (!linkedByUniqueId.has(k)) {
        linkedByUniqueId.set(k, info);
      }
    }
  };
  const lookupLinkedTarget = (linkObjId: string | null | undefined): LinkedTargetInfo | undefined => {
    if (!linkObjId) return undefined;
    for (const k of buildUniqueIdKeys(linkObjId)) {
      const hit = linkedByUniqueId.get(k);
      if (hit) return hit;
    }
    return undefined;
  };

  tableElements.forEach((tableEl, idx) => {
    const uid = tableEl.getAttribute('uniqueid')?.trim();
    if (!uid) return;
    const axes = getDirectChildrenByTag(tableEl, 'XDFAXIS');
    const zEl = axes.find((a) => a.getAttribute('id')?.toLowerCase() === 'z') || axes[axes.length - 1];
    const zEmb = zEl?.querySelector('EMBEDDEDDATA, embeddeddata');
    if (!zEl || !zEmb) return;
    const addrAttr = zEmb.getAttribute('mmedaddress');
    if (!addrAttr) return;
    const flagsAttr = zEmb.getAttribute('mmedtypeflags');
    const zFlags = flagsAttr !== null ? parseHexOrInt(flagsAttr, 0) : null;
    const zBitsAttr = zEmb.getAttribute('mmedelementsizebits');
    const zBitsRaw = zBitsAttr ? parseDecimalInt(zBitsAttr, defaultBits) : defaultBits;
    const zDpText = zEl.querySelector('decimalpl')?.textContent;
    const zRows = Math.max(1, parseDecimalInt(zEmb.getAttribute('mmedrowcount'), 1));
    const zCols = Math.max(1, parseDecimalInt(zEmb.getAttribute('mmedcolcount'), 1));
    const zRowMajor = zFlags !== null ? (zFlags & 0x04) === 0 : true;
    const rawMajorStride = parseDecimalInt(zEmb.getAttribute('mmedmajorstridebits'), 0);
    const rawMinorStride = parseDecimalInt(zEmb.getAttribute('mmedminorstridebits'), 0);
    // Only preserve majorStrideBits on a 1D major-axis vector (e.g. 29x1 row-major) so a 2D row-stride isn't mistaken for an element step
    const isMajorVector = (zRowMajor && zCols === 1 && zRows > 1) || (!zRowMajor && zRows === 1 && zCols > 1);
    registerLinkedTarget(uid, {
      tableId: uid || `tbl-${idx}-item`,
      address: parseHexOrInt(addrAttr, 0) + baseOffset,
      bits: zBitsRaw === 32 ? 32 : zBitsRaw === 16 ? 16 : 8,
      signed: zFlags !== null ? (zFlags & 0x01) !== 0 : defaultSigned,
      lsbFirst: zFlags !== null ? (zFlags & 0x02) !== 0 : defaultLsb,
      isFloat: zFlags !== null ? (zFlags & 0x10000) !== 0 : defaultFloat,
      majorStrideBits: isMajorVector ? rawMajorStride : 0,
      minorStrideBits: rawMinorStride,
      equation: readMathMeta(zEl).equation,
      decimalPlaces: zDpText ? parseDecimalInt(zDpText, defaultDecimalPl) : defaultDecimalPl,
      units: zEl.querySelector('units')?.textContent?.trim() || '',
    });
  });

  functionElements.forEach((fnEl, idx) => {
    const uid = fnEl.getAttribute('uniqueid')?.trim();
    if (!uid) return;
    const axes = getDirectChildrenByTag(fnEl, 'XDFAXIS');
    const yEl = axes.find((a) => a.getAttribute('id')?.toLowerCase() === 'y') || axes[axes.length - 1];
    const yEmb = yEl?.querySelector('EMBEDDEDDATA, embeddeddata');
    if (!yEl || !yEmb) return;
    const addrAttr = yEmb.getAttribute('mmedaddress');
    if (!addrAttr) return;
    const flagsAttr = yEmb.getAttribute('mmedtypeflags');
    const yFlags = flagsAttr !== null ? parseHexOrInt(flagsAttr, 0) : null;
    const yBitsRaw = parseDecimalInt(yEmb.getAttribute('mmedelementsizebits'), defaultBits);
    const dpText = yEl.querySelector('decimalpl')?.textContent;
    const yRows = Math.max(1, parseDecimalInt(yEmb.getAttribute('mmedrowcount'), 1));
    const yCols = Math.max(1, parseDecimalInt(yEmb.getAttribute('mmedcolcount'), 1));
    const yRowMajor = yFlags !== null ? (yFlags & 0x04) === 0 : true;
    const rawMajorStride = parseDecimalInt(yEmb.getAttribute('mmedmajorstridebits'), 0);
    const rawMinorStride = parseDecimalInt(yEmb.getAttribute('mmedminorstridebits'), 0);
    const isMajorVector = (yRowMajor && yCols === 1 && yRows > 1) || (!yRowMajor && yRows === 1 && yCols > 1);
    registerLinkedTarget(uid, {
      tableId: uid || `fn-${idx}-item`,
      address: parseHexOrInt(addrAttr, 0) + baseOffset,
      bits: yBitsRaw === 32 ? 32 : yBitsRaw === 16 ? 16 : 8,
      signed: yFlags !== null ? (yFlags & 0x01) !== 0 : defaultSigned,
      lsbFirst: yFlags !== null ? (yFlags & 0x02) !== 0 : defaultLsb,
      isFloat: yFlags !== null ? (yFlags & 0x10000) !== 0 : defaultFloat,
      majorStrideBits: isMajorVector ? rawMajorStride : 0,
      minorStrideBits: rawMinorStride,
      equation: readMathMeta(yEl).equation,
      decimalPlaces: dpText ? parseDecimalInt(dpText, defaultDecimalPl) : defaultDecimalPl,
      units: yEl.querySelector('units')?.textContent?.trim() || '',
    });
  });

  constantElements.forEach((constEl, idx) => {
    const uid = constEl.getAttribute('uniqueid')?.trim();
    if (!uid) return;
    const embed = constEl.querySelector('EMBEDDEDDATA, embeddeddata');
    const addrAttr = embed?.getAttribute('mmedaddress');
    if (!addrAttr) return;
    const flagsAttr = embed?.getAttribute('mmedtypeflags');
    const cFlags = flagsAttr !== null && flagsAttr !== undefined ? parseHexOrInt(flagsAttr, 0) : null;
    const cBitsRaw = parseDecimalInt(embed?.getAttribute('mmedelementsizebits'), defaultBits);
    const dpText = constEl.querySelector('decimalpl')?.textContent;
    registerLinkedTarget(uid, {
      tableId: uid || `const-${idx}`,
      address: parseHexOrInt(addrAttr, 0) + baseOffset,
      bits: cBitsRaw === 32 ? 32 : cBitsRaw === 16 ? 16 : 8,
      signed: cFlags !== null ? (cFlags & 0x01) !== 0 : defaultSigned,
      lsbFirst: cFlags !== null ? (cFlags & 0x02) !== 0 : defaultLsb,
      isFloat: cFlags !== null ? (cFlags & 0x10000) !== 0 : defaultFloat,
      majorStrideBits: parseDecimalInt(embed?.getAttribute('mmedmajorstridebits'), 0),
      minorStrideBits: parseDecimalInt(embed?.getAttribute('mmedminorstridebits'), 0),
      equation: readMathMeta(constEl).equation,
      decimalPlaces: dpText ? parseDecimalInt(dpText, 0) : 0,
      units: constEl.querySelector('units')?.textContent?.trim() || '',
    });
  });

  const usedTableIds = new Set<string>();

  const parseAxis = (axisEl: Element | undefined, id: 'x' | 'y', count: number): XdfAxis => {
    if (!axisEl) {
      return {
        id,
        units: id === 'x' ? 'RPM' : 'TPS %',
        count,
        decimalPlaces: 0,
        elementSizeBits: 8,
        signed: false,
        lsbFirst: false,
        equation: 'X',
        labels: Array.from({ length: count }, (_, i) => i + 1),
        hasExplicitLabels: false,
      };
    }

    const rawUnits = axisEl.querySelector('units')?.textContent?.trim() || '';
    const dpAttr = axisEl.querySelector('decimalpl')?.textContent;
    const hasDp = dpAttr !== null && dpAttr !== undefined && dpAttr.trim() !== '';
    const rawDp = parseDecimalInt(dpAttr, 0);

    const embed = axisEl.querySelector('EMBEDDEDDATA, embeddeddata');
    const addrAttr = embed?.getAttribute('mmedaddress')?.trim() || null;
    const embedInfoEl = axisEl.querySelector('embedinfo');
    const embedType = embedInfoEl?.getAttribute('type')?.trim() || '';
    const linkObjId = embedInfoEl?.getAttribute('linkobjid')?.trim() || '';
    const linkedZ = linkObjId ? lookupLinkedTarget(linkObjId) : undefined;

    // Collect explicit <LABEL index="..." value="..." /> breakpoints
    const labelNodes = Array.from(axisEl.querySelectorAll('LABEL, label'));
    const hasExplicitLabels = labelNodes.length > 0;
    const labelMap = new Map<number, number>();
    const sequentialLabels: number[] = [];
    labelNodes.forEach((lbl) => {
      const val = parseFloat(lbl.getAttribute('value') || '0');
      if (Number.isNaN(val)) return;
      const idxAttr = lbl.getAttribute('index');
      if (idxAttr !== null) {
        const parsedIdx = parseDecimalInt(idxAttr, sequentialLabels.length);
        labelMap.set(parsedIdx, val);
      }
      sequentialLabels.push(val);
    });
    const labels: number[] = [];
    for (let i = 0; i < count; i++) {
      if (labelMap.has(i)) {
        labels.push(labelMap.get(i)!);
      } else if (sequentialLabels[i] !== undefined) {
        labels.push(sequentialLabels[i]);
      } else {
        labels.push((i + 1) * (id === 'x' ? 500 : 10));
      }
    }

    const axisMath = readMathMeta(axisEl).equation;
    const axisHasCustomMath = axisMath.trim() !== '' && axisMath.trim().toUpperCase() !== 'X';

    // Determine whether this axis is:
    // (1) Linked to another table/scalar via <embedinfo type="2|3" linkobjid="..." />
    // (2) Pure internal static labels (<embedinfo type="0" /> or dummy mmedaddress="0x0" with <LABEL>s)
    // (3) Directly embedded in ROM (<embedinfo type="1" /> or non-zero mmedaddress)
    const isLinkedMode = Boolean(
      linkedZ && (embedType === '2' || embedType === '3' || Boolean(linkObjId))
    );
    const parsedAddr = addrAttr ? parseHexOrInt(addrAttr, 0) : 0;
    const isZeroDummyWithLabels =
      addrAttr !== null && parsedAddr === 0 && hasExplicitLabels && embedType !== '1';
    const isStaticLabelMode = embedType === '0' || !addrAttr || isZeroDummyWithLabels;

    if (isLinkedMode && linkedZ) {
      return {
        id,
        units: rawUnits || linkedZ.units || (id === 'x' ? 'RPM' : 'TPS %'),
        count,
        decimalPlaces: hasDp && rawDp > 0 ? rawDp : linkedZ.decimalPlaces,
        address: linkedZ.address,
        elementSizeBits: linkedZ.bits,
        signed: linkedZ.signed,
        lsbFirst: linkedZ.lsbFirst,
        isFloat: linkedZ.isFloat,
        majorStrideBits: linkedZ.majorStrideBits,
        minorStrideBits: linkedZ.minorStrideBits,
        equation: axisHasCustomMath ? axisMath : linkedZ.equation,
        labels,
        hasExplicitLabels,
        linkedTableId: linkedZ.tableId,
      };
    }

    if (isStaticLabelMode) {
      return {
        id,
        units: rawUnits || (id === 'x' ? 'RPM' : 'TPS %'),
        count,
        decimalPlaces: rawDp,
        address: undefined,
        elementSizeBits: 16,
        signed: false,
        lsbFirst: false,
        equation: axisMath || 'X',
        labels,
        hasExplicitLabels,
        linkedTableId: linkedZ?.tableId,
      };
    }

    // Direct embedded axis in ROM
    const axisFlagsAttr = embed?.getAttribute('mmedtypeflags');
    const axisFlags =
      axisFlagsAttr !== null && axisFlagsAttr !== undefined ? parseHexOrInt(axisFlagsAttr, 0) : null;
    const axisBitsRaw = parseDecimalInt(embed?.getAttribute('mmedelementsizebits'), 16);
    const axisMajorStride = parseDecimalInt(embed?.getAttribute('mmedmajorstridebits'), 0);
    const axisMinorStride = parseDecimalInt(embed?.getAttribute('mmedminorstridebits'), 0);

    return {
      id,
      units: rawUnits || (id === 'x' ? 'RPM' : 'TPS %'),
      count,
      decimalPlaces: rawDp,
      address: parsedAddr + baseOffset,
      elementSizeBits: axisBitsRaw === 32 ? 32 : axisBitsRaw === 16 ? 16 : 8,
      signed: axisFlags !== null ? (axisFlags & 0x01) !== 0 : defaultSigned,
      lsbFirst: axisFlags !== null ? (axisFlags & 0x02) !== 0 : defaultLsb,
      isFloat: axisFlags !== null ? (axisFlags & 0x10000) !== 0 : defaultFloat,
      majorStrideBits: axisMajorStride,
      minorStrideBits: axisMinorStride,
      equation: axisMath || 'X',
      labels,
      hasExplicitLabels,
    };
  };

  // Parse Tables (<XDFTABLE>)
  tableElements.forEach((tableEl, idx) => {
    const tTitle =
      getDirectChildByTag(tableEl, 'title')?.textContent?.trim() || `Table ${idx + 1}`;
    const tDesc =
      getDirectChildByTag(tableEl, 'description')?.textContent?.trim() || '';
    const { category, colorScheme } = inferTableCategoryAndColor(tTitle);

    const axes = getDirectChildrenByTag(tableEl, 'XDFAXIS');
    const zAxisEl =
      axes.find((a) => a.getAttribute('id')?.toLowerCase() === 'z') || axes[axes.length - 1];
    const xAxisEl = axes.find((a) => a.getAttribute('id')?.toLowerCase() === 'x');
    const yAxisEl = axes.find((a) => a.getAttribute('id')?.toLowerCase() === 'y');

    if (!zAxisEl) return;

    const zEmbed = zAxisEl.querySelector('EMBEDDEDDATA, embeddeddata');
    const flagsAttr = zEmbed?.getAttribute('mmedtypeflags');
    const zFlags = flagsAttr !== null && flagsAttr !== undefined ? parseHexOrInt(flagsAttr, 0) : null;
    const zAddress = parseHexOrInt(zEmbed?.getAttribute('mmedaddress'), 0) + baseOffset;
    const zBitsAttr = zEmbed?.getAttribute('mmedelementsizebits');
    const zBitsRaw = zBitsAttr ? parseDecimalInt(zBitsAttr, defaultBits) : defaultBits;
    const zBits: 8 | 16 | 32 = zBitsRaw === 32 ? 32 : zBitsRaw === 16 ? 16 : 8;
    const zMajorStride = parseDecimalInt(zEmbed?.getAttribute('mmedmajorstridebits'), 0);
    const zMinorStride = parseDecimalInt(zEmbed?.getAttribute('mmedminorstridebits'), 0);

    const xIndexCount = parseDecimalInt(
      xAxisEl?.querySelector('indexcount')?.textContent,
      xAxisEl?.querySelectorAll('LABEL, label').length || 0
    );
    const yIndexCount = parseDecimalInt(
      yAxisEl?.querySelector('indexcount')?.textContent,
      yAxisEl?.querySelectorAll('LABEL, label').length || 0
    );

    const rawRowCount = parseDecimalInt(zEmbed?.getAttribute('mmedrowcount'), 0);
    const rawColCount = parseDecimalInt(zEmbed?.getAttribute('mmedcolcount'), 0);
    const rows = Math.max(1, rawRowCount > 0 ? rawRowCount : yIndexCount || 1);
    const cols = Math.max(1, rawColCount > 0 ? rawColCount : xIndexCount || 1);
    const signed = zFlags !== null ? (zFlags & 0x01) !== 0 : defaultSigned;
    const lsbFirst = zFlags !== null ? (zFlags & 0x02) !== 0 : defaultLsb;
    const isFloat = zFlags !== null ? (zFlags & 0x10000) !== 0 : defaultFloat;
    const rowMajor = zFlags !== null ? (zFlags & 0x04) === 0 : true;
    const dpText = zAxisEl.querySelector('decimalpl')?.textContent;
    const decimalPlaces = dpText ? parseDecimalInt(dpText, defaultDecimalPl) : defaultDecimalPl;
    const zUnits = zAxisEl.querySelector('units')?.textContent?.trim() || '';
    const zMath = readMathMeta(zAxisEl).equation;

    const minLimitAttr = zAxisEl.querySelector('min')?.textContent;
    const maxLimitAttr = zAxisEl.querySelector('max')?.textContent;
    const rawId = tableEl.getAttribute('uniqueid')?.trim();
    const tableId =
      rawId && !usedTableIds.has(rawId) ? rawId : `tbl-${idx}-${rawId || 'item'}`;
    usedTableIds.add(tableId);

    tables.push({
      id: tableId,
      title: tTitle,
      description: tDesc,
      category,
      colorScheme,
      address: zAddress,
      rows,
      cols,
      elementSizeBits: zBits,
      signed,
      lsbFirst,
      isFloat,
      majorStrideBits: zMajorStride,
      minorStrideBits: zMinorStride,
      rowMajor,
      decimalPlaces,
      equation: zMath,
      units: zUnits,
      xAxis: parseAxis(xAxisEl, 'x', cols),
      yAxis: parseAxis(yAxisEl, 'y', rows),
      minLimit: minLimitAttr ? parseFloat(minLimitAttr) : undefined,
      maxLimit: maxLimitAttr ? parseFloat(maxLimitAttr) : undefined,
    });
  });

  // Parse 2D Functions / Curves (<XDFFUNCTION>) as 1 x N tables
  functionElements.forEach((fnEl, idx) => {
    const fTitle = getDirectChildByTag(fnEl, 'title')?.textContent?.trim() || `Function ${idx + 1}`;
    const fDesc = getDirectChildByTag(fnEl, 'description')?.textContent?.trim() || '';
    const { category, colorScheme } = inferTableCategoryAndColor(fTitle);
    const axes = getDirectChildrenByTag(fnEl, 'XDFAXIS');
    const yEl = axes.find((a) => a.getAttribute('id')?.toLowerCase() === 'y') || axes[axes.length - 1];
    const xEl = axes.find((a) => a.getAttribute('id')?.toLowerCase() === 'x');
    if (!yEl) return;
    const yEmb = yEl.querySelector('EMBEDDEDDATA, embeddeddata');
    if (!yEmb) return;
    const yColCount = parseDecimalInt(yEmb.getAttribute('mmedcolcount'), 0);
    const yRowCount = parseDecimalInt(yEmb.getAttribute('mmedrowcount'), 0);
    const xIdxCount = parseDecimalInt(xEl?.querySelector('indexcount')?.textContent, 0);
    const yIdxCount = parseDecimalInt(yEl.querySelector('indexcount')?.textContent, 0);
    const count = Math.max(1, yColCount || yRowCount || xIdxCount || yIdxCount || 8);
    const yBitsRaw = parseDecimalInt(yEmb.getAttribute('mmedelementsizebits'), defaultBits);
    const yBits: 8 | 16 | 32 = yBitsRaw === 32 ? 32 : yBitsRaw === 16 ? 16 : 8;
    const yFlagsAttr = yEmb.getAttribute('mmedtypeflags');
    const yFlags = yFlagsAttr !== null ? parseHexOrInt(yFlagsAttr, 0) : null;

    const rawId = fnEl.getAttribute('uniqueid')?.trim();
    const tableId = rawId && !usedTableIds.has(rawId) ? rawId : `fn-${idx}-${rawId || 'item'}`;
    usedTableIds.add(tableId);

    tables.push({
      id: tableId,
      title: fTitle,
      description: fDesc,
      category,
      colorScheme,
      address: parseHexOrInt(yEmb.getAttribute('mmedaddress'), 0) + baseOffset,
      rows: 1,
      cols: count,
      elementSizeBits: yBits,
      signed: yFlags !== null ? (yFlags & 0x01) !== 0 : defaultSigned,
      lsbFirst: yFlags !== null ? (yFlags & 0x02) !== 0 : defaultLsb,
      isFloat: yFlags !== null ? (yFlags & 0x10000) !== 0 : defaultFloat,
      majorStrideBits: parseDecimalInt(yEmb.getAttribute('mmedmajorstridebits'), 0),
      minorStrideBits: parseDecimalInt(yEmb.getAttribute('mmedminorstridebits'), 0),
      rowMajor: true,
      decimalPlaces: parseDecimalInt(yEl.querySelector('decimalpl')?.textContent, defaultDecimalPl),
      equation: readMathMeta(yEl).equation,
      units: yEl.querySelector('units')?.textContent?.trim() || '',
      xAxis: parseAxis(xEl, 'x', count),
      yAxis: {
        id: 'y',
        units: '',
        count: 1,
        decimalPlaces: 0,
        elementSizeBits: 8,
        signed: false,
        lsbFirst: false,
        equation: 'X',
        labels: [1],
        hasExplicitLabels: false,
      },
    });
  });

  // Parse Constants (Rev Limiter, Idle RPM, Injector Scaling, etc.)
  constantElements.forEach((constEl, idx) => {
    const cTitle =
      getDirectChildByTag(constEl, 'title')?.textContent?.trim() || `Constant ${idx + 1}`;
    const cDesc =
      getDirectChildByTag(constEl, 'description')?.textContent?.trim() || '';
    const embed = constEl.querySelector('EMBEDDEDDATA, embeddeddata');
    const cFlagsAttr = embed?.getAttribute('mmedtypeflags');
    const cFlags = cFlagsAttr !== null && cFlagsAttr !== undefined ? parseHexOrInt(cFlagsAttr, 0) : null;
    const cAddress = parseHexOrInt(embed?.getAttribute('mmedaddress'), 0) + baseOffset;
    const cBitsAttr = embed?.getAttribute('mmedelementsizebits');
    const cBitsRaw = cBitsAttr ? parseDecimalInt(cBitsAttr, defaultBits) : defaultBits;
    const cBits: 8 | 16 | 32 = cBitsRaw === 32 ? 32 : cBitsRaw === 16 ? 16 : 8;
    const dpText = constEl.querySelector('decimalpl')?.textContent;
    const decimalPlaces = dpText ? parseDecimalInt(dpText, 0) : 0;
    const units = constEl.querySelector('units')?.textContent?.trim() || '';
    const eq = readMathMeta(constEl).equation;

    const lower = cTitle.toLowerCase();
    const cat: XdfConstant['category'] =
      lower.includes('rev') || lower.includes('limit') || lower.includes('cut')
        ? 'limiter'
        : lower.includes('idle') || lower.includes('เดินเบา')
        ? 'idle'
        : lower.includes('inj') || lower.includes('fuel')
        ? 'fuel'
        : lower.includes('ign') || lower.includes('spark')
        ? 'ignition'
        : 'other';

    constants.push({
      id: constEl.getAttribute('uniqueid') || `const-${idx}`,
      title: cTitle,
      description: cDesc,
      category: cat,
      address: cAddress,
      elementSizeBits: cBits,
      signed: cFlags !== null ? (cFlags & 0x01) !== 0 : defaultSigned,
      lsbFirst: cFlags !== null ? (cFlags & 0x02) !== 0 : defaultLsb,
      isFloat: cFlags !== null ? (cFlags & 0x10000) !== 0 : defaultFloat,
      decimalPlaces,
      equation: eq,
      units,
    });
  });

  // Parse Flags (O2 Sensor Disable, VTEC/VVA, Speed Cut, Side Stand)
  doc.querySelectorAll('XDFFLAG, xdfflag, XDFSWITCH, xdfswitch').forEach((flagEl, idx) => {
    const fTitle =
      getDirectChildByTag(flagEl, 'title')?.textContent?.trim() || `Flag ${idx + 1}`;
    const fDesc =
      getDirectChildByTag(flagEl, 'description')?.textContent?.trim() || '';
    const embed = flagEl.querySelector('EMBEDDEDDATA, embeddeddata');
    const fAddress = parseHexOrInt(embed?.getAttribute('mmedaddress'), 0) + baseOffset;
    const mask = parseHexOrInt(flagEl.querySelector('mask')?.textContent, 1);
    let bitIndex = 0;
    for (let b = 0; b < 8; b++) {
      if ((mask & (1 << b)) !== 0) {
        bitIndex = b;
        break;
      }
    }
    flags.push({
      id: flagEl.getAttribute('uniqueid') || `flag-${idx}`,
      title: fTitle,
      description: fDesc,
      category: 'สวิตช์และแฟลก (Flags)',
      address: fAddress,
      bitIndex,
    });
  });

  // Parse Patches (<XDFPATCH>) as toggleable flags on their first entry byte
  doc.querySelectorAll('XDFPATCH, xdfpatch').forEach((patchEl, idx) => {
    const pTitle =
      getDirectChildByTag(patchEl, 'title')?.textContent?.trim() || `Patch ${idx + 1}`;
    const pDesc =
      getDirectChildByTag(patchEl, 'description')?.textContent?.trim() || '';
    const entry = patchEl.querySelector('XDFPATCHENTRY, xdfpatchentry');
    if (!entry) return;
    const pAddress = parseHexOrInt(entry.getAttribute('address'), 0) + baseOffset;
    flags.push({
      id: patchEl.getAttribute('uniqueid') || `patch-${idx}`,
      title: `[Patch] ${pTitle}`,
      description: pDesc,
      category: 'สวิตช์และแฟลก (Flags)',
      address: pAddress,
      bitIndex: 0,
    });
  });

  // Parse Checksum Definitions
  doc.querySelectorAll('XDFCHECKSUM, xdfchecksum').forEach((csEl, idx) => {
    const csTitle =
      getDirectChildByTag(csEl, 'title')?.textContent?.trim() || `Checksum Block ${idx + 1}`;
    const regionEl = csEl.querySelector('REGION, region');
    const algoAttr = (regionEl?.getAttribute('algorithm') ||
      csEl.getAttribute('algorithm') ||
      'keihin-16bit-sum') as ChecksumAlgorithm;
    const startAddress = parseHexOrInt(regionEl?.getAttribute('startaddress'), 0) + baseOffset;
    const endAddress = parseHexOrInt(regionEl?.getAttribute('endaddress'), 0) + baseOffset;
    const storeAddress = parseHexOrInt(regionEl?.getAttribute('storeaddress'), 0) + baseOffset;
    const storeBitsRaw = parseHexOrInt(regionEl?.getAttribute('datasizebits'), 16);
    const storeSizeBits: 8 | 16 | 32 = storeBitsRaw === 32 ? 32 : storeBitsRaw === 8 ? 8 : 16;
    const flagsVal = parseHexOrInt(regionEl?.getAttribute('calculationmethod'), 0);

    checksums.push({
      id: csEl.getAttribute('uniqueid') || `cs-${idx}`,
      title: csTitle,
      algorithm: algoAttr,
      startAddress,
      endAddress,
      storeAddress,
      storeSizeBits,
      lsbFirst: (flagsVal & 0x02) !== 0,
    });
  });

  return {
    title,
    author,
    version,
    baseOffset,
    rawXml: sanitized,
    isReadOnly,
    lockNote,
    tables,
    constants,
    flags,
    checksums,
  };
}

function getTableCellAddress(table: XdfTable, row: number, col: number): number {
  const elemBytes = table.elementSizeBits / 8;
  const elemStepBytes =
    table.minorStrideBits && table.minorStrideBits > 0
      ? Math.max(elemBytes, Math.trunc(table.minorStrideBits / 8))
      : elemBytes;

  const majorCount = table.rowMajor ? table.cols : table.rows;
  const packedLineBytes = majorCount * elemStepBytes;
  let lineStepBytes = packedLineBytes;
  if (table.majorStrideBits && table.majorStrideBits > 0) {
    const strideBytes = Math.trunc(table.majorStrideBits / 8);
    lineStepBytes =
      strideBytes >= packedLineBytes ? strideBytes : packedLineBytes + strideBytes;
  }

  let lineIdx = table.rowMajor ? row : col;
  const elemIdx = table.rowMajor ? col : row;
  const lineCount = table.rowMajor ? table.rows : table.cols;

  // Handle intentional negative major stride (reverse row/line order; ignore -32 UI sentinel on 8/16-bit tables)
  if (
    table.majorStrideBits &&
    table.majorStrideBits < 0 &&
    (lineCount > 1 && (Math.abs(table.majorStrideBits) === table.elementSizeBits || Math.abs(table.majorStrideBits) === packedLineBytes * 8))
  ) {
    lineIdx = lineCount - 1 - lineIdx;
  }

  return table.address + lineIdx * lineStepBytes + elemIdx * elemStepBytes;
}

export function readTableMatrix(bytes: Uint8Array, table: XdfTable): number[][] {
  const matrix: number[][] = [];

  for (let r = 0; r < table.rows; r++) {
    const rowVals: number[] = [];
    for (let c = 0; c < table.cols; c++) {
      const addr = getTableCellAddress(table, r, c);
      let raw: number;
      if (table.isFloat && table.elementSizeBits === 32) {
        raw = readFloat32FromBuffer(bytes, addr, table.lsbFirst);
      } else {
        raw = readUintFromBuffer(bytes, addr, table.elementSizeBits, table.lsbFirst);
        if (table.signed) raw = toSigned(raw, table.elementSizeBits);
      }
      const val = evaluateXdfEquation(table.equation, raw);
      rowVals.push(Number(val.toFixed(table.decimalPlaces)));
    }
    matrix.push(rowVals);
  }
  return matrix;
}

export function writeTableCell(
  bytes: Uint8Array,
  table: XdfTable,
  row: number,
  col: number,
  newValue: number
): void {
  const clamped =
    table.minLimit !== undefined || table.maxLimit !== undefined
      ? Math.max(
          table.minLimit ?? -Infinity,
          Math.min(table.maxLimit ?? Infinity, newValue)
        )
      : newValue;
  const addr = getTableCellAddress(table, row, col);

  const isFloat32 = Boolean(table.isFloat && table.elementSizeBits === 32);
  let raw = solveInverseXdfEquation(
    table.equation,
    clamped,
    table.elementSizeBits,
    table.signed,
    isFloat32
  );
  if (isFloat32) {
    writeFloat32ToBuffer(bytes, addr, raw, table.lsbFirst);
    return;
  }
  if (table.signed) raw = fromSigned(raw, table.elementSizeBits);
  writeUintToBuffer(bytes, addr, raw, table.elementSizeBits, table.lsbFirst);
}

export function readConstantValue(bytes: Uint8Array, item: XdfConstant): number {
  let raw: number;
  if (item.isFloat && item.elementSizeBits === 32) {
    raw = readFloat32FromBuffer(bytes, item.address, item.lsbFirst);
  } else {
    raw = readUintFromBuffer(bytes, item.address, item.elementSizeBits, item.lsbFirst);
    if (item.signed) raw = toSigned(raw, item.elementSizeBits);
  }
  return Number(evaluateXdfEquation(item.equation, raw).toFixed(item.decimalPlaces));
}

export function writeConstantValue(
  bytes: Uint8Array,
  item: XdfConstant,
  newValue: number
): void {
  const isFloat32 = Boolean(item.isFloat && item.elementSizeBits === 32);
  let raw = solveInverseXdfEquation(
    item.equation,
    newValue,
    item.elementSizeBits,
    item.signed,
    isFloat32
  );
  if (isFloat32) {
    writeFloat32ToBuffer(bytes, item.address, raw, item.lsbFirst);
    return;
  }
  if (item.signed) raw = fromSigned(raw, item.elementSizeBits);
  writeUintToBuffer(bytes, item.address, raw, item.elementSizeBits, item.lsbFirst);
}

export function readFlagState(bytes: Uint8Array, flag: XdfFlag): boolean {
  if (flag.address < 0 || flag.address >= bytes.length) return false;
  const bitSet = (bytes[flag.address] & (1 << flag.bitIndex)) !== 0;
  return flag.invert ? !bitSet : bitSet;
}

export function writeFlagState(
  bytes: Uint8Array,
  flag: XdfFlag,
  enabled: boolean
): void {
  if (flag.address < 0 || flag.address >= bytes.length) return;
  const effectiveBit = flag.invert ? !enabled : enabled;
  if (effectiveBit) {
    bytes[flag.address] |= 1 << flag.bitIndex;
  } else {
    bytes[flag.address] &= ~(1 << flag.bitIndex);
  }
}

export const NO_BIN_PLACEHOLDER = 'ยังไม่ได้เลือกไฟล์ .BIN';

export function readAxisLabels(bytes: Uint8Array, axis: XdfAxis): number[] {
  if (axis.address === undefined || axis.address < 0) {
    return axis.labels;
  }
  const elemBytes = axis.elementSizeBits / 8;
  const minorStepBytes =
    axis.minorStrideBits && axis.minorStrideBits > 0
      ? Math.max(elemBytes, Math.trunc(axis.minorStrideBits / 8))
      : elemBytes;
  const stepBytes =
    axis.majorStrideBits && axis.majorStrideBits > 0
      ? Math.max(minorStepBytes, Math.trunc(axis.majorStrideBits / 8))
      : minorStepBytes;

  const reverseOrder = Boolean(
    axis.majorStrideBits &&
      axis.majorStrideBits < 0 &&
      Math.abs(axis.majorStrideBits) === axis.elementSizeBits
  );

  const out: number[] = [];
  for (let i = 0; i < axis.count; i++) {
    const idx = reverseOrder ? axis.count - 1 - i : i;
    const addr = axis.address + idx * stepBytes;
    if (addr + elemBytes > bytes.length) {
      out.push(axis.labels[i] ?? i);
      continue;
    }
    let raw: number;
    if (axis.isFloat && axis.elementSizeBits === 32) {
      raw = readFloat32FromBuffer(bytes, addr, axis.lsbFirst);
    } else {
      raw = readUintFromBuffer(
        bytes,
        addr,
        axis.elementSizeBits as 8 | 16 | 32,
        axis.lsbFirst
      );
      if (axis.signed) raw = toSigned(raw, axis.elementSizeBits as 8 | 16 | 32);
    }
    out.push(Number(evaluateXdfEquation(axis.equation, raw).toFixed(axis.decimalPlaces)));
  }
  return out;
}

export function resolveTableAxisLabels(
  bytes: Uint8Array,
  axis: XdfAxis,
  allTables: XdfTable[],
  preferExplicitLabels = false
): number[] {
  if (preferExplicitLabels && axis.hasExplicitLabels && axis.labels.length === axis.count) {
    return axis.labels;
  }

  if (axis.linkedTableId) {
    const linkedTbl = allTables.find((t) => t.id === axis.linkedTableId);
    if (linkedTbl && linkedTbl.rows * linkedTbl.cols === axis.count) {
      const sameMath =
        axis.equation.trim().toUpperCase() === linkedTbl.equation.trim().toUpperCase();
      if (sameMath || axis.address === undefined) {
        return readTableMatrix(bytes, linkedTbl).flat();
      }
    }
  }

  if (axis.address !== undefined) {
    return readAxisLabels(bytes, axis);
  }

  if (axis.hasExplicitLabels && axis.labels.length === axis.count) {
    return axis.labels;
  }

  const u = axis.units.toLowerCase();
  if (u.includes('rpm')) {
    const rpmBp =
      allTables.find((t) => t.id === 'rpm-axis-table' && t.rows * t.cols === axis.count) ||
      allTables.find(
        (t) =>
          (t.rows === 1 || t.cols === 1) &&
          t.rows * t.cols === axis.count &&
          /rpm|รอบเครื่อง/i.test(t.title)
      );
    if (rpmBp) {
      return readTableMatrix(bytes, rpmBp).flat();
    }
  }
  if (u.includes('tps') || u.includes('%')) {
    const tpsBp =
      allTables.find((t) => t.id === 'tps-axis-table' && t.rows * t.cols === axis.count) ||
      allTables.find(
        (t) =>
          (t.rows === 1 || t.cols === 1) &&
          t.rows * t.cols === axis.count &&
          /tps|คันเร่ง|throt/i.test(t.title)
      );
    if (tpsBp) {
      return readTableMatrix(bytes, tpsBp).flat();
    }
  }

  return readAxisLabels(bytes, axis);
}
