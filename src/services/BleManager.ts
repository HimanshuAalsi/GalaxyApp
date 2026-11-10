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

  // Callback to stream raw incoming bytes to CommandDispatcher / PacketFraming
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

  /**
   * Initializes Bluetooth adapter state listener.
   */
  public async ensurePoweredOn(): Promise<boolean> {
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
  }

  /**
   * Scans for Galaxy Buds2 Pro peripherals.
   */
  public async startScan(): Promise<void> {
    const isReady = await this.ensurePoweredOn();
    if (!isReady) {
      useBudsStore.getState().logMessage('Bluetooth is not powered on');
      return;
    }

    useBudsStore.getState().clearDiscoveredDevices();
    useBudsStore.getState().setConnectionState('scanning');
    useBudsStore.getState().logMessage('Scanning for Galaxy Buds2 Pro...');

    // Scan all devices and filter by name or service to ensure compatibility across firmware
    this.manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
      if (error) {
        useBudsStore.getState().logMessage(`Scan error: ${error.message}`);
        this.stopScan();
        return;
      }

      if (device) {
        const name = device.name || device.localName;
        const matchesName = name && BLE_CONFIG.DEVICE_NAME_REGEX.test(name);
        const matchesService =
          device.serviceUUIDs &&
          device.serviceUUIDs.some((uuid) =>
            uuid.toLowerCase().includes(BLE_CONFIG.SHORT_SERVICE_UUID)
          );

        if (matchesName || matchesService) {
          useBudsStore.getState().addDiscoveredDevice({
            id: device.id,
            name: name || 'Galaxy Buds2 Pro (BLE)',
            rssi: device.rssi,
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
   * Connects to the designated Galaxy Buds peripheral and discovers services/characteristics.
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

      // Monitor unexpected disconnection
      connectedDevice.onDisconnected((error, dev) => {
        useBudsStore.getState().setConnectionState('disconnected');
        useBudsStore.getState().setConnectedDevice(null);
        useBudsStore.getState().logMessage(`Disconnected: ${error?.message || 'Connection lost'}`);
        this.cleanup();
      });

      // Discover GATT Services and Characteristics
      useBudsStore.getState().logMessage('Discovering GATT services...');
      await connectedDevice.discoverAllServicesAndCharacteristics();

      // Request larger MTU for fast telemetry transfer
      try {
        await connectedDevice.requestMTU(BLE_CONFIG.TARGET_MTU);
      } catch (e) {
        // iOS manages BLE MTU negotiation automatically; safe to continue
      }

      // Resolve Service and Characteristics
      await this.resolveGattEndpoints(connectedDevice);

      // Start listening to notifications (RX)
      await this.startNotificationListener();

      useBudsStore.getState().setConnectionState('connected');
      useBudsStore.getState().setConnectedDevice({
        id: connectedDevice.id,
        name: connectedDevice.name || 'Galaxy Buds2 Pro',
        rssi: null,
      });
      useBudsStore.getState().logMessage('Connected and GATT stream established.');

      return true;
    } catch (error: any) {
      useBudsStore.getState().setConnectionState('disconnected');
      useBudsStore.getState().logMessage(`Connection failed: ${error.message}`);
      this.cleanup();
      return false;
    }
  }

  /**
   * Locates the primary Samsung Wearable service and TX/RX characteristics,
   * with automatic fallback detection for writeable and notifiable descriptors.
   */
  private async resolveGattEndpoints(device: Device): Promise<void> {
    const services = await device.services();

    let matchedService = services.find((s) =>
      s.uuid.toLowerCase().includes(BLE_CONFIG.SHORT_SERVICE_UUID)
    );

    // Fallback: pick the first non-generic GATT service if 0xFD5A is masked
    if (!matchedService) {
      matchedService = services.find(
        (s) => !s.uuid.toLowerCase().startsWith('0000180') // Exclude Generic Access, Battery, etc.
      );
    }

    if (matchedService) {
      this.serviceUuid = matchedService.uuid;
      const characteristics = await matchedService.characteristics();

      // Look for explicit Samsung characteristic UUIDs or infer by capability
      for (const char of characteristics) {
        const uuidLower = char.uuid.toLowerCase();
        if (uuidLower === BLE_CONFIG.CHARACTERISTIC_TX_UUID || (char.isWritableWithResponse || char.isWritableWithoutResponse)) {
          this.txCharacteristicUuid = char.uuid;
        }
        if (uuidLower === BLE_CONFIG.CHARACTERISTIC_RX_UUID || (char.isNotifiable || char.isIndicatable)) {
          this.rxCharacteristicUuid = char.uuid;
        }
      }
    }
  }

  /**
   * Subscribes to the RX characteristic to receive incoming telemetry packets.
   */
  private async startNotificationListener(): Promise<void> {
    if (!this.activeDevice) return;

    this.rxSubscription?.remove();

    this.rxSubscription = this.activeDevice.monitorCharacteristicForService(
      this.serviceUuid,
      this.rxCharacteristicUuid,
      (error, characteristic) => {
        if (error) {
          useBudsStore.getState().logMessage(`Notification error: ${error.message}`);
          return;
        }

        if (characteristic?.value) {
          // react-native-ble-plx yields base64 string
          const rawBuffer = Buffer.from(characteristic.value, 'base64');
          const uint8Array = new Uint8Array(rawBuffer.buffer, rawBuffer.byteOffset, rawBuffer.length);
          this.onRawDataReceived?.(uint8Array);
        }
      }
    );
  }

  /**
   * Transmits raw framed byte array to the Galaxy Buds TX characteristic.
   */
  public async write(bytes: Uint8Array): Promise<boolean> {
    if (!this.activeDevice) {
      useBudsStore.getState().logMessage('Cannot send command: Device not connected.');
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
    } catch (err: any) {
      // Retry with response if writeWithoutResponse fails
      try {
        const base64Data = Buffer.from(bytes).toString('base64');
        await this.activeDevice.writeCharacteristicWithResponseForService(
          this.serviceUuid,
          this.txCharacteristicUuid,
          base64Data
        );
        return true;
      } catch (retryErr: any) {
        useBudsStore.getState().logMessage(`Write error: ${retryErr.message}`);
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

