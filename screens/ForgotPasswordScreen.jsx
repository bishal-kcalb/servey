// screens/ForgotPasswordScreen.js
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
import { MaterialIcons } from '@expo/vector-icons';
import { AuthService } from '../services/authService';

export default function ForgotPasswordScreen({ navigation }) {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const handleSendCode = async () => {
    setErr(''); setMsg('');
    if (!email.trim()) { setErr('Email is required'); return; }
    setLoading(true);
    try {
      await AuthService.forgotPassword(email.trim());
      setMsg('We sent a 6-digit code to your email.');
      navigation.navigate('VerifyReset', { email: email.trim() });
    } catch (e) {
      setErr(e?.response?.data?.error || e.message || 'Failed to send code');
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.wrap, { backgroundColor: theme.colors.background }]}
    >
      {/* Card Wrapper (same look as Login) */}
      <View style={[theme.styles.card, styles.card]}>
        <View style={styles.logoWrap}>
          <Image
            style={styles.logo}
            source={require('../assets/logo2.png')}
            resizeMode="contain"
          />
        </View>

        <Text style={[styles.title, { color: theme.colors.text }]}>
          Reset your password
        </Text>
        <Text style={[styles.subtitle, { color: '#6b7280' }]}>
          Enter your email to get a verification code
        </Text>

        {!!err && <Text style={styles.errorText}>{err}</Text>}
        {!!msg && <Text style={styles.successText}>{msg}</Text>}

        {/* Email */}
        <View style={theme.styles.inputWrapper}>
          <MaterialIcons name="email" size={18} color="#6b7280" />
          <TextInput
            placeholder="Your email"
            placeholderTextColor="#9ca3af"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, { color: theme.colors.text }]}
            returnKeyType="send"
            onSubmitEditing={handleSendCode}
          />
        </View>

        {/* Send Code */}
        <TouchableOpacity
          onPress={handleSendCode}
          disabled={loading}
          style={[
            styles.button,
            { backgroundColor: theme.colors.primary, opacity: loading ? 0.75 : 1 }
          ]}
          activeOpacity={0.9}
        >
          {loading ? (
            <ActivityIndicator color={theme.colors.buttonText || '#fff'} />
          ) : (
            <Text style={[styles.buttonText, { color: theme.colors.buttonText }]}>
              Send Code
            </Text>
          )}
        </TouchableOpacity>

        {/* Back to Login */}
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={[styles.link, { color: theme.colors.primary }]}>
            Back to Login
          </Text>
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
    paddingVertical: 100, // matches LoginScreen
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
