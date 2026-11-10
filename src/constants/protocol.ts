/**
 * Samsung Galaxy Buds Protocol Constants (Reverse-Engineered from GalaxyBudsClient)
 *
 * Packet Framing Structure:
 * +----------------+----------------+----------------+----------------+-------------------+----------------+----------------+----------------+
 * | SOM (1 byte)   | Length LSB     | Length MSB     | Msg ID (1 byte)| Payload (N bytes) | CRC LSB        | CRC MSB        | EOM (1 byte)   |
 * | 0xFD           | (len & 0xFF)   | (len >> 8)     | e.g. 0x83      | ...               | (crc & 0xFF)   | (crc >> 8)     | 0xDD           |
 * +----------------+----------------+----------------+----------------+-------------------+----------------+----------------+----------------+
 * Length = Length of MsgID (1 byte) + Payload length (N bytes)
 * CRC = 16-bit CRC calculated over [Length_LSB, Length_MSB, Msg_ID, ...Payload]
 */

export const PROTOCOL = {
  SOM: 0xfd, // Start Of Message delimiter
  EOM: 0xdd, // End Of Message delimiter
  SOM_FRAGMENTED: 0xfe, // Start of Fragmented Message

  // Message IDs (OpCodes)
  MSG_ID: {
    // Queries
    GET_STATUS: 0x60, // Request general device status
    GET_EXTENDED_STATUS: 0x64, // Request detailed Buds2 Pro telemetry

    // Telemetry from Buds -> App
    STATUS_UPDATED: 0x61, // Telemetry response with battery, wear state, etc.
    EXTENDED_STATUS_UPDATED: 0x65, // Extended telemetry for Buds2 Pro
    VERSION_INFO: 0x63, // Firmware version string

    // Controls App -> Buds
    SET_NOISE_CONTROL: 0x83, // Toggle ANC / Ambient / Off
    LOCK_TOUCH: 0x69, // Lock or unlock touch sensor controls
    SET_EQUALIZER: 0x80, // Equalizer presets (Bass boost, Soft, Dynamic, Clear, Treble boost)
    SET_VOICE_DETECT: 0x85, // Auto-switch to ambient when speech detected
    FIND_MY_BUDS: 0x66, // Beep earbuds
  },

  // Noise Control Modes for Buds2 Pro
  NOISE_CONTROL_MODE: {
    OFF: 0x00,
    ANC: 0x01,
    AMBIENT_SOUND: 0x02,
  } as const,

  // Equalizer Preset IDs
  EQ_PRESET: {
    NORMAL: 0x00,
    BASS_BOOST: 0x01,
    SOFT: 0x02,
    DYNAMIC: 0x03,
    CLEAR: 0x04,
    TREBLE_BOOST: 0x05,
  } as const,
};

export type NoiseControlMode = 'off' | 'anc' | 'ambient';

