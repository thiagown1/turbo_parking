"use client";

import { useState, useEffect } from "react";
import {
  Search,
  Filter,
  CheckCircle2,
  MoreHorizontal,
  ChevronDown,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import type { ParkingSession, PaymentStatus } from "@/interfaces/parking-session";

const statusFilters: { label: string; value: PaymentStatus | "all" }[] = [
  { label: "Todos", value: "all" },
  { label: "Livre/Isento", value: "free" },
  { label: "Pendente", value: "pending" },
  { label: "Pago (EV)", value: "paid" },
];

export default function TicketsPage() {
  const [sessions, setSessions] = useState<ParkingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | "all">("all");
  const [showFilters, setShowFilters] = useState(false);

  const fetchSessions = async (searchQuery?: string) => {
    try {
      let url = "/api/sessions?limit=50";
      // If searching, use the prefix search endpoint instead
      if (searchQuery && searchQuery.trim().length >= 2) {
        url = `/api/sessions/search?q=${encodeURIComponent(searchQuery.trim())}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.error("Failed to fetch sessions", err);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchSessions();
  }, []);

  // Debounced server-side search when user types + polling that respects search
  useEffect(() => {
    if (search.length >= 2) {
      const timeout = setTimeout(() => fetchSessions(search), 300);
      return () => clearTimeout(timeout);
    } else if (search.length === 0) {
      fetchSessions();
    }
    // Polling: always pass current search so results stay consistent
    const interval = setInterval(() => fetchSessions(search.length >= 2 ? search : undefined), 30000);
    return () => clearInterval(interval);
  }, [search]);

  const handleValidate = async (plate: string) => {
    try {
      const res = await fetch("/api/sessions/operator-validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          plate_normalized: plate, 
          locationId: "metropole_shopping",
          notes: "Manual dashboard validation"
        }),
      });
      if (res.ok) {
        // Refresh instantly
        fetchSessions();
      } else {
        const err = await res.json();
        alert(`Validation failed: ${err.error}`);
      }
    } catch (e) {
      console.error(e);
      alert("Validation request failed");
    }
  };

  const filtered = sessions.filter((s) => {
    if (statusFilter !== "all" && s.payment_status !== statusFilter) return false;
    if (search && !s.plate?.toLowerCase().includes(search.toLowerCase()) && !s.ticket_id?.toLowerCase().includes(search.toLowerCase()))
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
            placeholder="Buscar por placa ou ticket..."
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
                  Placa / Ticket
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))]">
                  Pagamento
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))]">
                  Sessão
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))]">
                  Entrada
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))]">
                  Tipo
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))]">
                  Recarga EV
                </th>
                <th className="px-5 py-3 text-right text-xs font-medium text-[hsl(var(--muted-foreground))]">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && sessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-[hsl(var(--muted-foreground))]">
                    Carregando sessões...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-[hsl(var(--muted-foreground))]">
                    Nenhuma sessão encontrada.
                  </td>
                </tr>
              ) : (
                filtered.map((session) => (
                  <tr
                    key={session.id}
                    className="border-b border-[hsl(var(--border))] last:border-0 hover:bg-[hsl(var(--secondary)/0.5)] transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <code className="font-mono text-sm font-semibold">{session.plate || session.ticket_id}</code>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={cn("badge", 
                        session.payment_status === "paid" ? "badge-success" : 
                        session.payment_status === "free" ? "badge-info" : "badge-warning"
                      )}>
                        {session.payment_status === "paid" ? "Pago" : session.payment_status === "free" ? "Isento" : "Pendente"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={cn("text-xs font-medium", session.status === "active" ? "text-[hsl(var(--primary))]" : "text-[hsl(var(--muted-foreground))]")}>
                        {session.status === "active" ? "No pátio" : "Finalizada"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[hsl(var(--muted-foreground))]">
                      {formatDate(session.entry_time)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="capitalize">{session.vehicle_type}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      {(session.ev_total_recharge_minutes || 0) > 0 ? (
                        <span className="text-[hsl(var(--status-success))]">{session.ev_total_recharge_minutes} min</span>
                      ) : (
                        <span className="text-[hsl(var(--muted-foreground))]">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {session.payment_status === "pending" && session.status === "active" && (
                          <button
                            onClick={() => handleValidate(session.plate_normalized || session.ticket_id || "")}
                            className="inline-flex items-center gap-1 rounded-md bg-[hsl(var(--primary))] px-2.5 py-1 text-xs font-medium text-white hover:opacity-90 transition-opacity"
                            title="Validar sessão"
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
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination info */}
        <div className="border-t border-[hsl(var(--border))] px-5 py-3">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Mostrando {filtered.length} de {sessions.length} sessões
          </p>
        </div>
      </div>
    </div>
  );
}
