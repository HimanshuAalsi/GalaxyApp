import React from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity } from 'react-native';
import { useBudsStore } from '../store/useBudsStore';
import { CommandDispatcher } from '../services/CommandDispatcher';

export const QuickToggles: React.FC = () => {
  const { isTouchLocked, connectionState, lastLog } = useBudsStore();
  const isConnected = connectionState === 'connected';

  const handleToggleTouchLock = async (value: boolean) => {
    if (!isConnected) return;
    await CommandDispatcher.getInstance().setTouchLock(value);
  };

  const handleRefreshStatus = async () => {
    if (!isConnected) return;
    await CommandDispatcher.getInstance().requestStatus();
  };

  return (
    <View style={styles.container}>
      {/* Block Touches Toggle */}
      <View style={styles.toggleCard}>
        <View style={styles.textContainer}>
          <Text style={styles.toggleTitle}>Block Touches</Text>
          <Text style={styles.toggleSubtitle}>
            Disable earbud touch sensors to prevent accidental taps
          </Text>
        </View>
        <Switch
          value={isTouchLocked}
          onValueChange={handleToggleTouchLock}
          disabled={!isConnected}
          trackColor={{ false: '#30363d', true: '#3b82f6' }}
          thumbColor={isTouchLocked ? '#ffffff' : '#9ca3af'}
        />
      </View>

      {/* Manual Telemetry Poll Button */}
      <TouchableOpacity
        style={[styles.pollButton, !isConnected && styles.pollButtonDisabled]}
        onPress={handleRefreshStatus}
        disabled={!isConnected}
        activeOpacity={0.7}
      >
        <Text style={styles.pollButtonText}>🔄 Sync Telemetry</Text>
      </TouchableOpacity>

      {/* Live BLE Hex Packet Log Viewer */}
      <View style={styles.logCard}>
        <Text style={styles.logLabel}>LIVE GATT PROTOCOL LOG</Text>
        <Text style={styles.logText} numberOfLines={2}>
          {lastLog}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginTop: 14,
    gap: 12,
  },
  toggleCard: {
    backgroundColor: '#161b22',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#30363d',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textContainer: {
    flex: 1,
    marginRight: 16,
  },
  toggleTitle: {
    color: '#f0f6fc',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  toggleSubtitle: {
    color: '#8b949e',
    fontSize: 12,
    lineHeight: 16,
  },
  pollButton: {
    backgroundColor: '#1f2937',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  pollButtonDisabled: {
    opacity: 0.5,
  },
  pollButtonText: {
    color: '#93c5fd',
    fontSize: 13,
    fontWeight: '600',
  },
  logCard: {
    backgroundColor: '#0d1117',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#21262d',
  },
  logLabel: {
    color: '#6e7681',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  logText: {
    color: '#58a6ff',
    fontSize: 11,
    fontFamily: 'monospace',
  },
});

