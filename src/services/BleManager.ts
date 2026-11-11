import { BleManager as PlxBleManager, Device, Subscription } from 'react-native-ble-plx';
import { Buffer } from 'buffer';
import { BLE_CONFIG } from '../constants/bluetooth';
import { useBudsStore, BudsDevice, DiscoveredGattService, DiscoveredGattCharacteristic } from '../store/useBudsStore';
import { CommandDispatcher } from './CommandDispatcher';

export class BleService {
  private static instance: BleService;
  private manager: PlxBleManager;
  private activeDevice: Device | null = null;
  private pendingDeviceId: string | null = null;
  private rxSubscription: Subscription | null = null;
  private batterySubscription: Subscription | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private userInitiatedDisconnect = false;

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
      this.userInitiatedDisconnect = false;
      this.pendingDeviceId = deviceId;
      useBudsStore.getState().setConnectionState('connecting');
      useBudsStore.getState().logMessage(`Connecting to ${deviceId}...`);

      const connectPromise = this.manager.connectToDevice(deviceId, { autoConnect: false });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                'Connection timed out (10s). Make sure case lid is open or wear earbuds.'
              )
            ),
          10000
        )
      );

      const connectedDevice = await Promise.race([connectPromise, timeoutPromise]);
      this.activeDevice = connectedDevice;
      this.pendingDeviceId = null;
      this.reconnectAttempts = 0;

      connectedDevice.onDisconnected((error) => {
        this.stopHeartbeat();
        const wasConnected = useBudsStore.getState().connectionState === 'connected';
        useBudsStore.getState().setConnectionState('disconnected');
        useBudsStore.getState().setConnectedDevice(null);
        useBudsStore.getState().logMessage(`Disconnected: ${error?.message || 'Connection lost'}`);
        this.cleanup();

        // Auto-reconnect if not explicitly disconnected by user
        if (wasConnected && !this.userInitiatedDisconnect && this.reconnectAttempts < 3) {
          this.reconnectAttempts++;
          useBudsStore.getState().logMessage(`Reconnecting to Buds2 Pro (attempt ${this.reconnectAttempts}/3)...`);
          this.reconnectTimer = setTimeout(() => {
            this.connect(deviceId);
          }, 1500);
        }
      });

      useBudsStore.getState().logMessage('Discovering GATT services...');
      await connectedDevice.discoverAllServicesAndCharacteristics();

      // Resolve TX/RX endpoints prioritizing vendor & Samsung services
      await this.resolveGattEndpoints(connectedDevice);

      // Start notifications if available
      await this.startNotificationListener();

      // Read standard battery service (0x180F) for immediate battery level display
      await this.readAndMonitorBatteryService(connectedDevice);

      useBudsStore.getState().setConnectionState('connected');
      useBudsStore.getState().setConnectedDevice({
        id: connectedDevice.id,
        name: connectedDevice.name || 'Galaxy Buds2 Pro',
        rssi: null,
        isSamsung: true,
      });
      useBudsStore.getState().logMessage('Connected! Real-time telemetry linked.');

      // Start heartbeat every 3 seconds to keep Buds connection alive
      this.startHeartbeat();

      // Request initial telemetry status after 300ms
      setTimeout(() => {
        CommandDispatcher.getInstance().requestStatus().catch(() => {});
      }, 300);

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
   * Prioritized GATT characteristic resolver:
   * 1. Inspects and catalogs every service and characteristic into store
   * 2. Finds known Samsung vendor UUIDs or 128-bit custom vendor services
   * 3. Avoids standard Bluetooth SIG adopted services (0x1800, 0x1801, 0x180a) for data packets
   */
  private async resolveGattEndpoints(device: Device): Promise<void> {
    this.txServiceUuid = null;
    this.txCharacteristicUuid = null;
    this.rxServiceUuid = null;
    this.rxCharacteristicUuid = null;
    this.hasNotifiableEndpoint = false;

    const rawServices = await device.services();
    const discoveredCatalog: DiscoveredGattService[] = [];

    useBudsStore.getState().logMessage(`Discovered ${rawServices.length} GATT services:`);

    for (const service of rawServices) {
      const sUuid = service.uuid.toLowerCase();
      const isVendor = !sUuid.startsWith('000018');
      const charList: DiscoveredGattCharacteristic[] = [];

      try {
        const characteristics = await service.characteristics();
        const shortSvc = sUuid.length > 8 ? sUuid.slice(0, 8) : sUuid;
        useBudsStore.getState().logMessage(`Svc [${shortSvc}]: ${characteristics.length} chars (vendor=${isVendor ? '1' : '0'})`);

        for (const c of characteristics) {
          const cUuid = c.uuid.toLowerCase();
          const shortChar = cUuid.length > 8 ? cUuid.slice(0, 8) : cUuid;
          const isWritable = Boolean(c.isWritableWithResponse || c.isWritableWithoutResponse);
          const isNotifiable = Boolean(c.isNotifiable);
          const isIndicatable = Boolean(c.isIndicatable);
          const isReadable = Boolean(c.isReadable);

          charList.push({
            serviceUuid: service.uuid,
            charUuid: c.uuid,
            isWritable,
            isNotifiable,
            isIndicatable,
            isReadable,
          });

          useBudsStore.getState().logMessage(
            `  Char [${shortChar}]: W=${isWritable ? '1' : '0'}, N=${isNotifiable || isIndicatable ? '1' : '0'}, R=${isReadable ? '1' : '0'}`
          );
        }
      } catch {
        // Ignore unreadable service tables
      }

      discoveredCatalog.push({
        uuid: service.uuid,
        isVendor,
        characteristics: charList,
      });
    }

    useBudsStore.getState().setDiscoveredServices(discoveredCatalog);

    let candidateTx: { serviceUuid: string; charUuid: string } | null = null;
    let candidateRx: { serviceUuid: string; charUuid: string } | null = null;

    const isKnownSamsungSvc = (uuid: string) => {
      const lower = uuid.toLowerCase();
      return BLE_CONFIG.VENDOR_SERVICES.some((v) => lower.includes(v.toLowerCase()));
    };

    // Priority 1: Known Samsung Vendor Services (e.g. 2e73a4ad-..., 0000fd5a-...)
    for (const svc of discoveredCatalog) {
      if (isKnownSamsungSvc(svc.uuid)) {
        for (const c of svc.characteristics) {
          if ((c.isNotifiable || c.isIndicatable) && !candidateRx) {
            candidateRx = { serviceUuid: svc.uuid, charUuid: c.charUuid };
          }
          if (c.isWritable && !candidateTx) {
            candidateTx = { serviceUuid: svc.uuid, charUuid: c.charUuid };
          }
        }
      }
    }

    // Priority 2: Any 128-bit Vendor Service (Non-0x18xx)
    if (!candidateTx || !candidateRx) {
      for (const svc of discoveredCatalog) {
        if (svc.isVendor) {
          for (const c of svc.characteristics) {
            if ((c.isNotifiable || c.isIndicatable) && !candidateRx) {
              candidateRx = { serviceUuid: svc.uuid, charUuid: c.charUuid };
            }
            if (c.isWritable && !candidateTx) {
              candidateTx = { serviceUuid: svc.uuid, charUuid: c.charUuid };
            }
          }
        }
      }
    }

    // Priority 3: If candidateTx is found, check if that same characteristic or service has RX
    if (candidateTx) {
      const sameService = discoveredCatalog.find(
        (s) => s.uuid.toLowerCase() === candidateTx!.serviceUuid.toLowerCase()
      );
      if (sameService) {
        // If the writable characteristic is ALSO notifiable, it is a unified duplex stream
        const txChar = sameService.characteristics.find(
          (c) => c.charUuid.toLowerCase() === candidateTx!.charUuid.toLowerCase()
        );
        if (txChar && (txChar.isNotifiable || txChar.isIndicatable)) {
          candidateRx = candidateTx;
        } else {
          const rxInSame = sameService.characteristics.find((c) => c.isNotifiable || c.isIndicatable);
          if (rxInSame) {
            candidateRx = { serviceUuid: sameService.uuid, charUuid: rxInSame.charUuid };
          }
        }
      }
    }

    // Fallback: If still no endpoints, look for any non-standard characteristic
    if (!candidateTx || !candidateRx) {
      for (const svc of discoveredCatalog) {
        const sLower = svc.uuid.toLowerCase();
        // Skip GAP (1800) and GATT (1801)
        if (sLower.startsWith('00001800') || sLower.startsWith('00001801')) continue;

        for (const c of svc.characteristics) {
          if (!candidateTx && c.isWritable) {
            candidateTx = { serviceUuid: svc.uuid, charUuid: c.charUuid };
          }
          if (!candidateRx && (c.isNotifiable || c.isIndicatable)) {
            candidateRx = { serviceUuid: svc.uuid, charUuid: c.charUuid };
          }
        }
      }
    }

    if (candidateTx) {
      this.txServiceUuid = candidateTx.serviceUuid;
      this.txCharacteristicUuid = candidateTx.charUuid;
      useBudsStore.getState().setActiveTxEndpoint(candidateTx);
    }
    if (candidateRx) {
      this.rxServiceUuid = candidateRx.serviceUuid;
      this.rxCharacteristicUuid = candidateRx.charUuid;
      this.hasNotifiableEndpoint = true;
      useBudsStore.getState().setActiveRxEndpoint(candidateRx);
    }

    useBudsStore.getState().logMessage(
      `Resolved TX: [${this.txCharacteristicUuid?.slice(0, 8) || 'none'}] | RX: [${this.rxCharacteristicUuid?.slice(0, 8) || 'none'}]`
    );
  }

  /**
   * Reads standard Bluetooth Battery Service (0x180F / 0x2A19) for immediate telemetry
   */
  private async readAndMonitorBatteryService(device: Device): Promise<void> {
    const BATT_SVC = '0000180f-0000-1000-8000-00805f9b34fb';
    const BATT_CHAR = '00002a19-0000-1000-8000-00805f9b34fb';

    try {
      const c = await device.readCharacteristicForService(BATT_SVC, BATT_CHAR);
      if (c?.value) {
        const val = Buffer.from(c.value, 'base64')[0];
        if (typeof val === 'number' && val >= 0 && val <= 100) {
          useBudsStore.getState().updateBattery({ left: val, right: val });
          useBudsStore.getState().logMessage(`Standard Battery Read: ${val}%`);
        }
      }
    } catch {
      // 0x180F read optional
    }

    try {
      this.batterySubscription?.remove();
      this.batterySubscription = device.monitorCharacteristicForService(
        BATT_SVC,
        BATT_CHAR,
        (err, char) => {
          if (!err && char?.value) {
            const val = Buffer.from(char.value, 'base64')[0];
            if (typeof val === 'number' && val >= 0 && val <= 100) {
              useBudsStore.getState().updateBattery({ left: val, right: val });
            }
          }
        }
      );
    } catch {
      // 0x180F notification optional
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(async () => {
      if (this.activeDevice && useBudsStore.getState().connectionState === 'connected') {
        try {
          await CommandDispatcher.getInstance().requestStatus();
        } catch {
          // Heartbeat keepalive ping
        }
      }
    }, 3000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  public setManualEndpoints(txService: string, txChar: string, rxService: string, rxChar: string): void {
    this.txServiceUuid = txService;
    this.txCharacteristicUuid = txChar;
    this.rxServiceUuid = rxService;
    this.rxCharacteristicUuid = rxChar;
    this.hasNotifiableEndpoint = Boolean(rxService && rxChar);
    useBudsStore.getState().setActiveTxEndpoint({ serviceUuid: txService, charUuid: txChar });
    useBudsStore.getState().setActiveRxEndpoint({ serviceUuid: rxService, charUuid: rxChar });
    this.startNotificationListener();
    useBudsStore.getState().logMessage(`Manual Bind: TX[${txChar.slice(0, 8)}] RX[${rxChar.slice(0, 8)}]`);
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
    this.userInitiatedDisconnect = true;
    this.stopHeartbeat();
    this.reconnectAttempts = 0;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

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
      this.activeDevice = null;
    }
    this.cleanup();
    useBudsStore.getState().setConnectionState('disconnected');
    useBudsStore.getState().setConnectedDevice(null);
    useBudsStore.getState().logMessage('Disconnected by user.');
  }

  private cleanup(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.rxSubscription?.remove();
    this.rxSubscription = null;
    this.batterySubscription?.remove();
    this.batterySubscription = null;
    this.activeDevice = null;
    this.pendingDeviceId = null;
    this.hasNotifiableEndpoint = false;
  }
}
