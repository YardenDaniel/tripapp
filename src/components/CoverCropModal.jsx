import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

const CROP_ASPECT = 2; // width / height — matches TripPage hero
const OUTPUT_WIDTH = 1600; // output canvas width in pixels

// Modal that lets the user drag a picked image to choose what part shows
// inside the cover frame. Outputs a JPEG Blob via onConfirm.
export default function CoverCropModal({ file, onCancel, onConfirm }) {
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const dragRef = useRef(null);
  const [imgUrl, setImgUrl] = useState(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [working, setWorking] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function clampOffset(next, scaledW, scaledH) {
    const minX = containerSize.w - scaledW;
    const minY = containerSize.h - scaledH;
    return {
      x: Math.max(minX, Math.min(0, next.x)),
      y: Math.max(minY, Math.min(0, next.y)),
    };
  }

  function handleImgLoad() {
    const img = imgRef.current;
    const cont = containerRef.current;
    if (!img || !cont) return;
    const rect = cont.getBoundingClientRect();
    const contW = rect.width;
    const contH = contW / CROP_ASPECT;
    const sx = contW / img.naturalWidth;
    const sy = contH / img.naturalHeight;
    const s = Math.max(sx, sy);
    const scaledW = img.naturalWidth * s;
    const scaledH = img.naturalHeight * s;
    setContainerSize({ w: contW, h: contH });
    setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
    setScale(s);
    // Center initially.
    setOffset({
      x: (contW - scaledW) / 2,
      y: (contH - scaledH) / 2,
    });
  }

  function handlePointerDown(e) {
    e.preventDefault();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startOffset: { ...offset },
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function handlePointerMove(e) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const scaledW = imgSize.w * scale;
    const scaledH = imgSize.h * scale;
    setOffset(
      clampOffset(
        {
          x: dragRef.current.startOffset.x + dx,
          y: dragRef.current.startOffset.y + dy,
        },
        scaledW,
        scaledH,
      ),
    );
  }

  function handlePointerUp(e) {
    dragRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }

  async function handleConfirm() {
    if (working || !imgRef.current) return;
    setWorking(true);
    try {
      const outputW = OUTPUT_WIDTH;
      const outputH = Math.round(outputW / CROP_ASPECT);
      const canvas = document.createElement('canvas');
      canvas.width = outputW;
      canvas.height = outputH;
      const ctx = canvas.getContext('2d');
      // Container coord (cx, cy) maps to image coord ((cx - offset.x) / scale).
      const srcX = -offset.x / scale;
      const srcY = -offset.y / scale;
      const srcW = containerSize.w / scale;
      const srcH = containerSize.h / scale;
      ctx.drawImage(imgRef.current, srcX, srcY, srcW, srcH, 0, 0, outputW, outputH);
      const blob = await new Promise((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))),
          'image/jpeg',
          0.9,
        ),
      );
      onConfirm(blob);
    } catch (err) {
      alert('Could not crop image: ' + (err.message || 'unknown error'));
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-ink-900/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-md bg-surface-50 rounded-2xl overflow-hidden shadow-2xl">
        <div className="px-4 py-3 border-b border-surface-200 flex items-center justify-between">
          <h3 className="font-display font-semibold text-ink-900">Adjust cover</h3>
          <button
            onClick={onCancel}
            className="btn-ghost p-1.5"
            aria-label="Cancel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          <div
            ref={containerRef}
            className="relative w-full overflow-hidden bg-ink-900 rounded-lg cursor-grab active:cursor-grabbing select-none touch-none"
            style={{ aspectRatio: String(CROP_ASPECT) }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {imgUrl && (
              <img
                ref={imgRef}
                src={imgUrl}
                alt=""
                draggable={false}
                onLoad={handleImgLoad}
                style={{
                  position: 'absolute',
                  left: offset.x,
                  top: offset.y,
                  width: imgSize.w * scale || 'auto',
                  height: imgSize.h * scale || 'auto',
                  maxWidth: 'none',
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              />
            )}
          </div>
          <p className="text-xs text-sage-600 mt-2 text-center">
            Drag the image to choose what shows in the cover.
          </p>
        </div>

        <div className="px-4 py-3 border-t border-surface-200 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={working}
            className="btn-ghost flex-1"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={working}
            className="btn-coral flex-1"
          >
            {working ? 'Working...' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  );
}
