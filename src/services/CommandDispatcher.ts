import { PROTOCOL, NoiseControlMode } from '../constants/protocol';
import { PacketFraming, DecodedPacket } from './PacketFraming';
import { BleService } from './BleManager';
import { useBudsStore } from '../store/useBudsStore';

export class CommandDispatcher {
  private static instance: CommandDispatcher;
  private bleService: BleService;
  private streamDecoder: PacketFraming;

  private constructor() {
    this.bleService = BleService.getInstance();
    this.streamDecoder = new PacketFraming();

    // Hook up incoming BLE stream to decoder
    this.bleService.setRawDataListener((chunk) => {
      this.handleIncomingRawBytes(chunk);
    });
  }

  public static getInstance(): CommandDispatcher {
    if (!CommandDispatcher.instance) {
      CommandDispatcher.instance = new CommandDispatcher();
    }
    return CommandDispatcher.instance;
  }

  /**
   * Helper to format byte buffers into readable hex strings for logs
   */
  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');
  }

  /**
   * Encodes and writes a framed command packet over BLE
   */
  public async sendCommand(msgId: number, payload: Uint8Array | number[] = []): Promise<boolean> {
    const framedPacket = PacketFraming.encode(msgId, payload);
    const hexLog = this.bytesToHex(framedPacket);
    useBudsStore.getState().logMessage(`TX -> [${hexLog}]`);

    return await this.bleService.write(framedPacket);
  }

  /**
   * Processes raw BLE notification fragments, extracting complete verified packets.
   */
  private handleIncomingRawBytes(chunk: Uint8Array): void {
    const packets = this.streamDecoder.append(chunk);

    for (const packet of packets) {
      const hexPayload = this.bytesToHex(packet.payload);
      useBudsStore
        .getState()
        .logMessage(`RX <- MsgId 0x${packet.msgId.toString(16).toUpperCase()} Payload: [${hexPayload}]`);

      this.dispatchPacket(packet);
    }
  }

  /**
   * Dispatches decoded packets based on their Message ID.
   */
  private dispatchPacket(packet: DecodedPacket): void {
    switch (packet.msgId) {
      case PROTOCOL.MSG_ID.STATUS_UPDATED:
      case PROTOCOL.MSG_ID.EXTENDED_STATUS_UPDATED:
        this.parseStatusUpdate(packet.payload);
        break;

      case PROTOCOL.MSG_ID.VERSION_INFO:
        this.parseVersionInfo(packet.payload);
        break;

      default:
        // Other reverse-engineered features (Equalizer, spatial audio, etc.)
        break;
    }
  }

  /**
   * 1. Query device status & battery telemetry
   */
  public async requestStatus(): Promise<void> {
    // Request extended Buds2 Pro status
    await this.sendCommand(PROTOCOL.MSG_ID.GET_STATUS, [0x00]);
  }

  /**
   * 2. Toggle Active Noise Control mode (ANC, Off, Ambient Sound)
   */
  public async setNoiseControl(mode: NoiseControlMode): Promise<void> {
    // Optimistic UI update in Zustand
    useBudsStore.getState().setAncMode(mode);

    let rawModeValue: number = PROTOCOL.NOISE_CONTROL_MODE.OFF;
    if (mode === 'anc') {
      rawModeValue = PROTOCOL.NOISE_CONTROL_MODE.ANC;
    } else if (mode === 'ambient') {
      rawModeValue = PROTOCOL.NOISE_CONTROL_MODE.AMBIENT_SOUND;
    }

    await this.sendCommand(PROTOCOL.MSG_ID.SET_NOISE_CONTROL, [rawModeValue]);
  }

  /**
   * 3. Toggle Touch Controls Lock
   */
  public async setTouchLock(locked: boolean): Promise<void> {
    useBudsStore.getState().setTouchLocked(locked);
    const rawValue = locked ? 0x01 : 0x00;
    await this.sendCommand(PROTOCOL.MSG_ID.LOCK_TOUCH, [rawValue]);
  }

  /**
   * Parses the reverse-engineered Buds2 Pro status payload
   */
  private parseStatusUpdate(payload: Uint8Array): void {
    if (payload.length < 3) return;

    // Buds2 Pro typical telemetry layout:
    // [0]: Battery Left (%)
    // [1]: Battery Right (%)
    // [2]: Battery Case (%) (or at offset 5 in extended frames)
    // Followed by bitmasks for wear status, ANC state, and charging flags
    let leftBattery = payload[0];
    let rightBattery = payload[1];
    let caseBattery = payload.length > 2 ? payload[2] : 0;

    // Extended packet handling:
    let ancMode: NoiseControlMode = 'off';
    let isTouchLocked = false;
    let isLeftCharging = false;
    let isRightCharging = false;
    let isCaseCharging = false;

    if (payload.length >= 8) {
      // Extended payload:
      // Byte 0: left battery, Byte 1: right battery
      // Byte 3: left wear/charging bitmask
      // Byte 4: right wear/charging bitmask
      // Byte 5: case battery
      // Byte 6: case charging
      // Byte 7: noise control mode (0=Off, 1=ANC, 2=Ambient)
      caseBattery = payload[5] <= 100 ? payload[5] : caseBattery;
      isLeftCharging = (payload[3] & 0x01) === 0x01;
      isRightCharging = (payload[4] & 0x01) === 0x01;
      isCaseCharging = (payload[6] & 0x01) === 0x01;

      const rawAnc = payload[7];
      if (rawAnc === PROTOCOL.NOISE_CONTROL_MODE.ANC) {
        ancMode = 'anc';
      } else if (rawAnc === PROTOCOL.NOISE_CONTROL_MODE.AMBIENT_SOUND) {
        ancMode = 'ambient';
      } else {
        ancMode = 'off';
      }

      if (payload.length > 8) {
        isTouchLocked = payload[8] === 0x01;
      }
    }

    // Sanitize values
    leftBattery = Math.min(100, Math.max(0, leftBattery));
    rightBattery = Math.min(100, Math.max(0, rightBattery));
    caseBattery = Math.min(100, Math.max(0, caseBattery));

    useBudsStore.getState().updateBattery({
      left: leftBattery,
      right: rightBattery,
      case: caseBattery,
      isLeftCharging,
      isRightCharging,
      isCaseCharging,
    });

    useBudsStore.getState().setAncMode(ancMode);
    useBudsStore.getState().setTouchLocked(isTouchLocked);
  }

  /**
   * Parses firmware version string from version response packet
   */
  private parseVersionInfo(payload: Uint8Array): void {
    try {
      const versionStr = String.fromCharCode(...payload).replace(/\0/g, '').trim();
      if (versionStr) {
        useBudsStore.getState().setFirmwareVersion(versionStr);
      }
    } catch (e) {
      // Ignore string decoding errors
    }
  }
}

