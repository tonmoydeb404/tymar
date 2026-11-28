"use client";

import { ProjectMultiSelect } from "@/components/selectors/project-multi-select";
import { EXPORT_MODES, type ExportMode } from "@/lib/export/columns";
import { Label } from "@packages/ui/components/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@packages/ui/components/card";
import { Tabs, TabsList, TabsTrigger } from "@packages/ui/components/tabs";
import { OptionSelect } from "./option-select";
import type { ExportState } from "../use-export";

const TYPE_OPTIONS = [
  { id: "ALL", label: "Work and breaks" },
  { id: "WORK", label: "Work only" },
  { id: "BREAK", label: "Breaks only" },
] as const;

/** What goes into the file: layout (entries / daily / by project) and
 * which entries qualify. */
export function ScopeSection({ state }: { state: ExportState }) {
  const { config, setConfig } = state;
  const mode = EXPORT_MODES.find((m) => m.id === config.mode);

  return (
    <Card>
      <CardHeader>
        <CardTitle>What to export</CardTitle>
        <CardDescription>{mode?.hint}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <Tabs
          value={config.mode}
          onValueChange={(v) =>
            setConfig((c) => ({ ...c, mode: v as ExportMode }))
          }
        >
          <TabsList>
            {EXPORT_MODES.map((m) => (
              <TabsTrigger key={m.id} value={m.id}>
                {m.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="export-type">Include</Label>
            <OptionSelect
              id="export-type"
              value={config.filters.type}
              options={TYPE_OPTIONS}
              onChange={(type) =>
                setConfig((c) => ({ ...c, filters: { ...c.filters, type } }))
              }
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="export-projects">Projects</Label>
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
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
