"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Car,
  CheckCircle2,
  Clock,
  Camera,
  Cctv,
  Activity,
  Video,
  VideoOff,
  X,
  Maximize2,
  LogIn,
  Gauge,
  Timer,
  Wifi,
  WifiOff,
  Radio,
  DoorOpen,
  DoorClosed,
} from "lucide-react";
import { cn, formatDate, formatRelativeTime } from "@/lib/utils";
import type { ParkingSession } from "@/interfaces/parking-session";
import { PAYMENT_STATUS_LABELS, PAYMENT_STATUS_BADGE } from "@/interfaces/parking-session";

interface DashboardStats {
  activeInLot: number;
  validatedEV: number;
  pendingPayment: number;
  totalDetectionsToday: number;
}

interface SystemStatus {
  online?: boolean;
  gate_open?: boolean;
  car_on_loop?: boolean;
  processing?: boolean;
  last_plate?: string | null;
  last_plate_time?: string | null;
  authorized_openings?: number;
  manual_openings?: number;
  devices?: {
    camera_entrada?: { ip?: string; online?: boolean };
    camera_saida?: { ip?: string; online?: boolean };
    sec_entrada?: { ip?: string; online?: boolean };
    sec_saida?: { ip?: string; online?: boolean };
  };
  entrance?: {
    online?: boolean;
    gate_open?: boolean;
    car_on_loop?: boolean;
    processing?: boolean;
    total_detections?: number;
    authorized_openings?: number;
    manual_openings?: number;
    last_plate?: string | null;
    last_plate_time?: string | null;
    uptime_since?: string | null;
  };
}

export default function DashboardOverview() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentSessions, setRecentSessions] = useState<ParkingSession[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  // Tunnel URLs from Firebase
  const [tunnelUrls, setTunnelUrls] = useState<{ entrance: string | null; exit: string | null }>({ entrance: null, exit: null });
  // Entrance camera
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [cameraFullscreen, setCameraFullscreen] = useState(false);
  const [cameraMode, setCameraMode] = useState<"stream" | "snapshot">("stream");
  const cameraImgRef = useRef<HTMLImageElement>(null);
  const cameraIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Exit camera
  const [exitCameraOn, setExitCameraOn] = useState(false);
  const [exitCameraError, setExitCameraError] = useState(false);
  const [exitCameraFullscreen, setExitCameraFullscreen] = useState(false);
  const exitCameraImgRef = useRef<HTMLImageElement>(null);
  const exitCameraIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Gate confirmation modal
  const [gateModal, setGateModal] = useState<{ open: boolean; gate: "entrance" | "exit"; loading: boolean; result: string | null }>({
    open: false, gate: "entrance", loading: false, result: null
  });
  // Fullscreen refs
  const entranceFsImgRef = useRef<HTMLImageElement>(null);
  const exitFsImgRef = useRef<HTMLImageElement>(null);

  // Fetch tunnel URLs from Firebase on mount
  useEffect(() => {
    fetch("/api/camera/tunnels")
      .then(r => r.json())
      .then(data => setTunnelUrls({ entrance: data.entrance || null, exit: data.exit || null }))
      .catch(() => console.error("Failed to fetch tunnel URLs"));
  }, []);

  // Snapshot fallback refresh (only used when MJPEG stream fails)
  const refreshCamera = useCallback(() => {
    if (cameraImgRef.current && cameraOn && cameraMode === "snapshot") {
      const timestamp = Date.now();
      cameraImgRef.current.src = `/api/camera/snapshot?camera=entrance&t=${timestamp}`;
    }
  }, [cameraOn, cameraMode]);

  const startCamera = () => {
    setCameraOn(true);
    setCameraError(false);
    // Use snapshot polling — MJPEG stream blocked (403) via tunnel
    setCameraMode("snapshot");
  };

  const stopCamera = () => {
    setCameraOn(false);
    setCameraError(false);
    setCameraMode("stream");
    if (cameraIntervalRef.current) {
      clearTimeout(cameraIntervalRef.current);
      cameraIntervalRef.current = null;
    }
  };

  const fetchData = async () => {
    try {
      const [statsRes, statusRes] = await Promise.all([
        fetch("/api/dashboard/stats"),
        fetch("/api/dashboard/system-status"),
      ]);
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats);
        setRecentSessions(data.recentSessions || []);
      }
      if (statusRes.ok) {
        const data = await statusRes.json();
        setSystemStatus(data.status || null);
      }
    } catch (err) {
      console.error("Failed to fetch dashboard data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000); // Refresh every 15s
    return () => clearInterval(interval);
  }, []);

  const statsCards = [
    {
      label: "Veículos no Pátio",
      value: stats?.activeInLot ?? "—",
      icon: Car,
    },
    {
      label: "Validados (EV)",
      value: stats?.validatedEV ?? "—",
      icon: CheckCircle2,
    },
    {
      label: "Pendentes",
      value: stats?.pendingPayment ?? "—",
      icon: Clock,
    },
    {
      label: "Detecções Hoje",
      value: stats?.totalDetectionsToday ?? "—",
      icon: Camera,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger">
        {statsCards.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-[hsl(var(--muted-foreground))]">
                {stat.label}
              </span>
              <stat.icon className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className={cn(
                "text-2xl font-bold tracking-tight",
                loading && "animate-pulse text-[hsl(var(--muted-foreground))]"
              )}>
                {stat.value}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Gate Controls Bar */}
      <div className="flex items-center gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-5 py-3">
        <DoorOpen className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
        <span className="text-sm font-semibold">Cancela</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setGateModal({ open: true, gate: "entrance", loading: false, result: null })}
            className="inline-flex items-center gap-2 rounded-lg border border-[hsl(142,70%,40%/0.3)] bg-[hsl(142,70%,40%/0.08)] px-4 py-2 text-xs font-semibold text-[hsl(142,70%,50%)] hover:bg-[hsl(142,70%,40%/0.25)] hover:border-[hsl(142,70%,40%/0.5)] transition-all cursor-pointer"
          >
            <DoorOpen className="h-4 w-4" />
            Abrir Entrada
          </button>
          <button
            onClick={() => setGateModal({ open: true, gate: "exit", loading: false, result: null })}
            className="inline-flex items-center gap-2 rounded-lg border border-[hsl(210,80%,50%/0.3)] bg-[hsl(210,80%,50%/0.08)] px-4 py-2 text-xs font-semibold text-[hsl(210,80%,60%)] hover:bg-[hsl(210,80%,50%/0.25)] hover:border-[hsl(210,80%,50%/0.5)] transition-all cursor-pointer"
          >
            <DoorOpen className="h-4 w-4" />
            Abrir Saída
          </button>
        </div>
      </div>

      {/* Camera + Quick Stats + Status Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Camera Feed */}
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
          <div className="mb-4 flex items-center gap-2">
            <Camera className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <h2 className="text-sm font-semibold">Câmera LPR de Entrada</h2>
            {cameraOn ? (
              <button
                onClick={stopCamera}
                className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-[hsl(var(--border))] px-2 py-1 text-xs font-medium text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))] transition-colors"
              >
                <VideoOff className="h-3 w-3" />
                Desligar
              </button>
            ) : (
              <span className="ml-auto flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--muted))]" />
                Desligada
              </span>
            )}
          </div>

          {cameraOn ? (
            <div
              className="relative overflow-hidden rounded-lg bg-black cursor-pointer flex items-center justify-center"
              style={{ height: "220px" }}
              onDoubleClick={() => setCameraFullscreen(true)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={cameraImgRef}
                src={cameraMode === "stream"
                  ? "/api/camera/stream?camera=entrance"
                  : `/api/camera/snapshot?camera=entrance&t=${Date.now()}`
                }
                alt="Câmera LPR"
                className={cn(
                  "h-full w-full object-contain",
                  cameraError ? "opacity-0" : "opacity-100"
                )}
                onLoad={() => {
                  setCameraError(false);
                  // Only poll for snapshot mode; MJPEG stream auto-updates
                  if (cameraMode === "snapshot") {
                    if (cameraIntervalRef.current) clearTimeout(cameraIntervalRef.current);
                    cameraIntervalRef.current = setTimeout(refreshCamera, 100);
                  }
                }}
                onError={() => {
                  if (cameraMode === "stream") {
                    // MJPEG stream failed — fall back to snapshot polling
                    console.warn("MJPEG stream failed, falling back to snapshot mode");
                    setCameraMode("snapshot");
                    setCameraError(false);
                  } else {
                    setCameraError(true);
                    if (cameraIntervalRef.current) clearTimeout(cameraIntervalRef.current);
                    cameraIntervalRef.current = setTimeout(refreshCamera, 3000);
                  }
                }}
              />
              {/* Live indicator */}
              {!cameraError && (
                <div className="absolute top-3 right-3 flex items-center gap-3">
                  <div className="flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 backdrop-blur-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--status-success))] animate-pulse-dot" />
                    <span className="text-xs font-medium text-white">Ao vivo</span>
                  </div>
                  <button
                    onClick={() => setCameraFullscreen(true)}
                    className="flex items-center justify-center rounded-full bg-black/60 p-1.5 backdrop-blur-sm hover:bg-black/80 transition-colors"
                    title="Tela cheia (duplo clique)"
                  >
                    <Maximize2 className="h-3.5 w-3.5 text-white" />
                  </button>
                </div>
              )}
              {cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <Camera className="mx-auto h-8 w-8 text-[hsl(var(--muted-foreground))]" />
                  <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
                    Câmera indisponível. Tentando reconectar...
                  </p>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={startCamera}
              className="flex w-full items-center justify-center rounded-lg bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--secondary)/0.8)] transition-colors cursor-pointer group"
              style={{ height: "220px" }}
            >
              <div className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--primary)/0.1)] group-hover:bg-[hsl(var(--primary)/0.2)] transition-colors">
                  <Video className="h-7 w-7 text-[hsl(var(--primary))]" />
                </div>
                <p className="mt-3 text-sm font-medium text-[hsl(var(--muted-foreground))] group-hover:text-[hsl(var(--foreground))] transition-colors">
                  Clique para ligar a câmera
                </p>
              </div>
            </button>
          )}
        </div>

        {/* Exit Camera Feed */}
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
          <div className="mb-4 flex items-center gap-2">
            <Camera className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <h2 className="text-sm font-semibold">Câmera de Saída</h2>
            {exitCameraOn ? (
              <button
                onClick={() => { 
                  setExitCameraOn(false); 
                  setExitCameraError(false);
                  if (exitCameraIntervalRef.current) { clearTimeout(exitCameraIntervalRef.current); exitCameraIntervalRef.current = null; }
                }}
                className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-[hsl(var(--border))] px-2 py-1 text-xs font-medium text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))] transition-colors"
              >
                <VideoOff className="h-3 w-3" />
                Desligar
              </button>
            ) : (
              <span className="ml-auto flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--muted))]" />
                Desligada
              </span>
            )}
          </div>

          {exitCameraOn ? (
            <div
              className="relative overflow-hidden rounded-lg bg-black cursor-pointer flex items-center justify-center"
              style={{ height: "220px" }}
              onDoubleClick={() => setExitCameraFullscreen(true)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={exitCameraImgRef}
                src={`/api/camera/snapshot?camera=exit&t=${Date.now()}`}
                alt="Câmera Saída"
                className={cn(
                  "h-full w-full object-contain",
                  exitCameraError ? "opacity-0" : "opacity-100"
                )}
                onLoad={() => {
                  setExitCameraError(false);
                  if (exitCameraIntervalRef.current) clearTimeout(exitCameraIntervalRef.current);
                  exitCameraIntervalRef.current = setTimeout(() => {
                    if (exitCameraImgRef.current) {
                      exitCameraImgRef.current.src = `/api/camera/snapshot?camera=exit&t=${Date.now()}`;
                    }
                  }, 100);
                }}
                onError={() => {
                  setExitCameraError(true);
                  if (exitCameraIntervalRef.current) clearTimeout(exitCameraIntervalRef.current);
                  exitCameraIntervalRef.current = setTimeout(() => {
                    if (exitCameraImgRef.current) {
                      exitCameraImgRef.current.src = `/api/camera/snapshot?camera=exit&t=${Date.now()}`;
                    }
                  }, 3000);
                }}
              />
              {!exitCameraError && (
                <div className="absolute top-3 right-3 flex items-center gap-3">
                  <div className="flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 backdrop-blur-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--status-success))] animate-pulse-dot" />
                    <span className="text-xs font-medium text-white">Ao vivo</span>
                  </div>
                  <button
                    onClick={() => setExitCameraFullscreen(true)}
                    className="flex items-center justify-center rounded-full bg-black/60 p-1.5 backdrop-blur-sm hover:bg-black/80 transition-colors"
                    title="Tela cheia (duplo clique)"
                  >
                    <Maximize2 className="h-3.5 w-3.5 text-white" />
                  </button>
                </div>
              )}
              {exitCameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <Camera className="mx-auto h-8 w-8 text-[hsl(var(--muted-foreground))]" />
                  <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
                    Câmera indisponível
                  </p>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => { setExitCameraOn(true); setExitCameraError(false); }}
              className="flex w-full items-center justify-center rounded-lg bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--secondary)/0.8)] transition-colors cursor-pointer group"
              style={{ height: "220px" }}
            >
              <div className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--primary)/0.1)] group-hover:bg-[hsl(var(--primary)/0.2)] transition-colors">
                  <Video className="h-7 w-7 text-[hsl(var(--primary))]" />
                </div>
                <p className="mt-3 text-sm font-medium text-[hsl(var(--muted-foreground))] group-hover:text-[hsl(var(--foreground))] transition-colors">
                  Clique para ligar a câmera
                </p>
              </div>
            </button>
          )}
        </div>

        {/* System Status — Devices */}
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
          <div className="mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <h2 className="text-sm font-semibold">Status dos Dispositivos</h2>
            {systemStatus?.online !== undefined && (
              <span className={cn(
                "ml-auto flex items-center gap-1.5 text-[10px] font-medium rounded-full px-2.5 py-1",
                systemStatus.online
                  ? "bg-[hsl(var(--status-success)/0.15)] text-[hsl(var(--status-success))]"
                  : "bg-[hsl(var(--status-error)/0.15)] text-[hsl(var(--status-error))]"
              )}>
                <span className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  systemStatus.online ? "bg-[hsl(var(--status-success))] animate-pulse-dot" : "bg-[hsl(var(--status-error))]"
                )} />
                {systemStatus.online ? "Online" : "Offline"}
              </span>
            )}
          </div>

          {/* Device Grid */}
          <div className="grid grid-cols-2 gap-2">
            {([
              { key: "camera_entrada", label: "Câmera Entrada", icon: Cctv, emoji: "📷" },
              { key: "camera_saida", label: "Câmera Saída", icon: Cctv, emoji: "📷" },
              { key: "sec_entrada", label: "Sensor Entrada", icon: Radio, emoji: "📡" },
              { key: "sec_saida", label: "Sensor Saída", icon: Radio, emoji: "📡" },
            ] as const).map((device) => {
              const info = systemStatus?.devices?.[device.key as keyof NonNullable<SystemStatus["devices"]>];
              const isOnline = info?.online ?? false;
              const ip = info?.ip;
              return (
                <div
                  key={device.key}
                  className={cn(
                    "relative rounded-xl p-5 transition-all duration-300",
                    "border-l-4",
                    isOnline
                      ? "border-l-[hsl(var(--status-success))] bg-[hsl(var(--status-success)/0.06)]"
                      : "border-l-[hsl(var(--status-error))] bg-[hsl(var(--status-error)/0.06)]"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-xl",
                        isOnline
                          ? "bg-[hsl(var(--status-success)/0.15)]"
                          : "bg-[hsl(var(--status-error)/0.15)]"
                      )}>
                        <device.icon className={cn(
                          "h-6 w-6",
                          isOnline ? "text-[hsl(var(--status-success))]" : "text-[hsl(var(--status-error))]"
                        )} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{device.label}</div>
                        {ip && (
                          <div className="text-xs font-mono text-[hsl(var(--muted-foreground))] mt-0.5">{ip}</div>
                        )}
                      </div>
                    </div>
                    <div className={cn(
                      "flex items-center gap-1.5 rounded-full px-2.5 py-1",
                      isOnline
                        ? "bg-[hsl(var(--status-success)/0.15)]"
                        : "bg-[hsl(var(--status-error)/0.15)]"
                    )}>
                      <span className={cn(
                        "h-2 w-2 rounded-full",
                        isOnline ? "bg-[hsl(var(--status-success))] animate-pulse-dot" : "bg-[hsl(var(--status-error))]"
                      )} />
                      <span className={cn(
                        "text-xs font-bold",
                        isOnline ? "text-[hsl(var(--status-success))]" : "text-[hsl(var(--status-error))]"
                      )}>
                        {isOnline ? "ON" : "OFF"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary bar */}
          {systemStatus?.devices && (
            <div className="mt-3 flex items-center justify-center gap-4 rounded-lg bg-[hsl(var(--secondary)/0.3)] px-3 py-2">
              <div className="flex items-center gap-1.5 text-[10px]">
                <span className="h-2 w-2 rounded-full bg-[hsl(var(--status-success))]" />
                <span className="font-semibold text-[hsl(var(--status-success))]">
                  {Object.values(systemStatus.devices).filter((d: { online?: boolean }) => d?.online).length}
                </span>
                <span className="text-[hsl(var(--muted-foreground))]">online</span>
              </div>
              <div className="h-3 w-px bg-[hsl(var(--border))]" />
              <div className="flex items-center gap-1.5 text-[10px]">
                <span className="h-2 w-2 rounded-full bg-[hsl(var(--status-error))]" />
                <span className="font-semibold text-[hsl(var(--status-error))]">
                  {Object.values(systemStatus.devices).filter((d: { online?: boolean }) => !d?.online).length}
                </span>
                <span className="text-[hsl(var(--muted-foreground))]">offline</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-4">
          <div className="flex items-center gap-2">
            <LogIn className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <h2 className="text-sm font-semibold">Atividade Recente</h2>
            {recentSessions.length > 0 && (
              <span className="text-[10px] text-[hsl(var(--muted-foreground))] bg-[hsl(var(--secondary))] rounded-full px-2 py-0.5">
                {recentSessions.length}
              </span>
            )}
          </div>
          <a
            href="/dashboard/tickets"
            className="text-xs text-[hsl(var(--primary))] hover:underline"
          >
            Ver todas →
          </a>
        </div>
        <div className="p-4">
          {loading && recentSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[hsl(var(--muted-foreground))]">
              <div className="license-plate license-plate--skeleton mb-3">
                <div className="license-plate__header">
                  <span className="license-plate__flag" />
                  <span className="license-plate__country">BRASIL</span>
                </div>
                <div className="license-plate__number">• • • • • • •</div>
              </div>
              <p className="text-sm animate-pulse">Carregando atividade recente...</p>
            </div>
          ) : recentSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[hsl(var(--muted-foreground))]">
              <Car className="h-10 w-10 mb-2 opacity-30" />
              <p className="text-sm">Nenhuma sessão registrada.</p>
            </div>
          ) : (
            <div className="space-y-3 stagger">
              {recentSessions.map((session) => {
                const entryDate = new Date(session.entry_time);
                const now = new Date();
                const isActive = session.status === "active";
                const isResident = session.vehicle_type === "morador" || session.vehicle_type === "admin";

                // Duration calculation
                let durationStr: string;
                if (isActive) {
                  const durationMs = now.getTime() - entryDate.getTime();
                  const durationMins = Math.floor(durationMs / 60000);
                  const durationH = Math.floor(durationMins / 60);
                  const durationM = durationMins % 60;
                  durationStr = durationH > 0 ? `${durationH}h ${durationM}min` : `${durationM}min`;
                } else {
                  const mins = session.duration_minutes ?? 0;
                  const h = Math.floor(mins / 60);
                  const m = Math.round(mins % 60);
                  durationStr = h > 0 ? `${h}h ${m}min` : `${m}min`;
                }

                const confidence = session.recognition_confidence || 0;

                return (
                  <div
                    key={session.id}
                    className={cn(
                      "group flex items-center gap-4 rounded-lg border px-4 py-3 transition-all duration-200 hover:shadow-md",
                      "border-l-4",
                      isActive
                        ? "border-[hsl(var(--border))] border-l-[hsl(var(--status-success))] bg-[hsl(var(--status-success)/0.03)] hover:bg-[hsl(var(--status-success)/0.06)]"
                        : "border-[hsl(var(--border))] border-l-[hsl(var(--muted-foreground)/0.3)] bg-[hsl(var(--secondary)/0.15)] hover:bg-[hsl(var(--secondary)/0.3)]"
                    )}
                  >
                    {/* Plate */}
                    <div className="license-plate shrink-0">
                      <div className="license-plate__header">
                        <div className="license-plate__mercosul">
                          <span className="license-plate__mercosul-stars">✦</span>
                        </div>
                        <span className="license-plate__country">BRASIL</span>
                        <div className="license-plate__flag">
                          <span className="license-plate__flag-green" />
                          <span className="license-plate__flag-yellow" />
                          <span className="license-plate__flag-blue" />
                        </div>
                      </div>
                      <div className="license-plate__number">{session.plate}</div>
                    </div>

                    {/* Info */}
                    <div className="flex flex-1 flex-col gap-1.5 min-w-0">
                      {/* Row 1: Type + Owner */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold",
                          isResident
                            ? "bg-[hsl(210,80%,50%/0.15)] text-[hsl(210,80%,60%)]"
                            : "bg-[hsl(30,80%,50%/0.15)] text-[hsl(30,80%,60%)]"
                        )}>
                          {isResident ? "🏠 Morador" : "🚗 Visitante"}
                        </span>
                        <span className={cn("badge", PAYMENT_STATUS_BADGE[session.payment_status] || "badge-warning")}>
                          {PAYMENT_STATUS_LABELS[session.payment_status] || session.payment_status}
                        </span>
                        {session.owner_name && (
                          <span className="text-sm font-medium text-[hsl(var(--foreground)/0.8)]">
                            {session.owner_name}
                          </span>
                        )}
                      </div>

                      {/* Row 2: Details */}
                      <div className="flex items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]">
                        <span className="inline-flex items-center gap-1" title="Horário de entrada">
                          <LogIn className="h-3 w-3" />
                          {new Date(session.entry_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {session.exit_time && (
                          <span className="inline-flex items-center gap-1" title="Horário de saída">
                            <Clock className="h-3 w-3" />
                            {new Date(session.exit_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1" title="Duração">
                          <Timer className="h-3 w-3" />
                          {durationStr}
                        </span>
                        <span className={cn(
                          "inline-flex items-center gap-1 font-semibold",
                          confidence >= 80 ? "text-[hsl(var(--status-success))]" :
                          confidence >= 50 ? "text-[hsl(var(--status-warning))]" :
                          "text-[hsl(var(--status-error))]"
                        )} title="Confiança LPR">
                          <Gauge className="h-3 w-3" />
                          {confidence.toFixed(0)}%
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px]" title="Abertura da cancela">
                          {session.gate_opened_by === "auto_lpr" ? "🤖 Auto LPR" : session.gate_opened_by === "manual" ? "👋 Manual" : `⚙️ ${session.gate_opened_by}`}
                        </span>
                        <span className="ml-auto text-[10px] text-[hsl(var(--muted-foreground)/0.5)]">
                          {formatDate(session.entry_time)}
                        </span>
                      </div>
                    </div>

                    {/* Status */}
                    <span className={cn(
                      "shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
                      isActive
                        ? "bg-[hsl(var(--status-success)/0.12)] text-[hsl(var(--status-success))]"
                        : "bg-[hsl(var(--secondary)/0.5)] text-[hsl(var(--muted-foreground))]"
                    )}>
                      {isActive ? (
                        <>
                          <span className="h-2 w-2 rounded-full bg-[hsl(var(--status-success))] animate-pulse-dot" />
                          No pátio
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Finalizada
                        </>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Camera Modal */}
      {cameraFullscreen && cameraOn && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in"
          onClick={() => setCameraFullscreen(false)}
          onKeyDown={(e) => e.key === "Escape" && setCameraFullscreen(false)}
          tabIndex={0}
        >
          {/* Close button */}
          <button
            onClick={() => setCameraFullscreen(false)}
            className="absolute top-6 right-6 z-10 flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm hover:bg-white/20 transition-colors"
          >
            <X className="h-4 w-4" />
            Fechar
          </button>

          {/* Live badge */}
          <div className="absolute top-6 left-6 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 backdrop-blur-sm">
            <span className="h-2 w-2 rounded-full bg-[hsl(var(--status-success))] animate-pulse-dot" />
            <span className="text-sm font-medium text-white">Ao vivo</span>
          </div>

          {/* Full image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={entranceFsImgRef}
            src={`/api/camera/snapshot?camera=entrance&t=${Date.now()}`}
            alt="Câmera LPR - Tela Cheia"
            className="max-h-[90vh] max-w-[95vw] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
            onLoad={() => {
              setTimeout(() => {
                if (entranceFsImgRef.current) {
                  entranceFsImgRef.current.src = `/api/camera/snapshot?camera=entrance&t=${Date.now()}`;
                }
              }, 100);
            }}
          />
        </div>
      )}

      {/* Exit Camera Fullscreen Modal */}
      {exitCameraFullscreen && exitCameraOn && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setExitCameraFullscreen(false)}
        >
          <button
            onClick={() => setExitCameraFullscreen(false)}
            className="absolute top-6 right-6 z-10 inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm hover:bg-white/20 transition-colors"
          >
            <X className="h-4 w-4" />
            Fechar
          </button>

          <div className="absolute top-6 left-6 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 backdrop-blur-sm">
            <span className="h-2 w-2 rounded-full bg-[hsl(var(--status-success))] animate-pulse-dot" />
            <span className="text-sm font-medium text-white">Câmera Saída — Ao vivo</span>
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={exitFsImgRef}
            src={`/api/camera/snapshot?camera=exit&t=${Date.now()}`}
            alt="Câmera Saída - Tela Cheia"
            className="max-h-[90vh] max-w-[95vw] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
            onLoad={() => {
              setTimeout(() => {
                if (exitFsImgRef.current) {
                  exitFsImgRef.current.src = `/api/camera/snapshot?camera=exit&t=${Date.now()}`;
                }
              }, 100);
            }}
          />
        </div>
      )}
      {/* Gate Confirmation Modal */}
      {gateModal.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => !gateModal.loading && setGateModal(prev => ({ ...prev, open: false }))}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {gateModal.result ? (
              /* Result state */
              <div className="text-center">
                <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${
                  gateModal.result.startsWith("✅") 
                    ? "bg-[hsl(142,70%,40%/0.15)]" 
                    : "bg-[hsl(0,70%,40%/0.15)]"
                }`}>
                  <span className="text-3xl">{gateModal.result.startsWith("✅") ? "✅" : "❌"}</span>
                </div>
                <p className="text-sm text-[hsl(var(--foreground))]">{gateModal.result.replace(/^[✅❌]\s*/, "")}</p>
                <button
                  onClick={() => setGateModal(prev => ({ ...prev, open: false }))}
                  className="mt-5 w-full rounded-lg bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-semibold text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity"
                >
                  Fechar
                </button>
              </div>
            ) : gateModal.loading ? (
              /* Loading state */
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[hsl(var(--muted))] border-t-[hsl(var(--primary))]" />
                <p className="text-sm text-[hsl(var(--muted-foreground))]">Abrindo cancela...</p>
              </div>
            ) : (
              /* Confirmation state */
              <>
                <div className="mb-5 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--primary)/0.1)]">
                    <DoorOpen className="h-8 w-8 text-[hsl(var(--primary))]" />
                  </div>
                  <h3 className="text-lg font-bold text-[hsl(var(--foreground))]">
                    Abrir Cancela de {gateModal.gate === "entrance" ? "Entrada" : "Saída"}?
                  </h3>
                  <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                    A cancela será aberta remotamente.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setGateModal(prev => ({ ...prev, open: false }))}
                    className="flex-1 rounded-lg border border-[hsl(var(--border))] px-4 py-2.5 text-sm font-semibold text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={async () => {
                      setGateModal(prev => ({ ...prev, loading: true }));
                      try {
                        const res = await fetch("/api/gate/open", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ gate: gateModal.gate }),
                        });
                        const data = await res.json();
                        if (res.ok) {
                          setGateModal(prev => ({ ...prev, loading: false, result: "✅ " + data.message }));
                        } else {
                          setGateModal(prev => ({ ...prev, loading: false, result: "❌ " + (data.error || "Erro desconhecido") }));
                        }
                      } catch {
                        setGateModal(prev => ({ ...prev, loading: false, result: "❌ Falha de conexão" }));
                      }
                    }}
                    className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-bold text-white transition-colors ${
                      gateModal.gate === "entrance"
                        ? "bg-[hsl(142,70%,40%)] hover:bg-[hsl(142,70%,35%)]"
                        : "bg-[hsl(210,80%,50%)] hover:bg-[hsl(210,80%,45%)]"
                    }`}
                  >
                    Confirmar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
