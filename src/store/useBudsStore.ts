import { create } from 'zustand';
import { NoiseControlMode } from '../constants/protocol';

export type ConnectionState = 'disconnected' | 'scanning' | 'connecting' | 'connected';

export interface BatteryState {
  left: number;
  right: number;
  case: number;
  isLeftCharging: boolean;
  isRightCharging: boolean;
  isCaseCharging: boolean;
}

export interface BudsDevice {
  id: string;
  name: string | null;
  rssi: number | null;
}

export interface BudsStore {
  // Connection
  connectionState: ConnectionState;
  connectedDevice: BudsDevice | null;
  discoveredDevices: BudsDevice[];

  // Hardware Status
  battery: BatteryState;
  isLeftInEar: boolean;
  isRightInEar: boolean;

  // Features
  ancMode: NoiseControlMode;
  isTouchLocked: boolean;
  firmwareVersion: string;

  // Diagnostics
  lastLog: string;

  // Actions
  setConnectionState: (state: ConnectionState) => void;
  setConnectedDevice: (device: BudsDevice | null) => void;
  addDiscoveredDevice: (device: BudsDevice) => void;
  clearDiscoveredDevices: () => void;

  updateBattery: (battery: Partial<BatteryState>) => void;
  setWearStatus: (left: boolean, right: boolean) => void;
  setAncMode: (mode: NoiseControlMode) => void;
  setTouchLocked: (locked: boolean) => void;
  setFirmwareVersion: (version: string) => void;
  logMessage: (msg: string) => void;
}

export const useBudsStore = create<BudsStore>((set) => ({
  connectionState: 'disconnected',
  connectedDevice: null,
  discoveredDevices: [],

  battery: {
    left: 85,
    right: 85,
    case: 92,
    isLeftCharging: false,
    isRightCharging: false,
    isCaseCharging: false,
  },
  isLeftInEar: true,
  isRightInEar: true,

  ancMode: 'anc',
  isTouchLocked: false,
  firmwareVersion: 'R510XXU0AWF4',
  lastLog: 'Initialized.',

  setConnectionState: (state) => set({ connectionState: state }),
  setConnectedDevice: (device) => set({ connectedDevice: device }),
  addDiscoveredDevice: (device) =>
    set((s) => {
      if (s.discoveredDevices.some((d) => d.id === device.id)) return s;
      return { discoveredDevices: [...s.discoveredDevices, device] };
    }),
  clearDiscoveredDevices: () => set({ discoveredDevices: [] }),

  updateBattery: (battery) =>
    set((s) => ({ battery: { ...s.battery, ...battery } })),
  setWearStatus: (left, right) =>
    set({ isLeftInEar: left, isRightInEar: right }),
  setAncMode: (mode) => set({ ancMode: mode }),
  setTouchLocked: (locked) => set({ isTouchLocked: locked }),
  setFirmwareVersion: (version) => set({ firmwareVersion: version }),
  logMessage: (msg) => {
    const timestamp = new Date().toLocaleTimeString();
    set({ lastLog: `[${timestamp}] ${msg}` });
  },
}));

