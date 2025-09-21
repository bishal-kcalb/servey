// services/uploadService.js
import { api } from '../api/client';

// Build an absolute URL if server returns a relative path
function toAbsoluteUrl(u) {
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  const base = (api?.defaults?.baseURL || '').replace(/\/+$/, '');
  const path = String(u).startsWith('/') ? u : `/${u}`;
  return `${base}${path}`;
}

function guessMime(uri, fallback = 'application/octet-stream') {
  const u = (uri || '').toLowerCase();
  if (u.endsWith('.jpg') || u.endsWith('.jpeg')) return 'image/jpeg';
  if (u.endsWith('.png')) return 'image/png';
  if (u.endsWith('.gif')) return 'image/gif';
  if (u.endsWith('.webp')) return 'image/webp';
  if (u.endsWith('.heic')) return 'image/heic';
  if (u.endsWith('.heif')) return 'image/heif';
  if (u.endsWith('.mp4')) return 'video/mp4';
  if (u.endsWith('.mov')) return 'video/quicktime';
  if (u.endsWith('.m4a')) return 'audio/m4a';
  if (u.endsWith('.mp3')) return 'audio/mpeg';
  if (u.endsWith('.caf')) return 'audio/x-caf';
  return fallback;
}

function fileNameFrom(uri, fallback = 'file.bin') {
  try {
    const last = uri.split(/[\\/]/).pop() || fallback;
    return last.includes('.') ? last : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Generic single-file uploader. The server must accept field name "file"
 * and return { url: "/uploads/xyz.jpg" } or { url: "https://..." }.
 * DO NOT set Content-Type manually; axios will add the proper boundary.
 */
async function uploadFileAny(asset, kind = 'image') {
  const uri = typeof asset === 'string' ? asset : asset?.uri;
  if (!uri) throw new Error('Missing file uri');

  // Prefer explicit mime/name from the picker if available
  const type =
    (typeof asset === 'object' && (asset.mimeType || asset.type)) ||
    guessMime(uri, kind === 'image' ? 'image/jpeg' : kind === 'audio' ? 'audio/m4a' : 'video/mp4');

  const name =
    (typeof asset === 'object' && (asset.fileName || asset.name)) ||
    fileNameFrom(uri, kind === 'image' ? 'image.jpg' : kind === 'audio' ? 'recording.m4a' : 'video.mp4');

  const form = new FormData();
  form.append('file', { uri, name, type });

  // Important: don't pass Content-Type header – let axios set the boundary.
  const { data } = await api.post('/uploads', form);

  if (!data?.url) throw new Error('Upload failed: no url');
  return toAbsoluteUrl(data.url);
}

// Public helpers
export function uploadImage(asset) {
  return uploadFileAny(asset, 'image');
}
export function uploadAudio(asset) {
  return uploadFileAny(asset, 'audio');
}
export function uploadVideo(asset) {
  return uploadFileAny(asset, 'video');
}
