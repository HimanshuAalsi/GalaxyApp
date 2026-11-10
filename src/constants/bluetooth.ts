/**
 * Bluetooth Low Energy (BLE) UUIDs and Configuration for Samsung Galaxy Buds2 Pro
 *
 * Note: Samsung Galaxy Buds advertise with Samsung's registered 16-bit UUID (0xFD5A).
 * On iOS, the CoreBluetooth framework requires standard 128-bit UUID representation.
 */

export const BLE_CONFIG = {
  // Samsung Wearable 16-bit UUID expanded to 128-bit standard SIG base
  SAMSUNG_SERVICE_UUID: '0000fd5a-0000-1000-8000-00805f9b34fb',

  // Custom GATT Characteristics for Samsung Buds Protocol
  // TX: App writes commands to the Earbuds (Write / Write Without Response)
  // RX: Earbuds stream telemetry / responses to App (Notify / Indicate)
  CHARACTERISTIC_TX_UUID: '0000fd5a-0001-1000-8000-00805f9b34fb',
  CHARACTERISTIC_RX_UUID: '0000fd5a-0002-1000-8000-00805f9b34fb',

  // Fallback 16-bit short UUID representations (used by some Bluetooth stacks)
  SHORT_SERVICE_UUID: 'fd5a',

  // Target BLE MTU (Maximum Transmission Unit) - standard iOS BLE is 23-185 bytes
  TARGET_MTU: 247,

  // Device advertising name pattern for Galaxy Buds2 Pro
  DEVICE_NAME_REGEX: /Galaxy Buds2 Pro/i,
};

