/**
 * Samsung Galaxy Buds2 Pro Protocol Constants
 * Reverse-Engineered from Samsung Galaxy Wearable Firmware & GalaxyBudsClient
 */

export const PROTOCOL = {
  SOM: 0xfd, // Start Of Message
  EOM: 0xdd, // End Of Message
  SOM_FRAGMENTED: 0xfe, // Fragmented packet SOM

  // Message IDs (OpCodes from Samsung SppMessageEnums decompilation)
  MSG_ID: {
    // Queries & Telemetry
    GET_STATUS: 96, // 0x60: Request general status
    STATUS_UPDATED: 96, // 0x60
    EXTENDED_STATUS_UPDATED: 97, // 0x61: Extended telemetry for Buds2 Pro
    VERSION_INFO: 99, // 0x63: Firmware version string
    VERSION_INFO_LONG: 104, // 0x68

    // Noise Controls
    NOISE_CONTROLS_UPDATE: 119, // 0x77
    NOISE_CONTROLS: 120, // 0x78: Set ANC / Ambient / Off
    SET_TOUCH_AND_HOLD_NOISE_CONTROLS: 121, // 0x79: Cycle modes on long press
    SET_DETECT_CONVERSATIONS: 122, // 0x7A: Voice Detect (Speak-to-Chat)
    SET_DETECT_CONVERSATIONS_DURATION: 123, // 0x7B: Auto-resume timer
    SET_SPATIAL_AUDIO: 124, // 0x7C: 360 Audio
    SET_AMPLIFY_AMBIENT_SOUND: 126, // 0x7E: Extra high ambient boost
    NOISE_REDUCTION_LEVEL: 131, // 0x83: ANC level (0 = Low, 1 = High)
    AMBIENT_VOLUME: 132, // 0x84: Ambient volume (0 to 3 for Levels 1-4)
    CUSTOMIZE_AMBIENT_SOUND: 130, // 0x82: Custom ambient left/right tone
    SET_ANC_WITH_ONE_EARBUD: 111, // 0x6F: Allow ANC with 1 earbud in

    // Audio & Equalizer
    EQUALIZER: 134, // 0x86: Equalizer Presets
    CUSTOM_EQUALIZE_SEND: 137, // 0x89: Custom 7-Band Equalizer gains
    GAME_MODE: 135, // 0x87: Low latency Gaming Mode
    PAUSE_MEDIA_WHEN_ONE_BUD_REMOVED: 108, // 0x6C: In-ear auto pause

    // Touch Controls
    LOCK_TOUCHPAD: 144, // 0x90: Touch controls toggle (all or individual gestures)
    SET_TOUCHPAD_OPTION: 146, // 0x92: Touch & hold left/right action

    // Fit Test & Find My Buds
    CHECK_THE_FIT_OF_EARBUDS: 157, // 0x9D: Start acoustic fit test
    CHECK_THE_FIT_OF_EARBUDS_RESULT: 158, // 0x9E: Fit test result
    FIND_MY_EARBUDS_START: 160, // 0xA0: Start beeping
    FIND_MY_EARBUDS_STOP: 161, // 0xA1: Stop beeping
    MUTE_EARBUD: 162, // 0xA2: Mute individual bud while beeping

    // Posture & System
    NECK_POSTURE_SET: 201, // 0xC9: Neck stretch reminders toggle
    NECK_POSTURE_CALI_DATA: 198, // 0xC6: Calibrate posture
    SET_SEAMLESS_CONNECTION: 175, // 0xAF: Auto switch audio
    RESET: 80, // 0x50: Factory reset
    REBOOT: 82, // 0x52: Reboot buds
  },

  // Noise Control Modes
  NOISE_CONTROL_MODE: {
    OFF: 0,
    ANC: 1,
    AMBIENT_SOUND: 2,
  } as const,

  // Equalizer Presets
  EQ_PRESET: {
    NORMAL: 0,
    BASS_BOOST: 1,
    SOFT: 2,
    DYNAMIC: 3,
    CLEAR: 4,
    TREBLE_BOOST: 5,
    CUSTOM: 6,
  } as const,

  // Touch & Hold Actions
  TOUCH_OPTION: {
    NOISE_CONTROL: 1,
    VOICE_COMMAND: 2,
    VOLUME_DOWN: 3,
    VOLUME_UP: 4,
    SPOTIFY: 5,
  } as const,

  // Voice Detect Duration (seconds)
  VOICE_DETECT_DURATION: {
    SECONDS_5: 0,
    SECONDS_10: 1,
    SECONDS_15: 2,
  } as const,

  // Placement States
  PLACEMENT: {
    DISCONNECTED: 0,
    IN_EAR: 1,
    OUTSIDE: 2,
    CHARGING: 3,
  } as const,
};

export type NoiseControlMode = 'off' | 'anc' | 'ambient';
export type EqPreset = 'normal' | 'bass_boost' | 'soft' | 'dynamic' | 'clear' | 'treble_boost' | 'custom';
