import { presetRange } from "@packages/ui/components/date-range-picker";

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Exclusive upper bound: the day after `dateStr`, at UTC midnight. */
export function dayAfter(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

/** What every date-filtered screen opens on: this week (Mon–Sun) — the
 * first thing people check is how this week's work is going. */
export function defaultRange() {
  return presetRange("this-week");
}

/** [ISO start, ISO exclusive end) bounds for one "YYYY-MM-DD" day key. */
export function dayBounds(day: string): { from: string; to: string } {
  return { from: `${day}T00:00:00.000Z`, to: dayAfter(day) };
}
