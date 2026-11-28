import { dayKey, rangeBounds } from "@packages/domain/index";
import { presetRange } from "@packages/ui/components/date-range-picker";

/** A local-midnight Date whose calendar day is "today" in `timeZone` — the
 * `now` the range presets need so "this week" follows the user's reporting
 * zone rather than the browser's. */
export function todayIn(timeZone: string): Date {
  const [y, m, d] = dayKey(Date.now(), timeZone).split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

/** What every date-filtered screen opens on: this week (Mon–Sun). */
export function defaultRange(timeZone: string) {
  return presetRange("this-week", todayIn(timeZone));
}

/** ISO [from, to) instants for an inclusive "YYYY-MM-DD" range in `timeZone`. */
export function rangeInstants(
  range: { from: string; to: string },
  timeZone: string,
): { from: string; to: string } {
  const { startMs, endMs } = rangeBounds(range.from, range.to, timeZone);
  return {
    from: new Date(startMs).toISOString(),
    to: new Date(endMs).toISOString(),
  };
}
