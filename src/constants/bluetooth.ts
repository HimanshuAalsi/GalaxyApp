/**
 * Bluetooth Low Energy (BLE) UUIDs and Configuration for Samsung Galaxy Buds2 Pro
 */

export const BLE_CONFIG = {
  // Primary Samsung Wearable & Ecosystem BLE Services
  SAMSUNG_SERVICE_UUID: '0000fd5a-0000-1000-8000-00805f9b34fb',
  SAMSUNG_SPP_UUID: '2e73a4ad-332d-41fc-90e2-16bef06523f2',
  GOOGLE_FAST_PAIR_UUID: '0000fe2c-0000-1000-8000-00805f9b34fb',
  BATTERY_SERVICE_UUID: '0000180f-0000-1000-8000-00805f9b34fb',
  DEVICE_INFO_SERVICE_UUID: '0000180a-0000-1000-8000-00805f9b34fb',

  // Services used by iOS CBCentralManager to query already-connected Bluetooth audio accessories
  RETRIEVAL_SERVICES: [
    '0000fd5a-0000-1000-8000-00805f9b34fb',
    '2e73a4ad-332d-41fc-90e2-16bef06523f2',
    '0000fe2c-0000-1000-8000-00805f9b34fb',
    '0000180f-0000-1000-8000-00805f9b34fb',
    '0000180a-0000-1000-8000-00805f9b34fb',
    'fd5a',
    'fe2c',
    '180f',
    '180a',
  ],

  // Common GATT Characteristic UUIDs for Buds2 Pro
  CHARACTERISTIC_TX_UUID: '0000fd5a-0001-1000-8000-00805f9b34fb',
  CHARACTERISTIC_RX_UUID: '0000fd5a-0002-1000-8000-00805f9b34fb',

  // Device advertising name pattern (broadened to support renamed earbuds and variant labels)
  DEVICE_NAME_REGEX: /Buds|Galaxy|SM-R510|Samsung|R510|Earbud|Headphone/i,

  TARGET_MTU: 247,
};
