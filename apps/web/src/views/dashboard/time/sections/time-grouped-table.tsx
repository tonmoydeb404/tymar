"use client";

import type { TimeEntryWithDetails } from "@packages/domain/index";
import { formatDurationShort } from "@packages/domain/index";
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
import {
  flexRender,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { Fragment, useMemo } from "react";
import type { VisibleTimeRow } from "../use-time-day-groups";
import { buildTimeEntryColumns } from "./time-entry-columns";

// Same (empty) feature set as DataTable — sorting/filtering/pagination are
// all handled by the caller, so the table only needs the core row model.
const features = tableFeatures({});

type Props = {
  visible: VisibleTimeRow[];
  totalEntries: number;
  timeZone: string;
  onEdit: (entry: TimeEntryWithDetails) => void;
  onDelete: (entry: TimeEntryWithDetails) => void;
  loading: boolean;
  /** True while a background refetch runs — top bar loader over existing rows. */
  isFetching?: boolean;
  error: string | null;
  onRetry: () => void;
  truncated: boolean;
};

/**
 * Single table for the time list: one header on top, full-span date
 * separator rows (`day` + day totals), entry rows beneath each date.
 * A date split across pages repeats its separator on every page.
 */
export function TimeGroupedTable({
  visible,
  totalEntries,
  timeZone,
  onEdit,
  onDelete,
  loading,
  isFetching = false,
  error,
  onRetry,
  truncated,
}: Props) {
  const columns = useMemo(
    () =>
      buildTimeEntryColumns({
        timeZone,
        onEdit,
        onDelete,
      }),
    [timeZone, onEdit, onDelete],
  );

  const data = useMemo(() => visible.map((v) => v.entry), [visible]);
  const groupById = useMemo(
    () => new Map(visible.map((v) => [v.entry.id, v.group])),
    [visible],
  );

  const table = useTable({ features, columns, data });
  const columnCount = columns.length;
  const headerGroups = table.getHeaderGroups();
  const bodyRows = table.getRowModel().rows;

  return (
    <div className="grid gap-2">
      <div className="relative overflow-hidden rounded-lg border border-border bg-card">
        {!loading && isFetching && (
          <div className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden rounded-full bg-primary/20">
            <div className="h-full w-1/3 animate-[data-table-loader_1s_ease-in-out_infinite] rounded-full bg-primary" />
          </div>
        )}
        <Table>
          <TableHeader>
            {headerGroups.map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: columnCount }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : error ? (
              <TableRow>
                <TableCell colSpan={columnCount} className="h-32 text-center">
                  <div className="grid justify-items-center gap-2" role="alert">
                    <p className="text-sm font-medium text-destructive">
                      Something went wrong
                    </p>
                    <p className="max-w-xs text-sm text-muted-foreground">
                      {error}
                    </p>
                    <Button variant="outline" size="sm" onClick={onRetry}>
                      Try again
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : bodyRows.length ? (
              bodyRows.map((row, index) => {
                const group = groupById.get(row.original.id);
                const prevEntry =
                  index > 0 ? bodyRows[index - 1]?.original : undefined;
                const showDate =
                  group &&
                  (!prevEntry || groupById.get(prevEntry.id) !== group);
                return (
                  <Fragment key={row.id}>
                    {showDate && group && (
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableCell colSpan={columnCount} className="py-2">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="text-sm font-semibold">
                              {group.day}
                            </span>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {formatDurationShort(group.workMs)} work
                              {group.breakMs > 0
                                ? ` · ${formatDurationShort(group.breakMs)} break`
                                : ""}
                              {` · ${group.entries.length} session${group.entries.length === 1 ? "" : "s"}`}
                            </span>
                          </span>
                        </TableCell>
                      </TableRow>
                    )}
                    <TableRow>
                      {row.getAllCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  </Fragment>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={columnCount} className="h-32 text-center">
                  <div className="grid justify-items-center gap-1.5">
                    <p className="text-sm font-medium">
                      {totalEntries === 0
                        ? "No time tracked yet"
                        : "No matching entries"}
                    </p>
                    <p className="max-w-xs text-sm text-muted-foreground">
                      {totalEntries === 0
                        ? "Start the timer in the desktop app — sessions sync here for review."
                        : "Try a different task, project, type, or date range."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {truncated && (
        <p className="text-xs text-muted-foreground">
          Showing the first 2,000 sessions — narrow the date range to see the
          rest.
        </p>
      )}
    </div>
  );
}
