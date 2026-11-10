import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useBudsStore } from '../store/useBudsStore';
import { CommandDispatcher } from '../services/CommandDispatcher';

interface FindMyBudsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const FindMyBudsModal: React.FC<FindMyBudsModalProps> = ({ visible, onClose }) => {
  const { isFindMyBudsActive, leftBeeping, rightBeeping, connectionState } = useBudsStore();
  const isConnected = connectionState === 'connected';
  const dispatcher = CommandDispatcher.getInstance();

  const handleToggleBeeping = async () => {
    if (!isConnected) return;
    if (isFindMyBudsActive) {
      await dispatcher.stopFindMyBuds();
    } else {
      await dispatcher.startFindMyBuds(true, true);
    }
  };

  const handleToggleMute = async (side: 'left' | 'right') => {
    if (!isConnected || !isFindMyBudsActive) return;
    const isCurrentlyBeeping = side === 'left' ? leftBeeping : rightBeeping;
    await dispatcher.muteFindMyBud(side, isCurrentlyBeeping);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Find My Earbuds</Text>
            <TouchableOpacity
              onPress={() => {
                if (isFindMyBudsActive) dispatcher.stopFindMyBuds();
                onClose();
              }}
            >
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              ⚠️ Take earbuds out of your ears before starting to prevent hearing damage.
            </Text>
          </View>

          <View style={styles.beepersRow}>
            {/* Left Earbud */}
            <View style={[styles.budBox, leftBeeping && styles.budBoxActive]}>
              <Text style={styles.budIcon}>🎧</Text>
              <Text style={styles.budName}>Left Earbud</Text>
              <TouchableOpacity
                style={[
                  styles.muteBtn,
                  !leftBeeping && styles.muteBtnActive,
                  !isFindMyBudsActive && styles.btnDisabled,
                ]}
                onPress={() => handleToggleMute('left')}
                disabled={!isFindMyBudsActive}
              >
                <Text style={styles.muteBtnText}>{leftBeeping ? 'Beeping 🔊' : 'Muted 🔇'}</Text>
              </TouchableOpacity>
            </View>

            {/* Right Earbud */}
            <View style={[styles.budBox, rightBeeping && styles.budBoxActive]}>
              <Text style={styles.budIcon}>🎧</Text>
              <Text style={styles.budName}>Right Earbud</Text>
              <TouchableOpacity
                style={[
                  styles.muteBtn,
                  !rightBeeping && styles.muteBtnActive,
                  !isFindMyBudsActive && styles.btnDisabled,
                ]}
                onPress={() => handleToggleMute('right')}
                disabled={!isFindMyBudsActive}
              >
                <Text style={styles.muteBtnText}>{rightBeeping ? 'Beeping 🔊' : 'Muted 🔇'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.mainBtn,
              isFindMyBudsActive ? styles.stopBtn : styles.startBtn,
              !isConnected && styles.btnDisabled,
            ]}
            onPress={handleToggleBeeping}
            disabled={!isConnected}
          >
            <Text style={styles.mainBtnText}>
              {isFindMyBudsActive ? 'Stop Beeping' : 'Start Beeping'}
            </Text>
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
    marginBottom: 14,
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
  },
  warningBox: {
    backgroundColor: '#3b2308',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#854d0e',
    marginBottom: 20,
  },
  warningText: {
    color: '#fef08a',
    fontSize: 12,
    lineHeight: 16,
  },
  beepersRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  budBox: {
    flex: 1,
    backgroundColor: '#0d1117',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#30363d',
  },
  budBoxActive: {
    borderColor: '#ef4444',
  },
  budIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  budName: {
    color: '#f0f6fc',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  muteBtn: {
    backgroundColor: '#1f2937',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  muteBtnActive: {
    backgroundColor: '#374151',
  },
  muteBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  mainBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  startBtn: {
    backgroundColor: '#3b82f6',
  },
  stopBtn: {
    backgroundColor: '#ef4444',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  mainBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});

