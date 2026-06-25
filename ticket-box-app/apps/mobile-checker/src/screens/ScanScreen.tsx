import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { apiPost } from '../services/api';
import { validateTicketOffline, validateGuestOffline } from '../services/validation';
import { getDatabase } from '../db/database';

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
  status: 'SUCCESS' | 'ALREADY_CHECKED_IN' | 'WRONG_GATE' | 'INVALID_TICKET' | 'INVALID_GUEST' | 'ERROR' | null;
  message: string;
};

export function ScanScreen({ config, mode }: ScanScreenProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torch, setTorch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResultState>({ status: null, message: '' });
  const [manualInputVisible, setManualInputVisible] = useState(false);
  const [cameraModalVisible, setCameraModalVisible] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [manualGuestId, setManualGuestId] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [activeManualTab, setActiveManualTab] = useState<'ticket' | 'guest'>('ticket');
  const [stats, setStats] = useState({ success: 0, wrongGate: 0, error: 0 });

  // Load stats on mount and every time screen renders/updates
  useEffect(() => {
    void loadStats();
  }, [cameraModalVisible, manualInputVisible]);

  async function loadStats() {
    try {
      const db = await getDatabase();
      const successRes = await db.getFirstAsync<{ count: number }>(
        "SELECT count(*) as count FROM offline_queue WHERE status = 'SUCCESS' OR status = 'synced'"
      );
      const wrongGateRes = await db.getFirstAsync<{ count: number }>(
        "SELECT count(*) as count FROM offline_queue WHERE status = 'WRONG_GATE'"
      );
      const errorRes = await db.getFirstAsync<{ count: number }>(
        "SELECT count(*) as count FROM offline_queue WHERE status = 'ALREADY_CHECKED_IN' OR status = 'INVALID_TICKET' OR status = 'INVALID_GUEST' OR status = 'ERROR' OR status = 'failed' OR status = 'conflict'"
      );

      setStats({
        success: successRes?.count ?? 0,
        wrongGate: wrongGateRes?.count ?? 0,
        error: errorRes?.count ?? 0,
      });
    } catch (error) {
      console.error('Lỗi tải thống kê quét vé:', error);
    }
  }

  // Clear result after 3.5s
  useEffect(() => {
    if (result.status) {
      const timer = setTimeout(() => {
        setResult({ status: null, message: '' });
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [result.status]);

  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color="#6045e2" size="large" />
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
      setCameraModalVisible(false); // Close camera modal upon scan
      void loadStats();
      // Re-enable scanning
      setTimeout(() => {
        setScanned(false);
      }, 1500);
    }
  }

  async function handleManualTicketSubmit() {
    const code = manualCode.trim();
    if (!code) {
      Alert.alert('Lỗi', 'Vui lòng nhập QR payload hoặc mã vé.');
      return;
    }
    setManualInputVisible(false);
    setManualCode('');
    setBusy(true);

    try {
      if (mode === 'offline') {
        const localResult = await validateTicketOffline(code, config.concertId, config.gateId);
        if (localResult.result === 'SUCCESS') {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setResult({ status: 'SUCCESS', message: 'Soát vé offline thành công!' });
        } else {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setResult({
            status: localResult.result as any,
            message: localResult.reason || 'Lỗi soát vé offline.',
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
            qr_token: code,
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
          setResult({ status: 'SUCCESS', message: 'Soát vé online thành công!' });
        } else {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setResult({ status: response.data.result, message: response.data.reason || 'Lỗi soát vé.' });
        }
      }
    } catch (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setResult({
        status: 'ERROR',
        message: error instanceof Error ? error.message : 'Kết nối thất bại.',
      });
    } finally {
      setBusy(false);
      void loadStats();
    }
  }

  async function handleManualGuestSubmit() {
    const guestId = manualGuestId.trim();
    const phone = manualPhone.trim();

    if (!guestId && !phone) {
      Alert.alert('Lỗi', 'Vui lòng điền Guest ID hoặc Số điện thoại.');
      return;
    }

    setManualInputVisible(false);
    setManualGuestId('');
    setManualPhone('');
    setBusy(true);

    try {
      if (mode === 'offline') {
        const localResult = await validateGuestOffline(guestId, phone, config.concertId, config.gateId);
        if (localResult.result === 'SUCCESS') {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setResult({ status: 'SUCCESS', message: 'Check-in khách mời offline thành công!' });
        } else {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setResult({
            status: localResult.result as any,
            message: localResult.reason || 'Lỗi check-in khách mời offline.',
          });
        }
      } else {
        // Online guest check-in
        const response: any = await apiPost(
          config.apiBaseUrl,
          '/check-in/guests/scans',
          {
            concert_id: config.concertId,
            gate_id: config.gateId,
            device_id: config.deviceId,
            guest_id: guestId || undefined,
            phone: phone || undefined,
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
          setResult({ status: 'SUCCESS', message: 'Check-in khách mời online thành công!' });
        } else {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setResult({ status: response.data.result, message: response.data.reason || 'Lỗi check-in.' });
        }
      }
    } catch (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setResult({
        status: 'ERROR',
        message: error instanceof Error ? error.message : 'Kết nối thất bại.',
      });
    } finally {
      setBusy(false);
      void loadStats();
    }
  }

  function getResultCardColor(status: string) {
    if (status === 'SUCCESS') return '#0f2e22';
    if (status === 'WRONG_GATE' || status === 'ALREADY_CHECKED_IN') return '#342310';
    return '#331819';
  }

  function getResultBorderColor(status: string) {
    if (status === 'SUCCESS') return '#1f9d55';
    if (status === 'WRONG_GATE' || status === 'ALREADY_CHECKED_IN') return '#d98b00';
    return '#d64545';
  }

  function getResultTitle(status: string) {
    if (status === 'SUCCESS') return '✓ SUCCESS';
    if (status === 'WRONG_GATE') return '⚠️ WRONG_GATE';
    if (status === 'ALREADY_CHECKED_IN') return '⚠️ ALREADY_CHECKED_IN';
    if (status === 'INVALID_TICKET') return '🚫 INVALID_TICKET';
    if (status === 'INVALID_GUEST') return '🚫 INVALID_GUEST';
    return '🚫 ERROR';
  }

  return (
    <View style={styles.container}>
      {/* 3 Stats Boxes Row */}
      <View style={styles.statsRow}>
        <View style={styles.statsCard}>
          <Text style={[styles.statsValue, { color: '#1f9d55' }]}>{stats.success}</Text>
          <Text style={styles.statsLabel}>Thành công</Text>
        </View>

        <View style={styles.statsCard}>
          <Text style={[styles.statsValue, { color: '#d98b00' }]}>{stats.wrongGate}</Text>
          <Text style={styles.statsLabel}>Sai cổng</Text>
        </View>

        <View style={styles.statsCard}>
          <Text style={[styles.statsValue, { color: '#d64545' }]}>{stats.error}</Text>
          <Text style={styles.statsLabel}>Lỗi / Trùng</Text>
        </View>
      </View>

      {/* Main Dashed Dashboard Card */}
      <View style={styles.dashboardCard}>
        {busy ? (
          <ActivityIndicator color="#6045e2" size="large" />
        ) : result.status ? (
          /* Scanned Result display inside the box */
          <View style={[
            styles.resultContainer,
            {
              backgroundColor: getResultCardColor(result.status),
              borderColor: getResultBorderColor(result.status)
            }
          ]}>
            <Text style={[styles.resultTitleText, { color: getResultBorderColor(result.status) }]}>
              {getResultTitle(result.status)}
            </Text>
            <Text style={styles.resultDescText}>{result.message}</Text>
          </View>
        ) : (
          /* Ready to scan placeholder */
          <View style={styles.placeholderContainer}>
            <View style={styles.qrFrame}>
              <View style={styles.qrCornerTopLeft} />
              <View style={styles.qrCornerTopRight} />
              <View style={styles.qrCornerBottomLeft} />
              <View style={styles.qrCornerBottomRight} />
              <Text style={styles.qrFrameIcon}>📷</Text>
            </View>
            <Text style={styles.placeholderTitle}>Sẵn sàng quét vé</Text>
            <Text style={styles.placeholderSubtitle}>Kết quả sẽ hiện ở đây</Text>
          </View>
        )}
      </View>

      {/* Action Buttons Area */}
      <View style={styles.actionArea}>
        {/* Big Action Purple Button */}
        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => setCameraModalVisible(true)}
        >
          <Text style={styles.scanButtonText}>⛶   Quét mã QR</Text>
        </TouchableOpacity>

        {/* Secondary Manual Input Trigger Button */}
        <TouchableOpacity
          style={styles.manualTriggerBtn}
          onPress={() => setManualInputVisible(true)}
        >
          <Text style={styles.manualTriggerBtnText}>⌨️   Nhập thủ công (Vé / Khách)</Text>
        </TouchableOpacity>
      </View>

      {/* Camera Scanning Modal */}
      <Modal
        visible={cameraModalVisible}
        animationType="slide"
        onRequestClose={() => setCameraModalVisible(false)}
      >
        <View style={styles.cameraContainer}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torch}
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
          >
            <View style={styles.cameraOverlay}>
              {/* Top Controls */}
              <View style={styles.cameraHeader}>
                <TouchableOpacity
                  style={styles.closeCameraBtn}
                  onPress={() => setCameraModalVisible(false)}
                >
                  <Text style={styles.closeCameraText}>✕ Đóng</Text>
                </TouchableOpacity>

                <Text style={styles.cameraHeaderMode}>
                  Soát vé: {mode.toUpperCase()}
                </Text>
              </View>

              {/* Central Target Scanner Area */}
              <View style={styles.cameraTargetContainer}>
                <View style={styles.cameraTargetFrame} />
                <Text style={styles.cameraInstruction}>Đưa mã QR của vé vào giữa khung</Text>
              </View>

              {/* Bottom Controls */}
              <View style={styles.cameraFooter}>
                <TouchableOpacity
                  style={styles.cameraFooterBtn}
                  onPress={() => setTorch(!torch)}
                >
                  <Text style={styles.cameraFooterBtnText}>
                    {torch ? '💡 Tắt Flash' : '🔦 Bật Flash'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cameraFooterBtn}
                  onPress={() => {
                    setCameraModalVisible(false);
                    setManualInputVisible(true);
                  }}
                >
                  <Text style={styles.cameraFooterBtnText}>⌨️ Nhập mã tay</Text>
                </TouchableOpacity>
              </View>
            </View>
          </CameraView>
        </View>
      </Modal>

      {/* Redesigned Tabbed Manual Input Modal */}
      <Modal
        visible={manualInputVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setManualInputVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header Tabs */}
            <View style={styles.modalTabsRow}>
              <TouchableOpacity
                style={[styles.modalTab, activeManualTab === 'ticket' && styles.modalTabActive]}
                onPress={() => setActiveManualTab('ticket')}
              >
                <Text style={[styles.modalTabLabel, activeManualTab === 'ticket' && styles.modalTabLabelActive]}>
                  Vé (Ticket)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalTab, activeManualTab === 'guest' && styles.modalTabActive]}
                onPress={() => setActiveManualTab('guest')}
              >
                <Text style={[styles.modalTabLabel, activeManualTab === 'guest' && styles.modalTabLabelActive]}>
                  Khách (Guest)
                </Text>
              </TouchableOpacity>
            </View>

            {activeManualTab === 'ticket' ? (
              /* Ticket Form */
              <View style={styles.formContainer}>
                <Text style={styles.modalSubtitle}>Dán chuỗi QR Payload hoặc mã vé tại đây:</Text>
                <TextInput
                  style={[styles.modalInput, styles.textArea]}
                  value={manualCode}
                  onChangeText={setManualCode}
                  placeholder='{"ticket_id": "...", "concert_id": "..."} hoặc qr-seed...'
                  placeholderTextColor="#8585a0"
                  multiline
                  numberOfLines={4}
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
                    onPress={handleManualTicketSubmit}
                  >
                    <Text style={styles.modalConfirmBtnText}>Soát Vé</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* Guest Form */
              <View style={styles.formContainer}>
                <Text style={styles.modalSubtitle}>Nhập thông tin khách mời VIP:</Text>
                <TextInput
                  style={styles.modalInput}
                  value={manualGuestId}
                  onChangeText={setManualGuestId}
                  placeholder="Mã Khách mời (Guest ID)"
                  placeholderTextColor="#8585a0"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TextInput
                  style={styles.modalInput}
                  value={manualPhone}
                  onChangeText={setManualPhone}
                  placeholder="Số điện thoại"
                  placeholderTextColor="#8585a0"
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.modalCancelBtn]}
                    onPress={() => {
                      setManualInputVisible(false);
                      setManualGuestId('');
                      setManualPhone('');
                    }}
                  >
                    <Text style={styles.modalCancelBtnText}>Hủy</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalBtn, styles.modalConfirmBtn]}
                    onPress={handleManualGuestSubmit}
                  >
                    <Text style={styles.modalConfirmBtnText}>Check-in</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0b0d',
    padding: 20,
    justifyContent: 'space-between',
    paddingBottom: 24,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0b0d',
  },
  permissionText: {
    fontSize: 16,
    color: '#f7f7f2',
    textAlign: 'center',
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: '#6045e2',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 15,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  statsCard: {
    flex: 1,
    backgroundColor: '#16181d',
    borderWidth: 1,
    borderColor: '#2c2f3a',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  statsValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  statsLabel: {
    fontSize: 12,
    color: '#828599',
    marginTop: 4,
    fontWeight: '600',
  },
  dashboardCard: {
    flex: 1,
    backgroundColor: '#111318',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#2c2f3a',
    borderRadius: 16,
    marginVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  placeholderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrFrame: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  qrFrameIcon: {
    fontSize: 28,
  },
  qrCornerTopLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 14,
    height: 14,
    borderTopWidth: 2.5,
    borderLeftWidth: 2.5,
    borderColor: '#828599',
  },
  qrCornerTopRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 14,
    height: 14,
    borderTopWidth: 2.5,
    borderRightWidth: 2.5,
    borderColor: '#828599',
  },
  qrCornerBottomLeft: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 14,
    height: 14,
    borderBottomWidth: 2.5,
    borderLeftWidth: 2.5,
    borderColor: '#828599',
  },
  qrCornerBottomRight: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderBottomWidth: 2.5,
    borderRightWidth: 2.5,
    borderColor: '#828599',
  },
  placeholderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f7f7f2',
    marginBottom: 6,
  },
  placeholderSubtitle: {
    fontSize: 13,
    color: '#828599',
  },
  resultContainer: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 20,
    alignItems: 'center',
  },
  resultTitleText: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 8,
  },
  resultDescText: {
    fontSize: 14,
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 20,
  },
  actionArea: {
    gap: 10,
  },
  scanButton: {
    backgroundColor: '#6045e2',
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6045e2',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  scanButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  manualTriggerBtn: {
    backgroundColor: '#1c1e24',
    borderWidth: 1,
    borderColor: '#2c2f3a',
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualTriggerBtnText: {
    color: '#aeb7c7',
    fontSize: 14,
    fontWeight: '700',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'space-between',
    padding: 20,
  },
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Platform.OS === 'ios' ? 44 : 20,
  },
  closeCameraBtn: {
    backgroundColor: 'rgba(22, 24, 29, 0.8)',
    borderWidth: 1,
    borderColor: '#2c2f3a',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  closeCameraText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  cameraHeaderMode: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    backgroundColor: '#de2d52',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  cameraTargetContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraTargetFrame: {
    width: 250,
    height: 250,
    borderWidth: 2.5,
    borderColor: '#6045e2',
    borderRadius: 16,
    backgroundColor: 'transparent',
    marginBottom: 16,
  },
  cameraInstruction: {
    color: '#f7f7f2',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  cameraFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 20,
  },
  cameraFooterBtn: {
    backgroundColor: 'rgba(22, 24, 29, 0.8)',
    borderWidth: 1,
    borderColor: '#2c2f3a',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    minWidth: 130,
    alignItems: 'center',
  },
  cameraFooterBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#16181d',
    borderWidth: 1,
    borderColor: '#2c2f3a',
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  modalTabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#2c2f3a',
    paddingBottom: 8,
  },
  modalTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  modalTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#6045e2',
  },
  modalTabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#828599',
  },
  modalTabLabelActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  formContainer: {
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f7f7f2',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#828599',
    lineHeight: 18,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#2c2f3a',
    borderRadius: 8,
    backgroundColor: '#111318',
    color: '#f7f7f2',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
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
    backgroundColor: '#1c1e24',
    borderWidth: 1,
    borderColor: '#2c2f3a',
  },
  modalConfirmBtn: {
    backgroundColor: '#6045e2',
  },
  modalCancelBtnText: {
    color: '#f7f7f2',
    fontWeight: '700',
    fontSize: 14,
  },
  modalConfirmBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
});
