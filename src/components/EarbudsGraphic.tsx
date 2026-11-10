import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Path, Defs, LinearGradient, Stop } from 'react-native-svg';

export const EarbudsGraphic: React.FC = () => {
  return (
    <View style={styles.container}>
      <Svg width="260" height="150" viewBox="0 0 260 150">
        <Defs>
          <LinearGradient id="budGradL" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#4f46e5" stopOpacity="0.9" />
            <Stop offset="100%" stopColor="#1e1b4b" stopOpacity="1" />
          </LinearGradient>
          <LinearGradient id="budGradR" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#6366f1" stopOpacity="0.9" />
            <Stop offset="100%" stopColor="#312e81" stopOpacity="1" />
          </LinearGradient>
          <LinearGradient id="ambientGlow" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#6366f1" stopOpacity="0.15" />
            <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Ambient Backlight */}
        <Circle cx="130" cy="75" r="70" fill="url(#ambientGlow)" />

        {/* Left Earbud */}
        <Circle cx="75" cy="75" r="42" fill="url(#budGradL)" stroke="#6366f1" strokeWidth="1.5" />
        <Circle cx="65" cy="65" r="14" fill="#1e1b4b" opacity="0.6" />
        <Path
          d="M 68 85 Q 75 95 82 85"
          stroke="#a5b4fc"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />

        {/* Right Earbud */}
        <Circle cx="185" cy="75" r="42" fill="url(#budGradR)" stroke="#6366f1" strokeWidth="1.5" />
        <Circle cx="195" cy="65" r="14" fill="#1e1b4b" opacity="0.6" />
        <Path
          d="M 178 85 Q 185 95 192 85"
          stroke="#a5b4fc"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
});

