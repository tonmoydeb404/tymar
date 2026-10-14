import { cn } from "@/lib/utils";
import { Button } from "@packages/ui/components/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@packages/ui/components/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@packages/ui/components/popover";
import { ChevronsUpDown, Loader2, Plus, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export type ComboboxOption = { value: string; label: string };

const DEBOUNCE_MS = 300;

/** Debounced, server-side search with a request-race guard — only the
 * latest query's results are kept. Shared by the async comboboxes. */
export function useAsyncSearch(
  search: (query: string) => Promise<ComboboxOption[]>,
) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ComboboxOption[]>([]);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(
    (q: string) => {
      const id = ++requestId.current;
      setLoading(true);
      search(q)
        .then((rows) => {
          if (id === requestId.current) setResults(rows);
        })
        .catch(() => {
          if (id === requestId.current) setResults([]);
        })
        .finally(() => {
          if (id === requestId.current) setLoading(false);
        });
    },
    [search],
  );

  const onQueryChange = useCallback(
    (q: string) => {
      setQuery(q);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!q.trim()) {
        runSearch(q);
        return;
      }
      debounceRef.current = setTimeout(() => runSearch(q), DEBOUNCE_MS);
    },
    [runSearch],
  );

  /** Clears the input and reloads the unfiltered results — call on open. */
  const reset = useCallback(() => {
    setQuery("");
    runSearch("");
  }, [runSearch]);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  return { query, onQueryChange, results, loading, reset };
}

type Props = {
  /** Selected id, empty string means nothing selected. */
  value: string;
  onValueChange: (value: string, option: ComboboxOption | null) => void;
  /** Server-side search, re-run on open and (debounced) on every keystroke. */
  search: (query: string) => Promise<ComboboxOption[]>;
  /** Resolves the label for a pre-selected id that isn't among the search results. */
  resolveLabel: (value: string) => Promise<ComboboxOption | null>;
  /** Enables the inline `Create "…"` row; receives the typed query. */
  onCreate?: (query: string) => Promise<ComboboxOption>;
  /** Text shown on the closed trigger when nothing is selected. */
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
};

/** Async, server-searched combobox — options are fetched, not filtered
 * client-side. Single select; optionally offers creating a new entry
 * from the typed query. */
export function AsyncCombobox({
  value,
  onValueChange,
  search,
  resolveLabel,
  onCreate,
  placeholder = "Select…",
  searchPlaceholder = "Type to search…",
  emptyText = "No results.",
  disabled,
  className,
  id,
}: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ComboboxOption | null>(null);
  const [creating, setCreating] = useState(false);
  const { query, onQueryChange, results, loading, reset } =
    useAsyncSearch(search);

  // Fresh, unfiltered results every time the popover opens.
  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  // Resolve the label of an externally-set value that isn't known locally yet.
  useEffect(() => {
    if (!value) {
      setSelected(null);
      return;
    }
    if (selected?.value === value) return;
    const known = results.find((o) => o.value === value);
    if (known) {
      setSelected(known);
      return;
    }
    let cancelled = false;
    void resolveLabel(value).then((option) => {
      if (!cancelled && option) setSelected(option);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, results, resolveLabel]);

  const trimmed = query.trim();
  const canCreate =
    Boolean(onCreate) &&
    trimmed.length > 0 &&
    !loading &&
    !results.some((o) => o.label.toLowerCase() === trimmed.toLowerCase());

  function pick(option: ComboboxOption) {
    setSelected(option);
    onValueChange(option.value, option);
    setOpen(false);
  }

  async function handleCreate() {
    if (!onCreate || !trimmed || creating) return;
    setCreating(true);
    try {
      pick(await onCreate(trimmed));
    } finally {
      setCreating(false);
    }
  }

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
            disabled={disabled}
            className={cn(
              "h-9 w-full justify-between px-3 font-normal",
              !selected && "text-muted-foreground",
              className,
            )}
          >
            <span className="truncate">{selected?.label ?? placeholder}</span>
            <span className="flex shrink-0 items-center gap-1">
              {selected && !disabled && (
                <span
                  role="button"
                  aria-label="Clear selection"
                  className="-mx-0.5 rounded-full p-0.5 hover:bg-foreground/10"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected(null);
                    onValueChange("", null);
                  }}
                >
                  <X className="size-3.5" />
                </span>
              )}
              <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
            </span>
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
            onValueChange={onQueryChange}
            placeholder={searchPlaceholder}
          />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center gap-2 p-4 text-muted-foreground text-sm">
                <Loader2 className="size-4 animate-spin" />
                Searching…
              </div>
            ) : (
              <>
                {results.length === 0 && !canCreate && (
                  <CommandEmpty>{emptyText}</CommandEmpty>
                )}
                {results.length > 0 && (
                  <CommandGroup>
                    {results.map((option) => (
                      <CommandItem
                        key={option.value}
                        value={option.value}
                        data-checked={value === option.value || undefined}
                        onSelect={() => pick(option)}
                      >
                        {option.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {canCreate && (
                  <>
                    {results.length > 0 && <CommandSeparator />}
                    <CommandGroup>
                      <CommandItem
                        value="__create__"
                        disabled={creating}
                        onSelect={() => void handleCreate()}
                      >
                        {creating ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Plus />
                        )}
                        Create &ldquo;{trimmed}&rdquo;
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
