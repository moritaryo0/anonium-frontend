"use client";

import { useCallback, useState } from "react";
import Cropper, { Area, MediaSize } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";

type Props = {
  imageUrl: string;
  aspectRatio: number; // width / height
  title?: string;
  onCancel: () => void;
  onApply: (crop: { x: number; y: number; w: number; h: number }) => void; // in natural pixels
};

export default function CropEditor({ imageUrl, aspectRatio, title = "メディアを編集", onCancel, onApply }: Props) {
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [mediaSize, setMediaSize] = useState<MediaSize | null>(null);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  // 初期ズームは最小値（1）に設定

  const handleCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleMediaLoaded = useCallback((media: MediaSize) => {
    setMediaSize(media);
    setZoom(1);
  }, []);

  const handleApply = useCallback(() => {
    if (!croppedAreaPixels) return;
    const { x, y, width, height } = croppedAreaPixels;
    onApply({
      x: Math.round(x),
      y: Math.round(y),
      w: Math.round(width),
      h: Math.round(height),
    });
  }, [croppedAreaPixels, onApply]);

  const sliderMin = 1;

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-2 sm:p-4">
      <div className="w-full sm:w-[92vw] max-w-[980px] bg-background rounded-xl border border-subtle shadow-xl max-h-[96vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-subtle">
          <div className="text-base font-semibold">{title}</div>
          <div className="flex items-center gap-2">
            <button type="button" className="px-3 py-1.5 rounded-md border border-subtle hover:bg-white/5" onClick={onCancel}>キャンセル</button>
            <button type="button" className="px-3 py-1.5 rounded-md bg-accent text-white hover:opacity-90" onClick={handleApply} disabled={!croppedAreaPixels}>適用</button>
          </div>
        </div>

        <div className="px-4 py-4 flex-1 overflow-hidden">
          <div className="relative mx-auto" style={{ width: "100%", height: "min(70vh, 600px)", minHeight: 260 }}>
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              aspect={aspectRatio}
              cropShape="rect"
              showGrid={false}
              objectFit="contain"
              restrictPosition
              minZoom={1}
              maxZoom={6}
              zoomSpeed={0.8}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={handleCropComplete}
              onMediaLoaded={handleMediaLoaded}
              classes={{ containerClassName: "rounded-lg overflow-hidden bg-black" }}
            />
          </div>

          <div className="mt-4 flex items-center gap-3">
            <span className="text-xs text-subtle">ズーム</span>
            <input
              type="range"
              min={sliderMin}
              max={5}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

