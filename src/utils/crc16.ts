/**
 * CRC-16 Calculation for Samsung Galaxy Buds Protocol
 * Matches the exact algorithm used in Samsung's firmware and GalaxyBudsClient.
 */

export function calculateSamsungCrc16(data: Uint8Array): number {
  let crc = 0x0000;

  for (let i = 0; i < data.length; i++) {
    const byte = data[i];
    // Rotate 8 bits and XOR incoming byte
    crc = ((crc >> 8) | ((crc << 8) & 0xffff)) & 0xffff;
    crc ^= byte;
    crc ^= ((crc & 0x00ff) >> 4) & 0xffff;
    crc ^= ((crc << 12) & 0xffff) & 0xffff;
    crc ^= (((crc & 0x00ff) << 5) & 0xffff) & 0xffff;
    crc &= 0xffff;
  }

  return crc;
}

