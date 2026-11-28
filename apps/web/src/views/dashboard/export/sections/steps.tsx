"use client";

import { ProjectMultiSelect } from "@/components/selectors/project-multi-select";
import { EXPORT_MODES, type ExportMode } from "@/lib/export/columns";
import { DATE_FORMATS, DURATION_FORMATS } from "@/lib/export/formats";
import { todayIn } from "@/lib/range";
import { Button } from "@packages/ui/components/button";
import {
  DateRangePicker,
  RANGE_PRESETS,
  matchPreset,
} from "@packages/ui/components/date-range-picker";
import { Label } from "@packages/ui/components/label";
import { Tabs, TabsList, TabsTrigger } from "@packages/ui/components/tabs";
import { Pencil, RotateCcw } from "lucide-react";
import { useState } from "react";
import type { ExportState } from "../use-export";
import { ColumnsSheet } from "./columns-sheet";
import { FileBlock, FormatsBlock } from "./export-blocks";
import { OptionSelect } from "./option-select";
import { StepCard } from "./step-card";

const TYPE_OPTIONS = [
  { id: "ALL", label: "Work and breaks" },
  { id: "WORK", label: "Work only" },
  { id: "BREAK", label: "Breaks only" },
] as const;

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function rangeLabel(state: ExportState): string {
  const preset = matchPreset(state.range, todayIn(state.timeZone));
  return (
    RANGE_PRESETS.find((p) => p.id === preset)?.label ??
    `${state.range.from} – ${state.range.to}`
  );
}

// ---- 1. Basics ----

export function BasicsStep({ state }: { state: ExportState }) {
  const { config, setConfig, range, setRange, timeZone } = state;
  const mode = EXPORT_MODES.find((m) => m.id === config.mode);
  const typeLabel = TYPE_OPTIONS.find((t) => t.id === config.filters.type)?.label;
  const projects = config.filters.projectIds.length;

  return (
    <StepCard
      n={1}
      title="What to export"
      summary={`${rangeLabel(state)} · ${mode?.label} · ${typeLabel?.toLowerCase()}${projects ? ` · ${projects} project${projects === 1 ? "" : "s"}` : ""}`}
      defaultOpen
    >
      <Field label="Date range">
        <DateRangePicker
          value={range}
          onChange={setRange}
          now={todayIn(timeZone)}
          className="w-full sm:w-fit"
        />
      </Field>

      <Field label="Layout" hint={mode?.hint}>
        <Tabs
          value={config.mode}
          onValueChange={(v) =>
            setConfig((c) => ({ ...c, mode: v as ExportMode }))
          }
        >
          <TabsList className="w-full sm:w-fit">
            {EXPORT_MODES.map((m) => (
              <TabsTrigger key={m.id} value={m.id} className="flex-1">
                {m.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Include" htmlFor="export-type">
          <OptionSelect
            id="export-type"
            value={config.filters.type}
            options={TYPE_OPTIONS}
            onChange={(type) =>
              setConfig((c) => ({ ...c, filters: { ...c.filters, type } }))
            }
          />
        </Field>
        <Field label="Projects" htmlFor="export-projects">
          <ProjectMultiSelect
            id="export-projects"
            value={config.filters.projectIds}
            onValueChange={(projectIds) =>
              setConfig((c) => ({
                ...c,
                filters: { ...c.filters, projectIds },
              }))
            }
            placeholder="All projects"
            className="w-full"
          />
        </Field>
      </div>
    </StepCard>
  );
}

// ---- 2. Columns ----

export function ColumnsStep({ state }: { state: ExportState }) {
  const { config, setConfig } = state;
  const [sheetOpen, setSheetOpen] = useState(false);
  const columns = config.columns[config.mode];
  const enabled = columns.filter((c) => c.enabled).length;

  function toggle(id: string) {
    setConfig((c) => ({
      ...c,
      columns: {
        ...c.columns,
        [c.mode]: c.columns[c.mode].map((col) =>
          col.id === id ? { ...col, enabled: !col.enabled } : col,
        ),
      },
    }));
  }

  return (
    <StepCard
      n={2}
      title="Columns"
      summary={`${enabled} of ${columns.length} columns`}
    >
      <p className="text-sm text-muted-foreground">
        Tap a column to switch it on or off.
      </p>
      <div className="flex flex-wrap gap-2">
        {columns.map((c) => (
          <Button
            key={c.id}
            type="button"
            size="sm"
            variant={c.enabled ? "default" : "outline"}
            aria-pressed={c.enabled}
            onClick={() => toggle(c.id)}
          >
            {c.header}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <Button variant="outline" size="sm" onClick={() => setSheetOpen(true)}>
          <Pencil />
          Rename, reorder or add columns
        </Button>
      </div>
      <ColumnsSheet open={sheetOpen} onOpenChange={setSheetOpen} state={state} />
    </StepCard>
  );
}

// ---- 3. Format & file ----

export function FormatStep({ state }: { state: ExportState }) {
  const { config } = state;
  const duration = DURATION_FORMATS.find((f) => f.id === config.durationFormat);
  const date = DATE_FORMATS.find((f) => f.id === config.dateFormat);

  return (
    <StepCard
      n={3}
      title="Format & file"
      summary={`${duration?.label} (${duration?.example}) · ${config.rounding ? `rounded to ${config.rounding} min` : "exact"} · ${date?.example}`}
    >
      <FormatsBlock state={state} />
      <FileBlock state={state} />
      <div className="flex justify-end border-t border-border pt-4">
        <Button variant="outline" size="sm" onClick={state.resetConfig}>
          <RotateCcw />
          Reset to defaults
        </Button>
      </div>
    </StepCard>
  );
}
