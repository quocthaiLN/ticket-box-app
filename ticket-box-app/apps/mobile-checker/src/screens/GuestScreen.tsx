import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { getDatabase } from '../db/database';
import { searchGuestsOffline, checkInGuestOffline } from '../db/queries';

type GuestScreenProps = {
  config: {
    apiBaseUrl: string;
    token: string;
    concertId: string;
    gateId: string;
    deviceId: string;
  };
  mode: 'online' | 'offline';
};

type Guest = {
  guest_id: string;
  concert_id: string;
  zone_id: string;
  full_name: string;
  phone_masked: string;
  status: string; // 'INVITED' | 'CHECKED_IN'
};

export function GuestScreen({ config, mode }: GuestScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkingGuestId, setCheckingGuestId] = useState<string | null>(null);

  const fetchGuests = useCallback(async (query: string) => {
    if (!config.concertId) return;

    setLoading(true);
    try {
      if (mode === 'offline') {
        const db = await getDatabase();
        const list = await searchGuestsOffline(db, query);
        // Map local db keys to match state keys
        const mappedList: Guest[] = list.map((g: any) => ({
          guest_id: g.guest_id,
          concert_id: g.concert_id,
          zone_id: g.zone_id,
          full_name: g.full_name,
          phone_masked: g.phone_masked,
          status: g.status_snapshot,
        }));
        setGuests(mappedList);
      } else {
        const baseUrl = config.apiBaseUrl.trim();
        const params = new URLSearchParams({
          concert_id: config.concertId,
          gate_id: config.gateId,
          q: query,
          limit: '50',
        });
        const response = await fetch(`${baseUrl}/check-in/guests/search?${params}`, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${config.token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Lỗi tìm kiếm: ${response.status}`);
        }

        const json = await response.json();
        setGuests(json.data || []);
      }
    } catch (error) {
      console.error('Lỗi tìm kiếm khách mời:', error);
      Alert.alert('Lỗi', 'Không thể tải danh sách khách mời.');
    } finally {
      setLoading(false);
    }
  }, [config, mode]);

  // Handle Search Input Change with Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchGuests(searchQuery);
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery, fetchGuests]);

  async function handleCheckIn(guest: Guest) {
    if (guest.status === 'CHECKED_IN') {
      Alert.alert('Cảnh báo', 'Khách mời này đã soát vé vào cổng rồi.');
      return;
    }

    setCheckingGuestId(guest.guest_id);
    try {
      if (mode === 'offline') {
        const db = await getDatabase();
        await checkInGuestOffline(db, guest.guest_id, config.concertId, config.gateId);
        
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Thành công', `Đã check-in offline cho khách mời: ${guest.full_name}`);
        
        // Update list status locally
        setGuests((prev) =>
          prev.map((g) =>
            g.guest_id === guest.guest_id ? { ...g, status: 'CHECKED_IN' } : g
          )
        );
      } else {
        const baseUrl = config.apiBaseUrl.trim();
        const response = await fetch(`${baseUrl}/check-in/guests/scans`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.token}`,
          },
          body: JSON.stringify({
            concert_id: config.concertId,
            device_id: config.deviceId,
            gate_id: config.gateId,
            guest_id: guest.guest_id,
            scanned_at: new Date().toISOString(),
          }),
        });

        const json = await response.json();
        if (!response.ok || json.data.result !== 'SUCCESS') {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          throw new Error(json.data.reason || `Lỗi check-in: ${response.status}`);
        }

        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Thành công', `Đã check-in thành công cho: ${guest.full_name}`);

        setGuests((prev) =>
          prev.map((g) =>
            g.guest_id === guest.guest_id ? { ...g, status: 'CHECKED_IN' } : g
          )
        );
      }
    } catch (error) {
      Alert.alert('Thất bại', error instanceof Error ? error.message : 'Lỗi soát vé khách mời.');
    } finally {
      setCheckingGuestId(null);
    }
  }

  function getZoneLabel(zoneId: string) {
    if (!zoneId) return 'N/A';
    if (zoneId.includes('001')) return 'VVIP';
    if (zoneId.includes('002') || zoneId.includes('201')) return 'VIP';
    return 'GA';
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Danh sách Khách Mời</Text>
      <Text style={styles.subtitle}>
        Chế độ soát: {mode === 'online' ? '🟢 ONLINE' : '🔴 OFFLINE'}
      </Text>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Nhập tên hoặc số điện thoại..."
          placeholderTextColor="#8585a0"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity style={styles.clearBtn} onPress={() => setSearchQuery('')}>
            <Text style={styles.clearBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Guest List */}
      {loading && guests.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator color="#2f80ed" size="large" />
        </View>
      ) : (
        <FlatList
          data={guests}
          keyExtractor={(item) => item.guest_id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardInfo}>
                <Text style={styles.guestName}>{item.full_name}</Text>
                <Text style={styles.guestPhone}>📞 {item.phone_masked}</Text>
                <View style={styles.badgeRow}>
                  <View style={[styles.badge, styles.zoneBadge]}>
                    <Text style={styles.zoneBadgeText}>{getZoneLabel(item.zone_id)}</Text>
                  </View>
                  <View
                    style={[
                      styles.badge,
                      item.status === 'CHECKED_IN'
                        ? styles.checkedBadge
                        : styles.invitedBadge,
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        item.status === 'CHECKED_IN'
                          ? styles.checkedBadgeText
                          : styles.invitedBadgeText,
                      ]}
                    >
                      {item.status === 'CHECKED_IN' ? 'Đã Soát' : 'Chưa Soát'}
                    </Text>
                  </View>
                </View>
              </View>

              {item.status !== 'CHECKED_IN' && (
                <TouchableOpacity
                  style={[
                    styles.checkInBtn,
                    checkingGuestId === item.guest_id && styles.checkInBtnDisabled,
                  ]}
                  onPress={() => handleCheckIn(item)}
                  disabled={checkingGuestId !== null}
                >
                  {checkingGuestId === item.guest_id ? (
                    <ActivityIndicator color="#0d0d15" size="small" />
                  ) : (
                    <Text style={styles.checkInBtnText}>Vào cổng</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {searchQuery.length > 0
                  ? 'Không tìm thấy khách mời nào phù hợp.'
                  : 'Gõ từ khóa để tìm kiếm khách mời.'}
              </Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          refreshing={loading}
          onRefresh={() => fetchGuests(searchQuery)}
        />
      )}
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
  },
  subtitle: {
    fontSize: 13,
    color: '#aeb7c7',
    marginTop: 4,
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#343a46',
    borderRadius: 8,
    backgroundColor: '#17191f',
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    color: '#f7f7f2',
    paddingVertical: 10,
    fontSize: 15,
  },
  clearBtn: {
    padding: 8,
  },
  clearBtnText: {
    color: '#8585a0',
    fontSize: 14,
    fontWeight: '700',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 24,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#303642',
    borderRadius: 8,
    backgroundColor: '#111318',
    padding: 16,
    marginBottom: 10,
  },
  cardInfo: {
    flex: 1,
    gap: 4,
  },
  guestName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f7f7f2',
  },
  guestPhone: {
    fontSize: 13,
    color: '#aeb7c7',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  badge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  zoneBadge: {
    backgroundColor: '#242a34',
    borderWidth: 1,
    borderColor: '#3c4350',
  },
  zoneBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#8ed1fc',
  },
  invitedBadge: {
    backgroundColor: '#342310',
  },
  invitedBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffd026',
  },
  checkedBadge: {
    backgroundColor: '#0f2e22',
  },
  checkedBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1f9d55',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  checkInBtn: {
    backgroundColor: '#2f80ed',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginLeft: 12,
  },
  checkInBtnDisabled: {
    opacity: 0.6,
  },
  checkInBtnText: {
    color: '#0d0d15',
    fontWeight: '800',
    fontSize: 13,
  },
  emptyContainer: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#3c4350',
    borderRadius: 8,
    padding: 32,
    alignItems: 'center',
    marginTop: 16,
  },
  emptyText: {
    color: '#aeb7c7',
    fontSize: 14,
    textAlign: 'center',
  },
});
