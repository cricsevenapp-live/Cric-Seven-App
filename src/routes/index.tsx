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
  User,
  Facebook,
  Youtube,
  Lock,
  Unlock,
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

const REPLAY_BUFFER_SECONDS = 15;
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

function Index() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const replayVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [muted, setMuted] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [overlayInput, setOverlayInput] = useState("");
  const [overlayUrl, setOverlayUrl] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);

  const [overlay, setOverlay] = useState<OverlayBox>({
    x: 16,
    y: 80,
    width: 480,
    height: 300,
  });
  const [overlayLocked, setOverlayLocked] = useState(false);

  const [replayEnabled, setReplayEnabled] = useState(false);
  const [replayUrl, setReplayUrl] = useState<string | null>(null);
  const [showReplay, setShowReplay] = useState(false);

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
      }
    } catch {}
  }, []);

  useEffect(() => {
    const data = { overlayUrl, overlay, facebook, youtube };
    try {
      localStorage.setItem("cric7-settings", JSON.stringify(data));
    } catch {}
  }, [overlayUrl, overlay, facebook, youtube]);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        stream.getAudioTracks().forEach((t) => (t.enabled = !muted));
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setCamError(null);
      } catch (err) {
        console.error(err);
        setCamError(
          err instanceof Error ? err.message : "Unable to access camera. Please grant permission.",
        );
      }
    }
    start();
    return () => {
      cancelled = true;
    };
  }, [facingMode]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      recorderRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !muted));
  }, [muted]);

  useEffect(() => {
    if (!replayEnabled || !streamRef.current) {
      recorderRef.current?.stop();
      recorderRef.current = null;
      chunksRef.current = [];
      return;
    }
    try {
      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm";
      const rec = new MediaRecorder(streamRef.current, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
          if (chunksRef.current.length > REPLAY_BUFFER_SECONDS) chunksRef.current.shift();
        }
      };
      rec.start(1000);
      recorderRef.current = rec;
      return () => {
        rec.stop();
      };
    } catch (e) {
      console.error("Replay recorder failed", e);
    }
  }, [replayEnabled, facingMode]);

  const flipCamera = () => setFacingMode((m) => (m === "user" ? "environment" : "user"));
  const applyOverlay = () => {
    const url = overlayInput.trim();
    setOverlayUrl(url.length ? url : null);
  };
  const playReplay = () => {
    if (chunksRef.current.length === 0) return;
    const blob = new Blob(chunksRef.current, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    setReplayUrl(url);
    setShowReplay(true);
  };
  const closeReplay = () => {
    setShowReplay(false);
    if (replayUrl) URL.revokeObjectURL(replayUrl);
    setReplayUrl(null);
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black touch-none">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover"
      />

      {camError && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80 p-6 text-center">
          <div className="max-w-sm text-white">
            <h2 className="text-lg font-semibold">Camera unavailable</h2>
            <p className="mt-2 text-sm text-white/70">{camError}</p>
            <p className="mt-4 text-xs text-white/50">
              Grant camera permission and reload. HTTPS is required.
            </p>
          </div>
        </div>
      )}

      {overlayUrl && (
        <OverlayFrame
          url={overlayUrl}
          box={overlay}
          onChange={setOverlay}
          locked={overlayLocked}
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
          Live
        </div>
      )}

      {overlayUrl && (
        <button
          onClick={() => setOverlayLocked((v) => !v)}
          aria-label={overlayLocked ? "Unlock overlay" : "Lock overlay"}
          className="absolute right-16 top-4 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md ring-1 ring-white/10 transition hover:bg-black/60"
        >
          {overlayLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
        </button>
      )}

      <button
        onClick={() => setSettingsOpen((s) => !s)}
        aria-label="Open settings"
        className="absolute right-4 top-4 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md ring-1 ring-white/10 transition hover:bg-black/60"
      >
        <Settings className="h-5 w-5" />
      </button>

      {replayEnabled && !showReplay && (
        <button
          onClick={playReplay}
          className="absolute bottom-28 right-4 z-30 flex items-center gap-2 rounded-full bg-black/50 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/15 backdrop-blur-md transition hover:bg-black/70"
        >
          <Rewind className="h-4 w-4" />
          Instant Replay
        </button>
      )}

      {showReplay && replayUrl && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur">
          <div className="relative w-full max-w-3xl px-4">
            <video
              ref={replayVideoRef}
              src={replayUrl}
              autoPlay
              controls
              className="w-full rounded-xl shadow-2xl"
            />
            <button
              onClick={closeReplay}
              className="absolute -top-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20"
            >
              <X className="h-4 w-4" />
            </button>
            <p className="mt-3 text-center text-xs uppercase tracking-widest text-white/60">
              Last {REPLAY_BUFFER_SECONDS}s Instant Replay
            </p>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center pb-10">
        <button
          onClick={() => setIsLive((v) => !v)}
          className={`pointer-events-auto flex items-center gap-2.5 rounded-full px-8 py-4 text-base font-semibold text-white shadow-[0_10px_40px_-10px_rgba(239,68,68,0.8)] ring-1 backdrop-blur-md transition-all active:scale-95 ${
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
        className={`absolute right-0 top-0 z-50 h-full w-[360px] max-w-[90vw] transform overflow-y-auto bg-black/75 backdrop-blur-xl ring-1 ring-white/10 transition-transform duration-300 ${
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
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-6 p-5">
          <button
            className="flex w-full items-center gap-3 rounded-xl bg-gradient-to-r from-white/10 to-white/5 p-3 text-left ring-1 ring-white/10 transition hover:from-white/15 hover:to-white/10"
            onClick={() =>
              alert("Google Sign-In requires Lovable Cloud auth. Ask to enable it to activate.")
            }
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
              <User className="h-5 w-5 text-white" />
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-semibold text-white">Sign in with Google</span>
              <span className="text-[11px] text-white/50">Sync your streaming profile</span>
            </span>
          </button>

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
              placeholder="Paste CricHeroes scorecard link"
              value={overlayInput}
              onChange={(e) => setOverlayInput(e.target.value)}
              className="w-full rounded-lg bg-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/40 outline-none ring-1 ring-white/10 focus:ring-red-400/60"
            />
            <button
              onClick={applyOverlay}
              className="mt-3 w-full rounded-lg bg-red-500/80 py-2.5 text-sm font-semibold text-white ring-1 ring-red-300/30 transition hover:bg-red-500"
            >
              Apply Overlay
            </button>
            {overlayUrl && (
              <>
                <p className="mt-3 text-[11px] leading-relaxed text-white/50">
                  Drag the scoreboard with your finger to move it. Tap the lock icon to freeze it
                  during a broadcast.
                </p>
                <button
                  onClick={() =>
                    setOverlay({ x: 16, y: 80, width: 480, height: 300 })
                  }
                  className="mt-2 w-full rounded-lg bg-white/5 py-2 text-xs font-medium text-white/70 ring-1 ring-white/10 transition hover:bg-white/10"
                >
                  Reset position
                </button>
                <button
                  onClick={() => {
                    setOverlayInput("");
                    setOverlayUrl(null);
                  }}
                  className="mt-2 w-full rounded-lg bg-white/5 py-2 text-xs font-medium text-white/70 ring-1 ring-white/10 transition hover:bg-white/10"
                >
                  Remove overlay
                </button>
              </>
            )}
          </div>

          <div className="h-px bg-white/10" />

          <div className="space-y-3">
            <button
              onClick={flipCamera}
              className="flex w-full items-center justify-between rounded-lg bg-white/5 px-4 py-3 text-sm text-white ring-1 ring-white/10 transition hover:bg-white/10"
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
              className="flex w-full items-center justify-between rounded-lg bg-white/5 px-4 py-3 text-sm text-white ring-1 ring-white/10 transition hover:bg-white/10"
            >
              <span className="flex items-center gap-3">
                {muted ? <MicOff className="h-4 w-4 text-red-400" /> : <Mic className="h-4 w-4" />}
                Microphone
              </span>
              <span className={`text-xs ${muted ? "text-red-400" : "text-emerald-400"}`}>
                {muted ? "Muted" : "Live"}
              </span>
            </button>

            <button
              onClick={() => setReplayEnabled((v) => !v)}
              className="flex w-full items-center justify-between rounded-lg bg-white/5 px-4 py-3 text-sm text-white ring-1 ring-white/10 transition hover:bg-white/10"
            >
              <span className="flex items-center gap-3">
                <Rewind className="h-4 w-4" />
                Instant Replay
              </span>
              <span className={`text-xs ${replayEnabled ? "text-emerald-400" : "text-white/50"}`}>
                {replayEnabled ? `Armed · ${REPLAY_BUFFER_SECONDS}s` : "Off"}
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
            <p className="mt-3 text-[11px] leading-relaxed text-white/40">
              RTMP push from a browser needs a streaming relay. Save keys here and connect a relay
              service to broadcast to both platforms simultaneously.
            </p>
          </div>
        </div>
      </div>

      {settingsOpen && (
        <button
          aria-label="Close settings backdrop"
          onClick={() => setSettingsOpen(false)}
          className="absolute inset-0 z-40 bg-black/20"
        />
      )}
    </div>
  );
}

function OverlayFrame({
  url,
  box,
  onChange,
  locked,
}: {
  url: string;
  box: OverlayBox;
  onChange: (b: OverlayBox) => void;
  locked: boolean;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const gestureRef = useRef<{
    mode: "drag" | null;
    startBox: OverlayBox;
    startPointers: Map<number, { x: number; y: number }>;
  }>({ mode: null, startBox: box, startPointers: new Map() });

  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());

  const clampBox = (b: OverlayBox): OverlayBox => {
    const parent = wrapperRef.current?.parentElement;
    const pw = parent?.clientWidth ?? window.innerWidth;
    const ph = parent?.clientHeight ?? window.innerHeight;
    const width = Math.max(160, Math.min(b.width, pw));
    const height = Math.max(100, Math.min(b.height, ph));
    const x = Math.max(0, Math.min(b.x, pw - width));
    const y = Math.max(0, Math.min(b.y, ph - height));
    return { x, y, width, height };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (locked) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    gestureRef.current = {
      mode: "drag",
      startBox: { ...box },
      startPointers: new Map(pointers.current),
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gestureRef.current;
    if (g.mode !== "drag") return;

    const start = g.startPointers.get(e.pointerId);
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;

    onChange(clampBox({ ...g.startBox, x: g.startBox.x + dx, y: g.startBox.y + dy }));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      gestureRef.current.mode = null;
    }
  };

  const scale = Math.min(box.width / IFRAME_BASE_WIDTH, box.height / IFRAME_BASE_HEIGHT);
  const scaledW = IFRAME_BASE_WIDTH * scale;
  const scaledH = IFRAME_BASE_HEIGHT * scale;

  return (
    <div
      ref={wrapperRef}
      className={`absolute z-20 select-none ${locked ? "" : "cursor-move"}`}
      style={{
        left: box.x,
        top: box.y,
        width: box.width,
        height: box.height,
        touchAction: "none",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="pointer-events-none absolute overflow-hidden"
        style={{
          width: scaledW,
          height: scaledH,
          left: (box.width - scaledW) / 2,
          top: (box.height - scaledH) / 2,
          background: "transparent",
        }}
      >
        <iframe
          src={url}
          title="CricHeroes Scorecard Overlay"
          allow="autoplay"
          scrolling="no"
          style={{
            width: IFRAME_BASE_WIDTH,
            height: IFRAME_BASE_HEIGHT,
            border: 0,
            background: "transparent",
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            display: "block",
          }}
          allowTransparency
        />
      </div>
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
          className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ring-1 transition ${
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
