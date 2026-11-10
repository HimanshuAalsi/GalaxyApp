import React from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import { useBudsStore } from '../store/useBudsStore';
import { CommandDispatcher } from '../services/CommandDispatcher';

export const SpatialAudioControl: React.FC = () => {
  const { spatialAudio, spatialHeadTracking, connectionState } = useBudsStore();
  const isConnected = connectionState === 'connected';
  const dispatcher = CommandDispatcher.getInstance();

  const handleToggleSpatial = async (val: boolean) => {
    if (!isConnected) return;
    await dispatcher.setSpatialAudio(val);
  };

  const handleToggleHeadTracking = (val: boolean) => {
    useBudsStore.getState().setSpatialHeadTracking(val);
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>360 Audio (Spatial Sound)</Text>
          <Text style={styles.subtitle}>
            Immersive surround sound mapped in 3D around your head
          </Text>
        </View>
        <Switch
          value={spatialAudio}
          onValueChange={handleToggleSpatial}
          disabled={!isConnected}
          trackColor={{ false: '#30363d', true: '#3b82f6' }}
          thumbColor={spatialAudio ? '#ffffff' : '#9ca3af'}
        />
      </View>

      {spatialAudio && (
        <View style={styles.subRow}>
          <View style={styles.subTextContainer}>
            <Text style={styles.subTitle}>Head Tracking</Text>
            <Text style={styles.subDescription}>
              Audio stays anchored in place when turning your head
            </Text>
          </View>
          <Switch
            value={spatialHeadTracking}
            onValueChange={handleToggleHeadTracking}
            disabled={!isConnected}
            trackColor={{ false: '#30363d', true: '#10b981' }}
            thumbColor={spatialHeadTracking ? '#ffffff' : '#9ca3af'}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#161b22',
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    color: '#f0f6fc',
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: {
    color: '#8b949e',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  subRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#21262d',
  },
  subTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  subTitle: {
    color: '#f0f6fc',
    fontSize: 13,
    fontWeight: '600',
  },
  subDescription: {
    color: '#8b949e',
    fontSize: 11,
    marginTop: 2,
  },
});

