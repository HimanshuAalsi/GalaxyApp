import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  View,
  Text,
  TouchableOpacity,
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
    // Initial check: query paired system accessories and start an initial search
    (async () => {
      await bleService.ensurePoweredOn();
      await bleService.startScan();
    })();
  }, []);

  const handleOpenScanner = async () => {
    setIsScannerVisible(true);
    await bleService.startScan();
  };

  const handleSelectDevice = async (device: BudsDevice) => {
    const connected = await bleService.connect(device.id);
    if (connected) {
      setIsScannerVisible(false);
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
        {/* App Bar & Link / Cancel Button */}
        <Header onOpenScanner={handleOpenScanner} onDisconnect={handleDisconnect} />

        {/* Pairing Assistant Notice Card when Disconnected */}
        {connectionState !== 'connected' && (
          <TouchableOpacity
            style={styles.connectNoticeCard}
            onPress={handleOpenScanner}
            activeOpacity={0.8}
          >
            <View style={styles.noticeIconCircle}>
              <Text style={styles.noticeIcon}>⚡</Text>
            </View>
            <View style={styles.noticeTextContainer}>
              <Text style={styles.noticeTitle}>Link Buds2 Pro Settings</Text>
              <Text style={styles.noticeSubtext}>
                Open charging case lid with earbuds inside, then tap here to link live battery & controls.
              </Text>
            </View>
            <Text style={styles.noticeArrow}>→</Text>
          </TouchableOpacity>
        )}

        {/* Visual Depiction */}
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
        onCancelConnection={handleDisconnect}
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
  connectNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 6,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  noticeIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  noticeIcon: {
    color: '#ffffff',
    fontSize: 18,
  },
  noticeTextContainer: {
    flex: 1,
  },
  noticeTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  noticeSubtext: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 16,
  },
  noticeArrow: {
    color: '#60a5fa',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  bottomSpacer: {
    height: 40,
  },
});
