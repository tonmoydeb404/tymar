"use client";

import { CalendarIcon, X } from "lucide-react";
import * as React from "react";

import { Button } from "@packages/ui/components/button";
import { Calendar } from "@packages/ui/components/calendar";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@packages/ui/components/drawer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@packages/ui/components/popover";
import { ScrollArea, ScrollBar } from "@packages/ui/components/scroll-area";
import { useIsMobile } from "@packages/ui/hooks/use-mobile";
import { cn } from "@packages/ui/lib/utils";

const HOURS = Array.from({ length: 12 }, (_, i) => 12 - i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

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

  return (
    <div className="sm:flex">
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
        className="mx-auto"
      />
      <div className="flex flex-col divide-y sm:h-[300px] sm:flex-row sm:divide-x sm:divide-y-0">
        <ScrollArea className="w-full sm:w-auto">
          <div className="flex p-2 sm:flex-col">
            {HOURS.map((hour) => (
              <Button
                key={hour}
                type="button"
                size="icon"
                variant={
                  value && value.getHours() % 12 === hour % 12
                    ? "default"
                    : "ghost"
                }
                className="aspect-square shrink-0 sm:w-full"
                onClick={() => handleTimeChange("hour", hour.toString())}
              >
                {hour}
              </Button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" className="sm:hidden" />
        </ScrollArea>
        <ScrollArea className="w-full sm:w-auto">
          <div className="flex p-2 sm:flex-col">
            {MINUTES.map((minute) => (
              <Button
                key={minute}
                type="button"
                size="icon"
                variant={
                  value && value.getMinutes() === minute ? "default" : "ghost"
                }
                className="aspect-square shrink-0 sm:w-full"
                onClick={() => handleTimeChange("minute", minute.toString())}
              >
                {String(minute).padStart(2, "0")}
              </Button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" className="sm:hidden" />
        </ScrollArea>
        <div className="flex gap-1 p-2 sm:flex-col">
          {(["AM", "PM"] as const).map((ampm) => (
            <Button
              key={ampm}
              type="button"
              size="icon"
              variant={
                value &&
                ((ampm === "AM" && value.getHours() < 12) ||
                  (ampm === "PM" && value.getHours() >= 12))
                  ? "default"
                  : "ghost"
              }
              className="aspect-square shrink-0 sm:w-full"
              onClick={() => handleTimeChange("ampm", ampm)}
            >
              {ampm}
            </Button>
          ))}
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
  const isMobile = useIsMobile();
  const [open, setOpen] = React.useState(false);
  const date = value ? new Date(value) : undefined;
  const valid = date && Number.isFinite(date.getTime()) ? date : undefined;

  const trigger = (
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
      onClick={isMobile ? () => setOpen(true) : undefined}
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
  );

  if (isMobile) {
    return (
      <>
        {trigger}
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent>
            <DrawerHeader className="text-left">
              <DrawerTitle>{title}</DrawerTitle>
            </DrawerHeader>
            <div className="max-h-[60svh] overflow-y-auto">
              <Picker
                value={valid}
                onChange={(iso) => onChange(iso)}
                fromDate={fromDate}
                toDate={toDate}
              />
            </div>
            <DrawerFooter>
              <Button type="button" onClick={() => setOpen(false)}>
                Done
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger} />
      <PopoverContent className="w-auto p-0" align="start">
        <Picker
          value={valid}
          onChange={(iso) => onChange(iso)}
          fromDate={fromDate}
          toDate={toDate}
        />
      </PopoverContent>
    </Popover>
  );
}

export { DateTimePicker };
export type { DateTimePickerProps };
