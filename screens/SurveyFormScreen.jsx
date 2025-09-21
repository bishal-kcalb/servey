// screens/SurveyFormScreen.js
import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { addPending, flushPending } from '../services/offlineQueue';

import {
  View, Text, ActivityIndicator, Alert, FlatList, StyleSheet,
  TextInput, TouchableOpacity, Image, Platform, ActionSheetIOS
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Audio, Video } from 'expo-av';
import { useTheme } from '../theme';
import { api } from '../api/client';
// import { uploadImage } from '../services/uploadService';
import { uploadImage, uploadAudio, uploadVideo } from '../services/uploadService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import ScreenContainer from '../components/ScreenContainer';



const SURVEY_FULL_PREFIX = 'survey_full_';

/* ----------------------------- media helpers ----------------------------- */
async function ensureMediaLibraryPermission() {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') throw new Error('Media library permission denied');
}
async function ensureCameraPermission() {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') throw new Error('Camera permission denied');
}
async function uploadMedia(uri, kind) {
  const lower = (uri || '').toLowerCase();
  let name = 'file', type = 'application/octet-stream';
  if (kind === 'audio') {
    if (lower.endsWith('.m4a')) { name = 'recording.m4a'; type = 'audio/m4a'; }
    else if (lower.endsWith('.mp3')) { name = 'recording.mp3'; type = 'audio/mpeg'; }
    else if (lower.endsWith('.caf')) { name = 'recording.caf'; type = 'audio/x-caf'; }
    else { name = 'recording.m4a'; type = 'audio/m4a'; }
  } else {
    if (lower.endsWith('.mp4')) { name = 'video.mp4'; type = 'video/mp4'; }
    else if (lower.endsWith('.mov')) { name = 'video.mov'; type = 'video/quicktime'; }
    else { name = 'video.mp4'; type = 'video/mp4'; }
  }
  const form = new FormData();
  form.append('file', { uri, name, type });
  const { data } = await api.post('/uploads', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  return data?.url;
}
async function pickOrCaptureAndUpload(source, setRemoteUrl, setLoadingFlag, setPreviewUri) {
  try {
    setLoadingFlag?.(true);
    if (source === 'gallery') {
      await ensureMediaLibraryPermission();
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsEditing: true,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0]; if (!asset?.uri) return;
      setPreviewUri(asset.uri);
      const remoteUrl = await uploadImage(asset.uri);
      setRemoteUrl(`${remoteUrl}?t=${Date.now()}`);
      return;
    }
    if (source === 'camera') {
      await ensureCameraPermission();
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsEditing: true,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0]; if (!asset?.uri) return;
      setPreviewUri(asset.uri);
      const remoteUrl = await uploadImage(asset.uri);
      setRemoteUrl(`${remoteUrl}?t=${Date.now()}`);
      return;
    }
  } catch (e) {
    console.warn('Image pick/upload error', e?.message || e);
    Alert.alert('Error', e?.message || 'Failed to pick or upload image');
  } finally {
    setLoadingFlag?.(false);
  }
}
/* ------------------------------------------------------------------------ */

export default function SurveyFormScreen({ route, navigation }) {
  const theme = useTheme();
  const COLORS = {
    primary: '#10b981',
    success: '#10b981',
    warn: '#f59e0b',
    danger: '#ef4444',
    text: theme?.colors?.text || '#111827',
    bg: theme?.colors?.background || '#f7f7fb',
    subtle: '#6b7280',
  };

  const surveyId = route?.params?.surveyId ?? route?.params?.survey?.id ?? null;
  const headerTitle = route?.params?.surveyTitle ?? route?.params?.survey?.title ?? 'Survey';
  const DRAFT_KEY = `draft_${surveyId}`;

  const [loading, setLoading] = useState(false);
  const [survey, setSurvey] = useState(null);
  const [err, setErr] = useState('');

  // uploads
  const [uploadingHouse, setUploadingHouse] = useState(false);
  const [uploadingPerson, setUploadingPerson] = useState(false);

  // respondent info
  const [respondentName, setRespondentName] = useState('');
  const [respondentLocation, setRespondentLocation] = useState('');
  const [gettingLoc, setGettingLoc] = useState(false);
  const [houseImageUrl, setHouseImageUrl] = useState('');
  const [personPhotoUrl, setPersonPhotoUrl] = useState('');
  const [housePreviewUri, setHousePreviewUri] = useState(null);
  const [personPreviewUri, setPersonPreviewUri] = useState(null);

  // answers
  const [answers, setAnswers] = useState({});
  const [recording, setRecording] = useState(null);
  const [audioUploadingQ, setAudioUploadingQ] = useState(null);
  const [videoUploadingQ, setVideoUploadingQ] = useState(null);

  const triedAutoLocRef = useRef(false);

  useEffect(() => { navigation.setOptions({ title: headerTitle }); }, [headerTitle, navigation]);

  /* ------------------------------ fetch survey ------------------------------ */
const fetchSurvey = useCallback(async () => {
  if (!surveyId) { setErr('No survey id provided'); return; }
  const cacheKey = `${SURVEY_FULL_PREFIX}${surveyId}`;

  try {
    setLoading(true);
    const net = await NetInfo.fetch();

    if (!net.isInternetReachable) {
      // OFFLINE → read cached full survey
      const raw = await AsyncStorage.getItem(cacheKey);
      if (!raw) throw new Error('No cached survey available offline');
      const data = JSON.parse(raw);
      setSurvey(data);

      // build initial answers state (same as your existing code)
      const init = {};
      for (const h of data.headings || []) {
        for (const q of h.questions || []) {
          init[q.id] = {
            type: q.type, is_required: !!q.is_required, is_composite: !!q.is_composite,
            text: '', yesNo: undefined, selected: new Set(), otherText: '', sub: {},
            audioUrl: '', videoUrl: '',
          };
          if (q.is_composite && Array.isArray(q.sub_questions)) {
            for (const sq of q.sub_questions) {
              init[q.id].sub[sq.id] = { type: sq.type, text: '', yesNo: undefined, selected: new Set(), otherText: '' };
            }
          }
        }
      }
      setAnswers(init);
      return;
    }

    // ONLINE → fetch and cache
    const { data } = await api.get(`/survey/${surveyId}/full`);
    setSurvey(data);

    try { await AsyncStorage.setItem(cacheKey, JSON.stringify(data)); } catch {}

    const init = {};
    for (const h of data.headings || []) {
      for (const q of h.questions || []) {
        init[q.id] = {
          type: q.type, is_required: !!q.is_required, is_composite: !!q.is_composite,
          text: '', yesNo: undefined, selected: new Set(), otherText: '', sub: {},
          audioUrl: '', videoUrl: '',
        };
        if (q.is_composite && Array.isArray(q.sub_questions)) {
          for (const sq of q.sub_questions) {
            init[q.id].sub[sq.id] = { type: sq.type, text: '', yesNo: undefined, selected: new Set(), otherText: '' };
          }
        }
      }
    }
    setAnswers(init);
  } catch (e) {
    console.error(e?.response?.data || e.message);
    const msg = e?.response?.data?.error || e.message || 'Failed to load survey';
    setErr(msg);
    Alert.alert('Error', msg);
  } finally {
    setLoading(false);
  }
}, [surveyId]);


  useEffect(() => { fetchSurvey(); }, [fetchSurvey]);

  /* ----------------------------- load draft (if any) ----------------------------- */
  const applyDraft = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      // rehydrate Sets
      const reAns = {};
      Object.entries(draft.answers || {}).forEach(([qid, a]) => {
        const sub = {};
        if (a.sub) {
          Object.entries(a.sub).forEach(([sqid, sa]) => {
            sub[sqid] = {
              ...sa,
              selected: new Set(sa.selected || []),
            };
          });
        }
        reAns[qid] = {
          ...a,
          selected: new Set(a.selected || []),
          sub,
        };
      });
      setRespondentName(draft.respondentName || '');
      setRespondentLocation(draft.respondentLocation || '');
      setHouseImageUrl(draft.houseImageUrl || '');
      setPersonPhotoUrl(draft.personPhotoUrl || '');
      setAnswers(prev => ({ ...prev, ...reAns }));
      Alert.alert('Draft loaded', 'We restored your previous progress.');
    } catch (e) {
      console.warn('Load draft failed', e?.message || e);
    }
  }, [DRAFT_KEY]);

  useEffect(() => {
    if (!survey) return;
    applyDraft();
  }, [survey, applyDraft]);

  /* ------------------------------ autofill location ------------------------------ */
  const fillCurrentLocation = useCallback(async () => {
    try {
      setGettingLoc(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation });
      let pretty = '';
      try {
        const places = await Location.reverseGeocodeAsync({ latitude: coords.latitude, longitude: coords.longitude });
        if (places?.length) {
          const p = places[0];
          pretty = [p.city || p.name, p.streetNumber, p.district, p.subregion, p.region, p.country]
            .filter(Boolean).join(', ');
        }
      } catch {}
      if (!pretty) pretty = `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
      setRespondentLocation(pretty);
    } finally { setGettingLoc(false); }
  }, []);

  useEffect(() => {
    if (!survey || triedAutoLocRef.current || respondentLocation?.trim()) return;
    triedAutoLocRef.current = true;
    (async () => { await fillCurrentLocation(); })();
  }, [survey, respondentLocation, fillCurrentLocation]);

  /* ------------------------------- state helpers ------------------------------ */
  const toggleCheckbox = (qid, optionId) => {
    setAnswers(prev => {
      const a = { ...prev }; const set = new Set(a[qid].selected);
      set.has(optionId) ? set.delete(optionId) : set.add(optionId);
      a[qid] = { ...a[qid], selected: set }; return a;
    });
  };
  const setOtherText = (qid, text) => setAnswers(prev => ({ ...prev, [qid]: { ...prev[qid], otherText: text } }));
  const setInputText = (qid, text) => setAnswers(prev => ({ ...prev, [qid]: { ...prev[qid], text } }));
  const setYesNo = (qid, val) => setAnswers(prev => ({ ...prev, [qid]: { ...prev[qid], yesNo: val } }));
  const setSubOtherText = (qid, subQid, text) =>
    setAnswers(prev => ({ ...prev, [qid]: { ...prev[qid], sub: { ...prev[qid].sub, [subQid]: { ...prev[qid].sub[subQid], otherText: text } } } }));
  const setSubInputText = (qid, subQid, text) =>
    setAnswers(prev => ({ ...prev, [qid]: { ...prev[qid], sub: { ...prev[qid].sub, [subQid]: { ...prev[qid].sub[subQid], text } } } }));
  const setSubYesNo = (qid, subQid, val) =>
    setAnswers(prev => ({ ...prev, [qid]: { ...prev[qid], sub: { ...prev[qid].sub, [subQid]: { ...prev[qid].sub[subQid], yesNo: val } } } }));

  /* --------------------------------- audio ---------------------------------- */
  const startRecording = useCallback(async (qid) => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission', 'Microphone permission is required.'); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      setRecording({ instance: rec, qid });
    } catch (e) {
      console.warn('startRecording error', e?.message || e); Alert.alert('Error', e?.message || 'Failed to start recording');
    }
  }, []);
  const stopAndUploadRecording = useCallback(async () => {
    if (!recording?.instance) return;
    try {
      setAudioUploadingQ(recording.qid);
      await recording.instance.stopAndUnloadAsync();
      const uri = recording.instance.getURI(); if (!uri) throw new Error('No audio file URI');
      // const remoteUrl = await uploadMedia(uri, 'audio');
      const remoteUrl = await uploadAudio(uri);
      setAnswers(prev => ({ ...prev, [recording.qid]: { ...prev[recording.qid], audioUrl: remoteUrl } }));
    } catch (e) {
      console.warn('stop/upload audio error', e?.message || e); Alert.alert('Error', e?.message || 'Failed to save recording');
    } finally { setRecording(null); setAudioUploadingQ(null); }
  }, [recording]);
  const playAudio = useCallback(async (uri) => {
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri });
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((st) => { if (st.isLoaded && st.didJustFinish) sound.unloadAsync(); });
    } catch (e) { console.warn('playAudio error', e?.message || e); }
  }, []);

  /* --------------------------------- video ---------------------------------- */
  const recordVideo = useCallback(async (qid) => {
    try {
      await ensureCameraPermission();
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Videos, quality: 1, videoMaxDuration: 60 });
      if (result.canceled) return; const asset = result.assets?.[0]; if (!asset?.uri) return;
      setVideoUploadingQ(qid);
      // const remoteUrl = await uploadMedia(asset.uri, 'video');
      const remoteUrl = await uploadVideo(asset.uri);
      setAnswers(prev => ({ ...prev, [qid]: { ...prev[qid], videoUrl: remoteUrl } }));
    } catch (e) { console.warn('recordVideo error', e?.message || e); Alert.alert('Error', e?.message || 'Failed to record video'); }
    finally { setVideoUploadingQ(null); }
  }, []);
  const pickVideo = useCallback(async (qid) => {
    try {
      await ensureMediaLibraryPermission();
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Videos, quality: 1 });
      if (result.canceled) return; const asset = result.assets?.[0]; if (!asset?.uri) return;
      setVideoUploadingQ(qid);
      const remoteUrl = await uploadMedia(asset.uri, 'video');
      setAnswers(prev => ({ ...prev, [qid]: { ...prev[qid], videoUrl: remoteUrl } }));
    } catch (e) { console.warn('pickVideo error', e?.message || e); Alert.alert('Error', e?.message || 'Failed to pick video'); }
    finally { setVideoUploadingQ(null); }
  }, []);

  /* ------------------------------ validation/map ----------------------------- */
  const validateRequired = useCallback(() => {
    const missing = [];
    for (const h of survey?.headings || []) {
      for (const q of h.questions || []) {
        const ans = answers[q.id];
        if (!ans || !q.is_required) continue;

        if (q.is_composite && Array.isArray(q.sub_questions)) {
          for (const sq of q.sub_questions) {
            const sa = ans.sub?.[sq.id];
            if (!sa) { missing.push(q.text + ' - ' + sq.label); continue; }
            if (sq.type === 'input') { if (!sa.text?.trim()) missing.push(q.text + ' - ' + sq.label); }
            else if (sq.type === 'yes_no') { if (typeof sa.yesNo !== 'boolean') missing.push(q.text + ' - ' + sq.label); }
            else if (sq.type === 'checkbox') { if (!sa.selected || sa.selected.size === 0) missing.push(q.text + ' - ' + sq.label); }
          }
          continue;
        }

        if (q.type === 'input') { if (!ans.text?.trim()) missing.push(q.text); }
        else if (q.type === 'yes_no') { if (typeof ans.yesNo !== 'boolean') missing.push(q.text); }
        else if (q.type === 'checkbox') { if (!ans.selected || ans.selected.size === 0) missing.push(q.text); }
        else if (q.type === 'audio') { if (!ans.audioUrl) missing.push(q.text); }
        else if (q.type === 'video') { if (!ans.videoUrl) missing.push(q.text); }
      }
    }
    return missing;
  }, [survey, answers]);

  const buildPayload = useCallback(() => {
    const rows = [];
    for (const h of survey?.headings || []) {
      for (const q of h.questions || []) {
        const ans = answers[q.id]; if (!ans) continue;
        if (q.is_composite && Array.isArray(q.sub_questions)) {
          for (const sq of q.sub_questions) {
            const sa = ans.sub?.[sq.id]; if (!sa) continue;
            if (sq.type === 'input') { if (sa.text?.trim()) rows.push({ question_id: q.id, sub_question_id: sq.id, custom_answer: sa.text.trim() }); }
            else if (sq.type === 'yes_no') { if (typeof sa.yesNo === 'boolean') rows.push({ question_id: q.id, sub_question_id: sq.id, custom_answer: sa.yesNo ? 'yes' : 'no' }); }
            else if (sq.type === 'checkbox') {
              if (sa.selected?.size > 0) { sa.selected.forEach(optId => rows.push({ question_id: q.id, sub_question_id: sq.id, selected_option_id: optId })); }
              if (sa.otherText?.trim()) rows.push({ question_id: q.id, sub_question_id: sq.id, custom_answer: sa.otherText.trim() });
            }
          } continue;
        }
        if (q.type === 'input') { if (ans.text?.trim()) rows.push({ question_id: q.id, custom_answer: ans.text.trim() }); }
        else if (q.type === 'yes_no') { if (typeof ans.yesNo === 'boolean') rows.push({ question_id: q.id, custom_answer: ans.yesNo ? 'yes' : 'no' }); }
        else if (q.type === 'checkbox') {
          if (ans.selected?.size > 0) ans.selected.forEach(optId => rows.push({ question_id: q.id, selected_option_id: optId }));
          if (ans.otherText?.trim()) rows.push({ question_id: q.id, custom_answer: ans.otherText.trim() });
        } else if (q.type === 'audio') { if (ans.audioUrl) rows.push({ question_id: q.id, audio_url: ans.audioUrl }); }
        else if (ans.videoUrl && q.type === 'video') { rows.push({ question_id: q.id, video_url: ans.videoUrl }); }
      }
    }
    return {
      responser: {
        name: respondentName || null,
        location: respondentLocation || null,
        house_image_url: houseImageUrl || null,
        photo_url: personPhotoUrl || null,
      },
      answers: rows
    };
  }, [survey, answers, respondentName, respondentLocation, houseImageUrl, personPhotoUrl]);

const submit = async () => {
  const missing = validateRequired();
  if (missing.length) {
    Alert.alert('Missing required', `Please answer:\n- ${missing.join('\n- ')}`);
    return;
  }

  const payload = buildPayload();

  try {
    const net = await NetInfo.fetch();
    // If offline → queue it and exit
    if (!net.isInternetReachable) {
      await addPending({ id: Date.now(), surveyId, payload });
      await AsyncStorage.removeItem(DRAFT_KEY);
      Alert.alert('Saved Offline', 'Submission queued and will sync when back online.');
      navigation.goBack();
      return;
    }

    // Online → try to submit immediately
    await api.post(`/survey/${surveyId}/answers`, payload);
    await AsyncStorage.removeItem(DRAFT_KEY);
    Alert.alert('Success', 'Responses submitted');
    navigation.goBack();
  } catch (e) {
    // Network/server failure → queue it as fallback
    try {
      await addPending({ id: Date.now(), surveyId, payload });
      await AsyncStorage.removeItem(DRAFT_KEY);
      Alert.alert('Saved to Queue', 'Could not submit now. It will auto-sync later.');
      navigation.goBack();

      // Optional: try a quick flush (in case it was a temporary hiccup)
      try { await flushPending(); } catch {}
    } catch {
      // If even queuing fails, show original error:
      Alert.alert('Error', e?.response?.data?.error || 'Failed to submit');
    }
  }
};


  // --- Image pickers (keep same functionality, new visual style uses same handlers) ---
  const chooseHouseImage = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Take Photo', 'Pick from Gallery'], cancelButtonIndex: 0 },
        (idx) => {
          if (idx === 1)
            pickOrCaptureAndUpload('camera', setHouseImageUrl, setUploadingHouse, setHousePreviewUri);
          if (idx === 2)
            pickOrCaptureAndUpload('gallery', setHouseImageUrl, setUploadingHouse, setHousePreviewUri);
        }
      );
    } else {
      Alert.alert('House Image', 'Choose a source', [
        { text: 'Camera',  onPress: () => pickOrCaptureAndUpload('camera',  setHouseImageUrl, setUploadingHouse, setHousePreviewUri) },
        { text: 'Gallery', onPress: () => pickOrCaptureAndUpload('gallery', setHouseImageUrl, setUploadingHouse, setHousePreviewUri) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const choosePersonPhoto = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Take Photo', 'Pick from Gallery'], cancelButtonIndex: 0 },
        (idx) => {
          if (idx === 1)
            pickOrCaptureAndUpload('camera', setPersonPhotoUrl, setUploadingPerson, setPersonPreviewUri);
          if (idx === 2)
            pickOrCaptureAndUpload('gallery', setPersonPhotoUrl, setUploadingPerson, setPersonPreviewUri);
        }
      );
    } else {
      Alert.alert('Respondent Photo', 'Choose a source', [
        { text: 'Camera',  onPress: () => pickOrCaptureAndUpload('camera',  setPersonPhotoUrl, setUploadingPerson, setPersonPreviewUri) },
        { text: 'Gallery', onPress: () => pickOrCaptureAndUpload('gallery', setPersonPhotoUrl, setUploadingPerson, setPersonPreviewUri) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  /* ----------------------------- draft save/restore ----------------------------- */
  const saveDraft = useCallback(async () => {
    try {
      // serialize Sets -> arrays
      const ser = {};
      Object.entries(answers).forEach(([qid, a]) => {
        const sub = {};
        if (a.sub) {
          Object.entries(a.sub).forEach(([sqid, sa]) => {
            sub[sqid] = {
              ...sa,
              selected: Array.from(sa.selected || []),
            };
          });
        }
        ser[qid] = {
          ...a,
          selected: Array.from(a.selected || []),
          sub,
        };
      });

      const payload = {
        surveyId,
        respondentName,
        respondentLocation,
        houseImageUrl,
        personPhotoUrl,
        answers: ser,
        savedAt: Date.now(),
      };

      await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
      Alert.alert('Saved', 'Draft saved on this device.');
    } catch (e) {
      console.warn('Save draft failed', e?.message || e);
      Alert.alert('Error', 'Could not save draft.');
    }
  }, [answers, DRAFT_KEY, surveyId, respondentName, respondentLocation, houseImageUrl, personPhotoUrl]);

  /* --------------------------- progress computation --------------------------- */
  const flatQuestions = useMemo(() => {
    if (!survey) return [];
    const list = [];
    for (const h of survey.headings || []) {
      for (const q of h.questions || []) list.push(q);
    }
    return list;
  }, [survey]);

  const isAnswered = useCallback((q, ans) => {
    if (!ans) return false;
    if (q.is_composite && Array.isArray(q.sub_questions)) {
      return q.sub_questions.some((sq) => {
        const sa = ans.sub?.[sq.id];
        if (!sa) return false;
        if (sq.type === 'input') return !!sa.text?.trim();
        if (sq.type === 'yes_no') return typeof sa.yesNo === 'boolean';
        if (sq.type === 'checkbox') return (sa.selected && sa.selected.size > 0) || !!sa.otherText?.trim();
        return false;
      });
    }
    if (q.type === 'input') return !!ans.text?.trim();
    if (q.type === 'yes_no') return typeof ans.yesNo === 'boolean';
    if (q.type === 'checkbox') return (ans.selected && ans.selected.size > 0) || !!ans.otherText?.trim();
    if (q.type === 'audio') return !!ans.audioUrl;
    if (q.type === 'video') return !!ans.videoUrl;
    return false;
  }, []);

  const progress = useMemo(() => {
    const total = flatQuestions.length;
    const answered = flatQuestions.reduce((acc, q) => acc + (isAnswered(q, answers[q.id]) ? 1 : 0), 0);
    const pct = total === 0 ? 0 : Math.round((answered / total) * 100);
    return { total, answered, pct };
  }, [flatQuestions, answers, isAnswered]);

  /* -------------------------------- UI bits -------------------------------- */
  const Pill = ({ active, label, onPress, tone = 'default' }) => {
    const bg =
      tone === 'danger' ? COLORS.danger :
      tone === 'success' ? COLORS.success :
      active ? COLORS.primary : '#eef2ff';
    const color = tone === 'danger' || tone === 'success' || active ? '#fff' : '#111827';
    return (
      <TouchableOpacity onPress={onPress} style={[styles.pill, { backgroundColor: bg }]}>
        <Text style={{ color, fontWeight: '700' }}>{label}</Text>
      </TouchableOpacity>
    );
  };

  const renderYesNo = (qid, val, setter) => (
    <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
      <Pill label="Yes" active={val === true} onPress={() => setter(qid, true)} />
      <Pill label="No"  active={val === false} onPress={() => setter(qid, false)} />
    </View>
  );

  const renderQuestion = (q) => {
    const ans = answers[q.id]; if (!ans) return null;

    // AUDIO
    if (q.type === 'audio') {
      const isRecordingThis = recording?.qid === q.id;
      const isUploadingThis = audioUploadingQ === q.id;
      return (
        <View key={q.id} style={styles.qCard}>
          <Text style={styles.qTitle}>
            {q.text} {q.is_required ? <Text style={{ color: COLORS.danger }}>*</Text> : null}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
            {!isRecordingThis ? (
              <Pill label="🎙 Start" onPress={() => startRecording(q.id)} />
            ) : (
              <Pill label="■ Stop & Upload" tone="danger" onPress={stopAndUploadRecording} />
            )}
            {isUploadingThis ? <ActivityIndicator /> : null}
            {!!ans.audioUrl && !isRecordingThis && !isUploadingThis && (
              <Pill label="▶ Play" onPress={() => playAudio(ans.audioUrl)} />
            )}
          </View>
          {!!ans.audioUrl && <Text style={styles.metaOk}>Uploaded ✓</Text>}
        </View>
      );
    }

    // VIDEO
    if (q.type === 'video') {
      const isUploadingThis = videoUploadingQ === q.id;
      return (
        <View key={q.id} style={styles.qCard}>
          <Text style={styles.qTitle}>
            {q.text} {q.is_required ? <Text style={{ color: COLORS.danger }}>*</Text> : null}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <Pill label="🎥 Record" onPress={() => recordVideo(q.id)} />
            <Pill label="📂 Pick" onPress={() => pickVideo(q.id)} />
            {isUploadingThis ? <ActivityIndicator /> : null}
          </View>
          {!!ans.videoUrl && !isUploadingThis && (
            <View style={{ marginTop: 10 }}>
              <Video source={{ uri: ans.videoUrl }} style={styles.video} useNativeControls resizeMode="contain" />
              <Text style={styles.metaOk}>Uploaded ✓</Text>
            </View>
          )}
        </View>
      );
    }

    // OTHER TYPES
    return (
      <View key={q.id} style={styles.qCard}>
        <Text style={styles.qTitle}>
          {q.text} {q.is_required ? <Text style={{ color: COLORS.danger }}>*</Text> : null}
        </Text>

        {q.type === 'input' && (
          <TextInput
            style={styles.input}
            placeholder="Type your answer"
            value={ans.text}
            onChangeText={(t) => setInputText(q.id, t)}
          />
        )}

        {q.type === 'yes_no' && renderYesNo(q.id, ans.yesNo, setYesNo)}

        {q.type === 'checkbox' && (
          <>
            {(q.options || []).map(opt => {
              const checked = ans.selected?.has(opt.id);
              return (
                <TouchableOpacity key={opt.id} onPress={() => toggleCheckbox(q.id, opt.id)} style={styles.row}>
                  <View style={[styles.checkbox, checked && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}>
                    {checked ? <Feather name="check" size={14} color="#fff" /> : null}
                  </View>
                  <Text style={{ color: COLORS.text }}>
                    {opt.option_text}{opt.is_other ? ' (Other)' : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {(() => {
              const otherOpt = (q.options || []).find(o => o.is_other);
              const otherSelected = otherOpt && ans.selected?.has(otherOpt.id);
              if (!otherOpt || !otherSelected) return null;
              return (
                <TextInput
                  style={[styles.input, { marginTop: 6 }]}
                  placeholder="Please specify"
                  value={ans.otherText}
                  onChangeText={(t) => setOtherText(q.id, t)}
                />
              );
            })()}
          </>
        )}

        {q.is_composite && Array.isArray(q.sub_questions) && q.sub_questions.length > 0 && (
          <View style={{ marginTop: 10 }}>
            {q.sub_questions.map(sq => {
              const sa = ans.sub?.[sq.id]; if (!sa) return null;
              return (
                <View key={sq.id} style={{ marginBottom: 10 }}>
                  <Text style={styles.subLabel}>{sq.label}</Text>
                  {sq.type === 'input' && (
                    <TextInput
                      style={styles.input}
                      placeholder="Type here"
                      value={sa.text}
                      onChangeText={(t) => setSubInputText(q.id, sq.id, t)}
                    />
                  )}
                  {sq.type === 'yes_no' && renderYesNo({ qid: q.id, subQid: sq.id }, sa.yesNo,
                    (_ids, val) => setSubYesNo(_ids.qid, _ids.subQid, val))}
                  {sq.type === 'checkbox' && (
                    <TextInput
                      style={styles.input}
                      placeholder="(Optional) Other"
                      value={sa.otherText}
                      onChangeText={(t) => setSubOtherText(q.id, sq.id, t)}
                    />
                  )}
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  const allQuestions = useMemo(() => {
    if (!survey) return [];
    const list = [];
    // Add a synthetic heading for respondent info to match question card styling
    list.push({ _heading: true, id: 'respondent-heading', title: 'Respondent Information' });
    list.push({ _respondentInfo: true, id: 'respondent-block' });

    for (const h of survey.headings || []) {
      list.push({ _heading: true, id: `h-${h.id}`, title: h.title });
      for (const q of h.questions || []) list.push(q);
    }
    return list;
  }, [survey]);

  if (!surveyId) {
    return <View style={[styles.center, { backgroundColor: COLORS.bg }]}><Text style={{ color: COLORS.danger }}>Cannot open survey: missing id.</Text></View>;
  }
  if (loading && !survey) {
    return <View style={[styles.center, { backgroundColor: COLORS.bg }]}><ActivityIndicator /></View>;
  }
  if (err && !survey) {
    return <View style={[styles.center, { backgroundColor: COLORS.bg }]}><Text style={{ color: COLORS.danger }}>{err}</Text></View>;
  }

  // Respondent Information block rendered as a question-style card for visual consistency
  const renderRespondentInfoCard = () => (
    <View style={styles.qCard}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <Feather name="user" size={16} color="#9ca3af" />
        <Text style={[styles.qTitle, { marginLeft: 6 }]}>Respondent Information</Text>
      </View>

      <Text style={styles.label}>Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your name"
        value={respondentName}
        onChangeText={setRespondentName}
      />

      <Text style={styles.label}>Location {gettingLoc ? '(getting...)' : ''}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="Enter your location"
          value={respondentLocation}
          onChangeText={setRespondentLocation}
        />
        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: '#eef2ff' }]} onPress={fillCurrentLocation}>
          <Feather name="map-pin" size={18} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* House image */}
      <Text style={styles.label}>House Image</Text>
      <TouchableOpacity style={styles.imagePicker} onPress={chooseHouseImage}>
        {uploadingHouse ? (
          <ActivityIndicator />
        ) : (housePreviewUri || houseImageUrl) ? (
          <Image source={{ uri: housePreviewUri || houseImageUrl }} style={styles.imagePreview} resizeMode="cover" />
        ) : (
          <View style={styles.pickerEmpty}>
            <MaterialCommunityIcons name="image-plus" size={22} color="#888" />
            <Text style={{ color: '#888', marginTop: 6 }}>Take photo or pick from gallery</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Person photo */}
      <Text style={styles.label}>Respondent Photo</Text>
      <TouchableOpacity style={styles.imagePicker} onPress={choosePersonPhoto}>
        {uploadingPerson ? (
          <ActivityIndicator />
        ) : (personPreviewUri || personPhotoUrl) ? (
          <Image source={{ uri: personPreviewUri || personPhotoUrl }} style={styles.imagePreview} resizeMode="cover" />
        ) : (
          <View style={styles.pickerEmpty}>
            <MaterialCommunityIcons name="account-box" size={22} color="#888" />
            <Text style={{ color: '#888', marginTop: 6 }}>Take photo or pick from gallery</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <ScreenContainer>
    <View style={[styles.container, { backgroundColor: COLORS.bg }]}>
      {/* Sticky progress at top */}
      <View style={[styles.progressWrap]}>
        <Text style={styles.progressText}>{progress.answered} of {progress.total} answered</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress.pct}%`, backgroundColor: COLORS.primary }]} />
        </View>
        <Text style={styles.progressPct}>{progress.pct}%</Text>
      </View>

      <FlatList
        data={allQuestions}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => {
          if (item._heading) {
            return (
              <View style={styles.headingWrap}>
                <Text style={[styles.heading, { color: COLORS.text }]}>{item.title}</Text>
              </View>
            );
          }
          if (item._respondentInfo) return renderRespondentInfoCard();
          return renderQuestion(item);
        }}
        contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 16, paddingTop: 56 }}
        ListHeaderComponent={
          <View style={{ paddingTop: 6 }}>
            <Text style={[styles.pageTitle, { color: COLORS.text }]}>{survey?.title || headerTitle}</Text>
            {survey?.description ? (
              <Text style={{ color: COLORS.subtle, marginBottom: 8 }}>{survey.description}</Text>
            ) : null}
          </View>
        }
      />

      {/* sticky footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={[styles.draftBtn, { borderColor: COLORS.primary }]} onPress={saveDraft}>
          <Text style={{ color: COLORS.primary, fontWeight: '700' }}>Save Draft</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.submitBtn, { backgroundColor: COLORS.primary }]} onPress={submit}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Submit</Text>
        </TouchableOpacity>
      </View>
    </View>
    </ScreenContainer>
  );
}

/* ----------------------------------- UI ----------------------------------- */
const RADIUS = 14;

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  pageTitle: { fontSize: 20, fontWeight: '800', marginBottom: 4 },

  headingWrap: { marginTop: 10, marginBottom: 6, paddingHorizontal: 2 },
  heading: { fontSize: 16, fontWeight: '700' },

  // unified question card (used for survey questions AND respondent info)
  qCard: {
    backgroundColor: '#fff',
    borderRadius: RADIUS,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  qTitle: { fontWeight: '700', marginBottom: 8 },

  metaOk: { marginTop: 6, color: '#4b5563' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 8 },
  checkbox: {
    width: 20, height: 20, borderRadius: 5,
    borderWidth: 1, borderColor: '#c7c7c7',
    alignItems: 'center', justifyContent: 'center',
  },

  input: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, marginTop: 6,
    backgroundColor: '#fff',
  },
  subLabel: { fontWeight: '600', marginBottom: 6, color: '#444' },

  pill: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 999, backgroundColor: '#eef2ff',
  },

  imagePicker: {
    height: 150, borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 12, marginTop: 6, marginBottom: 10, overflow: 'hidden',
    backgroundColor: '#fafafa', alignItems: 'center', justifyContent: 'center',
  },
  imagePreview: { width: '100%', height: '100%' },
  pickerEmpty: { alignItems: 'center', justifyContent: 'center' },

  iconBtn: {
    width: 44, height: 44, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },

  video: { width: '100%', height: 220, backgroundColor: '#000', borderRadius: 8 },

  /* Sticky top progress */
  progressWrap: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6,
    backgroundColor: 'rgba(247,247,251,0.96)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    zIndex: 5,
  },
  progressText: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  progressBar: {
    height: 8, borderRadius: 999, backgroundColor: '#eef2ff', overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 999 },
  progressPct: { fontSize: 11, color: '#6b7280', marginTop: 4 },

  /* Footer with buttons */
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    padding: 12, backgroundColor: 'rgba(255,255,255,0.98)',
    borderTopWidth: 1, borderTopColor: '#eee',
    flexDirection: 'row',
    gap: 10,
  },
  draftBtn: {
    flex: 1,
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: '#fff',
  },
  submitBtn: { flex: 1, alignItems: 'center', padding: 14, borderRadius: 10 },

  // labels (kept here for respondent info)
  label: { fontWeight: '700', marginTop: 10, marginBottom: 4, color: '#1f2937' },
});
