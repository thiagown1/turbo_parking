import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMins < 1) return "agora";
  if (diffMins < 60) return `${diffMins}min atrás`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h atrás`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d atrás`;
}

export function getStatusBadgeClass(
  status: string
): "badge-success" | "badge-warning" | "badge-error" | "badge-info" {
  switch (status) {
    case "validated":
      return "badge-success";
    case "pending":
      return "badge-warning";
    case "expired":
    case "requires_payment":
      return "badge-error";
    default:
      return "badge-info";
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case "validated":
      return "Validado";
    case "pending":
      return "Pendente";
    case "expired":
      return "Expirado";
    case "requires_payment":
      return "Pagamento necessário";
    default:
      return status;
  }
}
