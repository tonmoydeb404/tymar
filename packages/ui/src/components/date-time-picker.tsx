"use client";

import { CalendarIcon, X } from "lucide-react";
import * as React from "react";

import { Button } from "@packages/ui/components/button";
import { Calendar } from "@packages/ui/components/calendar";
import { useIsMobile } from "@packages/ui/hooks/use-mobile";
import { PickerSurface } from "@packages/ui/components/picker-surface";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@packages/ui/components/select";
import { cn } from "@packages/ui/lib/utils";

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

type DateTimePickerProps = {
  /** ISO 8601 string, or null/"" when empty. */
  value: string | null | undefined;
  onChange: (iso: string | null) => void;
  placeholder?: string;
  /** Shown as the drawer title on mobile. */
  title?: string;
  id?: string;
  disabled?: boolean;
  invalid?: boolean;
  /** Adds a clear button — for optional values. */
  clearable?: boolean;
  fromDate?: Date;
  toDate?: Date;
  className?: string;
};

function Picker({
  value,
  onChange,
  fromDate,
  toDate,
}: Pick<DateTimePickerProps, "onChange" | "fromDate" | "toDate"> & {
  value: Date | undefined;
}) {
  const isMobile = useIsMobile();
  const commit = (next: Date) => onChange(next.toISOString());

  const handleDateSelect = (selected: Date | undefined) => {
    if (!selected) return;
    const next = value ? new Date(value) : new Date();
    next.setFullYear(
      selected.getFullYear(),
      selected.getMonth(),
      selected.getDate(),
    );
    commit(next);
  };

  const handleTimeChange = (
    type: "hour" | "minute" | "ampm",
    timeValue: string,
  ) => {
    const next = value ? new Date(value) : new Date();
    if (type === "hour") {
      const hours = parseInt(timeValue, 10) % 12;
      next.setHours(hours + (next.getHours() >= 12 ? 12 : 0));
    } else if (type === "minute") {
      next.setMinutes(parseInt(timeValue, 10));
    } else {
      const hours = next.getHours() % 12;
      next.setHours(timeValue === "PM" ? hours + 12 : hours);
    }
    commit(next);
  };

  const hour12 = value ? value.getHours() % 12 || 12 : null;
  const pm = value ? value.getHours() >= 12 : null;

  return (
    <div className={cn("grid gap-4 p-3", !isMobile && "w-[320px]")}>
      <Calendar
        mode="single"
        selected={value}
        defaultMonth={value}
        onSelect={handleDateSelect}
        startMonth={fromDate}
        endMonth={toDate}
        disabled={[
          ...(fromDate ? [{ before: fromDate }] : []),
          ...(toDate ? [{ after: toDate }] : []),
        ]}
        className="mx-auto bg-transparent p-0"
      />

      <div className="grid gap-3 border-t border-border pt-4">
        <span className="text-xs font-medium text-muted-foreground">Time</span>
        <div className="flex items-center gap-2">
          <Select
            value={hour12 === null ? "" : String(hour12)}
            onValueChange={(v) => v && handleTimeChange("hour", v)}
          >
            <SelectTrigger className="flex-1 tabular-nums" aria-label="Hour">
              <span>{hour12 === null ? "Hour" : hour12}</span>
            </SelectTrigger>
            <SelectContent>
              {HOURS.map((h) => (
                <SelectItem key={h} value={String(h)}>
                  {h}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground">:</span>
          <Select
            value={value ? String(value.getMinutes()) : ""}
            onValueChange={(v) => v && handleTimeChange("minute", v)}
          >
            <SelectTrigger className="flex-1 tabular-nums" aria-label="Minute">
              <span>
                {value ? String(value.getMinutes()).padStart(2, "0") : "Min"}
              </span>
            </SelectTrigger>
            <SelectContent>
              {MINUTES.map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {String(m).padStart(2, "0")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex shrink-0 gap-1 rounded-full bg-muted p-0.5">
            {(["AM", "PM"] as const).map((ampm) => {
              const selected = pm === null ? false : (ampm === "PM") === pm;
              return (
                <button
                  key={ampm}
                  type="button"
                  onClick={() => handleTimeChange("ampm", ampm)}
                  className={cn(
                    "h-8 rounded-full px-3 text-xs font-medium transition-colors",
                    selected
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {ampm}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Date + time picker. A popover on desktop, a bottom drawer on mobile
 * (same breakpoint as `ResponsiveSheet`). Value is an ISO string. */
function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick a date & time",
  title = "Pick a date & time",
  id,
  disabled,
  invalid,
  clearable,
  fromDate,
  toDate,
  className,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const date = value ? new Date(value) : undefined;
  const valid = date && Number.isFinite(date.getTime()) ? date : undefined;

  return (
    <PickerSurface
      open={open}
      onOpenChange={setOpen}
      title={title}
      renderTrigger={({ onClick }) => (
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-invalid={invalid}
          className={cn(
            "w-full justify-start text-left font-normal",
            !valid && "text-muted-foreground",
            className,
          )}
          onClick={onClick}
        >
          <CalendarIcon className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            {valid ? formatDateTime(valid) : placeholder}
          </span>
          {clearable && valid && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear"
              className="grid size-5 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  onChange(null);
                }
              }}
            >
              <X className="size-3" />
            </span>
          )}
        </Button>
      )}
    >
      <Picker
        value={valid}
        onChange={(iso) => onChange(iso)}
        fromDate={fromDate}
        toDate={toDate}
      />
    </PickerSurface>
  );
}

export { DateTimePicker };
export type { DateTimePickerProps };
