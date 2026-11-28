"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@packages/ui/components/select";

type Option<T extends string> = { id: T; label: string; example?: string };

type Props<T extends string> = {
  id?: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
  className?: string;
};

/** Select over a fixed option list. The label is resolved here (not by
 * Base UI's SelectValue) so the closed trigger always shows a name. */
export function OptionSelect<T extends string>({
  id,
  value,
  options,
  onChange,
  className,
}: Props<T>) {
  const current = options.find((o) => o.id === value);
  return (
    <Select value={value} onValueChange={(v) => v && onChange(v as T)}>
      <SelectTrigger id={id} className={className ?? "w-full"}>
        <span className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="truncate">{current?.label ?? value}</span>
          {current?.example && (
            <span className="font-mono text-xs text-muted-foreground">
              {current.example}
            </span>
          )}
        </span>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            <span className="flex items-baseline gap-2">
              {o.label}
              {o.example && (
                <span className="font-mono text-xs text-muted-foreground">
                  {o.example}
                </span>
              )}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
