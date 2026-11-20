import {
  ChecksumAlgorithm,
  ChecksumBlockResult,
  XdfChecksumRegion,
} from '../types/ecu';

export function readUintFromBuffer(
  bytes: Uint8Array,
  address: number,
  bits: 8 | 16 | 32,
  lsbFirst: boolean
): number {
  if (address < 0 || address + bits / 8 > bytes.length) return 0;
  if (bits === 8) {
    return bytes[address];
  }
  if (bits === 16) {
    const b0 = bytes[address];
    const b1 = bytes[address + 1];
    return lsbFirst ? (b1 << 8) | b0 : (b0 << 8) | b1;
  }
  const b0 = bytes[address];
  const b1 = bytes[address + 1];
  const b2 = bytes[address + 2];
  const b3 = bytes[address + 3];
  if (lsbFirst) {
    return ((b3 << 24) | (b2 << 16) | (b1 << 8) | b0) >>> 0;
  }
  return ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) >>> 0;
}

export function writeUintToBuffer(
  bytes: Uint8Array,
  address: number,
  value: number,
  bits: 8 | 16 | 32,
  lsbFirst: boolean
): void {
  if (address < 0 || address + bits / 8 > bytes.length) return;
  if (bits === 8) {
    bytes[address] = value & 0xff;
    return;
  }
  if (bits === 16) {
    const v = value & 0xffff;
    if (lsbFirst) {
      bytes[address] = v & 0xff;
      bytes[address + 1] = (v >> 8) & 0xff;
    } else {
      bytes[address] = (v >> 8) & 0xff;
      bytes[address + 1] = v & 0xff;
    }
    return;
  }
  const v = value >>> 0;
  if (lsbFirst) {
    bytes[address] = v & 0xff;
    bytes[address + 1] = (v >> 8) & 0xff;
    bytes[address + 2] = (v >> 16) & 0xff;
    bytes[address + 3] = (v >> 24) & 0xff;
  } else {
    bytes[address] = (v >> 24) & 0xff;
    bytes[address + 1] = (v >> 16) & 0xff;
    bytes[address + 2] = (v >> 8) & 0xff;
    bytes[address + 3] = v & 0xff;
  }
}

export function computeBlockChecksum(
  bytes: Uint8Array,
  region: XdfChecksumRegion
): number {
  const start = Math.max(0, region.startAddress);
  const end = Math.min(bytes.length - 1, region.endAddress);
  const storeBytes = region.storeSizeBits / 8;

  const isInsideStore = (idx: number) =>
    idx >= region.storeAddress && idx < region.storeAddress + storeBytes;

  switch (region.algorithm) {
    case 'keihin-8bit-twos': {
      let sum = 0;
      for (let i = start; i <= end; i++) {
        if (isInsideStore(i)) continue;
        sum = (sum + bytes[i]) & 0xff;
      }
      const target = region.targetSum ?? 0;
      return (target - sum) & 0xff;
    }

    case 'keihin-16bit-sum': {
      let sum = 0;
      for (let i = start; i <= end; i += 2) {
        if (isInsideStore(i)) continue;
        const word =
          i + 1 <= end
            ? readUintFromBuffer(bytes, i, 16, region.lsbFirst)
            : bytes[i];
        sum = (sum + word) & 0xffff;
      }
      // Two's complement 16-bit checksum (standard Keihin Honda K-Line)
      return (0x10000 - sum) & 0xffff;
    }

    case 'honda-sh705x-32bit': {
      let sum = 0;
      for (let i = start; i + 3 <= end; i += 4) {
        if (isInsideStore(i)) continue;
        const dword = readUintFromBuffer(bytes, i, 32, region.lsbFirst);
        sum = (sum + dword) >>> 0;
      }
      return (0x100000000 - sum) >>> 0;
    }

    case 'honda-sh725xx-crc16': {
      // CRC-16/CCITT-FALSE over region excluding store address
      let crc = 0xffff;
      for (let i = start; i <= end; i++) {
        if (isInsideStore(i)) continue;
        crc ^= bytes[i] << 8;
        for (let bit = 0; bit < 8; bit++) {
          if (crc & 0x8000) {
            crc = ((crc << 1) ^ 0x1021) & 0xffff;
          } else {
            crc = (crc << 1) & 0xffff;
          }
        }
      }
      return crc & 0xffff;
    }
  }
}

export function verifyAllChecksums(
  bytes: Uint8Array,
  regions: XdfChecksumRegion[],
  fallbackAlgo: ChecksumAlgorithm = 'keihin-16bit-sum'
): ChecksumBlockResult[] {
  const effectiveRegions: XdfChecksumRegion[] =
    regions.length > 0
      ? regions
      : [
          {
            id: 'auto-full-rom',
            title: 'Main Flash ROM Block (Auto-Detected)',
            algorithm: fallbackAlgo,
            startAddress: 0,
            endAddress: Math.max(0, bytes.length - 1),
            storeAddress: Math.max(0, bytes.length - (fallbackAlgo === 'honda-sh705x-32bit' ? 4 : fallbackAlgo === 'keihin-8bit-twos' ? 1 : 2)),
            storeSizeBits:
              fallbackAlgo === 'honda-sh705x-32bit'
                ? 32
                : fallbackAlgo === 'keihin-8bit-twos'
                ? 8
                : 16,
            lsbFirst: false,
          },
        ];

  return effectiveRegions.map((region) => {
    const storedValue = readUintFromBuffer(
      bytes,
      region.storeAddress,
      region.storeSizeBits,
      region.lsbFirst
    );
    const computedValue = computeBlockChecksum(bytes, region);
    return {
      id: region.id,
      title: region.title,
      algorithm: region.algorithm,
      startAddress: region.startAddress,
      endAddress: region.endAddress,
      storeAddress: region.storeAddress,
      storedValue,
      computedValue,
      isValid: storedValue === computedValue,
    };
  });
}

export function fixAllChecksums(
  bytes: Uint8Array,
  regions: XdfChecksumRegion[],
  fallbackAlgo: ChecksumAlgorithm = 'keihin-16bit-sum'
): { updatedBytes: Uint8Array; results: ChecksumBlockResult[]; patchedCount: number } {
  const updatedBytes = new Uint8Array(bytes);
  const initialResults = verifyAllChecksums(updatedBytes, regions, fallbackAlgo);
  let patchedCount = 0;

  const effectiveRegions: XdfChecksumRegion[] =
    regions.length > 0
      ? regions
      : [
          {
            id: 'auto-full-rom',
            title: 'Main Flash ROM Block (Auto-Detected)',
            algorithm: fallbackAlgo,
            startAddress: 0,
            endAddress: Math.max(0, updatedBytes.length - 1),
            storeAddress: Math.max(
              0,
              updatedBytes.length -
                (fallbackAlgo === 'honda-sh705x-32bit'
                  ? 4
                  : fallbackAlgo === 'keihin-8bit-twos'
                  ? 1
                  : 2)
            ),
            storeSizeBits:
              fallbackAlgo === 'honda-sh705x-32bit'
                ? 32
                : fallbackAlgo === 'keihin-8bit-twos'
                ? 8
                : 16,
            lsbFirst: false,
          },
        ];

  effectiveRegions.forEach((region, idx) => {
    const res = initialResults[idx];
    if (!res.isValid) {
      writeUintToBuffer(
        updatedBytes,
        region.storeAddress,
        res.computedValue,
        region.storeSizeBits,
        region.lsbFirst
      );
      patchedCount++;
    }
  });

  const finalResults = verifyAllChecksums(updatedBytes, regions, fallbackAlgo);
  return { updatedBytes, results: finalResults, patchedCount };
}

export function formatHexValue(value: number, bits: 8 | 16 | 32): string {
  const hexDigits = bits / 4;
  return '0x' + (value >>> 0).toString(16).toUpperCase().padStart(hexDigits, '0');
}

export function formatAddress(address: number): string {
  return '0x' + address.toString(16).toUpperCase().padStart(5, '0');
}
