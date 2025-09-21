import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image
} from 'react-native';
import { useTheme } from '../theme';
import { MaterialIcons, Feather } from '@expo/vector-icons';

export default function RegisterScreen({ navigation }) {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleRegister = () => {
    if (email && password && password === confirmPassword) {
      navigation.navigate('Login');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={[theme.styles.card, {width:'100%'}]}>
        <View style={styles.image}>
          <Image
            style={styles.imageContainer}
            source={require('../assets/logo2.png')}
          />
        </View>
        <Text style={[styles.title, { color: theme.colors.primary }]}>Create Account 📝</Text>
        <Text style={styles.subtitle}>Sign up to get started</Text>

        <View style={theme.styles.inputWrapper}>
          <MaterialIcons name="email" size={20} color="#777" style={styles.icon} />
          <TextInput
            placeholder="Email"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            style={[styles.input, { color: theme.colors.text }]}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={theme.styles.inputWrapper}>
          <Feather name="lock" size={20} color="#777" style={styles.icon} />
          <TextInput
            placeholder="Password"
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={[styles.input, { color: theme.colors.text }]}
          />
        </View>

        <View style={theme.styles.inputWrapper}>
          <Feather name="lock" size={20} color="#777" style={styles.icon} />
          <TextInput
            placeholder="Confirm Password"
            placeholderTextColor="#999"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            style={[styles.input, { color: theme.colors.text }]}
          />
        </View>

        <TouchableOpacity
          onPress={handleRegister}
          style={[styles.button, { backgroundColor: theme.colors.primary }]}
        >
          <Text style={[styles.buttonText, { color: theme.colors.buttonText }]}>
            Register
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={{ color: theme.colors.primary, marginTop: 16, textAlign: 'center' }}>
            Already have an account? Login
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#777',
    textAlign: 'center',
    marginBottom: 24,
    marginTop: 6,
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 48,
  },
  button: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
    imageContainer: {
    display:'flex',
    height: '100%',
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center'
  },

  image:{
    height:'30%',
    width:'45%',
    alignSelf: 'center',
    marginTop:15
  }

});
