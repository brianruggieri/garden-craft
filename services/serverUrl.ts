const DEFAULT_SERVER_URL =
  (typeof window !== "undefined" &&
    (window.localStorage?.getItem("GARDENCRAFT_AI_SERVER_URL") ||
      (typeof (import.meta as any) !== "undefined" &&
        (import.meta as any).env?.VITE_AI_SERVER_URL) ||
      window.location?.origin)) ||
  "http://localhost:8787";

export function normalizeServerUrl(value: string): string {
  const raw = value || "";
  return String(raw).replace(/\/+$/, "") || "http://localhost:8787";
}

export function getServerUrl(): string {
  return normalizeServerUrl(DEFAULT_SERVER_URL);
}

export function withServerUrl(path: string, base?: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizeServerUrl(base || getServerUrl())}${cleanPath}`;
}
