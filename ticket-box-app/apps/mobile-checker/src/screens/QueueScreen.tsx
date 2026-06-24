import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { getDatabase } from '../db/database';
import { getQueueItems, clearQueue, clearSyncedItems } from '../db/queries';
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
    const pending = items.filter((i) => i.status === 'pending' || i.status === 'failed' || i.status === 'SUCCESS').length;
    const synced = items.filter((i) => i.status === 'synced').length;
    const conflicts = items.filter((i) => i.status === 'conflict').length;
    return { pending, synced, conflicts };
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

  async function handleClearSynced() {
    Alert.alert(
      'Xác nhận',
      'Bạn có muốn xóa toàn bộ các vé đã đồng bộ thành công khỏi danh sách?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            const db = await getDatabase();
            await clearSyncedItems(db);
            await loadQueue();
          },
        },
      ]
    );
  }

  async function handleClearAll() {
    Alert.alert(
      'Cảnh báo',
      'Hành động này sẽ XÓA TOÀN BỘ lịch sử quét trong hàng đợi (kể cả chưa đồng bộ). Bạn có chắc chắn?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa Sạch',
          style: 'destructive',
          onPress: async () => {
            const db = await getDatabase();
            await clearQueue(db);
            await loadQueue();
          },
        },
      ]
    );
  }

  function getStatusLabel(status: string) {
    if (status === 'SUCCESS' || status === 'pending') return 'Chờ Sync';
    if (status === 'synced') return 'Đồng bộ';
    if (status === 'conflict') return 'Trùng/Lỗi Cổng';
    return 'Thất bại';
  }

  function getStatusColor(status: string) {
    if (status === 'SUCCESS' || status === 'pending') return '#fef0c7';
    if (status === 'synced') return '#d1fadf';
    if (status === 'conflict') return '#fdecc8';
    return '#fee4e2';
  }

  function getStatusTextColor(status: string) {
    if (status === 'SUCCESS' || status === 'pending') return '#93370d';
    if (status === 'synced') return '#067647';
    if (status === 'conflict') return '#92400e';
    return '#b42318';
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hàng đợi Offline</Text>
      
      {/* Metrics Banner */}
      <View style={styles.metricsContainer}>
        <View style={styles.metricBox}>
          <Text style={styles.metricValue}>{metrics.pending}</Text>
          <Text style={styles.metricLabel}>Chờ sync</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={[styles.metricValue, { color: '#2dbe6c' }]}>{metrics.synced}</Text>
          <Text style={styles.metricLabel}>Đã sync</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={[styles.metricValue, { color: '#f5c842' }]}>{metrics.conflicts}</Text>
          <Text style={styles.metricLabel}>Xung đột</Text>
        </View>
      </View>

      {/* Action buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.btn, styles.btnPrimary, loading && styles.btnDisabled]}
          onPress={handleSync}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#0d0d15" size="small" />
          ) : (
            <Text style={styles.btnTextPrimary}>Đồng bộ ngay</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={handleClearSynced} disabled={loading}>
          <Text style={styles.btnText}>Dọn sạch</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={handleClearAll} disabled={loading}>
          <Text style={[styles.btnText, { color: '#e8315b' }]}>Xóa hết</Text>
        </TouchableOpacity>
      </View>

      {/* Queue List */}
      <FlatList
        data={items}
        keyExtractor={(item) => item.client_item_id}
        renderItem={({ item }) => (
          <View style={styles.itemCard}>
            <View style={styles.itemRow}>
              <View>
                <Text style={styles.itemType}>{item.type}</Text>
                <Text style={styles.itemToken} numberOfLines={1} ellipsizeMode="middle">
                  {item.qr_token || `Guest: ${item.guest_id || item.phone}`}
                </Text>
                <Text style={styles.itemTime}>{new Date(item.scanned_at).toLocaleString('vi-VN')}</Text>
              </View>
              <View
                style={[
                  styles.statusChip,
                  { backgroundColor: getStatusColor(item.status) },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    { color: getStatusTextColor(item.status) },
                  ]}
                >
                  {getStatusLabel(item.status)}
                </Text>
              </View>
            </View>
            {item.message && <Text style={styles.itemMsg}>{item.message}</Text>}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Hàng đợi rỗng. Không có lượt quét offline.</Text>
          </View>
        }
        contentContainerStyle={styles.listContainer}
        refreshing={loading}
        onRefresh={loadQueue}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#101114',
    padding: 24,
    paddingBottom: 0,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#f7f7f2',
    marginBottom: 16,
  },
  metricsContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#343a46',
    borderRadius: 8,
    backgroundColor: '#191b20',
    marginBottom: 16,
    paddingVertical: 12,
  },
  metricBox: {
    flex: 1,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f7f7f2',
  },
  metricLabel: {
    fontSize: 12,
    color: '#aeb7c7',
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  btn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3c4350',
    backgroundColor: '#22252d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    flex: 2,
    backgroundColor: '#2f80ed',
    borderColor: '#2f80ed',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnTextPrimary: {
    color: '#0d0d15',
    fontWeight: '800',
    fontSize: 14,
  },
  btnText: {
    color: '#f7f7f2',
    fontWeight: '800',
    fontSize: 13,
  },
  listContainer: {
    paddingBottom: 24,
  },
  itemCard: {
    borderWidth: 1,
    borderColor: '#303642',
    borderRadius: 8,
    backgroundColor: '#111318',
    padding: 12,
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemType: {
    fontSize: 12,
    fontWeight: '800',
    color: '#8ed1fc',
    textTransform: 'uppercase',
  },
  itemToken: {
    fontSize: 14,
    color: '#f7f7f2',
    marginTop: 4,
    maxWidth: 180,
  },
  itemTime: {
    fontSize: 11,
    color: '#aeb7c7',
    marginTop: 4,
  },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  itemMsg: {
    fontSize: 12,
    color: '#aeb7c7',
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#242a34',
    paddingTop: 8,
  },
  emptyContainer: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#3c4350',
    borderRadius: 8,
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: '#aeb7c7',
    fontSize: 14,
    textAlign: 'center',
  },
});
