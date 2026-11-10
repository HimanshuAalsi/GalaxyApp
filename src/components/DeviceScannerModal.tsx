import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useBudsStore, BudsDevice } from '../store/useBudsStore';

interface DeviceScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectDevice: (device: BudsDevice) => void;
  onRefreshScan: () => void;
}

export const DeviceScannerModal: React.FC<DeviceScannerModalProps> = ({
  visible,
  onClose,
  onSelectDevice,
  onRefreshScan,
}) => {
  const { discoveredDevices, connectionState } = useBudsStore();
  const isScanning = connectionState === 'scanning';

  const renderItem = ({ item }: { item: BudsDevice }) => (
    <TouchableOpacity
      style={[styles.deviceRow, item.isSystemConnected && styles.deviceRowPaired]}
      onPress={() => onSelectDevice(item)}
      activeOpacity={0.7}
    >
      <View style={styles.deviceInfo}>
        <View style={styles.nameRow}>
          <Text style={styles.deviceName}>{item.name}</Text>
          {item.isSystemConnected && (
            <View style={styles.systemBadge}>
              <Text style={styles.systemBadgeText}>iOS Paired</Text>
            </View>
          )}
        </View>
        <Text style={styles.deviceId}>{item.id}</Text>
      </View>
      <View style={styles.actionColumn}>
        <Text style={styles.connectLabel}>Tap to Link →</Text>
        {item.rssi && <Text style={styles.rssiText}>{item.rssi} dBm</Text>}
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Galaxy Buds Devices</Text>
              <Text style={styles.subtitle}>Select your Buds2 Pro to establish BLE link</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Tip Banner */}
          <View style={styles.tipBox}>
            <Text style={styles.tipText}>
              💡 If your buds are already connected in iPhone Settings, they will appear marked with "iOS Paired" above.
            </Text>
          </View>

          {/* Device List */}
          <FlatList
            data={discoveredDevices}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                {isScanning ? (
                  <>
                    <ActivityIndicator size="large" color="#3b82f6" />
                    <Text style={styles.emptyText}>Scanning for Galaxy Buds...</Text>
                    <Text style={styles.emptySubtext}>
                      Open your charging case lid or ensure earbuds are in your ears
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.emptyText}>No Galaxy Buds detected</Text>
                    <Text style={styles.emptySubtext}>
                      Make sure your earbuds are connected in iPhone Settings ➔ Bluetooth, or open the case lid and tap Rescan.
                    </Text>
                  </>
                )}
              </View>
            }
          />

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.scanBtn, isScanning && styles.scanBtnDisabled]}
              onPress={onRefreshScan}
              disabled={isScanning}
              activeOpacity={0.8}
            >
              <Text style={styles.scanBtnText}>
                {isScanning ? 'Scanning...' : 'Rescan Devices'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#161b22',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 20,
    paddingHorizontal: 18,
    maxHeight: '85%',
    minHeight: '50%',
    borderWidth: 1,
    borderColor: '#30363d',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    color: '#8b949e',
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    backgroundColor: '#21262d',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#c9d1d9',
    fontSize: 14,
    fontWeight: 'bold',
  },
  tipBox: {
    backgroundColor: '#0d1117',
    padding: 10,
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#21262d',
  },
  tipText: {
    color: '#8b949e',
    fontSize: 11,
    lineHeight: 15,
  },
  listContent: {
    paddingVertical: 12,
  },
  deviceRow: {
    backgroundColor: '#0d1117',
    padding: 14,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  deviceRowPaired: {
    borderColor: '#10b981',
    backgroundColor: '#081c15',
  },
  deviceInfo: {
    flex: 1,
    marginRight: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deviceName: {
    color: '#f0f6fc',
    fontSize: 15,
    fontWeight: '600',
  },
  systemBadge: {
    backgroundColor: '#065f46',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  systemBadgeText: {
    color: '#a7f3d0',
    fontSize: 10,
    fontWeight: '700',
  },
  deviceId: {
    color: '#8b949e',
    fontSize: 11,
    fontFamily: 'monospace',
    marginTop: 3,
  },
  actionColumn: {
    alignItems: 'flex-end',
  },
  connectLabel: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
  },
  rssiText: {
    color: '#6e7681',
    fontSize: 10,
    marginTop: 2,
  },
  emptyContainer: {
    paddingVertical: 36,
    alignItems: 'center',
  },
  emptyText: {
    color: '#c9d1d9',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtext: {
    color: '#8b949e',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 16,
  },
  footer: {
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#21262d',
  },
  scanBtn: {
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  scanBtnDisabled: {
    opacity: 0.6,
  },
  scanBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
