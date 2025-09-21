// screens/ManageSurveyors.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Modal,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { api } from '../api/client';
import { AuthService } from '../services/authService';
import ScreenContainer from '../components/ScreenContainer';

export default function ManageSurveyors() {
  const theme = useTheme();
  const COLORS = {
    primary:'#10b981',
    bg: theme?.colors?.background || '#f7f7fb',
    text: theme?.colors?.text || '#111827',
    subtle: '#6b7280',
    card: '#ffffff',
    border: '#e5e7eb',
    chipBg: '#eef2ff',
  };

  const [surveyors, setSurveyors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // search
  const [query, setQuery] = useState('');

  // modal (add/edit)
  const [modalVisible, setModalVisible] = useState(false);
  const [currentSurveyor, setCurrentSurveyor] = useState(null);

  // form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(''); // only used when creating
  const [role, setRole] = useState('surveyor'); // 'admin' | 'surveyor'

  // --- Load token + list
  useEffect(() => {
    (async () => {
      await AuthService.loadSession(); // sets Authorization header
      fetchSurveyors();
    })();
  }, []);

  const fetchSurveyors = async () => {
    try {
      setLoading(true);
      // ensure Authorization header is set from secure storage
      await AuthService.loadSession();

      // GET /user/ (your route)
      const res = await api.get('/user/');
      const list = Array.isArray(res?.data?.users) ? res.data.users : [];

      // only surveyors (keep admins out of this screen)
      const onlySurveyors = list.filter((u) => String(u.role).toLowerCase() === 'surveyor');

      setSurveyors(onlySurveyors.map((u) => ({ ...u, id: String(u.id) })));
    } catch (e) {
      console.log('GET /user/ error:', e?.response?.status, e?.response?.data);
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        (e?.response?.status === 401
          ? 'Unauthorized: login again'
          : e?.response?.status === 403
          ? 'Forbidden: admin only'
          : 'Failed to load surveyors');
      Alert.alert('Error', msg);
      setSurveyors([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSurveyors();
    setRefreshing(false);
  };

  // --- Modal open/close
  const openAddModal = () => {
    setCurrentSurveyor(null);
    setName('');
    setEmail('');
    setPassword('');
    setRole('surveyor');
    setModalVisible(true);
  };

  const openEditModal = (surveyor) => {
    setCurrentSurveyor(surveyor);
    setName(surveyor?.name || '');
    setEmail(surveyor?.email || '');
    setPassword('');
    setRole(surveyor?.role || 'surveyor');
    setModalVisible(true);
  };

  // --- Create / Update
  const handleSave = async () => {
    if (!name.trim() || !email.trim()) {
      return Alert.alert('Validation', 'Name and email are required');
    }
    if (!currentSurveyor && !password.trim()) {
      return Alert.alert('Validation', 'Password is required for new surveyor');
    }

    try {
      if (currentSurveyor) {
        await api.put(`/user/${currentSurveyor.id}`, {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          role,
          // password: include only if you support password change here
        });
        Alert.alert('Updated', 'Surveyor updated successfully');
      } else {
        await api.post('/user', {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password: password.trim(),
          role,
        });
        Alert.alert('Created', 'Surveyor added');
      }

      setModalVisible(false);
      await fetchSurveyors();
    } catch (e) {
      console.error(e);
      const msg = e?.response?.data?.error || e?.response?.data?.message || 'Operation failed';
      Alert.alert('Error', msg);
    }
  };

  // --- Delete
  const handleDelete = (id) => {
    Alert.alert('Confirm Delete', 'Are you sure you want to delete this surveyor?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/user/${id}`);
            await fetchSurveyors();
          } catch (e) {
            console.error(e);
            const msg = e?.response?.data?.error || 'Failed to delete surveyor';
            Alert.alert('Error', msg);
          }
        },
      },
    ]);
  };

  // --- Search filter
  const filteredSurveyors = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return surveyors;
    return surveyors.filter((u) => {
      const name = (u.name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [surveyors, query]);

  // --- Card
  const renderItem = ({ item }) => (
    <View style={[styles.card, { backgroundColor: COLORS.card, borderColor: COLORS.border, shadowColor: '#000' }]}>
      <View style={{ flex: 1, paddingRight: 10 }}>
        <Text style={[styles.name, { color: COLORS.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.email, { color: COLORS.subtle }]} numberOfLines={1}>
          {item.email}
        </Text>

        <View style={[styles.metaRow]}>
          <View style={[styles.pill, { backgroundColor: COLORS.chipBg, borderColor: COLORS.border }]}>
            <Text style={[styles.pillText, { color: COLORS.text }]}>role: {String(item.role || '').toLowerCase()}</Text>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity onPress={() => openEditModal(item)} style={styles.iconBtn}>
          <Feather name="edit-3" size={18} color={COLORS.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.iconBtn}>
          <Feather name="trash-2" size={18} color="#f44336" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScreenContainer>
      <View style={[styles.container, { backgroundColor: COLORS.bg }]}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.heading, { color: COLORS.text }]}>Manage Surveyors</Text>
            <Text style={styles.subtitle}>Invite, edit and manage your field team</Text>
          </View>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: COLORS.primary }]}
            onPress={openAddModal}
            activeOpacity={0.9}
          >
            <Feather name="user-plus" size={16} color="#fff" />
            <Text style={styles.primaryBtnText}>Add Surveyor</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={[styles.searchWrap, { borderColor: COLORS.border, backgroundColor: COLORS.card }]}>
          <Feather name="search" size={18} color={COLORS.subtle} />
          <TextInput
            style={[styles.searchInput, { color: COLORS.text }]}
            placeholder="Search by name or email..."
            placeholderTextColor="#9ca3af"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Feather name="x" size={18} color={COLORS.subtle} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* List */}
        {loading ? (
          <ActivityIndicator style={{ marginTop: 16 }} />
        ) : (
          <FlatList
            data={filteredSurveyors}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshing={refreshing}
            onRefresh={onRefresh}
            ListEmptyComponent={
              <Text style={{ color: COLORS.subtle, textAlign: 'center', marginTop: 24 }}>
                {query ? 'No surveyors match your search.' : 'No surveyors yet.'}
              </Text>
            }
          />
        )}

        {/* Bottom-sheet Modal (Add / Edit) */}
        <Modal
          visible={modalVisible}
          transparent
          animationType="slide"
          statusBarTranslucent
          presentationStyle="overFullScreen"
          onRequestClose={() => setModalVisible(false)}
        >
          {/* Dim overlay */}
          <View style={styles.modalOverlay} />

          {/* Sheet */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.sheetWrap}
          >
            <SafeAreaView style={[styles.sheet, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
              {/* Grabber */}
              <View style={styles.grabberRow}>
                <View style={styles.grabber} />
              </View>

              {/* Header */}
              <View style={[styles.sheetHeader, { paddingHorizontal: 16 }]}>
                <Text style={[styles.sheetTitle, { color: COLORS.text }]}>
                  {currentSurveyor ? 'Edit Surveyor' : 'Add Surveyor'}
                </Text>
                <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={8}>
                  <Feather name="x" size={22} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              {/* Padded scroll content */}
              <View style={styles.sheetInner}>
                <Text style={[styles.label, { paddingHorizontal: 16 }]}>Name</Text>
                <View style={styles.rowPad}>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Name"
                    placeholderTextColor="#9ca3af"
                    style={[styles.input, { borderColor: COLORS.border, color: COLORS.text }]}
                  />
                </View>

                <Text style={[styles.label, { paddingHorizontal: 16 }]}>Email</Text>
                <View style={styles.rowPad}>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Email"
                    placeholderTextColor="#9ca3af"
                    style={[styles.input, { borderColor: COLORS.border, color: COLORS.text }]}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>

                {/* Password: required on create */}
                {!currentSurveyor && (
                  <>
                    <Text style={[styles.label, { paddingHorizontal: 16 }]}>Password</Text>
                    <View style={styles.rowPad}>
                      <TextInput
                        value={password}
                        onChangeText={setPassword}
                        placeholder="Password (min 6)"
                        placeholderTextColor="#9ca3af"
                        secureTextEntry
                        style={[styles.input, { borderColor: COLORS.border, color: COLORS.text }]}
                      />
                    </View>
                  </>
                )}

                {/* Role selector */}
                <Text style={[styles.label, { paddingHorizontal: 16 }]}>Role</Text>
                <View style={[styles.roleRow, { paddingHorizontal: 16 }]}>
                  {['surveyor', 'admin'].map((r) => (
                    <TouchableOpacity
                      key={r}
                      onPress={() => setRole(r)}
                      style={[
                        styles.rolePill,
                        { borderColor: COLORS.border },
                        role === r && { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
                      ]}
                    >
                      <Text style={{ color: role === r ? '#fff' : COLORS.text, fontWeight: '700' }}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Sticky footer */}
              <View style={[styles.footerBar, { borderTopColor: COLORS.border, backgroundColor: COLORS.card }]}>
                <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.cancelBtn}>
                  <Text style={{ color: COLORS.text, fontWeight: '700' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSave} style={[styles.saveBtn, { backgroundColor: COLORS.primary }]}>
                  <Text style={{ color: '#fff', fontWeight: '800' }}>Save</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </ScreenContainer>
  );
}

const RADIUS = 16;

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },

  headerRow: {
    paddingTop: 4,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heading: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 12, color: '#8b8b8b', marginTop: 2 },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  searchInput: { flex: 1, paddingVertical: 0 },

  // Primary button
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800' },

  // Card
  card: {
    padding: 16,
    borderRadius: RADIUS,
    borderWidth: 1,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  name: { fontSize: 16, fontWeight: '700' },
  email: { fontSize: 14, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  pill: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillText: { fontSize: 12, fontWeight: '800' },

  actions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  iconBtn: {
    height: 36,
    width: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },

  // Modal overlay + sheet
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheetWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    maxHeight: '92%',
    marginTop: 'auto',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -4 },
    elevation: 14,
  },
  grabberRow: {
    alignItems: 'center',
    paddingTop: 6,
  },
  grabber: {
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    alignSelf: 'center',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800' },

  // inner content (we’ll manually add horizontal padding around rows)
  sheetInner: {
    paddingBottom: 110, // leaves space above sticky footer
  },
  rowPad: { paddingHorizontal: 16 },

  // form
  label: { fontWeight: '700', marginTop: 10, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    marginBottom: 8,
  },

  roleRow: { flexDirection: 'row', gap: 8, marginBottom: 8, marginTop: 2 },
  rolePill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: '#fff',
  },

  // sticky footer
  footerBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
  },
  saveBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
});
