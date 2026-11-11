import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Share,
  Alert,
} from 'react-native';
import { useBudsStore } from '../store/useBudsStore';
import { BleService } from '../services/BleManager';
import { CommandDispatcher } from '../services/CommandDispatcher';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export const GattDiagnosticsModal: React.FC<Props> = ({ visible, onClose }) => {
  const {
    connectionState,
    connectedDevice,
    activeTxEndpoint,
    activeRxEndpoint,
    discoveredServices,
    logHistory,
    clearLogHistory,
    battery,
  } = useBudsStore();

  const [activeTab, setActiveTab] = useState<'logs' | 'gatt'>('logs');

  const handleShareLogs = async () => {
    try {
      const logDump = [
        `=== GALAXY BUDS COMPANION DIAGNOSTICS DUMP ===`,
        `Timestamp: ${new Date().toISOString()}`,
        `Connection State: ${connectionState}`,
        `Device: ${connectedDevice?.name || 'N/A'} (${connectedDevice?.id || 'N/A'})`,
        `TX Endpoint: Svc=${activeTxEndpoint?.serviceUuid || 'none'}, Char=${activeTxEndpoint?.charUuid || 'none'}`,
        `RX Endpoint: Svc=${activeRxEndpoint?.serviceUuid || 'none'}, Char=${activeRxEndpoint?.charUuid || 'none'}`,
        `Battery: L=${battery.left}%, R=${battery.right}%, Case=${battery.case}%`,
        `Discovered GATT Services Count: ${discoveredServices.length}`,
        `\n=== DISCOVERED GATT SERVICES & CHARACTERISTICS ===`,
        ...discoveredServices.map((s) => {
          const chars = s.characteristics
            .map(
              (c) =>
                `    - Char ${c.charUuid} [W=${c.isWritable ? '1' : '0'}, N=${c.isNotifiable || c.isIndicatable ? '1' : '0'}, R=${c.isReadable ? '1' : '0'}]`
            )
            .join('\n');
          return `  * Service ${s.uuid} (vendor=${s.isVendor ? 'true' : 'false'})\n${chars}`;
        }),
        `\n=== LIVE TELEMETRY LOGS (${logHistory.length} entries) ===`,
        ...logHistory,
      ].join('\n');

      await Share.share({
        title: 'Galaxy Buds Companion Diagnostic Logs',
        message: logDump,
      });
    } catch (err: any) {
      Alert.alert('Export Failed', err.message);
    }
  };

  const handleManualBind = (serviceUuid: string, charUuid: string, type: 'tx' | 'rx') => {
    const ble = BleService.getInstance();
    const currentTxSvc = activeTxEndpoint?.serviceUuid || serviceUuid;
    const currentTxChar = activeTxEndpoint?.charUuid || charUuid;
    const currentRxSvc = activeRxEndpoint?.serviceUuid || serviceUuid;
    const currentRxChar = activeRxEndpoint?.charUuid || charUuid;

    if (type === 'tx') {
      ble.setManualEndpoints(serviceUuid, charUuid, currentRxSvc, currentRxChar);
      Alert.alert('TX Endpoint Bound', `Bound TX to ${charUuid.slice(0, 8)}`);
    } else {
      ble.setManualEndpoints(currentTxSvc, currentTxChar, serviceUuid, charUuid);
      Alert.alert('RX Endpoint Bound', `Bound RX to ${charUuid.slice(0, 8)}`);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header Bar */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>GATT & Telemetry Diagnostics</Text>
            <Text style={styles.headerSubtitle}>
              {connectedDevice ? `${connectedDevice.name} (${connectedDevice.id.slice(0, 8)}...)` : 'No Device Linked'}
            </Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Status Dashboard Banner */}
        <View style={styles.statusBanner}>
          <View style={styles.statusRow}>
            <View style={styles.badgeGroup}>
              <View
                style={[
                  styles.statusDot,
                  connectionState === 'connected' ? styles.dotConnected : styles.dotDisconnected,
                ]}
              />
              <Text style={styles.statusLabel}>{connectionState.toUpperCase()}</Text>
            </View>
            <Text style={styles.batterySummary}>
              L: {battery.left}% | R: {battery.right}% | C: {battery.case}%
            </Text>
          </View>

          <View style={styles.endpointCard}>
            <Text style={styles.endpointLine}>
              <Text style={styles.endpointKey}>TX: </Text>
              {activeTxEndpoint ? `${activeTxEndpoint.charUuid.slice(0, 18)}...` : 'None bound'}
            </Text>
            <Text style={styles.endpointLine}>
              <Text style={styles.endpointKey}>RX: </Text>
              {activeRxEndpoint ? `${activeRxEndpoint.charUuid.slice(0, 18)}...` : 'None bound'}
            </Text>
          </View>
        </View>

        {/* Quick Diagnostic Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => CommandDispatcher.getInstance().requestStatus()}
          >
            <Text style={styles.actionBtnText}>🔄 Ping 0x60</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionBtn, styles.shareBtn]} onPress={handleShareLogs}>
            <Text style={[styles.actionBtnText, styles.shareBtnText]}>📋 Share / Copy Logs</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionBtn, styles.clearBtn]} onPress={clearLogHistory}>
            <Text style={styles.clearBtnText}>🗑️ Clear</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Navigator */}
        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'logs' && styles.activeTab]}
            onPress={() => setActiveTab('logs')}
          >
            <Text style={[styles.tabText, activeTab === 'logs' && styles.activeTabText]}>
              Live Stream ({logHistory.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'gatt' && styles.activeTab]}
            onPress={() => setActiveTab('gatt')}
          >
            <Text style={[styles.tabText, activeTab === 'gatt' && styles.activeTabText]}>
              GATT Tree ({discoveredServices.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {activeTab === 'logs' ? (
          <ScrollView style={styles.logScrollView} contentContainerStyle={styles.logContent}>
            {logHistory.length === 0 ? (
              <Text style={styles.emptyText}>No telemetry messages recorded yet.</Text>
            ) : (
              logHistory.map((item, idx) => {
                const isTx = item.includes('TX ->');
                const isRx = item.includes('RX <-');
                const isErr = item.includes('failed') || item.includes('error') || item.includes('Disconnected');
                return (
                  <View key={idx} style={styles.logEntry}>
                    <Text
                      style={[
                        styles.logLine,
                        isTx && styles.logTx,
                        isRx && styles.logRx,
                        isErr && styles.logErr,
                      ]}
                      selectable
                    >
                      {item}
                    </Text>
                  </View>
                );
              })
            )}
          </ScrollView>
        ) : (
          <ScrollView style={styles.gattScrollView} contentContainerStyle={styles.gattContent}>
            {discoveredServices.length === 0 ? (
              <Text style={styles.emptyText}>
                No GATT services discovered yet. Connect to Galaxy Buds2 Pro to inspect GATT structure.
              </Text>
            ) : (
              discoveredServices.map((svc, sIdx) => (
                <View key={sIdx} style={styles.serviceCard}>
                  <View style={styles.serviceHeader}>
                    <Text style={styles.serviceUuid} numberOfLines={1}>
                      {svc.uuid}
                    </Text>
                    <View
                      style={[
                        styles.vendorBadge,
                        svc.isVendor ? styles.vendorBadgeHighlight : styles.standardBadge,
                      ]}
                    >
                      <Text style={styles.vendorBadgeText}>{svc.isVendor ? 'VENDOR' : 'SIG'}</Text>
                    </View>
                  </View>

                  <View style={styles.charList}>
                    {svc.characteristics.map((c, cIdx) => {
                      const isCurTx = activeTxEndpoint?.charUuid.toLowerCase() === c.charUuid.toLowerCase();
                      const isCurRx = activeRxEndpoint?.charUuid.toLowerCase() === c.charUuid.toLowerCase();
                      return (
                        <View key={cIdx} style={[styles.charRow, (isCurTx || isCurRx) && styles.charRowActive]}>
                          <View style={styles.charInfo}>
                            <Text style={styles.charUuid} numberOfLines={1}>
                              {c.charUuid}
                            </Text>
                            <View style={styles.pillGroup}>
                              {c.isWritable && <Text style={[styles.pill, styles.pillW]}>W</Text>}
                              {(c.isNotifiable || c.isIndicatable) && (
                                <Text style={[styles.pill, styles.pillN]}>N</Text>
                              )}
                              {c.isReadable && <Text style={[styles.pill, styles.pillR]}>R</Text>}
                              {isCurTx && <Text style={[styles.pill, styles.pillActive]}>ACTIVE TX</Text>}
                              {isCurRx && <Text style={[styles.pill, styles.pillActive]}>ACTIVE RX</Text>}
                            </View>
                          </View>

                          <View style={styles.bindBtnGroup}>
                            {c.isWritable && (
                              <TouchableOpacity
                                style={styles.miniBindBtn}
                                onPress={() => handleManualBind(svc.uuid, c.charUuid, 'tx')}
                              >
                                <Text style={styles.miniBindBtnText}>Set TX</Text>
                              </TouchableOpacity>
                            )}
                            {(c.isNotifiable || c.isIndicatable) && (
                              <TouchableOpacity
                                style={[styles.miniBindBtn, styles.miniBindRx]}
                                onPress={() => handleManualBind(svc.uuid, c.charUuid, 'rx')}
                              >
                                <Text style={styles.miniBindBtnText}>Set RX</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0d12',
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#8b949e',
    fontSize: 11,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#161b22',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#30363d',
  },
  closeBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  statusBanner: {
    backgroundColor: '#161b22',
    margin: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  dotConnected: {
    backgroundColor: '#22c55e',
  },
  dotDisconnected: {
    backgroundColor: '#ef4444',
  },
  statusLabel: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  batterySummary: {
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: '600',
  },
  endpointCard: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#21262d',
  },
  endpointLine: {
    color: '#c9d1d9',
    fontSize: 11,
    fontFamily: 'Courier',
    marginVertical: 1,
  },
  endpointKey: {
    color: '#58a6ff',
    fontWeight: 'bold',
  },
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 10,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#21262d',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#30363d',
  },
  actionBtnText: {
    color: '#f0f6fc',
    fontSize: 11,
    fontWeight: '600',
  },
  shareBtn: {
    backgroundColor: '#1d4ed8',
    borderColor: '#3b82f6',
    flex: 1.5,
  },
  shareBtnText: {
    color: '#ffffff',
  },
  clearBtn: {
    backgroundColor: '#30363d',
    flex: 0.8,
  },
  clearBtnText: {
    color: '#f87171',
    fontSize: 11,
    fontWeight: '600',
  },
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
    marginHorizontal: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#3b82f6',
  },
  tabText: {
    color: '#8b949e',
    fontSize: 12,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#ffffff',
  },
  logScrollView: {
    flex: 1,
    backgroundColor: '#010409',
    margin: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#21262d',
  },
  logContent: {
    padding: 10,
  },
  emptyText: {
    color: '#8b949e',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 30,
  },
  logEntry: {
    marginBottom: 4,
  },
  logLine: {
    color: '#8b949e',
    fontSize: 10,
    fontFamily: 'Courier',
    lineHeight: 14,
  },
  logTx: {
    color: '#60a5fa',
  },
  logRx: {
    color: '#4ade80',
  },
  logErr: {
    color: '#f87171',
  },
  gattScrollView: {
    flex: 1,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  gattContent: {
    paddingBottom: 40,
  },
  serviceCard: {
    backgroundColor: '#161b22',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#30363d',
    marginBottom: 10,
    padding: 12,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceUuid: {
    color: '#f0f6fc',
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'Courier',
    flex: 1,
    marginRight: 6,
  },
  vendorBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  vendorBadgeHighlight: {
    backgroundColor: '#1d4ed8',
  },
  standardBadge: {
    backgroundColor: '#30363d',
  },
  vendorBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  charList: {
    borderTopWidth: 1,
    borderTopColor: '#21262d',
    paddingTop: 6,
    gap: 6,
  },
  charRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#1c2128',
  },
  charRowActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 6,
    paddingHorizontal: 4,
  },
  charInfo: {
    flex: 1,
    marginRight: 6,
  },
  charUuid: {
    color: '#c9d1d9',
    fontSize: 10,
    fontFamily: 'Courier',
  },
  pillGroup: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 3,
  },
  pill: {
    fontSize: 8,
    fontWeight: 'bold',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  pillW: {
    backgroundColor: '#1e3a8a',
    color: '#93c5fd',
  },
  pillN: {
    backgroundColor: '#064e3b',
    color: '#6ee7b7',
  },
  pillR: {
    backgroundColor: '#78350f',
    color: '#fcd34d',
  },
  pillActive: {
    backgroundColor: '#2563eb',
    color: '#ffffff',
  },
  bindBtnGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  miniBindBtn: {
    backgroundColor: '#238636',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  miniBindRx: {
    backgroundColor: '#1f6feb',
  },
  miniBindBtnText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: 'bold',
  },
});
