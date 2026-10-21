import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import Cropper from "react-easy-crop";
import { croppedImage, validateCropFile, type CropArea } from "@/lib/image-crop";

export function CroppedImageInput({ label, value, aspect = 1, disabled = false, onChange }: {
  label: string; value?: string; aspect?: number; disabled?: boolean; onChange: (image: string) => void | Promise<void>;
}) {
  const [source, setSource] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<CropArea | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const applying = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => () => { if (source) URL.revokeObjectURL(source); }, [source]);
  const reset = () => { setCrop({ x: 0, y: 0 }); setZoom(1); setArea(null); setError(""); };
  const close = () => { if (!applying.current) { setSource(null); setError(""); } };
  return <div className="space-y-2 min-w-0">
    <label className="block text-sm font-semibold">
      {label}
      <input className="input mt-2 max-w-full" type="file" disabled={disabled || busy} accept="image/jpeg,image/png,image/webp,image/gif" onChange={event => {
        const file = event.target.files?.[0]; event.target.value = "";
        if (!file) return;
        const problem = validateCropFile(file);
        if (problem) { setError(problem); return; }
        reset(); setSource(URL.createObjectURL(file));
      }} />
    </label>
    {value ? <img src={value} alt={`${label} preview`} className="max-h-32 max-w-full rounded-xl border border-purple-100 object-contain" /> : null}
    {!source && error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
    <Dialog.Root open={Boolean(source)} onOpenChange={open => { if (!open) close(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="booking-deposit-backdrop image-crop-backdrop" />
        <Dialog.Content className="booking-deposit-dialog image-crop-dialog" onPointerDownOutside={event => event.preventDefault()} onEscapeKeyDown={event => { if (busy) event.preventDefault(); }}>
          <Dialog.Title className="modal-title booking-deposit-title">Crop Image</Dialog.Title>
          <div className="booking-deposit-body">
            <Dialog.Description className="mb-3 text-sm text-muted-foreground">Drag to reposition and zoom to frame your image. The highlighted area previews your crop. GIF images are saved as a still image.</Dialog.Description>
            <div className="relative h-[min(42dvh,320px)] min-h-40 overflow-hidden rounded-xl bg-black/90" aria-label={`${label} crop preview`}>
              {source ? <Cropper image={source} crop={crop} zoom={zoom} aspect={aspect} maxZoom={4} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_, pixels) => setArea(pixels)} onMediaLoaded={() => setError("")} mediaProps={{ onError: () => { setError("This image could not be opened. Cancel and choose another image."); setArea(null); } }} style={{ containerStyle: { pointerEvents: busy ? "none" : undefined } }} /> : null}
            </div>
            <label className="mt-4 flex items-center gap-3 text-sm font-semibold">Zoom
              <input className="min-w-0 flex-1 accent-purple-600" aria-label="Image zoom" type="range" min="1" max="4" step="0.05" value={zoom} disabled={busy} onChange={event => setZoom(Number(event.target.value))} />
            </label>
            {error ? <p className="mt-3 text-sm text-destructive" role="alert">{error}</p> : null}
          </div>
          <div className="booking-deposit-actions">
            <button className="btn btn-ghost" type="button" disabled={busy} onClick={close}>Cancel</button>
            <button className="btn btn-secondary" type="button" disabled={busy} onClick={reset}>Reset</button>
            <button className="btn btn-primary" type="button" disabled={!area || busy || Boolean(error)} onClick={async () => {
              if (!source || !area || applying.current) return;
              applying.current = true; setBusy(true); setError("");
              try {
                const result = await croppedImage(source, area, aspect > 1 ? 1600 : 1200);
                if (mounted.current) { await onChange(result); if (mounted.current) setSource(null); }
              } catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : "The image could not be cropped. Please retry."); }
              finally { applying.current = false; if (mounted.current) setBusy(false); }
            }}>{busy ? "Applying..." : "Apply Crop"}</button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </div>;
}
