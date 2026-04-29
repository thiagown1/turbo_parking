"use client";

import { useState } from "react";
import { QrCode, Keyboard, CheckCircle2, AlertCircle, Search } from "lucide-react";
import { cn, getStatusBadgeClass, getStatusLabel, formatDate } from "@/lib/utils";
import type { ParkingTicket } from "@/interfaces/parking-ticket";

type ScanMode = "camera" | "manual";
type ScanState = "idle" | "scanning" | "found" | "validated" | "error";

// Mock: simulate finding a ticket
const mockTicket: ParkingTicket = {
  id: "scan-1",
  ticketCode: "TK-2024-0892",
  locationId: "metropole_shopping",
  entryTimestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  status: "pending",
  totalRechargeMinutes: 20,
  totalParkingMinutesGranted: 20,
  rechargeHistory: [
    {
      transactionId: "tx-001",
      stationId: "metropole-01",
      userId: "user-001",
      rechargeDurationMinutes: 20,
      parkingMinutesGranted: 20,
      accumulatedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    },
  ],
  createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  updatedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
};

export default function ScanPage() {
  const [mode, setMode] = useState<ScanMode>("manual");
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [manualCode, setManualCode] = useState("");
  const [foundTicket, setFoundTicket] = useState<ParkingTicket | null>(null);

  const handleManualSearch = () => {
    if (!manualCode.trim()) return;
    setScanState("scanning");

    // Simulate API call
    setTimeout(() => {
      setFoundTicket(mockTicket);
      setScanState("found");
    }, 800);
  };

  const handleValidate = () => {
    if (!foundTicket) return;
    setScanState("scanning");

    setTimeout(() => {
      setFoundTicket({ ...foundTicket, status: "validated", validatedAt: new Date().toISOString(), validatedBy: "operator" });
      setScanState("validated");
    }, 600);
  };

  const handleReset = () => {
    setScanState("idle");
    setFoundTicket(null);
    setManualCode("");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Mode Toggle */}
      <div className="flex rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-1">
        <button
          onClick={() => { setMode("camera"); handleReset(); }}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors",
            mode === "camera"
              ? "bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))]"
              : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          )}
        >
          <QrCode className="h-4 w-4" />
          Câmera
        </button>
        <button
          onClick={() => { setMode("manual"); handleReset(); }}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors",
            mode === "manual"
              ? "bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))]"
              : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          )}
        >
          <Keyboard className="h-4 w-4" />
          Código Manual
        </button>
      </div>

      {/* Scanner Area */}
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
        {scanState === "idle" || scanState === "scanning" ? (
          <>
            {mode === "camera" ? (
              <div className="space-y-4">
                <div className="flex aspect-square max-h-80 items-center justify-center rounded-lg bg-[hsl(var(--secondary))]">
                  <div className="text-center">
                    <QrCode className="mx-auto h-12 w-12 text-[hsl(var(--muted-foreground))]" />
                    <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">
                      Aponte a câmera para o QR code do ticket
                    </p>
                    <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                      O scanner de câmera será integrado com html5-qrcode
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <label className="block text-sm font-medium">
                  Código do Ticket
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                    <input
                      type="text"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleManualSearch()}
                      placeholder="Ex: TK-2024-0892"
                      className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] py-2.5 pl-10 pr-4 text-sm font-mono placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                    />
                  </div>
                  <button
                    onClick={handleManualSearch}
                    disabled={!manualCode.trim() || scanState === "scanning"}
                    className="rounded-lg bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {scanState === "scanning" ? "Buscando..." : "Buscar"}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : scanState === "found" && foundTicket ? (
          <div className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Ticket Encontrado</h3>
              <span className={cn("badge", getStatusBadgeClass(foundTicket.status))}>
                {getStatusLabel(foundTicket.status)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Código</p>
                <p className="font-mono text-sm font-medium">{foundTicket.ticketCode}</p>
              </div>
              <div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Entrada</p>
                <p className="text-sm">{formatDate(foundTicket.entryTimestamp)}</p>
              </div>
              <div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Tempo de Recarga</p>
                <p className="text-sm">{foundTicket.totalRechargeMinutes} min</p>
              </div>
              <div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Min. Concedidos</p>
                <p className="text-sm">{foundTicket.totalParkingMinutesGranted} min</p>
              </div>
            </div>

            {foundTicket.status === "pending" && (
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleValidate}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[hsl(var(--primary))] py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Validar Ticket
                </button>
                <button
                  onClick={handleReset}
                  className="rounded-lg border border-[hsl(var(--border))] px-4 py-2.5 text-sm hover:bg-[hsl(var(--secondary))] transition-colors"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        ) : scanState === "validated" && foundTicket ? (
          <div className="space-y-5 text-center animate-fade-in">
            <CheckCircle2 className="mx-auto h-16 w-16 text-[hsl(var(--status-success))]" />
            <div>
              <h3 className="text-lg font-semibold">Ticket Validado!</h3>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                {foundTicket.ticketCode} foi validado com sucesso
              </p>
            </div>
            <button
              onClick={handleReset}
              className="rounded-lg bg-[hsl(var(--primary))] px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
            >
              Escanear Outro
            </button>
          </div>
        ) : scanState === "error" ? (
          <div className="space-y-5 text-center animate-fade-in">
            <AlertCircle className="mx-auto h-16 w-16 text-[hsl(var(--status-error))]" />
            <div>
              <h3 className="text-lg font-semibold">Ticket Não Encontrado</h3>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                Verifique o código e tente novamente
              </p>
            </div>
            <button
              onClick={handleReset}
              className="rounded-lg border border-[hsl(var(--border))] px-6 py-2.5 text-sm hover:bg-[hsl(var(--secondary))] transition-colors"
            >
              Tentar Novamente
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
