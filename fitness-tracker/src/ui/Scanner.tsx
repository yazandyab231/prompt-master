import { useEffect, useRef, useState } from 'react';

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

/**
 * Live camera barcode reader. Uses the browser's built-in BarcodeDetector where it
 * exists (Chrome/Android) and falls back to the ZXing library elsewhere (Safari/iOS, Firefox).
 */
export function Scanner({ onCode }: { onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const cb = useRef(onCode);
  cb.current = onCode;

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let controls: { stop: () => void } | undefined;
    let last = '';
    const emit = (raw: string) => {
      const code = raw.replace(/\D/g, '');
      if (stopped || code.length < 8 || code === last) return;
      last = code;
      navigator.vibrate?.(40);
      cb.current(code);
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('This browser cannot open the camera. Type the barcode number below instead.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
          audio: false,
        });
      } catch (e: any) {
        setError(
          e?.name === 'NotAllowedError'
            ? 'Camera access was blocked. Allow the camera for this site, or type the barcode number below.'
            : 'No camera could be opened. Type the barcode number below instead.',
        );
        return;
      }
      if (stopped || !video.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const el = video.current;
      el.srcObject = stream;
      await el.play().catch(() => undefined);
      setStarting(false);

      const Detector = (window as any).BarcodeDetector;
      let native: any = null;
      if (Detector) {
        try {
          const supported: string[] = await Detector.getSupportedFormats();
          const formats = FORMATS.filter((f) => supported.includes(f));
          if (formats.length) native = new Detector({ formats });
        } catch {
          native = null;
        }
      }
      if (native) {
        timer = setInterval(async () => {
          if (el.readyState < 2) return;
          try {
            const found = await native.detect(el);
            if (found[0]?.rawValue) emit(found[0].rawValue);
          } catch {
            /* a frame that fails to decode is normal; keep trying */
          }
        }, 250);
      } else {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        if (stopped) return;
        const reader = new BrowserMultiFormatReader();
        controls = await reader.decodeFromVideoElement(el, (result) => {
          if (result) emit(result.getText());
        });
        if (stopped) controls.stop();
      }
    })();

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      controls?.stop();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="viewfinder">
      <video ref={video} playsInline muted />
      {error ? (
        <div className="msg" role="alert">
          {error}
        </div>
      ) : starting ? (
        <div className="msg">Opening camera…</div>
      ) : (
        <div className="aim" aria-hidden="true" />
      )}
    </div>
  );
}
