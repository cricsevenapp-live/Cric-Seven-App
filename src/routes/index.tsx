import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Settings,
  X,
  RefreshCw,
  Mic,
  MicOff,
  Radio,
  Rewind,
  Facebook,
  Youtube,
  Lock,
  Unlock,
  Play,
  Upload,
  Sliders,
  ZoomIn,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cric Seven Live — Live Cricket Broadcasting" },
      {
        name: "description",
        content:
          "Broadcast live cricket matches with real-time CricHeroes scorecard overlay. Professional mobile studio for umpires and streamers.",
      },
      { property: "og:title", content: "Cric Seven Live — Live Cricket Broadcasting" },
      {
        property: "og:description",
        content: "Broadcast live cricket matches with real-time CricHeroes scorecard overlay. Professional mobile studio for umpires and streamers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const IFRAME_BASE_WIDTH = 1280;
const IFRAME_BASE_HEIGHT = 800;

interface Destination {
  rtmp: string;
  key: string;
  connected: boolean;
}

interface OverlayBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

type ResolutionOption = "720p" | "1080p";

function Index() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const adVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const framesBufferRef = useRef<string[]>([]);
  const frameIntervalRef = useRef<any>(null);

  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [resolution, setResolution] = useState<ResolutionOption>("720p");
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [muted, setMuted] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [overlayInput, setOverlayInput] = useState("");
  const [overlayUrl, setOverlayUrl] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);

  const [overlay, setOverlay] = useState<OverlayBox>({
    x: 16,
    y: 60,
    width: 650,
    height: 380,
  });
  const [overlayLocked, setOverlayLocked] = useState(false);
  const [showOverlayBorder, setShowOverlayBorder] = useState(true);

  const [showReplay, setShowReplay] = useState(false);

  const [adUrl, setAdUrl] = useState<string | null>(null);
  const [playAd, setPlayAd] = useState(false);
  const [adFileName, setAdFileName] = useState("");

  const [facebook, setFacebook] = useState<Destination>({
    rtmp: "rtmps://live-api-s.facebook.com:443/rtmp/",
    key: "",
    connected: false,
  });
  const [youtube, setYoutube] = useState<Destination>({
    rtmp: "rtmp://a.rtmp.youtube.com/live2",
    key: "",
    connected: false,
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem("cric7-settings");
      if (raw) {
        const s = JSON.parse(raw);
        if (s.overlayUrl) {
          setOverlayUrl(s.overlayUrl);
          setOverlayInput(s.overlayUrl);
        }
        if (s.overlay) setOverlay(s.overlay);
        if (s.facebook) setFacebook(s.facebook);
        if (s.youtube) setYoutube(s.youtube);
        if (s.resolution) setResolution(s.resolution);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const data = { overlayUrl, overlay, facebook, youtube, resolution };
    try {
      localStorage.setItem("cric7-settings", JSON.stringify(data));
    } catch {}
  }, [overlayUrl, overlay, facebook, youtube, resolution]);

  useEffect(() => {
    if (overlayLocked) {
      const timer = setTimeout(() => {
        setShowOverlayBorder(false);
      }, 2500);
      return () => clearTimeout(timer);
    } else {
      setShowOverlayBorder(true);
    }
  }, [overlayLocked]);

  useEffect(() => {
    let active = true;
    async function startCamera() {
      try {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }

        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: resolution === "1080p" ? 1920 : 1280 },
            height: { ideal: resolution === "1080p" ? 1080 : 720 },
            frameRate: { ideal: 30, max: 30 },
            // @ts-ignore
            focusMode: "continuous",
            advanced: [{ focusMode: "continuous" }, { whiteBalanceMode: "continuous" }]
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        stream.getAudioTracks().forEach((t) => (t.enabled = !muted));

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        framesBufferRef.current = [];
        if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);

        // Capture frames for exactly 15 seconds window (approx 75 frames at 200ms interval)
        frameIntervalRef.current = setInterval(() => {
          const videoEl = videoRef.current;
          if (!videoEl || videoEl.paused || videoEl.ended) return;
          try {
            const canvas = document.createElement("canvas");
            canvas.width = 640;
            canvas.height = 360;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
              const data = canvas.toDataURL("image/jpeg", 0.75);
              framesBufferRef.current.push(data);
              // Exactly 75 frames * 200ms = 15 seconds buffer length
              if (framesBufferRef.current.length > 75) {
                framesBufferRef.current.shift();
              }
            }
          } catch {}
        }, 200);

        setCamError(null);
      } catch (err) {
        console.error("Camera error:", err);
        setCamError(
          err instanceof Error ? err.message : "Unable to access camera. Please grant permission.",
        );
      }
    }

    startCamera();

    return () => {
      active = false;
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    };
  }, [facingMode, resolution]);

  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((t) => (t.enabled = !muted));
    }
  }, [muted]);

  useEffect(() => {
    const el = adVideoRef.current;
    if (!el) return;
    if (playAd && adUrl) {
      el.currentTime = 0;
      el.play().catch(() => {});
    } else {
      el.pause();
      if (videoRef.current && streamRef.current && !videoRef.current.srcObject) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch(() => {});
      }
    }
  }, [playAd, adUrl]);

  function onAdFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setAdUrl(url);
    setAdFileName(file.name);
  }

  const flipCamera = () => {
    setZoomLevel(1);
    setFacingMode((m) => (m === "user" ? "environment" : "user"));
  };

  const applyOverlay = () => {
    const url = overlayInput.trim();
    setOverlayUrl(url.length ? url : null);
  };

  const triggerInstantReplay = () => {
    if (framesBufferRef.current.length > 10) {
      setShowReplay(true);
    } else {
      alert("Buffer is loading 15s data. Please wait a moment.");
    }
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black touch-none">
      {/* Zoomable Camera View Container */}
      <div 
        className="absolute inset-0 h-full w-full overflow-hidden pointer-events-none"
        style={{
          transform: `scale(${zoomLevel})`,
          transformOrigin: "center center",
          transition: "transform 0.15s ease-out"
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover pointer-events-auto"
        />
      </div>

      {camError && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80 p-6 text-center">
          <div className="max-w-sm text-white">
            <h2 className="text-lg font-semibold">Camera unavailable</h2>
            <p className="mt-2 text-sm text-white/70">{camError}</p>
          </div>
        </div>
      )}

      {/* Fully Unrestricted Independent Scorecard Overlay Layer */}
      {overlayUrl && (
        <OverlayFrame
          url={overlayUrl}
          box={overlay}
          onChange={setOverlay}
          locked={overlayLocked}
          showBorder={showOverlayBorder}
          onShowBorderClick={() => setShowOverlayBorder(true)}
        />
      )}

      <div className="pointer-events-none absolute left-4 top-4 z-30 flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 backdrop-blur-md ring-1 ring-white/10">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-700 text-[10px] font-black text-white shadow">
          C7
        </span>
        <span className="text-sm font-bold tracking-wide text-white">
          Cric <span className="text-red-400">Seven</span>
        </span>
      </div>

      {isLive && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-red-600/90 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg backdrop-blur-md">
          <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
          Live ({resolution})
        </div>
      )}

      {/* Zoom Control Pill */}
      <div className="absolute right-20 top-4 z-45 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 backdrop-blur-md ring-1 ring-white/20 text-white shadow-lg">
        <ZoomIn className="h-4 w-4 text-red-400" />
        <button
          onClick={() => setZoomLevel((z) => Math.max(1, +(z - 0.2).toFixed(1)))}
          className="px-1.5 text-xs font-bold hover:text-red-400 cursor-pointer"
        >
          -
        </button>
        <span className="text-xs font-semibold w-8 text-center">{zoomLevel}x</span>
        <button
          onClick={() => setZoomLevel((z) => Math.min(3, +(z + 0.2).toFixed(1)))}
          className="px-1.5 text-xs font-bold hover:text-red-400 cursor-pointer"
        >
          +
        </button>
      </div>

      {/* Scorecard Lock / Unlock Toggle Button */}
      {overlayUrl && (
        <button
          onClick={() => {
            setOverlayLocked((v) => {
              const next = !v;
              if (!next) setShowOverlayBorder(true);
              return next;
            });
          }}
          aria-label={overlayLocked ? "Unlock overlay" : "Lock overlay"}
          className="absolute right-36 top-4 z-45 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md ring-1 ring-white/20 transition hover:bg-black/70 shadow-lg cursor-pointer"
        >
          {overlayLocked ? <Lock className="h-4 w-4 text-yellow-400 animate-pulse" /> : <Unlock className="h-4 w-4 text-emerald-400" />}
        </button>
      )}

      <button
        onClick={() => setSettingsOpen((s) => !s)}
        aria-label="Open settings"
        className="absolute right-4 top-4 z-45 flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md ring-1 ring-white/10 transition hover:bg-black/60 cursor-pointer"
      >
        <Settings className="h-5 w-5" />
      </button>

      {!showReplay && (
        <button
          onClick={triggerInstantReplay}
          className="absolute bottom-28 right-4 z-30 flex items-center gap-2 rounded-full bg-black/70 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20 backdrop-blur-md transition hover:bg-black/90 shadow-lg cursor-pointer"
        >
          <Rewind className="h-4 w-4 text-yellow-400 animate-pulse" />
          15s Slow-Mo Replay
        </button>
      )}

      {adUrl && !playAd && (
        <button
          onClick={() => setPlayAd(true)}
          className="absolute bottom-28 left-4 z-30 flex items-center gap-2 rounded-full bg-red-600/80 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-red-400/40 backdrop-blur-md transition hover:bg-red-600 shadow-lg cursor-pointer"
        >
          <Play className="h-4 w-4 fill-white" />
          Play Ad Break
        </button>
      )}

      {playAd && adUrl && (
        <div className="absolute inset-0 z-50 bg-black flex items-center justify-center">
          <video
            ref={adVideoRef}
            src={adUrl}
            className="h-full w-full object-contain"
            autoPlay
            playsInline
            onEnded={() => setPlayAd(false)}
          />
          <button
            onClick={() => setPlayAd(false)}
            className="absolute right-6 top-6 rounded-full bg-white/20 px-5 py-2.5 text-sm font-semibold backdrop-blur-md hover:bg-white/30 text-white shadow-xl cursor-pointer"
          >
            End Ad Break & Resume Live
          </button>
        </div>
      )}

      {showReplay && (
        <ReplayPlayer frames={framesBufferRef.current} onClose={() => setShowReplay(false)} />
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center pb-10">
        <button
          onClick={() => setIsLive((v) => !v)}
          className={`pointer-events-auto flex items-center gap-2.5 rounded-full px-8 py-4 text-base font-semibold text-white shadow-[0_10px_40px_-10px_rgba(239,68,68,0.8)] ring-1 backdrop-blur-md transition-all active:scale-95 cursor-pointer ${
            isLive
              ? "bg-red-600/90 ring-red-300/40 hover:bg-red-600"
              : "bg-red-500/70 ring-red-200/30 hover:bg-red-500/90"
          }`}
        >
          <Radio className="h-5 w-5" />
          {isLive ? "End Live" : "Go Live"}
        </button>
      </div>

      <div
        className={`absolute right-0 top-0 z-55 h-full w-[360px] max-w-[90vw] transform overflow-y-auto bg-black/85 backdrop-blur-2xl ring-1 ring-white/10 transition-transform duration-300 ${
          settingsOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-white/90">
              Cric Seven Live
            </h2>
            <p className="text-xs text-white/50">Studio settings</p>
          </div>
          <button
            onClick={() => setSettingsOpen(false)}
            aria-label="Close settings"
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-6 p-5">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white/60">
              <Sliders className="h-4 w-4 text-red-400" />
              Broadcast Resolution
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setResolution("720p")}
                className={`rounded-lg py-2.5 text-xs font-semibold ring-1 transition cursor-pointer ${
                  resolution === "720p"
                    ? "bg-red-600 text-white ring-red-400"
                    : "bg-white/5 text-white/70 ring-white/10 hover:bg-white/10"
                }`}
              >
                720p HD (Smooth)
              </button>
              <button
                onClick={() => setResolution("1080p")}
                className={`rounded-lg py-2.5 text-xs font-semibold ring-1 transition cursor-pointer ${
                  resolution === "1080p"
                    ? "bg-red-600 text-white ring-red-400"
                    : "bg-white/5 text-white/70 ring-white/10 hover:bg-white/10"
                }`}
              >
                1080p Full HD
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium uppercase tracking-wider text-white/60">
              Sponsor Video / Ad Management
            </label>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-white/25 bg-white/5 px-3 py-3 text-xs uppercase tracking-wider text-white/80 hover:bg-white/10">
              <Upload className="h-4 w-4 text-red-400" />
              {adFileName ? `Loaded: ${adFileName.substring(0, 18)}...` : "Upload Ad Video File"}
              <input type="file" accept="video/*" onChange={onAdFile} className="hidden" />
            </label>
          </div>

          <div className="h-px bg-white/10" />

          <div>
            <label
              htmlFor="overlay-url"
              className="mb-2 block text-xs font-medium uppercase tracking-wider text-white/60"
            >
              Web URL Overlay
            </label>
            <input
              id="overlay-url"
              type="url"
              placeholder="Paste CricksLab / CricHeroes link"
              value={overlayInput}
              onChange={(e) => setOverlayInput(e.target.value)}
              className="w-full rounded-lg bg-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/40 outline-none ring-1 ring-white/10 focus:ring-red-400/60"
            />
            <button
              onClick={applyOverlay}
              className="mt-3 w-full rounded-lg bg-red-500/80 py-2.5 text-sm font-semibold text-white ring-1 ring-red-300/30 transition hover:bg-red-500 cursor-pointer"
            >
              Apply Overlay
            </button>
            {overlayUrl && (
              <button
                onClick={() => {
                  setOverlayInput("");
                  setOverlayUrl(null);
                }}
                className="mt-2 w-full rounded-lg bg-white/5 py-2 text-xs font-medium text-white/70 ring-1 ring-white/10 transition hover:bg-white/10 cursor-pointer"
              >
                Remove overlay
              </button>
            )}
          </div>

          <div className="h-px bg-white/10" />

          <div className="space-y-3">
            <button
              onClick={flipCamera}
              className="flex w-full items-center justify-between rounded-lg bg-white/5 px-4 py-3 text-sm text-white ring-1 ring-white/10 transition hover:bg-white/10 cursor-pointer"
            >
              <span className="flex items-center gap-3">
                <RefreshCw className="h-4 w-4" />
                Flip camera
              </span>
              <span className="text-xs text-white/50">
                {facingMode === "user" ? "Front" : "Back"}
              </span>
            </button>

            <button
              onClick={() => setMuted((m) => !m)}
              className="flex w-full items-center justify-between rounded-lg bg-white/5 px-4 py-3 text-sm text-white ring-1 ring-white/10 transition hover:bg-white/10 cursor-pointer"
            >
              <span className="flex items-center gap-3">
                {muted ? <MicOff className="h-4 w-4 text-red-400" /> : <Mic className="h-4 w-4" />}
                Microphone
              </span>
              <span className={`text-xs ${muted ? "text-red-400" : "text-emerald-400"}`}>
                {muted ? "Muted" : "Live"}
              </span>
            </button>
          </div>

          <div className="h-px bg-white/10" />

          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/60">
              Streaming Destinations
            </h3>
            <DestinationCard
              icon={<Facebook className="h-4 w-4" />}
              name="Facebook Live"
              accent="text-blue-400"
              value={facebook}
              onChange={setFacebook}
            />
            <div className="h-3" />
            <DestinationCard
              icon={<Youtube className="h-4 w-4" />}
              name="YouTube Live"
              accent="text-red-400"
              value={youtube}
              onChange={setYoutube}
            />
          </div>
        </div>
      </div>

      {settingsOpen && (
        <button
          aria-label="Close settings backdrop"
          onClick={() => setSettingsOpen(false)}
          className="absolute inset-0 z-50 bg-black/20"
        />
      )}
    </div>
  );
}

function ReplayPlayer({ frames, onClose }: { frames: string[]; onClose: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (frames.length === 0) return;
    // Perfect normal slow-mo frame pace for 15s buffer playback
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % frames.length);
    }, 100);
    return () => clearInterval(interval);
  }, [frames]);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur">
      <div className="relative w-full max-w-3xl px-4 text-center">
        <div className="relative rounded-xl overflow-hidden shadow-2xl border border-white/20 bg-black aspect-video flex items-center justify-center">
          {frames.length > 0 ? (
            <img
              src={frames[currentIndex] || frames[0]}
              alt="15s Slow-Mo Replay"
              className="w-full h-full object-contain"
            />
          ) : (
            <p className="text-white">Loading...</p>
          )}
          <div className="absolute top-3 left-3 bg-yellow-500 text-black px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider animate-pulse shadow">
            15s SLOW-MO REPLAY
          </div>
        </div>
        <button
          onClick={onClose}
          className="mt-5 rounded-full bg-white/20 px-8 py-3 text-sm font-semibold text-white ring-1 ring-white/30 hover:bg-white/30 shadow-lg cursor-pointer"
        >
          Close Replay & Resume Live
        </button>
      </div>
    </div>
  );
}

function OverlayFrame({
  url,
  box,
  onChange,
  locked,
  showBorder,
  onShowBorderClick,
}: {
  url: string;
  box: OverlayBox;
  onChange: (b: OverlayBox) => void;
  locked: boolean;
  showBorder: boolean;
  onShowBorderClick: () => void;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const resizingRef = useRef(false);
  const startBoxRef = useRef<OverlayBox>(box);
  const startPointRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const clampBox = (b: OverlayBox): OverlayBox => {
    const width = Math.max(150, b.width);
    const height = Math.max(80, b.height);
    // Allow freedom across the screen bounds without rigid clamping
    const x = Math.max(-width + 50, Math.min(b.x, window.innerWidth - 50));
    const y = Math.max(0, Math.min(b.y, window.innerHeight - 50));
    return { x, y, width, height };
  };

  const handlePointerDown = (type: "drag" | "resize") => (e: React.PointerEvent) => {
    if (locked) return;
    e.stopPropagation();
    e.preventDefault();

    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    startBoxRef.current = { ...box };
    startPointRef.current = { x: e.clientX, y: e.clientY };

    if (type === "drag") {
      draggingRef.current = true;
    } else {
      resizingRef.current = true;
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current && !resizingRef.current) return;
    e.stopPropagation();
    e.preventDefault();

    const dx = e.clientX - startPointRef.current.x;
    const dy = e.clientY - startPointRef.current.y;
    const sb = startBoxRef.current;

    if (draggingRef.current) {
      onChange(clampBox({ ...sb, x: sb.x + dx, y: sb.y + dy }));
    } else if (resizingRef.current) {
      onChange(
        clampBox({
          ...sb,
          width: sb.width + dx,
          height: sb.height + dy,
        })
      );
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!draggingRef.current && !resizingRef.current) return;
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    draggingRef.current = false;
    resizingRef.current = false;
  };

  const scaleX = box.width / IFRAME_BASE_WIDTH;
  const scaleY = box.height / IFRAME_BASE_HEIGHT;

  return (
    <div
      ref={wrapperRef}
      onClick={() => {
        if (locked) {
          onShowBorderClick();
        }
      }}
      className={`absolute z-30 select-none ${locked && !showBorder ? "" : "cursor-move"}`}
      style={{
        left: box.x,
        top: box.y,
        width: box.width,
        height: box.height,
        touchAction: "none",
      }}
      onPointerDown={handlePointerDown("drag")}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div
        className={`absolute inset-0 overflow-hidden transition-all duration-300 ${
          !locked && showBorder
            ? "ring-2 ring-white/80 shadow-2xl rounded-lg bg-black/20 backdrop-blur-[1px]"
            : "ring-0 bg-transparent"
        }`}
      >
        <iframe
          src={url}
          title="CricksLab Scorecard Overlay"
          allow="autoplay"
          style={{
            width: IFRAME_BASE_WIDTH,
            height: IFRAME_BASE_HEIGHT,
            border: 0,
            background: "transparent",
            transform: `scaleX(${scaleX}) scaleY(${scaleY})`,
            transformOrigin: "top left",
            pointerEvents: locked ? "auto" : "none",
            display: "block",
          }}
          allowTransparency
        />
      </div>

      {!locked && showBorder && (
        <div
          role="button"
          aria-label="Resize overlay"
          onPointerDown={handlePointerDown("resize")}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="absolute -bottom-3 -right-3 h-8 w-8 cursor-nwse-resize rounded-full bg-red-600 flex items-center justify-center shadow-xl ring-2 ring-white z-40 touch-none"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4 text-white">
            <path
              d="M4 14 L14 4 M8 14 L14 8 M12 14 L14 12"
              stroke="currentColor"
              strokeWidth="2.5"
              fill="none"
            />
          </svg>
        </div>
      )}
    </div>
  );
}

function DestinationCard({
  icon,
  name,
  accent,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  name: string;
  accent: string;
  value: Destination;
  onChange: (d: Destination) => void;
}) {
  return (
    <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold text-white">
          <span className={accent}>{icon}</span>
          {name}
        </span>
        <button
          onClick={() =>
            onChange({ ...value, connected: !value.connected && value.key.length > 0 })
          }
          disabled={value.key.length === 0}
          className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ring-1 transition cursor-pointer ${
            value.connected
              ? "bg-emerald-500/20 text-emerald-300 ring-emerald-400/40"
              : "bg-white/10 text-white/70 ring-white/15 hover:bg-white/15 disabled:opacity-40"
          }`}
        >
          {value.connected ? "Connected" : "Connect"}
        </button>
      </div>
      <input
        type="url"
        placeholder="RTMP Stream URL"
        value={value.rtmp}
        onChange={(e) => onChange({ ...value, rtmp: e.target.value, connected: false })}
        className="mb-2 w-full rounded-md bg-black/40 px-2.5 py-2 text-xs text-white placeholder:text-white/40 outline-none ring-1 ring-white/10 focus:ring-red-400/60"
      />
      <input
        type="password"
        placeholder="Stream Key"
        value={value.key}
        onChange={(e) => onChange({ ...value, key: e.target.value, connected: false })}
        className="w-full rounded-md bg-black/40 px-2.5 py-2 text-xs text-white placeholder:text-white/40 outline-none ring-1 ring-white/10 focus:ring-red-400/60"
      />
    </div>
  );
}
