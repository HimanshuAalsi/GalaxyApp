import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useBudsStore, PlacementState } from '../store/useBudsStore';

export const BatteryIndicator: React.FC = () => {
  const { battery } = useBudsStore();

  const getPlacementLabel = (placement: PlacementState, isCharging: boolean) => {
    if (isCharging) return 'Charging ⚡';
    switch (placement) {
      case 'in_ear':
        return 'In Ear';
      case 'outside':
        return 'Idle';
      case 'case':
        return 'In Case';
      default:
        return 'Connected';
    }
  };

  const renderBatteryCard = (
    label: string,
    percentage: number,
    isCharging: boolean,
    placement?: PlacementState
  ) => {
    const getBarColor = (val: number) => {
      if (val > 35) return '#10b981'; // Green
      if (val > 15) return '#f59e0b'; // Amber
      return '#ef4444'; // Red
    };

    return (
      <View style={styles.card}>
        <View style={styles.topRow}>
          <Text style={styles.label}>{label}</Text>
          {isCharging && <Text style={styles.chargingBadge}>⚡</Text>}
        </View>

        <Text style={styles.percentageText}>{percentage}%</Text>

        {placement && (
          <Text style={styles.placementText}>
            {getPlacementLabel(placement, isCharging)}
          </Text>
        )}

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
      {renderBatteryCard('Left', battery.left, battery.isLeftCharging, battery.placementL)}
      {renderBatteryCard('Case', battery.case, battery.isCaseCharging)}
      {renderBatteryCard('Right', battery.right, battery.isRightCharging, battery.placementR)}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginVertical: 10,
    gap: 10,
  },
  card: {
    flex: 1,
    backgroundColor: '#161b22',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#30363d',
    alignItems: 'center',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  label: {
    color: '#8b949e',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  chargingBadge: {
    fontSize: 10,
    color: '#38bdf8',
    marginLeft: 4,
  },
  percentageText: {
    color: '#f0f6fc',
    fontSize: 22,
    fontWeight: '800',
    marginVertical: 2,
  },
  placementText: {
    color: '#6e7681',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
  },
  track: {
    width: '100%',
    height: 6,
    backgroundColor: '#21262d',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 4,
  },
  bar: {
    height: '100%',
    borderRadius: 3,
  },
});
