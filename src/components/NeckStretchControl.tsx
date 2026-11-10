import React from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity } from 'react-native';
import { useBudsStore } from '../store/useBudsStore';
import { CommandDispatcher } from '../services/CommandDispatcher';

export const NeckStretchControl: React.FC = () => {
  const { neckStretch, neckAngle, connectionState } = useBudsStore();
  const isConnected = connectionState === 'connected';
  const dispatcher = CommandDispatcher.getInstance();

  const handleToggle = async (val: boolean) => {
    if (!isConnected) return;
    await dispatcher.setNeckStretch(val);
  };

  const handleCalibrate = async () => {
    if (!isConnected) return;
    await dispatcher.calibrateNeckPosture();
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.textContainer}>
          <Text style={styles.title}>Neck Stretch Reminders</Text>
          <Text style={styles.subtitle}>
            Detects head posture & alerts you when slouching too long
          </Text>
        </View>
        <Switch
          value={neckStretch}
          onValueChange={handleToggle}
          disabled={!isConnected}
          trackColor={{ false: '#30363d', true: '#3b82f6' }}
          thumbColor={neckStretch ? '#ffffff' : '#9ca3af'}
        />
      </View>

      {neckStretch && (
        <View style={styles.postureSection}>
          <View style={styles.angleRow}>
            <Text style={styles.angleLabel}>Current Head Tilt:</Text>
            <Text style={styles.angleValue}>{neckAngle}°</Text>
          </View>
          <TouchableOpacity
            style={[styles.calibrateBtn, !isConnected && styles.disabled]}
            onPress={handleCalibrate}
            disabled={!isConnected}
          >
            <Text style={styles.calibrateText}>Calibrate Good Posture</Text>
          </TouchableOpacity>
        </View>
      )}
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    color: '#f0f6fc',
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: {
    color: '#8b949e',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  postureSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#21262d',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  angleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  angleLabel: {
    color: '#8b949e',
    fontSize: 12,
  },
  angleValue: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  calibrateBtn: {
    backgroundColor: '#21262d',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#374151',
  },
  calibrateText: {
    color: '#93c5fd',
    fontSize: 11,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
});

