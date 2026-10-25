import { TIMEZONE } from "@/lib/domain/progress";

/** Current time (server components render per request, so this is intentional). */
export function nowMs() {
  return Date.now();
}

export function greeting(now = new Date()) {
  const h = Number(now.toLocaleString("en-GB", { hour: "numeric", hour12: false, timeZone: TIMEZONE }));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export function formatDate(d: Date | string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  return new Date(d).toLocaleDateString("en-GB", { timeZone: TIMEZONE, ...opts });
}

export function formatDateTime(d: Date | string) {
  return new Date(d).toLocaleString("en-GB", { timeZone: TIMEZONE, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function relativeDay(d: Date, now = new Date()) {
  const days = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return formatDate(d);
}

export function pct(x: number | null | undefined) {
  return x === null || x === undefined ? "—" : `${Math.round(x * 100)}%`;
}

export function plural(n: number, word: string, pluralWord = `${word}s`) {
  return `${n} ${n === 1 ? word : pluralWord}`;
}
