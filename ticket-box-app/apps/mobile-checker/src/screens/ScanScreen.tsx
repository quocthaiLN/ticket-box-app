import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, ActivityIndicator, Modal, TextInput } from 'react-native';
import { Camera, CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { apiPost } from '../services/api';
import { validateTicketOffline } from '../services/validation';

type ScanScreenProps = {
  config: {
    apiBaseUrl: string;
    token: string;
    concertId: string;
    gateId: string;
    deviceId: string;
  };
  mode: 'online' | 'offline';
};

type ScanResultState = {
  status: 'SUCCESS' | 'ALREADY_CHECKED_IN' | 'WRONG_GATE' | 'INVALID_TICKET' | 'ERROR' | null;
  message: string;
};

export function ScanScreen({ config, mode }: ScanScreenProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torch, setTorch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResultState>({ status: null, message: '' });
  const [manualInputVisible, setManualInputVisible] = useState(false);
  const [manualCode, setManualCode] = useState('');

  // Clear result after 2.5s
  useEffect(() => {
    if (result.status) {
      const timer = setTimeout(() => {
        setResult({ status: null, message: '' });
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [result.status]);

  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color="#2f80ed" size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.permissionText}>Ứng dụng cần quyền Camera để soát vé.</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Cấp quyền Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  async function handleBarCodeScanned({ data }: { data: string }) {
    if (scanned || busy) return;
    setScanned(true);
    setBusy(true);

    try {
      if (mode === 'offline') {
        const localResult = await validateTicketOffline(data, config.concertId, config.gateId);
        
        if (localResult.result === 'SUCCESS') {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setResult({ status: 'SUCCESS', message: 'Soát vé thành công!' });
        } else {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setResult({
            status: localResult.result as any,
            message: localResult.reason || 'Lỗi quét vé offline.',
          });
        }
      } else {
        // Online checkin
        const response: any = await apiPost(
          config.apiBaseUrl,
          '/check-in/scan',
          {
            concert_id: config.concertId,
            gate_id: config.gateId,
            device_id: config.deviceId,
            qr_token: data,
            scanned_at: new Date().toISOString(),
          },
          {
            headers: {
              Authorization: `Bearer ${config.token}`,
            },
          }
        );

        if (response.data.result === 'SUCCESS') {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setResult({ status: 'SUCCESS', message: 'Soát vé thành công!' });
        } else {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setResult({ status: response.data.result, message: response.data.reason || 'Lỗi soát vé.' });
        }
      }
    } catch (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setResult({
        status: 'ERROR',
        message: error instanceof Error ? error.message : 'Lỗi kết nối máy chủ.',
      });
    } finally {
      setBusy(false);
      // Re-enable scanning after 1.5 seconds
      setTimeout(() => {
        setScanned(false);
      }, 1500);
    }
  }

  async function handleManualSubmit() {
    if (!manualCode.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập mã vé.');
      return;
    }
    setManualInputVisible(false);
    const code = manualCode.trim();
    setManualCode('');
    // Wait briefly for modal to close, then scan
    setTimeout(() => {
      void handleBarCodeScanned({ data: code });
    }, 300);
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
      >
        <View style={styles.overlay}>
          {/* Header info */}
          <View style={styles.header}>
            <Text style={styles.modeText}>
              Chế độ: {mode === 'online' ? '🟢 ONLINE' : '🔴 OFFLINE'}
            </Text>
            <Text style={styles.gateText}>Cổng: {config.gateId || 'Chưa đặt'}</Text>
          </View>

          {/* Center Target Box */}
          <View style={styles.targetContainer}>
            <View style={styles.targetFrame} />
            <Text style={styles.instructionText}>Đưa mã QR của vé vào giữa khung</Text>
          </View>

          {/* Footer Controls */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.footerButton} onPress={() => setTorch(!torch)}>
              <Text style={styles.footerButtonText}>{torch ? '💡 Tắt Flash' : '🔦 Bật Flash'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.footerButton} onPress={() => setManualInputVisible(true)}>
              <Text style={styles.footerButtonText}>⌨️ Nhập mã tay</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Scan Result Overlay */}
        {result.status && (
          <View style={[styles.resultCard, styles[`resultCard_${result.status}`]]}>
            <Text style={styles.resultTitle}>{result.status}</Text>
            <Text style={styles.resultDesc}>{result.message}</Text>
          </View>
        )}
      </CameraView>

      {/* Manual Input Modal */}
      <Modal
        visible={manualInputVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setManualInputVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nhập mã vé thủ công</Text>
            <Text style={styles.modalSubtitle}>Vui lòng điền mã ID vé hoặc mã Token QR:</Text>
            
            <TextInput
              style={styles.modalInput}
              value={manualCode}
              onChangeText={setManualCode}
              placeholder="Nhập mã vé..."
              placeholderTextColor="#8585a0"
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancelBtn]}
                onPress={() => {
                  setManualInputVisible(false);
                  setManualCode('');
                }}
              >
                <Text style={styles.modalCancelBtnText}>Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.modalConfirmBtn]}
                onPress={handleManualSubmit}
              >
                <Text style={styles.modalConfirmBtnText}>Soát Vé</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#101114',
    padding: 24,
  },
  permissionText: {
    fontSize: 16,
    color: '#f7f7f2',
    textAlign: 'center',
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: '#2f80ed',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#0d0d15',
    fontWeight: '800',
    fontSize: 15,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'space-between',
    padding: 24,
  },
  header: {
    marginTop: 24,
    alignItems: 'center',
    backgroundColor: 'rgba(25, 27, 32, 0.8)',
    padding: 12,
    borderRadius: 8,
  },
  modeText: {
    color: '#f7f7f2',
    fontSize: 14,
    fontWeight: '800',
  },
  gateText: {
    color: '#aeb7c7',
    fontSize: 12,
    marginTop: 4,
  },
  targetContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#2f80ed',
    borderRadius: 16,
    backgroundColor: 'transparent',
    marginBottom: 16,
  },
  instructionText: {
    color: '#f7f7f2',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 12,
  },
  footerButton: {
    backgroundColor: 'rgba(25, 27, 32, 0.8)',
    borderWidth: 1,
    borderColor: '#3c4350',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    minWidth: 130,
    alignItems: 'center',
  },
  footerButtonText: {
    color: '#f7f7f2',
    fontWeight: '700',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#191b20',
    borderWidth: 1,
    borderColor: '#343a46',
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f7f7f2',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#aeb7c7',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#343a46',
    borderRadius: 8,
    backgroundColor: '#111318',
    color: '#f7f7f2',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginTop: 4,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalBtn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtn: {
    backgroundColor: '#22252d',
    borderWidth: 1,
    borderColor: '#3c4350',
  },
  modalConfirmBtn: {
    backgroundColor: '#2f80ed',
  },
  modalCancelBtnText: {
    color: '#f7f7f2',
    fontWeight: '700',
    fontSize: 14,
  },
  modalConfirmBtnText: {
    color: '#0d0d15',
    fontWeight: '800',
    fontSize: 14,
  },
  // Result card types
  resultCard: {
    position: 'absolute',
    top: '30%',
    left: 24,
    right: 24,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 4,
  },
  resultDesc: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
  resultCard_SUCCESS: {
    backgroundColor: '#0f2e22',
    borderColor: '#1f9d55',
  },
  resultCard_ALREADY_CHECKED_IN: {
    backgroundColor: '#342310',
    borderColor: '#d98b00',
  },
  resultCard_WRONG_GATE: {
    backgroundColor: '#342310',
    borderColor: '#d98b00',
  },
  resultCard_INVALID_TICKET: {
    backgroundColor: '#331819',
    borderColor: '#d64545',
  },
  resultCard_ERROR: {
    backgroundColor: '#331819',
    borderColor: '#d64545',
  },
} as any);
