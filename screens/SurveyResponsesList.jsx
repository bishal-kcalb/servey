// screens/SurveyResponsesList.js
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useTheme } from '../theme';
import { api } from '../api/client';
import { AuthService } from '../services/authService';
import { Feather } from '@expo/vector-icons';
import ScreenContainer from '../components/ScreenContainer';

export default function SurveyResponsesList({ route, navigation }) {
  const theme = useTheme();
  const { surveyId, surveyTitle } = route.params || {};

  const [loading, setLoading] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [q, setQ] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  // Load role once
  useEffect(() => {
    (async () => {
      const profile = await AuthService.getProfile();
      setIsAdmin(String(profile?.role).toLowerCase() === 'admin');
    })();
  }, []);

  useEffect(() => {
    navigation.setOptions?.({ title: surveyTitle || 'Responses' });
  }, [navigation, surveyTitle]);

  const normalizeRows = (rows) =>
    rows.map((r) => ({
      id: r.id || r.submission_id, // unify id
      responser_name:
        r.responser_name || r.user?.name || r.user_name || 'Unnamed Respondent',
      responser_location: r.responser_location || '',
      responser_house_image_url: r.responser_house_image_url || '',
      responser_photo: r.responser_photo || '',
      created_at: r.created_at || r.submitted_at,
      _raw: r,
    }));

  const load = useCallback(async () => {
    if (!surveyId) {
      Alert.alert('Error', 'Missing survey id');
      return;
    }
    try {
      setLoading(true);
      await AuthService.loadSession(); // ensure token is applied

      // Use the REAL endpoints:
      // - Admin: GET /admin/responses?surveyId=123
      // - Surveyor: GET /responses/survey/:surveyId/mine
      let rows = [];
      if (isAdmin) {
        const { data } = await api.get('/admin/responses', { params: { surveyId } });
        rows = Array.isArray(data?.items) ? data.items : [];
      } else {
        const { data } = await api.get(`/responses/survey/${surveyId}/mine`);
        rows = Array.isArray(data?.submissions) ? data.submissions : [];
      }

      setSubmissions(normalizeRows(rows));
    } catch (e) {
      console.error(e?.response?.data || e.message);
      Alert.alert('Error', e?.response?.data?.error || 'Failed to load responses');
    } finally {
      setLoading(false);
    }
  }, [surveyId, isAdmin]);

  // Re-run after role resolves or surveyId changes
  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return submissions;
    return submissions.filter((it) => {
      const name = String(it.responser_name || '').toLowerCase();
      const loc = String(it.responser_location || '').toLowerCase();
      return name.includes(term) || loc.includes(term);
    });
  }, [submissions, q]);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() =>
        navigation.navigate(
          isAdmin ? 'SubmissionDetailsAdmin' : 'SubmissionDetailsInner',
          {
            submissionId: item.id,
            surveyTitle,
            meta: {
              name: item.responser_name,
              location: item.responser_location,
              houseImageUrl: item.responser_house_image_url,
              photoUrl: item.responser_photo,
              createdAt: item.created_at,
            },
          }
        )
      }
    >
      <View style={styles.card}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1}>
            {item.responser_name || 'Unnamed Respondent'}
          </Text>

          <View style={styles.metaRow}>
            {!!item.responser_location && (
              <>
                <Feather name="map-pin" size={12} color="#9ca3af" />
                <Text style={styles.meta} numberOfLines={1}>
                  {item.responser_location}
                </Text>
              </>
            )}
            <Feather name="clock" size={12} color="#9ca3af" />
            <Text style={styles.meta}>
              {item.created_at ? new Date(item.created_at).toLocaleString() : '-'}
            </Text>
          </View>
        </View>

        {!!item.responser_photo && (
          <Image source={{ uri: item.responser_photo }} style={styles.avatar} />
        )}
        <Feather name="chevron-right" size={20} color="#9ca3af" />
      </View>
    </TouchableOpacity>
  );

  if (loading && submissions.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScreenContainer>
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.header, { color: theme.colors.text }]}>
          {surveyTitle || 'Responses'}
        </Text>

        {/* Search (name or location) */}
        <View style={styles.searchBox}>
          <Feather name="search" size={16} color="#9ca3af" />
          <TextInput
            placeholder="Search by name or location..."
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
          keyExtractor={(it) => String(it.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={
            !loading ? (
              <Text style={{ textAlign: 'center', color: '#6b7280', marginTop: 20 }}>
                {q ? 'No matches found.' : 'No responses yet.'}
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { fontSize: 20, fontWeight: '800', marginBottom: 10, textAlign: 'left' },

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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  meta: { fontSize: 12, color: '#6b7280' },
  dot: { color: '#9ca3af', marginHorizontal: 2 },
  avatar: { width: 48, height: 48, borderRadius: 8, marginLeft: 6 },
});
