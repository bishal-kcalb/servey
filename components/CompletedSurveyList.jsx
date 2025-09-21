// components/CompletedSurveysList.js
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useTheme } from '../theme';
import { api } from '../api/client';
import { AuthService } from '../services/authService';
import { Feather } from '@expo/vector-icons';
import ScreenContainer from './ScreenContainer';

export default function CompletedSurveysList({
  title = 'Completed Surveys',
  searchPlaceholder = 'Search by survey title...',
  fetcher,             // optional: async () => items[]
  onOpen,              // required: (item) => void
  refreshKey,          // optional: rerun fetch when this changes
}) {
  const theme = useTheme();

  const [isAdmin, setIsAdmin] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');

  // Load role once
  useEffect(() => {
    (async () => {
      const profile = await AuthService.getProfile();
      setIsAdmin(String(profile?.role).toLowerCase() === 'admin');
    })();
  }, []);

  // Role-aware default fetcher (decide endpoint at fetch time)
  const defaultFetcher = useCallback(async () => {
    await AuthService.loadSession(); // ensure token header is set
    const endpoint = isAdmin ? '/admin/completed-surveys' : '/responses/me';
    const { data } = await api.get(endpoint);
    return Array.isArray(data?.items) ? data.items : [];
  }, [isAdmin]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const rows = await (fetcher ? fetcher() : defaultFetcher());
      setItems(rows);
    } catch (e) {
      console.error(e?.response?.data || e.message);
      Alert.alert('Error', e?.response?.data?.error || 'Failed to load completed surveys');
    } finally {
      setLoading(false);
    }
  }, [fetcher, defaultFetcher]);

  // Re-load when role resolves or refreshKey changes
  useEffect(() => { load(); }, [load, refreshKey, isAdmin]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter((it) =>
      String(it.survey_title || '').toLowerCase().includes(term)
    );
  }, [items, q]);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => onOpen && onOpen(item)}
    >
      <View style={styles.card}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1}>
            {item.survey_title}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>Total Responses: {item.answers_count ?? 0}</Text>
            <Text style={styles.dot}>•</Text>
          </View>
          <Text style={styles.meta}>
            Last submitted:{' '}
            {item.submitted_at ? new Date(item.submitted_at).toLocaleString() : '-'}
          </Text>
        </View>
        <Feather name="chevron-right" size={20} color="#9ca3af" />
      </View>
    </TouchableOpacity>
  );

  if (loading && items.length === 0) {
    return (
      <View style={[styles.loadingWrap, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScreenContainer>
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.header, { color: theme.colors.text }]}>{title}</Text>

        {/* Search */}
        <View style={styles.searchBox}>
          <Feather name="search" size={16} color="#9ca3af" />
          <TextInput
            placeholder={searchPlaceholder}
            placeholderTextColor="#9ca3af"
            value={q}
            onChangeText={setQ}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(it, idx) => `${it.survey_id}-${it.submitted_at || idx}`}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={
            !loading ? (
              <Text style={{ textAlign: 'center', color: '#6b7280', marginTop: 20 }}>
                {q ? 'No matches found.' : 'No submissions yet.'}
              </Text>
            ) : null
          }
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        />
      </View>
    </ScreenContainer>
  );
}

const CARD_RADIUS = 14;

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'left',
  },

  // search
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

  // card
  card: {
    backgroundColor: '#fff',
    borderRadius: CARD_RADIUS,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    marginBottom: 10,
  },
  title: { fontSize: 16, fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  meta: { fontSize: 12, color: '#6b7280' },
  dot: { color: '#9ca3af', marginHorizontal: 2 },

  // loading
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
