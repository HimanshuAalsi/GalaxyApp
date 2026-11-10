import { BleManager as PlxBleManager, Device, Subscription } from 'react-native-ble-plx';
import { Buffer } from 'buffer';
import { BLE_CONFIG } from '../constants/bluetooth';
import { useBudsStore } from '../store/useBudsStore';

export class BleService {
  private static instance: BleService;
  private manager: PlxBleManager;
  private activeDevice: Device | null = null;
  private rxSubscription: Subscription | null = null;
  private txCharacteristicUuid: string = BLE_CONFIG.CHARACTERISTIC_TX_UUID;
  private rxCharacteristicUuid: string = BLE_CONFIG.CHARACTERISTIC_RX_UUID;
  private serviceUuid: string = BLE_CONFIG.SAMSUNG_SERVICE_UUID;

  private onRawDataReceived?: (data: Uint8Array) => void;

  private constructor() {
    this.manager = new PlxBleManager();
  }

  public static getInstance(): BleService {
    if (!BleService.instance) {
      BleService.instance = new BleService();
    }
    return BleService.instance;
  }

  public setRawDataListener(callback: (data: Uint8Array) => void): void {
    this.onRawDataReceived = callback;
  }

  public async ensurePoweredOn(): Promise<boolean> {
    try {
      const state = await this.manager.state();
      if (state === 'PoweredOn') return true;

      return new Promise((resolve) => {
        const subscription = this.manager.onStateChange((newState) => {
          if (newState === 'PoweredOn') {
            subscription.remove();
            resolve(true);
          }
        }, true);
      });
    } catch (e) {
      return false;
    }
  }

  /**
   * Dual-phase scanning:
   * 1. CoreBluetooth connected peripherals retrieval (for earbuds already paired in iOS Settings).
   * 2. Active BLE advertising scan (for earbuds in open case/pairing mode).
   */
  public async startScan(): Promise<void> {
    const isReady = await this.ensurePoweredOn();
    if (!isReady) {
      useBudsStore.getState().logMessage('Bluetooth is not powered on.');
      return;
    }

    useBudsStore.getState().clearDiscoveredDevices();
    useBudsStore.getState().setConnectionState('scanning');
    useBudsStore.getState().logMessage('Scanning for Galaxy Buds2 Pro...');

    // Phase 1: Check if already paired in iOS Bluetooth Settings
    try {
      const pairedPeripherals = await this.manager.connectedDevices(BLE_CONFIG.RETRIEVAL_SERVICES);
      for (const dev of pairedPeripherals) {
        useBudsStore.getState().addDiscoveredDevice({
          id: dev.id,
          name: dev.name || 'Galaxy Buds2 Pro (Paired)',
          rssi: -40,
          isSystemConnected: true,
        });
        useBudsStore.getState().logMessage(`Found paired iOS accessory: ${dev.name || dev.id}`);
      }
    } catch (e: any) {
      // Ignore retrieval errors on devices with no connected devices
    }

    // Phase 2: Active scan for nearby advertising devices
    this.manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
      if (error) {
        useBudsStore.getState().logMessage(`Scan error: ${error.message}`);
        this.stopScan();
        return;
      }

      if (device) {
        const name = device.name || device.localName;
        const matchesName = name && BLE_CONFIG.DEVICE_NAME_REGEX.test(name);
        const matchesService = device.serviceUUIDs?.some((uuid) =>
          BLE_CONFIG.RETRIEVAL_SERVICES.some((svc) => uuid.toLowerCase().includes(svc.toLowerCase()))
        );

        if (matchesName || matchesService) {
          useBudsStore.getState().addDiscoveredDevice({
            id: device.id,
            name: name || 'Galaxy Buds2 Pro',
            rssi: device.rssi,
            isSystemConnected: false,
          });
        }
      }
    });

    // Auto-stop scan after 12 seconds
    setTimeout(() => {
      this.stopScan();
    }, 12000);
  }

  public stopScan(): void {
    this.manager.stopDeviceScan();
    if (useBudsStore.getState().connectionState === 'scanning') {
      useBudsStore.getState().setConnectionState('disconnected');
      useBudsStore.getState().logMessage('Scan completed.');
    }
  }

  /**
   * Connects to designated peripheral and resolves GATT characteristics
   */
  public async connect(deviceId: string): Promise<boolean> {
    try {
      this.stopScan();
      useBudsStore.getState().setConnectionState('connecting');
      useBudsStore.getState().logMessage(`Connecting to ${deviceId}...`);

      const connectedDevice = await this.manager.connectToDevice(deviceId, {
        autoConnect: false,
      });
      this.activeDevice = connectedDevice;

      connectedDevice.onDisconnected((error) => {
        useBudsStore.getState().setConnectionState('disconnected');
        useBudsStore.getState().setConnectedDevice(null);
        useBudsStore.getState().logMessage(`Disconnected: ${error?.message || 'Connection lost'}`);
        this.cleanup();
      });

      useBudsStore.getState().logMessage('Discovering GATT services...');
      await connectedDevice.discoverAllServicesAndCharacteristics();

      try {
        await connectedDevice.requestMTU(BLE_CONFIG.TARGET_MTU);
      } catch (e) {
        // iOS negotiates MTU automatically
      }

      await this.resolveGattEndpoints(connectedDevice);
      await this.startNotificationListener();

      useBudsStore.getState().setConnectionState('connected');
      useBudsStore.getState().setConnectedDevice({
        id: connectedDevice.id,
        name: connectedDevice.name || 'Galaxy Buds2 Pro',
        rssi: null,
      });
      useBudsStore.getState().logMessage('Connected! Real-time telemetry linked.');

      return true;
    } catch (error: any) {
      useBudsStore.getState().setConnectionState('disconnected');
      useBudsStore.getState().logMessage(`Connection failed: ${error.message}`);
      this.cleanup();
      return false;
    }
  }

  /**
   * Inspects all discovered services & characteristics to establish bidirectional communication
   */
  private async resolveGattEndpoints(device: Device): Promise<void> {
    const services = await device.services();

    let matchedService = services.find(
      (s) =>
        s.uuid.toLowerCase().includes('fd5a') ||
        s.uuid.toLowerCase().includes('2e73') ||
        s.uuid.toLowerCase().includes('fe2c')
    );

    if (!matchedService) {
      // Pick first non-generic standard service
      matchedService = services.find((s) => !s.uuid.toLowerCase().startsWith('0000180'));
    }

    if (!matchedService && services.length > 0) {
      matchedService = services[0];
    }

    if (matchedService) {
      this.serviceUuid = matchedService.uuid;
      const characteristics = await matchedService.characteristics();

      for (const char of characteristics) {
        if (char.isWritableWithResponse || char.isWritableWithoutResponse) {
          this.txCharacteristicUuid = char.uuid;
        }
        if (char.isNotifiable || char.isIndicatable) {
          this.rxCharacteristicUuid = char.uuid;
        }
      }
      useBudsStore
        .getState()
        .logMessage(`GATT Service: ${this.serviceUuid.slice(0, 8)} | TX: ${this.txCharacteristicUuid.slice(0, 8)} | RX: ${this.rxCharacteristicUuid.slice(0, 8)}`);
    }
  }

  private async startNotificationListener(): Promise<void> {
    if (!this.activeDevice) return;

    this.rxSubscription?.remove();

    this.rxSubscription = this.activeDevice.monitorCharacteristicForService(
      this.serviceUuid,
      this.rxCharacteristicUuid,
      (error, characteristic) => {
        if (error) {
          useBudsStore.getState().logMessage(`RX error: ${error.message}`);
          return;
        }

        if (characteristic?.value) {
          const rawBuffer = Buffer.from(characteristic.value, 'base64');
          const uint8Array = new Uint8Array(rawBuffer.buffer, rawBuffer.byteOffset, rawBuffer.length);
          this.onRawDataReceived?.(uint8Array);
        }
      }
    );
  }

  public async write(bytes: Uint8Array): Promise<boolean> {
    if (!this.activeDevice) {
      useBudsStore.getState().logMessage('Cannot write: Device not connected.');
      return false;
    }

    try {
      const base64Data = Buffer.from(bytes).toString('base64');
      await this.activeDevice.writeCharacteristicWithoutResponseForService(
        this.serviceUuid,
        this.txCharacteristicUuid,
        base64Data
      );
      return true;
    } catch {
      try {
        const base64Data = Buffer.from(bytes).toString('base64');
        await this.activeDevice.writeCharacteristicWithResponseForService(
          this.serviceUuid,
          this.txCharacteristicUuid,
          base64Data
        );
        return true;
      } catch (err: any) {
        useBudsStore.getState().logMessage(`Write failed: ${err.message}`);
        return false;
      }
    }
  }

  public async disconnect(): Promise<void> {
    if (this.activeDevice) {
      try {
        await this.activeDevice.cancelConnection();
      } catch (e) {
        // Ignored
      }
    }
    this.cleanup();
  }

  private cleanup(): void {
    this.rxSubscription?.remove();
    this.rxSubscription = null;
    this.activeDevice = null;
  }
}
