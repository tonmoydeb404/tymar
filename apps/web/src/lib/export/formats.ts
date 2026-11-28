// Value formatting for the CSV export. Pure functions — no React, no I/O.

// ---- Durations ----

export type DurationFormat =
  | "hms"
  | "hm"
  | "dot"
  | "decimal"
  | "minutes"
  | "seconds"
  | "text";

export const DURATION_FORMATS: {
  id: DurationFormat;
  label: string;
  /** 8h 05m 20s rendered in this format — shown next to the option. */
  example: string;
}[] = [
  { id: "hms", label: "Clock with seconds", example: "08:05:20" },
  { id: "hm", label: "Clock (hours:minutes)", example: "08:05" },
  { id: "dot", label: "Hours.minutes", example: "8.05" },
  { id: "decimal", label: "Decimal hours", example: "8.09" },
  { id: "minutes", label: "Total minutes", example: "485" },
  { id: "seconds", label: "Total seconds", example: "29120" },
  { id: "text", label: "Words", example: "8h 5m" },
];

/** Minutes to snap durations to (0 = exact). Common for billing. */
export const ROUNDING_STEPS = [0, 1, 5, 6, 10, 15, 30] as const;
export type RoundingStep = (typeof ROUNDING_STEPS)[number];

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Rounds a duration to the nearest `stepMinutes` (0 = leave as is). */
export function roundMs(ms: number, stepMinutes: number): number {
  if (!stepMinutes) return ms;
  const step = stepMinutes * 60_000;
  return Math.round(ms / step) * step;
}

/** Renders a duration. `hm`/`dot` work from whole minutes (rounded), so
 * 1h 59m 40s is "2:00"/"2.00", never "1:60". `dot` is hours.minutes with
 * the minutes as minutes — 2h 05m is "2.05" — NOT decimal hours. */
export function formatDurationAs(
  ms: number,
  format: DurationFormat,
  decimalMark: "." | "," = ".",
): string {
  const safe = Math.max(0, ms);
  switch (format) {
    case "hms": {
      const total = Math.floor(safe / 1000);
      return `${pad2(Math.floor(total / 3600))}:${pad2(Math.floor((total % 3600) / 60))}:${pad2(total % 60)}`;
    }
    case "hm": {
      const minutes = Math.round(safe / 60_000);
      return `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;
    }
    case "dot": {
      const minutes = Math.round(safe / 60_000);
      return `${Math.floor(minutes / 60)}.${pad2(minutes % 60)}`;
    }
    case "decimal":
      return (safe / 3_600_000).toFixed(2).replace(".", decimalMark);
    case "minutes":
      return String(Math.round(safe / 60_000));
    case "seconds":
      return String(Math.floor(safe / 1000));
    case "text": {
      const minutes = Math.round(safe / 60_000);
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      if (h === 0) return `${m}m`;
      return m === 0 ? `${h}h` : `${h}h ${m}m`;
    }
  }
}

// ---- Dates and clock times ----

export type DateFormat = "iso" | "dmy" | "mdy" | "dmy-dot" | "long";

export const DATE_FORMATS: { id: DateFormat; label: string; example: string }[] =
  [
    { id: "iso", label: "Year-month-day", example: "2026-11-28" },
    { id: "dmy", label: "Day/month/year", example: "28/11/2026" },
    { id: "mdy", label: "Month/day/year", example: "11/28/2026" },
    { id: "dmy-dot", label: "Day.month.year", example: "28.11.2026" },
    { id: "long", label: "Short month name", example: "28 Nov 2026" },
  ];

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Formats a "YYYY-MM-DD" day key. */
export function formatDay(day: string, format: DateFormat): string {
  const [y = "", m = "", d = ""] = day.split("-");
  switch (format) {
    case "iso":
      return day;
    case "dmy":
      return `${d}/${m}/${y}`;
    case "mdy":
      return `${m}/${d}/${y}`;
    case "dmy-dot":
      return `${d}.${m}.${y}`;
    case "long":
      return `${Number(d)} ${MONTHS[Number(m) - 1] ?? m} ${y}`;
  }
}

export type TimeFormat = "24h" | "24h-s" | "12h";

export const TIME_FORMATS: { id: TimeFormat; label: string; example: string }[] =
  [
    { id: "24h", label: "24-hour", example: "14:05" },
    { id: "24h-s", label: "24-hour with seconds", example: "14:05:30" },
    { id: "12h", label: "12-hour", example: "2:05 PM" },
  ];

/** Clock time of an instant in `timeZone`. */
export function formatClock(
  epochMs: number,
  timeZone: string,
  format: TimeFormat,
): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: format === "12h",
    hour: format === "12h" ? "numeric" : "2-digit",
    minute: "2-digit",
    second: format === "24h-s" ? "2-digit" : undefined,
  }).formatToParts(new Date(epochMs));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  // hour12:false can render midnight as "24".
  const hour = format === "12h" ? get("hour") : pad2(Number(get("hour")) % 24);
  const base = `${hour}:${get("minute")}`;
  const withSeconds = format === "24h-s" ? `${base}:${get("second")}` : base;
  return format === "12h" ? `${withSeconds} ${get("dayPeriod")}` : withSeconds;
}

export function formatWeekday(epochMs: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" }).format(
    new Date(epochMs),
  );
}
