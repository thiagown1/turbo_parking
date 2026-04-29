"use client";

import {
  Car,
  CheckCircle2,
  Clock,
  TrendingUp,
  Camera,
  Activity,
} from "lucide-react";
import { cn, formatDate, getStatusBadgeClass, getStatusLabel } from "@/lib/utils";
import type { ParkingTicket } from "@/interfaces/parking-ticket";

// ─── Mock data (replaced by Firebase later) ───

const statsData = [
  {
    label: "Veículos Hoje",
    value: "42",
    icon: Car,
    change: "+12%",
    changeUp: true,
  },
  {
    label: "Validados",
    value: "38",
    icon: CheckCircle2,
    change: "+8%",
    changeUp: true,
  },
  {
    label: "Pendentes",
    value: "4",
    icon: Clock,
    change: "-2",
    changeUp: false,
  },
  {
    label: "Receita Mensal",
    value: "R$ 2.480",
    icon: TrendingUp,
    change: "+15%",
    changeUp: true,
  },
];

const chartData = [
  { day: "Seg", count: 18 },
  { day: "Ter", count: 24 },
  { day: "Qua", count: 22 },
  { day: "Qui", count: 28 },
  { day: "Sex", count: 32 },
  { day: "Sáb", count: 26 },
  { day: "Dom", count: 14 },
];

const recentTickets: ParkingTicket[] = [
  {
    id: "1",
    ticketCode: "TK-2024-0892",
    locationId: "metropole_shopping",
    entryTimestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    status: "validated",
    validatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    validatedBy: "system",
    totalRechargeMinutes: 25,
    totalParkingMinutesGranted: 25,
    rechargeHistory: [],
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  },
  {
    id: "2",
    ticketCode: "TK-2024-0891",
    locationId: "metropole_shopping",
    entryTimestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    status: "pending",
    totalRechargeMinutes: 0,
    totalParkingMinutesGranted: 0,
    rechargeHistory: [],
    createdAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
  },
  {
    id: "3",
    ticketCode: "TK-2024-0890",
    locationId: "metropole_shopping",
    entryTimestamp: new Date(Date.now() - 180 * 60 * 1000).toISOString(),
    status: "expired",
    totalRechargeMinutes: 5,
    totalParkingMinutesGranted: 5,
    rechargeHistory: [],
    createdAt: new Date(Date.now() - 180 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  },
  {
    id: "4",
    ticketCode: "TK-2024-0889",
    locationId: "metropole_shopping",
    entryTimestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    status: "validated",
    validatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    validatedBy: "operator",
    validatedByUserId: "admin-001",
    totalRechargeMinutes: 20,
    totalParkingMinutesGranted: 20,
    rechargeHistory: [],
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
  {
    id: "5",
    ticketCode: "TK-2024-0888",
    locationId: "metropole_shopping",
    entryTimestamp: new Date(Date.now() - 240 * 60 * 1000).toISOString(),
    status: "requires_payment",
    totalRechargeMinutes: 15,
    totalParkingMinutesGranted: 15,
    rechargeHistory: [],
    createdAt: new Date(Date.now() - 240 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
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
            <h2 className="text-sm font-semibold">Câmera de Entrada</h2>
            <span className="ml-auto flex items-center gap-1.5 text-xs text-[hsl(var(--status-success))]">
              <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--status-success))] animate-pulse-dot" />
              Ao vivo
            </span>
          </div>
          <div className="flex aspect-video items-center justify-center rounded-lg bg-[hsl(var(--secondary))]">
            <div className="text-center">
              <Camera className="mx-auto h-8 w-8 text-[hsl(var(--muted-foreground))]" />
              <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
                Configure a URL da câmera nas configurações
              </p>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
          <div className="mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <h2 className="text-sm font-semibold">Validações (7 dias)</h2>
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
            Ver todos →
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border))]">
                <th className="px-5 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))]">
                  Ticket
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))]">
                  Status
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))]">
                  Entrada
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))]">
                  Recarga
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))]">
                  Validado por
                </th>
              </tr>
            </thead>
            <tbody>
              {recentTickets.map((ticket) => (
                <tr
                  key={ticket.id}
                  className="border-b border-[hsl(var(--border))] last:border-0 hover:bg-[hsl(var(--secondary)/0.5)] transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <code className="font-mono text-xs">
                      {ticket.ticketCode}
                    </code>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={cn("badge", getStatusBadgeClass(ticket.status))}>
                      {getStatusLabel(ticket.status)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-[hsl(var(--muted-foreground))]">
                    {formatDate(ticket.entryTimestamp)}
                  </td>
                  <td className="px-5 py-3.5">
                    {ticket.totalRechargeMinutes > 0 ? (
                      <span>{ticket.totalRechargeMinutes} min</span>
                    ) : (
                      <span className="text-[hsl(var(--muted-foreground))]">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-[hsl(var(--muted-foreground))]">
                    {ticket.validatedBy === "system"
                      ? "Sistema"
                      : ticket.validatedBy === "operator"
                      ? "Operador"
                      : "—"}
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
