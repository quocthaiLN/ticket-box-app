import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { getDatabase } from '../db/database';
import { savePreloadData } from '../db/queries';
import { fetchPreload, DEFAULT_API_BASE_URL } from '../services/api';

type SetupScreenProps = {
  config: {
    apiBaseUrl: string;
    token: string;
    concertId: string;
    gateId: string;
    deviceId: string;
    batchToken: string;
    concertTitle: string;
    gateName: string;
    allowedZones: Array<{ id: string; code: string; name: string }>;
  };
  onConfigChange: (newConfig: any) => void;
  forceOffline: boolean;
  onForceOfflineChange: (val: boolean) => void;
  checkerInfo: { email: string; fullName: string } | null;
  onLogout: () => void;
  onProceed: () => void;
};

export function SetupScreen({
  config,
  onConfigChange,
  forceOffline,
  onForceOfflineChange,
  checkerInfo,
  onLogout,
  onProceed,
}: SetupScreenProps) {
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [stats, setStats] = useState<{ tickets: number; guests: number } | null>(null);

  // Load existing database stats and allowed zones on mount
  useEffect(() => {
    async function loadStatsAndZones() {
      try {
        const db = await getDatabase();
        const ticketsResult = await db.getFirstAsync<{ count: number }>('SELECT count(*) as count FROM tickets');
        const guestsResult = await db.getFirstAsync<{ count: number }>('SELECT count(*) as count FROM guests');
        const ticketCount = ticketsResult?.count ?? 0;
        const guestCount = guestsResult?.count ?? 0;
        if (ticketCount > 0 || guestCount > 0) {
          setStats({
            tickets: ticketCount,
            guests: guestCount,
          });
        }

        // Tự động nạp khu vực hợp lệ từ SQLite lên header nếu làm việc ngoại tuyến
        const localZones = await db.getAllAsync<{ id: string; code: string; name: string }>(
          'SELECT id, code, name FROM allowed_seat_zones'
        );
        if (localZones && localZones.length > 0) {
          onConfigChange((prev: any) => ({
            ...prev,
            allowedZones: localZones,
          }));
        }
      } catch (error) {
        console.error('Lỗi tải stats cục bộ:', error);
      }
    }
    void loadStatsAndZones();
  }, []);

  function updateField(field: string, value: string) {
    onConfigChange({ ...config, [field]: value });
  }

  async function handleTestConnection() {
    setTestingConnection(true);
    const baseUrl = config.apiBaseUrl.trim() || DEFAULT_API_BASE_URL;
    try {
      // 1. Check health
      const response = await fetch(`${baseUrl}/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Server báo lỗi: ${response.status}`);
      }

      // 2. Check token if provided
      if (config.token) {
        const checkTokenRes = await fetch(
          `${baseUrl}/check-in/preload?concert_id=test&gate_id=test&device_id=test&limit=1`,
          {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${config.token}`,
            },
          }
        );
        
        if (checkTokenRes.status === 401) {
          throw new Error('Token không hợp lệ hoặc hết hạn (401 Unauthorized).');
        }
      }

      Alert.alert('Kết nối thành công', 'Đã kết nối tới API Server và kiểm tra cấu hình thành công!');
    } catch (error) {
      Alert.alert(
        'Lỗi kết nối',
        error instanceof Error ? error.message : 'Không thể kết nối tới máy chủ.'
      );
    } finally {
      setTestingConnection(false);
    }
  }

  async function handleLoadPreload() {
    if (!config.concertId || !config.gateId || !config.deviceId) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ Concert ID, Gate ID và Device ID.');
      return;
    }

    setLoading(true);
    setStats(null);
    try {
      const data = await fetchPreload(
        config.apiBaseUrl || DEFAULT_API_BASE_URL,
        config.token,
        config.concertId,
        config.gateId,
        config.deviceId
      );

      const db = await getDatabase();
      await savePreloadData(
        db,
        data.allowed_seat_zones,
        data.tickets,
        data.guests
      );

      setStats({
        tickets: data.tickets.length,
        guests: data.guests.length,
      });

      // Cập nhật concert metadata cho parent state để hiển thị header
      onConfigChange({
        ...config,
        concertTitle: data.concert.title,
        gateName: data.gate.name,
        allowedZones: data.allowed_seat_zones,
      });

      Alert.alert('Thành công', `Đã tải ${data.tickets.length} vé và ${data.guests.length} khách mời offline.`);
    } catch (error) {
      Alert.alert('Lỗi preload', error instanceof Error ? error.message : 'Tải dữ liệu thất bại.');
    } finally {
      setLoading(false);
    }
  }

  async function handleProceed() {
    if (!config.concertId || !config.gateId || !config.deviceId) {
      Alert.alert('Cảnh báo', 'Vui lòng thiết lập Concert ID, Gate ID và Device ID trước khi bắt đầu soát vé.');
      return;
    }

    // Nếu online và chưa có metadata, tự động fetch để đồng bộ thông tin header
    if (!forceOffline && (!config.concertTitle || !config.gateName || !config.allowedZones.length)) {
      setLoading(true);
      try {
        const data = await fetchPreload(
          config.apiBaseUrl || DEFAULT_API_BASE_URL,
          config.token,
          config.concertId,
          config.gateId,
          config.deviceId
        );
        onConfigChange({
          ...config,
          concertTitle: data.concert.title,
          gateName: data.gate.name,
          allowedZones: data.allowed_seat_zones,
        });
      } catch (error) {
        console.warn('Lỗi lấy metadata trực tuyến:', error);
      } finally {
        setLoading(false);
      }
    }

    onProceed();
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.kicker}>
        TicketBox Mobile Checker
      </Text>
      <Text style={styles.title}>Thiết lập cổng</Text>
      <Text style={styles.subtitle}>
        Nhập cấu hình thiết bị và tải trước dữ liệu soát vé offline.
      </Text>

      {checkerInfo && (
        <View style={styles.checkerCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {checkerInfo.fullName.slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View style={styles.checkerInfoCol}>
            <Text style={styles.checkerLabel}>NHÂN VIÊN SOÁT VÉ</Text>
            <Text style={styles.checkerName}>{checkerInfo.fullName}</Text>
            <Text style={styles.checkerEmail}>{checkerInfo.email}</Text>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
            <Text style={styles.logoutButtonText}>Đăng xuất</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.formCard}>
        <View style={styles.field}>
          <Text style={styles.label}>API Base URL</Text>
          <View style={styles.inputWrapper}>
            <Text style={styles.inputIcon}>🌐</Text>
            <TextInput
              style={styles.input}
              value={config.apiBaseUrl}
              onChangeText={(text) => updateField('apiBaseUrl', text)}
              placeholder={DEFAULT_API_BASE_URL}
              placeholderTextColor="#5b5d6e"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Bearer Token</Text>
          <View style={[styles.inputWrapper, styles.inputWrapperDisabled]}>
            <Text style={styles.inputIcon}>🔑</Text>
            <TextInput
              style={[styles.input, styles.inputDisabledText]}
              value={config.token ? '••••••••••••••••' : ''}
              editable={false}
              placeholder="Chưa đăng nhập"
              placeholderTextColor="#5b5d6e"
              secureTextEntry
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Concert ID</Text>
          <View style={styles.inputWrapper}>
            <Text style={styles.inputIcon}>🎫</Text>
            <TextInput
              style={styles.input}
              value={config.concertId}
              onChangeText={(text) => updateField('concertId', text)}
              placeholder="Nhập ID concert"
              placeholderTextColor="#5b5d6e"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Gate ID</Text>
          <View style={styles.inputWrapper}>
            <Text style={styles.inputIcon}>📍</Text>
            <TextInput
              style={styles.input}
              value={config.gateId}
              onChangeText={(text) => updateField('gateId', text)}
              placeholder="Nhập ID cổng soát vé"
              placeholderTextColor="#5b5d6e"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Device ID</Text>
          <View style={styles.inputWrapper}>
            <Text style={styles.inputIcon}>📱</Text>
            <TextInput
              style={styles.input}
              value={config.deviceId}
              onChangeText={(text) => updateField('deviceId', text)}
              placeholder="Nhập ID thiết bị quét"
              placeholderTextColor="#5b5d6e"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        {/* Force Offline Control */}
        <View style={styles.switchField}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.switchLabel}>Bắt buộc chạy Ngoại tuyến</Text>
            <Text style={styles.switchHelp}>
              Soát vé ngoại tuyến không kết nối máy chủ
            </Text>
          </View>
          <Switch
            value={forceOffline}
            onValueChange={onForceOfflineChange}
            trackColor={{ false: '#2c2f3a', true: '#cca20c' }}
            thumbColor={forceOffline ? '#ffd026' : '#828599'}
          />
        </View>

        {/* Buttons Group */}
        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={[styles.testButton, testingConnection && styles.buttonDisabled]}
            onPress={handleTestConnection}
            disabled={testingConnection || loading}
          >
            {testingConnection ? (
              <ActivityIndicator color="#f7f7f2" size="small" />
            ) : (
              <Text style={styles.testButtonText}>Kiểm tra kết nối</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLoadPreload}
            disabled={loading || testingConnection}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.buttonText}>Preload Offline</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Proceed to check-in screen button */}
        <TouchableOpacity
          style={styles.proceedButton}
          onPress={handleProceed}
        >
          <Text style={styles.proceedButtonText}>⚡ Bắt đầu soát vé</Text>
        </TouchableOpacity>
      </View>

      {stats && (
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>📊 DỮ LIỆU OFFLINE ĐÃ TẢI</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statsWidget}>
              <Text style={styles.statsWidgetIcon}>🎫</Text>
              <View>
                <Text style={styles.statsWidgetValue}>{stats.tickets}</Text>
                <Text style={styles.statsWidgetLabel}>Vé lưu trữ</Text>
              </View>
            </View>

            <View style={styles.statsWidget}>
              <Text style={styles.statsWidgetIcon}>👤</Text>
              <View>
                <Text style={styles.statsWidgetValue}>{stats.guests}</Text>
                <Text style={styles.statsWidgetLabel}>Khách VIP</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#0a0b0d', // Match dark dashboard theme
    minHeight: '100%',
  },
  kicker: {
    color: '#828599',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#f7f7f2',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#828599',
    marginBottom: 20,
    lineHeight: 18,
  },
  checkerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16181d',
    borderWidth: 1,
    borderColor: '#2c2f3a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#6045e2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  checkerInfoCol: {
    flex: 1,
    paddingRight: 8,
  },
  checkerLabel: {
    color: '#828599',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 2,
  },
  checkerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f7f7f2',
  },
  checkerEmail: {
    fontSize: 12,
    color: '#828599',
    marginTop: 2,
  },
  logoutButton: {
    backgroundColor: '#2b191a',
    borderWidth: 1,
    borderColor: '#d64545',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutButtonText: {
    color: '#d64545',
    fontSize: 12,
    fontWeight: '700',
  },
  formCard: {
    backgroundColor: '#16181d',
    borderWidth: 1,
    borderColor: '#2c2f3a',
    borderRadius: 16,
    padding: 16,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#828599',
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111318',
    borderWidth: 1,
    borderColor: '#2c2f3a',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
  },
  inputWrapperDisabled: {
    backgroundColor: '#0f1013',
    borderColor: '#1c1e24',
  },
  inputIcon: {
    fontSize: 16,
    color: '#828599',
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#f7f7f2',
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 8,
  },
  inputDisabledText: {
    color: '#5b5d6e',
  },
  switchField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderWidth: 1,
    borderColor: '#2c2f3a',
    borderRadius: 12,
    backgroundColor: '#111318',
    marginTop: 4,
  },
  switchLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f7f7f2',
  },
  switchHelp: {
    fontSize: 11,
    color: '#828599',
    marginTop: 3,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    backgroundColor: '#2f80ed',
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2f80ed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  testButton: {
    flex: 1,
    backgroundColor: '#1c1e24',
    borderWidth: 1,
    borderColor: '#2c2f3a',
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  testButtonText: {
    color: '#f7f7f2',
    fontSize: 14,
    fontWeight: '800',
  },
  proceedButton: {
    backgroundColor: '#6045e2',
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    shadowColor: '#6045e2',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  proceedButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statsCard: {
    marginTop: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2c2f3a',
    borderRadius: 16,
    backgroundColor: '#16181d',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  statsTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#828599',
    letterSpacing: 1,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statsWidget: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111318',
    borderWidth: 1,
    borderColor: '#2c2f3a',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  statsWidgetIcon: {
    fontSize: 22,
  },
  statsWidgetValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2f80ed',
  },
  statsWidgetLabel: {
    fontSize: 11,
    color: '#828599',
    fontWeight: '600',
    marginTop: 2,
  },
});
