// screens/VerifyResetScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useTheme } from '../theme';
import { Feather } from '@expo/vector-icons';
import { AuthService } from '../services/authService';

export default function VerifyResetScreen({ route, navigation }) {
  const theme = useTheme();
  const [email] = useState(route?.params?.email || '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const handleReset = async () => {
    setErr(''); setMsg('');
    if (!code.trim()) return setErr('Code is required');
    if (!password || password.length < 8) return setErr('Password must be at least 8 characters');
    if (password !== confirm) return setErr('Passwords do not match');

    setLoading(true);
    try {
      await AuthService.resetPassword(email, code.trim(), password);
      setMsg('Password updated. You can now log in.');
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (e) {
      setErr(e?.response?.data?.error || e.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.wrap, { backgroundColor: theme.colors.background }]}
    >
      {/* Card Wrapper (same look as Login/Forgot) */}
      <View style={[theme.styles.card, styles.card]}>
        <View style={styles.logoWrap}>
          <Image
            style={styles.logo}
            source={require('../assets/logo2.png')}
            resizeMode="contain"
          />
        </View>

        <Text style={[styles.title, { color: theme.colors.text }]}>
          Verify & set new password
        </Text>
        <Text style={[styles.subtitle, { color: '#6b7280' }]}>
          We sent a 6-digit code to {email}.
        </Text>

        {!!err && <Text style={styles.errorText}>{err}</Text>}
        {!!msg && <Text style={styles.successText}>{msg}</Text>}

        {/* Code */}
        <View style={theme.styles.inputWrapper}>
          <Feather name="hash" size={18} color="#6b7280" />
          <TextInput
            placeholder="6-digit code"
            placeholderTextColor="#9ca3af"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
            style={[styles.input, { color: theme.colors.text }]}
            returnKeyType="next"
          />
        </View>

        {/* New password */}
        <View style={theme.styles.inputWrapper}>
          <Feather name="lock" size={18} color="#6b7280" />
          <TextInput
            placeholder="New password"
            placeholderTextColor="#9ca3af"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={[styles.input, { color: theme.colors.text }]}
            returnKeyType="next"
          />
        </View>

        {/* Confirm password */}
        <View style={theme.styles.inputWrapper}>
          <Feather name="lock" size={18} color="#6b7280" />
          <TextInput
            placeholder="Confirm password"
            placeholderTextColor="#9ca3af"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            style={[styles.input, { color: theme.colors.text }]}
            returnKeyType="done"
            onSubmitEditing={handleReset}
          />
        </View>

        {/* Reset Button */}
        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: theme.colors.primary, opacity: loading ? 0.75 : 1 },
          ]}
          onPress={handleReset}
          disabled={loading}
          activeOpacity={0.9}
        >
          {loading ? (
            <ActivityIndicator color={theme.colors.buttonText || '#fff'} />
          ) : (
            <Text style={[styles.buttonText, { color: theme.colors.buttonText }]}>
              Reset Password
            </Text>
          )}
        </TouchableOpacity>

        {/* Back to Login */}
        <TouchableOpacity onPress={() => navigation.navigate('Login')} activeOpacity={0.7}>
          <Text style={[styles.link, { color: theme.colors.primary }]}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    borderRadius: 16,
    alignSelf: 'center',
    backgroundColor: '#fff',
    paddingVertical: 100, // matches Login/Forgot
  },
  logoWrap: {
    alignSelf: 'center',
    height: 150,
    width: 120,
    marginBottom: 8,
  },
  logo: { height: '100%', width: '100%' },
  title: { fontSize: 22, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  subtitle: { fontSize: 12, textAlign: 'center', marginTop: 6, marginBottom: 14 },
  errorText: { color: '#ef4444', marginBottom: 10, textAlign: 'center', fontSize: 13 },
  successText: { color: '#10b981', marginBottom: 10, textAlign: 'center', fontSize: 13 },
  input: { flex: 1, height: 44, fontSize: 14 },
  button: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: { fontSize: 15, fontWeight: '700' },
  link: { marginTop: 14, textAlign: 'center', fontWeight: '600' },
});
