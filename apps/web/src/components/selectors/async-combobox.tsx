"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@packages/ui/components/combobox";
import { Loader2, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type ComboboxOption = { value: string; label: string };

const DEBOUNCE_MS = 300;
const CREATE_OPTION = "__create__";

type Props = {
  /** Selected id, empty string means nothing selected. */
  value: string;
  onValueChange: (value: string) => void;
  /** Server-side search, called on open and (debounced) on every keystroke. */
  search: (query: string) => Promise<ComboboxOption[]>;
  /** Resolves the label for a pre-selected id that isn't among the last search results. */
  resolveLabel: (value: string) => Promise<ComboboxOption | null>;
  /** Enables the inline `Create "…"` row; receives the typed query. */
  onCreate?: (query: string) => Promise<ComboboxOption>;
  /** A pinned option (e.g. "All projects") always shown above the search results. */
  extraOption?: ComboboxOption;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
};

/** Debounced, server-searched combobox — options are fetched, not filtered
 * client-side. Optionally offers creating a new entry from the typed query. */
export function AsyncCombobox({
  value,
  onValueChange,
  search,
  resolveLabel,
  onCreate,
  extraOption,
  placeholder = "Search…",
  emptyText = "No results.",
  disabled,
  className,
  id,
}: Props) {
  const [options, setOptions] = useState<ComboboxOption[]>([]);
  const [selected, setSelected] = useState<ComboboxOption | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const requestId = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function runSearch(query: string) {
    const id = ++requestId.current;
    setLoading(true);
    search(query)
      .then((results) => {
        if (id === requestId.current) {
          setOptions(extraOption ? [extraOption, ...results] : results);
        }
      })
      .catch(() => {
        if (id === requestId.current) setOptions([]);
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }

  useEffect(() => {
    runSearch("");
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // Only re-run the initial search when the search function itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Resolve the label of an externally-set value that isn't known locally yet.
  useEffect(() => {
    if (!value) {
      setSelected(null);
      return;
    }
    if (selected?.value === value) return;
    if (extraOption?.value === value) {
      setSelected(extraOption);
      return;
    }
    const known = options.find((o) => o.value === value);
    if (known) {
      setSelected(known);
      return;
    }
    let cancelled = false;
    void resolveLabel(value).then((option) => {
      if (!cancelled) setSelected(option);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, options]);

  function handleInputValueChange(nextQuery: string) {
    setQuery(nextQuery);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(nextQuery), DEBOUNCE_MS);
  }

  const trimmed = query.trim();
  const canCreate =
    Boolean(onCreate) &&
    trimmed.length > 0 &&
    !loading &&
    !creating &&
    !options.some((o) => o.label.toLowerCase() === trimmed.toLowerCase());

  const displayOptions = canCreate
    ? [...options, { value: CREATE_OPTION, label: `Create “${trimmed}”` }]
    : options;

  function pick(option: ComboboxOption) {
    if (option.value === CREATE_OPTION) return; // handled by handleCreate
    setSelected(option);
    onValueChange(option.value);
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
    <Combobox
      items={displayOptions}
      value={selected}
      onValueChange={(option) => {
        const opt = option as ComboboxOption | null;
        if (opt?.value === CREATE_OPTION) {
          void handleCreate();
          return;
        }
        if (!opt) {
          // Cleared (showClear / backspace) — reset like an empty selection.
          setSelected(null);
          onValueChange("");
          return;
        }
        pick(opt);
      }}
      onInputValueChange={handleInputValueChange}
      filter={null}
      disabled={disabled}
      isItemEqualToValue={(a, b) => a?.value === b?.value}
    >
      <ComboboxInput
        id={id}
        placeholder={placeholder}
        showClear={!!selected}
        disabled={disabled}
        className={className}
      />
      <ComboboxContent>
        <ComboboxEmpty>
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Searching…
            </span>
          ) : (
            emptyText
          )}
        </ComboboxEmpty>
        <ComboboxList>
          {(item: ComboboxOption) => (
            <ComboboxItem
              key={item.value}
              value={item}
              disabled={item.value === CREATE_OPTION && creating}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                {item.value === CREATE_OPTION &&
                  (creating ? (
                    <Loader2 className="size-3.5 shrink-0 animate-spin" />
                  ) : (
                    <Plus className="size-3.5 shrink-0" />
                  ))}
                <span className="truncate">{item.label}</span>
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
