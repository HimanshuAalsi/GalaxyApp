import { BleManager as PlxBleManager, Device, Subscription } from 'react-native-ble-plx';
import { Buffer } from 'buffer';
import { BLE_CONFIG } from '../constants/bluetooth';
import { useBudsStore, BudsDevice } from '../store/useBudsStore';
import { CommandDispatcher } from './CommandDispatcher';

export class BleService {
  private static instance: BleService;
  private manager: PlxBleManager;
  private activeDevice: Device | null = null;
  private pendingDeviceId: string | null = null;
  private rxSubscription: Subscription | null = null;

  private txServiceUuid: string | null = null;
  private txCharacteristicUuid: string | null = null;
  private rxServiceUuid: string | null = null;
  private rxCharacteristicUuid: string | null = null;
  private hasNotifiableEndpoint = false;

  private onRawDataReceived?: (data: Uint8Array) => void;
  private scanTimeoutTimer: NodeJS.Timeout | null = null;
  private batchSyncTimer: NodeJS.Timeout | null = null;

  // Internal device cache to eliminate frantic React re-renders and touch dropping
  private deviceCache = new Map<string, BudsDevice>();

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
   * Starts scan and automatically connects to the Buds2 Pro as soon as it is detected!
   */
  public async autoConnectOrScan(): Promise<void> {
    const isReady = await this.ensurePoweredOn();
    if (!isReady) return;

    const currentStatus = useBudsStore.getState().connectionState;
    if (currentStatus === 'connected' || currentStatus === 'connecting') return;

    useBudsStore.getState().logMessage('Scanning for your Galaxy Buds2 Pro...');
    await this.startScan(true);
  }

  /**
   * Scans for nearby devices with throttled React state syncing
   */
  public async startScan(autoConnectOnDetect: boolean = false): Promise<void> {
    const isReady = await this.ensurePoweredOn();
    if (!isReady) {
      useBudsStore.getState().logMessage('Bluetooth is not powered on or permission denied.');
      return;
    }

    const currentStatus = useBudsStore.getState().connectionState;
    if (currentStatus === 'connected' || currentStatus === 'connecting') {
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
          const item: BudsDevice = {
            id: dev.id,
            name: devName,
            rssi: -45,
            isSystemConnected: true,
            isSamsung: true,
          };
          this.deviceCache.set(dev.id, item);

          if (autoConnectOnDetect) {
            useBudsStore.getState().logMessage(`Auto-connecting to paired accessory: ${devName}...`);
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
      const isTargetBuds = Boolean(name && /Buds2\s*Pro|SM-R510|Galaxy\s*Buds/i.test(name));
      if (name && BLE_CONFIG.DEVICE_NAME_REGEX.test(name)) {
        isSamsung = true;
      }

      const displayName = isTargetBuds
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

      // AUTO-CONNECT: The moment Buds2 Pro is identified, immediately connect!
      if (autoConnectOnDetect && isTargetBuds) {
        const connState = useBudsStore.getState().connectionState;
        if (connState !== 'connecting' && connState !== 'connected') {
          useBudsStore.getState().logMessage(`Found ${displayName}! Auto-connecting...`);
          this.stopScan();
          this.connect(device.id);
        }
      }
    });

    // Auto-stop scan strictly after 6 seconds
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
      const aIsTarget = Boolean(a.name && /Buds2\s*Pro/i.test(a.name)) ? 2 : a.isSamsung ? 1 : 0;
      const bIsTarget = Boolean(b.name && /Buds2\s*Pro/i.test(b.name)) ? 2 : b.isSamsung ? 1 : 0;
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
   * Connects to designated peripheral with robust timeouts and GATT resolution
   */
  public async connect(deviceId: string): Promise<boolean> {
    try {
      this.stopScan();
      this.pendingDeviceId = deviceId;
      useBudsStore.getState().setConnectionState('connecting');
      useBudsStore.getState().logMessage(`Connecting to ${deviceId}...`);

      const connectPromise = this.manager.connectToDevice(deviceId, { autoConnect: false });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                'Connection timed out (10s). Make sure case lid is open or hold touchpads for 3s until LED blinks.'
              )
            ),
          10000
        )
      );

      const connectedDevice = await Promise.race([connectPromise, timeoutPromise]);
      this.activeDevice = connectedDevice;
      this.pendingDeviceId = null;

      connectedDevice.onDisconnected((error) => {
        useBudsStore.getState().setConnectionState('disconnected');
        useBudsStore.getState().setConnectedDevice(null);
        useBudsStore.getState().logMessage(`Disconnected: ${error?.message || 'Connection lost'}`);
        this.cleanup();
      });

      useBudsStore.getState().logMessage('Discovering GATT services...');
      await connectedDevice.discoverAllServicesAndCharacteristics();

      // Resolve TX/RX endpoints without aborting on missing notifiable characteristics
      await this.resolveGattEndpoints(connectedDevice);

      // Start notifications if available
      await this.startNotificationListener();

      useBudsStore.getState().setConnectionState('connected');
      useBudsStore.getState().setConnectedDevice({
        id: connectedDevice.id,
        name: connectedDevice.name || 'Galaxy Buds2 Pro',
        rssi: null,
        isSamsung: true,
      });
      useBudsStore.getState().logMessage('Connected! Real-time telemetry linked.');

      // Request initial telemetry status after 400ms
      setTimeout(() => {
        CommandDispatcher.getInstance().requestStatus().catch(() => {});
      }, 400);

      return true;
    } catch (error: any) {
      if (this.pendingDeviceId) {
        try {
          await this.manager.cancelDeviceConnection(this.pendingDeviceId);
        } catch {
          // Ignore
        }
        this.pendingDeviceId = null;
      }
      useBudsStore.getState().setConnectionState('disconnected');
      useBudsStore.getState().logMessage(`Connection failed: ${error.message}`);
      this.cleanup();
      return false;
    }
  }

  /**
   * Dynamic GATT characteristic resolver: inspects every discovered service
   */
  private async resolveGattEndpoints(device: Device): Promise<void> {
    this.txServiceUuid = null;
    this.txCharacteristicUuid = null;
    this.rxServiceUuid = null;
    this.rxCharacteristicUuid = null;
    this.hasNotifiableEndpoint = false;

    const services = await device.services();
    useBudsStore.getState().logMessage(`Discovered ${services.length} GATT services:`);

    let writableEndpoint: { serviceUuid: string; charUuid: string } | null = null;
    let notifiableEndpoint: { serviceUuid: string; charUuid: string } | null = null;

    // Scan all services and log their characteristics
    for (const service of services) {
      const sUuid = service.uuid.toLowerCase();
      try {
        const characteristics = await service.characteristics();
        const shortSvc = sUuid.length > 8 ? sUuid.slice(0, 8) : sUuid;
        useBudsStore.getState().logMessage(`Svc [${shortSvc}]: ${characteristics.length} chars`);

        for (const char of characteristics) {
          const cUuid = char.uuid.toLowerCase();
          const shortChar = cUuid.length > 8 ? cUuid.slice(0, 8) : cUuid;
          const isWritable = char.isWritableWithResponse || char.isWritableWithoutResponse;
          const isNotifiable = char.isNotifiable || char.isIndicatable;

          if (isWritable && !writableEndpoint) {
            writableEndpoint = { serviceUuid: service.uuid, charUuid: char.uuid };
          }
          if (isNotifiable && !notifiableEndpoint) {
            notifiableEndpoint = { serviceUuid: service.uuid, charUuid: char.uuid };
          }

          useBudsStore.getState().logMessage(
            `  Char [${shortChar}]: W=${isWritable ? '1' : '0'}, N=${isNotifiable ? '1' : '0'}`
          );
        }
      } catch {
        // Ignore unreadable service tables
      }
    }

    if (writableEndpoint) {
      this.txServiceUuid = writableEndpoint.serviceUuid;
      this.txCharacteristicUuid = writableEndpoint.charUuid;
    }
    if (notifiableEndpoint) {
      this.rxServiceUuid = notifiableEndpoint.serviceUuid;
      this.rxCharacteristicUuid = notifiableEndpoint.charUuid;
      this.hasNotifiableEndpoint = true;
    }

    useBudsStore.getState().logMessage(
      `Linked TX: [${this.txCharacteristicUuid?.slice(0, 8) || 'none'}] | RX: [${this.rxCharacteristicUuid?.slice(0, 8) || 'none'}]`
    );
  }

  private async startNotificationListener(): Promise<void> {
    if (!this.activeDevice || !this.hasNotifiableEndpoint || !this.rxServiceUuid || !this.rxCharacteristicUuid) {
      useBudsStore.getState().logMessage('No notifiable GATT characteristic available, using direct polling.');
      return;
    }

    try {
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
    } catch (err: any) {
      useBudsStore.getState().logMessage(`Notification warning: ${err.message}`);
    }
  }

  public async write(bytes: Uint8Array): Promise<boolean> {
    if (!this.activeDevice) {
      useBudsStore.getState().logMessage('Cannot write: Device not connected.');
      return false;
    }

    if (!this.txServiceUuid || !this.txCharacteristicUuid) {
      useBudsStore.getState().logMessage('Cannot write: No writable GATT characteristic resolved.');
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
    useBudsStore.getState().setConnectionState('disconnected');
    useBudsStore.getState().setConnectedDevice(null);
    useBudsStore.getState().logMessage('Disconnected.');
  }

  private cleanup(): void {
    this.rxSubscription?.remove();
    this.rxSubscription = null;
    this.activeDevice = null;
    this.pendingDeviceId = null;
    this.hasNotifiableEndpoint = false;
  }
}
