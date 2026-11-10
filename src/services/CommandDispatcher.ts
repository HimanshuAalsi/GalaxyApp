import { PROTOCOL, NoiseControlMode, EqPreset } from '../constants/protocol';
import { PacketFraming, DecodedPacket } from './PacketFraming';
import { BleService } from './BleManager';
import { useBudsStore, PlacementState } from '../store/useBudsStore';

export class CommandDispatcher {
  private static instance: CommandDispatcher;
  private bleService: BleService;
  private streamDecoder: PacketFraming;

  private constructor() {
    this.bleService = BleService.getInstance();
    this.streamDecoder = new PacketFraming();

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

  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');
  }

  public async sendCommand(msgId: number, payload: Uint8Array | number[] = []): Promise<boolean> {
    const framedPacket = PacketFraming.encode(msgId, payload);
    const hexLog = this.bytesToHex(framedPacket);
    useBudsStore.getState().logMessage(`TX -> [${hexLog}]`);
    return await this.bleService.write(framedPacket);
  }

  private handleIncomingRawBytes(chunk: Uint8Array): void {
    const packets = this.streamDecoder.append(chunk);

    for (const packet of packets) {
      const hexPayload = this.bytesToHex(packet.payload);
      useBudsStore
        .getState()
        .logMessage(`RX <- MsgId 0x${packet.msgId.toString(16).toUpperCase()} [${hexPayload}]`);
      this.dispatchPacket(packet);
    }
  }

  private dispatchPacket(packet: DecodedPacket): void {
    switch (packet.msgId) {
      case PROTOCOL.MSG_ID.STATUS_UPDATED:
      case PROTOCOL.MSG_ID.EXTENDED_STATUS_UPDATED:
        this.parseExtendedStatus(packet.payload);
        break;

      case PROTOCOL.MSG_ID.NOISE_CONTROLS_UPDATE:
        this.parseNoiseControlUpdate(packet.payload);
        break;

      case PROTOCOL.MSG_ID.VERSION_INFO:
      case PROTOCOL.MSG_ID.VERSION_INFO_LONG:
        this.parseVersionInfo(packet.payload);
        break;

      case PROTOCOL.MSG_ID.CHECK_THE_FIT_OF_EARBUDS_RESULT:
        this.parseFitTestResult(packet.payload);
        break;

      default:
        break;
    }
  }

  // ==========================================
  // 1. STATUS & TELEMETRY
  // ==========================================
  public async requestStatus(): Promise<void> {
    await this.sendCommand(PROTOCOL.MSG_ID.GET_STATUS, [0x00]);
  }

  // ==========================================
  // 2. NOISE CONTROLS
  // ==========================================
  public async setNoiseControl(mode: NoiseControlMode): Promise<void> {
    useBudsStore.getState().setAncMode(mode);
    const rawMode: number =
      mode === 'anc'
        ? PROTOCOL.NOISE_CONTROL_MODE.ANC
        : mode === 'ambient'
        ? PROTOCOL.NOISE_CONTROL_MODE.AMBIENT_SOUND
        : PROTOCOL.NOISE_CONTROL_MODE.OFF;

    await this.sendCommand(PROTOCOL.MSG_ID.NOISE_CONTROLS, [rawMode]);
  }

  public async setNoiseReductionLevel(level: 'low' | 'high'): Promise<void> {
    useBudsStore.getState().setAncLevel(level);
    await this.sendCommand(PROTOCOL.MSG_ID.NOISE_REDUCTION_LEVEL, [level === 'high' ? 1 : 0]);
  }

  public async setAmbientVolume(volume: number): Promise<void> {
    useBudsStore.getState().setAmbientVolume(volume);
    const rawVal = Math.min(3, Math.max(0, volume - 1));
    await this.sendCommand(PROTOCOL.MSG_ID.AMBIENT_VOLUME, [rawVal]);
  }

  public async setAmplifyAmbient(enabled: boolean): Promise<void> {
    useBudsStore.getState().setAmplifyAmbient(enabled);
    await this.sendCommand(PROTOCOL.MSG_ID.SET_AMPLIFY_AMBIENT_SOUND, [enabled ? 1 : 0]);
  }

  public async setAncWithOneEarbud(enabled: boolean): Promise<void> {
    useBudsStore.getState().setAncWithOneEarbud(enabled);
    await this.sendCommand(PROTOCOL.MSG_ID.SET_ANC_WITH_ONE_EARBUD, [enabled ? 1 : 0]);
  }

  // ==========================================
  // 3. VOICE DETECT & 360 AUDIO
  // ==========================================
  public async setVoiceDetect(enabled: boolean): Promise<void> {
    useBudsStore.getState().setVoiceDetect(enabled);
    await this.sendCommand(PROTOCOL.MSG_ID.SET_DETECT_CONVERSATIONS, [enabled ? 1 : 0]);
  }

  public async setVoiceDetectDuration(duration: 5 | 10 | 15): Promise<void> {
    useBudsStore.getState().setVoiceDetectDuration(duration);
    const rawVal = duration === 5 ? 0 : duration === 10 ? 1 : 2;
    await this.sendCommand(PROTOCOL.MSG_ID.SET_DETECT_CONVERSATIONS_DURATION, [rawVal]);
  }

  public async setSpatialAudio(enabled: boolean): Promise<void> {
    useBudsStore.getState().setSpatialAudio(enabled);
    await this.sendCommand(PROTOCOL.MSG_ID.SET_SPATIAL_AUDIO, [enabled ? 1 : 0]);
  }

  // ==========================================
  // 4. EQUALIZER & SOUND QUALITY
  // ==========================================
  public async setEqualizerPreset(preset: EqPreset): Promise<void> {
    useBudsStore.getState().setEqPreset(preset);
    const presetMap: Record<EqPreset, number> = {
      normal: PROTOCOL.EQ_PRESET.NORMAL,
      bass_boost: PROTOCOL.EQ_PRESET.BASS_BOOST,
      soft: PROTOCOL.EQ_PRESET.SOFT,
      dynamic: PROTOCOL.EQ_PRESET.DYNAMIC,
      clear: PROTOCOL.EQ_PRESET.CLEAR,
      treble_boost: PROTOCOL.EQ_PRESET.TREBLE_BOOST,
      custom: PROTOCOL.EQ_PRESET.CUSTOM,
    };
    await this.sendCommand(PROTOCOL.MSG_ID.EQUALIZER, [presetMap[preset]]);
  }

  public async setCustomEqualizer(bandGains: number[]): Promise<void> {
    // 9 bands: 63Hz, 125Hz, 250Hz, 500Hz, 1kHz, 2kHz, 4kHz, 8kHz, 16kHz
    const payload = new Uint8Array(bandGains.length + 1);
    payload[0] = bandGains.length;
    for (let i = 0; i < bandGains.length; i++) {
      payload[i + 1] = bandGains[i] & 0xff;
    }
    await this.sendCommand(PROTOCOL.MSG_ID.CUSTOM_EQUALIZE_SEND, payload);
  }

  public async setGamingMode(enabled: boolean): Promise<void> {
    useBudsStore.getState().setGamingMode(enabled);
    await this.sendCommand(PROTOCOL.MSG_ID.GAME_MODE, [enabled ? 1 : 0]);
  }

  // ==========================================
  // 5. TOUCH CONTROLS
  // ==========================================
  public async setTouchLock(locked: boolean): Promise<void> {
    const tc = useBudsStore.getState().touchControls;
    useBudsStore.getState().updateTouchControls({ isAllLocked: locked });
    // Payload: [!LockAll, TapOn, DoubleTapOn, TripleTapOn, HoldTapOn, DoubleTapCallOn, HoldTapCallOn]
    const payload = [
      locked ? 0 : 1,
      tc.tap ? 1 : 0,
      tc.doubleTap ? 1 : 0,
      tc.tripleTap ? 1 : 0,
      tc.touchAndHold ? 1 : 0,
      1,
      1,
    ];
    await this.sendCommand(PROTOCOL.MSG_ID.LOCK_TOUCHPAD, payload);
  }

  public async updateTouchGestures(gestures: {
    tap?: boolean;
    doubleTap?: boolean;
    tripleTap?: boolean;
    touchAndHold?: boolean;
  }): Promise<void> {
    useBudsStore.getState().updateTouchControls(gestures);
    const tc = useBudsStore.getState().touchControls;
    const payload = [
      tc.isAllLocked ? 0 : 1,
      tc.tap ? 1 : 0,
      tc.doubleTap ? 1 : 0,
      tc.tripleTap ? 1 : 0,
      tc.touchAndHold ? 1 : 0,
      1,
      1,
    ];
    await this.sendCommand(PROTOCOL.MSG_ID.LOCK_TOUCHPAD, payload);
  }

  public async setTouchAndHoldAction(
    leftAction: 'noise_control' | 'voice_assistant' | 'volume_down' | 'spotify',
    rightAction: 'noise_control' | 'voice_assistant' | 'volume_up' | 'spotify'
  ): Promise<void> {
    useBudsStore.getState().updateTouchControls({ leftHoldAction: leftAction, rightHoldAction: rightAction });
    const actionMap: Record<string, number> = {
      noise_control: PROTOCOL.TOUCH_OPTION.NOISE_CONTROL,
      voice_assistant: PROTOCOL.TOUCH_OPTION.VOICE_COMMAND,
      volume_down: PROTOCOL.TOUCH_OPTION.VOLUME_DOWN,
      volume_up: PROTOCOL.TOUCH_OPTION.VOLUME_UP,
      spotify: PROTOCOL.TOUCH_OPTION.SPOTIFY,
    };
    await this.sendCommand(PROTOCOL.MSG_ID.SET_TOUCHPAD_OPTION, [
      actionMap[leftAction] || 1,
      actionMap[rightAction] || 1,
    ]);
  }

  // ==========================================
  // 6. FIT TEST & FIND MY BUDS
  // ==========================================
  public async startFitTest(): Promise<void> {
    useBudsStore.getState().setFitTestState({ isTesting: true, leftResult: null, rightResult: null });
    await this.sendCommand(PROTOCOL.MSG_ID.CHECK_THE_FIT_OF_EARBUDS, [0x01]);
  }

  public async startFindMyBuds(left = true, right = true): Promise<void> {
    useBudsStore.getState().setFindMyBuds(true, left, right);
    await this.sendCommand(PROTOCOL.MSG_ID.FIND_MY_EARBUDS_START, [0x01]);
    await this.sendCommand(PROTOCOL.MSG_ID.MUTE_EARBUD, [left ? 0 : 1, right ? 0 : 1]);
  }

  public async stopFindMyBuds(): Promise<void> {
    useBudsStore.getState().setFindMyBuds(false, false, false);
    await this.sendCommand(PROTOCOL.MSG_ID.FIND_MY_EARBUDS_STOP, [0x00]);
  }

  public async muteFindMyBud(side: 'left' | 'right', muted: boolean): Promise<void> {
    const store = useBudsStore.getState();
    const leftMuted = side === 'left' ? muted : !store.leftBeeping;
    const rightMuted = side === 'right' ? muted : !store.rightBeeping;
    useBudsStore.getState().setFindMyBuds(true, !leftMuted, !rightMuted);
    await this.sendCommand(PROTOCOL.MSG_ID.MUTE_EARBUD, [leftMuted ? 1 : 0, rightMuted ? 1 : 0]);
  }

  // ==========================================
  // 7. SYSTEM & POSTURE
  // ==========================================
  public async setNeckStretch(enabled: boolean): Promise<void> {
    useBudsStore.getState().setNeckStretch(enabled);
    await this.sendCommand(PROTOCOL.MSG_ID.NECK_POSTURE_SET, [enabled ? 1 : 0]);
  }

  public async calibrateNeckPosture(): Promise<void> {
    await this.sendCommand(PROTOCOL.MSG_ID.NECK_POSTURE_CALI_DATA, [0x01]);
  }

  public async setInEarPause(enabled: boolean): Promise<void> {
    useBudsStore.getState().setInEarPause(enabled);
    await this.sendCommand(PROTOCOL.MSG_ID.PAUSE_MEDIA_WHEN_ONE_BUD_REMOVED, [enabled ? 1 : 0]);
  }

  public async setSeamlessConnection(enabled: boolean): Promise<void> {
    useBudsStore.getState().setSeamlessConnection(enabled);
    await this.sendCommand(PROTOCOL.MSG_ID.SET_SEAMLESS_CONNECTION, [enabled ? 0 : 1]);
  }

  public async resetEarbuds(): Promise<void> {
    await this.sendCommand(PROTOCOL.MSG_ID.RESET, [0x01]);
  }

  // ==========================================
  // PARSING LOGIC (SppMessage Decoder for Buds2 Pro)
  // ==========================================
  private parseExtendedStatus(payload: Uint8Array): void {
    if (payload.length < 8) return;

    // Exact offsets from GalaxyBudsClient ExtendedStatusUpdateDecoder:
    // payload[0] = Revision
    // payload[1] = EarType
    // payload[2] = BatteryL
    // payload[3] = BatteryR
    const leftBattery = Math.min(100, Math.max(0, payload[2]));
    const rightBattery = Math.min(100, Math.max(0, payload[3]));

    // payload[6] = Placement: high nibble = Left, low nibble = Right
    // 0 = Case/Disconnected, 1 = Wearing/In-Ear, 2 = Outside/Idle, 3 = Charging
    const rawPlacementL = (payload[6] & 0xf0) >> 4;
    const rawPlacementR = payload[6] & 0x0f;

    const toPlacement = (raw: number): PlacementState => {
      switch (raw) {
        case 1:
          return 'in_ear';
        case 2:
          return 'outside';
        case 3:
        case 0:
          return 'case';
        default:
          return 'in_ear';
      }
    };

    // payload[7] = BatteryCase
    const caseBattery = Math.min(100, Math.max(0, payload[7]));

    // payload[9] = Equalizer Mode (0 to 5)
    let eqPreset: EqPreset = 'dynamic';
    if (payload.length > 9) {
      const eqMap: Record<number, EqPreset> = {
        0: 'normal',
        1: 'bass_boost',
        2: 'soft',
        3: 'dynamic',
        4: 'clear',
        5: 'treble_boost',
      };
      eqPreset = eqMap[payload[9]] || 'dynamic';
    }

    // payload[10] = Touchpad Lock
    const isTouchLocked = payload.length > 10 ? payload[10] === 1 : false;

    // payload[12] = NoiseControlMode (0 = Off, 1 = ANC, 2 = Ambient)
    let ancMode: NoiseControlMode = 'anc';
    if (payload.length > 12) {
      const rawAnc = payload[12];
      ancMode = rawAnc === 1 ? 'anc' : rawAnc === 2 ? 'ambient' : 'off';
    }

    // payload[23] = AmbientSoundVolume (0-3 -> Levels 1-4)
    const ambientVolume = payload.length > 23 ? Math.min(4, Math.max(1, payload[23] + 1)) : 2;

    // payload[24] = NoiseReductionLevel (0 = Low, 1 = High)
    const ancLevel = payload.length > 24 && payload[24] === 0 ? 'low' : 'high';

    // payload[26] = DetectConversations (Voice Detect)
    const voiceDetect = payload.length > 26 ? payload[26] === 1 : false;

    // payload[27] = DetectConversationsDuration (0 = 5s, 1 = 10s, 2 = 15s)
    let voiceDuration: 5 | 10 | 15 = 10;
    if (payload.length > 27) {
      voiceDuration = payload[27] === 0 ? 5 : payload[27] === 1 ? 10 : 15;
    }

    // payload[35] = SpatialAudio (360 Audio)
    const spatialAudio = payload.length > 35 ? payload[35] === 1 : false;

    // Charging state bits
    let isLeftCharging = false;
    let isRightCharging = false;
    let isCaseCharging = false;
    if (payload.length > 40) {
      const chargingByte = payload[40];
      isLeftCharging = (chargingByte & 16) === 16;
      isRightCharging = (chargingByte & 4) === 4;
      isCaseCharging = (chargingByte & 1) === 1;
    }

    useBudsStore.getState().updateBattery({
      left: leftBattery,
      right: rightBattery,
      case: caseBattery,
      placementL: toPlacement(rawPlacementL),
      placementR: toPlacement(rawPlacementR),
      isLeftCharging,
      isRightCharging,
      isCaseCharging,
    });

    useBudsStore.getState().setAncMode(ancMode);
    useBudsStore.getState().setAncLevel(ancLevel);
    useBudsStore.getState().setAmbientVolume(ambientVolume);
    useBudsStore.getState().setVoiceDetect(voiceDetect);
    useBudsStore.getState().setVoiceDetectDuration(voiceDuration);
    useBudsStore.getState().setSpatialAudio(spatialAudio);
    useBudsStore.getState().setEqPreset(eqPreset);
    useBudsStore.getState().updateTouchControls({ isAllLocked: isTouchLocked });
  }

  private parseNoiseControlUpdate(payload: Uint8Array): void {
    if (payload.length < 1) return;
    const rawMode = payload[0];
    const mode: NoiseControlMode = rawMode === 1 ? 'anc' : rawMode === 2 ? 'ambient' : 'off';
    useBudsStore.getState().setAncMode(mode);
  }

  private parseVersionInfo(payload: Uint8Array): void {
    try {
      const versionStr = String.fromCharCode(...payload).replace(/\0/g, '').trim();
      if (versionStr) {
        useBudsStore.getState().setFirmwareVersion(versionStr);
      }
    } catch {
      // Ignore
    }
  }

  private parseFitTestResult(payload: Uint8Array): void {
    if (payload.length < 2) return;
    const leftFit = payload[0] === 1 ? 'good' : 'adjust';
    const rightFit = payload[1] === 1 ? 'good' : 'adjust';
    useBudsStore.getState().setFitTestState({ isTesting: false, leftResult: leftFit, rightResult: rightFit });
  }
}
