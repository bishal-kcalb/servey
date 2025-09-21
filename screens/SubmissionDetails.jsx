// screens/SubmissionDetails.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  TouchableOpacity,
  Modal,
  Pressable,
  Platform,
  ScrollView as RNScrollView,
} from 'react-native';
import { useTheme } from '../theme';
import { api } from '../api/client';
import { AuthService } from '../services/authService';
import { Audio, Video } from 'expo-av';
import { Feather } from '@expo/vector-icons';
import ScreenContainer from '../components/ScreenContainer';

/* --------- Small inline audio player (replay-friendly) ---------- */
function AudioPlayer({ uri }) {
  const soundRef = useRef(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch (e) {
        console.warn('Audio mode error:', e?.message || e);
      }
    })();
  }, []);

  const loadIfNeeded = useCallback(async () => {
    if (soundRef.current) return;
    setLoading(true);
    setError(null);
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: false, progressUpdateIntervalMillis: 250 },
        (s) => {
          setStatus(s);
          if (s.didJustFinish && !s.isLooping && soundRef.current) {
            soundRef.current.setPositionAsync(0);
          }
        }
      );
      soundRef.current = sound;
    } catch (e) {
      console.warn('Failed to load audio', e?.message || e);
      setError('Unable to load audio');
    } finally {
      setLoading(false);
    }
  }, [uri]);

  const toggle = useCallback(async () => {
    await loadIfNeeded();
    const snd = soundRef.current;
    if (!snd) return;
    try {
      const s = await snd.getStatusAsync();
      if (!s.isLoaded) return;
      if (s.isPlaying) {
        await snd.pauseAsync();
      } else {
        if (typeof s.durationMillis === 'number' && s.positionMillis >= s.durationMillis - 50) {
          await snd.setPositionAsync(0);
        }
        await snd.playAsync();
      }
    } catch (e) {
      console.warn('toggle play error', e?.message || e);
      setError('Playback error');
    }
  }, [loadIfNeeded]);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    };
  }, []);

  const playing = !!status?.isPlaying;

  return (
    <View style={styles.audioRow}>
      <TouchableOpacity style={styles.audioBtn} onPress={toggle} disabled={loading || !!error}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.audioBtnText}>{playing ? 'Pause' : status?.didJustFinish ? 'Replay' : 'Play'}</Text>
        )}
      </TouchableOpacity>
      <Text numberOfLines={1} style={styles.audioUri}>
        {error ? error : 'Audio'}
      </Text>
    </View>
  );
}
/* --------------------------------------------------------------- */

export default function SubmissionDetails({ route, navigation }) {
  const theme = useTheme();
  const { submissionId, surveyTitle, meta } = route.params || {};

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);

  // image preview modal state
  const [previewUri, setPreviewUri] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: surveyTitle || 'Submission' });
  }, [navigation, surveyTitle]);

  const openPreview = (uri, title = 'Preview') => {
    if (!uri) return;
    setPreviewUri(uri);
    setPreviewTitle(title);
    setPreviewOpen(true);
  };
  const closePreview = () => {
    setPreviewOpen(false);
    setPreviewUri('');
    setPreviewTitle('');
  };

  const load = useCallback(async () => {
    if (!submissionId) {
      Alert.alert('Error', 'Missing submission id');
      return;
    }
    try {
      setLoading(true);
      await AuthService.loadSession();
      const { data } = await api.get(`/responses/submission/${submissionId}`);
      setRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (e) {
      console.error(e?.response?.data || e.message);
      Alert.alert('Error', e?.response?.data?.error || 'Failed to load submission details');
    } finally {
      setLoading(false);
    }
  }, [submissionId]);

  useEffect(() => {
    load();
  }, [load]);

  // group rows by question
  const grouped = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      if (!map.has(r.question_id)) {
        map.set(r.question_id, {
          question_id: r.question_id,
          question_text: r.question_text,
          question_type: r.question_type,
          items: [],
        });
      }
      map.get(r.question_id).items.push(r);
    }
    return Array.from(map.values());
  }, [rows]);

  if (loading && rows.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScreenContainer>
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 20 }}>
        {/* Title */}
        <Text style={[styles.pageTitle, { color: theme.colors.text }]}>
          {surveyTitle || 'Submission'}
        </Text>

        {/* Respondent meta card */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Feather name="user" size={16} color="#9ca3af" />
            <Text style={styles.cardTitle}> Respondent</Text>
          </View>

          {!!meta?.name && (
            <View style={styles.metaRow}>
              <Feather name="id-card" size={14} color="#9ca3af" />
              <Text style={styles.metaText}>{meta.name}</Text>
            </View>
          )}
          {!!meta?.location && (
            <View style={styles.metaRow}>
              <Feather name="map-pin" size={14} color="#9ca3af" />
              <Text style={styles.metaText}>{meta.location}</Text>
            </View>
          )}
          {!!meta?.createdAt && (
            <View style={styles.metaRow}>
              <Feather name="clock" size={14} color="#9ca3af" />
              <Text style={styles.metaText}>{new Date(meta.createdAt).toLocaleString()}</Text>
            </View>
          )}

          {(!!meta?.photoUrl || !!meta?.houseImageUrl) && (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              {!!meta?.photoUrl && (
                <TouchableOpacity onPress={() => openPreview(meta.photoUrl, 'Respondent Photo')}>
                  <Image source={{ uri: meta.photoUrl }} style={styles.thumb} />
                </TouchableOpacity>
              )}
              {!!meta?.houseImageUrl && (
                <TouchableOpacity onPress={() => openPreview(meta.houseImageUrl, 'House Image')}>
                  <Image source={{ uri: meta.houseImageUrl }} style={styles.thumb} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Questions & Answers */}
        {grouped.map((q) => (
          <View key={q.question_id} style={styles.qCard}>
            <Text style={[styles.question, { color: theme.colors.text }]}>{q.question_text}</Text>

            {q.items.map((r) => {
              const textParts = [];
              if (r.selected_option_text) textParts.push(r.selected_option_text);
              if (r.custom_answer) textParts.push(r.custom_answer);
              if (r.sub_question_label) textParts.unshift(`[${r.sub_question_label}]`);

              // Optional image support if your backend sends image_url/photo_url in rows
              const imageUri = r.image_url || r.photo_url || null;

              return (
                <View key={r.response_id} style={styles.answerWrap}>
                  {textParts.length > 0 && <Text style={styles.answer}>- {textParts.join(' / ')}</Text>}

                  {!!imageUri && (
                    <TouchableOpacity
                      style={{ marginTop: 8 }}
                      onPress={() => openPreview(imageUri, 'Image')}
                      activeOpacity={0.9}
                    >
                      <Image source={{ uri: imageUri }} style={styles.inlineImage} />
                    </TouchableOpacity>
                  )}

                  {!!r.audio_url && (
                    <View style={{ marginTop: 8 }}>
                      <AudioPlayer uri={r.audio_url} />
                    </View>
                  )}

                  {!!r.video_url && (
                    <View style={{ marginTop: 10 }}>
                      <Video
                        source={{ uri: r.video_url }}
                        style={styles.video}
                        useNativeControls
                        resizeMode="contain"
                        shouldPlay={false}
                      />
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ))}

        {!loading && rows.length === 0 && (
          <Text style={{ textAlign: 'center', color: '#6b7280', marginTop: 20 }}>
            No details for this submission.
          </Text>
        )}
      </ScrollView>

      {/* Image Preview Modal */}
      <Modal
        visible={previewOpen}
        animationType="fade"
        transparent
        onRequestClose={closePreview}
      >
        <Pressable style={styles.previewBackdrop} onPress={closePreview}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewTitle} numberOfLines={1}>{previewTitle}</Text>
            <TouchableOpacity onPress={closePreview} style={styles.closeBtn}>
              <Feather name="x" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Simple zoom on iOS; Android will center-fit (no pinch zoom by default) */}
          <RNScrollView
            style={styles.previewBody}
            contentContainerStyle={styles.previewBodyContent}
            maximumZoomScale={3}
            minimumZoomScale={1}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            centerContent
          >
            {!!previewUri && (
              <Image
                source={{ uri: previewUri }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            )}
          </RNScrollView>
        </Pressable>
      </Modal>
    </View>
    </ScreenContainer>
  );
}

const CARD_RADIUS = 14;

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  pageTitle: { fontSize: 20, fontWeight: '800', marginBottom: 10 },

  // generic card
  card: {
    backgroundColor: '#fff',
    borderRadius: CARD_RADIUS,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },

  },
  cardTitle: { fontSize: 15, fontWeight: '800', marginLeft: 6 },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  metaText: { fontSize: 13, color: '#6b7280' },

  thumb: { width: 64, height: 64, borderRadius: 10, backgroundColor: '#eee' },

  // Q&A card
  qCard: {
    backgroundColor: '#fff',
    borderRadius: CARD_RADIUS,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },

  },
  question: { fontSize: 15, fontWeight: '800', marginBottom: 8 },
  answerWrap: { marginBottom: 8 },
  answer: { fontSize: 14, color: '#374151' },

  inlineImage: {
    width: '100%',
    height: 220,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
  },

  // audio
  audioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  audioBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  audioBtnText: { color: '#fff', fontWeight: '700' },
  audioUri: { color: '#6b7280', flex: 1 },

  // video
  video: {
    width: '100%',
    height: 220,
    backgroundColor: '#000',
    borderRadius: 10,
  },

  // preview modal
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    paddingTop: Platform.select({ ios: 44, android: 24 }),
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
    justifyContent: 'space-between',
  },
  previewTitle: { color: '#fff', fontSize: 14, fontWeight: '700', flex: 1 },
  closeBtn: {
    marginLeft: 12,
    padding: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  previewBody: { flex: 1 },
  previewBodyContent: { alignItems: 'center', justifyContent: 'center', minHeight: '100%' },
  previewImage: { width: '100%', height: '100%' },
});
