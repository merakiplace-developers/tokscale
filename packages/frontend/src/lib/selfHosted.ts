const DEFAULT_HOSTS = new Set([
  "https://tokscale.ai",
  "http://localhost:3000",
  "",
]);

export function getSelfHostedUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_URL?.replace(/\/+$/, "") ?? "";
  if (DEFAULT_HOSTS.has(url)) return null;
  return url;
}
