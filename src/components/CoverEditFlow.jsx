import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { uploadCoverImage } from '../lib/imageUpload';
import CoverCropModal from './CoverCropModal';

// Headless cover-edit flow. Renders a hidden file input + crop modal + upload
// overlay. Parent uses an imperative ref to call `open()` which triggers the
// file picker. After the user picks + crops, the image is uploaded and the
// trip is patched. Parent gets the final URL via onUpdated.
const CoverEditFlow = forwardRef(({ tripId, onUpdated }, ref) => {
  const inputRef = useRef(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  useImperativeHandle(
    ref,
    () => ({
      open: () => inputRef.current?.click(),
    }),
    [],
  );

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please pick an image file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('Image is too large (max 10MB).');
      return;
    }
    setPendingFile(file);
    e.target.value = '';
  };

  const handleCropConfirm = async (blob) => {
    setPendingFile(null);
    setUploading(true);
    try {
      const url = await uploadCoverImage(blob, tripId);
      const { error } = await supabase
        .from('trips')
        .update({ cover_image_url: url })
        .eq('id', tripId);
      if (error) throw error;
      onUpdated?.(url);
    } catch (err) {
      alert('Could not update cover: ' + (err.message || 'unknown error'));
    } finally {
      setUploading(false);
    }
  };

  const handleCropCancel = () => setPendingFile(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
      {pendingFile && (
        <CoverCropModal
          file={pendingFile}
          onCancel={handleCropCancel}
          onConfirm={handleCropConfirm}
        />
      )}
      {uploading && (
        <div className="fixed inset-0 z-[70] bg-ink-900/50 flex items-center justify-center">
          <div className="bg-white rounded-lg px-5 py-3 shadow-2xl flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-coral-500 animate-spin" />
            <span className="text-sm font-medium text-ink-900">Uploading cover...</span>
          </div>
        </div>
      )}
    </>
  );
});

CoverEditFlow.displayName = 'CoverEditFlow';

export default CoverEditFlow;
