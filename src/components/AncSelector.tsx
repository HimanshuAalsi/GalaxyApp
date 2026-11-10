import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { useBudsStore } from '../store/useBudsStore';
import { CommandDispatcher } from '../services/CommandDispatcher';
import { NoiseControlMode } from '../constants/protocol';

export const AncSelector: React.FC = () => {
  const {
    ancMode,
    ancLevel,
    ambientVolume,
    amplifyAmbient,
    ancWithOneEarbud,
    connectionState,
  } = useBudsStore();
  const isConnected = connectionState === 'connected';
  const dispatcher = CommandDispatcher.getInstance();

  const handleSelectMode = async (mode: NoiseControlMode) => {
    if (!isConnected) return;
    await dispatcher.setNoiseControl(mode);
  };

  const handleSelectAncLevel = async (lvl: 'low' | 'high') => {
    if (!isConnected) return;
    await dispatcher.setNoiseReductionLevel(lvl);
  };

  const handleSelectVolume = async (vol: number) => {
    if (!isConnected) return;
    await dispatcher.setAmbientVolume(vol);
  };

  const handleToggleAmplify = async (val: boolean) => {
    if (!isConnected) return;
    await dispatcher.setAmplifyAmbient(val);
  };

  const handleToggleOneEarbud = async (val: boolean) => {
    if (!isConnected) return;
    await dispatcher.setAncWithOneEarbud(val);
  };

  const modes: { id: NoiseControlMode; label: string; icon: string }[] = [
    { id: 'anc', label: 'Noise Canceling', icon: '🔇' },
    { id: 'off', label: 'Off', icon: '⚪' },
    { id: 'ambient', label: 'Ambient Sound', icon: '🔊' },
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Active Noise Control</Text>

      {/* Main 3-Way Segmented Control */}
      <View style={styles.segmentedContainer}>
        {modes.map((opt) => {
          const isSelected = ancMode === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              style={[
                styles.segment,
                isSelected && styles.segmentActive,
                !isConnected && styles.disabled,
              ]}
              onPress={() => handleSelectMode(opt.id)}
              activeOpacity={0.7}
              disabled={!isConnected}
            >
              <Text style={styles.icon}>{opt.icon}</Text>
              <Text style={[styles.segmentLabel, isSelected && styles.segmentLabelActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Dynamic Sub-Controls for ANC */}
      {ancMode === 'anc' && (
        <View style={styles.subSection}>
          <Text style={styles.subLabel}>Noise Reduction Intensity</Text>
          <View style={styles.subPillGroup}>
            {(['low', 'high'] as const).map((lvl) => (
              <TouchableOpacity
                key={lvl}
                style={[
                  styles.subPill,
                  ancLevel === lvl && styles.subPillActive,
                  !isConnected && styles.disabled,
                ]}
                onPress={() => handleSelectAncLevel(lvl)}
                disabled={!isConnected}
              >
                <Text
                  style={[
                    styles.subPillText,
                    ancLevel === lvl && styles.subPillTextActive,
                  ]}
                >
                  {lvl === 'low' ? 'Low' : 'High (Max)'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleText}>ANC with 1 Earbud</Text>
            <Switch
              value={ancWithOneEarbud}
              onValueChange={handleToggleOneEarbud}
              disabled={!isConnected}
              trackColor={{ false: '#30363d', true: '#3b82f6' }}
              thumbColor={ancWithOneEarbud ? '#ffffff' : '#9ca3af'}
            />
          </View>
        </View>
      )}

      {/* Dynamic Sub-Controls for Ambient Sound */}
      {ancMode === 'ambient' && (
        <View style={styles.subSection}>
          <Text style={styles.subLabel}>Ambient Sound Volume</Text>
          <View style={styles.volumePills}>
            {[1, 2, 3, 4].map((vol) => (
              <TouchableOpacity
                key={vol}
                style={[
                  styles.volPill,
                  ambientVolume === vol && styles.volPillActive,
                  !isConnected && styles.disabled,
                ]}
                onPress={() => handleSelectVolume(vol)}
                disabled={!isConnected}
              >
                <Text
                  style={[
                    styles.volText,
                    ambientVolume === vol && styles.volTextActive,
                  ]}
                >
                  {vol}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleText}>Amplify Ambient Sound</Text>
              <Text style={styles.toggleSubtext}>Extra hearing boost for distant voices</Text>
            </View>
            <Switch
              value={amplifyAmbient}
              onValueChange={handleToggleAmplify}
              disabled={!isConnected}
              trackColor={{ false: '#30363d', true: '#3b82f6' }}
              thumbColor={amplifyAmbient ? '#ffffff' : '#9ca3af'}
            />
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#161b22',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  cardTitle: {
    color: '#f0f6fc',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#0d1117',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  segmentActive: {
    backgroundColor: '#1f2937',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  disabled: {
    opacity: 0.5,
  },
  icon: {
    fontSize: 16,
    marginBottom: 4,
  },
  segmentLabel: {
    color: '#8b949e',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  segmentLabelActive: {
    color: '#ffffff',
  },
  subSection: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#21262d',
  },
  subLabel: {
    color: '#8b949e',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  subPillGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  subPill: {
    flex: 1,
    backgroundColor: '#0d1117',
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#30363d',
  },
  subPillActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  subPillText: {
    color: '#8b949e',
    fontSize: 12,
    fontWeight: '600',
  },
  subPillTextActive: {
    color: '#ffffff',
  },
  volumePills: {
    flexDirection: 'row',
    gap: 8,
  },
  volPill: {
    flex: 1,
    backgroundColor: '#0d1117',
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#30363d',
  },
  volPillActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  volText: {
    color: '#8b949e',
    fontSize: 13,
    fontWeight: '700',
  },
  volTextActive: {
    color: '#ffffff',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#21262d',
  },
  toggleText: {
    color: '#f0f6fc',
    fontSize: 13,
    fontWeight: '600',
  },
  toggleSubtext: {
    color: '#8b949e',
    fontSize: 11,
    marginTop: 2,
  },
});
