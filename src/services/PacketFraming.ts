import { PROTOCOL } from '../constants/protocol';
import { calculateSamsungCrc16 } from '../utils/crc16';

export interface DecodedPacket {
  msgId: number;
  payload: Uint8Array;
}

export class PacketFraming {
  /**
   * Encloses a message ID and payload into a framed Samsung Protocol packet.
   * Format: [SOM (0xFD)] [LEN_LSB] [LEN_MSB] [MSG_ID] [PAYLOAD...] [CRC_LSB] [CRC_MSB] [EOM (0xDD)]
   */
  public static encode(msgId: number, payload: Uint8Array | number[] = []): Uint8Array {
    const payloadBytes = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
    // Length in Samsung protocol accounts for MSG_ID byte (1) + payload byte count
    const length = payloadBytes.length + 1;
    const lenLsb = length & 0xff;
    const lenMsb = (length >> 8) & 0xff;

    // Buffer to calculate CRC over: [LEN_LSB, LEN_MSB, MSG_ID, ...payload]
    const crcData = new Uint8Array(2 + 1 + payloadBytes.length);
    crcData[0] = lenLsb;
    crcData[1] = lenMsb;
    crcData[2] = msgId;
    crcData.set(payloadBytes, 3);

    const crc = calculateSamsungCrc16(crcData);
    const crcLsb = crc & 0xff;
    const crcMsb = (crc >> 8) & 0xff;

    // Assemble final frame
    // Total size = 1 (SOM) + 2 (Len) + 1 (MsgID) + payload.length + 2 (CRC) + 1 (EOM) = 7 + payload.length
    const packet = new Uint8Array(7 + payloadBytes.length);
    packet[0] = PROTOCOL.SOM;
    packet[1] = lenLsb;
    packet[2] = lenMsb;
    packet[3] = msgId;
    packet.set(payloadBytes, 4);
    packet[4 + payloadBytes.length] = crcLsb;
    packet[5 + payloadBytes.length] = crcMsb;
    packet[6 + payloadBytes.length] = PROTOCOL.EOM;

    return packet;
  }

  /**
   * Stream accumulator for incoming BLE notification chunks that handles
   * defragmentation, CRC verification, and frame extraction.
   */
  private buffer: number[] = [];

  public append(chunk: Uint8Array): DecodedPacket[] {
    for (let i = 0; i < chunk.length; i++) {
      this.buffer.push(chunk[i]);
    }

    const packets: DecodedPacket[] = [];

    while (this.buffer.length >= 7) {
      // Find SOM delimiter (0xFD or 0xFE)
      const somIndex = this.buffer.findIndex(
        (b) => b === PROTOCOL.SOM || b === PROTOCOL.SOM_FRAGMENTED
      );

      if (somIndex === -1) {
        // No start byte found; clear buffer
        this.buffer = [];
        break;
      }

      if (somIndex > 0) {
        // Discard junk bytes before SOM
        this.buffer.splice(0, somIndex);
      }

      if (this.buffer.length < 7) {
        break; // Wait for more data
      }

      // Read Length (Little Endian: byte 1 = LSB, byte 2 = MSB)
      const length = this.buffer[1] | (this.buffer[2] << 8);

      // Total expected packet length = 1 (SOM) + 2 (Len) + length (MsgId + Payload) + 2 (CRC) + 1 (EOM)
      const expectedTotalLength = 3 + length + 3;

      if (this.buffer.length < expectedTotalLength) {
        // Full packet not yet received; wait for next BLE notification chunk
        break;
      }

      // Extract candidate packet
      const packetBytes = this.buffer.slice(0, expectedTotalLength);

      // Verify EOM (End of Message delimiter)
      const eomByte = packetBytes[expectedTotalLength - 1];
      if (eomByte !== PROTOCOL.EOM) {
        // Corrupted packet alignment; drop SOM and seek again
        this.buffer.shift();
        continue;
      }

      // Extract CRC from packet
      const receivedCrc =
        packetBytes[expectedTotalLength - 3] | (packetBytes[expectedTotalLength - 2] << 8);

      // Calculate CRC over [Len_LSB, Len_MSB, MsgID, ...payload]
      const crcSection = new Uint8Array(packetBytes.slice(1, expectedTotalLength - 3));
      const calculatedCrc = calculateSamsungCrc16(crcSection);

      if (receivedCrc === calculatedCrc) {
        const msgId = packetBytes[3];
        const payload = new Uint8Array(packetBytes.slice(4, expectedTotalLength - 3));
        packets.push({ msgId, payload });

        // Advance buffer past this packet
        this.buffer.splice(0, expectedTotalLength);
      } else {
        // CRC mismatch; slide forward by 1 byte to search for valid header
        this.buffer.shift();
      }
    }

    return packets;
  }

  public reset(): void {
    this.buffer = [];
  }
}

