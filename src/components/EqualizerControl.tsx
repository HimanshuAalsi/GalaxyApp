import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Modal } from 'react-native';
import { useBudsStore } from '../store/useBudsStore';
import { CommandDispatcher } from '../services/CommandDispatcher';
import { EqPreset } from '../constants/protocol';

export const EqualizerControl: React.FC = () => {
  const { eqPreset, customEqGains, gamingMode, connectionState } = useBudsStore();
  const [isCustomEqOpen, setIsCustomEqOpen] = useState(false);
  const isConnected = connectionState === 'connected';
  const dispatcher = CommandDispatcher.getInstance();

  const presets: { id: EqPreset; label: string }[] = [
    { id: 'normal', label: 'Normal' },
    { id: 'bass_boost', label: 'Bass Boost' },
    { id: 'soft', label: 'Soft' },
    { id: 'dynamic', label: 'Dynamic' },
    { id: 'clear', label: 'Clear' },
    { id: 'treble_boost', label: 'Treble Boost' },
    { id: 'custom', label: 'Custom' },
  ];

  const bandLabels = ['63', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];

  const handleSelectPreset = async (preset: EqPreset) => {
    if (!isConnected) return;
    if (preset === 'custom') {
      setIsCustomEqOpen(true);
      await dispatcher.setEqualizerPreset('custom');
      await dispatcher.setCustomEqualizer(customEqGains);
    } else {
      await dispatcher.setEqualizerPreset(preset);
    }
  };

  const handleAdjustBand = async (index: number, delta: number) => {
    const currentVal = customEqGains[index] || 0;
    const newVal = Math.min(10, Math.max(-10, currentVal + delta));
    useBudsStore.getState().setCustomEqBandGain(index, newVal);
    const updatedGains = [...useBudsStore.getState().customEqGains];
    if (isConnected) {
      await dispatcher.setCustomEqualizer(updatedGains);
    }
  };

  const handleToggleGaming = async (val: boolean) => {
    if (!isConnected) return;
    await dispatcher.setGamingMode(val);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Equalizer & Sound</Text>

      {/* Preset Pills */}
      <View style={styles.presetGrid}>
        {presets.map((p) => {
          const isActive = eqPreset === p.id;
          return (
            <TouchableOpacity
              key={p.id}
              style={[
                styles.presetPill,
                isActive && styles.presetPillActive,
                !isConnected && styles.disabled,
              ]}
              onPress={() => handleSelectPreset(p.id)}
              disabled={!isConnected}
            >
              <Text
                style={[
                  styles.presetText,
                  isActive && styles.presetTextActive,
                ]}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Low Latency Gaming Mode Switch */}
      <View style={styles.gameModeRow}>
        <View style={styles.gameModeText}>
          <Text style={styles.gameModeTitle}>Gaming Mode (Low Latency)</Text>
          <Text style={styles.gameModeSubtitle}>
            Synchronizes gameplay and video audio without delay
          </Text>
        </View>
        <Switch
          value={gamingMode}
          onValueChange={handleToggleGaming}
          disabled={!isConnected}
          trackColor={{ false: '#30363d', true: '#f59e0b' }}
          thumbColor={gamingMode ? '#ffffff' : '#9ca3af'}
        />
      </View>

      {/* Custom 9-Band EQ Modal */}
      <Modal visible={isCustomEqOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Custom 9-Band Equalizer</Text>
              <TouchableOpacity onPress={() => setIsCustomEqOpen(false)}>
                <Text style={styles.closeBtn}>Done</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.eqBandsContainer}>
              {customEqGains.map((gain, i) => (
                <View key={i} style={styles.bandColumn}>
                  <Text style={styles.gainValue}>{gain > 0 ? `+${gain}` : gain}</Text>
                  <TouchableOpacity
                    style={styles.adjustBtn}
                    onPress={() => handleAdjustBand(i, 1)}
                  >
                    <Text style={styles.btnText}>+</Text>
                  </TouchableOpacity>
                  <View style={styles.bandSliderTrack}>
                    <View
                      style={[
                        styles.bandFill,
                        {
                          height: `${((gain + 10) / 20) * 100}%`,
                          backgroundColor: gain >= 0 ? '#3b82f6' : '#6b7280',
                        },
                      ]}
                    />
                  </View>
                  <TouchableOpacity
                    style={styles.adjustBtn}
                    onPress={() => handleAdjustBand(i, -1)}
                  >
                    <Text style={styles.btnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.freqLabel}>{bandLabels[i]}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#161b22',
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  cardTitle: {
    color: '#f0f6fc',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetPill: {
    backgroundColor: '#0d1117',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  presetPillActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  presetText: {
    color: '#8b949e',
    fontSize: 12,
    fontWeight: '600',
  },
  presetTextActive: {
    color: '#ffffff',
  },
  disabled: {
    opacity: 0.5,
  },
  gameModeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#21262d',
  },
  gameModeText: {
    flex: 1,
    marginRight: 10,
  },
  gameModeTitle: {
    color: '#f0f6fc',
    fontSize: 13,
    fontWeight: '600',
  },
  gameModeSubtitle: {
    color: '#8b949e',
    fontSize: 11,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#161b22',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    color: '#3b82f6',
    fontSize: 15,
    fontWeight: '700',
  },
  eqBandsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  bandColumn: {
    alignItems: 'center',
    gap: 4,
  },
  gainValue: {
    color: '#93c5fd',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  adjustBtn: {
    backgroundColor: '#21262d',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  bandSliderTrack: {
    width: 8,
    height: 100,
    backgroundColor: '#0d1117',
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    marginVertical: 4,
  },
  bandFill: {
    width: '100%',
    borderRadius: 4,
  },
  freqLabel: {
    color: '#8b949e',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
  },
});

