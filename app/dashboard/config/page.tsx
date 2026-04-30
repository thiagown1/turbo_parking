"use client";

import { useState, useEffect } from "react";
import { Save, Key, Plus, Trash2, Power, AlertTriangle } from "lucide-react";
import type { ParkingConfig } from "@/interfaces/parking-config";

// Default config fallback if nothing exists in Firebase
const defaultConfig = {
  toleranceMinutes: 10,
  maxParkingDurationMinutes: 240,
  minRechargeMinutes: 10,
  rechargeToMinutesRatio: 1.0,
  maxTicketAgeHours: 24,
  cameraFeedUrl: "",
  linkedStationIds: "",
  testModeAlwaysOpenGate: false,
};

// Simplified UI state
type ConfigState = typeof defaultConfig;

export default function ConfigPage() {
  const [config, setConfig] = useState<ConfigState>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // We'll hardcode the location ID for now as per the rest of the dashboard
  const locationId = "metropole_shopping";

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch(`/api/config/${locationId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.config) {
            setConfig({
              toleranceMinutes: data.config.toleranceMinutes ?? defaultConfig.toleranceMinutes,
              maxParkingDurationMinutes: data.config.maxParkingDurationMinutes ?? defaultConfig.maxParkingDurationMinutes,
              minRechargeMinutes: data.config.minRechargeMinutes ?? defaultConfig.minRechargeMinutes,
              rechargeToMinutesRatio: data.config.rechargeToMinutesRatio ?? defaultConfig.rechargeToMinutesRatio,
              maxTicketAgeHours: data.config.maxTicketAgeHours ?? defaultConfig.maxTicketAgeHours,
              cameraFeedUrl: data.config.cameraFeedUrl ?? defaultConfig.cameraFeedUrl,
              linkedStationIds: data.config.linkedStationIds ? data.config.linkedStationIds.join(", ") : defaultConfig.linkedStationIds,
              testModeAlwaysOpenGate: data.config.testModeAlwaysOpenGate ?? defaultConfig.testModeAlwaysOpenGate,
            });
          }
        }
      } catch (err) {
        console.error("Failed to load config", err);
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Convert linkedStationIds string back to array
      const linkedStationArray = config.linkedStationIds
        .split(",")
        .map(s => s.trim())
        .filter(s => s.length > 0);

      const payload: Partial<ParkingConfig> = {
        toleranceMinutes: config.toleranceMinutes,
        maxParkingDurationMinutes: config.maxParkingDurationMinutes,
        minRechargeMinutes: config.minRechargeMinutes,
        rechargeToMinutesRatio: config.rechargeToMinutesRatio,
        maxTicketAgeHours: config.maxTicketAgeHours,
        cameraFeedUrl: config.cameraFeedUrl,
        linkedStationIds: linkedStationArray,
        testModeAlwaysOpenGate: config.testModeAlwaysOpenGate,
      };

      const res = await fetch(`/api/config/${locationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        alert("Erro ao salvar configurações");
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, description: string, children: React.ReactNode) => (
    <div className="grid gap-1.5">
      <label className="text-sm font-medium">{label}</label>
      <p className="text-xs text-[hsl(var(--muted-foreground))]">{description}</p>
      {children}
    </div>
  );

  const input = (key: keyof ConfigState, type: string = "number") => (
    <input
      type={type}
      value={config[key] as string | number}
      onChange={(e) => setConfig({ ...config, [key]: type === "number" ? Number(e.target.value) : e.target.value })}
      className="w-full max-w-xs rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
    />
  );

  if (loading) {
    return <div className="flex h-32 items-center justify-center">Carregando configurações...</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 animate-fade-in">
      {/* Test Mode */}
      <section className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm overflow-hidden relative">
        {config.testModeAlwaysOpenGate && (
          <div className="absolute inset-0 bg-yellow-500/10 pointer-events-none" />
        )}
        <div className="flex items-start justify-between relative">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Modo de Teste (Portão Sempre Aberto)
            </h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1 max-w-xl">
              Quando ativado, a cancela de saída abrirá para TODOS os veículos detectados, ignorando as regras de pagamento. O status da sessão continuará sendo registrado normalmente.
            </p>
          </div>
          <button
            onClick={() => setConfig({ ...config, testModeAlwaysOpenGate: !config.testModeAlwaysOpenGate })}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:ring-offset-2 ${config.testModeAlwaysOpenGate ? 'bg-yellow-500' : 'bg-gray-200'}`}
          >
            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${config.testModeAlwaysOpenGate ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>
      </section>

      {/* Validation Rules */}
      <section className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
        <h2 className="text-base font-semibold mb-6">Regras de Validação (Tempo)</h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {field("Tolerância (minutos)", "Tempo de tolerância gratuita.", input("toleranceMinutes"))}
          {field("Duração máxima (minutos)", "Estadia máxima permitida.", input("maxParkingDurationMinutes"))}
          {field("Recarga mínima (minutos)", "Recarga EV mínima requerida.", input("minRechargeMinutes"))}
          {field("Razão (recarga:estacionamento)", "Multiplicador de tempo.", input("rechargeToMinutesRatio"))}
        </div>
      </section>

      {/* Save */}
      <div className="flex justify-end pt-4">
        <button 
          onClick={handleSave} 
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-6 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-all shadow-sm"
        >
          <Save className="h-4 w-4" />
          {saving ? "Salvando..." : saved ? "Salvo ✓" : "Salvar Configurações"}
        </button>
      </div>
    </div>
  );
}
