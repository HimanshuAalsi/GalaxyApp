import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useBudsStore } from '../store/useBudsStore';

interface HeaderProps {
  onOpenScanner: () => void;
  onDisconnect: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenScanner, onDisconnect }) => {
  const { connectionState, connectedDevice, firmwareVersion } = useBudsStore();

  const getStatusColor = () => {
    switch (connectionState) {
      case 'connected':
        return '#10b981'; // green
      case 'connecting':
      case 'scanning':
        return '#3b82f6'; // blue
      default:
        return '#6b7280'; // gray
    }
  };

  const getStatusText = () => {
    switch (connectionState) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'scanning':
        return 'Scanning...';
      default:
        return 'Disconnected';
    }
  };

  return (
    <View style={styles.container}>
      <View>
        <Text style={styles.title}>Galaxy Buds2 Pro</Text>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
          <Text style={styles.statusText}>{getStatusText()}</Text>
          {connectionState === 'connected' && (
            <Text style={styles.firmwareBadge}>{firmwareVersion}</Text>
          )}
        </View>
      </View>

      <TouchableOpacity
        style={[
          styles.actionButton,
          connectionState === 'connected' ? styles.disconnectBtn : styles.connectBtn,
        ]}
        onPress={connectionState === 'connected' ? onDisconnect : onOpenScanner}
        activeOpacity={0.8}
      >
        <Text style={styles.actionBtnText}>
          {connectionState === 'connected' ? 'Disconnect' : 'Connect'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '500',
  },
  firmwareBadge: {
    backgroundColor: '#1f2937',
    color: '#9ca3af',
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
    fontFamily: 'monospace',
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  connectBtn: {
    backgroundColor: '#3b82f6',
  },
  disconnectBtn: {
    backgroundColor: '#374151',
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
});

