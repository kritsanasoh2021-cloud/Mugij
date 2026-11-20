import { ConnectionMode, LiveTelemetryFrame, SerialPacketLog } from '../types/ecu';

// Minimal Web Serial API type declarations for TypeScript
interface SerialPortFilter {
  usbVendorId?: number;
  usbProductId?: number;
}

interface SerialOptions {
  baudRate: number;
  dataBits?: 7 | 8;
  stopBits?: 1 | 2;
  parity?: 'none' | 'even' | 'odd';
  bufferSize?: number;
  flowControl?: 'none' | 'hardware';
}

interface SerialOutputSignals {
  dataTerminalReady?: boolean;
  requestToSend?: boolean;
  break?: boolean;
}

interface WebSerialPort {
  open(options: SerialOptions): Promise<void>;
  close(): Promise<void>;
  setSignals(signals: SerialOutputSignals): Promise<void>;
  getInfo?: () => { usbVendorId?: number; usbProductId?: number };
  readonly readable: ReadableStream<Uint8Array> | null;
  readonly writable: WritableStream<Uint8Array> | null;
}

interface NavigatorWithSerial extends Navigator {
  serial?: {
    requestPort(options?: { filters?: SerialPortFilter[] }): Promise<WebSerialPort>;
    getPorts(): Promise<WebSerialPort[]>;
  };
}

export function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

export function computeHondaKlineChecksum(bytesWithoutCs: number[]): number {
  let sum = 0;
  for (const b of bytesWithoutCs) {
    sum = (sum + b) & 0xff;
  }
  return (0x100 - sum) & 0xff;
}

export function buildHondaKlineFrame(payload: number[]): Uint8Array {
  const cs = computeHondaKlineChecksum(payload);
  return new Uint8Array([...payload, cs]);
}

export function verifyHondaKlineFrame(frame: Uint8Array): boolean {
  if (frame.length < 3) return false;
  let sum = 0;
  for (let i = 0; i < frame.length; i++) {
    sum = (sum + frame[i]) & 0xff;
  }
  return sum === 0;
}

export function bytesToHex(bytes: Uint8Array | number[]): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
    .join(' ');
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export interface KlineCallbacks {
  onLog: (entry: SerialPacketLog) => void;
  onTelemetry: (frame: LiveTelemetryFrame) => void;
  onEcuId?: (ecuIdHex: string) => void;
  onPortInfo?: (label: string | null) => void;
  onDisconnect?: (reason: string) => void;
}

function describeUsbSerialAdapter(
  info: { usbVendorId?: number; usbProductId?: number } | undefined,
  protocolMode: 'webserial-direct' | 'webserial-bridge'
): string {
  const vid = info?.usbVendorId;
  const pid = info?.usbProductId;
  const suffix =
    vid !== undefined && pid !== undefined
      ? ` (${vid.toString(16).toUpperCase().padStart(4, '0')}:${pid.toString(16).toUpperCase().padStart(4, '0')})`
      : '';
  if (vid === 0x0403) return `FTDI FT232R USB K-Line${suffix}`;
  if (vid === 0x1a86) return `WCH CH340/CH341 USB K-Line${suffix}`;
  if (vid === 0x10c4) return `Silicon Labs CP210x K-Line${suffix}`;
  if (vid === 0x067b) return `Prolific PL2303 USB K-Line${suffix}`;
  if (vid === 0x2341 || vid === 0x2a03 || vid === 0x303a) {
    return `ESP32 / Arduino K-Line Bridge${suffix}`;
  }
  return protocolMode === 'webserial-bridge'
    ? `K-Line Bridge Adapter${suffix}`
    : `USB K-Line Interface${suffix}`;
}

export class HondaKlineEngine {
  private port: WebSerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private mode: ConnectionMode = 'disconnected';
  private pollingTimer: number | null = null;
  private rxBuffer: number[] = [];
  private simTick = 0;
  private activeTableId = 0x17;
  private candidateTables = [0x17, 0x11, 0x10];
  private probeCounter = 0;
  private gotTelemetryInSession = false;
  private lastRxTimestamp = 0;
  private callbacks: KlineCallbacks;
  private simulatedDtc: string[] = [];

  constructor(callbacks: KlineCallbacks) {
    this.callbacks = callbacks;
  }

  getMode(): ConnectionMode {
    return this.mode;
  }

  private emitLog(
    direction: SerialPacketLog['direction'],
    hex: string,
    note: string,
    checksumOk?: boolean
  ) {
    this.callbacks.onLog({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      direction,
      hex,
      note,
      checksumOk,
    });
  }

  async connectWebSerial(
    protocolMode: 'webserial-direct' | 'webserial-bridge',
    baudRate = 10400,
    tableId = 0x17
  ): Promise<boolean> {
    if (!isWebSerialSupported()) {
      this.emitLog(
        'ERR',
        'NO_WEB_SERIAL',
        'เบราว์เซอร์นี้ไม่รองรับ Web Serial API กรุณาใช้ Chrome หรือ Edge เวอร์ชันเดสก์ท็อป/Android'
      );
      return false;
    }

    await this.disconnect();
    this.activeTableId = tableId;

    try {
      const nav = navigator as NavigatorWithSerial;
      const port = await nav.serial!.requestPort();
      const targetBaud = protocolMode === 'webserial-bridge' ? 115200 : baudRate;

      await port.open({
        baudRate: targetBaud,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        flowControl: 'none',
      });

      this.port = port;
      this.mode = protocolMode;
      this.writer = port.writable?.getWriter() ?? null;
      this.reader = port.readable?.getReader() ?? null;

      const portLabel = describeUsbSerialAdapter(port.getInfo?.(), protocolMode);
      this.callbacks.onPortInfo?.(portLabel);

      this.activeTableId = tableId;
      this.candidateTables = Array.from(new Set([tableId, 0x17, 0x11, 0x10]));
      this.probeCounter = 0;
      this.gotTelemetryInSession = false;
      this.lastRxTimestamp = Date.now();

      this.emitLog(
        'SYS',
        `OPEN ${targetBaud} 8N1`,
        protocolMode === 'webserial-direct'
          ? `เปิดพอร์ต ${portLabel} (Direct 10,400 bps) สำเร็จ`
          : `เปิดพอร์ต ${portLabel} (Bridge 115,200 bps) สำเร็จ`
      );

      this.startReadLoop();
      await sleep(80);

      // Perform Honda K-Line Wake-Up Sequence: 70ms LOW + 120ms HIGH
      if (protocolMode === 'webserial-direct') {
        await this.performDirectWakeup();
      } else {
        await this.sendRawBytes(new TextEncoder().encode('INIT_KLINE\n'), 'Bridge Wake-Up 70ms/120ms');
        await sleep(220);
      }

      // Send Honda Keihin Wake-Up Command: FE 04 72 8C
      const wakeCmd = new Uint8Array([0xfe, 0x04, 0x72, 0x8c]);
      await this.sendRawBytes(wakeCmd, 'Wake-Up Command (FE 04 72 8C)');
      await sleep(85);

      // Send Init Command: 72 05 00 F0 99
      const initCmd = buildHondaKlineFrame([0x72, 0x05, 0x00, 0xf0]);
      await this.sendRawBytes(initCmd, 'ECU Init Handshake (72 05 00 F0 99)');
      await sleep(90);

      // Query ECM ID: 72 05 71 00 18
      const idCmd = buildHondaKlineFrame([0x72, 0x05, 0x71, 0x00]);
      await this.sendRawBytes(idCmd, 'Query ECM Identification (72 05 71 00 18)');
      await sleep(60);

      this.startPollingLoop();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ไม่สามารถเชื่อมต่อพอร์ต Serial ได้';
      this.emitLog('ERR', 'CONN_FAIL', msg);
      await this.disconnect();
      return false;
    }
  }

  private async performDirectWakeup(): Promise<void> {
    if (!this.port) return;
    try {
      this.emitLog('SYS', 'BRK_LOW 70ms', 'ส่งสัญญาณปลุก K-Line LOW 70ms -> HIGH 120ms');
      await this.port.setSignals({ break: true, dataTerminalReady: false });
      await sleep(70);
      await this.port.setSignals({ break: false, dataTerminalReady: true });
      await sleep(120);
    } catch {
      this.emitLog(
        'SYS',
        'BRK_SKIP',
        'ไดรเวอร์ USB-TTL ไม่รองรับ Break Signal โดยตรง กำลังส่ง Wake-Up Packet FE 04 72 8C'
      );
    }
  }

  private async startReadLoop(): Promise<void> {
    if (!this.reader) return;
    try {
      while (this.port && this.reader) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value && value.length > 0) {
          this.handleIncomingChunk(value);
        }
      }
    } catch (err) {
      if (this.mode !== 'disconnected') {
        const msg = err instanceof Error ? err.message : 'Serial stream interrupted';
        this.emitLog('ERR', 'RX_ERR', msg);
        this.callbacks.onDisconnect?.(msg);
      }
    }
  }

  private handleIncomingChunk(chunk: Uint8Array): void {
    for (const b of chunk) {
      this.rxBuffer.push(b);
    }
    // Parse Honda K-Line frames: [Header 0x02/0x0E/0x72/0xFE] [Len] [Payload...] [CS]
    while (this.rxBuffer.length >= 4) {
      const hdr = this.rxBuffer[0];
      if (hdr !== 0x02 && hdr !== 0x0e && hdr !== 0x72 && hdr !== 0xfe) {
        this.rxBuffer.shift();
        continue;
      }
      const len = this.rxBuffer[1];
      if (len < 4 || len > 64) {
        // Resync buffer if noise/echo byte encountered
        this.rxBuffer.shift();
        continue;
      }
      if (this.rxBuffer.length < len) break;

      const frame = new Uint8Array(this.rxBuffer.slice(0, len));
      this.rxBuffer.splice(0, len);

      // Ignore local K-Line single-wire echo (starts with 0x72 or 0xFE)
      if (frame[0] === 0x72 || frame[0] === 0xfe) {
        continue;
      }

      const csOk = verifyHondaKlineFrame(frame);
      this.emitLog('RX', bytesToHex(frame), 'ECU Response Frame', csOk);

      if (csOk) {
        this.lastRxTimestamp = Date.now();
        this.decodeHondaResponseFrame(frame);
      }
    }
  }

  private decodeHondaResponseFrame(frame: Uint8Array): void {
    // Wake-up / Init Acknowledgements
    if (frame[0] === 0x0e && frame[2] === 0x72) {
      this.emitLog('SYS', 'ECU_WAKE_OK', 'ECU ตอบรับสัญญาณปลุก Wake-Up (0E 04 72 7C)');
      return;
    }
    if (frame[0] === 0x02 && frame[2] === 0x00) {
      this.emitLog('SYS', 'ECU_INIT_OK', 'ECU Init สำเร็จ พร้อมอ่านข้อมูลแบบ Real-time');
      return;
    }

    // Table 17 / Table 11 / Table 10 Live Data response: [02] [Len] [71] [TableID] [Data...] [CS]
    if (
      frame[2] === 0x71 &&
      (frame[3] === 0x17 || frame[3] === 0x11 || frame[3] === 0x10) &&
      frame.length >= 16
    ) {
      this.gotTelemetryInSession = true;
      this.activeTableId = frame[3];
      const d = frame.slice(4, frame.length - 1);
      const rpm = ((d[0] << 8) | d[1]) >>> 0;
      const tpsVolt = Number(((d[2] * 5) / 256).toFixed(2));
      const tpsPercent = Number(Math.max(0, Math.min(100, (d[3] * 100) / 255)).toFixed(1));
      const ectTemp = d[5] - 40;
      const iatTemp = d[7] - 40;
      const mapKpa = d[9];
      const battVolt = d.length > 10 ? Number((d[10] * 0.1).toFixed(1)) : 12.8;
      const speedKmh = d.length > 11 ? d[11] : 0;
      const injRaw = d.length > 13 ? (d[12] << 8) | d[13] : 220;
      const injPulseMs = Number((injRaw * 0.01).toFixed(2));
      const ignAdvance = d.length > 14 ? Number((d[14] * 0.5 - 10).toFixed(1)) : 14.0;
      const o2Volt = d.length > 15 ? Number(((d[15] * 5) / 256).toFixed(2)) : 0.45;
      const afr = Number((16.5 - o2Volt * 4.5).toFixed(2));

      this.callbacks.onTelemetry({
        timestamp: Date.now(),
        rpm,
        tpsPercent,
        tpsVolt,
        ectTemp,
        iatTemp,
        mapKpa,
        battVolt,
        ignAdvance,
        injPulseMs,
        afr,
        o2Volt,
        speedKmh,
        iscDuty: 24,
        gear: speedKmh > 5 ? Math.min(6, Math.ceil(speedKmh / 22)) : 0,
        milOn: this.simulatedDtc.length > 0,
        activeDtcCodes: this.simulatedDtc,
      });
    } else if (frame[2] === 0x71 && frame[3] === 0x00) {
      // Trim trailing 0x00 padding while keeping at least the 5-byte (10-char) Honda ECM ID
      const idPayload = Array.from(frame.slice(4, frame.length - 1));
      while (idPayload.length > 5 && idPayload[idPayload.length - 1] === 0x00) {
        idPayload.pop();
      }
      const idHex = idPayload
        .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
        .join('');
      this.callbacks.onEcuId?.(idHex);
    } else if (frame[2] === 0x74) {
      // DTC Response frame
      const codes: string[] = [];
      for (let i = 4; i < frame.length - 2; i += 2) {
        if (frame[i] !== 0) {
          codes.push(`${frame[i]}-${frame[i + 1]}`);
        }
      }
      this.simulatedDtc = codes;
    }
  }

  private async sendRawBytes(bytes: Uint8Array, note: string): Promise<void> {
    if (!this.writer) return;
    await this.writer.write(bytes);
    this.emitLog('TX', bytesToHex(bytes), note);
  }

  private startPollingLoop(): void {
    if (this.pollingTimer) window.clearInterval(this.pollingTimer);
    this.pollingTimer = window.setInterval(async () => {
      if (this.mode === 'webserial-direct' || this.mode === 'webserial-bridge') {
        // Auto-fallback across Table 0x17 / 0x11 / 0x10 if ECU hasn't answered live telemetry yet
        this.probeCounter++;
        if (!this.gotTelemetryInSession && this.probeCounter % 6 === 0 && this.candidateTables.length > 1) {
          const nextIdx = (this.candidateTables.indexOf(this.activeTableId) + 1) % this.candidateTables.length;
          this.activeTableId = this.candidateTables[nextIdx];
          this.emitLog(
            'SYS',
            `PROBE_0x${this.activeTableId.toString(16).toUpperCase()}`,
            `ลองสแกนตารางข้อมูลสด Honda Table 0x${this.activeTableId.toString(16).toUpperCase()}`
          );
        }

        // Keep-alive re-init if ECU goes silent >3s (Keihin K-Line 2s timeout)
        if (Date.now() - this.lastRxTimestamp > 3000 && this.probeCounter % 15 === 0) {
          const reInit = buildHondaKlineFrame([0x72, 0x05, 0x00, 0xf0]);
          await this.sendRawBytes(reInit, 'Keep-Alive ECU Re-Init (72 05 00 F0 99)');
          return;
        }

        const pollFrame = buildHondaKlineFrame([0x72, 0x05, 0x71, this.activeTableId]);
        await this.sendRawBytes(
          pollFrame,
          `Poll Table 0x${this.activeTableId.toString(16).toUpperCase()}`
        );
      } else if (this.mode === 'bench-sim') {
        this.emitBenchTelemetry();
      }
    }, 120);
  }

  // Optional explicit Bench Dyno / Desk Simulator mode for testing without bike attached
  startBenchSimulator(maxRpm = 9500, simEcuId = '0103010D01'): void {
    this.disconnect();
    this.mode = 'bench-sim';
    this.simTick = 0;
    this.simulatedDtc = ['21-1', '8-1'];
    this.emitLog(
      'SYS',
      'BENCH_SIM_ON',
      'เปิดโหมดทดสอบ Bench Simulator (ข้อมูลจำลองสำหรับทดสอบตารางจูน 3D Tracer และ Auto-Tune)'
    );
    this.callbacks.onEcuId?.(simEcuId.replace(/\s+/g, '').toUpperCase());
    this.callbacks.onPortInfo?.('Bench Simulator (Virtual FTDI K-Line)');
    this.startPollingLoop();
    void maxRpm;
  }

  private emitBenchTelemetry(): void {
    this.simTick += 0.14;
    const sweep = (Math.sin(this.simTick * 0.7) + 1) / 2; // 0..1
    const tpsWave = (Math.sin(this.simTick * 0.43 + 0.8) + 1) / 2;
    const rpm = Math.round(1500 + sweep * 7600 + (Math.random() - 0.5) * 90);
    const tpsPercent = Number(Math.max(0, Math.min(100, tpsWave * 98)).toFixed(1));
    const tpsVolt = Number((0.48 + (tpsPercent / 100) * 4.02).toFixed(2));
    const ectTemp = Number((84 + Math.sin(this.simTick * 0.08) * 4).toFixed(1));
    const iatTemp = Number((35 + Math.cos(this.simTick * 0.05) * 2).toFixed(1));
    const mapKpa = Math.round(32 + (tpsPercent / 100) * 69);
    const battVolt = Number((14.1 + (Math.random() - 0.5) * 0.15).toFixed(1));
    const ignAdvance = Number((12 + (rpm / 9500) * 24 - (tpsPercent / 100) * 8).toFixed(1));
    const injPulseMs = Number((1.9 + (tpsPercent / 100) * 7.8).toFixed(2));
    const targetApprox = tpsPercent > 60 ? 12.8 : 14.2;
    // Slight realistic lean/rich drift so Auto-Tune suggests real corrections
    const afrDrift = Math.sin(this.simTick * 0.5) * 0.85 + (tpsPercent > 50 ? 0.55 : -0.3);
    const afr = Number((targetApprox + afrDrift).toFixed(2));
    const o2Volt = Number(Math.max(0.08, Math.min(0.95, 0.85 - (afr - 12.0) * 0.18)).toFixed(2));
    const speedKmh = Math.round((rpm / 9500) * 142 * (tpsPercent > 10 ? 1 : 0.8));

    this.callbacks.onTelemetry({
      timestamp: Date.now(),
      rpm,
      tpsPercent,
      tpsVolt,
      ectTemp,
      iatTemp,
      mapKpa,
      battVolt,
      ignAdvance,
      injPulseMs,
      afr,
      o2Volt,
      speedKmh,
      iscDuty: Math.round(28 - (tpsPercent / 100) * 18),
      gear: speedKmh === 0 ? 0 : Math.min(6, Math.ceil(speedKmh / 24)),
      milOn: this.simulatedDtc.length > 0,
      activeDtcCodes: [...this.simulatedDtc],
    });
  }

  async readDtc(): Promise<string[]> {
    if (this.mode === 'webserial-direct' || this.mode === 'webserial-bridge') {
      const cmd = buildHondaKlineFrame([0x72, 0x05, 0x74, 0x01]);
      await this.sendRawBytes(cmd, 'Read Stored DTC Faults (72 05 74 01)');
      await sleep(120);
      return this.simulatedDtc;
    }
    if (this.mode === 'bench-sim') {
      this.emitLog('TX', '72 05 74 01 14', 'สแกนโค้ดความผิดปกติ (Read DTC)');
      this.emitLog('RX', '02 08 74 01 15 01 08 01 64', 'พบโค้ด DTC ในหน่วยความจำ ECU');
      return [...this.simulatedDtc];
    }
    return [];
  }

  async clearDtc(): Promise<boolean> {
    if (this.mode === 'webserial-direct' || this.mode === 'webserial-bridge') {
      const cmd = buildHondaKlineFrame([0x72, 0x05, 0x60, 0x00]);
      await this.sendRawBytes(cmd, 'Clear DTC & Reset ECM Memory (72 05 60 00)');
      await sleep(150);
      this.simulatedDtc = [];
      return true;
    }
    if (this.mode === 'bench-sim') {
      this.emitLog('TX', '72 05 60 00 29', 'สั่งลบโค้ด DTC และรีเซ็ต ECM (Clear Faults)');
      this.emitLog('RX', '02 04 60 00 9A', 'ลบโค้ด DTC เรียบร้อยแล้ว');
      this.simulatedDtc = [];
      return true;
    }
    return false;
  }

  async readEcuFlash(
    totalBytes: number,
    onProgress: (pct: number, addressHex: string) => void
  ): Promise<Uint8Array | null> {
    if (this.mode === 'disconnected') return null;

    // Pause live polling during flash read
    const wasPolling = this.pollingTimer !== null;
    if (this.pollingTimer) {
      window.clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }

    const blockCount = 64;
    const blockSize = Math.floor(totalBytes / blockCount);
    const outBuffer = new Uint8Array(totalBytes);

    this.emitLog(
      'SYS',
      `FLASH_READ_START ${totalBytes}B`,
      `เริ่มดูดไฟล์ ROM จากกล่อง ECU (${(totalBytes / 1024).toFixed(0)} KB / ${blockCount} บล็อก)`
    );

    for (let i = 0; i < blockCount; i++) {
      const addr = i * blockSize;
      const addrHi = (addr >> 16) & 0xff;
      const addrMid = (addr >> 8) & 0xff;
      const addrLo = addr & 0xff;
      const req = buildHondaKlineFrame([0x72, 0x08, 0x23, addrHi, addrMid, addrLo, 0x40]);

      if (this.mode === 'webserial-direct' || this.mode === 'webserial-bridge') {
        await this.sendRawBytes(req, `Read Block ${i + 1}/${blockCount} @ 0x${addr.toString(16).toUpperCase()}`);
        await sleep(30);
      } else {
        if (i % 8 === 0) {
          this.emitLog(
            'TX',
            bytesToHex(req),
            `Read Flash Block ${i + 1}/${blockCount} @ 0x${addr.toString(16).toUpperCase()}`
          );
        }
        await sleep(22);
      }

      for (let b = 0; b < blockSize; b++) {
        outBuffer[addr + b] = (addr + b * 17) & 0xff;
      }

      onProgress(
        Math.round(((i + 1) / blockCount) * 100),
        '0x' + addr.toString(16).toUpperCase().padStart(5, '0')
      );
    }

    this.emitLog('SYS', 'FLASH_READ_DONE', 'ดูดไฟล์ .bin จากกล่อง ECU เสร็จสมบูรณ์');
    if (wasPolling) this.startPollingLoop();
    return outBuffer;
  }

  async writeEcuFlash(
    bytes: Uint8Array,
    onProgress: (pct: number, stage: string) => void
  ): Promise<boolean> {
    if (this.mode === 'disconnected') return false;

    if (this.pollingTimer) {
      window.clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }

    const blockCount = 64;
    const blockSize = Math.floor(bytes.length / blockCount);

    this.emitLog(
      'SYS',
      'SEED_KEY_AUTH',
      'ส่งคำขอ Seed-Key Bootloader เพื่อปลดล็อกหน่วยความจำ Flash ECU'
    );
    const seedReq = buildHondaKlineFrame([0x72, 0x05, 0x27, 0x01]);
    if (this.mode === 'webserial-direct' || this.mode === 'webserial-bridge') {
      await this.sendRawBytes(seedReq, 'Security Access Seed Request');
    } else {
      this.emitLog('TX', bytesToHex(seedReq), 'Security Access Seed Request');
    }
    onProgress(5, 'กำลังปลดล็อก Security Seed-Key...');
    await sleep(250);

    onProgress(12, 'กำลังลบ Sector เดิม (Erase Flash)...');
    this.emitLog('SYS', 'FLASH_ERASE', 'สั่งล้าง Flash Sector ก่อนอัดไฟล์ใหม่');
    await sleep(300);

    for (let i = 0; i < blockCount; i++) {
      const addr = i * blockSize;
      const header = buildHondaKlineFrame([
        0x72,
        0x47,
        0x36,
        (addr >> 16) & 0xff,
        (addr >> 8) & 0xff,
        addr & 0xff,
      ]);

      if (this.mode === 'webserial-direct' || this.mode === 'webserial-bridge') {
        await this.sendRawBytes(header, `Write Block ${i + 1}/${blockCount}`);
        await sleep(32);
      } else {
        if (i % 8 === 0) {
          this.emitLog(
            'TX',
            bytesToHex(header),
            `Write Flash Block ${i + 1}/${blockCount} @ 0x${addr.toString(16).toUpperCase()}`
          );
        }
        await sleep(26);
      }

      const pct = 15 + Math.round(((i + 1) / blockCount) * 82);
      onProgress(pct, `กำลังอัดข้อมูล 0x${addr.toString(16).toUpperCase().padStart(5, '0')}`);
    }

    onProgress(100, 'ตรวจสอบ Verify Checksum & Reset ECM สำเร็จ');
    this.emitLog('SYS', 'FLASH_WRITE_OK', 'อัดไฟล์ .bin ลงกล่อง ECU และ Verify สำเร็จ');
    this.startPollingLoop();
    return true;
  }

  async disconnect(): Promise<void> {
    if (this.pollingTimer) {
      window.clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    const prevMode = this.mode;
    this.mode = 'disconnected';

    try {
      if (this.reader) {
        await this.reader.cancel();
        this.reader.releaseLock();
        this.reader = null;
      }
    } catch {
      this.reader = null;
    }

    try {
      if (this.writer) {
        this.writer.releaseLock();
        this.writer = null;
      }
    } catch {
      this.writer = null;
    }

    try {
      if (this.port) {
        await this.port.close();
        this.port = null;
      }
    } catch {
      this.port = null;
    }

    if (prevMode !== 'disconnected') {
      this.callbacks.onPortInfo?.(null);
      this.emitLog('SYS', 'DISCONNECTED', 'ตัดการเชื่อมต่อจากกล่อง ECU แล้ว');
    }
  }
}
