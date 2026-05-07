import { useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import CoverCropModal from './CoverCropModal';

// Reusable cover image picker. Shows the image (or gradient placeholder),
// a camera button to pick a new file, and an upload spinner. Children render
// BETWEEN the image and the camera button so the camera button stays on top
// of any caller-provided overlays.
export default function CoverImageUpload({
  imageUrl,
  onFileSelected,
  uploading = false,
  disabled = false,
  hideCamera = false,
  className = 'h-44 rounded-2xl',
  children,
}) {
  const inputRef = useRef(null);
  const [pendingFile, setPendingFile] = useState(null);

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
    // Open the crop modal — only commits to onFileSelected after Apply.
    setPendingFile(file);
    e.target.value = '';
  };

  const handleCropConfirm = (blob) => {
    setPendingFile(null);
    onFileSelected(blob);
  };

  const handleCropCancel = () => {
    setPendingFile(null);
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-sunset" />
      )}
      {children}
      {!hideCamera && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
          aria-label="Change cover image"
          className="absolute top-3 right-3 w-10 h-10 rounded-full bg-ink-900/60 backdrop-blur-md border border-coral-500/30 text-cream-50 hover:bg-ink-900/80 flex items-center justify-center shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed z-20"
        >
          <Camera className="w-4 h-4" />
        </button>
      )}
      {uploading && (
        <div className="absolute inset-0 bg-ink-900/40 flex items-center justify-center z-30">
          <Loader2 className="w-8 h-8 text-cream-50 animate-spin" />
        </div>
      )}
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
    </div>
  );
}
