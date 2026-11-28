"use client";

import { Button } from "@packages/ui/components/button";
import { ResponsiveSheet } from "@packages/ui/components/responsive-sheet";
import { Skeleton } from "@packages/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@packages/ui/components/table";
import { AlertTriangle, Download } from "lucide-react";
import type { ExportState } from "../use-export";

const PREVIEW_ROWS = 10;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: ExportState;
};

/** The last look before the file is written: what's in it, the first rows
 * exactly as they'll appear, and the confirm button. */
export function ExportDialog({ open, onOpenChange, state }: Props) {
  const { built, loading, error, truncated, reload, config, download } = state;
  const shown = built.rows.slice(0, PREVIEW_ROWS);
  const hidden = built.rows.length - shown.length;
  const empty = !loading && !error && built.rowCount === 0;
  const noColumns = built.headers.length === 0;
  const ready = !loading && !error && !empty && !noColumns;

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      variant="dialog"
      size="lg"
      title="Review your export"
      description={
        loading
          ? "Loading entries…"
          : error
            ? "Couldn't load entries."
            : `${built.rowCount} row${built.rowCount === 1 ? "" : "s"} · ${built.headers.length} column${built.headers.length === 1 ? "" : "s"} · CSV`
      }
      footer={
        <>
          <Button variant="outline" size="lg" onClick={() => onOpenChange(false)}>
            Back
          </Button>
          <Button
            size="lg"
            disabled={!ready}
            onClick={() => {
              download();
              onOpenChange(false);
            }}
          >
            <Download />
            Download CSV
          </Button>
        </>
      }
    >
      <div className="grid gap-3 pb-2">
        {truncated && (
          <p className="flex items-center gap-2 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="size-4 shrink-0" />
            This range has more entries than one export can hold — narrow the
            range to get everything.
          </p>
        )}

        {loading ? (
          <Skeleton className="h-48 w-full" />
        ) : error ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-4 text-sm">
            <span className="text-destructive">{error}</span>
            <Button variant="outline" size="sm" onClick={() => void reload()}>
              Retry
            </Button>
          </div>
        ) : empty ? (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No entries match this range and filters. Go back and widen them.
          </p>
        ) : noColumns ? (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No columns are switched on. Go back and pick at least one.
          </p>
        ) : (
          <div className="max-h-[50svh] overflow-auto rounded-lg border border-border">
            <Table>
              {config.headerRow && (
                <TableHeader>
                  <TableRow>
                    {built.headers.map((h, i) => (
                      <TableHead key={i} className="whitespace-nowrap">
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
              )}
              <TableBody>
                {shown.map((row, r) => (
                  <TableRow key={r}>
                    {row.map((cell, c) => (
                      <TableCell
                        key={c}
                        className="font-mono text-xs whitespace-nowrap tabular-nums"
                      >
                        {cell}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {ready && hidden > 0 && (
          <p className="text-xs text-muted-foreground">
            + {hidden} more row{hidden === 1 ? "" : "s"} in the file.
          </p>
        )}
      </div>
    </ResponsiveSheet>
  );
}
