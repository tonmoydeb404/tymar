import { appPaths } from "@/config/paths-config";
import { formatDurationShort } from "@packages/domain/index";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@packages/ui/components/card";
import { DataState } from "@packages/ui/components/data-state";
import { Progress } from "@packages/ui/components/progress";
import { Skeleton } from "@packages/ui/components/skeleton";
import Link from "next/link";
import type { ProjectShare } from "../use-overview-entries";

type Props = {
  data: ProjectShare[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
};

/** Where the worked time went, biggest project first. */
export function ProjectBreakdownSection({
  data,
  loading,
  error,
  onRetry,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>By project</CardTitle>
        <CardDescription>Share of worked time in this range.</CardDescription>
      </CardHeader>
      <CardContent>
        <DataState
          loading={loading}
          error={error}
          data={data.slice(0, 6)}
          onRetry={onRetry}
          emptyTitle="No work tracked yet"
          emptyHint="Start a timer to see where your time goes."
          loadingComponent={<Skeleton className="h-48 w-full" />}
        >
          {(rows) => (
            <ul className="grid gap-4">
              {rows.map((p) => (
                <li key={p.name} className="grid gap-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate font-medium">{p.name}</span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                      {formatDurationShort(p.workMs)} ·{" "}
                      {Math.round(p.share * 100)}%
                    </span>
                  </div>
                  <Progress value={p.share * 100} />
                </li>
              ))}
              {data.length > 6 && (
                <li className="text-xs text-muted-foreground">
                  +{data.length - 6} more —{" "}
                  <Link
                    href={appPaths.time}
                    className="text-foreground underline-offset-2 hover:underline"
                  >
                    see all time
                  </Link>
                </li>
              )}
            </ul>
          )}
        </DataState>
      </CardContent>
    </Card>
  );
}
