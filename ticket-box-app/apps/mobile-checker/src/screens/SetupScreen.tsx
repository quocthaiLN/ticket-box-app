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
  };
  onConfigChange: (newConfig: any) => void;
  forceOffline: boolean;
  onForceOfflineChange: (val: boolean) => void;
};

export function SetupScreen({
  config,
  onConfigChange,
  forceOffline,
  onForceOfflineChange,
}: SetupScreenProps) {
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [stats, setStats] = useState<{ tickets: number; guests: number } | null>(null);

  // Load existing database stats on mount
  useEffect(() => {
    async function loadStats() {
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
      } catch (error) {
        console.error('Lỗi tải stats cục bộ:', error);
      }
    }
    void loadStats();
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

      Alert.alert('Thành công', `Đã tải ${data.tickets.length} vé và ${data.guests.length} khách mời offline.`);
    } catch (error) {
      Alert.alert('Lỗi preload', error instanceof Error ? error.message : 'Tải dữ liệu thất bại.');
    } finally {
      setLoading(false);
    }
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

      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.label}>API Base URL</Text>
          <TextInput
            style={styles.input}
            value={config.apiBaseUrl}
            onChangeText={(text) => updateField('apiBaseUrl', text)}
            placeholder={DEFAULT_API_BASE_URL}
            placeholderTextColor="#8585a0"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Bearer Token</Text>
          <TextInput
            style={styles.input}
            value={config.token}
            onChangeText={(text) => updateField('token', text)}
            placeholder="Nhập mã đăng nhập Checker"
            placeholderTextColor="#8585a0"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Concert ID</Text>
          <TextInput
            style={styles.input}
            value={config.concertId}
            onChangeText={(text) => updateField('concertId', text)}
            placeholder="Nhập ID concert"
            placeholderTextColor="#8585a0"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Gate ID</Text>
          <TextInput
            style={styles.input}
            value={config.gateId}
            onChangeText={(text) => updateField('gateId', text)}
            placeholder="Nhập ID cổng soát vé"
            placeholderTextColor="#8585a0"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Device ID</Text>
          <TextInput
            style={styles.input}
            value={config.deviceId}
            onChangeText={(text) => updateField('deviceId', text)}
            placeholder="Nhập ID thiết bị quét"
            placeholderTextColor="#8585a0"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Force Offline Control */}
        <View style={styles.switchField}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.label}>Bắt buộc chạy Ngoại tuyến (Force Offline)</Text>
            <Text style={styles.switchHelp}>
              Bỏ qua kết nối mạng, quét và soát vé trực tiếp bằng SQLite cục bộ.
            </Text>
          </View>
          <Switch
            value={forceOffline}
            onValueChange={onForceOfflineChange}
            trackColor={{ false: '#343a46', true: '#cca20c' }}
            thumbColor={forceOffline ? '#ffd026' : '#aeb7c7'}
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
              <ActivityIndicator color="#0d0d15" size="small" />
            ) : (
              <Text style={styles.buttonText}>Tải dữ liệu Preload</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {stats && (
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>Dữ liệu Offline đã tải</Text>
          <View style={styles.statsRow}>
            <Text style={styles.statsText}>Số lượng vé:</Text>
            <Text style={styles.statsValue}>{stats.tickets} vé</Text>
          </View>
          <View style={styles.statsRow}>
            <Text style={styles.statsText}>Khách mời VIP:</Text>
            <Text style={styles.statsValue}>{stats.guests} người</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: '#101114',
    minHeight: '100%',
  },
  kicker: {
    color: '#8ed1fc',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#f7f7f2',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#aeb7c7',
    marginBottom: 24,
  },
  form: {
    gap: 16,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#aeb7c7',
  },
  input: {
    borderWidth: 1,
    borderColor: '#343a46',
    borderRadius: 8,
    backgroundColor: '#17191f',
    color: '#f7f7f2',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  switchField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderWidth: 1,
    borderColor: '#343a46',
    borderRadius: 8,
    backgroundColor: '#17191f',
    marginTop: 8,
    marginBottom: 8,
  },
  switchHelp: {
    fontSize: 11,
    color: '#8585a0',
    marginTop: 4,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  button: {
    flex: 1,
    backgroundColor: '#2f80ed',
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testButton: {
    flex: 1,
    backgroundColor: '#22252d',
    borderWidth: 1,
    borderColor: '#3c4350',
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#0d0d15',
    fontSize: 15,
    fontWeight: '800',
  },
  testButtonText: {
    color: '#f7f7f2',
    fontSize: 15,
    fontWeight: '800',
  },
  statsCard: {
    marginTop: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#343a46',
    borderRadius: 8,
    backgroundColor: '#191b20',
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f7f7f2',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statsText: {
    fontSize: 14,
    color: '#aeb7c7',
  },
  statsValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2f80ed',
  },
});
