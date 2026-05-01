"use client";

import { useState, useEffect } from "react";
import {
  Car,
  CheckCircle2,
  Clock,
  Camera,
  Activity,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import type { ParkingSession } from "@/interfaces/parking-session";

interface DashboardStats {
  activeInLot: number;
  validatedEV: number;
  pendingPayment: number;
  totalDetectionsToday: number;
}

export default function DashboardOverview() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentSessions, setRecentSessions] = useState<ParkingSession[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/dashboard/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setRecentSessions(data.recentSessions || []);
      }
    } catch (err) {
      console.error("Failed to fetch dashboard stats", err);
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

      {/* Camera + Status Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Camera Feed */}
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
          <div className="mb-4 flex items-center gap-2">
            <Camera className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <h2 className="text-sm font-semibold">Câmera LPR de Entrada</h2>
            <span className="ml-auto flex items-center gap-1.5 text-xs text-[hsl(var(--status-success))]">
              <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--status-success))] animate-pulse-dot" />
              Ao vivo
            </span>
          </div>
          <div className="flex aspect-video items-center justify-center rounded-lg bg-[hsl(var(--secondary))]">
            <div className="text-center">
              <Camera className="mx-auto h-8 w-8 text-[hsl(var(--muted-foreground))]" />
              <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
                Integração com câmera de reconhecimento pendente.
              </p>
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
          <div className="mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <h2 className="text-sm font-semibold">Resumo do Sistema</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-[hsl(var(--secondary)/0.5)] p-3">
              <span className="text-sm text-[hsl(var(--muted-foreground))]">API Status</span>
              <span className="flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--status-success))]">
                <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--status-success))]" />
                Online
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[hsl(var(--secondary)/0.5)] p-3">
              <span className="text-sm text-[hsl(var(--muted-foreground))]">Firestore Rules</span>
              <span className="flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--status-success))]">
                <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--status-success))]" />
                Locked
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[hsl(var(--secondary)/0.5)] p-3">
              <span className="text-sm text-[hsl(var(--muted-foreground))]">Sessões Ativas</span>
              <span className="text-sm font-semibold">{stats?.activeInLot ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[hsl(var(--secondary)/0.5)] p-3">
              <span className="text-sm text-[hsl(var(--muted-foreground))]">Última Atualização</span>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                {loading ? "Carregando..." : formatDate(new Date().toISOString())}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-4">
          <h2 className="text-sm font-semibold">Atividade Recente</h2>
          <a
            href="/dashboard/tickets"
            className="text-xs text-[hsl(var(--primary))] hover:underline"
          >
            Ver todas →
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border))]">
                <th className="px-5 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))]">
                  Placa
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))]">
                  Pagamento
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))]">
                  Entrada
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))]">
                  Tipo
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))]">
                  Confiança LPR
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && recentSessions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-[hsl(var(--muted-foreground))]">
                    Carregando atividade recente...
                  </td>
                </tr>
              ) : recentSessions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-[hsl(var(--muted-foreground))]">
                    Nenhuma sessão registrada.
                  </td>
                </tr>
              ) : (
                recentSessions.map((session) => (
                  <tr
                    key={session.id}
                    className="border-b border-[hsl(var(--border))] last:border-0 hover:bg-[hsl(var(--secondary)/0.5)] transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <code className="font-mono text-sm font-semibold">
                        {session.plate}
                      </code>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={cn("badge", 
                        session.payment_status === "paid" ? "badge-success" : 
                        session.payment_status === "free" ? "badge-info" : "badge-warning"
                      )}>
                        {session.payment_status === "paid" ? "Pago" : session.payment_status === "free" ? "Isento" : "Pendente"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[hsl(var(--muted-foreground))]">
                      {formatDate(session.entry_time)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="capitalize text-[hsl(var(--muted-foreground))]">{session.vehicle_type}</span>
                    </td>
                    <td className="px-5 py-3.5 text-[hsl(var(--muted-foreground))]">
                      {(session.recognition_confidence || 0).toFixed(1)}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
