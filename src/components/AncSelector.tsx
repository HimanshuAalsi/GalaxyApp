import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useBudsStore } from '../store/useBudsStore';
import { CommandDispatcher } from '../services/CommandDispatcher';
import { NoiseControlMode } from '../constants/protocol';

export const AncSelector: React.FC = () => {
  const { ancMode, connectionState } = useBudsStore();
  const isConnected = connectionState === 'connected';

  const handleSelectMode = async (mode: NoiseControlMode) => {
    if (!isConnected) return;
    await CommandDispatcher.getInstance().setNoiseControl(mode);
  };

  const options: { id: NoiseControlMode; label: string; icon: string }[] = [
    { id: 'anc', label: 'Noise Canceling', icon: '🔇' },
    { id: 'off', label: 'Off', icon: '⚪' },
    { id: 'ambient', label: 'Ambient Sound', icon: '🔊' },
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Noise Controls</Text>
      <View style={styles.segmentedContainer}>
        {options.map((opt) => {
          const isSelected = ancMode === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              style={[
                styles.segment,
                isSelected && styles.segmentActive,
                !isConnected && styles.segmentDisabled,
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
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#161b22',
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  cardTitle: {
    color: '#f0f6fc',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 14,
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
    shadowRadius: 3.84,
    elevation: 3,
  },
  segmentDisabled: {
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
});

