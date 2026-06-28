import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { getDatabase } from '../db/database';
import { getQueueItems } from '../db/queries';

type HistoryFilter = 'ALL' | 'SUCCESS' | 'WRONG_GATE' | 'CONFLICT';

type HistoryScreenProps = {
  currentScreen: string;
};

export function HistoryScreen({ currentScreen }: HistoryScreenProps) {
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<HistoryFilter>('ALL');
  const [items, setItems] = useState<any[]>([]);
  const [counts, setCounts] = useState({
    all: 0,
    success: 0,
    wrongGate: 0,
    conflict: 0,
  });

  // Reload mỗi khi user navigate sang tab Lịch sử
  useEffect(() => {
    if (currentScreen === 'history') {
      void loadHistory();
    }
  }, [currentScreen]);

  async function loadHistory() {
    setLoading(true);
    try {
      const db = await getDatabase();
      const list = await getQueueItems(db);
      setItems(list);

      // Compute counts
      const allCount = list.length;
      const successCount = list.filter((i) => i.status === 'SUCCESS' || i.status === 'synced').length;
      const wrongGateCount = list.filter((i) => i.status === 'WRONG_GATE').length;
      const conflictCount = list.filter(
        (i) => i.status === 'conflict' || i.status === 'failed' || i.status === 'ALREADY_CHECKED_IN' || i.status === 'INVALID_TICKET' || i.status === 'ERROR'
      ).length;

      setCounts({
        all: allCount,
        success: successCount,
        wrongGate: wrongGateCount,
        conflict: conflictCount,
      });
    } catch (error) {
      console.error('Lỗi tải lịch sử:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredItems = React.useMemo(() => {
    if (activeFilter === 'ALL') return items;
    if (activeFilter === 'SUCCESS') {
      return items.filter((i) => i.status === 'SUCCESS' || i.status === 'synced');
    }
    if (activeFilter === 'WRONG_GATE') {
      return items.filter((i) => i.status === 'WRONG_GATE');
    }
    if (activeFilter === 'CONFLICT') {
      return items.filter(
        (i) => i.status === 'conflict' || i.status === 'failed' || i.status === 'ALREADY_CHECKED_IN' || i.status === 'INVALID_TICKET' || i.status === 'ERROR'
      );
    }
    return items;
  }, [items, activeFilter]);

  function getStatusStyle(status: string) {
    if (status === 'SUCCESS' || status === 'synced') {
      return {
        icon: '✓',
        iconColor: '#1f9d55',
        badgeBg: '#0f2e22',
        badgeText: '#1f9d55',
        label: 'Thành công',
      };
    }
    if (status === 'WRONG_GATE') {
      return {
        icon: '⚠️',
        iconColor: '#d98b00',
        badgeBg: '#342310',
        badgeText: '#d98b00',
        label: 'Sai cổng',
      };
    }
    return {
      icon: '🚫',
      iconColor: '#d64545',
      badgeBg: '#331819',
      badgeText: '#d64545',
      label: 'Trùng / Lỗi',
    };
  }

  return (
    <View style={styles.container}>
      {/* Scrollable Filter Capsules */}
      <View style={{ height: 48, marginBottom: 12 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          <TouchableOpacity
            style={[styles.filterCapsule, activeFilter === 'ALL' && styles.filterCapsuleActive]}
            onPress={() => setActiveFilter('ALL')}
          >
            <Text style={[styles.filterText, activeFilter === 'ALL' && styles.filterTextActive]}>
              Tất cả ({counts.all})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterCapsule, activeFilter === 'SUCCESS' && styles.filterCapsuleActive]}
            onPress={() => setActiveFilter('SUCCESS')}
          >
            <Text style={[styles.filterText, activeFilter === 'SUCCESS' && styles.filterTextActive]}>
              ✓ Thành công ({counts.success})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterCapsule, activeFilter === 'WRONG_GATE' && styles.filterCapsuleActive]}
            onPress={() => setActiveFilter('WRONG_GATE')}
          >
            <Text style={[styles.filterText, activeFilter === 'WRONG_GATE' && styles.filterTextActive]}>
              ⚠️ Sai cổng ({counts.wrongGate})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterCapsule, activeFilter === 'CONFLICT' && styles.filterCapsuleActive]}
            onPress={() => setActiveFilter('CONFLICT')}
          >
            <Text style={[styles.filterText, activeFilter === 'CONFLICT' && styles.filterTextActive]}>
              🚫 Trùng ({counts.conflict})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* History List */}
      {loading && items.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator color="#6045e2" size="large" />
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.client_item_id}
          renderItem={({ item }) => {
            const statusConfig = getStatusStyle(item.status);
            return (
              <View style={styles.itemCard}>
                <View style={styles.itemLeft}>
                  <View style={styles.statusIconContainer}>
                    <Text style={[styles.statusIcon, { color: statusConfig.iconColor }]}>
                      {statusConfig.icon}
                    </Text>
                  </View>
                  <View style={styles.itemDetails}>
                    <Text style={styles.itemTitle} numberOfLines={1} ellipsizeMode="middle">
                      {item.qr_token || (item.guest_id ? `Guest ID: ${item.guest_id.slice(0, 8)}...` : item.phone || 'Vé Offline')}
                    </Text>
                    <Text style={styles.itemTime}>
                      {new Date(item.scanned_at).toLocaleTimeString('vi-VN')} - {new Date(item.scanned_at).toLocaleDateString('vi-VN')}
                    </Text>
                  </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusConfig.badgeBg }]}>
                  <Text style={[styles.statusBadgeText, { color: statusConfig.badgeText }]}>
                    {statusConfig.label}
                  </Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyClock}>🕒</Text>
              <Text style={styles.emptyText}>Chưa có lịch sử quét</Text>
            </View>
          }
          contentContainerStyle={styles.listContainer}
          onRefresh={loadHistory}
          refreshing={loading}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0b0d',
    padding: 16,
    paddingTop: 12,
  },
  filterScroll: {
    gap: 8,
    alignItems: 'center',
    paddingRight: 16,
  },
  filterCapsule: {
    backgroundColor: '#16181d',
    borderWidth: 1,
    borderColor: '#2c2f3a',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    height: 36,
    justifyContent: 'center',
  },
  filterCapsuleActive: {
    backgroundColor: '#6045e2',
    borderColor: '#6045e2',
  },
  filterText: {
    color: '#828599',
    fontSize: 13,
    fontWeight: '700',
  },
  filterTextActive: {
    color: '#ffffff',
  },
  listContainer: {
    paddingBottom: 24,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#16181d',
    borderWidth: 1,
    borderColor: '#2c2f3a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1a1d24',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  statusIcon: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  itemDetails: {
    flex: 1,
    paddingRight: 8,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f7f7f2',
  },
  itemTime: {
    fontSize: 11,
    color: '#828599',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
  },
  emptyClock: {
    fontSize: 48,
    color: '#343a46',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    color: '#828599',
    fontWeight: '600',
  },
});
