"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ParkingSquare, LogIn } from "lucide-react";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

/**
 * Exchange a Firebase ID token for a server-side session cookie
 * and redirect to the dashboard. Shared by both login methods.
 */
async function createSessionAndRedirect(
  idToken: string,
  redirect: string
): Promise<string | null> {
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  if (res.ok) {
    window.location.href = redirect;
    return null;
  }

  const data = await res.json();
  return data.error || "Erro ao criar sessão";
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";

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
      const sessionError = await createSessionAndRedirect(idToken, redirect);
      if (sessionError) setError(sessionError);
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

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError("");

    try {
      // Use Google OAuth2 popup directly to avoid Firebase's broken _validateOrigin
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      if (!clientId) {
        setError("NEXT_PUBLIC_GOOGLE_CLIENT_ID não configurado.");
        setGoogleLoading(false);
        return;
      }

      const redirectUri = `${window.location.origin}/auth/login`;
      const scope = "openid email profile";
      const state = Math.random().toString(36).substring(2);
      const nonce = Math.random().toString(36).substring(2);

      const authUrl =
        `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=id_token` +
        `&scope=${encodeURIComponent(scope)}` +
        `&nonce=${encodeURIComponent(nonce)}` +
        `&state=${encodeURIComponent(state)}` +
        `&prompt=select_account`;

      // Open popup
      const width = 500;
      const height = 600;
      const left = Math.max((window.screen.availWidth - width) / 2, 0);
      const top = Math.max((window.screen.availHeight - height) / 2, 0);
      const popup = window.open(
        authUrl,
        "google-auth",
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
      );

      if (!popup) {
        setError("Popup bloqueado. Permita popups para este site.");
        setGoogleLoading(false);
        return;
      }

      // Poll for the redirect with the token
      const googleIdToken = await new Promise<string>((resolve, reject) => {
        const interval = setInterval(() => {
          try {
            if (popup.closed) {
              clearInterval(interval);
              reject(new Error("popup_closed"));
              return;
            }
            // Check if popup has redirected back to our origin
            const popupUrl = popup.location.href;
            if (popupUrl.startsWith(redirectUri)) {
              clearInterval(interval);
              popup.close();
              // Extract id_token from URL hash fragment
              const hash = popupUrl.split("#")[1] || "";
              const params = new URLSearchParams(hash);
              const token = params.get("id_token");
              if (token) {
                resolve(token);
              } else {
                reject(new Error(params.get("error") || "Token não encontrado"));
              }
            }
          } catch {
            // Cross-origin access error — popup hasn't redirected yet, keep polling
          }
        }, 200);

        // Timeout after 2 minutes
        setTimeout(() => {
          clearInterval(interval);
          popup.close();
          reject(new Error("Timeout: login demorou demais"));
        }, 120000);
      });

      // Exchange Google ID token for Firebase credential (bypasses _validateOrigin)
      const { clientAuth } = await import("@/lib/firebase-client");
      const { signInWithCredential, GoogleAuthProvider } = await import("firebase/auth");

      const credential = GoogleAuthProvider.credential(googleIdToken);
      const result = await signInWithCredential(clientAuth, credential);
      const firebaseIdToken = await result.user.getIdToken();

      const sessionError = await createSessionAndRedirect(firebaseIdToken, redirect);
      if (sessionError) setError(sessionError);
    } catch (err: unknown) {
      const error = err as { message?: string };
      if (error.message === "popup_closed") {
        setGoogleLoading(false);
        return;
      }
      setError(`Erro ao entrar com Google: ${error.message || "desconhecido"}`);
    } finally {
      setGoogleLoading(false);
    }
  };

  const isDisabled = loading || googleLoading;

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 space-y-4">
      {/* Google Sign-In */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isDisabled}
        id="google-sign-in-button"
        className="flex w-full items-center justify-center gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] py-2.5 text-sm font-medium hover:bg-[hsl(var(--muted))] disabled:opacity-50 transition-colors"
      >
        {googleLoading ? (
          "Entrando..."
        ) : (
          <>
            <GoogleIcon className="h-5 w-5" />
            Entrar com Google
          </>
        )}
      </button>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[hsl(var(--border))]" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-[hsl(var(--card))] px-2 text-[hsl(var(--muted-foreground))]">
            ou
          </span>
        </div>
      </div>

      {/* Email/Password Sign-In */}
      <form onSubmit={handleSubmit} className="space-y-4">
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

        <button
          type="submit"
          disabled={isDisabled}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[hsl(var(--primary))] py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {loading ? (
            "Entrando..."
          ) : (
            <>
              <LogIn className="h-4 w-4" />
              Entrar com Email
            </>
          )}
        </button>
      </form>

      {error && (
        <p className="text-sm text-[hsl(var(--status-error))]">{error}</p>
      )}
    </div>
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
