// Turns time entries into export rows. Pure — all inputs are passed in.

import {
  dayBounds,
  dayKey,
  type TimeEntryWithDetails,
} from "@packages/domain/index";
import {
  COLUMN_CATALOG,
  type ColumnDef,
  type ExportConfig,
  type ExportMode,
} from "./columns";
import {
  DURATION_FORMATS,
  formatClock,
  formatDay,
  formatDurationAs,
  formatWeekday,
  roundMs,
  type DurationFormat,
} from "./formats";

/** A duration is kept as milliseconds until it is rendered, so rounding,
 * format overrides and totals all work from the exact value. */
type Cell = string | { ms: number };
type Row = Record<string, Cell>;

export type BuildContext = {
  timeZone: string;
  nowMs: number;
  /** Inclusive "YYYY-MM-DD" range — used to list empty days. */
  range: { from: string; to: string };
  /** projectId → workspace name. */
  workspaceByProject: Map<string, string>;
};

type Slice = {
  entry: TimeEntryWithDetails;
  day: string;
  startMs: number;
  endMs: number;
};

function toSlices(
  entries: TimeEntryWithDetails[],
  split: boolean,
  includeRunning: boolean,
  ctx: BuildContext,
): Slice[] {
  const slices: Slice[] = [];
  for (const entry of entries) {
    const startMs = new Date(entry.startedAt).getTime();
    if (!Number.isFinite(startMs)) continue;
    let endMs = entry.endedAt ? new Date(entry.endedAt).getTime() : NaN;
    if (!Number.isFinite(endMs)) {
      if (!includeRunning) continue;
      endMs = ctx.nowMs;
    }
    if (endMs <= startMs) continue;

    if (!split) {
      slices.push({ entry, day: dayKey(startMs, ctx.timeZone), startMs, endMs });
      continue;
    }
    let cursor = startMs;
    while (cursor < endMs) {
      const bounds = dayBounds(cursor, ctx.timeZone);
      const sliceEnd = Math.min(endMs, bounds.endMs);
      slices.push({
        entry,
        day: dayKey(cursor, ctx.timeZone),
        startMs: cursor,
        endMs: sliceEnd,
      });
      cursor = sliceEnd;
    }
  }
  return slices.sort((a, b) => a.startMs - b.startMs);
}

function clock(ms: number, cfg: ExportConfig, ctx: BuildContext) {
  return formatClock(ms, ctx.timeZone, cfg.timeFormat);
}

function entryRows(
  slices: Slice[],
  cfg: ExportConfig,
  ctx: BuildContext,
): Row[] {
  return slices.map(({ entry, day, startMs, endMs }) => ({
    date: formatDay(day, cfg.dateFormat),
    weekday: formatWeekday(startMs, ctx.timeZone),
    start: clock(startMs, cfg, ctx),
    end: clock(endMs, cfg, ctx),
    duration: { ms: endMs - startMs },
    type: entry.type === "BREAK" ? "Break" : "Work",
    project: entry.projectName ?? "",
    task: entry.taskTitle ?? "",
    workspace: entry.projectId
      ? (ctx.workspaceByProject.get(entry.projectId) ?? "")
      : "",
    start_iso: new Date(startMs).toISOString(),
    end_iso: new Date(endMs).toISOString(),
    id: entry.id,
  }));
}

/** "YYYY-MM-DD" keys from `from` to `to` inclusive. */
function daysBetween(from: string, to: string): string[] {
  const keys: string[] = [];
  const cursor = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  while (cursor.getTime() <= end.getTime() && keys.length < 3700) {
    keys.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

function dailyRows(
  slices: Slice[],
  cfg: ExportConfig,
  ctx: BuildContext,
): Row[] {
  const byDay = new Map<string, Slice[]>();
  for (const s of slices) {
    const list = byDay.get(s.day) ?? [];
    list.push(s);
    byDay.set(s.day, list);
  }
  const days = cfg.emptyDays
    ? daysBetween(ctx.range.from, ctx.range.to)
    : [...byDay.keys()].sort();

  return days.map((day) => {
    const list = byDay.get(day) ?? [];
    let work = 0;
    let rest = 0;
    for (const s of list) {
      const ms = s.endMs - s.startMs;
      if (s.entry.type === "BREAK") rest += ms;
      else work += ms;
    }
    const noonUtc = new Date(`${day}T12:00:00.000Z`).getTime();
    const names = [
      ...new Set(list.map((s) => s.entry.projectName).filter(Boolean)),
    ] as string[];
    return {
      date: formatDay(day, cfg.dateFormat),
      weekday: formatWeekday(noonUtc, "UTC"),
      work: { ms: work },
      break: { ms: rest },
      total: { ms: work + rest },
      entries: String(new Set(list.map((s) => s.entry.id)).size),
      first_start: list.length
        ? clock(Math.min(...list.map((s) => s.startMs)), cfg, ctx)
        : "",
      last_end: list.length
        ? clock(Math.max(...list.map((s) => s.endMs)), cfg, ctx)
        : "",
      projects: names.join("; "),
    };
  });
}

function projectRows(
  slices: Slice[],
  cfg: ExportConfig,
  ctx: BuildContext,
): Row[] {
  type Acc = {
    name: string;
    workspace: string;
    work: number;
    rest: number;
    entries: Set<string>;
    days: Set<string>;
  };
  const byProject = new Map<string, Acc>();
  for (const s of slices) {
    const key = s.entry.projectId ?? "";
    const acc = byProject.get(key) ?? {
      name: s.entry.projectName ?? "No project",
      workspace: key ? (ctx.workspaceByProject.get(key) ?? "") : "",
      work: 0,
      rest: 0,
      entries: new Set<string>(),
      days: new Set<string>(),
    };
    const ms = s.endMs - s.startMs;
    if (s.entry.type === "BREAK") acc.rest += ms;
    else acc.work += ms;
    acc.entries.add(s.entry.id);
    acc.days.add(s.day);
    byProject.set(key, acc);
  }
  const all = [...byProject.values()];
  const totalWork = all.reduce((n, a) => n + a.work, 0);
  return all
    .sort((a, b) => b.work + b.rest - (a.work + a.rest))
    .map((a) => {
      const days = [...a.days].sort();
      return {
        project: a.name,
        workspace: a.workspace,
        work: { ms: a.work },
        break: { ms: a.rest },
        total: { ms: a.work + a.rest },
        entries: String(a.entries.size),
        days: String(a.days.size),
        share: totalWork > 0 ? `${((a.work / totalWork) * 100).toFixed(1)}%` : "0%",
        first_date: days[0] ? formatDay(days[0], cfg.dateFormat) : "",
        last_date: days.length
          ? formatDay(days[days.length - 1]!, cfg.dateFormat)
          : "",
      };
    });
}

// ---- Rendering ----

function render(cell: Cell | undefined, cfg: ExportConfig, as?: DurationFormat) {
  if (cell === undefined) return "";
  if (typeof cell === "string") return cell;
  return formatDurationAs(
    roundMs(cell.ms, cfg.rounding),
    as ?? cfg.durationFormat,
    cfg.decimalMark,
  );
}

const TOKEN = /\{(\w+)(?::(\w+))?\}/g;

/** Fills a custom-column template. `{id}` inserts a column's value;
 * `{duration:dot}` renders a duration cell in a specific format. Unknown
 * tokens become empty (the builder warns about them). */
export function renderTemplate(
  template: string,
  row: Row,
  cfg: ExportConfig,
): string {
  return template.replace(TOKEN, (_m, id: string, fmt?: string) => {
    const as = DURATION_FORMATS.some((f) => f.id === fmt)
      ? (fmt as DurationFormat)
      : undefined;
    return render(row[id], cfg, as);
  });
}

/** Token names in a template that the mode doesn't provide. */
export function unknownTokens(template: string, mode: ExportMode): string[] {
  const known = new Set(COLUMN_CATALOG[mode].map((c) => c.id));
  const bad = new Set<string>();
  for (const m of template.matchAll(TOKEN)) {
    if (!known.has(m[1]!)) bad.add(m[1]!);
  }
  return [...bad];
}

export type BuiltExport = {
  headers: string[];
  rows: string[][];
  /** Rows of data (excluding header and totals). */
  rowCount: number;
};

export function buildExport(
  entries: TimeEntryWithDetails[],
  cfg: ExportConfig,
  ctx: BuildContext,
): BuiltExport {
  const mode = cfg.mode;
  const slices = toSlices(
    entries,
    mode === "entries" ? cfg.splitAtMidnight : true,
    cfg.includeRunning,
    ctx,
  );
  const data =
    mode === "entries"
      ? entryRows(slices, cfg, ctx)
      : mode === "daily"
        ? dailyRows(slices, cfg, ctx)
        : projectRows(slices, cfg, ctx);

  const columns = cfg.columns[mode].filter((c) => c.enabled);
  const defs = new Map<string, ColumnDef>(
    COLUMN_CATALOG[mode].map((d) => [d.id, d]),
  );

  const rows = data.map((row) =>
    columns.map((c) =>
      c.custom
        ? renderTemplate(c.custom.template, row, cfg)
        : render(row[c.id], cfg),
    ),
  );

  if (cfg.totalsRow && data.length > 0) {
    const totals = columns.map((c, i) => {
      const def = c.custom ? undefined : defs.get(c.id);
      if (def?.duration) {
        const ms = data.reduce((n, r) => {
          const cell = r[c.id];
          return n + (typeof cell === "object" ? cell.ms : 0);
        }, 0);
        return render({ ms }, cfg);
      }
      if (def?.sum) {
        return String(
          data.reduce((n, r) => n + (Number(r[c.id] as string) || 0), 0),
        );
      }
      return i === 0 ? "Total" : "";
    });
    rows.push(totals);
  }

  return {
    headers: columns.map((c) => c.header),
    rows,
    rowCount: data.length,
  };
}
