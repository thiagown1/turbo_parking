"use client";

import { useState, useEffect } from "react";
import {
  Save,
  AlertTriangle,
  DoorOpen,
  DoorClosed,
  Clock,
  DollarSign,
  Settings2,
  CheckCircle2,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PricingConfig {
  additional_hour: number;
  entry_active: boolean;
  exit_active: boolean;
  first_hour: number;
  free_day: boolean;
  payment_exit_minutes: number;
  test_mode: boolean;
  ticketless: boolean;
  tolerance_minutes: number;
  updated_at: string | null;
}

const defaultConfig: PricingConfig = {
  additional_hour: 5,
  entry_active: true,
  exit_active: true,
  first_hour: 10,
  free_day: false,
  payment_exit_minutes: 15,
  test_mode: false,
  ticketless: false,
  tolerance_minutes: 20,
  updated_at: null,
};

export default function ConfigPage() {
  const [config, setConfig] = useState<PricingConfig>(defaultConfig);
  const [originalConfig, setOriginalConfig] = useState<PricingConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");

  const hasChanges = JSON.stringify(config) !== JSON.stringify(originalConfig);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/config/pricing");
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          const loaded: PricingConfig = {
            additional_hour: data.config.additional_hour ?? defaultConfig.additional_hour,
            entry_active: data.config.entry_active ?? defaultConfig.entry_active,
            exit_active: data.config.exit_active ?? defaultConfig.exit_active,
            first_hour: data.config.first_hour ?? defaultConfig.first_hour,
            free_day: data.config.free_day ?? defaultConfig.free_day,
            payment_exit_minutes: data.config.payment_exit_minutes ?? defaultConfig.payment_exit_minutes,
            test_mode: data.config.test_mode ?? defaultConfig.test_mode,
            ticketless: data.config.ticketless ?? defaultConfig.ticketless,
            tolerance_minutes: data.config.tolerance_minutes ?? defaultConfig.tolerance_minutes,
            updated_at: data.config.updated_at ?? null,
          };
          setConfig(loaded);
          setOriginalConfig(loaded);
        }
      }
    } catch (err) {
      console.error("Failed to load config", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveState("idle");
    try {
      const { updated_at, ...payload } = config;
      const res = await fetch("/api/config/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        const saved: PricingConfig = {
          additional_hour: data.config.additional_hour,
          entry_active: data.config.entry_active,
          exit_active: data.config.exit_active,
          first_hour: data.config.first_hour,
          free_day: data.config.free_day,
          payment_exit_minutes: data.config.payment_exit_minutes,
          test_mode: data.config.test_mode,
          ticketless: data.config.ticketless,
          tolerance_minutes: data.config.tolerance_minutes,
          updated_at: data.config.updated_at,
        };
        setConfig(saved);
        setOriginalConfig(saved);
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 3000);
      } else {
        setSaveState("error");
      }
    } catch (err) {
      console.error(err);
      setSaveState("error");
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setConfig(originalConfig);
    setSaveState("idle");
  };

  // ─── Toggle component ───
  const Toggle = ({
    checked,
    onChange,
    colorClass = "bg-[hsl(var(--primary))]",
    disabled = false,
  }: {
    checked: boolean;
    onChange: (val: boolean) => void;
    colorClass?: string;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:ring-offset-2 focus:ring-offset-[hsl(var(--background))]",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        checked ? colorClass : "bg-[hsl(var(--muted))]"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );

  // ─── Number input ───
  const NumberInput = ({
    value,
    onChange,
    min,
    step,
    suffix,
  }: {
    value: number;
    onChange: (val: number) => void;
    min?: number;
    step?: number;
    suffix?: string;
  }) => (
    <div className="relative">
      <input
        type="number"
        value={value}
        min={min}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:border-transparent transition-all"
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[hsl(var(--muted-foreground))]">
          {suffix}
        </span>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--primary))]" />
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Carregando configurações...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in pb-8">
      {/* ─── Unsaved changes banner ─── */}
      {hasChanges && (
        <div className="flex items-center justify-between rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-5 py-3 animate-fade-in">
          <p className="text-sm font-medium text-yellow-200">
            Você tem alterações não salvas
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDiscard}
              className="rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 text-xs font-medium hover:bg-[hsl(var(--secondary))] transition-colors"
            >
              Descartar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[hsl(var(--primary))] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 transition-all"
            >
              <Save className="h-3 w-3" />
              Salvar
            </button>
          </div>
        </div>
      )}

      {/* ─── 1. Modo de Teste ─── */}
      <section className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm overflow-hidden relative">
        {config.test_mode && (
          <div className="absolute inset-0 bg-yellow-500/5 pointer-events-none" />
        )}
        <div className="flex items-start justify-between relative">
          <div className="flex-1">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Modo de Teste
            </h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1 max-w-xl">
              Quando ativado, a cancela abrirá para TODOS os veículos, ignorando regras de pagamento.
            </p>
          </div>
          <Toggle
            checked={config.test_mode}
            onChange={(val) => setConfig({
              ...config,
              test_mode: val,
              ...(val ? { entry_active: true, exit_active: true } : {}),
            })}
            colorClass="bg-yellow-500"
          />
        </div>
      </section>

      {/* ─── 2. Controle de Cancelas ─── */}
      <section className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
        <h2 className="text-base font-semibold flex items-center gap-2 mb-6">
          <Settings2 className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
          Controle de Cancelas
        </h2>

        <div className="grid sm:grid-cols-2 gap-6">
          {/* Entry Gate */}
          <div className="flex items-center justify-between rounded-xl bg-[hsl(var(--secondary)/0.5)] p-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg",
                config.entry_active ? "bg-[hsl(var(--status-success)/0.15)] text-[hsl(var(--status-success))]" : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
              )}>
                {config.entry_active ? <DoorOpen className="h-5 w-5" /> : <DoorClosed className="h-5 w-5" />}
              </div>
              <div>
                <p className="text-sm font-medium">Cancela de Entrada</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  {config.test_mode ? "Forçado pelo Modo Teste" : config.entry_active ? "Operando normalmente" : "Desativada"}
                </p>
              </div>
            </div>
            <Toggle
              checked={config.test_mode || config.entry_active}
              onChange={(val) => setConfig({ ...config, entry_active: val })}
              disabled={config.test_mode}
            />
          </div>

          {/* Exit Gate */}
          <div className="flex items-center justify-between rounded-xl bg-[hsl(var(--secondary)/0.5)] p-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg",
                config.exit_active ? "bg-[hsl(var(--status-success)/0.15)] text-[hsl(var(--status-success))]" : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
              )}>
                {config.exit_active ? <DoorOpen className="h-5 w-5" /> : <DoorClosed className="h-5 w-5" />}
              </div>
              <div>
                <p className="text-sm font-medium">Cancela de Saída</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  {config.test_mode ? "Forçado pelo Modo Teste" : config.exit_active ? "Operando normalmente" : "Desativada"}
                </p>
              </div>
            </div>
            <Toggle
              checked={config.test_mode || config.exit_active}
              onChange={(val) => setConfig({ ...config, exit_active: val })}
              disabled={config.test_mode}
            />
          </div>
        </div>
      </section>

      {/* ─── 3. Opções do Sistema ─── */}
      <section className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
        <h2 className="text-base font-semibold flex items-center gap-2 mb-6">
          <Settings2 className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
          Opções do Sistema
        </h2>

        <div className="space-y-4">
          {/* Free Day */}
          <div className="flex items-center justify-between rounded-xl bg-[hsl(var(--secondary)/0.5)] p-4">
            <div>
              <p className="text-sm font-medium">Dia Gratuito</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {config.test_mode ? "Desligado pelo Modo Teste" : "Quando ativado, nenhum veículo será cobrado."}
              </p>
            </div>
            <Toggle
              checked={!config.test_mode && config.free_day}
              onChange={(val) => setConfig({ ...config, free_day: val })}
              colorClass="bg-[hsl(var(--status-success))]"
              disabled={config.test_mode}
            />
          </div>

          {/* Ticketless */}
          <div className="flex items-center justify-between rounded-xl bg-[hsl(var(--secondary)/0.5)] p-4">
            <div>
              <p className="text-sm font-medium">Modo Sem Ticket</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {config.test_mode ? "Desligado pelo Modo Teste" : "Opera sem emissão de ticket físico, usando apenas LPR."}
              </p>
            </div>
            <Toggle
              checked={!config.test_mode && config.ticketless}
              onChange={(val) => setConfig({ ...config, ticketless: val })}
              disabled={config.test_mode}
            />
          </div>
        </div>
      </section>

      {/* ─── 4. Preços ─── */}
      <section className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
        <h2 className="text-base font-semibold flex items-center gap-2 mb-6">
          <DollarSign className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
          Preços
        </h2>

        <div className="grid sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Primeira Hora</label>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Valor cobrado pela primeira hora.</p>
            <NumberInput
              value={config.first_hour}
              onChange={(val) => setConfig({ ...config, first_hour: val })}
              min={0}
              step={1}
              suffix="R$"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Hora Adicional</label>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Valor por hora após a primeira.</p>
            <NumberInput
              value={config.additional_hour}
              onChange={(val) => setConfig({ ...config, additional_hour: val })}
              min={0}
              step={1}
              suffix="R$"
            />
          </div>
        </div>
      </section>

      {/* ─── 5. Regras de Tempo ─── */}
      <section className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
        <h2 className="text-base font-semibold flex items-center gap-2 mb-6">
          <Clock className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
          Regras de Tempo
        </h2>

        <div className="grid sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Tolerância</label>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Tempo gratuito de permanência.</p>
            <NumberInput
              value={config.tolerance_minutes}
              onChange={(val) => setConfig({ ...config, tolerance_minutes: val })}
              min={0}
              step={5}
              suffix="min"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Tempo para Sair Após Pagamento</label>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Minutos permitidos para sair após pagar.</p>
            <NumberInput
              value={config.payment_exit_minutes}
              onChange={(val) => setConfig({ ...config, payment_exit_minutes: val })}
              min={1}
              step={5}
              suffix="min"
            />
          </div>
        </div>
      </section>

      {/* ─── Save Button ─── */}
      <div className="flex items-center justify-between pt-2">
        <div className="text-xs text-[hsl(var(--muted-foreground))]">
          {config.updated_at && (
            <span className="flex items-center gap-1.5">
              <RefreshCw className="h-3 w-3" />
              Última atualização: {new Date(config.updated_at).toLocaleString("pt-BR")}
            </span>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-medium transition-all shadow-sm",
            saveState === "saved"
              ? "bg-[hsl(var(--status-success))] text-white"
              : saveState === "error"
              ? "bg-[hsl(var(--status-error))] text-white"
              : "bg-[hsl(var(--primary))] text-white hover:opacity-90 disabled:opacity-40"
          )}
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : saveState === "saved" ? (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Salvo!
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Salvar Configurações
            </>
          )}
        </button>
      </div>
    </div>
  );
}
