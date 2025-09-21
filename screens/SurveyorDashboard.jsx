// screens/SurveyorDashboard.js
import React, { useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image, // <-- add
} from 'react-native';
import { useTheme } from '../theme';
import {
  Feather,
  MaterialIcons,
  FontAwesome5,
  Ionicons,
  AntDesign,
} from '@expo/vector-icons';
import { api } from '../api/client';
import { AuthService } from '../services/authService';
import ScreenContainer from '../components/ScreenContainer';


const ASSIGNED_CACHE_KEY = 'assigned_surveys_v1';
const SURVEY_FULL_PREFIX = 'survey_full_';



export default function SurveyorDashboard({ navigation }) {
  const theme = useTheme();
  const [showModal, setShowModal] = useState(false);

  // REAL user
  const [user, setUser] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(''); // <-- new

  // dynamic data
  const [availableSurveys, setAvailableSurveys] = useState([]);
  const [recentResponses, setRecentResponses] = useState([]);

  // derived stats
  const [availableCount, setAvailableCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [responsesSum, setResponsesSum] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  /* ------------------------------ fetch profile ----------------------------- */
  const fetchUser = useCallback(async () => {
    try {
      const session = await AuthService.loadSession(); // { token, user }
      if (session?.user) {
        setUser(session.user);
        // if you ever store avatar_url with the user object in storage:
        if (session.user.avatar_url) setAvatarUrl(session.user.avatar_url);
      }

      // try to refine from backend
      try {
        const { data } = await api.get('/me/profile');
        const merged = { ...(session?.user || {}), ...(data?.user || {}) };
        setUser(merged);
        // pull avatar url from profile payload
        const remoteAvatar = data?.profile?.avatar_url || '';
        if (remoteAvatar) setAvatarUrl(remoteAvatar);
      } catch {
        // ignore if not available
      }
    } catch (e) {
      console.warn('Failed to load user', e?.message || e);
    }
  }, []);

  /* -------------------------------- fetchers -------------------------------- */
const fetchSurveys = useCallback(async () => {
  const session = await AuthService.loadSession();
  const surveyorId = session?.user?.id;

  // if you’re using JWT on backend, the id can be derived server-side from token;
  // the params are kept if your backend currently expects it.
  const net = await NetInfo.fetch();

  // If offline → read cache and return
  if (!net.isInternetReachable) {
    try {
      const raw = await AsyncStorage.getItem(ASSIGNED_CACHE_KEY);
      const cached = raw ? JSON.parse(raw) : [];
      const shaped = cached.map((s, idx) => ({
        id: String(s.id ?? idx),
        title: s.title ?? 'Untitled Survey',
        description: s.description ?? null,
        mins: s.estimatedMinutes ?? s.duration ?? null,
        difficulty: (s.priority ?? s.difficulty ?? 'Medium'),
        status: s.status ?? 'Active',
      }));
      setAvailableSurveys(shaped);
      setAvailableCount(shaped.filter(s => (s.status || '').toLowerCase() === 'active').length);
      return;
    } catch (e) {
      console.warn('Assigned cache read failed', e?.message || e);
      // fallthrough: nothing else to show
      setAvailableSurveys([]);
      setAvailableCount(0);
      return;
    }
  }

  // Online → fetch from API
  const { data } = await api.get('/survey/assigned', { params: { surveyorId } });
  const rows = Array.isArray(data) ? data : (Array.isArray(data?.surveys) ? data.surveys : []);
  const shaped = rows.map((s, idx) => ({
    id: String(s.id ?? idx),
    title: s.title ?? 'Untitled Survey',
    description: s.description ?? null,
    mins: s.estimatedMinutes ?? s.duration ?? null,
    difficulty: (s.priority ?? s.difficulty ?? 'Medium'),
    status: s.status ?? 'Active',
  }));

  setAvailableSurveys(shaped);
  setAvailableCount(shaped.filter(s => (s.status || '').toLowerCase() === 'active').length);

  // Save to cache for offline use
  try {
    await AsyncStorage.setItem(ASSIGNED_CACHE_KEY, JSON.stringify(rows));
  } catch (e) {
    console.warn('Assigned cache write failed', e?.message || e);
  }

  // OPTIONAL: prefetch & cache full surveys (so SurveyForm works offline immediately)
  try {
    await Promise.all(
      rows.map(async (s) => {
        try {
          const full = await api.get(`/survey/${s.id}/full`);
          await AsyncStorage.setItem(`${SURVEY_FULL_PREFIX}${s.id}`, JSON.stringify(full.data));
        } catch (e) {
          // don't block the rest
        }
      })
    );
  } catch {}
}, []);

  const fetchCompletedAndRecents = useCallback(async () => {
    await AuthService.loadSession();
    const { data } = await api.get('/responses/me');
    const items = Array.isArray(data?.items) ? data.items : [];

    setCompletedCount(items.length);
    const sum = items.reduce((acc, it) => acc + (Number(it.answers_count) || 0), 0);
    setResponsesSum(sum);

    const fromInline = items
      .map((it) => {
        const sub = it.last_submission || it.latest_submission || it.lastSubmission || null;
        if (!sub) return null;
        return {
          submissionId: String(sub.id),
          surveyId: String(it.survey_id ?? sub.survey_id ?? ''),
          surveyTitle: it.survey_title || sub.surveyTitle || '—',
          responser_name: sub.responser_name || sub.respondentName || '—',
          responser_location: sub.responser_location || sub.respondentLocation || '',
          responser_photo: sub.responser_photo || sub.photoUrl || '',
          responser_house_image_url: sub.responser_house_image_url || sub.houseImageUrl || '',
          created_at: sub.created_at || sub.createdAt || null,
        };
      })
      .filter(Boolean);

    const missing = items.filter(
      (it) => !fromInline.find(s => s && s.surveyId === String(it.survey_id))
    );

    const fetched = await Promise.all(
      missing.map(async (it) => {
        try {
          const res = await api.get(`/responses/survey/${it.survey_id}/mine?limit=1`);
          const subs = Array.isArray(res?.data?.submissions) ? res.data.submissions : [];
          const sub = subs[0];
          if (!sub) return null;
          return {
            submissionId: String(sub.id),
            surveyId: String(it.survey_id),
            surveyTitle: it.survey_title || '—',
            responser_name: sub.responser_name || '—',
            responser_location: sub.responser_location || '',
            responser_photo: sub.responser_photo || '',
            responser_house_image_url: sub.responser_house_image_url || '',
            created_at: sub.created_at || null,
          };
        } catch (e) {
          console.warn('fetch latest submission failed', e?.message || e);
          return null;
        }
      })
    );

    const all = [...fromInline, ...fetched.filter(Boolean)];
    all.sort((a, b) => {
      const ta = a?.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b?.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });

    const top3 = all.slice(0, 3).map((r, idx) => ({
      id: r.submissionId || String(idx),
      title: r.surveyTitle || '—',
      user: r.responser_name || '—',
      when: r.created_at ? new Date(r.created_at).toLocaleString() : '—',
      status: 'Completed',
      surveyId: r.surveyId,
      submissionId: r.submissionId,
      meta: {
        name: r.responser_name,
        location: r.responser_location,
        houseImageUrl: r.responser_house_image_url,
        photoUrl: r.responser_photo,
        createdAt: r.created_at,
      },
    }));

    setRecentResponses(top3);
  }, []);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([fetchUser(), fetchSurveys(), fetchCompletedAndRecents()]);
      setPendingCount(0);
    } catch (e) {
      console.error(e?.response?.data || e.message);
      Alert.alert('Error', e?.response?.data?.error || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [fetchUser, fetchSurveys, fetchCompletedAndRecents]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  // OPEN the modal only when avatar is touched
  const openLogoutModal = () => setShowModal(true);

  // Actually logout when user confirms
  const handleLogout = async () => {
    try {
      await AuthService.logout();
      setShowModal(false);
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (e) {
      setShowModal(false);
      Alert.alert('Error', 'Failed to logout. Please try again.');
    }
  };

  const statTiles = [
    {
      key: 'available',
      label: 'Available Surveys',
      value: availableCount,
      icon: <MaterialIcons name="assignment" size={22} color="#fff" />,
      bg: theme.colors.primary,
      onPress: () => navigation.navigate('Surveys'),
    },
    {
      key: 'completed',
      label: 'Completed',
      value: completedCount,
      icon: <AntDesign name="checkcircleo" size={20} color="#fff" />,
      bg: '#10b981',
      onPress: () => navigation.navigate('CompletedSurveys'),
    },
    {
      key: 'total',
      label: 'Total Responses',
      value: responsesSum,
      icon: <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />,
      bg: '#8b5cf6',
      onPress: () => navigation.navigate('CompletedSurveys'),
    },
    {
      key: 'pending',
      label: 'Pending',
      value: pendingCount,
      icon: <AntDesign name="clockcircleo" size={18} color="#fff" />,
      bg: '#f59e0b',
      onPress: () => navigation.navigate('Surveys'),
    },
  ];

  const startSurvey = (survey) => {
    navigation.navigate('SurveyForm', { surveyId: survey.id, surveyTitle: survey.title });
  };

  const viewRecent = (r) => {
    if (!r?.submissionId) return;
    navigation.navigate('SubmissionDetails', {
      submissionId: r.submissionId,
      surveyTitle: r.title,
      meta: r.meta || {},
    });
  };

  const firstName = user?.name?.trim()?.split(' ')?.[0] || 'there';

  return (
    <ScreenContainer>
      <View style={[styles.container]}>
        {/* Header */}
        <View style={styles.headerBar}>
          <View>
            <Text style={[styles.title, { color: theme.colors.text }]}>Surveyor Dashboard</Text>
            <Text style={styles.subtitle}>Welcome back, {firstName}</Text>
          </View>

          {/* Avatar (image if available, otherwise icon) */}
          <TouchableOpacity
            style={styles.avatar}
            onPress={openLogoutModal}
            accessibilityRole="button"
            accessibilityLabel="Open logout menu"
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
            ) : (
              <Feather name="user" size={22} color={theme.colors.primary} />
            )}
          </TouchableOpacity>
        </View>

        {loading && !refreshing ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator />
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            {/* Stat cards */}
            <View style={styles.statGrid}>
              {statTiles.map((s) => (
                <TouchableOpacity
                  key={s.key}
                  style={[styles.statCard, { backgroundColor: '#fff' }]}
                  activeOpacity={0.9}
                  onPress={s.onPress}
                >
                  <View style={[styles.statIconWrap, { backgroundColor: s.bg }]}>{s.icon}</View>
                  <Text style={[styles.statValue, { color: theme.colors.text }]}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Available Surveys */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Available Surveys</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Surveys')}>
                  <Text style={styles.viewAll}>View All</Text>
                </TouchableOpacity>
              </View>

              {availableSurveys.map((s) => (
                <View key={s.id} style={styles.listCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemTitle, { color: theme.colors.text }]} numberOfLines={1}>
                      {s.title}
                    </Text>
                    <View style={styles.metaRow}>
                      <Text style={styles.metaText}>
                        {s.description != null ? `${s.description} questions` : ''}{' '}
                        {s.mins != null ? ` • ${s.mins} min` : ''}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity style={styles.startBtn} onPress={() => startSurvey(s)}>
                    <FontAwesome5 name="play" size={12} color="#fff" />
                    <Text style={styles.startTxt}>Start</Text>
                  </TouchableOpacity>
                </View>
              ))}

              {availableSurveys.length === 0 && (
                <Text style={{ color: '#6b7280', textAlign: 'center', marginTop: 8 }}>
                  No surveys available.
                </Text>
              )}
            </View>

            {/* Recent Responses */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Recent Responses</Text>
                <TouchableOpacity onPress={() => navigation.navigate('CompletedSurveys')}>
                  <Text style={styles.viewAll}>View All</Text>
                </TouchableOpacity>
              </View>

              {recentResponses.map((r) => (
                <TouchableOpacity key={r.id} activeOpacity={0.9} onPress={() => viewRecent(r)}>
                  <View style={styles.listCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemTitle, { color: theme.colors.text }]} numberOfLines={1}>
                        {r.title}
                      </Text>
                      <Text style={styles.metaText}>
                        {r.user} • {r.when}
                      </Text>
                    </View>

                    <View style={styles.rightRow}>
                      <View
                        style={[
                          styles.statusPill,
                          String(r.status).toLowerCase() === 'completed'
                            ? styles.pillCompleted
                            : styles.pillPartial,
                        ]}
                      >
                        <Text style={styles.pillText}>{r.status}</Text>
                      </View>
                      <View style={styles.eyeBtn}>
                        <Feather name="eye" size={18} color="#111" />
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}

              {recentResponses.length === 0 && (
                <Text style={{ color: '#6b7280', textAlign: 'center', marginTop: 8 }}>
                  No recent responses.
                </Text>
              )}
            </View>
          </ScrollView>
        )}

        {/* Logout Modal */}
        <Modal
          visible={showModal}
          animationType="slide"
          transparent
          onRequestClose={() => setShowModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Logout?</Text>
              <Text style={styles.modalText}>Are you sure you want to log out?</Text>
              <View style={styles.modalButtons}>
                <Pressable onPress={() => setShowModal(false)} style={[styles.modalButton]}>
                  <Text>Cancel</Text>
                </Pressable>
                <Pressable onPress={handleLogout} style={[styles.modalButton, { backgroundColor: theme.colors.primary }]}>
                  <Text style={{ color: '#fff' }}>Logout</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </ScreenContainer>
  );
}

const CARD_RADIUS = 16;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 18,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 12,
    color: '#6b7280',
    textTransform: 'none',
  },
  avatar: {
    height: 36,
    width: 36,
    borderRadius: 18,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden', // to clip the image corners
  },
  avatarImg: {
    height: 36,
    width: 36,
    borderRadius: 18,
  },

  // stats
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  statCard: {
    width: '48%',
    padding: 16,
    borderRadius: CARD_RADIUS,
    shadowRadius: 8,
    marginBottom: 14,
    alignItems: 'center',
  },
  statIconWrap: {
    height: 34,
    width: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
  },

  section: {
    marginTop: 10,
  },
  sectionHeader: {
    paddingHorizontal: 2,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  viewAll: {
    fontSize: 12,
    color: '#6b6bff',
    fontWeight: '600',
  },

  listCard: {
    backgroundColor: '#fff',
    borderRadius: CARD_RADIUS,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    marginBottom: 10,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  metaRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metaText: {
    fontSize: 12,
    color: '#6b7280',
  },

  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#10b981',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginLeft: 12,
  },
  startTxt: { color: '#fff', fontWeight: '700', fontSize: 12, letterSpacing: 0.3 },

  rightRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillCompleted: { backgroundColor: '#e3fce9' },
  pillPartial: { backgroundColor: '#fef3c7' },
  pillText: { fontSize: 12, fontWeight: '700', color: '#0f5132' },
  eyeBtn: {
    backgroundColor: '#f3f4f6',
    height: 34,
    width: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    padding: 26,
  },
  modalBox: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 22,
    alignItems: 'center',
  },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  modalText: { fontSize: 14, color: '#6b7280', marginBottom: 16, textAlign: 'center' },
  modalButtons: { flexDirection: 'row', gap: 10 },
  modalButton: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10 },
});
