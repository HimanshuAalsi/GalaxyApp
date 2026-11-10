import { BleManager as PlxBleManager, Device, Subscription } from 'react-native-ble-plx';
import { Buffer } from 'buffer';
import { BLE_CONFIG } from '../constants/bluetooth';
import { useBudsStore, BudsDevice } from '../store/useBudsStore';

export class BleService {
  private static instance: BleService;
  private manager: PlxBleManager;
  private activeDevice: Device | null = null;
  private pendingDeviceId: string | null = null;
  private rxSubscription: Subscription | null = null;

  private txServiceUuid: string = BLE_CONFIG.SAMSUNG_SERVICE_UUID;
  private txCharacteristicUuid: string = BLE_CONFIG.CHARACTERISTIC_TX_UUID;
  private rxServiceUuid: string = BLE_CONFIG.SAMSUNG_SERVICE_UUID;
  private rxCharacteristicUuid: string = BLE_CONFIG.CHARACTERISTIC_RX_UUID;

  private onRawDataReceived?: (data: Uint8Array) => void;
  private scanTimeoutTimer: NodeJS.Timeout | null = null;
  private batchSyncTimer: NodeJS.Timeout | null = null;

  // Internal device cache to prevent frantic React re-renders
  private deviceCache = new Map<string, BudsDevice>();
  private isConnectingOrConnected = false;

  // Known / Preferred Galaxy Buds2 Pro identifier
  private preferredDeviceId = '85D47665-B1CC-B62C-8F89-689ABAFE1965';

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

  /**
   * Checks if Bluetooth is powered on with a guaranteed 3-second timeout
   */
  public async ensurePoweredOn(): Promise<boolean> {
    try {
      const state = await this.manager.state();
      if (state === 'PoweredOn') return true;

      return await new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => {
          sub.remove();
          resolve(false);
        }, 3000);

        const sub = this.manager.onStateChange((newState) => {
          if (newState === 'PoweredOn') {
            clearTimeout(timer);
            sub.remove();
            resolve(true);
          }
        }, true);
      });
    } catch {
      return false;
    }
  }

  /**
   * Auto-connect workflow:
   * First attempts direct connection to known Buds2 Pro device.
   * If not immediately connectable, starts rapid scan and auto-connects as soon as detected!
   */
  public async autoConnectOrScan(): Promise<void> {
    const isReady = await this.ensurePoweredOn();
    if (!isReady) return;

    if (this.isConnectingOrConnected) return;

    useBudsStore.getState().logMessage('Checking for Galaxy Buds2 Pro...');

    // Attempt direct link to known device ID first (quick 2.5s attempt)
    if (this.preferredDeviceId) {
      try {
        const directSuccess = await this.connectWithTimeout(this.preferredDeviceId, 2500);
        if (directSuccess) {
          useBudsStore.getState().logMessage('Direct link to Buds2 Pro succeeded!');
          return;
        }
      } catch {
        // Fallback to active scanning
      }
    }

    // Start scan to auto-discover and auto-connect
    await this.startScan(true);
  }

  /**
   * Scans for nearby devices with throttled React state syncing to prevent touch-dropping
   */
  public async startScan(autoConnectOnDetect: boolean = true): Promise<void> {
    const isReady = await this.ensurePoweredOn();
    if (!isReady) {
      useBudsStore.getState().logMessage('Bluetooth is not powered on or permission denied.');
      return;
    }

    if (this.isConnectingOrConnected) {
      return;
    }

    this.stopScan();

    this.deviceCache.clear();
    useBudsStore.getState().clearDiscoveredDevices();
    useBudsStore.getState().setConnectionState('scanning');
    useBudsStore.getState().logMessage('Scanning for Galaxy Buds2 Pro...');

    // Phase 1: Query already-connected system accessories
    for (const serviceUuid of BLE_CONFIG.VENDOR_SERVICES) {
      try {
        const peripherals = await this.manager.connectedDevices([serviceUuid]);
        for (const dev of peripherals) {
          const devName = dev.name || 'Galaxy Buds2 Pro (iOS Paired)';
          this.deviceCache.set(dev.id, {
            id: dev.id,
            name: devName,
            rssi: -45,
            isSystemConnected: true,
            isSamsung: true,
          });

          // Auto-connect if it is our target Buds
          if (autoConnectOnDetect && !this.isConnectingOrConnected) {
            this.stopScan();
            this.connect(dev.id);
            return;
          }
        }
      } catch {
        // Continue
      }
    }
    this.flushDeviceCacheToStore();

    // Phase 2: Rapid active BLE scan
    this.manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
      if (error) {
        useBudsStore.getState().logMessage(`Scan error: ${error.message}`);
        this.stopScan();
        return;
      }

      if (!device) return;

      const name = device.name || device.localName;
      let isSamsung = false;
      let manufacturerDataHex: string | null = null;

      // Inspect Samsung Company Identifier (0x0075)
      if (device.manufacturerData) {
        try {
          const raw = Buffer.from(device.manufacturerData, 'base64');
          manufacturerDataHex = raw.toString('hex');
          if (raw.length >= 2 && raw[0] === 0x75 && raw[1] === 0x00) {
            isSamsung = true;
          }
        } catch {
          // Ignore
        }
      }

      // Check advertised name
      const isBudsByName = name && /Buds2\s*Pro|SM-R510|Galaxy\s*Buds/i.test(name);
      if (name && BLE_CONFIG.DEVICE_NAME_REGEX.test(name)) {
        isSamsung = true;
      }

      const displayName = isBudsByName
        ? name
        : isSamsung
        ? name || 'Samsung Audio Device'
        : name || 'Bluetooth Accessory';

      this.deviceCache.set(device.id, {
        id: device.id,
        name: displayName,
        rssi: device.rssi,
        isSystemConnected: false,
        isSamsung,
        rawManufacturerData: manufacturerDataHex,
      });

      this.scheduleDeviceSync();

      // AUTO-CONNECT: As soon as Buds2 Pro is identified, immediately stop scan and connect!
      if (autoConnectOnDetect && (isBudsByName || (isSamsung && name && /Buds/i.test(name)))) {
        if (!this.isConnectingOrConnected) {
          useBudsStore.getState().logMessage(`Galaxy Buds2 Pro detected (${displayName})! Auto-connecting...`);
          this.preferredDeviceId = device.id;
          this.stopScan();
          this.connect(device.id);
        }
      }
    });

    // Auto-stop scan strictly after 6 seconds (no indefinite scanning!)
    this.scanTimeoutTimer = setTimeout(() => {
      this.stopScan();
    }, 6000);
  }

  private scheduleDeviceSync(): void {
    if (this.batchSyncTimer) return;
    this.batchSyncTimer = setTimeout(() => {
      this.batchSyncTimer = null;
      this.flushDeviceCacheToStore();
    }, 350);
  }

  private flushDeviceCacheToStore(): void {
    const list = Array.from(this.deviceCache.values());
    list.sort((a, b) => {
      const aIsTarget = a.name && /Buds2\s*Pro/i.test(a.name) ? 2 : a.isSamsung ? 1 : 0;
      const bIsTarget = b.name && /Buds2\s*Pro/i.test(b.name) ? 2 : b.isSamsung ? 1 : 0;
      if (aIsTarget !== bIsTarget) return bIsTarget - aIsTarget;
      return (b.rssi ?? -999) - (a.rssi ?? -999);
    });
    useBudsStore.getState().setDiscoveredDevices(list);
  }

  public stopScan(): void {
    if (this.scanTimeoutTimer) {
      clearTimeout(this.scanTimeoutTimer);
      this.scanTimeoutTimer = null;
    }
    if (this.batchSyncTimer) {
      clearTimeout(this.batchSyncTimer);
      this.batchSyncTimer = null;
    }
    this.manager.stopDeviceScan();
    if (useBudsStore.getState().connectionState === 'scanning') {
      useBudsStore.getState().setConnectionState('disconnected');
      useBudsStore.getState().logMessage('Scan completed.');
    }
  }

  /**
   * Internal connection helper with strict timeout
   */
  private async connectWithTimeout(deviceId: string, timeoutMs: number): Promise<boolean> {
    this.pendingDeviceId = deviceId;
    this.isConnectingOrConnected = true;

    const connectPromise = this.manager.connectToDevice(deviceId, { autoConnect: false });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Connection timed out')), timeoutMs)
    );

    const connectedDevice = await Promise.race([connectPromise, timeoutPromise]);
    this.activeDevice = connectedDevice;
    this.pendingDeviceId = null;
    this.preferredDeviceId = deviceId;

    connectedDevice.onDisconnected((error) => {
      this.isConnectingOrConnected = false;
      useBudsStore.getState().setConnectionState('disconnected');
      useBudsStore.getState().setConnectedDevice(null);
      useBudsStore.getState().logMessage(`Disconnected: ${error?.message || 'Connection lost'}`);
      this.cleanup();
    });

    useBudsStore.getState().logMessage('Discovering GATT services...');
    await connectedDevice.discoverAllServicesAndCharacteristics();

    await this.resolveGattEndpoints(connectedDevice);
    await this.startNotificationListener();

    useBudsStore.getState().setConnectionState('connected');
    useBudsStore.getState().setConnectedDevice({
      id: connectedDevice.id,
      name: connectedDevice.name || 'Galaxy Buds2 Pro',
      rssi: null,
      isSamsung: true,
    });
    useBudsStore.getState().logMessage('Connected! Real-time telemetry linked.');

    return true;
  }

  /**
   * Public connect method called when tapping a device or auto-connecting
   */
  public async connect(deviceId: string): Promise<boolean> {
    try {
      this.stopScan();
      useBudsStore.getState().setConnectionState('connecting');
      useBudsStore.getState().logMessage(`Connecting to ${deviceId}...`);

      const success = await this.connectWithTimeout(deviceId, BLE_CONFIG.CONNECTION_TIMEOUT_MS);
      return success;
    } catch (error: any) {
      if (this.pendingDeviceId) {
        try {
          await this.manager.cancelDeviceConnection(this.pendingDeviceId);
        } catch {
          // Ignore
        }
        this.pendingDeviceId = null;
      }
      this.isConnectingOrConnected = false;
      useBudsStore.getState().setConnectionState('disconnected');
      useBudsStore.getState().logMessage(`Connection failed: ${error.message}`);
      this.cleanup();
      return false;
    }
  }

  /**
   * Dynamic GATT characteristic resolver
   */
  private async resolveGattEndpoints(device: Device): Promise<void> {
    const services = await device.services();
    useBudsStore.getState().logMessage(`Found ${services.length} GATT services.`);

    let writableEndpoint: { serviceUuid: string; charUuid: string } | null = null;
    let notifiableEndpoint: { serviceUuid: string; charUuid: string } | null = null;

    // Check Samsung vendor services first
    for (const service of services) {
      const sUuid = service.uuid.toLowerCase();
      const isVendorService =
        sUuid.includes('fd5a') ||
        sUuid.includes('2e73') ||
        sUuid.includes('fe2c') ||
        sUuid.includes('a23d') ||
        sUuid.includes('b4a9') ||
        sUuid.includes('e74b') ||
        sUuid.includes('e7ab') ||
        sUuid.includes('d908');

      if (!isVendorService) continue;

      try {
        const characteristics = await service.characteristics();
        for (const char of characteristics) {
          if ((char.isWritableWithResponse || char.isWritableWithoutResponse) && !writableEndpoint) {
            writableEndpoint = { serviceUuid: service.uuid, charUuid: char.uuid };
          }
          if ((char.isNotifiable || char.isIndicatable) && !notifiableEndpoint) {
            notifiableEndpoint = { serviceUuid: service.uuid, charUuid: char.uuid };
          }
        }
      } catch {
        // Skip
      }
    }

    // Fallback: any non-standard service
    if (!writableEndpoint || !notifiableEndpoint) {
      for (const service of services) {
        const sUuid = service.uuid.toLowerCase();
        if (sUuid.startsWith('00001800') || sUuid.startsWith('00001801')) continue;

        try {
          const characteristics = await service.characteristics();
          for (const char of characteristics) {
            if ((char.isWritableWithResponse || char.isWritableWithoutResponse) && !writableEndpoint) {
              writableEndpoint = { serviceUuid: service.uuid, charUuid: char.uuid };
            }
            if ((char.isNotifiable || char.isIndicatable) && !notifiableEndpoint) {
              notifiableEndpoint = { serviceUuid: service.uuid, charUuid: char.uuid };
            }
          }
        } catch {
          // Skip
        }
      }
    }

    if (writableEndpoint) {
      this.txServiceUuid = writableEndpoint.serviceUuid;
      this.txCharacteristicUuid = writableEndpoint.charUuid;
    }
    if (notifiableEndpoint) {
      this.rxServiceUuid = notifiableEndpoint.serviceUuid;
      this.rxCharacteristicUuid = notifiableEndpoint.charUuid;
    }

    useBudsStore.getState().logMessage(
      `GATT: TX [${this.txCharacteristicUuid.slice(0, 8)}] | RX [${this.rxCharacteristicUuid.slice(0, 8)}]`
    );
  }

  private async startNotificationListener(): Promise<void> {
    if (!this.activeDevice) return;

    this.rxSubscription?.remove();

    this.rxSubscription = this.activeDevice.monitorCharacteristicForService(
      this.rxServiceUuid,
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
        this.txServiceUuid,
        this.txCharacteristicUuid,
        base64Data
      );
      return true;
    } catch {
      try {
        const base64Data = Buffer.from(bytes).toString('base64');
        await this.activeDevice.writeCharacteristicWithResponseForService(
          this.txServiceUuid,
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
    if (this.pendingDeviceId) {
      try {
        await this.manager.cancelDeviceConnection(this.pendingDeviceId);
      } catch {
        // Ignored
      }
      this.pendingDeviceId = null;
    }

    if (this.activeDevice) {
      try {
        await this.activeDevice.cancelConnection();
      } catch {
        // Ignored
      }
    }
    this.cleanup();
    this.isConnectingOrConnected = false;
    useBudsStore.getState().setConnectionState('disconnected');
    useBudsStore.getState().setConnectedDevice(null);
    useBudsStore.getState().logMessage('Disconnected.');
  }

  private cleanup(): void {
    this.rxSubscription?.remove();
    this.rxSubscription = null;
    this.activeDevice = null;
    this.pendingDeviceId = null;
    this.isConnectingOrConnected = false;
  }
}
