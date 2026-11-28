"use client";

import { Button } from "@packages/ui/components/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@packages/ui/components/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@packages/ui/components/popover";
import { Check, ChevronsUpDown, Globe } from "lucide-react";
import { useState } from "react";

type Props = {
  id?: string;
  value: string;
  onValueChange: (zone: string) => void;
  zones: string[];
};

/** Searchable IANA timezone picker (replaces a native datalist). */
export function TimezoneSelect({ id, value, onValueChange, zones }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          />
        }
      >
        <span className="flex min-w-0 items-center gap-2">
          <Globe className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{value || "Pick a timezone"}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-(--anchor-width) min-w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search timezones…" />
          <CommandList>
            <CommandEmpty>No timezone found.</CommandEmpty>
            <CommandGroup>
              {zones.map((zone) => (
                <CommandItem
                  key={zone}
                  value={zone}
                  data-checked={zone === value}
                  onSelect={() => {
                    onValueChange(zone);
                    setOpen(false);
                  }}
                >
                  {zone}
                  {zone === value && <Check className="ml-auto size-4" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
