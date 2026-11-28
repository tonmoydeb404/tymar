// Column catalog for each export mode, plus the saved configuration shape.

import {
  DURATION_FORMATS,
  type DateFormat,
  type DurationFormat,
  type RoundingStep,
  type TimeFormat,
} from "./formats";
import type { CsvOptions } from "./csv";

export type ExportMode = "entries" | "daily" | "projects";

export const EXPORT_MODES: { id: ExportMode; label: string; hint: string }[] = [
  {
    id: "entries",
    label: "Entries",
    hint: "One row per tracked session.",
  },
  {
    id: "daily",
    label: "Daily summary",
    hint: "One row per day with work, break and total.",
  },
  {
    id: "projects",
    label: "By project",
    hint: "One row per project with its totals.",
  },
];

export type ColumnDef = {
  id: string;
  label: string;
  /** Shown and enabled the first time (the default export). */
  defaultOn: boolean;
  /** A duration cell: formatted with the chosen duration format. */
  duration?: boolean;
  /** Summed in the optional totals row. */
  sum?: boolean;
  /** One-line help shown in the column list and token picker. */
  hint?: string;
};

export const COLUMN_CATALOG: Record<ExportMode, ColumnDef[]> = {
  entries: [
    { id: "date", label: "Date", defaultOn: true, hint: "Start date" },
    { id: "weekday", label: "Weekday", defaultOn: false },
    { id: "start", label: "Start time", defaultOn: true },
    { id: "end", label: "End time", defaultOn: true },
    {
      id: "duration",
      label: "Duration",
      defaultOn: true,
      duration: true,
      sum: true,
    },
    { id: "type", label: "Type", defaultOn: true, hint: "Work or Break" },
    { id: "project", label: "Project", defaultOn: true },
    { id: "task", label: "Task", defaultOn: true },
    { id: "workspace", label: "Workspace", defaultOn: false },
    { id: "start_iso", label: "Start (ISO)", defaultOn: false },
    { id: "end_iso", label: "End (ISO)", defaultOn: false },
    { id: "id", label: "Entry ID", defaultOn: false },
  ],
  daily: [
    { id: "date", label: "Date", defaultOn: true },
    { id: "weekday", label: "Weekday", defaultOn: true },
    { id: "work", label: "Work", defaultOn: true, duration: true, sum: true },
    { id: "break", label: "Break", defaultOn: true, duration: true, sum: true },
    { id: "total", label: "Total", defaultOn: true, duration: true, sum: true },
    { id: "entries", label: "Entries", defaultOn: true, sum: true },
    { id: "first_start", label: "First start", defaultOn: false },
    { id: "last_end", label: "Last end", defaultOn: false },
    { id: "projects", label: "Projects", defaultOn: false, hint: "Names, joined" },
  ],
  projects: [
    { id: "project", label: "Project", defaultOn: true },
    { id: "workspace", label: "Workspace", defaultOn: true },
    { id: "work", label: "Work", defaultOn: true, duration: true, sum: true },
    { id: "break", label: "Break", defaultOn: true, duration: true, sum: true },
    { id: "total", label: "Total", defaultOn: true, duration: true, sum: true },
    { id: "entries", label: "Entries", defaultOn: true, sum: true },
    { id: "days", label: "Days", defaultOn: false, hint: "Days with time" },
    { id: "share", label: "Share of work", defaultOn: false, hint: "Percent" },
    { id: "first_date", label: "First date", defaultOn: false },
    { id: "last_date", label: "Last date", defaultOn: false },
  ],
};

/** One column in the user's layout: a built-in (`custom` unset) or a
 * custom column whose value is a template like "{project} / {task}". */
export type ColumnConfig = {
  id: string;
  header: string;
  enabled: boolean;
  custom?: { template: string };
};

export type ExportFilters = {
  type: "ALL" | "WORK" | "BREAK";
  projectIds: string[];
};

export type ExportConfig = {
  mode: ExportMode;
  filters: ExportFilters;
  columns: Record<ExportMode, ColumnConfig[]>;
  durationFormat: DurationFormat;
  decimalMark: "." | ",";
  rounding: RoundingStep;
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
  /** Entries mode: break sessions that cross midnight into one row per day. */
  splitAtMidnight: boolean;
  includeRunning: boolean;
  /** Daily summary: also list days with no time (zero rows). */
  emptyDays: boolean;
  totalsRow: boolean;
  headerRow: boolean;
  csv: Pick<CsvOptions, "delimiter" | "bom" | "protectFormulas">;
};

export function defaultColumns(mode: ExportMode): ColumnConfig[] {
  return COLUMN_CATALOG[mode].map((c) => ({
    id: c.id,
    header: c.label,
    enabled: c.defaultOn,
  }));
}

/** The out-of-the-box export: every default column, sensible formats. */
export function defaultConfig(): ExportConfig {
  return {
    mode: "entries",
    filters: { type: "ALL", projectIds: [] },
    columns: {
      entries: defaultColumns("entries"),
      daily: defaultColumns("daily"),
      projects: defaultColumns("projects"),
    },
    durationFormat: "hms",
    decimalMark: ".",
    rounding: 0,
    dateFormat: "iso",
    timeFormat: "24h",
    splitAtMidnight: true,
    includeRunning: false,
    emptyDays: false,
    totalsRow: false,
    headerRow: true,
    csv: { delimiter: ",", bom: true, protectFormulas: true },
  };
}

/** Brings a saved config up to date with the current catalog: unknown
 * built-ins are dropped, new ones appended (disabled), missing fields
 * fall back to defaults — so old saved layouts survive app updates. */
export function reconcileConfig(saved: unknown): ExportConfig {
  const base = defaultConfig();
  if (!saved || typeof saved !== "object") return base;
  const s = saved as Partial<ExportConfig>;
  const merged: ExportConfig = {
    ...base,
    ...s,
    filters: { ...base.filters, ...(s.filters ?? {}) },
    csv: { ...base.csv, ...(s.csv ?? {}) },
    columns: { ...base.columns },
  };
  if (!DURATION_FORMATS.some((f) => f.id === merged.durationFormat)) {
    merged.durationFormat = base.durationFormat;
  }
  for (const mode of Object.keys(COLUMN_CATALOG) as ExportMode[]) {
    const catalog = COLUMN_CATALOG[mode];
    const savedCols = s.columns?.[mode] ?? [];
    const kept = savedCols.filter(
      (c) => c.custom || catalog.some((d) => d.id === c.id),
    );
    const missing = catalog
      .filter((d) => !kept.some((c) => c.id === d.id))
      .map((d) => ({ id: d.id, header: d.label, enabled: false }));
    merged.columns[mode] = kept.length ? [...kept, ...missing] : base.columns[mode];
  }
  if (!(mode_ok(merged.mode))) merged.mode = "entries";
  return merged;
}

function mode_ok(m: string): m is ExportMode {
  return m === "entries" || m === "daily" || m === "projects";
}
