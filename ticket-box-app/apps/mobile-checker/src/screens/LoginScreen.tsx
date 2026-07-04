import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { apiPost, DEFAULT_API_BASE_URL } from '../services/api';

type LoginScreenProps = {
  onLoginSuccess: (token: string, user: { email: string; full_name: string; role: string }, apiBaseUrl: string) => void;
};

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_BASE_URL);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [secureText, setSecureText] = useState(true);
  const [showServerConfig, setShowServerConfig] = useState(false);

  async function handleLogin() {
    const cleanEmail = email.trim();
    const cleanPassword = password;
    const cleanUrl = apiBaseUrl.trim() || DEFAULT_API_BASE_URL;

    if (!cleanEmail || !cleanPassword) {
      Alert.alert('Lỗi nhập liệu', 'Vui lòng điền đầy đủ Email và Mật khẩu.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      Alert.alert('Lỗi nhập liệu', 'Địa chỉ email không đúng định dạng.');
      return;
    }

    setLoading(true);
    try {
      const response = await apiPost<{
        success: boolean;
        data: {
          access_token: string;
          expires_in: number;
          user: {
            id: string;
            email: string;
            full_name: string;
            phone: string | null;
            role: string;
            status: string;
          };
        };
      }>(cleanUrl, '/auth/login', {
        email: cleanEmail,
        password: cleanPassword,
      });

      if (!response || !response.data) {
        throw new Error('Phản hồi từ máy chủ không hợp lệ.');
      }

      const { access_token, user } = response.data;

      if (user.role !== 'CHECKER') {
        Alert.alert('Từ chối truy cập', 'Tài khoản không có quyền soát vé. Chỉ dành cho Nhân viên soát vé (CHECKER).');
        return;
      }

      onLoginSuccess(
        access_token,
        {
          email: user.email,
          full_name: user.full_name,
          role: user.role,
        },
        cleanUrl
      );
    } catch (error) {
      console.error('Lỗi đăng nhập:', error);
      Alert.alert(
        'Đăng nhập thất bại',
        error instanceof Error ? error.message : 'Không thể kết nối hoặc xác thực với máy chủ.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardContainer}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        {/* Settings gear icon at the top right of the screen */}
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => setShowServerConfig(!showServerConfig)}
        >
          <Text style={styles.settingsButtonText}>⚙️</Text>
        </TouchableOpacity>

        {/* Server Config Collapsible Section */}
        {showServerConfig && (
          <View style={styles.serverConfigCard}>
            <Text style={styles.serverConfigTitle}>Cấu hình API Server</Text>
            <TextInput
              style={styles.serverInput}
              value={apiBaseUrl}
              onChangeText={setApiBaseUrl}
              placeholder={DEFAULT_API_BASE_URL}
              placeholderTextColor="#8585a0"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        )}

        {/* Main Login Card */}
        <View style={styles.card}>
          {/* Top Multi-color Gradient Border simulation */}
          <View style={styles.gradientLine}>
            <View style={[styles.gradientSegment, { backgroundColor: '#ffc837' }]} />
            <View style={[styles.gradientSegment, { backgroundColor: '#ff5a5f' }]} />
            <View style={[styles.gradientSegment, { backgroundColor: '#de2d52' }]} />
            <View style={[styles.gradientSegment, { backgroundColor: '#9b51e0' }]} />
            <View style={[styles.gradientSegment, { backgroundColor: '#2f80ed' }]} />
          </View>

          {/* Logo container */}
          <View style={styles.logoRow}>
            <View style={styles.logoIconBg}>
              <Text style={styles.logoIcon}>🎫</Text>
            </View>
            <Text style={styles.logoText}>
              <Text style={styles.logoTicket}>Ticket</Text>
              <Text style={styles.logoBox}>Box</Text>
            </Text>
          </View>

          {/* Welcome Titles */}
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>
            Sign in to check-in tickets and manage events.
          </Text>

          {/* Form Fields */}
          <View style={styles.form}>
            {/* Email Field with Envelope Icon */}
            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>✉️</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Email *"
                placeholderTextColor="#5b5d6e"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Password Field with Lock and Eye toggle */}
            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Password *"
                placeholderTextColor="#5b5d6e"
                secureTextEntry={secureText}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setSecureText(!secureText)}
              >
                <Text style={styles.eyeIcon}>{secureText ? '👁️' : '🙈'}</Text>
              </TouchableOpacity>
            </View>

            {/* Forgot Password Link */}
            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={() => Alert.alert('Quên mật khẩu', 'Vui lòng liên hệ Admin qua hệ thống web để đặt lại mật khẩu.')}
            >
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </TouchableOpacity>

            {/* Sign In Button with ruby-red color and shadow */}
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.buttonText}>Sign in</Text>
              )}
            </TouchableOpacity>

            {/* Social Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or sign in with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social Buttons Row */}
            <View style={styles.socialRow}>
              <TouchableOpacity
                style={styles.socialButton}
                onPress={() => Alert.alert('Đăng nhập MXH', 'Chức năng đăng nhập Google chỉ có trên cổng Web khán giả.')}
              >
                <Text style={styles.socialButtonText}>
                  <Text style={styles.socialG}>G </Text>Google
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.socialButton}
                onPress={() => Alert.alert('Đăng nhập MXH', 'Chức năng đăng nhập Facebook chỉ có trên cổng Web khán giả.')}
              >
                <Text style={styles.socialButtonText}>
                  <Text style={styles.socialF}>F </Text>Facebook
                </Text>
              </TouchableOpacity>
            </View>

            {/* Footer Registration text */}
            <View style={styles.footerRow}>
              <Text style={styles.footerText}>No account yet? </Text>
              <TouchableOpacity onPress={() => Alert.alert('Đăng ký', 'Checker được cấp tài khoản bởi Nhà tổ chức. Vui lòng không tự ý đăng ký.')}>
                <Text style={styles.registerText}>Register</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: '#0a0b0d',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  settingsButton: {
    alignSelf: 'flex-end',
    backgroundColor: '#1c1e24',
    borderWidth: 1,
    borderColor: '#2c2f3a',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  settingsButtonText: {
    fontSize: 18,
  },
  serverConfigCard: {
    backgroundColor: '#16181d',
    borderWidth: 1,
    borderColor: '#2c2f3a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  serverConfigTitle: {
    color: '#f7f7f2',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  serverInput: {
    backgroundColor: '#1e2129',
    borderColor: '#2c2f3a',
    borderWidth: 1,
    borderRadius: 6,
    color: '#f7f7f2',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  card: {
    backgroundColor: '#16181d',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2c2f3a',
    overflow: 'hidden',
    paddingBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  gradientLine: {
    flexDirection: 'row',
    height: 3.5,
    width: '100%',
  },
  gradientSegment: {
    flex: 1,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
    marginBottom: 16,
    gap: 8,
  },
  logoIconBg: {
    backgroundColor: '#ff5a5f',
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIcon: {
    fontSize: 16,
    color: '#fff',
  },
  logoText: {
    fontSize: 20,
    fontWeight: '800',
  },
  logoTicket: {
    color: '#f7f7f2',
  },
  logoBox: {
    color: '#ffc837',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f7f7f2',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#828599',
    textAlign: 'center',
    paddingHorizontal: 24,
    marginBottom: 28,
    lineHeight: 18,
  },
  form: {
    paddingHorizontal: 24,
    gap: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e2129',
    borderWidth: 1,
    borderColor: '#2c2f3a',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: {
    fontSize: 16,
    color: '#828599',
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#f7f7f2',
    fontSize: 15,
    paddingVertical: 8,
  },
  eyeButton: {
    padding: 6,
  },
  eyeIcon: {
    fontSize: 16,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: -4,
  },
  forgotPasswordText: {
    color: '#828599',
    fontSize: 12,
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#de2d52',
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#de2d52',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2c2f3a',
  },
  dividerText: {
    color: '#5b5d6e',
    fontSize: 11,
    marginHorizontal: 12,
    fontWeight: '600',
  },
  socialRow: {
    flexDirection: 'row',
    gap: 12,
  },
  socialButton: {
    flex: 1,
    backgroundColor: '#1e2129',
    borderWidth: 1,
    borderColor: '#2c2f3a',
    borderRadius: 8,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialButtonText: {
    color: '#aeb7c7',
    fontSize: 14,
    fontWeight: '600',
  },
  socialG: {
    color: '#fff',
    fontWeight: '900',
  },
  socialF: {
    color: '#2f80ed',
    fontWeight: 'bold',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  footerText: {
    color: '#828599',
    fontSize: 13,
  },
  registerText: {
    color: '#ffc837',
    fontSize: 13,
    fontWeight: '700',
  },
});
