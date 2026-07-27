import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Settings,
  X,
  Mic,
  MicOff,
  SwitchCamera,
  Radio,
  Upload,
  Megaphone,
  RotateCw,
  Youtube,
  Facebook,
  Check,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cric Seven Live — Broadcast Studio" },
      {
        name: "description",
        content:
          "Cric Seven Live: tablet-first cricket broadcasting studio with live camera, CricHeroes scorecard overlay, ads and lower-thirds.",
      },
      { property: "og:title", content: "Cric Seven Live — Broadcast Studio" },
      {
        property: "og:description",
        content:
          "Cric Seven Live: tablet-first cricket broadcasting studio with live camera, CricHeroes scorecard overlay, ads and lower-thirds.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Resolution = "720p" | "1080p";
type Facing = "user" | "environment";
type Rotation = 0 | 90 | 180 | 270;

function Index() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const adVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [facing, setFacing] = useState<Facing>("environment");
  const [resolution, setResolution] = useState<Resolution>("1080p");

  const [urlInput, setUrlInput] = useState("");
  const [overlayUrl, setOverlayUrl] = useState("");

  const [adUrl, setAdUrl] = useState("");
  const [playAd, setPlayAd] = useState(false);

  const [lowerThirdOn, setLowerThirdOn] = useState(false);
  const [lowerThirdText, setLowerThirdText] = useState(
    "Cric Seven Live · Powered by CricHeroes · Sponsored broadcast",
  );

  const [scorePos, setScorePos] = useState<{ x: number; y: number }>({ x: 16, y: 80 });
  const [scoreScale, setScoreScale] = useState(1);
  const [rotation, setRotation] = useState<Rotation>(0);

  const [ytConnected, setYtConnected] = useState(false);
  const [fbConnected, setFbConnected] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 640) setScoreScale(0.95);
      else if (window.innerWidth < 1024) setScoreScale(1.15);
      else setScoreScale(1.35);
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        const height = resolution === "1080p" ? 1080 : 720;
        const width = resolution === "1080p" ? 1920 : 1280;
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: width },
            height: { ideal: height },
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
          await videoRef.current.play().catch(() => {});
        }
      } catch (err) {
        console.error("Camera init failed", err);
      }
    }
    start();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing, resolution]);

  useEffect(() => {
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !muted));
  }, [muted]);

  useEffect(() => {
    const el = adVideoRef.current;
    if (!el) return;
    if (playAd && adUrl) {
      el.currentTime = 0;
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [playAd, adUrl]);

  function onAdFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAdUrl(URL.createObjectURL(file));
  }

  function applyOverlay() {
    setOverlayUrl(urlInput.trim());
  }

  const gesture = useRef({ startX: 0, startY: 0, origX: 0, origY: 0, dragging: false });

  function onScorePointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    gesture.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: scorePos.x,
      origY: scorePos.y,
      dragging: true,
    };
  }
  function onScorePointerMove(e: React.PointerEvent) {
    if (!gesture.current.dragging) return;
    setScorePos({
      x: gesture.current.origX + (e.clientX - gesture.current.startX),
      y: gesture.current.origY + (e.clientY - gesture.current.startY),
    });
  }
  function onScorePointerUp() {
    gesture.current.dragging = false;
  }

  function fakeConnect(which: "yt" | "fb") {
    setTimeout(() => {
      if (which === "yt") setYtConnected(true);
      else setFbConnected(true);
    }, 600);
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black text-white select-none">
      {/* Background Camera */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: `rotate(${rotation}deg)` }}
      />

      {/* Scorecard iframe overlay (draggable) */}
      {overlayUrl && (
        <div
          onPointerDown={onScorePointerDown}
          onPointerMove={onScorePointerMove}
          onPointerUp={onScorePointerUp}
          onPointerCancel={onScorePointerUp}
          className="absolute z-20 touch-none cursor-move shadow-2xl rounded-xl overflow-hidden border-2 border-red-600/40 ring-1 ring-white/10"
          style={{
            top: scorePos.y,
            left: scorePos.x,
            width: 460 * scoreScale,
            height: 300 * scoreScale,
            background: "black",
          }}
        >
          {/* CRIC SEVEN logo on top of scorecard */}
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-center gap-2 bg-gradient-to-b from-red-700 to-red-600 px-3 py-1.5 border-b border-red-900/50 shadow-md pointer-events-none">
            <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-red-600 font-black text-[11px] leading-none shadow">
              7
            </div>
            <span className="text-white font-black tracking-[0.2em] text-sm drop-shadow">
              CRIC SEVEN
            </span>
            <span className="text-white/80 text-[10px] font-bold tracking-widest">LIVE</span>
          </div>
          <iframe
            src={overlayUrl}
            title="Scorecard"
            className="w-full h-full pointer-events-none pt-9"
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      )}

      {/* Ad video */}
      {adUrl && playAd && (
        <video
          ref={adVideoRef}
          src={adUrl}
          className="absolute inset-0 w-full h-full object-contain bg-black z-30"
          onEnded={() => setPlayAd(false)}
          controls={false}
          playsInline
        />
      )}

      {/* Lower Third Ticker */}
      {lowerThirdOn && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 w-[92%] max-w-4xl bg-zinc-950/90 border-l-4 border-red-600 px-4 py-2 z-20 rounded shadow-lg flex items-center">
          <Megaphone className="text-red-500 mr-3 shrink-0 animate-bounce" size={18} />
          <div className="overflow-hidden whitespace-nowrap flex-1">
            <div className="inline-block animate-[ticker_20s_linear_infinite] text-sm font-semibold tracking-wide text-zinc-100">
              {lowerThirdText}
            </div>
          </div>
        </div>
      )}

      {/* LIVE badge */}
      {isLive && (
        <div className="absolute top-4 left-4 z-40 flex items-center gap-2 bg-red-600 px-3 py-1.5 rounded-full text-xs font-black tracking-wider shadow-lg">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> LIVE
        </div>
      )}

      {/* Bottom Dashboard */}
      <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black via-zinc-950 to-zinc-900/95 backdrop-blur-xl border-t border-zinc-800 px-4 py-3 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          {/* Left icon cluster */}
          <div className="flex items-center gap-2 sm:gap-3">
            {[
              { icon: Settings, label: "Settings", onClick: () => setSidebarOpen(true), active: false },
              {
                icon: muted ? MicOff : Mic,
                label: "Mute",
                onClick: () => setMuted((m) => !m),
                active: muted,
              },
              {
                icon: SwitchCamera,
                label: "Camera",
                onClick: () => setFacing((f) => (f === "user" ? "environment" : "user")),
                active: false,
              },
              {
                icon: RotateCw,
                label: "Rotate",
                onClick: () => setRotation((r) => ((r + 90) % 360) as Rotation),
                active: rotation !== 0,
              },
              {
                icon: Megaphone,
                label: "Ticker",
                onClick: () => setLowerThirdOn((v) => !v),
                active: lowerThirdOn,
              },
            ].map(({ icon: Icon, label, onClick, active }) => (
              <button
                key={label}
                onClick={onClick}
                aria-label={label}
                className={`group flex flex-col items-center justify-center gap-1 w-14 h-14 rounded-xl border transition ${
                  active
                    ? "bg-red-600 border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.6)]"
                    : "bg-zinc-900/80 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700"
                }`}
              >
                <Icon size={22} strokeWidth={2.4} />
                <span className="text-[9px] font-bold tracking-wider uppercase text-zinc-300 group-hover:text-white">
                  {label}
                </span>
              </button>
            ))}
          </div>

          {/* Right: GO LIVE + AD */}
          <div className="flex items-center gap-2 sm:gap-3">
            <label className="flex flex-col items-center justify-center gap-1 w-14 h-14 rounded-xl border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 cursor-pointer">
              <Upload size={20} strokeWidth={2.4} />
              <span className="text-[9px] font-bold tracking-wider uppercase text-zinc-300">AD</span>
              <input type="file" accept="video/*" onChange={onAdFile} className="hidden" />
            </label>
            {adUrl && (
              <button
                onClick={() => setPlayAd((v) => !v)}
                className={`h-14 px-4 rounded-xl text-xs font-black uppercase tracking-wider border ${
                  playAd
                    ? "bg-red-600 border-red-500"
                    : "bg-zinc-900/80 border-zinc-800 hover:bg-zinc-800"
                }`}
              >
                {playAd ? "Stop" : "Play"}
              </button>
            )}
            <button
              onClick={() => setIsLive((v) => !v)}
              className={`h-14 flex items-center gap-2 px-6 rounded-xl font-black text-sm uppercase tracking-widest border-2 transition ${
                isLive
                  ? "bg-red-600 border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.7)] animate-pulse"
                  : "bg-gradient-to-b from-red-600 to-red-700 border-red-500 hover:from-red-500 hover:to-red-600 shadow-lg"
              }`}
            >
              <Radio size={18} strokeWidth={2.8} />
              {isLive ? "LIVE" : "GO LIVE"}
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      {sidebarOpen && (
        <div className="absolute inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/60"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="w-full max-w-md h-full bg-zinc-950 border-l border-zinc-800 overflow-y-auto p-5 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black tracking-wide">Broadcast Settings</h2>
              <button
                className="p-2 rounded-lg hover:bg-zinc-800"
                onClick={() => setSidebarOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <section className="space-y-2">
              <label className="text-xs font-bold uppercase text-zinc-400">Resolution</label>
              <div className="flex gap-2">
                {(["720p", "1080p"] as Resolution[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setResolution(r)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold ${resolution === r ? "bg-red-600" : "bg-zinc-800 hover:bg-zinc-700"}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <label className="text-xs font-bold uppercase text-zinc-400">
                CricHeroes Scorecard URL
              </label>
              <div className="flex gap-2">
                <input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://cricheroes.com/..."
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-600"
                />
                <button
                  onClick={applyOverlay}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-bold"
                >
                  Apply
                </button>
              </div>
              {overlayUrl && (
                <button
                  onClick={() => {
                    setOverlayUrl("");
                    setUrlInput("");
                  }}
                  className="text-xs text-zinc-400 hover:text-white underline"
                >
                  Remove overlay
                </button>
              )}
            </section>

            <section className="space-y-2">
              <label className="text-xs font-bold uppercase text-zinc-400">
                Lower Third Text
              </label>
              <textarea
                value={lowerThirdText}
                onChange={(e) => setLowerThirdText(e.target.value)}
                rows={2}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-600 resize-none"
              />
            </section>

            <section className="space-y-3">
              <label className="text-xs font-bold uppercase text-zinc-400">
                Streaming Destinations
              </label>
              <button
                onClick={() => fakeConnect("yt")}
                disabled={ytConnected}
                className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg disabled:opacity-70"
              >
                <span className="flex items-center gap-2 font-bold text-sm">
                  <Youtube size={20} className="text-red-500" /> YouTube Live
                </span>
                {ytConnected ? (
                  <span className="flex items-center gap-1 text-xs text-green-400 font-bold">
                    <Check size={14} /> Connected
                  </span>
                ) : (
                  <span className="text-xs text-zinc-400">Connect</span>
                )}
              </button>
              <button
                onClick={() => fakeConnect("fb")}
                disabled={fbConnected}
                className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg disabled:opacity-70"
              >
                <span className="flex items-center gap-2 font-bold text-sm">
                  <Facebook size={20} className="text-blue-500" /> Facebook Live
                </span>
                {fbConnected ? (
                  <span className="flex items-center gap-1 text-xs text-green-400 font-bold">
                    <Check size={14} /> Connected
                  </span>
                ) : (
                  <span className="text-xs text-zinc-400">Connect</span>
                )}
              </button>
              <p className="text-[11px] leading-relaxed text-zinc-500">
                Note: Browsers can't push RTMP directly. Real streaming requires a
                backend relay; this demo simulates the connect handshake.
              </p>
            </section>
          </div>
        </div>
      )}

      <style>{`
        @keyframes ticker {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
}
