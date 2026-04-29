"use client";

import { useState } from "react";
import { Save, Key, Plus, Trash2, Eye, EyeOff } from "lucide-react";

interface ConfigState {
  toleranceMinutes: number;
  maxParkingDurationMinutes: number;
  minRechargeMinutes: number;
  rechargeToMinutesRatio: number;
  maxTicketAgeHours: number;
  cameraFeedUrl: string;
  linkedStationIds: string;
}

const initialConfig: ConfigState = {
  toleranceMinutes: 30,
  maxParkingDurationMinutes: 240,
  minRechargeMinutes: 10,
  rechargeToMinutesRatio: 1.0,
  maxTicketAgeHours: 24,
  cameraFeedUrl: "",
  linkedStationIds: "metropole-01, metropole-02",
};

interface ApiKeyDisplay {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  active: boolean;
}

const mockKeys: ApiKeyDisplay[] = [
  { id: "1", name: "turbo_station_prod", prefix: "tp_a3f2", createdAt: "2024-01-15", active: true },
];

export default function ConfigPage() {
  const [config, setConfig] = useState(initialConfig);
  const [saved, setSaved] = useState(false);
  const [keys, setKeys] = useState(mockKeys);
  const [newKeyName, setNewKeyName] = useState("");

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleGenerateKey = () => {
    if (!newKeyName.trim()) return;
    const newKey: ApiKeyDisplay = {
      id: String(Date.now()),
      name: newKeyName,
      prefix: `tp_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString().split("T")[0],
      active: true,
    };
    setKeys([...keys, newKey]);
    setNewKeyName("");
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
      value={config[key]}
      onChange={(e) => setConfig({ ...config, [key]: type === "number" ? Number(e.target.value) : e.target.value })}
      className="w-full max-w-xs rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
    />
  );

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Validation Rules */}
      <section className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
        <h2 className="text-base font-semibold mb-6">Regras de Validação</h2>
        <div className="space-y-6">
          {field("Tolerância (minutos)", "Tempo de tolerância adicionado ao tempo de recarga. Ex: 30 min = recarga de 20min cobre até 50min.", input("toleranceMinutes"))}
          {field("Duração máxima (minutos)", "Após esse tempo, o ticket requer pagamento no totem.", input("maxParkingDurationMinutes"))}
          {field("Recarga mínima (minutos)", "Tempo mínimo de recarga para qualificar para validação.", input("minRechargeMinutes"))}
          {field("Razão recarga:estacionamento", "1.0 = 1 min recarga = 1 min estacionamento. 2.0 = 1 min recarga = 2 min.", input("rechargeToMinutesRatio"))}
          {field("Idade máxima do ticket (horas)", "Tickets mais antigos que esse valor são automaticamente expirados.", input("maxTicketAgeHours"))}
        </div>
      </section>

      {/* Integration */}
      <section className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
        <h2 className="text-base font-semibold mb-6">Integração</h2>
        <div className="space-y-6">
          {field("Estações vinculadas", "IDs das estações turbo_station separados por vírgula.", input("linkedStationIds", "text"))}
          {field("URL da câmera de entrada", "URL da câmera (MJPEG, HLS ou iframe).", input("cameraFeedUrl", "text"))}
        </div>
      </section>

      {/* API Keys */}
      <section className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
        <h2 className="text-base font-semibold mb-4">Chaves de API</h2>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mb-4">Chaves usadas pelo turbo_station para acessar a API.</p>

        {keys.length > 0 && (
          <div className="mb-4 space-y-2">
            {keys.map((key) => (
              <div key={key.id} className="flex items-center justify-between rounded-lg border border-[hsl(var(--border))] px-4 py-3">
                <div className="flex items-center gap-3">
                  <Key className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                  <div>
                    <p className="text-sm font-medium">{key.name}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      <code className="font-mono">{key.prefix}••••••••</code> · Criada em {key.createdAt}
                    </p>
                  </div>
                </div>
                <button className="rounded-md p-1.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--status-error))] hover:bg-[hsl(var(--secondary))] transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Nome da chave (ex: turbo_station_prod)"
            className="flex-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-3 py-2 text-sm placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
          />
          <button onClick={handleGenerateKey} disabled={!newKeyName.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-[hsl(var(--primary))] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity">
            <Plus className="h-4 w-4" />
            Gerar
          </button>
        </div>
      </section>

      {/* Save */}
      <div className="flex justify-end">
        <button onClick={handleSave} className="inline-flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity">
          <Save className="h-4 w-4" />
          {saved ? "Salvo ✓" : "Salvar Configurações"}
        </button>
      </div>
    </div>
  );
}
