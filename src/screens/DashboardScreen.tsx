import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  View,
} from 'react-native';
import { Header } from '../components/Header';
import { EarbudsGraphic } from '../components/EarbudsGraphic';
import { BatteryIndicator } from '../components/BatteryIndicator';
import { AncSelector } from '../components/AncSelector';
import { VoiceDetectControl } from '../components/VoiceDetectControl';
import { SpatialAudioControl } from '../components/SpatialAudioControl';
import { EqualizerControl } from '../components/EqualizerControl';
import { TouchControlSection } from '../components/TouchControlSection';
import { NeckStretchControl } from '../components/NeckStretchControl';
import { ExtraSettingsSection } from '../components/ExtraSettingsSection';
import { DeviceScannerModal } from '../components/DeviceScannerModal';
import { BleService } from '../services/BleManager';
import { CommandDispatcher } from '../services/CommandDispatcher';
import { useBudsStore, BudsDevice } from '../store/useBudsStore';

export const DashboardScreen: React.FC = () => {
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { connectionState } = useBudsStore();
  const bleService = BleService.getInstance();
  const dispatcher = CommandDispatcher.getInstance();

  useEffect(() => {
    // Check BLE state and automatically attempt to discover paired iOS accessories
    (async () => {
      await bleService.ensurePoweredOn();
      // Auto-scan once on startup to check for already-connected iOS earbuds
      await bleService.startScan();
    })();
  }, []);

  const handleOpenScanner = async () => {
    setIsScannerVisible(true);
    await bleService.startScan();
  };

  const handleSelectDevice = async (device: BudsDevice) => {
    setIsScannerVisible(false);
    const connected = await bleService.connect(device.id);
    if (connected) {
      setTimeout(async () => {
        await dispatcher.requestStatus();
      }, 500);
    }
  };

  const handleDisconnect = async () => {
    await bleService.disconnect();
  };

  const onRefresh = async () => {
    if (connectionState === 'connected') {
      setRefreshing(true);
      await dispatcher.requestStatus();
      setTimeout(() => setRefreshing(false), 500);
    } else {
      await bleService.startScan();
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
          />
        }
      >
        {/* App Bar & Link Button */}
        <Header onOpenScanner={handleOpenScanner} onDisconnect={handleDisconnect} />

        {/* 3D Visual Depiction */}
        <EarbudsGraphic />

        {/* L / Case / R Battery & Placement Status */}
        <BatteryIndicator />

        {/* Noise Controls: ANC / Off / Ambient + Intensity */}
        <AncSelector />

        {/* Voice Detect (Speak to Chat) */}
        <VoiceDetectControl />

        {/* 360 Audio (Spatial Surround & Head Tracking) */}
        <SpatialAudioControl />

        {/* Equalizer Presets, 9-Band Custom Sliders & Gaming Mode */}
        <EqualizerControl />

        {/* Granular Touch Gesture Controls & Hold Actions */}
        <TouchControlSection />

        {/* Neck Stretch Posture Reminders & Sensor Calibration */}
        <NeckStretchControl />

        {/* Extra Smart Settings, Fit Test, Find My Buds & Diagnostics */}
        <ExtraSettingsSection />

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Discovery & Connection Sheet */}
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
    paddingBottom: 30,
  },
  bottomSpacer: {
    height: 40,
  },
});
