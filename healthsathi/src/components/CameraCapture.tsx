import { useRef, useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";

interface Props {
  onCapture: (file: File) => void;
  onGallery: (file: File) => void;
  disabled?: boolean;
}

const hiddenInputStyle: React.CSSProperties = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0,0,0,0)",
  whiteSpace: "nowrap",
  border: 0,
};

/**
 * CameraCapture — Opens a real live camera preview using getUserMedia.
 * Falls back to file input if camera is not available.
 */
export default function CameraCapture({ onCapture, onGallery, disabled }: Props) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraOpen(false);
  }, []);

  // Start camera stream
  const startCamera = useCallback(async (facing: "environment" | "user" = facingMode) => {
    setCameraError(null);
    try {
      // Stop any existing stream first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true"); // iOS Safari
        await videoRef.current.play();
      }

      setCameraOpen(true);
      setFacingMode(facing);
    } catch (err) {
      console.error("[CameraCapture] Camera error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("NotAllowedError") || msg.includes("Permission")) {
        setCameraError(t("cameraPermissionDenied", "Camera permission denied. Please allow camera access in your browser settings."));
      } else if (msg.includes("NotFoundError") || msg.includes("DevicesNotFound")) {
        setCameraError(t("noCameraFound", "No camera found on this device."));
      } else {
        setCameraError(t("cameraError", "Could not access camera. Please use gallery instead."));
      }
      setCameraOpen(false);
    }
  }, [facingMode, t]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Capture photo from video
  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
          console.log("[CameraCapture] Photo captured:", file.name, file.size, "bytes");
          stopCamera();
          onCapture(file);
        }
      },
      "image/jpeg",
      0.9
    );
  }, [onCapture, stopCamera]);

  // Switch camera (front/back)
  const switchCamera = useCallback(() => {
    const newFacing = facingMode === "environment" ? "user" : "environment";
    startCamera(newFacing);
  }, [facingMode, startCamera]);

  const handleGalleryClick = () => {
    if (galleryRef.current) galleryRef.current.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onGallery(f);
    e.target.value = "";
  };

  // ── Live Camera View ──
  if (cameraOpen) {
    return (
      <div className="relative rounded-2xl overflow-hidden bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full aspect-[4/3] object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Camera controls overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 flex items-center justify-between">
          {/* Close */}
          <button
            onClick={stopCamera}
            className="w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center"
          >
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Capture button */}
          <button
            onClick={capturePhoto}
            className="w-16 h-16 rounded-full border-4 border-white bg-white/30 backdrop-blur flex items-center justify-center active:scale-90 transition-transform"
          >
            <div className="w-12 h-12 rounded-full bg-white" />
          </button>

          {/* Switch camera */}
          <button
            onClick={switchCamera}
            className="w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center"
          >
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // ── Default View: Buttons ──
  return (
    <div>
      {/* Camera error message */}
      {cameraError && (
        <div className="mb-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
          {cameraError}
        </div>
      )}

      {/* TAKE PHOTO - opens live camera */}
      <button
        type="button"
        onClick={() => startCamera()}
        disabled={disabled}
        className={`btn-primary w-full py-4 text-base flex items-center justify-center gap-2 ${disabled ? "opacity-40 pointer-events-none" : ""}`}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        {t("takePhoto", "Take Photo")}
      </button>

      {/* UPLOAD FROM GALLERY */}
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        disabled={disabled}
        style={hiddenInputStyle}
        onChange={handleFileChange}
      />
      <button
        type="button"
        onClick={handleGalleryClick}
        disabled={disabled}
        className={`btn-secondary w-full py-4 text-base mt-3 flex items-center justify-center gap-2 ${disabled ? "opacity-40 pointer-events-none" : ""}`}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        {t("fromGallery", "From Gallery")}
      </button>
    </div>
  );
}
