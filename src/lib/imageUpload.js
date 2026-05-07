import { supabase } from './supabase';

// Compresses an image file using a canvas. Returns a JPEG Blob.
// Caps the long edge at `maxDim` and uses `quality` for JPEG encoding.
export async function compressImage(file, { maxDim = 1920, quality = 0.85 } = {}) {
  const bitmap = await createImageBitmap(file);
  const longEdge = Math.max(bitmap.width, bitmap.height);
  const scale = longEdge > maxDim ? maxDim / longEdge : 1;
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Image compression failed'))),
      'image/jpeg',
      quality,
    );
  });
  return blob;
}

// Uploads a cover image for the given trip. Compresses to JPEG client-side,
// stores under `covers/{tripId}/cover-{ts}.jpg` in the `memories` bucket,
// returns the public URL.
export async function uploadCoverImage(file, tripId) {
  if (!file || !tripId) throw new Error('file and tripId are required');
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files are allowed');
  }
  const compressed = await compressImage(file);
  const path = `covers/${tripId}/cover-${Date.now()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from('memories')
    .upload(path, compressed, {
      cacheControl: '3600',
      contentType: 'image/jpeg',
      upsert: false,
    });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from('memories').getPublicUrl(path);
  return data.publicUrl;
}
