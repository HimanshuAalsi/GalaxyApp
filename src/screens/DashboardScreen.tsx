import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Header } from '../components/Header';
import { EarbudsGraphic } from '../components/EarbudsGraphic';
import { BatteryIndicator } from '../components/BatteryIndicator';
import { AncSelector } from '../components/AncSelector';
import { QuickToggles } from '../components/QuickToggles';
import { DeviceScannerModal } from '../components/DeviceScannerModal';
import { BleService } from '../services/BleManager';
import { CommandDispatcher } from '../services/CommandDispatcher';
import { useBudsStore, BudsDevice } from '../store/useBudsStore';

export const DashboardScreen: React.FC = () => {
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { connectionState } = useBudsStore();
  const bleService = BleService.getInstance();
  const commandDispatcher = CommandDispatcher.getInstance();

  useEffect(() => {
    // Check BLE state on launch
    bleService.ensurePoweredOn();
  }, []);

  const handleOpenScanner = async () => {
    setIsScannerVisible(true);
    await bleService.startScan();
  };

  const handleSelectDevice = async (device: BudsDevice) => {
    setIsScannerVisible(false);
    const connected = await bleService.connect(device.id);
    if (connected) {
      // Small pause to allow GATT characteristics to settle before querying
      setTimeout(async () => {
        await commandDispatcher.requestStatus();
      }, 500);
    }
  };

  const handleDisconnect = async () => {
    await bleService.disconnect();
  };

  const onRefresh = async () => {
    if (connectionState === 'connected') {
      setRefreshing(true);
      await commandDispatcher.requestStatus();
      setTimeout(() => setRefreshing(false), 600);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0d1117" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3b82f6"
            enabled={connectionState === 'connected'}
          />
        }
      >
        {/* App Bar / Header */}
        <Header
          onOpenScanner={handleOpenScanner}
          onDisconnect={handleDisconnect}
        />

        {/* Visual Graphic Representation */}
        <EarbudsGraphic />

        {/* Battery Monitor Rings */}
        <BatteryIndicator />

        {/* Segmented ANC Mode Selector */}
        <AncSelector />

        {/* Hardware Toggles & Protocol Hex Stream */}
        <QuickToggles />
      </ScrollView>

      {/* BLE Peripheral Scanner Modal */}
      <DeviceScannerModal
        visible={isScannerVisible}
        onClose={() => {
          setIsScannerVisible(false);
          bleService.stopScan();
        }}
        onSelectDevice={handleSelectDevice}
        onRefreshScan={() => bleService.startScan()}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0d1117',
  },
  scrollContent: {
    paddingBottom: 40,
  },
});

