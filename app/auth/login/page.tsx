"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ParkingSquare, LogIn } from "lucide-react";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const searchParams = useSearchParams();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Lazy-import Firebase client to avoid build-time initialization
      const { clientAuth } = await import("@/lib/firebase-client");
      const { signInWithEmailAndPassword } = await import("firebase/auth");

      // 1. Sign in with Firebase Auth (client-side)
      const userCredential = await signInWithEmailAndPassword(
        clientAuth,
        email,
        password
      );

      // 2. Get the ID token
      const idToken = await userCredential.user.getIdToken();

      // 3. Exchange the ID token for a server-side session cookie
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (res.ok) {
        const redirect = searchParams.get("redirect") || "/dashboard";
        window.location.href = redirect;
      } else {
        const data = await res.json();
        setError(data.error || "Erro ao criar sessão");
      }
    } catch (err: unknown) {
      const firebaseError = err as { code?: string; message?: string };
      switch (firebaseError.code) {
        case "auth/invalid-credential":
        case "auth/wrong-password":
        case "auth/user-not-found":
          setError("Email ou senha incorretos.");
          break;
        case "auth/too-many-requests":
          setError("Muitas tentativas. Tente novamente em alguns minutos.");
          break;
        case "auth/invalid-api-key":
          setError("Configuração do Firebase inválida. Contate o administrador.");
          break;
        default:
          setError(`Erro: ${firebaseError.code || firebaseError.message || "desconhecido"}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 space-y-4"
    >
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@turboparking.com"
          required
          className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-3 py-2.5 text-sm placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Senha</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-3 py-2.5 text-sm placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
        />
      </div>

      {error && (
        <p className="text-sm text-[hsl(var(--status-error))]">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[hsl(var(--primary))] py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {loading ? (
          "Entrando..."
        ) : (
          <>
            <LogIn className="h-4 w-4" />
            Entrar
          </>
        )}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--background))] p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--primary))]">
            <ParkingSquare className="h-6 w-6 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-tight">Turbo Parking</h1>
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
              Painel administrativo
            </p>
          </div>
        </div>

        <Suspense fallback={<div className="text-center text-sm text-[hsl(var(--muted-foreground))]">Carregando...</div>}>
          <LoginForm />
        </Suspense>

        <p className="text-center text-xs text-[hsl(var(--muted-foreground))]">
          Acesso restrito a administradores
        </p>
      </div>
    </div>
  );
}
