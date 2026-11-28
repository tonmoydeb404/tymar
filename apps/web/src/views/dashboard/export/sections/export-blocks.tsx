"use client";

import { unknownTokens } from "@/lib/export/build";
import {
  COLUMN_CATALOG,
  type ColumnConfig,
  type ExportConfig,
} from "@/lib/export/columns";
import {
  DATE_FORMATS,
  DURATION_FORMATS,
  ROUNDING_STEPS,
  TIME_FORMATS,
} from "@/lib/export/formats";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { Input } from "@packages/ui/components/input";
import { Switch } from "@packages/ui/components/switch";
import {
  ArrowDown,
  ArrowUp,
  Plus,
  Trash2,
} from "lucide-react";
import { FieldControl, SwitchField, TextField } from "@packages/ui/fields/core";
import { useState } from "react";
import type { ExportState } from "../use-export";
import { OptionSelect } from "./option-select";

const DELIMITERS = [
  { id: ",", label: "Comma", example: "a,b" },
  { id: ";", label: "Semicolon", example: "a;b" },
  { id: "\t", label: "Tab", example: "a⇥b" },
  { id: "|", label: "Pipe", example: "a|b" },
] as const;

const ROUNDING_OPTIONS = ROUNDING_STEPS.map((m) => ({
  id: String(m),
  label: m === 0 ? "Exact (no rounding)" : `Nearest ${m} min`,
}));

const DECIMAL_MARKS = [
  { id: ".", label: "Dot", example: "8.25" },
  { id: ",", label: "Comma", example: "8,25" },
] as const;

function Block({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4 border-t border-border pt-6 first:border-t-0 first:pt-0">
      <div className="grid gap-0.5">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

// ---- Columns ----

function ColumnRow({
  column,
  index,
  count,
  mode,
  onChange,
  onMove,
  onRemove,
}: {
  column: ColumnConfig;
  index: number;
  count: number;
  mode: ExportConfig["mode"];
  onChange: (patch: Partial<ColumnConfig>) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove?: () => void;
}) {
  const unknown = column.custom
    ? unknownTokens(column.custom.template, mode)
    : [];
  const hint = COLUMN_CATALOG[mode].find((d) => d.id === column.id)?.hint;

  return (
    <li className="grid gap-2 rounded-xl border border-border p-3">
      <div className="flex items-center gap-2">
        <Switch
          size="sm"
          checked={column.enabled}
          onCheckedChange={(enabled) => onChange({ enabled })}
          aria-label={`Include ${column.header}`}
        />
        <Input
          value={column.header}
          onChange={(e) => onChange({ header: e.target.value })}
          aria-label="Column header"
          className="h-8 flex-1"
        />
        {column.custom && <Badge variant="secondary">Custom</Badge>}
        <div className="flex shrink-0">
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            aria-label="Move up"
          >
            <ArrowUp />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={index === count - 1}
            onClick={() => onMove(1)}
            aria-label="Move down"
          >
            <ArrowDown />
          </Button>
          {onRemove && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onRemove}
              aria-label="Remove column"
            >
              <Trash2 />
            </Button>
          )}
        </div>
      </div>
      {column.custom ? (
        <div className="grid gap-1">
          <Input
            value={column.custom.template}
            onChange={(e) =>
              onChange({ custom: { template: e.target.value } })
            }
            aria-label="Column value"
            placeholder="{project} / {task}"
            className="h-8 font-mono text-xs"
          />
          {unknown.length > 0 && (
            <p className="text-xs text-destructive">
              Unknown value{unknown.length > 1 ? "s" : ""}:{" "}
              {unknown.map((u) => `{${u}}`).join(", ")} — these export empty.
            </p>
          )}
        </div>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </li>
  );
}

export function ColumnsBlock({ state }: { state: ExportState }) {
  const { config, setConfig } = state;
  const mode = config.mode;
  const columns = config.columns[mode];
  const tokens = COLUMN_CATALOG[mode];

  const [name, setName] = useState("");
  const [template, setTemplate] = useState("");

  function update(next: ColumnConfig[]) {
    setConfig((c) => ({ ...c, columns: { ...c.columns, [mode]: next } }));
  }
  function patch(id: string, p: Partial<ColumnConfig>) {
    update(columns.map((c) => (c.id === id ? { ...c, ...p } : c)));
  }
  function move(index: number, delta: -1 | 1) {
    const next = [...columns];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    update(next);
  }
  function addCustom() {
    if (!name.trim() || !template.trim()) return;
    update([
      ...columns,
      {
        id: `custom-${Date.now().toString(36)}`,
        header: name.trim(),
        enabled: true,
        custom: { template: template.trim() },
      },
    ]);
    setName("");
    setTemplate("");
  }

  const preview = unknownTokens(template, mode);

  return (
    <Block
      title="Columns"
      description="Switch columns on or off, rename the headers, and put them in order with the arrows."
    >
      <ul className="grid gap-2">
        {columns.map((c, i) => (
          <ColumnRow
            key={c.id}
            column={c}
            index={i}
            count={columns.length}
            mode={mode}
            onChange={(p) => patch(c.id, p)}
            onMove={(d) => move(i, d)}
            onRemove={
              c.custom ? () => update(columns.filter((x) => x.id !== c.id)) : undefined
            }
          />
        ))}
      </ul>

      <div className="grid gap-3 rounded-xl border border-dashed border-border p-4">
        <div className="grid gap-0.5">
          <h4 className="text-sm font-medium">Add a custom column</h4>
          <p className="text-xs text-muted-foreground">
            Type any text and drop in values from the buttons below. For
            durations add a format, e.g.{" "}
            <code className="font-mono">{"{duration:dot}"}</code>.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
          <TextField
            id="custom-name"
            label="Column name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Invoice line"
          />
          <TextField
            id="custom-template"
            label="Value"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            placeholder="{project} – {task}"
            className="font-mono text-xs"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {tokens.map((t) => (
            <Button
              key={t.id}
              type="button"
              size="xs"
              variant="outline"
              className="rounded-full font-mono"
              onClick={() => setTemplate((v) => `${v}{${t.id}}`)}
            >
              {`{${t.id}}`}
            </Button>
          ))}
        </div>
        {preview.length > 0 && (
          <p className="text-xs text-destructive">
            Unknown: {preview.map((u) => `{${u}}`).join(", ")}
          </p>
        )}
        <div>
          <Button
            type="button"
            size="sm"
            onClick={addCustom}
            disabled={!name.trim() || !template.trim()}
          >
            <Plus />
            Add column
          </Button>
        </div>
      </div>
    </Block>
  );
}

// ---- Formats ----

export function FormatsBlock({ state }: { state: ExportState }) {
  const { config, setConfig } = state;
  return (
    <Block
      title="Formats"
      description="How durations, dates and clock times are written."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldControl label="Duration" htmlFor="fmt-duration">
          <OptionSelect
            id="fmt-duration"
            value={config.durationFormat}
            options={DURATION_FORMATS}
            onChange={(durationFormat) =>
              setConfig((c) => ({ ...c, durationFormat }))
            }
          />
        </FieldControl>
        <FieldControl label="Round durations" htmlFor="fmt-rounding">
          <OptionSelect
            id="fmt-rounding"
            value={String(config.rounding)}
            options={ROUNDING_OPTIONS}
            onChange={(v) =>
              setConfig((c) => ({
                ...c,
                rounding: Number(v) as ExportConfig["rounding"],
              }))
            }
          />
        </FieldControl>
        {config.durationFormat === "decimal" && (
          <FieldControl label="Decimal mark" htmlFor="fmt-decimal">
            <OptionSelect
              id="fmt-decimal"
              value={config.decimalMark}
              options={DECIMAL_MARKS}
              onChange={(decimalMark) =>
                setConfig((c) => ({ ...c, decimalMark }))
              }
            />
          </FieldControl>
        )}
        <FieldControl label="Date" htmlFor="fmt-date">
          <OptionSelect
            id="fmt-date"
            value={config.dateFormat}
            options={DATE_FORMATS}
            onChange={(dateFormat) => setConfig((c) => ({ ...c, dateFormat }))}
          />
        </FieldControl>
        <FieldControl label="Clock time" htmlFor="fmt-time">
          <OptionSelect
            id="fmt-time"
            value={config.timeFormat}
            options={TIME_FORMATS}
            onChange={(timeFormat) => setConfig((c) => ({ ...c, timeFormat }))}
          />
        </FieldControl>
      </div>
    </Block>
  );
}

// ---- Rows & file ----

export function FileBlock({ state }: { state: ExportState }) {
  const { config, setConfig } = state;
  return (
    <Block title="Rows & file">
      <div className="grid gap-4">
        {config.mode === "entries" && (
          <>
            <SwitchField
              id="opt-split"
              label="Split sessions at midnight"
              description="A session that crosses midnight becomes one row per day, so each day's hours are right."
              checked={config.splitAtMidnight}
              onCheckedChange={(splitAtMidnight) =>
                setConfig((c) => ({ ...c, splitAtMidnight }))
              }
            />
            <SwitchField
              id="opt-running"
              label="Include the running timer"
              description="Counts time up to now for an entry that hasn't been stopped."
              checked={config.includeRunning}
              onCheckedChange={(includeRunning) =>
                setConfig((c) => ({ ...c, includeRunning }))
              }
            />
          </>
        )}
        {config.mode === "daily" && (
          <SwitchField
            id="opt-empty"
            label="Include days with no time"
            description="Lists every day in the range, even when nothing was tracked."
            checked={config.emptyDays}
            onCheckedChange={(emptyDays) => setConfig((c) => ({ ...c, emptyDays }))}
          />
        )}
        <SwitchField
          id="opt-totals"
          label="Add a totals row"
          description="Sums the duration and count columns at the bottom."
          checked={config.totalsRow}
          onCheckedChange={(totalsRow) => setConfig((c) => ({ ...c, totalsRow }))}
        />
        <SwitchField
          id="opt-header"
          label="Include the header row"
          checked={config.headerRow}
          onCheckedChange={(headerRow) => setConfig((c) => ({ ...c, headerRow }))}
        />
        <FieldControl
          label="Separator"
          htmlFor="opt-delimiter"
          className="sm:max-w-xs"
        >
          <OptionSelect
            id="opt-delimiter"
            value={config.csv.delimiter}
            options={DELIMITERS}
            onChange={(delimiter) =>
              setConfig((c) => ({ ...c, csv: { ...c.csv, delimiter } }))
            }
          />
        </FieldControl>
        <SwitchField
          id="opt-bom"
          label="Excel-friendly encoding"
          description="Adds a byte-order mark so Excel reads accented characters correctly."
          checked={config.csv.bom}
          onCheckedChange={(bom) => setConfig((c) => ({ ...c, csv: { ...c.csv, bom } }))}
        />
        <SwitchField
          id="opt-protect"
          label="Protect against spreadsheet formulas"
          description="Prefixes text that starts with = + - or @ so a task name can't run as a formula."
          checked={config.csv.protectFormulas}
          onCheckedChange={(protectFormulas) =>
            setConfig((c) => ({ ...c, csv: { ...c.csv, protectFormulas } }))
          }
        />
      </div>
    </Block>
  );
}
