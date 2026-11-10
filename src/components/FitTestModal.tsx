import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useBudsStore } from '../store/useBudsStore';
import { CommandDispatcher } from '../services/CommandDispatcher';

interface FitTestModalProps {
  visible: boolean;
  onClose: () => void;
}

export const FitTestModal: React.FC<FitTestModalProps> = ({ visible, onClose }) => {
  const { fitTest, connectionState } = useBudsStore();
  const isConnected = connectionState === 'connected';
  const dispatcher = CommandDispatcher.getInstance();

  const handleStartTest = async () => {
    if (!isConnected) return;
    await dispatcher.startFitTest();
  };

  const renderBadge = (res: 'good' | 'adjust' | null) => {
    if (!res) return <Text style={styles.badgePending}>Not tested</Text>;
    if (res === 'good') {
      return <Text style={styles.badgeGood}>✓ Good Fit</Text>;
    }
    return <Text style={styles.badgeAdjust}>⚠️ Adjust Earbud</Text>;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Earbud Fit Test</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.description}>
            Put both earbuds in your ears. The app will play acoustic test tones to verify a proper seal for optimal ANC and bass.
          </Text>

          <View style={styles.earbudsRow}>
            <View style={styles.earbudCard}>
              <Text style={styles.earbudIcon}>🎧</Text>
              <Text style={styles.earbudName}>Left Earbud</Text>
              {renderBadge(fitTest.leftResult)}
            </View>

            <View style={styles.earbudCard}>
              <Text style={styles.earbudIcon}>🎧</Text>
              <Text style={styles.earbudName}>Right Earbud</Text>
              {renderBadge(fitTest.rightResult)}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.startBtn, fitTest.isTesting && styles.btnDisabled]}
            onPress={handleStartTest}
            disabled={fitTest.isTesting || !isConnected}
          >
            {fitTest.isTesting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.startBtnText}>Start Test</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#161b22',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  closeText: {
    color: '#8b949e',
    fontSize: 16,
    fontWeight: 'bold',
    padding: 4,
  },
  description: {
    color: '#8b949e',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 20,
  },
  earbudsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  earbudCard: {
    flex: 1,
    backgroundColor: '#0d1117',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#30363d',
  },
  earbudIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  earbudName: {
    color: '#f0f6fc',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  badgePending: {
    color: '#6e7681',
    fontSize: 12,
    fontWeight: '500',
  },
  badgeGood: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '700',
  },
  badgeAdjust: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '700',
  },
  startBtn: {
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  startBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});

