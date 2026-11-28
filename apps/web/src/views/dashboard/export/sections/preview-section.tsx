"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@packages/ui/components/card";
import { Button } from "@packages/ui/components/button";
import { Skeleton } from "@packages/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@packages/ui/components/table";
import { AlertTriangle } from "lucide-react";
import type { ExportState } from "../use-export";

const PREVIEW_ROWS = 8;

/** The first rows of the file exactly as they will be written. */
export function PreviewSection({ state }: { state: ExportState }) {
  const { built, loading, error, truncated, reload, config } = state;
  const shown = built.rows.slice(0, PREVIEW_ROWS);
  const hidden = built.rows.length - shown.length;
  const empty = !loading && !error && built.rowCount === 0;

  return (
    <Card className="min-w-0 lg:sticky lg:top-6">
      <CardHeader>
        <CardTitle>Preview</CardTitle>
        <CardDescription>
          {loading
            ? "Loading entries…"
            : error
              ? "Couldn't load entries."
              : `${built.rowCount} row${built.rowCount === 1 ? "" : "s"} · ${built.headers.length} column${built.headers.length === 1 ? "" : "s"}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {truncated && (
          <p className="flex items-center gap-2 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="size-4 shrink-0" />
            This range has more entries than one export can hold — narrow the
            range to get everything.
          </p>
        )}

        {loading ? (
          <Skeleton className="h-48 w-full" />
        ) : error ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-4 text-sm">
            <span className="text-destructive">{error}</span>
            <Button variant="outline" size="sm" onClick={() => void reload()}>
              Retry
            </Button>
          </div>
        ) : empty ? (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No entries match this range and filters.
          </p>
        ) : built.headers.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Turn on at least one column under Customize.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
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
        {hidden > 0 && (
          <p className="text-xs text-muted-foreground">
            + {hidden} more row{hidden === 1 ? "" : "s"} in the file.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
