"use client";

import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { getProject, queryProjects } from "@/lib/db";
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
import { ChevronsUpDown, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export type ComboboxOption = { value: string; label: string };

const DEBOUNCE_MS = 300;

type Props = {
  /** Selected project ids. */
  value: string[];
  onValueChange: (projectIds: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  emptyText?: string;
  className?: string;
  id?: string;
};

/** Async, debounced multi project picker backed by `queryProjects`.
 * Toggling an option keeps the popover open. */
export function ProjectMultiSelect({
  value,
  onValueChange,
  disabled,
  placeholder = "Select projects…",
  emptyText = "No projects found.",
  className,
  id,
}: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ComboboxOption[]>([]);
  const [loading, setLoading] = useState(false);
  // Labels for selected ids — filled from searches and ad-hoc resolutions.
  const [labels, setLabels] = useState<Map<string, ComboboxOption>>(new Map());
  const requestId = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(
    (q: string) => {
      if (!user) return;
      const id = ++requestId.current;
      setLoading(true);
      queryProjects(user.id, { search: q, limit: 20 })
        .then(({ projects }) => {
          if (id !== requestId.current) return;
          setResults(projects.map((p) => ({ value: p.id, label: p.name })));
        })
        .catch(() => {
          if (id === requestId.current) setResults([]);
        })
        .finally(() => {
          if (id === requestId.current) setLoading(false);
        });
    },
    [user],
  );

  function handleInputValueChange(q: string) {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(q), DEBOUNCE_MS);
  }

  // Fresh, unfiltered results every time the popover opens.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    runSearch("");
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [open, runSearch]);

  const resolveLabel = useCallback(
    async (projectId: string): Promise<ComboboxOption | null> => {
      const project = await getProject(projectId);
      return project ? { value: project.id, label: project.name } : null;
    },
    [],
  );

  useEffect(() => {
    setLabels((prev) => {
      const next = new Map(prev);
      for (const option of results) next.set(option.value, option);
      return next;
    });
  }, [results]);

  // Resolve labels for selected ids the searches haven't seen yet.
  useEffect(() => {
    const missing = value.filter((v) => !labels.has(v));
    if (missing.length === 0) return;
    let cancelled = false;
    void (async () => {
      for (const missingId of missing) {
        const option = await resolveLabel(missingId);
        if (cancelled) return;
        if (option) {
          setLabels((prev) => new Map(prev).set(option.value, option));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [value, labels, resolveLabel]);

  const selectedOptions = value
    .map((v) => labels.get(v))
    .filter((option): option is ComboboxOption => Boolean(option));

  function toggle(option: ComboboxOption) {
    onValueChange(
      value.includes(option.value)
        ? value.filter((v) => v !== option.value)
        : [...value, option.value],
    );
  }

  const triggerLabel =
    selectedOptions.length === 0
      ? placeholder
      : selectedOptions.length === 1
        ? (selectedOptions[0]?.label ?? "")
        : `${selectedOptions.length} projects selected`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        render={
          <Button
            type="button"
            role="combobox"
            aria-expanded={open}
            variant="outline"
            disabled={disabled || !user}
            className={cn(
              "h-9 w-full justify-between px-3 font-normal",
              selectedOptions.length === 0 && "text-muted-foreground",
              className,
            )}
          >
            <span className="truncate">{triggerLabel}</span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </Button>
        }
      />
      <PopoverContent
        align="start"
        className="w-(--anchor-width) overflow-hidden p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={handleInputValueChange}
            placeholder="Search projects…"
          />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center gap-2 p-4 text-muted-foreground text-sm">
                <Loader2 className="size-4 animate-spin" />
                Searching…
              </div>
            ) : (
              <>
                {results.length === 0 && <CommandEmpty>{emptyText}</CommandEmpty>}
                {results.length > 0 && (
                  <CommandGroup>
                    {results.map((option) => (
                      <CommandItem
                        key={option.value}
                        value={option.value}
                        data-checked={value.includes(option.value) || undefined}
                        onSelect={() => toggle(option)}
                      >
                        {option.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
