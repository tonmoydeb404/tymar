"use client";

import { ProjectMultiSelect } from "@/components/selectors/project-multi-select";
import { EXPORT_MODES, type ExportMode } from "@/lib/export/columns";
import { DURATION_FORMATS, ROUNDING_STEPS } from "@/lib/export/formats";
import { EXPORT_PRESETS } from "@/lib/export/presets";
import { todayIn } from "@/lib/range";
import { Button } from "@packages/ui/components/button";
import { Card, CardContent } from "@packages/ui/components/card";
import { DateRangePicker } from "@packages/ui/components/date-range-picker";
import { Label } from "@packages/ui/components/label";
import { Switch } from "@packages/ui/components/switch";
import { Tabs, TabsList, TabsTrigger } from "@packages/ui/components/tabs";
import { Pencil, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import type { ExportState } from "../use-export";
import { ColumnsSheet } from "./columns-sheet";
import { OptionsSheet } from "./options-sheet";
import { OptionSelect } from "./option-select";

const TYPE_OPTIONS = [
  { id: "ALL", label: "Work and breaks" },
  { id: "WORK", label: "Work only" },
  { id: "BREAK", label: "Breaks only" },
] as const;

const ROUNDING_OPTIONS = ROUNDING_STEPS.map((m) => ({
  id: String(m),
  label: m === 0 ? "Exact" : `Nearest ${m} min`,
}));

function Step({
  n,
  title,
  action,
  children,
}: {
  n: number;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <span className="grid size-5 place-items-center rounded-full bg-primary/10 text-xs font-medium text-primary">
            {n}
          </span>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** The whole setup on one panel, top to bottom: when, what, which
 * columns, how it's written. Advanced editing opens in sheets. */
export function SettingsPanel({ state }: { state: ExportState }) {
  const { config, setConfig, range, setRange, timeZone } = state;
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);

  const columns = config.columns[config.mode];
  const mode = EXPORT_MODES.find((m) => m.id === config.mode);

  function toggleColumn(id: string) {
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
    <Card>
      <CardContent className="grid gap-7">
        <section className="grid gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            Quick setups
          </p>
          <div className="flex flex-wrap gap-1.5">
            {EXPORT_PRESETS.map((p) => (
              <Button
                key={p.id}
                type="button"
                size="sm"
                variant="outline"
                title={p.hint}
                onClick={() => setConfig((c) => p.apply(c))}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </section>

        <Step n={1} title="Date range">
          <DateRangePicker
            value={range}
            onChange={setRange}
            now={todayIn(timeZone)}
            className="w-full"
          />
        </Step>

        <Step n={2} title="Layout">
          <Tabs
            value={config.mode}
            onValueChange={(v) =>
              setConfig((c) => ({ ...c, mode: v as ExportMode }))
            }
          >
            <TabsList className="w-full">
              {EXPORT_MODES.map((m) => (
                <TabsTrigger key={m.id} value={m.id} className="flex-1">
                  {m.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <p className="text-xs text-muted-foreground">{mode?.hint}</p>
        </Step>

        <Step n={3} title="Include">
          <OptionSelect
            value={config.filters.type}
            options={TYPE_OPTIONS}
            onChange={(type) =>
              setConfig((c) => ({ ...c, filters: { ...c.filters, type } }))
            }
          />
          <ProjectMultiSelect
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
        </Step>

        <Step
          n={4}
          title="Columns"
          action={
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setColumnsOpen(true)}
            >
              <Pencil />
              Edit
            </Button>
          }
        >
          <div className="flex flex-wrap gap-1.5">
            {columns.map((c) => (
              <Button
                key={c.id}
                type="button"
                size="xs"
                variant={c.enabled ? "default" : "outline"}
                aria-pressed={c.enabled}
                className="rounded-full"
                onClick={() => toggleColumn(c.id)}
              >
                {c.header}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Tap to switch a column on or off. Use Edit to rename, reorder or add
            your own.
          </p>
        </Step>

        <Step
          n={5}
          title="Format"
          action={
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setOptionsOpen(true)}
            >
              <SlidersHorizontal />
              More
            </Button>
          }
        >
          <div className="grid gap-1.5">
            <Label htmlFor="quick-duration" className="text-xs">
              Durations
            </Label>
            <OptionSelect
              id="quick-duration"
              value={config.durationFormat}
              options={DURATION_FORMATS}
              onChange={(durationFormat) =>
                setConfig((c) => ({ ...c, durationFormat }))
              }
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="quick-rounding" className="text-xs">
              Round to
            </Label>
            <OptionSelect
              id="quick-rounding"
              value={String(config.rounding)}
              options={ROUNDING_OPTIONS}
              onChange={(v) =>
                setConfig((c) => ({
                  ...c,
                  rounding: Number(v) as typeof c.rounding,
                }))
              }
            />
          </div>
          {config.mode === "entries" && (
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="quick-split" className="text-sm font-normal">
                Split sessions at midnight
              </Label>
              <Switch
                id="quick-split"
                checked={config.splitAtMidnight}
                onCheckedChange={(splitAtMidnight) =>
                  setConfig((c) => ({ ...c, splitAtMidnight }))
                }
              />
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="quick-totals" className="text-sm font-normal">
              Add a totals row
            </Label>
            <Switch
              id="quick-totals"
              checked={config.totalsRow}
              onCheckedChange={(totalsRow) =>
                setConfig((c) => ({ ...c, totalsRow }))
              }
            />
          </div>
        </Step>
      </CardContent>

      <ColumnsSheet
        open={columnsOpen}
        onOpenChange={setColumnsOpen}
        state={state}
      />
      <OptionsSheet
        open={optionsOpen}
        onOpenChange={setOptionsOpen}
        state={state}
      />
    </Card>
  );
}
