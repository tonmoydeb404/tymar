import { defaultConfig, type ExportConfig } from "./columns";

export type ExportPreset = {
  id: string;
  label: string;
  hint: string;
  apply: (current: ExportConfig) => ExportConfig;
};

/** One-click starting points. They set layout and formats but keep the
 * user's filters, and the user can still tweak anything afterwards. */
export const EXPORT_PRESETS: ExportPreset[] = [
  {
    id: "standard",
    label: "Standard",
    hint: "Every session, clock durations",
    apply: (c) => ({ ...defaultConfig(), filters: c.filters }),
  },
  {
    id: "timesheet",
    label: "Timesheet",
    hint: "One row per day, hours.minutes (8.05)",
    apply: (c) => ({
      ...defaultConfig(),
      filters: c.filters,
      mode: "daily",
      durationFormat: "dot",
      totalsRow: true,
    }),
  },
  {
    id: "billing",
    label: "Billing",
    hint: "By project, decimal hours, 15-min rounding",
    apply: (c) => ({
      ...defaultConfig(),
      filters: c.filters,
      mode: "projects",
      durationFormat: "decimal",
      rounding: 15,
      totalsRow: true,
    }),
  },
];
