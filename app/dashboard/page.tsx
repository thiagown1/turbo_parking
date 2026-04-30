"use client";

import {
  Car,
  CheckCircle2,
  Clock,
  TrendingUp,
  Camera,
  Activity,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import type { ParkingSession } from "@/interfaces/parking-session";

// ─── Mock data (replaced by Firebase later) ───

const statsData = [
  {
    label: "Veículos no Pátio",
    value: "42",
    icon: Car,
    change: "+12%",
    changeUp: true,
  },
  {
    label: "Validados (EV)",
    value: "18",
    icon: CheckCircle2,
    change: "+8%",
    changeUp: true,
  },
  {
    label: "Pendentes",
    value: "24",
    icon: Clock,
    change: "-2",
    changeUp: false,
  },
  {
    label: "Visitas LPR",
    value: "156",
    icon: Camera,
    change: "+15%",
    changeUp: true,
  },
];

const chartData = [
  { day: "Seg", count: 120 },
  { day: "Ter", count: 145 },
  { day: "Qua", count: 130 },
  { day: "Qui", count: 156 },
  { day: "Sex", count: 198 },
  { day: "Sáb", count: 210 },
  { day: "Dom", count: 180 },
];

const recentSessions: ParkingSession[] = [
  {
    id: "1",
    plate: "SGT7D71",
    plate_normalized: "SGT7D71",
    vehicle_type: "visitante",
    is_authorized: false,
    gate_opened_by: "auto_lpr",
    recognition_confidence: 98.5,
    entry_time: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    status: "active",
    payment_status: "paid",
    ev_recharge_validated: true,
    ev_total_recharge_minutes: 25,
    ev_total_parking_minutes_granted: 25,
    created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
  {
    id: "2",
    plate: "ABC1234",
    plate_normalized: "ABC1234",
    vehicle_type: "morador",
    is_authorized: true,
    gate_opened_by: "auto_lpr",
    recognition_confidence: 99.1,
    entry_time: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    status: "active",
    payment_status: "free",
    created_at: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
  },
  {
    id: "3",
    plate: "XYZ9876",
    plate_normalized: "XYZ9876",
    vehicle_type: "visitante",
    is_authorized: false,
    gate_opened_by: "auto_lpr",
    recognition_confidence: 96.2,
    entry_time: new Date(Date.now() - 180 * 60 * 1000).toISOString(),
    status: "completed",
    payment_status: "pending",
    duration_minutes: 180,
    amount_charged: 15.0,
    created_at: new Date(Date.now() - 180 * 60 * 1000).toISOString(),
  },
  {
    id: "4",
    plate: "DEF5678",
    plate_normalized: "DEF5678",
    vehicle_type: "visitante",
    is_authorized: false,
    gate_opened_by: "auto_lpr",
    recognition_confidence: 95.0,
    entry_time: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    status: "active",
    payment_status: "pending",
    created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
];

const maxChartValue = Math.max(...chartData.map((d) => d.count));

export default function DashboardOverview() {
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger">
        {statsData.map((stat) => (
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
              <span className="text-2xl font-bold tracking-tight">
                {stat.value}
              </span>
              <span
                className={cn(
                  "text-xs font-medium",
                  stat.changeUp
                    ? "text-[hsl(var(--status-success))]"
                    : "text-[hsl(var(--muted-foreground))]"
                )}
              >
                {stat.change}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Camera + Chart Row */}
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

        {/* Chart */}
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
          <div className="mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <h2 className="text-sm font-semibold">Leituras (7 dias)</h2>
          </div>
          <div className="flex h-48 items-end gap-2">
            {chartData.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                  {d.count}
                </span>
                <div
                  className="w-full rounded-md bg-[hsl(var(--primary))] transition-all duration-500"
                  style={{
                    height: `${(d.count / maxChartValue) * 140}px`,
                    opacity: 0.8 + (d.count / maxChartValue) * 0.2,
                  }}
                />
                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                  {d.day}
                </span>
              </div>
            ))}
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
              {recentSessions.map((session) => (
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
                    {session.recognition_confidence.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
