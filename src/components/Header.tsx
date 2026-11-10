import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
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
        return '#f59e0b'; // amber
      case 'scanning':
        return '#3b82f6'; // blue
      default:
        return '#6b7280'; // gray
    }
  };

  const getStatusText = () => {
    switch (connectionState) {
      case 'connected':
        return connectedDevice?.name || 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'scanning':
        return 'Scanning...';
      default:
        return 'Disconnected';
    }
  };

  const renderActionButton = () => {
    if (connectionState === 'connected') {
      return (
        <TouchableOpacity
          style={[styles.actionButton, styles.disconnectBtn]}
          onPress={onDisconnect}
          activeOpacity={0.8}
        >
          <Text style={styles.actionBtnText}>Disconnect</Text>
        </TouchableOpacity>
      );
    }

    if (connectionState === 'connecting') {
      return (
        <TouchableOpacity
          style={[styles.actionButton, styles.cancelBtn]}
          onPress={onDisconnect}
          activeOpacity={0.8}
        >
          <Text style={styles.actionBtnText}>Cancel</Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={[styles.actionButton, styles.connectBtn]}
        onPress={onOpenScanner}
        activeOpacity={0.8}
      >
        <Text style={styles.actionBtnText}>Connect</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View>
        <Text style={styles.title}>Galaxy Buds2 Pro</Text>
        <View style={styles.statusRow}>
          {connectionState === 'connecting' ? (
            <ActivityIndicator size="small" color="#f59e0b" style={styles.miniSpinner} />
          ) : (
            <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
          )}
          <Text style={styles.statusText}>{getStatusText()}</Text>
          {connectionState === 'connected' && (
            <Text style={styles.firmwareBadge}>{firmwareVersion}</Text>
          )}
        </View>
      </View>

      {renderActionButton()}
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
  miniSpinner: {
    marginRight: 6,
    transform: [{ scale: 0.7 }],
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
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 88,
    alignItems: 'center',
  },
  connectBtn: {
    backgroundColor: '#3b82f6',
  },
  disconnectBtn: {
    backgroundColor: '#374151',
  },
  cancelBtn: {
    backgroundColor: '#b91c1c',
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
});
