export function getApiBase() {
  const explicit = import.meta.env.VITE_API_BASE;
  if (explicit && explicit.trim()) return explicit.trim().replace(/\/$/, "");

  const tokenEndpoint = import.meta.env.VITE_ZEGO_TOKEN_ENDPOINT || "";
  if (tokenEndpoint.startsWith("http")) {
    try {
      const u = new URL(tokenEndpoint);
      return `${u.protocol}//${u.host}`;
    } catch {
      // fall through
    }
  }

  if (typeof window !== "undefined") {
    return window.location.origin.replace(/\/$/, "");
  }

  return "";
}
