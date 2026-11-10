import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  SectionList,
} from 'react-native';
import { useBudsStore, BudsDevice } from '../store/useBudsStore';

interface DeviceScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectDevice: (device: BudsDevice) => void;
  onRefreshScan: () => void;
  onCancelConnection?: () => void;
}

export const DeviceScannerModal: React.FC<DeviceScannerModalProps> = ({
  visible,
  onClose,
  onSelectDevice,
  onRefreshScan,
  onCancelConnection,
}) => {
  const { discoveredDevices, connectionState } = useBudsStore();
  const isScanning = connectionState === 'scanning';
  const isConnecting = connectionState === 'connecting';

  // Partition devices into Samsung/Recognized vs Other Nearby BLE
  const samsungDevices = discoveredDevices.filter((d) => d.isSamsung || d.isSystemConnected);
  const otherDevices = discoveredDevices.filter((d) => !d.isSamsung && !d.isSystemConnected);

  const sections = [
    { title: 'Recognized Galaxy Buds', data: samsungDevices },
    { title: 'Other Nearby Bluetooth Devices', data: otherDevices },
  ].filter((s) => s.data.length > 0);

  const renderItem = ({ item }: { item: BudsDevice }) => (
    <TouchableOpacity
      style={[
        styles.deviceRow,
        (item.isSamsung || item.isSystemConnected) && styles.deviceRowSamsung,
      ]}
      onPress={() => onSelectDevice(item)}
      activeOpacity={0.7}
      disabled={isConnecting}
    >
      <View style={styles.deviceInfo}>
        <View style={styles.nameRow}>
          <Text style={styles.deviceName}>{item.name}</Text>
          {item.isSystemConnected && (
            <View style={styles.systemBadge}>
              <Text style={styles.systemBadgeText}>iOS Paired</Text>
            </View>
          )}
          {item.isSamsung && !item.isSystemConnected && (
            <View style={styles.samsungBadge}>
              <Text style={styles.samsungBadgeText}>Samsung 0x0075</Text>
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
              <Text style={styles.title}>Galaxy Buds Link</Text>
              <Text style={styles.subtitle}>Select your Buds2 Pro to establish BLE telemetry</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* iOS Linking Instructions Card */}
          <View style={styles.instructionCard}>
            <Text style={styles.instructionTitle}>📱 How to Link on iPhone:</Text>
            <Text style={styles.instructionStep}>
              1. Keep your Galaxy Buds <Text style={styles.bold}>inside the charging case</Text>.
            </Text>
            <Text style={styles.instructionStep}>
              2. Open the <Text style={styles.bold}>case lid</Text> (or hold both touchpads for 3s until LED flashes).
            </Text>
            <Text style={styles.instructionStep}>
              3. Tap <Text style={styles.bold}>Rescan</Text> below and select your Buds.
            </Text>
          </View>

          {/* Connecting Banner Overlay if active */}
          {isConnecting && (
            <View style={styles.connectingBanner}>
              <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 10 }} />
              <Text style={styles.connectingText}>Establishing BLE Data Link (up to 8s)...</Text>
              {onCancelConnection && (
                <TouchableOpacity onPress={onCancelConnection} style={styles.cancelBtn}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Sectioned Device List */}
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            renderSectionHeader={({ section: { title } }) => (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{title}</Text>
              </View>
            )}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                {isScanning ? (
                  <>
                    <ActivityIndicator size="large" color="#3b82f6" />
                    <Text style={styles.emptyText}>Scanning for Galaxy Buds...</Text>
                    <Text style={styles.emptySubtext}>
                      Make sure the case lid is open with both earbuds seated inside.
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.emptyText}>No devices detected yet</Text>
                    <Text style={styles.emptySubtext}>
                      Open your charging case lid and tap "Rescan Devices" below.
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
              disabled={isScanning || isConnecting}
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
    height: '85%',
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    color: '#9ca3af',
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#21262d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#9ca3af',
    fontSize: 16,
    fontWeight: 'bold',
  },
  instructionCard: {
    backgroundColor: '#1f2937',
    padding: 14,
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#374151',
  },
  instructionTitle: {
    color: '#60a5fa',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  instructionStep: {
    color: '#d1d5db',
    fontSize: 12,
    lineHeight: 18,
  },
  bold: {
    fontWeight: '700',
    color: '#ffffff',
  },
  connectingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 12,
  },
  connectingText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  cancelBtn: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  cancelBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  sectionHeader: {
    backgroundColor: '#161b22',
    paddingVertical: 8,
    marginTop: 6,
  },
  sectionTitle: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listContent: {
    paddingBottom: 20,
  },
  deviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#21262d',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  deviceRowSamsung: {
    backgroundColor: '#172554',
    borderColor: '#1d4ed8',
  },
  deviceInfo: {
    flex: 1,
    marginRight: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  deviceName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    marginRight: 6,
  },
  systemBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 4,
  },
  systemBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  samsungBadge: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  samsungBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  deviceId: {
    color: '#6b7280',
    fontSize: 11,
    marginTop: 3,
    fontFamily: 'Courier',
  },
  actionColumn: {
    alignItems: 'flex-end',
  },
  connectLabel: {
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: '600',
  },
  rssiText: {
    color: '#9ca3af',
    fontSize: 10,
    marginTop: 4,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 14,
  },
  emptySubtext: {
    color: '#6b7280',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 30,
  },
  footer: {
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#21262d',
  },
  scanBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  scanBtnDisabled: {
    backgroundColor: '#1d4ed8',
    opacity: 0.6,
  },
  scanBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
