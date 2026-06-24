import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import NetInfo from '@react-native-community/netinfo';
import { SetupScreen } from './src/screens/SetupScreen';
import { ScanScreen } from './src/screens/ScanScreen';
import { GuestScreen } from './src/screens/GuestScreen';
import { QueueScreen } from './src/screens/QueueScreen';
import { executeQueueSync } from './src/services/sync';
import { DEFAULT_API_BASE_URL } from './src/services/api';

type ScreenName = 'setup' | 'scan' | 'guests' | 'queue';

export default function App() {
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

  function renderScreen() {
    switch (currentScreen) {
      case 'setup':
        return (
          <SetupScreen
            config={config}
            onConfigChange={setConfig}
            forceOffline={forceOffline}
            onForceOfflineChange={setForceOffline}
          />
        );
      case 'scan':
        return (
          <ScanScreen
            config={config}
            mode={effectiveMode}
          />
        );
      case 'guests':
        return (
          <GuestScreen
            config={{
              apiBaseUrl: config.apiBaseUrl,
              token: config.token,
              concertId: config.concertId,
              gateId: config.gateId,
              deviceId: config.deviceId,
            }}
            mode={effectiveMode}
          />
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      {/* Network Status Banner */}
      {forceOffline ? (
        <TouchableOpacity style={styles.forceOfflineBanner} onPress={() => setForceOffline(false)}>
          <Text style={styles.forceOfflineBannerText}>⚠️ Đang BẮT BUỘC chạy chế độ OFFLINE (Bấm để hủy)</Text>
        </TouchableOpacity>
      ) : (
        !isOnline && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineBannerText}>⚠️ Mất kết nối mạng - Đang chạy chế độ OFFLINE</Text>
          </View>
        )
      )}

      {/* Screen Area */}
      <View style={styles.screenContent}>{renderScreen()}</View>

      {/* Tab Navigation Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, currentScreen === 'setup' && styles.tabItemActive]}
          onPress={() => setCurrentScreen('setup')}
        >
          <Text style={[styles.tabText, currentScreen === 'setup' && styles.tabTextActive]}>⚙️ Cài đặt</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, currentScreen === 'scan' && styles.tabItemActive]}
          onPress={() => setCurrentScreen('scan')}
        >
          <Text style={[styles.tabText, currentScreen === 'scan' && styles.tabTextActive]}>📷 Soát Vé</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, currentScreen === 'guests' && styles.tabItemActive]}
          onPress={() => setCurrentScreen('guests')}
        >
          <Text style={[styles.tabText, currentScreen === 'guests' && styles.tabTextActive]}>👤 Khách Mời</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, currentScreen === 'queue' && styles.tabItemActive]}
          onPress={() => setCurrentScreen('queue')}
        >
          <Text style={[styles.tabText, currentScreen === 'queue' && styles.tabTextActive]}>📊 Đồng bộ</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#101114',
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
  screenContent: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    height: 56,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#191b20',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8585a0',
  },
  tabTextActive: {
    color: '#2f80ed',
    fontWeight: '800',
  },
});
