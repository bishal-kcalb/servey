// screens/SurveyListScreen.js
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
} from 'react-native';
import { useTheme } from '../theme';
import { api } from '../api/client';
import { Feather, Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import ScreenContainer from '../components/ScreenContainer';
import { AuthService } from '../services/authService';

export default function SurveyListScreen({ navigation }) {
  const theme = useTheme();
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // UI state
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('All'); // 'All' | 'Active'

  const fetchSurveys = useCallback(async () => {
    try {
      setLoading(true);
        const session = await AuthService.loadSession(); // { token, user }
        const surveyorId = session?.user?.id;
      const { data } = await api.get('/survey/assigned',{params:{surveyorId}});
      const normalized = Array.isArray(data) ? data : Array.isArray(data?.surveys) ? data.surveys : [];
      // Normalize + safe fallbacks so the UI can show meta rows/badges
      const shaped = normalized.map((s, idx) => ({
        id: String(s.id ?? idx),
        title: s.title ?? 'Untitled Survey',
        description: s.description ?? s.subtitle ?? '—',
        minutes: s.estimatedMinutes ?? s.duration ?? null,
        questions: s.questionsCount ?? s.questions?.length ?? null,
        difficulty: (s.priority ?? s.difficulty ?? 'Medium'), // High | Medium | Low
        status: (s.status ?? 'Active'),                        // Active | Completed
        deadline: s.created_at ?? null,
      }));

      setSurveys(shaped);
    } catch (e) {
      console.error(e?.response?.data || e.message);
      Alert.alert('Error', e?.response?.data?.error || 'Failed to load surveys');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSurveys();
  }, [fetchSurveys]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSurveys();
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    const base = filter === 'Active' ? surveys.filter(s => s.status === 'Active') : surveys;
    const qq = q.trim().toLowerCase();
    if (!qq) return base;
    return base.filter(s =>
      s.title.toLowerCase().includes(qq) ||
      (s.description || '').toLowerCase().includes(qq)
    );
  }, [surveys, q, filter]);

  // Summary counters
  const counts = useMemo(() => {
    const active = surveys.filter(s => s.status === 'Active').length;
    const completed = surveys.filter(s => s.status === 'Completed').length;
    const high = surveys.filter(s => String(s.difficulty).toLowerCase() === 'high').length;
    return { active, completed, high };
  }, [surveys]);

  const handlePress = (item) => {
    navigation.navigate('SurveyForm', { surveyId: item.id, title: item.title });
  };

 

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      {/* Title row */}
      <View style={styles.titleRow}>
        <Text style={[styles.cardTitle, { color: theme.colors.text }]} numberOfLines={1}>
          {item.title}
        </Text>
      </View>

      {/* Description */}
      <Text style={styles.desc} numberOfLines={2}>
        {item.description}
      </Text>
      
      {/* Meta + Actions */}
      <View style={styles.metaRow}>
        <View style={styles.metaLeft}>
          <View style={styles.metaChip}>
            <MaterialCommunityIcons name="clock-outline" size={14} color="#6b7280" />
            
          {!!item.deadline && (
            <Text style={[styles.deadlineText]}>Created: {String(item.deadline).slice(0, 10)}</Text>
          )}
          </View>
        </View>

        <View style={styles.metaRight}>
          
          <TouchableOpacity style={styles.startBtn} onPress={() => handlePress(item)}>
            <FontAwesome5 name="play" size={12} color="#fff" />
            <Text style={styles.startTxt}>Start</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (loading && !refreshing && surveys.length === 0) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (

    <ScreenContainer>
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header + filter pills */}
      <View style={styles.headerRow}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Available Surveys</Text>
        <View style={styles.filterRow}>
          {['All'].map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              style={[styles.filterPill, filter === f && styles.filterPillActive]}
            >
              <Text style={[styles.filterTxt, filter === f && styles.filterTxtActive]}>
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <Feather name="search" size={16} color="#9ca3af" />
        <TextInput
          placeholder="Search surveys..."
          placeholderTextColor="#9ca3af"
          value={q}
          onChangeText={setQ}
          style={styles.searchInput}
        />
      </View>

      {/* Summary chips */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{counts.active}</Text>
          <Text style={styles.summaryLabel}>Active</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{counts.completed}</Text>
          <Text style={styles.summaryLabel}>Completed</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{counts.high}</Text>
          <Text style={styles.summaryLabel}>High Priority</Text>
        </View>
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <Text style={{ color: '#6b7280', textAlign: 'center', marginTop: 40 }}>
            No surveys found.
          </Text>
        }
      />
    </View>
    </ScreenContainer>
  );
}

const RADIUS = 14;

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
  },
  filterPillActive: { backgroundColor: '#111827' },
  filterTxt: { fontSize: 12, color: '#111827' },
  filterTxtActive: { color: '#fff', fontWeight: '700' },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },

  },
  searchInput: { flex: 1, fontSize: 14, color: '#111827' },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryCard: {
    width: '32%',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  
  },
  summaryValue: { fontSize: 18, fontWeight: '800', color: '#3b3bea' },
  summaryLabel: { fontSize: 12, color: '#6b7280', marginTop: 6 },

  card: {
    backgroundColor: '#fff',
    borderRadius: RADIUS,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
   
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  desc: { marginTop: 6, fontSize: 13, color: '#6b7280' },

  metaRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaLeft: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12, color: '#6b7280' },
  deadlineText: { fontSize: 12, color: '#6b7280' },

  metaRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  // badges / pills
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 11, color: '#fff', fontWeight: '700' },
  badgeHigh: { backgroundColor: '#ef4444' },
  badgeMed: { backgroundColor: '#6366f1' },
  badgeLow: { backgroundColor: '#10b981' },

  statusPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  pillActive: { backgroundColor: '#3b3bea' },
  pillCompleted: { backgroundColor: '#e5e7eb' },
  pillText: { fontSize: 12, fontWeight: '700' },

  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#10b981',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  startTxt: { color: '#fff', fontWeight: '700', fontSize: 12, letterSpacing: 0.3 },
});
