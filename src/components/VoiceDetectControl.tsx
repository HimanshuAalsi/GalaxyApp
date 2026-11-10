import React from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity } from 'react-native';
import { useBudsStore } from '../store/useBudsStore';
import { CommandDispatcher } from '../services/CommandDispatcher';

export const VoiceDetectControl: React.FC = () => {
  const { voiceDetect, voiceDetectDuration, connectionState } = useBudsStore();
  const isConnected = connectionState === 'connected';
  const dispatcher = CommandDispatcher.getInstance();

  const handleToggle = async (val: boolean) => {
    if (!isConnected) return;
    await dispatcher.setVoiceDetect(val);
  };

  const handleSelectDuration = async (dur: 5 | 10 | 15) => {
    if (!isConnected) return;
    await dispatcher.setVoiceDetectDuration(dur);
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Voice Detect (Speak-to-Chat)</Text>
          <Text style={styles.subtitle}>
            Auto-switch to Ambient Sound & lower media volume when speaking
          </Text>
        </View>
        <Switch
          value={voiceDetect}
          onValueChange={handleToggle}
          disabled={!isConnected}
          trackColor={{ false: '#30363d', true: '#3b82f6' }}
          thumbColor={voiceDetect ? '#ffffff' : '#9ca3af'}
        />
      </View>

      {voiceDetect && (
        <View style={styles.durationSection}>
          <Text style={styles.durationLabel}>Time to auto-resume ANC & volume:</Text>
          <View style={styles.pillGroup}>
            {([5, 10, 15] as const).map((dur) => (
              <TouchableOpacity
                key={dur}
                style={[
                  styles.pill,
                  voiceDetectDuration === dur && styles.pillActive,
                  !isConnected && styles.disabled,
                ]}
                onPress={() => handleSelectDuration(dur)}
                disabled={!isConnected}
              >
                <Text
                  style={[
                    styles.pillText,
                    voiceDetectDuration === dur && styles.pillTextActive,
                  ]}
                >
                  {dur} seconds
                </Text>
              </TouchableOpacity>
            ))}
          </View>
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
  durationSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#21262d',
  },
  durationLabel: {
    color: '#8b949e',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 8,
  },
  pillGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    flex: 1,
    backgroundColor: '#0d1117',
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#30363d',
  },
  pillActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  pillText: {
    color: '#8b949e',
    fontSize: 12,
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#ffffff',
  },
  disabled: {
    opacity: 0.5,
  },
});
