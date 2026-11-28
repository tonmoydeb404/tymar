"use client";

import { CalendarIcon, X } from "lucide-react";
import * as React from "react";

import { Button } from "@packages/ui/components/button";
import { Calendar } from "@packages/ui/components/calendar";
import { PickerSurface } from "@packages/ui/components/picker-surface";
import { useIsMobile } from "@packages/ui/hooks/use-mobile";
import { cn } from "@packages/ui/lib/utils";

/** "YYYY-MM-DD" → local Date at midnight (no UTC shift). */
function parseDay(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  const date = new Date(y, m - 1, d);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

function formatDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

type DatePickerProps = {
  /** "YYYY-MM-DD", or ""/null when empty. */
  value: string | null | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  title?: string;
  id?: string;
  disabled?: boolean;
  invalid?: boolean;
  clearable?: boolean;
  fromDate?: Date;
  toDate?: Date;
  className?: string;
};

/** Single-day picker (due dates etc.). A popover on desktop, a bottom
 * drawer on mobile. Value is a "YYYY-MM-DD" string. */
function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  title = "Pick a date",
  id,
  disabled,
  invalid,
  clearable,
  fromDate,
  toDate,
  className,
}: DatePickerProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = React.useState(false);
  const date = parseDay(value);

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
            !date && "text-muted-foreground",
            className,
          )}
          onClick={onClick}
        >
          <CalendarIcon className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            {date
              ? date.toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : placeholder}
          </span>
          {clearable && date && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear"
              className="grid size-5 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  onChange("");
                }
              }}
            >
              <X className="size-3" />
            </span>
          )}
        </Button>
      )}
    >
      <Calendar
        mode="single"
        selected={date}
        defaultMonth={date}
        onSelect={(picked) => {
          if (!picked) return;
          onChange(formatDay(picked));
          setOpen(false);
        }}
        startMonth={fromDate}
        endMonth={toDate}
        disabled={[
          ...(fromDate ? [{ before: fromDate }] : []),
          ...(toDate ? [{ after: toDate }] : []),
        ]}
        fluid={isMobile}
        className={cn("bg-transparent", isMobile ? "px-4 py-2" : "mx-auto")}
      />
    </PickerSurface>
  );
}

export { DatePicker, formatDay, parseDay };
export type { DatePickerProps };
