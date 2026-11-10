/**
 * Bluetooth Low Energy (BLE) UUIDs and Configuration for Samsung Galaxy Buds2 Pro (SM-R510)
 */

export const BLE_CONFIG = {
  // Samsung Electronics Co., Ltd. Bluetooth SIG Company Identifier
  SAMSUNG_COMPANY_ID: 0x0075,

  // Primary Samsung Wearable & Ecosystem BLE Services
  SAMSUNG_SERVICE_UUID: '0000fd5a-0000-1000-8000-00805f9b34fb',
  SAMSUNG_SPP_UUID: '2e73a4ad-332d-41fc-90e2-16bef06523f2',
  GOOGLE_FAST_PAIR_UUID: '0000fe2c-0000-1000-8000-00805f9b34fb',
  BATTERY_SERVICE_UUID: '0000180f-0000-1000-8000-00805f9b34fb',
  DEVICE_INFO_SERVICE_UUID: '0000180a-0000-1000-8000-00805f9b34fb',

  // Core Bluetooth LE Audio & Media Services
  VOLUME_CONTROL_SERVICE_UUID: '00001844-0000-1000-8000-00805f9b34fb',
  CSIS_SERVICE_UUID: '00001846-0000-1000-8000-00805f9b34fb',
  COMMON_AUDIO_SERVICE_UUID: '00001853-0000-1000-8000-00805f9b34fb',

  // Known Samsung proprietary vendor services observed on Buds2 Pro
  VENDOR_SERVICES: [
    '2e73a4ad-332d-41fc-90e2-16bef06523f2',
    'a23d00bc-217c-123b-9c00-fc44577136ee',
    'a7a473e9-19c6-491b-aea6-7ea92b8f043a',
    'b4a9d6a0-b2e3-4e40-976d-a69f167ea895',
    'd908aab5-7a90-4cbe-8641-86a553db0146',
    'e74beac1-ab40-423f-b746-fb9869a982dd',
    'e7ab2241-ca64-4a69-ac02-05f5c6fe2d62',
    '0000fd5a-0000-1000-8000-00805f9b34fb',
    '0000fe2c-0000-1000-8000-00805f9b34fb',
    '0000180f-0000-1000-8000-00805f9b34fb',
    '0000180a-0000-1000-8000-00805f9b34fb',
  ],

  // Common GATT Characteristic UUIDs for Buds2 Pro
  CHARACTERISTIC_TX_UUID: '0000fd5a-0001-1000-8000-00805f9b34fb',
  CHARACTERISTIC_RX_UUID: '0000fd5a-0002-1000-8000-00805f9b34fb',

  // Device advertising name pattern
  DEVICE_NAME_REGEX: /Buds|Galaxy|SM-R510|Samsung|R510|Earbud|Headphone|Gear/i,

  TARGET_MTU: 247,
  CONNECTION_TIMEOUT_MS: 8000,
  DISCOVERY_TIMEOUT_MS: 6000,
};
