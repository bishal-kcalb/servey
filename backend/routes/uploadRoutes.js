// routes/uploads.js
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import mime from 'mime-types';
import express from 'express';

// HEIC is optional; if not installed on your platform, we fall back gracefully.
let heicConvert = null;
try {
  // eslint-disable-next-line import/no-extraneous-dependencies
  heicConvert = (await import('heic-convert')).default;
} catch { /* optional */ }

const router = express.Router();

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

/** Build an absolute URL that the **device** can reach */
function buildPublicUrl(req, filename) {
  // IMPORTANT: Set PUBLIC_BASE_URL to your ngrok/prod origin, e.g.
  // PUBLIC_BASE_URL=https://abfe8d5dcb9c.ngrok-free.app
  const base = (process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
  return `${base}/uploads/${filename}`;
}

/** Safe base filename (no ext) */
function safeBase(name) {
  return (name || 'file')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-_.]/g, '')
    .replace(/\.[^.]+$/, '');
}

/** Classify by mime/extension */
function classifyFile(mimetype = '', original = '') {
  const lcMime = String(mimetype).toLowerCase();
  const lcName = String(original).toLowerCase();
  const isImage = /^image\//.test(lcMime) || /\.(png|jpe?g|gif|webp|heic|heif)$/i.test(lcName);
  const isHeic = /heic|heif/.test(lcMime) || /\.(heic|heif)$/i.test(lcName);
  const isAudio = /^audio\//.test(lcMime) || /\.(m4a|mp3|wav|caf)$/i.test(lcName);
  const isVideo = /^video\//.test(lcMime) || /\.(mp4|mov|m4v)$/i.test(lcName);
  return { isImage, isHeic, isAudio, isVideo };
}

/**
 * We’ll store **everything** to disk using multer.diskStorage to avoid
 * buffering large files (videos) in memory. For HEIC images, we convert
 * to JPEG after saving and remove the original.
 */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const base = safeBase(file.originalname) || 'upload';
    // use mimetype as a hint; if unknown we will correct later
    const ext = mime.extension(file.mimetype) || path.extname(file.originalname).replace('.', '') || 'bin';
    cb(null, `${Date.now()}-${base}.${ext}`);
  },
});

const upload = multer({
  storage,
  // Large enough for typical mobile videos; tune as needed
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
});

router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { originalname, mimetype, filename, path: tmpPath } = req.file;
    const { isImage, isHeic, isAudio, isVideo } = classifyFile(mimetype, originalname);

    let finalPath = tmpPath; // may change if we convert HEIC
    let finalMime = mimetype || 'application/octet-stream';
    let finalName = filename;

    if (isImage && isHeic) {
      if (!heicConvert) {
        // Converter not available, keep original HEIC but warn
        console.warn('HEIC uploaded but heic-convert is not available. Returning original file.');
      } else {
        // Convert HEIC → JPEG (read the file, convert, write a new one)
        const input = fs.readFileSync(tmpPath);
        const outBuffer = await heicConvert({ buffer: input, format: 'JPEG', quality: 0.9 });

        const base = safeBase(originalname) || 'photo';
        const jpgName = `${Date.now()}-${base}.jpg`;
        const jpgPath = path.join(uploadDir, jpgName);
        fs.writeFileSync(jpgPath, outBuffer);

        // Remove original HEIC to save space
        try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }

        finalPath = jpgPath;
        finalMime = 'image/jpeg';
        finalName = jpgName;
      }
    } else if (isImage) {
      // Ensure extension aligns with mime (optional — filename already has a reasonable ext)
      // Nothing else needed.
    } else if (isAudio) {
      // Keep as-is
      // If your Expo recordings are .m4a but mime is generic, you can normalize here if needed.
    } else if (isVideo) {
      // Keep as-is (we’re already using disk storage)
    } else {
      // Unknown type: leave as-is
    }

    const url = buildPublicUrl(req, finalName);

    // Optional: add Cache-Control headers via your static middleware (see below).

    return res.json({ url, contentType: finalMime, size: fs.statSync(finalPath).size });
  } catch (e) {
    console.error('Upload failed:', e);
    return res.status(500).json({ error: 'Upload failed' });
  }
});

export default router;
