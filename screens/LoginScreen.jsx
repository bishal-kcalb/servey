// screens/LoginScreen.js
import React, { useState, useEffect } from 'react';

import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Image, ActivityIndicator
} from 'react-native';
import { useTheme } from '../theme';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { AuthService } from '../services/authService';

export default function LoginScreen({ navigation }) {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // Auto-forward if a session already exists
  useEffect(() => {
    (async () => {
      const { token, user } = await AuthService.loadSession();
      if (token && user) {
        goToDashboard(user);
      }
    })();
  }, []);

  const goToDashboard = (user) => {
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  };

  const handleLogin = async () => {
    setErr('');
    if (!email.trim() || !password) {
      setErr('Email and password are required');
      return;
    }

    setLoading(true);
    try {
      const { user } = await AuthService.login(email.trim(), password);
      goToDashboard(user);
    } catch (e) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        'Login failed';
      setErr(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.wrap, { backgroundColor: theme.colors.background }]}
    >
      {/* Card Wrapper */}
      <View style={[theme.styles.card, styles.card]}>
        <View style={styles.logoWrap}>
          <Image
            style={styles.logo}
            source={require('../assets/logo2.png')}
            resizeMode="contain"
          />
        </View>

        <Text style={[styles.title, { color: theme.colors.text }]}>Welcome Back 👋</Text>
        <Text style={[styles.subtitle, { color: '#6b7280' }]}>
          Login to continue
        </Text>

        {!!err && (
          <Text style={styles.errorText}>
            {err}
          </Text>
        )}

        {/* Email */}
        <View style={theme.styles.inputWrapper}>
          <MaterialIcons name="email" size={18} color="#6b7280" />
          <TextInput
            placeholder="Email"
            placeholderTextColor="#9ca3af"
            value={email}
            onChangeText={setEmail}
            style={[styles.input, { color: theme.colors.text }]}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />
        </View>

        {/* Password */}
        <View style={theme.styles.inputWrapper}>
          <Feather name="lock" size={18} color="#6b7280" />
          <TextInput
            placeholder="Password"
            placeholderTextColor="#9ca3af"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPass}
            style={[styles.input, { color: theme.colors.text }]}
            returnKeyType="done"
          />
          <TouchableOpacity onPress={() => setShowPass(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name={showPass ? 'eye-off' : 'eye'} size={18} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {/* Login */}
        <TouchableOpacity
          onPress={handleLogin}
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
              Login
            </Text>
          )}
        </TouchableOpacity>

        {/* Forget link */}
        <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} activeOpacity={0.7}>
          <Text style={[styles.link, { color: theme.colors.primary }]}>Forgot Password?</Text>
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
    // padding: 18,
    alignSelf: 'center',
    backgroundColor: '#fff',
    paddingVertical: 100
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
