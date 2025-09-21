// api/client.js
import axios from 'axios';

// TODO: change to your LAN IP (keep same as your previous code)
const API_BASE = 'https://0ca3eba0ec78.ngrok-free.app';

export const api = axios.create({
  baseURL: API_BASE,
  // You can set common headers here if needed
});

// Optional: call this after login to attach Authorization
export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};
