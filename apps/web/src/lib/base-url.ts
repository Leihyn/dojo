export function baseUrl(req?: Request): string {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (req) { const u = new URL(req.url); return `${u.protocol}//${u.host}`; }
  return "http://localhost:3000";
}
