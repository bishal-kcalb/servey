// screens/ProfileScreen.jsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  TouchableOpacity,
  Image,
  Platform,
  ActionSheetIOS,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { api } from '../api/client';
import { AuthService } from '../services/authService';
import { uploadImage } from '../services/uploadService';
import ScreenContainer from '../components/ScreenContainer';

/* ----------------------------- media helpers ----------------------------- */
async function ensureMediaLibraryPermission() {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') throw new Error('Media library permission denied');
}
async function ensureCameraPermission() {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') throw new Error('Camera permission denied');
}
async function pickOrCaptureAndUpload(source, setRemoteUrl, setLoadingFlag) {
  try {
    setLoadingFlag(true);
    if (source === 'gallery') {
      await ensureMediaLibraryPermission();
      const r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (r.canceled) return;
      const asset = r.assets?.[0];
      const url = await uploadImage(asset.uri);
      setRemoteUrl(url);
    } else {
      await ensureCameraPermission();
      const r = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (r.canceled) return;
      const asset = r.assets?.[0];
      const url = await uploadImage(asset.uri);
      setRemoteUrl(url);
    }
  } catch (e) {
    console.warn(e);
    Alert.alert('Upload error', e?.message || 'Failed to upload image');
  } finally {
    setLoadingFlag(false);
  }
}
/* ------------------------------------------------------------------------ */

export default function ProfileScreen() {
  const theme = useTheme();

  // loading
  const [loading, setLoading] = useState(false);

  // user + profile (view state)
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [phoneView, setPhoneView] = useState('');
  const [addressView, setAddressView] = useState('');
  const [nameView, setNameView] = useState('');

  // edit modal state (form)
  const [editVisible, setEditVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [avatarDraft, setAvatarDraft] = useState('');

  // password modal state
  const [pwdVisible, setPwdVisible] = useState(false);
  const [changing, setChanging] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');

  const COLORS = {
    primary: '#10b981',
    text: theme.colors?.text || '#111827',
    subtle: '#6b7280',
    card: '#fff',
    border: '#e5e7eb',
    bg: theme.colors?.background || '#f7f7fb',
  };

  /* ------------------------------- load profile ------------------------------ */
  const load = useCallback(async () => {
    try {
      setLoading(true);
      await AuthService.loadSession();
      const { data } = await api.get('/me/profile');

      setUser(data.user);
      setEmail(data.user?.email || '');
      setRole(data.user?.role || '');
      setNameView(data.user?.name || '');
      setPhoneView(data.profile?.phone || '');
      setAddressView(data.profile?.address || '');
      setAvatarUrl(data.profile?.avatar_url || '');
    } catch (e) {
      console.error(e?.response?.data || e.message);
      Alert.alert('Error', e?.response?.data?.error || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* -------------------------- open/seed edit modal -------------------------- */
  const openEdit = () => {
    setName(nameView);
    setPhone(phoneView);
    setAddress(addressView);
    setAvatarDraft(avatarUrl);
    setEditVisible(true);
  };

  const chooseAvatar = () => {
    const pickGallery = () => pickOrCaptureAndUpload('gallery', setAvatarDraft, setUploading);
    const pickCamera = () => pickOrCaptureAndUpload('camera', setAvatarDraft, setUploading);
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Take Photo', 'Pick from Gallery'], cancelButtonIndex: 0 },
        (idx) => { if (idx === 1) pickCamera(); if (idx === 2) pickGallery(); }
      );
    } else {
      Alert.alert('Profile picture', 'Choose a source', [
        { text: 'Camera', onPress: pickCamera },
        { text: 'Gallery', onPress: pickGallery },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const saveProfile = async () => {
    try {
      setSaving(true);
      const payload = { name, phone, address, avatar_url: avatarDraft || null };
      const { data } = await api.put('/me/profile', payload);

      // reflect to a view state
      setUser(data.user);
      setNameView(data.user?.name || name);
      setPhoneView(data.profile?.phone || phone);
      setAddressView(data.profile?.address || address);
      setAvatarUrl(data.profile?.avatar_url || avatarDraft);

      setEditVisible(false);
      Alert.alert('Saved', 'Profile updated');
    } catch (e) {
      console.error(e?.response?.data || e.message);
      Alert.alert('Error', e?.response?.data?.error || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  /* --------------------------- password modal flow -------------------------- */
  const changePassword = async () => {
    if (!currentPwd || !newPwd) {
      Alert.alert('Error', 'Please enter current and new password');
      return;
    }
    if (newPwd !== confirmPwd) {
      Alert.alert('Error', 'New password and confirm password do not match');
      return;
    }
    try {
      setChanging(true);
      await api.put('/me/password', { current_password: currentPwd, new_password: newPwd });
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
      setPwdVisible(false);
      Alert.alert('Success', 'Password updated');
    } catch (e) {
      console.error(e?.response?.data || e.message);
      Alert.alert('Error', e?.response?.data?.error || 'Failed to change password');
    } finally {
      setChanging(false);
    }
  };

  /* --------------------------------- UI ------------------------------------ */
  const Row = ({ label, value }) => (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: COLORS.subtle }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: COLORS.text }]} numberOfLines={2}>{value || '—'}</Text>
    </View>
  );

  if (loading && !user) {
    return (
      <View style={[styles.center, { backgroundColor: COLORS.bg }]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView style={[styles.container, { backgroundColor: COLORS.bg }]} keyboardShouldPersistTaps="handled">
        {/* Header / Avatar */}
        <View style={[styles.card, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
          <View style={styles.headerRow}>
            <View style={{ position: 'relative' }}>
              <View style={[styles.avatarWrap, { borderColor: COLORS.border, backgroundColor: '#fafafa' }]}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                ) : (
                  <Feather name="user" size={32} color={COLORS.subtle} />
                )}
              </View>
              <TouchableOpacity style={[styles.avatarEdit, { backgroundColor: COLORS.primary }]} onPress={openEdit}>
                <Feather name="edit-3" size={14} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={[styles.name, { color: COLORS.text }]} numberOfLines={1}>
                {nameView || 'Your Name'}
              </Text>
              <View style={styles.badge}>
                <Feather name="shield" size={12} color="#fff" />
                <Text style={styles.badgeText}>{(role || 'user').toUpperCase()}</Text>
              </View>
            </View>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity style={[styles.actionBtn, { borderColor: COLORS.border }]} onPress={openEdit}>
              <Feather name="user-check" size={16} color={COLORS.text} />
              <Text style={[styles.actionText, { color: COLORS.text }]}>Edit Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { borderColor: COLORS.border }]} onPress={() => setPwdVisible(true)}>
              <Feather name="lock" size={16} color={COLORS.text} />
              <Text style={[styles.actionText, { color: COLORS.text }]}>Change Password</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Details */}
        <View style={[styles.card, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
          <Text style={[styles.sectionTitle, { color: COLORS.text }]}>Account</Text>
          <Row label="Email" value={email} />
          <Row label="Phone" value={phoneView} />
          <Row label="Address" value={addressView} />
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* --------------------------- Edit Profile Modal --------------------------- */}
      <Modal
        animationType="slide"
        visible={editVisible}
        transparent
        onRequestClose={() => setEditVisible(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.modalAvoid}
            >
              <View style={[styles.modalCard, { backgroundColor: COLORS.card }]}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: COLORS.text }]}>Edit Profile</Text>
                  <Pressable onPress={() => setEditVisible(false)} hitSlop={8}>
                    <Feather name="x" size={20} color={COLORS.text} />
                  </Pressable>
                </View>

                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ paddingBottom: 16 }}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Avatar picker */}
                  <View style={{ alignItems: 'center', marginBottom: 10 }}>
                    <TouchableOpacity
                      style={[styles.avatarWrapLg, { borderColor: COLORS.border, backgroundColor: '#fafafa' }]}
                      onPress={chooseAvatar}
                      activeOpacity={0.8}
                    >
                      {uploading ? (
                        <ActivityIndicator />
                      ) : avatarDraft ? (
                        <Image source={{ uri: avatarDraft }} style={styles.avatarLg} />
                      ) : (
                        <MaterialIcons name="add-a-photo" size={26} color={COLORS.subtle} />
                      )}
                    </TouchableOpacity>
                    <Text style={{ color: COLORS.subtle, marginTop: 6 }}>Tap to change photo</Text>
                  </View>

                  {/* Form */}
                  <Text style={styles.label}>Name</Text>
                  <TextInput
                    style={[styles.input, { borderColor: COLORS.border }]}
                    placeholder="Your name"
                    value={name}
                    onChangeText={setName}
                    returnKeyType="next"
                  />

                  <Text style={styles.label}>Phone</Text>
                  <TextInput
                    style={[styles.input, { borderColor: COLORS.border }]}
                    placeholder="+1 555..."
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    returnKeyType="next"
                  />

                  <Text style={styles.label}>Address</Text>
                  <TextInput
                    style={[styles.input, { borderColor: COLORS.border, height: 90, textAlignVertical: 'top' }]}
                    placeholder="Address"
                    value={address}
                    onChangeText={setAddress}
                    multiline
                  />

                  <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: COLORS.primary }]}
                    onPress={saveProfile}
                    disabled={saving}
                  >
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Save Changes</Text>}
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ------------------------- Change Password Modal ------------------------- */}
      <Modal
        animationType="slide"
        visible={pwdVisible}
        transparent
        onRequestClose={() => setPwdVisible(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.modalAvoid}
            >
              <View style={[styles.modalCard, { backgroundColor: COLORS.card }]}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: COLORS.text }]}>Change Password</Text>
                  <Pressable onPress={() => setPwdVisible(false)} hitSlop={8}>
                    <Feather name="x" size={20} color={COLORS.text} />
                  </Pressable>
                </View>

                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ paddingBottom: 16 }}
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={styles.label}>Current Password</Text>
                  <TextInput
                    style={[styles.input, { borderColor: COLORS.border }]}
                    value={currentPwd}
                    onChangeText={setCurrentPwd}
                    secureTextEntry
                    placeholder="••••••••"
                    returnKeyType="next"
                  />

                  <Text style={styles.label}>New Password</Text>
                  <TextInput
                    style={[styles.input, { borderColor: COLORS.border }]}
                    value={newPwd}
                    onChangeText={setNewPwd}
                    secureTextEntry
                    placeholder="••••••••"
                    returnKeyType="next"
                  />

                  <Text style={styles.label}>Confirm New Password</Text>
                  <TextInput
                    style={[styles.input, { borderColor: COLORS.border }]}
                    value={confirmPwd}
                    onChangeText={setConfirmPwd}
                    secureTextEntry
                    placeholder="••••••••"
                    returnKeyType="done"
                    onSubmitEditing={changePassword}
                  />

                  <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: COLORS.primary }]}
                    onPress={changePassword}
                    disabled={changing}
                  >
                    {changing ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Update Password</Text>}
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </ScreenContainer>
  );
}

/* ----------------------------------- UI ----------------------------------- */
const AVATAR = 92;

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  card: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    marginBottom: 12,
  },

  headerRow: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 18, fontWeight: '800' },

  badge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700', marginLeft: 4 },

  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  actionBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  actionText: { fontWeight: '700' },

  row: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  rowLabel: { fontSize: 12, marginBottom: 4 },
  rowValue: { fontSize: 15, fontWeight: '600' },

  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 8 },

  // avatar
  avatarWrap: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatar: { width: '100%', height: '100%' },

  avatarEdit: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },

  // inputs / buttons
  label: { fontWeight: '700', marginTop: 10, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  primaryBtn: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '800' },

  // modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalAvoid: {
    width: '100%',
  },
  modalCard: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    borderTopWidth: 1,
    borderColor: '#e5e7eb',
    maxHeight: '88%', // so it can scroll under keyboard
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  // large avatar in edit modal
  avatarWrapLg: {
    width: 110, height: 110, borderRadius: 55,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarLg: { width: '100%', height: '100%' },
});
