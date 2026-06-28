import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import NetInfo from '@react-native-community/netinfo';
import { SetupScreen } from './src/screens/SetupScreen';
import { ScanScreen } from './src/screens/ScanScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { QueueScreen } from './src/screens/QueueScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { executeQueueSync } from './src/services/sync';
import { DEFAULT_API_BASE_URL } from './src/services/api';

type ScreenName = 'setup' | 'scan' | 'history' | 'queue';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checkerInfo, setCheckerInfo] = useState<{ email: string; fullName: string } | null>(null);
  const [currentScreen, setCurrentScreen] = useState<ScreenName>('setup');
  const [isOnline, setIsOnline] = useState(true);
  const [forceOffline, setForceOffline] = useState(false);
  const [config, setConfig] = useState({
    apiBaseUrl: DEFAULT_API_BASE_URL,
    token: '',
    concertId: '',
    gateId: '',
    deviceId: '',
    batchToken: `batch-${Date.now()}`,
    concertTitle: '',
    gateName: '',
    allowedZones: [] as Array<{ id: string; code: string; name: string }>,
  });

  const effectiveMode = (isOnline && !forceOffline) ? 'online' : 'offline';

  // Listen to network changes
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected && !!state.isInternetReachable;
      
      // Auto-trigger sync when transitioning from offline to online (only if not forced offline)
      if (online && !isOnline && !forceOffline && config.token && config.concertId && config.gateId) {
        console.log('Phát hiện mạng online trở lại, tự động chạy đồng bộ...');
        executeQueueSync({
          apiBaseUrl: config.apiBaseUrl,
          token: config.token,
          batchToken: config.batchToken,
          concertId: config.concertId,
          gateId: config.gateId,
          deviceId: config.deviceId,
        })
          .then((res) => {
            if (res.syncedCount > 0) {
              Alert.alert('Đồng bộ chạy ngầm', `Mạng phục hồi: Đã sync ${res.syncedCount} vé lên server.`);
            }
          })
          .catch((err) => {
            console.error('Lỗi sync tự động:', err);
          });
      }
      
      setIsOnline(online);
    });

    return () => unsubscribe();
  }, [isOnline, forceOffline, config]);

  function handleLogout() {
    setConfig({
      apiBaseUrl: DEFAULT_API_BASE_URL,
      token: '',
      concertId: '',
      gateId: '',
      deviceId: '',
      batchToken: `batch-${Date.now()}`,
      concertTitle: '',
      gateName: '',
      allowedZones: [],
    });
    setCheckerInfo(null);
    setIsLoggedIn(false);
  }

  function renderScreen() {
    switch (currentScreen) {
      case 'setup':
        return (
          <SetupScreen
            config={config}
            onConfigChange={setConfig}
            forceOffline={forceOffline}
            onForceOfflineChange={setForceOffline}
            checkerInfo={checkerInfo}
            onLogout={handleLogout}
            onProceed={() => setCurrentScreen('scan')}
          />
        );
      case 'scan':
        return (
          <ScanScreen
            config={config}
            mode={effectiveMode}
          />
        );
      case 'history':
        return (
          <HistoryScreen currentScreen={currentScreen} />
        );
      case 'queue':
        return (
          <QueueScreen
            config={{
              apiBaseUrl: config.apiBaseUrl,
              token: config.token,
              batchToken: config.batchToken,
              concertId: config.concertId,
              gateId: config.gateId,
              deviceId: config.deviceId,
            }}
          />
        );
    }
  }

  // Intercept view with LoginScreen if user is not authenticated
  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <LoginScreen
          onLoginSuccess={(token, user, apiBaseUrl) => {
            setConfig((prev) => ({
              ...prev,
              token,
              apiBaseUrl,
            }));
            setCheckerInfo({
              email: user.email,
              fullName: user.full_name,
            });
            setIsLoggedIn(true);
            setCurrentScreen('setup');
          }}
        />
      </SafeAreaView>
    );
  }

  const showHeaderAndInfo = isLoggedIn && currentScreen !== 'setup';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      {/* Network Status Banner for app core */}
      {!showHeaderAndInfo && (
        forceOffline ? (
          <TouchableOpacity style={styles.forceOfflineBanner} onPress={() => setForceOffline(false)}>
            <Text style={styles.forceOfflineBannerText}>⚠️ Đang BẮT BUỘC chạy chế độ OFFLINE (Bấm để hủy)</Text>
          </TouchableOpacity>
        ) : (
          !isOnline && (
            <View style={styles.offlineBanner}>
              <Text style={styles.offlineBannerText}>⚠️ Mất kết nối mạng - Đang chạy chế độ OFFLINE</Text>
            </View>
          )
        )
      )}

      {/* Shared Dashboard Header */}
      {showHeaderAndInfo && (
        <View style={styles.dashboardHeader}>
          <View style={styles.headerLeft}>
            <View style={styles.purpleLogoSquare}>
              <Text style={styles.purpleLogoIcon}>⛶</Text>
            </View>
            <View style={styles.headerTextGroup}>
              <Text style={styles.headerGateText}>{config.gateName || 'Cổng soát vé'}</Text>
              <Text style={styles.headerConcertText}>{config.concertTitle || 'Tên sự kiện'}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            {/* Connection badge */}
            <View style={[
              styles.connectionBadge,
              effectiveMode === 'online' ? styles.connectionBadgeOnline : styles.connectionBadgeOffline
            ]}>
              <Text style={[
                styles.connectionBadgeText,
                effectiveMode === 'online' ? styles.connectionBadgeTextOnline : styles.connectionBadgeTextOffline
              ]}>
                {effectiveMode === 'online' ? '📶 Online' : '⚠️ Offline'}
              </Text>
            </View>

            {/* Icons */}
            <TouchableOpacity style={styles.headerIconBtn} onPress={() => Alert.alert('Thông báo', 'Không có thông báo mới.')}>
              <Text style={styles.headerIconText}>🔔</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.headerIconBtn} onPress={() => setCurrentScreen('setup')}>
              <Text style={styles.headerIconText}>⚙️</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.headerIconBtn} onPress={handleLogout}>
              <Text style={[styles.headerIconText, { color: '#d64545' }]}>➡️</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Shared Dashboard Info Bar */}
      {showHeaderAndInfo && (
        <View style={styles.dashboardInfoBar}>
          <View style={styles.infoBarLeft}>
            <Text style={styles.infoBarLabel}>📍 Khu hợp lệ:</Text>
            {config.allowedZones && config.allowedZones.length > 0 ? (
              config.allowedZones.map((zone) => (
                <View key={zone.id} style={styles.zonePill}>
                  <Text style={styles.zonePillText}>{zone.code}</Text>
                </View>
              ))
            ) : (
              <View style={[styles.zonePill, { backgroundColor: '#2c2f3a' }]}>
                <Text style={[styles.zonePillText, { color: '#828599' }]}>Trống</Text>
              </View>
            )}
          </View>
          <Text style={styles.checkerNameText}>👤 {checkerInfo?.fullName || 'Demo Checker'}</Text>
        </View>
      )}

      {/* Screen Area */}
      <View style={styles.screenContent}>{renderScreen()}</View>

      {/* Tab Navigation Bar (Only show if logged in and not on Setup screen) */}
      {currentScreen !== 'setup' && (
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, currentScreen === 'scan' && styles.tabItemActive]}
            onPress={() => setCurrentScreen('scan')}
          >
            <Text style={[styles.tabIcon, currentScreen === 'scan' && styles.tabIconActive]}>⛶</Text>
            <Text style={[styles.tabText, currentScreen === 'scan' && styles.tabTextActive]}>Quét vé</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, currentScreen === 'history' && styles.tabItemActive]}
            onPress={() => setCurrentScreen('history')}
          >
            <Text style={[styles.tabIcon, currentScreen === 'history' && styles.tabIconActive]}>🕒</Text>
            <Text style={[styles.tabText, currentScreen === 'history' && styles.tabTextActive]}>Lịch sử</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, currentScreen === 'queue' && styles.tabItemActive]}
            onPress={() => setCurrentScreen('queue')}
          >
            <Text style={[styles.tabIcon, currentScreen === 'queue' && styles.tabIconActive]}>☁️</Text>
            <Text style={[styles.tabText, currentScreen === 'queue' && styles.tabTextActive]}>Đồng bộ</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0b0d',
  },
  offlineBanner: {
    backgroundColor: '#342310',
    borderBottomWidth: 1,
    borderBottomColor: '#d98b00',
    paddingVertical: 6,
    alignItems: 'center',
  },
  offlineBannerText: {
    color: '#f5c842',
    fontSize: 12,
    fontWeight: '800',
  },
  forceOfflineBanner: {
    backgroundColor: '#3d3410',
    borderBottomWidth: 1,
    borderBottomColor: '#cca20c',
    paddingVertical: 6,
    alignItems: 'center',
  },
  forceOfflineBannerText: {
    color: '#ffd026',
    fontSize: 12,
    fontWeight: '800',
  },
  dashboardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#16181d',
    borderBottomWidth: 1,
    borderBottomColor: '#2c2f3a',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  purpleLogoSquare: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#6045e2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  purpleLogoIcon: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerTextGroup: {
    flex: 1,
  },
  headerGateText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  headerConcertText: {
    color: '#828599',
    fontSize: 12,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  connectionBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  connectionBadgeOnline: {
    backgroundColor: '#0f2e22',
    borderColor: '#1f9d55',
  },
  connectionBadgeOffline: {
    backgroundColor: '#342310',
    borderColor: '#d98b00',
  },
  connectionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  connectionBadgeTextOnline: {
    color: '#1f9d55',
  },
  connectionBadgeTextOffline: {
    color: '#d98b00',
  },
  headerIconBtn: {
    padding: 4,
  },
  headerIconText: {
    fontSize: 18,
  },
  dashboardInfoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111318',
    borderBottomWidth: 1,
    borderBottomColor: '#1c1e24',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  infoBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoBarLabel: {
    color: '#828599',
    fontSize: 12,
    fontWeight: '600',
  },
  zonePill: {
    backgroundColor: '#331819',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 0.5,
    borderColor: '#de2d52',
  },
  zonePillText: {
    color: '#de2d52',
    fontSize: 11,
    fontWeight: '700',
  },
  checkerNameText: {
    color: '#828599',
    fontSize: 12,
    fontWeight: '600',
  },
  screenContent: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    height: 56,
    borderTopWidth: 1,
    borderTopColor: '#1c1e24',
    backgroundColor: '#16181d',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  tabItemActive: {
    borderTopWidth: 2,
    borderTopColor: '#6045e2',
  },
  tabIcon: {
    fontSize: 18,
    color: '#828599',
  },
  tabIconActive: {
    color: '#6045e2',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#828599',
    marginTop: 2,
  },
  tabTextActive: {
    color: '#6045e2',
    fontWeight: '700',
  },
});
