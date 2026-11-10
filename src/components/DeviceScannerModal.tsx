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
      style={styles.deviceRow}
      onPress={() => onSelectDevice(item)}
      activeOpacity={0.7}
    >
      <View>
        <Text style={styles.deviceName}>{item.name}</Text>
        <Text style={styles.deviceId}>{item.id}</Text>
      </View>
      <View style={styles.rssiBadge}>
        <Text style={styles.rssiText}>{item.rssi ? `${item.rssi} dBm` : 'Nearby'}</Text>
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
              <Text style={styles.title}>Nearby Galaxy Buds</Text>
              <Text style={styles.subtitle}>Select your Buds2 Pro to connect via BLE</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
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
                    <Text style={styles.emptyText}>Searching for Buds2 Pro...</Text>
                    <Text style={styles.emptySubtext}>
                      Ensure earbuds are out of the case or case lid is open
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.emptyText}>No Galaxy Buds detected</Text>
                    <Text style={styles.emptySubtext}>
                      Open the charging case or hold both earbuds to enter pairing mode
                    </Text>
                  </>
                )}
              </View>
            }
          />

          {/* Bottom Actions */}
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#161b22',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 20,
    paddingHorizontal: 20,
    maxHeight: '80%',
    minHeight: '50%',
    borderWidth: 1,
    borderColor: '#30363d',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 16,
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
    fontSize: 13,
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
  listContent: {
    paddingVertical: 12,
  },
  deviceRow: {
    backgroundColor: '#0d1117',
    padding: 16,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  deviceName: {
    color: '#f0f6fc',
    fontSize: 15,
    fontWeight: '600',
  },
  deviceId: {
    color: '#8b949e',
    fontSize: 11,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  rssiBadge: {
    backgroundColor: '#1f2937',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  rssiText: {
    color: '#a5b4fc',
    fontSize: 11,
    fontWeight: '500',
  },
  emptyContainer: {
    paddingVertical: 40,
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
    paddingHorizontal: 20,
  },
  footer: {
    paddingVertical: 16,
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

