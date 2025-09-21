// screens/AdminDashboard.js
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Image,
} from 'react-native';
import { useTheme } from '../theme';
import {
  Feather,
  MaterialIcons,
  Ionicons,
  AntDesign,
} from '@expo/vector-icons';
import { BarChart, PieChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import { api } from '../api/client';
import { AuthService } from '../services/authService';

export default function AdminDashboard({ navigation }) {
  const theme = useTheme();
  const screenWidth = Dimensions.get('window').width - 40;

  // user + UI state
  const [user, setUser] = useState(null);
  const [showLogout, setShowLogout] = useState(false);

  // data state
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalSurveyors: 0,
    activeSurveys: 0,
    totalResponses: 0,
    completionRate: 0,
  });
  const [recentSurveys, setRecentSurveys] = useState([]);

  // chart state (preserves same chart props; just fed by backend now)
  const [barSeries, setBarSeries] = useState({
    labels: ['Cust. Sat.', 'Prod. Fdbk.', 'Market Res.'],
    datasets: [{ data: [45, 23, 67] }],
  });
  const [pieSeries, setPieSeries] = useState([
    { name: 'Yes', population: 55, color: '#4caf50', legendFontColor: '#333', legendFontSize: 12 },
    { name: 'No', population: 32, color: '#f44336', legendFontColor: '#333', legendFontSize: 12 },
    { name: 'Neutral', population: 13, color: '#ffc107', legendFontColor: '#333', legendFontSize: 12 },
  ]);

  /* ------------------------- profile + session load ------------------------- */
  const loadUser = useCallback(async () => {
    try {
      const session = await AuthService.loadSession(); // { token, user }
      let merged = session?.user || null;

      // Enrich from /me/profile if your backend has extra fields (like avatar_url)
      try {
        const { data } = await api.get('/me/profile');
        merged = { ...(session?.user || {}), ...(data?.user || {}) };
        // attach profile fields (avatar) if present
        if (data?.profile) merged.profile = data.profile;
      } catch {
        // ignore if endpoint not available
      }
      setUser(merged);
    } catch (e) {
      console.warn('loadUser failed', e?.message || e);
    }
  }, []);

  /* ----------------------------- stats + lists ------------------------------ */
  const loadStats = useCallback(async () => {
    try {
      setLoading(true);

      // 🔗 Use new Admin metrics endpoint
      const { data } = await api.get('/admin/metrics');

      // stats
      setStats({
        totalSurveyors: Number(data?.totalSurveyors ?? 0),
        activeSurveys: Number(data?.activeSurveys ?? 0),
        totalResponses: Number(data?.totalResponses ?? 0),
        completionRate: Number(data?.completionRate ?? 0),
      });

      // bar chart (already shaped as {labels, datasets:[{data:[]}]})
      if (data?.barData?.labels && data?.barData?.datasets) {
        setBarSeries(data.barData);
      }

      // recent surveys (adapt to current UI shape: id, title, count, status)
      const recent = Array.isArray(data?.recentSurveys) ? data.recentSurveys : [];
      setRecentSurveys(
        recent.map((s, idx) => ({
          id: String(s.id ?? idx),
          title: s.title ?? 'Untitled Survey',
          count: Number(s.responses ?? 0),
          status: s.status ?? 'Active',
        }))
      );
    } catch (e) {
      console.error(e?.response?.data || e.message);
      Alert.alert('Error', e?.response?.data?.error || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAnswerSplit = useCallback(async (surveyId) => {
    if (!surveyId) return;
    try {
      const { data } = await api.get('/admin/answer-distribution', {
        params: { surveyId },
      });
      const yes = Number(data?.yes ?? 0);
      const no = Number(data?.no ?? 0);
      const neutral = Number(data?.neutral ?? 0);
      setPieSeries([
        { name: 'Yes', population: yes, color: '#4caf50', legendFontColor: '#333', legendFontSize: 12 },
        { name: 'No', population: no, color: '#f44336', legendFontColor: '#333', legendFontSize: 12 },
        { name: 'Neutral', population: neutral, color: '#ffc107', legendFontColor: '#333', legendFontSize: 12 },
      ]);
    } catch (e) {
      console.warn('answer-distribution failed', e?.response?.data || e.message);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await loadUser();
      await loadStats();
    })();
  }, [loadUser, loadStats]);

  // hydrate pie chart with the most recent survey once recentSurveys arrive
  useEffect(() => {
    if (recentSurveys?.length > 0) {
      loadAnswerSplit(recentSurveys[0].id);
    }
  }, [recentSurveys, loadAnswerSplit]);

  /* -------------------------------- charts --------------------------------- */
  const barData = useMemo(() => barSeries, [barSeries]);

  const pieData = useMemo(() => pieSeries, [pieSeries]);

  const chartConfig = useMemo(
    () => ({
      backgroundGradientFrom: '#fff',
      backgroundGradientTo: '#fff',
      color: (o = 1) => `rgba(59, 59, 234, ${o})`,
      labelColor: (o = 1) => `rgba(0,0,0,${o})`,
      barPercentage: 0.6,
      decimalPlaces: 0,
    }),
    []
  );

  /* ------------------------- helpers / navigation fix ----------------------- */
  const goTo = (tabName, screenName, params) =>
    navigation.navigate(tabName, { screen: screenName, params });

  const firstName =
    user?.name?.trim()?.split(' ')?.[0] ||
    user?.email?.split('@')?.[0] ||
    'there';

  const avatarUrl =
    user?.profile?.avatar_url ||
    user?.avatar_url ||
    user?.avatar ||
    '';

  const onConfirmLogout = async () => {
    try {
      await AuthService.logout();
      setShowLogout(false);
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch {
      setShowLogout(false);
      Alert.alert('Error', 'Failed to logout. Please try again.');
    }
  };

  /* --------------------------------- UI ------------------------------------ */
  const StatCard = ({ icon, value, label, tint = '#3b3bea' }) => (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: tint }]}>{icon}</View>
      <View>
        <Text style={[styles.statValue, { color: theme.colors.text }]}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );

  return (
    <ScreenContainer>
      <View style={styles.wrap}>
        {/* Header (mirrors SurveyorDashboard) */}
        <View style={styles.headerBar}>
          <View>
            <Text style={[styles.title, { color: theme.colors.text }]}>Admin Dashboard</Text>
            <Text style={styles.subtitle}>Welcome back, {firstName}</Text>
          </View>

          {/* Avatar: tap to open logout modal; show image if available */}
          <TouchableOpacity
            onPress={() => setShowLogout(true)}
            style={styles.avatarBtn}
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

        {/* Body */}
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator />
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 28 }}
          >
            {/* Stats grid (2x2) */}
            <View style={styles.statsGrid}>
              <StatCard
                icon={<Feather name="users" size={18} color="#ffffff" />}
                value={stats.totalSurveyors}
                label="Total Surveyors"
              />
              <StatCard
                icon={<MaterialIcons name="assignment-turned-in" size={18} color="#ffffff" />}
                value={stats.activeSurveys}
                label="Active Surveys"
                tint="#10b981"
              />
              <StatCard
                icon={<Ionicons name="chatbubbles-outline" size={18} color="#ffffff" />}
                value={stats.totalResponses.toLocaleString()}
                label="Total Responses"
                tint="#8b5cf6"
              />
              <StatCard
                icon={<AntDesign name="piechart" size={16} color="#ffffff" />}
                value={`${stats.completionRate}%`}
                label="Completion Rate"
                tint="#f59e0b"
              />
            </View>

            {/* Quick Actions */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Quick Actions</Text>
              </View>

              <View style={styles.actionList}>
                {/* Manage Surveyors (tab + inner screen) */}
                <TouchableOpacity
                  style={styles.actionItem}
                  onPress={() => goTo('SurveyorsTab', 'AdminManageSurveyors')}
                  activeOpacity={0.9}
                >
                  <View style={[styles.actionIcon, { backgroundColor: '#635bff' }]}>
                    <Feather name="users" size={16} color="#fff" />
                  </View>
                  <Text style={styles.actionText}>Manage Surveyors</Text>
                </TouchableOpacity>

                {/* Manage Surveys */}
                <TouchableOpacity
                  style={[styles.actionItem, { backgroundColor: '#10b981' }]}
                  onPress={() => goTo('SurveysTab', 'AdminManageSurveys')}
                  activeOpacity={0.9}
                >
                  <View style={[styles.actionIcon, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                    <MaterialIcons name="edit" size={16} color="#fff" />
                  </View>
                  <Text style={[styles.actionText, { color: '#fff' }]}>Manage Surveys</Text>
                </TouchableOpacity>

                {/* View Reports */}
                <TouchableOpacity
                  style={styles.actionItem}
                  onPress={() => goTo('ReportsTab', 'AdminReports')}
                  activeOpacity={0.9}
                >
                  <View style={[styles.actionIcon, { backgroundColor: '#efefef' }]}>
                    <MaterialIcons name="bar-chart" size={16} color="#666" />
                  </View>
                  <Text style={styles.actionText}>View Reports</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionItem}
                  onPress={() => goTo('ResponsesTab', 'AdminCompletedList')}
                  activeOpacity={0.9}
                >
                  <View style={[styles.actionIcon, { backgroundColor: '#efefef' }]}>
                    <MaterialIcons name="bar-chart" size={16} color="#666" />
                  </View>
                  <Text style={styles.actionText}>All Responses</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Charts (kept) */}
            <View style={styles.card}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text, marginBottom: 10 }]}>
                Survey Participation
              </Text>
              <BarChart
                data={barData}
                width={screenWidth}
                height={220}
                chartConfig={chartConfig}
                fromZero
                showValuesOnTopOfBars
                style={styles.chart}
              />

              <Text style={[styles.sectionTitle, { color: theme.colors.text, marginTop: 10 }]}>
                Answer Distribution
              </Text>
              <PieChart
                data={pieData}
                width={screenWidth}
                height={180}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="15"
                chartConfig={chartConfig}
                style={{ marginTop: 6 }}
              />
            </View>

            {/* Recent Surveys */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Recent Surveys</Text>
              </View>

              {recentSurveys.map((s) => (
                <View key={s.id} style={styles.listCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.listTitle, { color: theme.colors.text }]} numberOfLines={1}>
                      {s.title}
                    </Text>
                    <Text style={styles.listSub}>{s.count} responses</Text>
                  </View>

                  <View style={styles.rightRow}>
                    <View
                      style={[
                        styles.pill,
                        String(s.status).toLowerCase() === 'completed'
                          ? styles.pillCompleted
                          : styles.pillActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          String(s.status).toLowerCase() === 'completed'
                            ? { color: '#111827' }
                            : { color: '#065f46' },
                        ]}
                      >
                        {s.status}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.eyeBtn}
                      onPress={() => goTo('ResponsesTab', 'ResponsesBySurveyAdmin', {
                        surveyId: s.id,
                        surveyTitle: s.title,
                        admin: true,
                      })}
                    >
                      <Feather name="eye" size={18} color="#4b5563" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              {recentSurveys.length === 0 && (
                <Text style={{ color: '#6b7280', textAlign: 'center', marginTop: 8 }}>
                  No recent surveys.
                </Text>
              )}
            </View>

            <View style={{ height: 30 }} />
          </ScrollView>
        )}

        {/* Logout Modal (same behavior as SurveyorDashboard) */}
        <Modal
          visible={showLogout}
          animationType="slide"
          transparent
          onRequestClose={() => setShowLogout(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Logout?</Text>
              <Text style={styles.modalText}>Are you sure you want to log out?</Text>
              <View style={styles.modalButtons}>
                <Pressable onPress={() => setShowLogout(false)} style={[styles.modalButton]}>
                  <Text>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={onConfirmLogout}
                  style={[styles.modalButton, { backgroundColor: theme.colors.primary }]}
                >
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

/* --------------------------------- styles ---------------------------------- */
const RADIUS = 16;

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 18 },

  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 6,
  },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { marginTop: 6, fontSize: 12, color: '#6b7280' },

  avatarBtn: {
    height: 36,
    width: 36,
    borderRadius: 18,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },

  // stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: RADIUS,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  statIcon: {
    height: 36,
    width: 36,
    borderRadius: 10,
    backgroundColor: '#3b3bea',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 12, color: '#6b7280' },

  // card & sections
  section: {
    backgroundColor: 'transparent',
    marginTop: 12,
  },
  sectionHeader: {
    paddingHorizontal: 2,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 16, fontWeight: '800' },

  card: {
    backgroundColor: '#fff',
    borderRadius: RADIUS,
    padding: 14,
    marginTop: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  chart: { borderRadius: 12 },

  // quick actions
  actionList: { marginTop: 10, gap: 12 },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e8e8e8',
  },
  actionIcon: {
    height: 26,
    width: 26,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { fontSize: 15, fontWeight: '600', color: '#111827' },

  // recent surveys list
  listCard: {
    marginTop: 10,
    backgroundColor: '#fff',
    borderRadius: RADIUS,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  listTitle: { fontSize: 15, fontWeight: '700' },
  listSub: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  rightRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  pillActive: { backgroundColor: '#e8fff4' },
  pillCompleted: { backgroundColor: '#eef2ff' },
  pillText: { fontSize: 12, fontWeight: '700' },

  eyeBtn: {
    height: 34,
    width: 34,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // logout modal
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
