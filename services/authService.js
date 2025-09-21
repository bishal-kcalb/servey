// services/authService.js
import * as SecureStore from 'expo-secure-store';
import { api, setAuthToken } from '../api/client';
import axios from 'axios';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export const AuthService = {
  async login(email, password) {
    // expects backend response like: { token, user: { id, name, email, role } }
    const { data } = await api.post('/user/login', { email, password });

    if (!data?.token) {
      throw new Error('No token in response');
    }

    await SecureStore.setItemAsync(TOKEN_KEY, data.token);
    setAuthToken(data.token);

    if (data.user) {
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(data.user));
    }
    return data; // { token, user }
  },

  async logout() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    setAuthToken(null);
  },

  async loadSession() {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    const userStr = await SecureStore.getItemAsync(USER_KEY);
    const user = userStr ? JSON.parse(userStr) : null;

    if (token) setAuthToken(token);
    return { token, user };
  },

    async getProfile() {
    const userStr = await SecureStore.getItemAsync(USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  },

    async forgotPassword(email) {
    return api.post('/user/auth/forgot-password', { email });
  },

  async resetPassword(email, code, password) {
    return api.post('/user/auth/reset-password', { email, code, password });
  }


};
