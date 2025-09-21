import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/client';
import { onConnectivityChange, isOnline } from './connectivity';

const KEY = 'offline_queue_v1'; // holds { submissions:[], media:[] }

async function loadQueue() {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return { submissions: [], media: [] };
  try { return JSON.parse(raw); } catch { return { submissions: [], media: [] }; }
}
async function saveQueue(q) { await AsyncStorage.setItem(KEY, JSON.stringify(q)); }

export async function enqueueMedia(item) {
  // item: { id, surveyId, questionId, kind:'image'|'audio'|'video', localUri }
  const q = await loadQueue();
  // de-dupe by id
  if (!q.media.find(m => m.id === item.id)) q.media.push(item);
  await saveQueue(q);
}

export async function replaceMedia(id, patch) {
  const q = await loadQueue();
  q.media = q.media.map(m => (m.id === id ? { ...m, ...patch } : m));
  await saveQueue(q);
}

export async function removeMedia(id) {
  const q = await loadQueue();
  q.media = q.media.filter(m => m.id !== id);
  await saveQueue(q);
}

export async function enqueueSubmission(sub) {
  // sub: { id, surveyId, payloadWithLocalUris }  // we will mutate local URIs → remote URLs during sync
  const q = await loadQueue();
  if (!q.submissions.find(s => s.id === sub.id)) q.submissions.push(sub);
  await saveQueue(q);
}

export async function updateSubmission(id, patch) {
  const q = await loadQueue();
  q.submissions = q.submissions.map(s => (s.id === id ? { ...s, ...patch } : s));
  await saveQueue(q);
}

export async function removeSubmission(id) {
  const q = await loadQueue();
  q.submissions = q.submissions.filter(s => s.id !== id);
  await saveQueue(q);
}

/** Upload a single media file and return remote URL */
async function uploadOne({ localUri, kind }) {
  const lower = (localUri || '').toLowerCase();
  // Build multipart body (let Axios set boundary)
  const form = new FormData();

  let name = 'file';
  let type = 'application/octet-stream';
  if (kind === 'image') {
    if (lower.endsWith('.png')) { name = 'photo.png'; type = 'image/png'; }
    else if (lower.endsWith('.webp')) { name = 'photo.webp'; type = 'image/webp'; }
    else if (lower.endsWith('.heic') || lower.endsWith('.heif')) { name = 'photo.heic'; type = 'image/heic'; }
    else { name = 'photo.jpg'; type = 'image/jpeg'; }
  } else if (kind === 'audio') {
    if (lower.endsWith('.mp3')) { name='rec.mp3'; type='audio/mpeg'; }
    else if (lower.endsWith('.wav')) { name='rec.wav'; type='audio/wav'; }
    else if (lower.endsWith('.caf')) { name='rec.caf'; type='audio/x-caf'; }
    else { name='rec.m4a'; type='audio/m4a'; }
  } else {
    if (lower.endsWith('.mov')) { name='video.mov'; type='video/quicktime'; }
    else if (lower.endsWith('.m4v')) { name='video.m4v'; type='video/x-m4v'; }
    else { name='video.mp4'; type='video/mp4'; }
  }

  form.append('file', { uri: localUri, name, type });
  const { data } = await api.post('/uploads', form);
  if (!data?.url) throw new Error('Upload failed');
  return data.url;
}

/** Replace all local media in submissions with uploaded URLs */
function replaceLocalUrisInPayload(payload, urlMap) {
  // urlMap: { [localUri]: remoteUrl }
  const clone = JSON.parse(JSON.stringify(payload));
  // answers array can contain audio_url, video_url, or custom_answer; respondent fields can hold images
  if (clone?.responser) {
    if (clone.responser.house_image_url && urlMap[clone.responser.house_image_url]) {
      clone.responser.house_image_url = urlMap[clone.responser.house_image_url];
    }
    if (clone.responser.photo_url && urlMap[clone.responser.photo_url]) {
      clone.responser.photo_url = urlMap[clone.responser.photo_url];
    }
  }
  for (const row of clone.answers || []) {
    if (row.audio_url && urlMap[row.audio_url]) row.audio_url = urlMap[row.audio_url];
    if (row.video_url && urlMap[row.video_url]) row.video_url = urlMap[row.video_url];
    // (images inside answers not used here, but supported if you add later)
  }
  return clone;
}

/** Run sync now (uploads media first, then posts submissions). Safe to call often. */
export async function runSync() {
  if (!(await isOnline())) return;

  const q = await loadQueue();

  // 1) Upload every media that doesn't have a remoteUrl yet
  const urlMap = {}; // localUri -> remoteUrl
  for (const m of q.media) {
    if (m.remoteUrl) { urlMap[m.localUri] = m.remoteUrl; continue; }
    try {
      const url = await uploadOne(m);
      urlMap[m.localUri] = url;
      await replaceMedia(m.id, { remoteUrl: url });
    } catch (e) {
      // Keep it in the queue; next sync will retry
      console.warn('media upload failed, will retry:', m.localUri, e?.message || e);
    }
  }

  // Reload queue to see updated media with remoteUrl
  const q2 = await loadQueue();

  // 2) For each submission: if all of its local URIs are uploaded, patch and POST it
  for (const sub of q2.submissions) {
    try {
      // Collect local URIs present in this submission
      const neededLocalUris = new Set();
      const payload = sub.payloadWithLocalUris;

      if (payload?.responser?.house_image_url) neededLocalUris.add(payload.responser.house_image_url);
      if (payload?.responser?.photo_url) neededLocalUris.add(payload.responser.photo_url);
      for (const row of payload?.answers || []) {
        if (row.audio_url) neededLocalUris.add(row.audio_url);
        if (row.video_url) neededLocalUris.add(row.video_url);
      }

      // Check all exist in urlMap or in media queue records
      let allUploaded = true;
      for (const lu of neededLocalUris) {
        const mapped = urlMap[lu] || q2.media.find(m => m.localUri === lu)?.remoteUrl;
        if (!mapped) { allUploaded = false; break; }
      }
      if (!allUploaded) continue; // wait for next run

      // Patch payload with remote URLs
      const fullMap = {};
      for (const lu of neededLocalUris) {
        fullMap[lu] = urlMap[lu] || q2.media.find(m => m.localUri === lu)?.remoteUrl;
      }
      const finalPayload = replaceLocalUrisInPayload(payload, fullMap);

      // Post answers
      await api.post(`/survey/${sub.surveyId}/answers`, finalPayload);

      // Remove submission and any media that belong exclusively to it
      await removeSubmission(sub.id);
      // (We keep media items because other submissions might reference same localUri.
      // You can GC media if no submission references their localUri anymore.)
    } catch (e) {
      console.warn('submission sync failed, will retry:', sub.id, e?.message || e);
    }
  }
}

/** Start background listener */
let unsub = null;
export function startOfflineSync() {
  if (unsub) return;
  unsub = onConnectivityChange(async ({ isOnline }) => {
    if (isOnline) {
      try { await runSync(); } catch (e) { /* ignore */ }
    }
  });
}

export async function stopOfflineSync() {
  if (unsub) { unsub(); unsub = null; }
}
