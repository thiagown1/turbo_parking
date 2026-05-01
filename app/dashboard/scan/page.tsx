"use client";

import { useState, useEffect } from "react";
import { Car, CheckCircle2, AlertCircle, Search, QrCode, ListTodo, Clock } from "lucide-react";
import { Scanner } from "@yudiel/react-qr-scanner";
import { cn, formatDate } from "@/lib/utils";
import type { ParkingSession } from "@/interfaces/parking-session";

type ScanState = "idle" | "scanning" | "found" | "validated" | "error";
type TabType = "qr" | "manual" | "no_patio";



export default function SearchValidationPage() {
  const [activeTab, setActiveTab] = useState<TabType>("qr");
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [identifierInput, setIdentifierInput] = useState("");
  const [foundSession, setFoundSession] = useState<ParkingSession | null>(null);

  const [activeSessions, setActiveSessions] = useState<ParkingSession[]>([]);
  const [loadingActive, setLoadingActive] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeTab === "no_patio") {
      fetchActiveSessions();
      interval = setInterval(fetchActiveSessions, 10000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTab]);

  const fetchActiveSessions = async () => {
    try {
      setLoadingActive(true);
      const res = await fetch("/api/sessions?status=active&limit=100");
      if (res.ok) {
        const data = await res.json();
        setActiveSessions(data.sessions || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingActive(false);
    }
  };

  const handleValidateActive = async (session: ParkingSession) => {
    try {
      const res = await fetch("/api/sessions/operator-validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: session.plate_normalized || session.ticket_id,
          locationId: "metropole_shopping",
          notes: "Validated via active list",
        })
      });

      if (res.ok) {
        fetchActiveSessions();
      } else {
        alert("Falha na validação.");
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao conectar.");
    }
  };

  const handleSearch = async (identifier: string) => {
    if (!identifier.trim()) return;
    setScanState("scanning");

    try {
      const res = await fetch(`/api/sessions/${encodeURIComponent(identifier)}`);
      if (res.ok) {
        const data = await res.json();
        setFoundSession(data.session);
        setScanState("found");
      } else {
        setScanState("error");
      }
    } catch (e) {
      console.error(e);
      setScanState("error");
    }
  };

  const handleValidate = async () => {
    if (!foundSession) return;
    setScanState("scanning");

    try {
      const res = await fetch("/api/sessions/operator-validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: foundSession.plate_normalized || foundSession.ticket_id,
          locationId: "metropole_shopping",
          notes: "Validated via scan tool",
        })
      });

      if (res.ok) {
        const data = await res.json();
        setFoundSession(data.session);
        setScanState("validated");
      } else {
        alert("Falha na validação.");
        setScanState("found");
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao conectar.");
      setScanState("found");
    }
  };

  const handleReset = () => {
    setScanState("idle");
    setFoundSession(null);
    setIdentifierInput("");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Tabs */}
      <div className="flex w-full overflow-hidden rounded-xl bg-[hsl(var(--secondary))] p-1">
        <button
          onClick={() => { setActiveTab("qr"); handleReset(); }}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all",
            activeTab === "qr"
              ? "bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm"
              : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          )}
        >
          <QrCode className="h-4 w-4" />
          QR Code
        </button>
        <button
          onClick={() => { setActiveTab("manual"); handleReset(); }}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all",
            activeTab === "manual"
              ? "bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm"
              : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          )}
        >
          <Car className="h-4 w-4" />
          Busca de Placa
        </button>
        <button
          onClick={() => { setActiveTab("no_patio"); handleReset(); }}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all",
            activeTab === "no_patio"
              ? "bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm"
              : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          )}
        >
          <ListTodo className="h-4 w-4" />
          No Pátio
        </button>
      </div>

      {/* Main Area */}
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
        {activeTab === "no_patio" ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
               <h2 className="text-xl font-semibold tracking-tight">Veículos no Pátio</h2>
               <span className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                 <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--status-success))] animate-pulse-dot" />
                 Atualizando ao vivo
               </span>
            </div>
            
            {loadingActive && activeSessions.length === 0 ? (
              <p className="text-center text-[hsl(var(--muted-foreground))] py-8">Carregando veículos...</p>
            ) : activeSessions.length === 0 ? (
              <p className="text-center text-[hsl(var(--muted-foreground))] py-8">Nenhum veículo ativo no momento.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {activeSessions.map((session) => (
                  <div key={session.id} className="flex flex-col justify-between rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary)/0.5)] p-4 shadow-sm transition-all hover:border-[hsl(var(--primary)/0.5)]">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-mono text-xl font-bold tracking-widest">{session.plate || session.ticket_id}</p>
                        <p className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))] mt-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(session.entry_time)}
                        </p>
                      </div>
                      <span className={cn("badge", 
                        session.payment_status === "paid" ? "badge-success" : 
                        session.payment_status === "free" ? "badge-info" : "badge-warning"
                      )}>
                        {session.payment_status === "paid" ? "Pago" : session.payment_status === "free" ? "Isento" : "Pendente"}
                      </span>
                    </div>
                    
                    <div className="mt-4">
                      {session.payment_status === "pending" ? (
                        <button
                          onClick={() => handleValidateActive(session)}
                          className="w-full flex items-center justify-center gap-2 rounded-lg bg-[hsl(var(--primary))] py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Validar Saída
                        </button>
                      ) : (
                        <div className="w-full flex items-center justify-center gap-2 rounded-lg bg-[hsl(var(--status-success)/0.1)] text-[hsl(var(--status-success))] py-2 text-sm font-medium">
                          <CheckCircle2 className="h-4 w-4" />
                          Liberado
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : scanState === "idle" || scanState === "scanning" ? (
          <>
            <div className="mb-6 flex flex-col items-center justify-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--primary)/0.1)]">
                {activeTab === "qr" ? (
                  <QrCode className="h-8 w-8 text-[hsl(var(--primary))]" />
                ) : (
                  <Car className="h-8 w-8 text-[hsl(var(--primary))]" />
                )}
              </div>
              <h2 className="text-xl font-semibold tracking-tight">
                {activeTab === "qr" ? "Escanear QR Code" : "Pesquisa de Placa (LPR)"}
              </h2>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                {activeTab === "qr"
                  ? "Posicione o QR Code do visitante na frente da câmera."
                  : "Use esta ferramenta para validação manual ou contingência."}
              </p>
            </div>

            {activeTab === "qr" ? (
              <div className="flex flex-col items-center space-y-4">
                <div className="w-full max-w-sm overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-black">
                  <Scanner
                    onScan={(result) => {
                      if (result && result.length > 0) {
                        handleSearch(result[0].rawValue);
                      }
                    }}
                    components={{
                      finder: true,
                    }}
                    styles={{
                      container: { width: "100%", paddingTop: "100%" },
                    }}
                  />
                </div>
                {scanState === "scanning" && (
                  <p className="animate-pulse text-sm font-medium text-[hsl(var(--primary))]">
                    Validando ticket...
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <label className="block text-sm font-medium">Placa do Veículo</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                    <input
                      type="text"
                      value={identifierInput}
                      onChange={(e) => setIdentifierInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch(identifierInput)}
                      placeholder="Ex: ABC1234 ou ABC1D23"
                      className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] py-3 pl-10 pr-4 text-base font-mono uppercase tracking-widest placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                    />
                  </div>
                  <button
                    onClick={() => handleSearch(identifierInput)}
                    disabled={!identifierInput.trim() || scanState === "scanning"}
                    className="rounded-lg bg-[hsl(var(--primary))] px-6 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {scanState === "scanning" ? "Buscando..." : "Buscar Placa"}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : scanState === "found" && foundSession ? (
          <div className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between rounded-lg bg-[hsl(var(--secondary)/0.5)] p-4">
              <div>
                <p className="mb-1 text-xs text-[hsl(var(--muted-foreground))]">
                  {activeTab === "qr" ? "Ticket Encontrado" : "Placa Encontrada"}
                </p>
                <h3 className="font-mono text-2xl font-bold tracking-widest">
                  {activeTab === "qr" ? foundSession.ticket_id || "GUEST" : foundSession.plate}
                </h3>
              </div>
              <span
                className={cn(
                  "badge",
                  foundSession.payment_status === "paid"
                    ? "badge-success"
                    : foundSession.payment_status === "free"
                    ? "badge-info"
                    : "badge-warning"
                )}
              >
                {foundSession.payment_status === "paid"
                  ? "Pago"
                  : foundSession.payment_status === "free"
                  ? "Isento"
                  : "Pendente"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 px-2">
              <div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Entrada</p>
                <p className="text-sm font-medium">{formatDate(foundSession.entry_time)}</p>
              </div>
              {foundSession.plate && activeTab === "qr" && (
                <div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Placa (LPR)</p>
                  <p className="font-mono text-sm font-medium">{foundSession.plate}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Status da Sessão</p>
                <p className="text-sm font-medium">
                  {foundSession.status === "active" ? "No Pátio" : "Finalizada"}
                </p>
              </div>
              <div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Tipo</p>
                <p className="text-sm font-medium capitalize">{foundSession.vehicle_type}</p>
              </div>
            </div>

            {foundSession.payment_status === "pending" && foundSession.status === "active" && (
              <div className="flex gap-2 border-t border-[hsl(var(--border))] pt-4">
                <button
                  onClick={handleValidate}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[hsl(var(--primary))] py-3 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Validar Sessão
                </button>
                <button
                  onClick={handleReset}
                  className="rounded-lg border border-[hsl(var(--border))] px-6 py-3 text-sm transition-colors hover:bg-[hsl(var(--secondary))]"
                >
                  Cancelar
                </button>
              </div>
            )}

            {(foundSession.payment_status === "paid" || foundSession.payment_status === "free") && (
              <div className="border-t border-[hsl(var(--border))] pt-4">
                <button
                  onClick={handleReset}
                  className="w-full rounded-lg border border-[hsl(var(--border))] px-6 py-3 text-sm transition-colors hover:bg-[hsl(var(--secondary))]"
                >
                  Voltar para Pesquisa
                </button>
              </div>
            )}
          </div>
        ) : scanState === "validated" && foundSession ? (
          <div className="animate-fade-in space-y-5 py-4 text-center">
            <CheckCircle2 className="mx-auto h-20 w-20 text-[hsl(var(--status-success))]" />
            <div>
              <h3 className="text-2xl font-bold tracking-tight">Sessão Validada!</h3>
              <p className="mt-2 text-base text-[hsl(var(--muted-foreground))]">
                A sessão para{" "}
                <strong className="font-mono text-[hsl(var(--foreground))]">
                  {activeTab === "qr" ? foundSession.ticket_id : foundSession.plate}
                </strong>{" "}
                foi validada com sucesso e a cancela será aberta na saída.
              </p>
            </div>
            <button
              onClick={handleReset}
              className="mt-4 rounded-lg bg-[hsl(var(--primary))] px-8 py-3 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
            >
              Pesquisar Nova Sessão
            </button>
          </div>
        ) : scanState === "error" ? (
          <div className="animate-fade-in space-y-5 py-4 text-center">
            <AlertCircle className="mx-auto h-20 w-20 text-[hsl(var(--status-error))]" />
            <div>
              <h3 className="text-2xl font-bold tracking-tight">Sessão Não Encontrada</h3>
              <p className="mt-2 text-base text-[hsl(var(--muted-foreground))]">
                Não há nenhum veículo ativo com essa identificação no pátio.
              </p>
            </div>
            <button
              onClick={handleReset}
              className="mt-4 rounded-lg border border-[hsl(var(--border))] px-8 py-3 text-sm transition-colors hover:bg-[hsl(var(--secondary))]"
            >
              Tentar Novamente
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
