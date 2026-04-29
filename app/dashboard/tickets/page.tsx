"use client";

import { useState } from "react";
import {
  Search,
  Filter,
  CheckCircle2,
  MoreHorizontal,
  ChevronDown,
} from "lucide-react";
import { cn, formatDate, getStatusBadgeClass, getStatusLabel } from "@/lib/utils";
import type { ParkingTicket, TicketStatus } from "@/interfaces/parking-ticket";

// Mock data
const allTickets: ParkingTicket[] = Array.from({ length: 20 }, (_, i) => {
  const statuses: TicketStatus[] = [
    "validated",
    "pending",
    "expired",
    "requires_payment",
  ];
  const status = statuses[i % 4];
  const entryOffset = (i + 1) * 30 * 60 * 1000;
  const rechargeMin = status === "validated" ? 15 + (i % 3) * 10 : i % 2 === 0 ? 5 : 0;

  return {
    id: String(i + 1),
    ticketCode: `TK-2024-${String(900 - i).padStart(4, "0")}`,
    locationId: "metropole_shopping",
    entryTimestamp: new Date(Date.now() - entryOffset).toISOString(),
    status,
    validatedAt:
      status === "validated"
        ? new Date(Date.now() - entryOffset + 20 * 60 * 1000).toISOString()
        : undefined,
    validatedBy: status === "validated" ? (i % 2 === 0 ? "system" : "operator") : undefined,
    totalRechargeMinutes: rechargeMin,
    totalParkingMinutesGranted: rechargeMin,
    rechargeHistory: [],
    createdAt: new Date(Date.now() - entryOffset).toISOString(),
    updatedAt: new Date(Date.now() - entryOffset + 20 * 60 * 1000).toISOString(),
  };
});

const statusFilters: { label: string; value: TicketStatus | "all" }[] = [
  { label: "Todos", value: "all" },
  { label: "Pendente", value: "pending" },
  { label: "Validado", value: "validated" },
  { label: "Expirado", value: "expired" },
  { label: "Pagamento", value: "requires_payment" },
];

export default function TicketsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
  const [showFilters, setShowFilters] = useState(false);

  const filtered = allTickets.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (search && !t.ticketCode.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          <input
            type="text"
            placeholder="Buscar por código do ticket..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] py-2 pl-10 pr-4 text-sm placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
          />
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className="inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-sm hover:bg-[hsl(var(--secondary))] transition-colors"
        >
          <Filter className="h-4 w-4" />
          Filtros
          <ChevronDown
            className={cn("h-3 w-3 transition-transform", showFilters && "rotate-180")}
          />
        </button>
      </div>

      {/* Filter Pills */}
      {showFilters && (
        <div className="flex flex-wrap gap-2 animate-fade-in">
          {statusFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                statusFilter === f.value
                  ? "bg-[hsl(var(--primary))] text-white"
                  : "bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
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
                <th className="px-5 py-3 text-right text-xs font-medium text-[hsl(var(--muted-foreground))]">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ticket) => (
                <tr
                  key={ticket.id}
                  className="border-b border-[hsl(var(--border))] last:border-0 hover:bg-[hsl(var(--secondary)/0.5)] transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <code className="font-mono text-xs">{ticket.ticketCode}</code>
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
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {ticket.status === "pending" && (
                        <button
                          className="inline-flex items-center gap-1 rounded-md bg-[hsl(var(--primary))] px-2.5 py-1 text-xs font-medium text-white hover:opacity-90 transition-opacity"
                          title="Validar ticket"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          Validar
                        </button>
                      )}
                      <button className="rounded-md p-1 hover:bg-[hsl(var(--secondary))] transition-colors">
                        <MoreHorizontal className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination info */}
        <div className="border-t border-[hsl(var(--border))] px-5 py-3">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Mostrando {filtered.length} de {allTickets.length} tickets
          </p>
        </div>
      </div>
    </div>
  );
}
