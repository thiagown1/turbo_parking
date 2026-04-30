"use client";

import { useState } from "react";
import { formatDate, cn } from "@/lib/utils";

interface HistoryEntry {
  id: string;
  plate: string;
  action: "validated" | "accumulated" | "expired" | "operator_validated" | "entry" | "exit";
  performedBy: string;
  details: string;
  timestamp: string;
}

const mockHistory: HistoryEntry[] = Array.from({ length: 15 }, (_, i) => {
  const actions: HistoryEntry["action"][] = ["entry", "accumulated", "validated", "exit", "operator_validated"];
  const action = actions[i % 5];
  const offset = i * 25 * 60 * 1000;
  return {
    id: String(i + 1),
    plate: `SGT${String(7000 + i)}`.substring(0, 7),
    action,
    performedBy: action === "operator_validated" ? "admin@turboparking.com" : 
                 action === "validated" ? "Sistema (Auto)" : 
                 action === "accumulated" ? "Turbo Station API" : "LPR Camera",
    details: action === "validated" ? "Sessão validada por recarga EV" : 
             action === "accumulated" ? "+15 min acumulados" : 
             action === "operator_validated" ? "Validação manual de contingência" : 
             action === "entry" ? "Veículo detectado na entrada" : "Cancela aberta (Saída autorizada)",
    timestamp: new Date(Date.now() - offset).toISOString(),
  };
});

function getActionBadge(action: HistoryEntry["action"]) {
  switch (action) {
    case "validated": return "badge-success";
    case "operator_validated": return "badge-info";
    case "accumulated": return "badge-warning";
    case "entry": return "bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))]";
    case "exit": return "bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]";
    case "expired": return "badge-error";
  }
}

function getActionLabel(action: HistoryEntry["action"]) {
  switch (action) {
    case "validated": return "Validado (EV)";
    case "operator_validated": return "Op. Validou";
    case "accumulated": return "Recarga EV";
    case "entry": return "Entrada";
    case "exit": return "Saída";
    case "expired": return "Expirado";
  }
}

export default function HistoryPage() {
  const [dateFilter, setDateFilter] = useState("");
  const filtered = dateFilter ? mockHistory.filter((h) => h.timestamp.startsWith(dateFilter)) : mockHistory;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]" />
        {dateFilter && <button onClick={() => setDateFilter("")} className="text-xs text-[hsl(var(--primary))] hover:underline">Limpar</button>}
      </div>
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border))]">
                <th className="px-5 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))]">Data/Hora</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))]">Placa</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))]">Ação</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))]">Detalhes</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))]">Origem</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => (
                <tr key={entry.id} className="border-b border-[hsl(var(--border))] last:border-0 hover:bg-[hsl(var(--secondary)/0.5)] transition-colors">
                  <td className="px-5 py-3.5 text-[hsl(var(--muted-foreground))]">{formatDate(entry.timestamp)}</td>
                  <td className="px-5 py-3.5"><code className="font-mono font-semibold text-sm">{entry.plate}</code></td>
                  <td className="px-5 py-3.5"><span className={cn("badge", getActionBadge(entry.action))}>{getActionLabel(entry.action)}</span></td>
                  <td className="px-5 py-3.5 text-[hsl(var(--muted-foreground))] max-w-xs truncate">{entry.details}</td>
                  <td className="px-5 py-3.5 text-[hsl(var(--muted-foreground))]">{entry.performedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-[hsl(var(--border))] px-5 py-3">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">{filtered.length} eventos registrados</p>
        </div>
      </div>
    </div>
  );
}
