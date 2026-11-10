import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, Alert } from 'react-native';
import { useBudsStore } from '../store/useBudsStore';
import { CommandDispatcher } from '../services/CommandDispatcher';
import { FitTestModal } from './FitTestModal';
import { FindMyBudsModal } from './FindMyBudsModal';

export const ExtraSettingsSection: React.FC = () => {
  const { inEarPause, seamlessConnection, lastLog, connectionState } = useBudsStore();
  const [isFitTestOpen, setIsFitTestOpen] = useState(false);
  const [isFindMyBudsOpen, setIsFindMyBudsOpen] = useState(false);
  const isConnected = connectionState === 'connected';
  const dispatcher = CommandDispatcher.getInstance();

  const handleToggleInEarPause = async (val: boolean) => {
    if (!isConnected) return;
    await dispatcher.setInEarPause(val);
  };

  const handleToggleSeamless = async (val: boolean) => {
    if (!isConnected) return;
    await dispatcher.setSeamlessConnection(val);
  };

  const handleReset = () => {
    Alert.alert(
      'Reset Earbuds',
      'Are you sure you want to restore factory default settings to your Galaxy Buds2 Pro?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            if (isConnected) await dispatcher.resetEarbuds();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Utility Action Buttons */}
      <View style={styles.actionGrid}>
        <TouchableOpacity
          style={[styles.actionCard, !isConnected && styles.disabled]}
          onPress={() => setIsFitTestOpen(true)}
          disabled={!isConnected}
        >
          <Text style={styles.actionIcon}>🩺</Text>
          <Text style={styles.actionTitle}>Earbud Fit Test</Text>
          <Text style={styles.actionDesc}>Check acoustic seal</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, !isConnected && styles.disabled]}
          onPress={() => setIsFindMyBudsOpen(true)}
          disabled={!isConnected}
        >
          <Text style={styles.actionIcon}>📍</Text>
          <Text style={styles.actionTitle}>Find My Earbuds</Text>
          <Text style={styles.actionDesc}>Beep nearby buds</Text>
        </TouchableOpacity>
      </View>

      {/* Advanced Toggles */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Smart Settings</Text>

        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>In-Ear Detection Auto Pause</Text>
            <Text style={styles.rowDesc}>Pause media when one or both earbuds are removed</Text>
          </View>
          <Switch
            value={inEarPause}
            onValueChange={handleToggleInEarPause}
            disabled={!isConnected}
            trackColor={{ false: '#30363d', true: '#3b82f6' }}
            thumbColor={inEarPause ? '#ffffff' : '#9ca3af'}
          />
        </View>

        <View style={[styles.row, styles.borderTop]}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Seamless Earbud Connection</Text>
            <Text style={styles.rowDesc}>Quickly switch playback between devices</Text>
          </View>
          <Switch
            value={seamlessConnection}
            onValueChange={handleToggleSeamless}
            disabled={!isConnected}
            trackColor={{ false: '#30363d', true: '#3b82f6' }}
            thumbColor={seamlessConnection ? '#ffffff' : '#9ca3af'}
          />
        </View>
      </View>

      {/* Reset & Sync Controls */}
      <View style={styles.card}>
        <View style={styles.systemRow}>
          <TouchableOpacity
            style={[styles.syncBtn, !isConnected && styles.disabled]}
            onPress={() => dispatcher.requestStatus()}
            disabled={!isConnected}
          >
            <Text style={styles.syncBtnText}>🔄 Force Sync Telemetry</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.resetBtn, !isConnected && styles.disabled]}
            onPress={handleReset}
            disabled={!isConnected}
          >
            <Text style={styles.resetBtnText}>Factory Reset</Text>
          </TouchableOpacity>
        </View>

        {/* Live Hex Stream Inspector */}
        <View style={styles.logBox}>
          <Text style={styles.logHeader}>LIVE GATT SPP STREAM</Text>
          <Text style={styles.logText} numberOfLines={2}>
            {lastLog}
          </Text>
        </View>
      </View>

      {/* Modals */}
      <FitTestModal visible={isFitTestOpen} onClose={() => setIsFitTestOpen(false)} />
      <FindMyBudsModal visible={isFindMyBudsOpen} onClose={() => setIsFindMyBudsOpen(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 10,
    gap: 10,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#161b22',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#30363d',
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  actionTitle: {
    color: '#f0f6fc',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  actionDesc: {
    color: '#8b949e',
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#161b22',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  sectionTitle: {
    color: '#f0f6fc',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: '#21262d',
    marginTop: 8,
    paddingTop: 12,
  },
  rowText: {
    flex: 1,
    marginRight: 10,
  },
  rowTitle: {
    color: '#f0f6fc',
    fontSize: 13,
    fontWeight: '600',
  },
  rowDesc: {
    color: '#8b949e',
    fontSize: 11,
    marginTop: 2,
  },
  systemRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  syncBtn: {
    flex: 2,
    backgroundColor: '#1f2937',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  syncBtnText: {
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: '700',
  },
  resetBtn: {
    flex: 1,
    backgroundColor: '#27171a',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#7f1d1d',
  },
  resetBtnText: {
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: '700',
  },
  logBox: {
    backgroundColor: '#0d1117',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#21262d',
  },
  logHeader: {
    color: '#6e7681',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  logText: {
    color: '#58a6ff',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  disabled: {
    opacity: 0.5,
  },
});
