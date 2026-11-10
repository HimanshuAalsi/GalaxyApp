import React from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity } from 'react-native';
import { useBudsStore } from '../store/useBudsStore';
import { CommandDispatcher } from '../services/CommandDispatcher';

export const TouchControlSection: React.FC = () => {
  const { touchControls, connectionState } = useBudsStore();
  const isConnected = connectionState === 'connected';
  const dispatcher = CommandDispatcher.getInstance();

  const handleToggleLockAll = async (val: boolean) => {
    if (!isConnected) return;
    await dispatcher.setTouchLock(val);
  };

  const handleToggleGesture = async (
    key: 'tap' | 'doubleTap' | 'tripleTap' | 'touchAndHold',
    val: boolean
  ) => {
    if (!isConnected) return;
    await dispatcher.updateTouchGestures({ [key]: val });
  };

  const handleCycleHoldAction = async (side: 'left' | 'right') => {
    if (!isConnected) return;
    const actions: ('noise_control' | 'voice_assistant' | 'volume_down' | 'volume_up' | 'spotify')[] =
      side === 'left'
        ? ['noise_control', 'voice_assistant', 'volume_down', 'spotify']
        : ['noise_control', 'voice_assistant', 'volume_up', 'spotify'];

    const current = side === 'left' ? touchControls.leftHoldAction : touchControls.rightHoldAction;
    const currentIdx = actions.indexOf(current);
    const nextAction = actions[(currentIdx + 1) % actions.length];

    if (side === 'left') {
      await dispatcher.setTouchAndHoldAction(
        nextAction as any,
        touchControls.rightHoldAction
      );
    } else {
      await dispatcher.setTouchAndHoldAction(
        touchControls.leftHoldAction,
        nextAction as any
      );
    }
  };

  const getHoldLabel = (action: string) => {
    switch (action) {
      case 'noise_control':
        return 'Switch Noise Controls';
      case 'voice_assistant':
        return 'Voice Assistant';
      case 'volume_down':
        return 'Volume Down';
      case 'volume_up':
        return 'Volume Up';
      case 'spotify':
        return 'Spotify Tap';
      default:
        return 'Noise Control';
    }
  };

  return (
    <View style={styles.card}>
      {/* Global Block Touches Switch */}
      <View style={styles.headerRow}>
        <View style={styles.textContainer}>
          <Text style={styles.cardTitle}>Touch Controls</Text>
          <Text style={styles.subtitle}>
            {touchControls.isAllLocked
              ? 'Touches are blocked. Tap below to unlock.'
              : 'Customize touch actions and sensitivity'}
          </Text>
        </View>
        <Switch
          value={!touchControls.isAllLocked}
          onValueChange={(val) => handleToggleLockAll(!val)}
          disabled={!isConnected}
          trackColor={{ false: '#30363d', true: '#3b82f6' }}
          thumbColor={!touchControls.isAllLocked ? '#ffffff' : '#9ca3af'}
        />
      </View>

      {!touchControls.isAllLocked && (
        <View style={styles.gesturesList}>
          {/* Individual Gesture Toggles */}
          <View style={styles.gestureRow}>
            <View>
              <Text style={styles.gestureName}>Tap</Text>
              <Text style={styles.gestureDesc}>Play or pause audio</Text>
            </View>
            <Switch
              value={touchControls.tap}
              onValueChange={(val) => handleToggleGesture('tap', val)}
              disabled={!isConnected}
              trackColor={{ false: '#21262d', true: '#3b82f6' }}
              thumbColor={touchControls.tap ? '#ffffff' : '#9ca3af'}
            />
          </View>

          <View style={styles.gestureRow}>
            <View>
              <Text style={styles.gestureName}>Double Tap</Text>
              <Text style={styles.gestureDesc}>Play next track / Answer or end call</Text>
            </View>
            <Switch
              value={touchControls.doubleTap}
              onValueChange={(val) => handleToggleGesture('doubleTap', val)}
              disabled={!isConnected}
              trackColor={{ false: '#21262d', true: '#3b82f6' }}
              thumbColor={touchControls.doubleTap ? '#ffffff' : '#9ca3af'}
            />
          </View>

          <View style={styles.gestureRow}>
            <View>
              <Text style={styles.gestureName}>Triple Tap</Text>
              <Text style={styles.gestureDesc}>Play previous track</Text>
            </View>
            <Switch
              value={touchControls.tripleTap}
              onValueChange={(val) => handleToggleGesture('tripleTap', val)}
              disabled={!isConnected}
              trackColor={{ false: '#21262d', true: '#3b82f6' }}
              thumbColor={touchControls.tripleTap ? '#ffffff' : '#9ca3af'}
            />
          </View>

          {/* Touch and Hold Customization */}
          <View style={styles.holdSection}>
            <Text style={styles.holdSectionTitle}>Touch & Hold Action</Text>
            <View style={styles.holdPillsRow}>
              <TouchableOpacity
                style={[styles.holdPill, !isConnected && styles.disabled]}
                onPress={() => handleCycleHoldAction('left')}
                disabled={!isConnected}
              >
                <Text style={styles.holdSide}>Left Earbud</Text>
                <Text style={styles.holdValue}>{getHoldLabel(touchControls.leftHoldAction)}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.holdPill, !isConnected && styles.disabled]}
                onPress={() => handleCycleHoldAction('right')}
                disabled={!isConnected}
              >
                <Text style={styles.holdSide}>Right Earbud</Text>
                <Text style={styles.holdValue}>{getHoldLabel(touchControls.rightHoldAction)}</Text>
              </TouchableOpacity>
            </View>
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
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  cardTitle: {
    color: '#f0f6fc',
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: {
    color: '#8b949e',
    fontSize: 11,
    marginTop: 2,
  },
  gesturesList: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#21262d',
    gap: 10,
  },
  gestureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gestureName: {
    color: '#f0f6fc',
    fontSize: 13,
    fontWeight: '600',
  },
  gestureDesc: {
    color: '#8b949e',
    fontSize: 11,
    marginTop: 1,
  },
  holdSection: {
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#21262d',
  },
  holdSectionTitle: {
    color: '#8b949e',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  holdPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  holdPill: {
    flex: 1,
    backgroundColor: '#0d1117',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  holdSide: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  holdValue: {
    color: '#f0f6fc',
    fontSize: 12,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
});
