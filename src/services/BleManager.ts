import { BleManager as PlxBleManager, Device, Subscription } from 'react-native-ble-plx';
import { Buffer } from 'buffer';
import { BLE_CONFIG } from '../constants/bluetooth';
import { useBudsStore } from '../store/useBudsStore';

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
   * Dual-phase scanning engine:
   * 1. CoreBluetooth connected peripherals retrieval (for earbuds paired in iOS Settings)
   * 2. Active BLE advertising scan with Samsung Manufacturer ID (0x0075) decoding
   */
  public async startScan(): Promise<void> {
    const isReady = await this.ensurePoweredOn();
    if (!isReady) {
      useBudsStore.getState().logMessage('Bluetooth is not powered on or permission denied.');
      return;
    }

    if (this.scanTimeoutTimer) {
      clearTimeout(this.scanTimeoutTimer);
      this.scanTimeoutTimer = null;
    }

    useBudsStore.getState().clearDiscoveredDevices();
    useBudsStore.getState().setConnectionState('scanning');
    useBudsStore.getState().logMessage('Scanning for Galaxy Buds2 Pro...');

    // Phase 1: Query already-connected system peripherals (tested individually to prevent UUID syntax errors)
    for (const serviceUuid of BLE_CONFIG.VENDOR_SERVICES) {
      try {
        const peripherals = await this.manager.connectedDevices([serviceUuid]);
        for (const dev of peripherals) {
          const devName = dev.name || 'Galaxy Buds2 Pro (iOS Paired)';
          useBudsStore.getState().addDiscoveredDevice({
            id: dev.id,
            name: devName,
            rssi: -45,
            isSystemConnected: true,
            isSamsung: true,
          });
          useBudsStore.getState().logMessage(`Found paired iOS accessory: ${devName}`);
        }
      } catch {
        // Individual service query failed or not present, continue to next
      }
    }

    // Phase 2: Active BLE scan with allowDuplicates=true to capture both ADV_IND and SCAN_RSP
    this.manager.startDeviceScan(null, { allowDuplicates: true }, (error, device) => {
      if (error) {
        useBudsStore.getState().logMessage(`Scan error: ${error.message}`);
        this.stopScan();
        return;
      }

      if (device) {
        const name = device.name || device.localName;
        let isSamsung = false;
        let manufacturerDataHex: string | null = null;

        // Inspect Manufacturer Specific Data for Samsung Company Identifier (0x0075)
        if (device.manufacturerData) {
          try {
            const raw = Buffer.from(device.manufacturerData, 'base64');
            manufacturerDataHex = raw.toString('hex');
            // Little-endian 0x0075 is 0x75, 0x00
            if (raw.length >= 2 && raw[0] === 0x75 && raw[1] === 0x00) {
              isSamsung = true;
            }
          } catch {
            // Ignore malformed base64
          }
        }

        // Check advertised name
        if (name && BLE_CONFIG.DEVICE_NAME_REGEX.test(name)) {
          isSamsung = true;
        }

        // Check advertised service UUIDs
        if (
          device.serviceUUIDs?.some((uuid) =>
            BLE_CONFIG.VENDOR_SERVICES.some((svc) => uuid.toLowerCase().includes(svc.toLowerCase()))
          )
        ) {
          isSamsung = true;
        }

        // If identified as Samsung or has a readable name or RSSI, record it
        const displayName = isSamsung
          ? name || 'Samsung Galaxy Buds (Detected)'
          : name || 'Bluetooth Accessory';

        useBudsStore.getState().addDiscoveredDevice({
          id: device.id,
          name: displayName,
          rssi: device.rssi,
          isSystemConnected: false,
          isSamsung,
          rawManufacturerData: manufacturerDataHex,
        });
      }
    });

    // Auto-stop scan after 10 seconds
    this.scanTimeoutTimer = setTimeout(() => {
      this.stopScan();
    }, 10000);
  }

  public stopScan(): void {
    if (this.scanTimeoutTimer) {
      clearTimeout(this.scanTimeoutTimer);
      this.scanTimeoutTimer = null;
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

      // Guard with connection timeout to prevent indefinite CoreBluetooth hang
      const connectPromise = this.manager.connectToDevice(deviceId, { autoConnect: false });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                'Connection timed out (8s). Make sure earbuds are in charging case with lid open or touchpads held for 3s.'
              )
            ),
          BLE_CONFIG.CONNECTION_TIMEOUT_MS
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
      const discoveryPromise = connectedDevice.discoverAllServicesAndCharacteristics();
      const discoveryTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('GATT service discovery timed out.')), BLE_CONFIG.DISCOVERY_TIMEOUT_MS)
      );
      await Promise.race([discoveryPromise, discoveryTimeout]);

      try {
        await connectedDevice.requestMTU(BLE_CONFIG.TARGET_MTU);
      } catch {
        // iOS negotiates MTU automatically
      }

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
    } catch (error: any) {
      if (this.pendingDeviceId) {
        try {
          await this.manager.cancelDeviceConnection(this.pendingDeviceId);
        } catch {
          // Ignore cancellation errors
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
   * Dynamic GATT characteristic resolver: searches vendor services first, then fallbacks to any writable/notifiable pair
   */
  private async resolveGattEndpoints(device: Device): Promise<void> {
    const services = await device.services();
    useBudsStore.getState().logMessage(`Discovered ${services.length} GATT services.`);

    let writableEndpoint: { serviceUuid: string; charUuid: string } | null = null;
    let notifiableEndpoint: { serviceUuid: string; charUuid: string } | null = null;

    // Pass 1: Check known Samsung & FastPair vendor services
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
        // Skip unreadable characteristic tables
      }
    }

    // Pass 2: Fallback to any non-standard service if vendor services lacked TX/RX
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
      `GATT Channels: TX [${this.txCharacteristicUuid.slice(0, 8)}] | RX [${this.rxCharacteristicUuid.slice(0, 8)}]`
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
    useBudsStore.getState().setConnectionState('disconnected');
    useBudsStore.getState().setConnectedDevice(null);
    useBudsStore.getState().logMessage('Disconnected.');
  }

  private cleanup(): void {
    this.rxSubscription?.remove();
    this.rxSubscription = null;
    this.activeDevice = null;
    this.pendingDeviceId = null;
  }
}
