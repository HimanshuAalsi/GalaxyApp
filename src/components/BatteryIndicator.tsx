import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useBudsStore } from '../store/useBudsStore';

export const BatteryIndicator: React.FC = () => {
  const { battery } = useBudsStore();

  const renderBatteryPill = (
    label: string,
    percentage: number,
    isCharging: boolean
  ) => {
    const getBarColor = (val: number) => {
      if (val > 40) return '#10b981'; // Green
      if (val > 15) return '#f59e0b'; // Amber
      return '#ef4444'; // Red
    };

    return (
      <View style={styles.pillContainer}>
        <View style={styles.topRow}>
          <Text style={styles.label}>{label}</Text>
          {isCharging && <Text style={styles.chargingBolt}>⚡</Text>}
        </View>

        <Text style={styles.percentageText}>{percentage}%</Text>

        {/* Progress Bar */}
        <View style={styles.track}>
          <View
            style={[
              styles.bar,
              {
                width: `${Math.min(100, Math.max(0, percentage))}%`,
                backgroundColor: getBarColor(percentage),
              },
            ]}
          />
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {renderBatteryPill('Left', battery.left, battery.isLeftCharging)}
      {renderBatteryPill('Case', battery.case, battery.isCaseCharging)}
      {renderBatteryPill('Right', battery.right, battery.isRightCharging)}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginVertical: 12,
    gap: 12,
  },
  pillContainer: {
    flex: 1,
    backgroundColor: '#161b22',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#30363d',
    alignItems: 'center',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    color: '#8b949e',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  chargingBolt: {
    fontSize: 10,
    color: '#38bdf8',
    marginLeft: 3,
  },
  percentageText: {
    color: '#f0f6fc',
    fontSize: 20,
    fontWeight: '700',
    marginVertical: 4,
  },
  track: {
    width: '100%',
    height: 6,
    backgroundColor: '#21262d',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 6,
  },
  bar: {
    height: '100%',
    borderRadius: 3,
  },
});

