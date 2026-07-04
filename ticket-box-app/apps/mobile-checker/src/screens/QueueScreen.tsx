import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { getDatabase } from '../db/database';
import { getQueueItems } from '../db/queries';
import { executeQueueSync, SyncConfig } from '../services/sync';

type QueueScreenProps = {
  config: SyncConfig;
};

export function QueueScreen({ config }: QueueScreenProps) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    void loadQueue();
  }, []);

  async function loadQueue() {
    try {
      const db = await getDatabase();
      const list = await getQueueItems(db);
      setItems(list);
    } catch (error) {
      console.error('Lỗi tải queue:', error);
    }
  }

  const metrics = React.useMemo(() => {
    const pending = items.filter((i) => i.status === 'pending' || i.status === 'failed' || i.status === 'SUCCESS' || i.status === 'syncing').length;
    const synced = items.filter((i) => i.status === 'synced').length;
    const total = items.length;
    return { pending, synced, total };
  }, [items]);

  async function handleSync() {
    if (metrics.pending === 0) {
      Alert.alert('Thông báo', 'Không có bản ghi nào cần đồng bộ.');
      return;
    }

    setLoading(true);
    try {
      const result = await executeQueueSync(config);
      Alert.alert('Đồng bộ hoàn tất', result.message);
      await loadQueue();
    } catch (error) {
      Alert.alert('Lỗi đồng bộ', error instanceof Error ? error.message : 'Đồng bộ thất bại.');
      await loadQueue();
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer} style={styles.container}>
      {/* Sync Status Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Trạng thái đồng bộ</Text>
          <View style={styles.onlineBadge}>
            <Text style={styles.onlineBadgeText}>📶 Online</Text>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: '#1f9d55' }]}>{metrics.synced}</Text>
            <Text style={styles.statLabel}>Đã sync</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: '#d98b00' }]}>{metrics.pending}</Text>
            <Text style={styles.statLabel}>Chờ sync</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: '#6045e2' }]}>{metrics.total}</Text>
            <Text style={styles.statLabel}>Tổng scan</Text>
          </View>
        </View>

        {/* Sync Button */}
        <TouchableOpacity
          style={[styles.syncBtn, loading && styles.syncBtnDisabled]}
          onPress={handleSync}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.syncBtnText}>☁️   Đồng bộ ngay</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Sync Guide Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>ℹ️   Quy trình offline sync</Text>
        </View>

        {/* Workflow steps */}
        <View style={styles.workflowContainer}>
          <View style={styles.workflowStep}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>1</Text>
            </View>
            <Text style={styles.stepText}>
              Khi offline, scan được lưu vào SQLite local
            </Text>
          </View>

          <View style={styles.workflowStep}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>2</Text>
            </View>
            <Text style={styles.stepText}>
              Khi có mạng, tạo batch token idempotent
            </Text>
          </View>

          <View style={styles.workflowStep}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>3</Text>
            </View>
            <Text style={styles.stepText}>
              Server validate từng item: zone, gate, conflict
            </Text>
          </View>

          <View style={styles.workflowStep}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>4</Text>
            </View>
            <Text style={styles.stepText}>
              Kết quả trả về: accepted / conflict count
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0b0d',
  },
  scrollContainer: {
    padding: 20,
    gap: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#16181d',
    borderWidth: 1,
    borderColor: '#2c2f3a',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  onlineBadge: {
    backgroundColor: '#0f2e22',
    borderWidth: 1,
    borderColor: '#1f9d55',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  onlineBadgeText: {
    color: '#1f9d55',
    fontSize: 11,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#2c2f3a',
    borderRadius: 12,
    backgroundColor: '#111318',
    paddingVertical: 16,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 12,
    color: '#828599',
    marginTop: 4,
    fontWeight: '600',
  },
  syncBtn: {
    backgroundColor: '#1c1e24',
    borderWidth: 1,
    borderColor: '#2c2f3a',
    borderRadius: 10,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  syncBtnDisabled: {
    opacity: 0.6,
  },
  syncBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  workflowContainer: {
    gap: 16,
  },
  workflowStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#35258c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    color: '#a59eff',
    fontSize: 13,
    fontWeight: '800',
  },
  stepText: {
    flex: 1,
    color: '#aeb7c7',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
});
