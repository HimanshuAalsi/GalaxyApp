import { create } from 'zustand';
import { NoiseControlMode, EqPreset } from '../constants/protocol';

export type ConnectionState = 'disconnected' | 'scanning' | 'connecting' | 'connected';
export type PlacementState = 'in_ear' | 'outside' | 'case' | 'disconnected';

export interface BatteryState {
  left: number;
  right: number;
  case: number;
  isLeftCharging: boolean;
  isRightCharging: boolean;
  isCaseCharging: boolean;
  placementL: PlacementState;
  placementR: PlacementState;
}

export interface BudsDevice {
  id: string;
  name: string | null;
  rssi: number | null;
  isSystemConnected?: boolean;
  isSamsung?: boolean;
  rawManufacturerData?: string | null;
}

export interface TouchControlsState {
  isAllLocked: boolean;
  tap: boolean;
  doubleTap: boolean;
  tripleTap: boolean;
  touchAndHold: boolean;
  leftHoldAction: 'noise_control' | 'voice_assistant' | 'volume_down' | 'spotify';
  rightHoldAction: 'noise_control' | 'voice_assistant' | 'volume_up' | 'spotify';
}

export interface FitTestState {
  isTesting: boolean;
  leftResult: 'good' | 'adjust' | null;
  rightResult: 'good' | 'adjust' | null;
}

export interface BudsStore {
  // Connection
  connectionState: ConnectionState;
  connectedDevice: BudsDevice | null;
  discoveredDevices: BudsDevice[];

  // Battery & Placement
  battery: BatteryState;

  // Noise Controls
  ancMode: NoiseControlMode;
  ancLevel: 'low' | 'high';
  ambientVolume: number; // 1 to 4
  amplifyAmbient: boolean;
  ancWithOneEarbud: boolean;

  // Smart Features
  voiceDetect: boolean;
  voiceDetectDuration: 5 | 10 | 15;
  spatialAudio: boolean;
  spatialHeadTracking: boolean;
  gamingMode: boolean;
  inEarPause: boolean;
  seamlessConnection: boolean;

  // Equalizer
  eqPreset: EqPreset;
  customEqGains: number[]; // 9 bands: 63Hz, 125Hz, 250Hz, 500Hz, 1kHz, 2kHz, 4kHz, 8kHz, 16kHz (-10 to +10)

  // Touch Controls
  touchControls: TouchControlsState;

  // Fit Test & Find My Buds
  fitTest: FitTestState;
  isFindMyBudsActive: boolean;
  leftBeeping: boolean;
  rightBeeping: boolean;

  // Posture & Neck Stretch
  neckStretch: boolean;
  neckAngle: number;

  // Firmware & Diagnostics
  firmwareVersion: string;
  lastLog: string;

  // Actions
  setConnectionState: (state: ConnectionState) => void;
  setConnectedDevice: (device: BudsDevice | null) => void;
  addDiscoveredDevice: (device: BudsDevice) => void;
  setDiscoveredDevices: (devices: BudsDevice[]) => void;
  clearDiscoveredDevices: () => void;

  updateBattery: (battery: Partial<BatteryState>) => void;
  setAncMode: (mode: NoiseControlMode) => void;
  setAncLevel: (level: 'low' | 'high') => void;
  setAmbientVolume: (vol: number) => void;
  setAmplifyAmbient: (enabled: boolean) => void;
  setAncWithOneEarbud: (enabled: boolean) => void;

  setVoiceDetect: (enabled: boolean) => void;
  setVoiceDetectDuration: (duration: 5 | 10 | 15) => void;
  setSpatialAudio: (enabled: boolean) => void;
  setSpatialHeadTracking: (enabled: boolean) => void;
  setGamingMode: (enabled: boolean) => void;
  setInEarPause: (enabled: boolean) => void;
  setSeamlessConnection: (enabled: boolean) => void;

  setEqPreset: (preset: EqPreset) => void;
  setCustomEqBandGain: (index: number, gain: number) => void;

  updateTouchControls: (controls: Partial<TouchControlsState>) => void;
  setFitTestState: (fit: Partial<FitTestState>) => void;
  setFindMyBuds: (active: boolean, left?: boolean, right?: boolean) => void;
  setNeckStretch: (enabled: boolean) => void;
  setNeckAngle: (angle: number) => void;

  setFirmwareVersion: (version: string) => void;
  logMessage: (msg: string) => void;
}

export const useBudsStore = create<BudsStore>((set) => ({
  connectionState: 'disconnected',
  connectedDevice: null,
  discoveredDevices: [],

  battery: {
    left: 92,
    right: 88,
    case: 95,
    isLeftCharging: false,
    isRightCharging: false,
    isCaseCharging: false,
    placementL: 'in_ear',
    placementR: 'in_ear',
  },

  ancMode: 'anc',
  ancLevel: 'high',
  ambientVolume: 2,
  amplifyAmbient: false,
  ancWithOneEarbud: true,

  voiceDetect: true,
  voiceDetectDuration: 10,
  spatialAudio: true,
  spatialHeadTracking: true,
  gamingMode: false,
  inEarPause: true,
  seamlessConnection: true,

  eqPreset: 'dynamic',
  customEqGains: [0, 1, 2, 0, -1, 1, 2, 3, 2],

  touchControls: {
    isAllLocked: false,
    tap: true,
    doubleTap: true,
    tripleTap: true,
    touchAndHold: true,
    leftHoldAction: 'noise_control',
    rightHoldAction: 'noise_control',
  },

  fitTest: {
    isTesting: false,
    leftResult: null,
    rightResult: null,
  },
  isFindMyBudsActive: false,
  leftBeeping: false,
  rightBeeping: false,

  neckStretch: false,
  neckAngle: 0,

  firmwareVersion: 'R510XXU0AWF4',
  lastLog: 'Initialized.',

  setConnectionState: (state) => set({ connectionState: state }),
  setConnectedDevice: (device) => set({ connectedDevice: device }),
  addDiscoveredDevice: (device) =>
    set((s) => {
      const existingIdx = s.discoveredDevices.findIndex((d) => d.id === device.id);
      if (existingIdx !== -1) {
        const updated = [...s.discoveredDevices];
        updated[existingIdx] = { ...updated[existingIdx], ...device };
        return { discoveredDevices: updated };
      }
      return { discoveredDevices: [...s.discoveredDevices, device] };
    }),
  setDiscoveredDevices: (devices) => set({ discoveredDevices: devices }),
  clearDiscoveredDevices: () => set({ discoveredDevices: [] }),

  updateBattery: (battery) =>
    set((s) => ({ battery: { ...s.battery, ...battery } })),
  setAncMode: (mode) => set({ ancMode: mode }),
  setAncLevel: (level) => set({ ancLevel: level }),
  setAmbientVolume: (vol) => set({ ambientVolume: vol }),
  setAmplifyAmbient: (enabled) => set({ amplifyAmbient: enabled }),
  setAncWithOneEarbud: (enabled) => set({ ancWithOneEarbud: enabled }),

  setVoiceDetect: (enabled) => set({ voiceDetect: enabled }),
  setVoiceDetectDuration: (duration) => set({ voiceDetectDuration: duration }),
  setSpatialAudio: (enabled) => set({ spatialAudio: enabled }),
  setSpatialHeadTracking: (enabled) => set({ spatialHeadTracking: enabled }),
  setGamingMode: (enabled) => set({ gamingMode: enabled }),
  setInEarPause: (enabled) => set({ inEarPause: enabled }),
  setSeamlessConnection: (enabled) => set({ seamlessConnection: enabled }),

  setEqPreset: (preset) => set({ eqPreset: preset }),
  setCustomEqBandGain: (index, gain) =>
    set((s) => {
      const gains = [...s.customEqGains];
      gains[index] = gain;
      return { customEqGains: gains };
    }),

  updateTouchControls: (controls) =>
    set((s) => ({ touchControls: { ...s.touchControls, ...controls } })),
  setFitTestState: (fit) => set((s) => ({ fitTest: { ...s.fitTest, ...fit } })),
  setFindMyBuds: (active, left, right) =>
    set({
      isFindMyBudsActive: active,
      leftBeeping: left ?? active,
      rightBeeping: right ?? active,
    }),
  setNeckStretch: (enabled) => set({ neckStretch: enabled }),
  setNeckAngle: (angle) => set({ neckAngle: angle }),

  setFirmwareVersion: (version) => set({ firmwareVersion: version }),
  logMessage: (msg) => {
    const timestamp = new Date().toLocaleTimeString();
    set({ lastLog: `[${timestamp}] ${msg}` });
  },
}));
