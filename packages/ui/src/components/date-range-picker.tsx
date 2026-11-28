"use client";

import { CalendarIcon } from "lucide-react";
import * as React from "react";
import type { DateRange } from "react-day-picker";

import { Button } from "@packages/ui/components/button";
import { Calendar } from "@packages/ui/components/calendar";
import { PickerSurface } from "@packages/ui/components/picker-surface";
import { useIsMobile } from "@packages/ui/hooks/use-mobile";
import { cn } from "@packages/ui/lib/utils";

export type DateRangeValue = { from?: string; to?: string };

export type RangePresetId =
  | "today"
  | "yesterday"
  | "this-week"
  | "last-week"
  | "last-7"
  | "this-month"
  | "last-month"
  | "last-30";

type RangePreset = { id: RangePresetId; label: string };

export const RANGE_PRESETS: readonly RangePreset[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "this-week", label: "This week" },
  { id: "last-week", label: "Last week" },
  { id: "last-7", label: "Last 7 days" },
  { id: "this-month", label: "This month" },
  { id: "last-month", label: "Last month" },
  { id: "last-30", label: "Last 30 days" },
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Local calendar day as "YYYY-MM-DD" (no UTC shift). */
function dayString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  const date = new Date(y, m - 1, d);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  return next;
}

/** Monday-based week start (ISO weeks). */
function startOfWeek(d: Date): Date {
  const offset = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  return addDays(d, -offset);
}

/** The "YYYY-MM-DD" range a preset stands for, relative to `now`. */
export function presetRange(
  id: RangePresetId,
  now: Date = new Date(),
): { from: string; to: string } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let from = today;
  let to = today;
  switch (id) {
    case "today":
      break;
    case "yesterday":
      from = to = addDays(today, -1);
      break;
    case "this-week":
      from = startOfWeek(today);
      to = addDays(from, 6);
      break;
    case "last-week":
      from = addDays(startOfWeek(today), -7);
      to = addDays(from, 6);
      break;
    case "last-7":
      from = addDays(today, -6);
      break;
    case "this-month":
      from = new Date(today.getFullYear(), today.getMonth(), 1);
      to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      break;
    case "last-month":
      from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      to = new Date(today.getFullYear(), today.getMonth(), 0);
      break;
    case "last-30":
      from = addDays(today, -29);
      break;
  }
  return { from: dayString(from), to: dayString(to) };
}

/** Which preset (if any) a range equals — drives the chip highlight and
 * the trigger label. */
export function matchPreset(
  value: DateRangeValue,
  now: Date = new Date(),
): RangePresetId | null {
  if (!value.from || !value.to) return null;
  for (const p of RANGE_PRESETS) {
    const r = presetRange(p.id, now);
    if (r.from === value.from && r.to === value.to) return p.id;
  }
  return null;
}

function shortDay(value: string | undefined, withYear: boolean): string {
  const date = parseDate(value);
  if (!date) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

function describeRange(value: DateRangeValue): string {
  if (!value.from) return "Pick a date range";
  const sameYear =
    !value.to || value.from.slice(0, 4) === value.to.slice(0, 4);
  const thisYear = String(new Date().getFullYear());
  const withYear = !(sameYear && value.from.slice(0, 4) === thisYear);
  if (!value.to || value.to === value.from) {
    return shortDay(value.from, true);
  }
  return `${shortDay(value.from, withYear && !sameYear)} – ${shortDay(value.to, withYear)}`;
}

type DateRangePickerProps = {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  className?: string;
  /** Which quick-select chips to show (default: all). */
  presets?: readonly RangePresetId[];
  /** The "today" the presets resolve against (a local-midnight Date) —
   * pass the user's reporting-timezone date when it differs from the
   * device's. */
  now?: Date;
};

/** From/to date range picker backed by "YYYY-MM-DD" strings, for URL-driven
 * filters. Quick-select chips (This week, This month, …) apply instantly;
 * the calendar handles custom ranges. A popover on desktop, a drawer on
 * mobile. */
function DateRangePicker({
  value,
  onChange,
  className,
  presets,
  now,
}: DateRangePickerProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<DateRangeValue>(value);

  const chips = presets
    ? RANGE_PRESETS.filter((p) => presets.includes(p.id))
    : RANGE_PRESETS;

  const selected: DateRange | undefined = React.useMemo(
    () => ({ from: parseDate(draft.from), to: parseDate(draft.to) }),
    [draft.from, draft.to],
  );

  const matched = matchPreset(value, now);
  const matchedLabel = RANGE_PRESETS.find((p) => p.id === matched)?.label;
  const draftPreset = matchPreset(draft, now);

  function applyPreset(id: RangePresetId) {
    const next = presetRange(id, now);
    onChange(next);
    setDraft(next);
    setOpen(false);
  }

  function commit() {
    onChange(draft);
    setOpen(false);
  }

  return (
    <PickerSurface
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(value);
        setOpen(next);
      }}
      title="Date range"
      align="end"
      renderTrigger={({ onClick }) => (
        <Button
          type="button"
          variant="outline"
          className={cn("justify-start gap-2 font-normal", className)}
          onClick={onClick}
        >
          <CalendarIcon className="size-4 shrink-0" />
          {matchedLabel ? (
            <>
              <span className="font-medium">{matchedLabel}</span>
              <span className="text-muted-foreground">
                {describeRange(value)}
              </span>
            </>
          ) : (
            describeRange(value)
          )}
        </Button>
      )}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            size={isMobile ? "lg" : "sm"}
            onClick={() => {
              setDraft(value);
              setOpen(false);
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size={isMobile ? "lg" : "sm"}
            disabled={!draft.from || !draft.to}
            onClick={commit}
          >
            Apply
          </Button>
        </>
      }
    >
      {/* Fixed width on desktop so the chips wrap inside the calendar's
          width instead of stretching the popover into one long row. */}
      <div className={isMobile ? "w-full" : "w-[37rem]"}>
        <div className="flex flex-wrap gap-1.5 border-b border-border p-3">
          {chips.map((p) => (
            <Button
              key={p.id}
              type="button"
              size="xs"
              variant={draftPreset === p.id ? "default" : "outline"}
              className="rounded-full"
              onClick={() => applyPreset(p.id)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <Calendar
          mode="range"
          weekStartsOn={1}
          numberOfMonths={isMobile ? 1 : 2}
          selected={selected}
          defaultMonth={selected?.from}
          onSelect={(range) => {
            setDraft({
              from: range?.from ? dayString(range.from) : undefined,
              to: range?.to ? dayString(range.to) : undefined,
            });
          }}
          className={cn("mx-auto", isMobile ? "p-2" : "p-4")}
          classNames={{
            months: cn("relative flex gap-6", isMobile ? "flex-col" : "flex-row"),
          }}
        />
      </div>
    </PickerSurface>
  );
}

export { DateRangePicker };
export type { DateRangePickerProps };
